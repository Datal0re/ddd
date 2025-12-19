#!/usr/bin/env node
// dump.js - Enhanced version for direct file processing
const fs = require('fs').promises;
const path = require('path');

/**
 * Configuration options
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    inputPath: null,
    outputDir: null,
    createSubdirs: false,
    preserveOriginal: false,
    overwrite: false,
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--create-subdirs':
        options.createSubdirs = true;
        break;
      case '--preserve':
        options.preserveOriginal = true;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!options.inputPath) {
          options.inputPath = arg;
        } else if (!options.outputDir) {
          options.outputDir = arg;
        }
        break;
    }
  }

  // Set defaults
  options.inputPath = options.inputPath || 'conversations.json';
  options.outputDir =
    options.outputDir || path.join(path.dirname(options.inputPath), 'conversations');

  return options;
}

function showHelp() {
  console.log(`
Usage: node dump.js [inputPath] [outputDir] [options]

Arguments:
  inputPath    Path to conversations.json file (default: conversations.json)
  outputDir    Directory to save individual conversation files (default: ./conversations)

Options:
  --create-subdirs   Create a 'conversations' subdirectory in outputDir
  --preserve         Keep original conversations.json file
  --overwrite        Overwrite existing files (default: skip existing)
  --verbose          Enable verbose logging
  --help             Show this help message

Examples:
  node dump.js                                   # Use defaults
  node dump.js /path/to/conversations.json       # Custom input path
  node dump.js data.json ./output                # Custom input and output
  node dump.js data.json ./out --create-subdirs  # Create conversations subdirectory
  node dump.js data.json ./out --overwrite       # Overwrite existing files
`);
}

/**
 * Utility functions
 */
function sanitizeFilename(rawTitle) {
  // Remove characters not suitable for filenames, then replace spaces with underscores
  const noBad = rawTitle.replace(/[^\w\s-]/g, '');
  const sanitized = noBad.trim().replace(/\s+/g, '_');

  // Limit length and ensure it's not empty
  return sanitized.length > 0 ? sanitized.substring(0, 100) : 'untitled';
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
async function dumpConversations(inputPath, outputDir, options = {}) {
  const {
    createSubdirs = false,
    preserveOriginal = false,
    overwrite = false,
    verbose = false,
  } = options;

  // Resolve input path
  const resolvedInputPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(inputPath);

  // Determine final output directory
  const finalOutputDir = createSubdirs
    ? path.join(outputDir, 'conversations')
    : outputDir;

  console.log(`Dumping conversations from ${resolvedInputPath} to ${finalOutputDir}`);

  try {
    // Read and validate input file
    const raw = await fs.readFile(resolvedInputPath, 'utf8');
    const conversations = JSON.parse(raw);

    if (!Array.isArray(conversations)) {
      throw new Error('Expected an array of conversations in input file');
    }

    console.log(`Found ${conversations.length} conversations to process`);

    // Sort newest first
    conversations.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));

    // Create output directory if it doesn't exist
    await fs.mkdir(finalOutputDir, { recursive: true });

    // Process each conversation
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const conv of conversations) {
      try {
        const ts = extractTimestamp(conv);
        const dateStr = formatDateFromTimestamp(ts);
        const rawTitle = conv.title || 'untitled';
        const cleanTitle = sanitizeFilename(rawTitle);
        const filename = `${dateStr}_${cleanTitle}.json`;
        const filepath = path.join(finalOutputDir, filename);

        // Check if file exists
        if (!overwrite) {
          try {
            await fs.access(filepath);
            if (verbose) {
              console.log(`Skipping existing file: ${filename}`);
            }
            skipped++;
            continue;
          } catch {
            // File doesn't exist, proceed
          }
        }

        // Write conversation file
        await fs.writeFile(filepath, JSON.stringify(conv, null, 2), 'utf8');
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
        await fs.unlink(resolvedInputPath);
        console.log('Removed original conversations.json file');
      } catch (err) {
        console.warn(`Failed to remove original file: ${err.message}`);
      }
    }

    console.log(
      `dump completed: ${processed} processed, ${skipped} skipped, ${errors} errors`
    );

    return {
      processed,
      skipped,
      errors,
      total: conversations.length,
    };
  } catch (err) {
    console.error(`dump failed: ${err.message}`);
    throw err;
  }
}

/**
 * Main function for CLI usage
 */
async function main() {
  try {
    const options = parseArguments();

    if (options.verbose) {
      console.log('Starting dump with options: ', options);
    }

    const result = await dumpConversations(
      options.inputPath,
      options.outputDir,
      options
    );

    if (result.errors > 0) {
      console.warn(`dump completed with ${result.errors} errors`);
      process.exit(1);
    } else {
      console.log('dump completed successfully');
      process.exit(0);
    }
  } catch (err) {
    console.error('dump failed:', err);
    process.exit(1);
  }
}

/**
 * Export function for programmatic usage
 */
module.exports = {
  dumpConversations,
  sanitizeFilename,
  extractTimestamp,
  formatDateFromTimestamp,
  parseArguments,
};
// Ensure the script runs only when executed directly, not when imported
if (require.main === module) {
  main().catch(err => {
    console.error('dump failed:', err);
    process.exit(1);
  });
}
