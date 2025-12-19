#!/usr/bin/env node
// conversation-dumper.js - Enhanced version for direct file processing
const { CLIFramework } = require('../utils/cliFramework');
const FileSystemHelper = require('../utils/fsHelpers');
const PathUtils = require('../utils/pathUtils');

/**
 * Configuration options
 */
function parseArguments() {
  const config = {
    defaults: {
      createSubdirs: false,
      preserveOriginal: false,
      overwrite: false,
      verbose: false,
    },
    flags: [
      {
        name: 'createSubdirs',
        flag: '--create-subdirs',
        type: 'boolean',
        description: 'Create a conversations subdirectory in outputDir',
      },
    ],
    positional: ['inputPath', 'outputDir'],
  };

  const options = CLIFramework.parseArguments(config);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Set defaults
  options.inputPath = options.inputPath || 'conversations.json';
  options.outputDir =
    options.outputDir ||
    FileSystemHelper.joinPath(
      FileSystemHelper.getDirName(options.inputPath),
      'conversations'
    );

  return options;
}

function showHelp() {
  const config = {
    usage: 'node conversation-dumper.js [inputPath] [outputDir] [options]',
    positional: [
      {
        name: 'inputPath',
        description: 'Path to conversations.json file (default: conversations.json)',
      },
      {
        name: 'outputDir',
        description:
          'Directory to save individual conversation files (default: ./conversations)',
      },
    ],
    flags: [
      {
        name: 'createSubdirs',
        flag: '--create-subdirs',
        type: 'boolean',
        description: 'Create a conversations subdirectory in outputDir',
      },
    ],
    examples: [
      'node conversation-dumper.js                                   # Use defaults',
      'node conversation-dumper.js /path/to/conversations.json       # Custom input path',
      'node conversation-dumper.js data.json ./output                # Custom input and output',
      'node conversation-dumper.js data.json ./out --create-subdirs  # Create conversations subdirectory',
      'node conversation-dumper.js data.json ./out --overwrite       # Overwrite existing files',
    ],
  };

  console.log(CLIFramework.generateHelpText(config));
}

/**
 * Utility functions
 */
function sanitizeFilename(rawTitle) {
  return PathUtils.sanitizeName(rawTitle, { type: 'filename' });
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
  const resolvedInputPath = FileSystemHelper.isAbsolute(inputPath)
    ? inputPath
    : FileSystemHelper.resolvePath(inputPath);

  // Determine final output directory
  const finalOutputDir = createSubdirs
    ? FileSystemHelper.joinPath(outputDir, 'conversations')
    : outputDir;

  console.log(`Dumping conversations from ${resolvedInputPath} to ${finalOutputDir}`);

  try {
    // Read and validate input file
    const conversations = await FileSystemHelper.readJsonFile(resolvedInputPath);

    if (!Array.isArray(conversations)) {
      throw new Error('Expected an array of conversations in input file');
    }

    console.log(`Found ${conversations.length} conversations to process`);

    // Sort newest first
    conversations.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));

    // Create output directory if it doesn't exist
    await FileSystemHelper.ensureDirectory(finalOutputDir);

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
        const filepath = FileSystemHelper.joinPath(finalOutputDir, filename);

        // Check if file exists
        if (!overwrite) {
          if (await FileSystemHelper.fileExists(filepath)) {
            if (verbose) {
              console.log(`Skipping existing file: ${filename}`);
            }
            skipped++;
            continue;
          }
        }

        // Write conversation file
        await FileSystemHelper.writeJsonFile(filepath, conv);
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
        const fs = require('fs').promises; // Use original fs for unlink since fsHelpers doesn't have it
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
