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
    for (const chat of chats) {
      try {
        const ts = extractTimestamp(chat);
        const dateStr = formatDateFromTimestamp(ts);
        const rawTitle = chat.title || 'untitled';
        const cleanTitle = sanitizeFilename(rawTitle);
        const filename = `${dateStr}_${cleanTitle}.json`;
        const filepath = FileUtils.joinPath(finalOutputDir, filename);

        // Check if file exists
        if (!overwrite) {
          if (await FileUtils.fileExists(filepath)) {
            if (verbose) {
              console.log(`Skipping existing file: ${filename}`);
            }
            skipped++;
            continue;
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
      }
    }

    // Remove original file if requested
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
    }

    return {
      processed,
      skipped,
      errors,
      total: chats.length,
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
};
