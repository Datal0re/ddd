/*
 * ChatDumper.js - Chat conversation processing utility
 * Processes ChatGPT conversation JSON files into individual chat files
 */

const FileUtils = require('./FileUtils');

/**
 * Utility functions
 */
function sanitizeFilename(rawTitle) {
  return FileUtils.sanitizeName(rawTitle, { type: 'filename' });
}

function toNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function extractTimestamp(conv) {
  if (conv.update_time != null) return toNumber(conv.update_time);
  if (conv.create_time != null) return toNumber(conv.create_time);
  return 0;
}

function formatDateFromTimestamp(ts) {
  const dt = new Date(ts * 1000); // ts is in seconds
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/**
 * Extract unique identifier from chat using first message ID (Option A)
 * @param {Object} chat - Chat object
 * @returns {string|null} First message ID or null if not found
 */
function extractChatIdentifier(chat) {
  if (!chat || !chat.mapping) {
    return null;
  }

  // Get all message IDs from mapping
  const messageIds = Object.keys(chat.mapping);

  if (messageIds.length === 0) {
    return null;
  }

  // Return the first message ID (these are typically sorted by creation order)
  return messageIds[0];
}

/**
 * Check if two chats are identical by comparing key attributes
 * @param {Object} chat1 - First chat object
 * @param {Object} chat2 - Second chat object
 * @returns {boolean} True if chats are identical
 */
async function areChatsIdentical(chat1, chat2) {
  // Compare titles
  if (chat1.title !== chat2.title) {
    return false;
  }

  // Compare timestamps
  if (
    chat1.create_time !== chat2.create_time ||
    chat1.update_time !== chat2.update_time
  ) {
    return false;
  }

  // Compare unique identifiers (first message ID)
  const id1 = extractChatIdentifier(chat1);
  const id2 = extractChatIdentifier(chat2);

  if (id1 !== id2) {
    return false;
  }

  // Additional check: compare mapping keys (more robust)
  const keys1 = Object.keys(chat1.mapping || {}).sort();
  const keys2 = Object.keys(chat2.mapping || {}).sort();

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let i = 0; i < keys1.length; i++) {
    if (keys1[i] !== keys2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Escape special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the next available counter for a base filename
 * @param {string} outputDir - Directory to search
 * @param {string} baseFilename - Base filename without extension
 * @returns {Promise<number>} Next available counter number
 */
async function getNextCounter(outputDir, baseFilename) {
  try {
    const files = await FileUtils.listDirectory(outputDir);
    const counterRegex = new RegExp(`^${escapeRegExp(baseFilename)}_(\\d+)\\.json$`);

    let maxCounter = 0;

    for (const file of files) {
      const match = file.match(counterRegex);
      if (match) {
        const counter = parseInt(match[1], 10);
        if (counter > maxCounter) {
          maxCounter = counter;
        }
      }
    }

    return maxCounter + 1;
  } catch {
    // If directory listing fails, start with 1
    return 1;
  }
}

/**
 * Enhanced dump function for direct file processing
 */
async function dumpChats(inputPath, outputDir, options = {}) {
  const {
    createSubdirs = false,
    preserveOriginal = false,
    overwrite = false,
    verbose = false,
  } = options;

  // Resolve input path
  const resolvedInputPath = FileUtils.isAbsolute(inputPath)
    ? inputPath
    : FileUtils.resolvePath(inputPath);

  // Determine final output directory
  const finalOutputDir = createSubdirs
    ? FileUtils.joinPath(outputDir, 'chats')
    : outputDir;

  if (verbose) {
    console.log(`Dumping chats from ${resolvedInputPath} to ${finalOutputDir}`);
  }

  try {
    // Read and validate input file
    const chats = await FileUtils.readJsonFile(resolvedInputPath);

    if (!Array.isArray(chats)) {
      throw new Error('Expected an array of chats in input file');
    }

    if (verbose) {
      console.log(`Found ${chats.length} chats to process`);
    }

    // Sort newest first
    chats.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));

    // Create output directory if it doesn't exist
    await FileUtils.ensureDirectory(finalOutputDir);

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let trueDuplicates = 0;
    let collisionsResolved = 0;
    for (const chat of chats) {
      try {
        const ts = extractTimestamp(chat);
        const dateStr = formatDateFromTimestamp(ts);
        const rawTitle = chat.title || 'untitled';
        const cleanTitle = sanitizeFilename(rawTitle);
        let filename = `${dateStr}_${cleanTitle}.json`;
        let filepath = FileUtils.joinPath(finalOutputDir, filename);

        // Check if file exists and handle collision detection
        if (!overwrite) {
          if (await FileUtils.fileExists(filepath)) {
            // Load existing chat for comparison
            try {
              const existingChat = await FileUtils.readJsonFile(filepath);
              const isDuplicate = await areChatsIdentical(chat, existingChat);

              if (isDuplicate) {
                if (verbose) {
                  console.log(`Skipping duplicate chat: ${filename}`);
                }
                trueDuplicates++;
                skipped++;
                continue;
              } else {
                // Same filename, different content - add counter suffix
                const baseFilename = `${dateStr}_${cleanTitle}`;
                const counter = await getNextCounter(finalOutputDir, baseFilename);
                filename = `${baseFilename}_${counter}.json`;
                filepath = FileUtils.joinPath(finalOutputDir, filename);
                collisionsResolved++;

                if (verbose) {
                  console.log(
                    `Collision resolved: ${filename} (different chat with same name)`
                  );
                }
              }
            } catch (error) {
              // If we can't read the existing file, treat as collision
              console.warn(
                `Warning: Could not read existing file ${filepath} for comparison: ${error.message}`
              );
              const baseFilename = `${dateStr}_${cleanTitle}`;
              const counter = await getNextCounter(finalOutputDir, baseFilename);
              filename = `${baseFilename}_${counter}.json`;
              filepath = FileUtils.joinPath(finalOutputDir, filename);
              collisionsResolved++;
            }
          }
        }

        // Write chat file
        await FileUtils.writeJsonFile(filepath, chat);
        processed++;

        if (verbose) {
          console.log(`Processed: ${filename}`);
        }
      } catch (err) {
        console.error(`Error processing conversation: ${err.message}`);
        errors++;
        // Note: failed files are not counted in the final processed count
        processed--;
      }
    }

    // Remove original file if requested (only if files were successfully processed)
    if (!preserveOriginal && processed > 0) {
      try {
        const fs = require('fs').promises; // Use original fs for unlink since FileUtils doesn't have it
        await fs.unlink(resolvedInputPath);
        if (verbose) {
          console.log('Removed original conversations.json file');
        }
      } catch (err) {
        console.warn(`Failed to remove original file: ${err.message}`);
      }
    }

    if (verbose) {
      console.log(
        `dump completed: ${processed} processed, ${skipped} skipped, ${errors} errors`
      );
      if (trueDuplicates > 0) {
        console.log(`  - ${trueDuplicates} true duplicates skipped`);
      }
      if (collisionsResolved > 0) {
        console.log(`  - ${collisionsResolved} filename collisions resolved`);
      }
    }

    return {
      processed,
      skipped,
      errors,
      total: chats.length,
      trueDuplicates,
      collisionsResolved,
    };
  } catch (err) {
    console.error(`dump failed: ${err.message}`);
    throw err;
  }
}

/**
 * Export function for programmatic usage
 */
module.exports = {
  dumpChats,
  sanitizeFilename,
  extractTimestamp,
  formatDateFromTimestamp,
  extractChatIdentifier,
  areChatsIdentical,
  getNextCounter,
};
