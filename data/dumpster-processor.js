#!/usr/bin/env node

/**
 * Unified Dumpster Processor for ChatGPT Data Dumpsters
 *
 * This script combines ZIP extraction, conversation dumping, and asset extraction
 * into a single streamlined process for the new direct file-based architecture.
 *
 * Usage:
 *   node dumpster-processor.js [zipPath] [dumpsterName] [baseDir] [options]
 *   node dumpster-processor.js ./chatgpt-export.zip "my-chat-history" ./ --verbose
 *   node dumpster-processor.js --help
 */

const { CLIFramework } = require('../utils/cliFramework.js');
const FileSystemHelper = require('../utils/FileSystemHelper.js');
const PathUtils = require('../utils/PathUtils.js');
const ZipProcessor = require('../utils/ZipProcessor.js');
const AssetUtils = require('../utils/AssetUtils.js');
const { createProgressTracker } = require('../utils/ProgressTracker.js');
const fs = require('fs').promises; // Keep for operations not in FileSystemHelper
const path = require('path');
const { dumpChats } = require('./chat-dumper.js');
const { extractAssetsFromHtml } = require('./extract-assets.js');

/**
 * Parse command line arguments
 */
function parseArguments() {
  const config = {
    defaults: {
      tempDir: null,
      isBuffer: false,
      preserveOriginal: false,
      overwrite: false,
      verbose: false,
      baseDir: FileSystemHelper.resolvePath(__dirname, '..'),
    },
    positional: ['zipPath', 'dumpsterName', 'baseDir'],
  };

  const options = CLIFramework.parseArguments(config);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  return options;
}

function showHelp() {
  const config = {
    usage: 'node dumpster-processor.js [zipPath] [dumpsterName] [baseDir] [options]',
    positional: [
      { name: 'zipPath', description: 'Path to ChatGPT export ZIP file (required)' },
      {
        name: 'dumpsterName',
        description: 'Name for the dumpster directory (required)',
      },
      {
        name: 'baseDir',
        description: 'Base directory of the application (default: parent directory)',
      },
    ],
    examples: [
      '# Basic usage',
      'node dumpster-processor.js ./chatgpt-export.zip "my-chat-history"',
      '',
      '# With custom base directory',
      'node dumpster-processor.js ./export.zip "work-chat" /path/to/app',
      '',
      '# Overwrite existing dumpster',
      'node dumpster-processor.js ./export.zip "my-chat" --overwrite',
      '',
      '# Verbose output',
      'node dumpster-processor.js ./export.zip "my-chat" --verbose',
    ],
  };

  console.log(CLIFramework.generateHelpText(config));
}

/**
 * Creates a temporary directory within the project's data/temp directory
 *
 * Use this for long-lived temporary files during dumpster processing that need to
 * persist within the project structure. Uses timestamp + random for human-readable names.
 * Creates directories under {baseDir}/data/temp/ for easier debugging and manual cleanup.
 *
 * @param {string} baseDir - Base directory of the application
 * @returns {string} Path to project temp directory
 */
function createProjectTempDir(baseDir) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return FileSystemHelper.joinPath(
    baseDir,
    'data',
    'temp',
    `dumpster_${timestamp}_${random}`
  );
}

/**
 * Main dumpster processing function
 */
async function processDumpster(
  zipData,
  dumpsterName,
  baseDir,
  isBuffer = false,
  onProgress = null,
  options = {}
) {
  const { overwrite = false, verbose = false, zipPath = null } = options;

  // Validate inputs
  if (!zipData || !dumpsterName || !baseDir) {
    throw new Error('zipData, dumpsterName, and baseDir are required');
  }

  // Create unified progress tracker
  const baseTracker = createProgressTracker(onProgress, verbose);
  const progress = {
    initializing: message => baseTracker.update('initializing', 0, message),
    extracting: (percent, message) =>
      baseTracker.update('extracting', percent, message),
    dumping: (percent, message) => baseTracker.update('dumping', percent, message),
    extractingAssets: (percent, message) =>
      baseTracker.update('extractingAssets', percent, message),
    organizing: (percent, message) =>
      baseTracker.update('organizing', percent, message),
    validating: (percent, message) =>
      baseTracker.update('validating', percent, message),
    completed: message => baseTracker.update('completed', 100, message),
  };
  progress.initializing('Initializing dumpster processing...');

  // Sanitize dumpster name
  const sanitizedDumpsterName = PathUtils.sanitizeName(dumpsterName, {
    type: 'dumpster',
  });

  // Create base directories
  await FileSystemHelper.ensureDirectory(baseDir);
  const dumpsterDir = path.join(baseDir, 'data', 'dumpsters', sanitizedDumpsterName);
  const tempDir = createProjectTempDir(baseDir);

  // Check if dumpster already exists
  if (!overwrite) {
    try {
      await fs.access(dumpsterDir);
      throw new Error(
        `Dumpster "${sanitizedDumpsterName}" already exists. Use --overwrite to replace it.`
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  try {
    // Progress tracker already created above, no need for wrapper

    // Clean up existing dumpster directory if overwriting
    if (overwrite) {
      try {
        await PathUtils.removeDirectories(dumpsterDir);
        console.log(`Removed existing dumpster directory: ${sanitizedDumpsterName}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to remove existing directory: ${error.message}`);
        }
      }
    }

    progress.extracting(5, 'Setting up directories...');

    // Ensure directories exist
    await FileSystemHelper.ensureDirectory(tempDir);
    await FileSystemHelper.ensureDirectory(dumpsterDir);

    progress.extracting(10, 'Extracting ZIP file...');

    // Extract ZIP file
    await ZipProcessor.validateAndExtractZip(zipData, tempDir, isBuffer);

    progress.dumping(30, 'Detecting directory structure...');

    // Detect directory structure dynamically
    if (!zipPath) {
      throw new Error('zipPath is required for directory detection');
    }

    const dirStructure = await AssetUtils.getDirectoryStructure(zipPath, tempDir);

    if (!dirStructure.success) {
      throw new Error(`Failed to detect directory structure: ${dirStructure.error}`);
    }

    if (verbose) {
      console.log(`Detected directory structure using ${dirStructure.method} approach`);
      console.log(`Directory: ${dirStructure.directoryName}`);
    }

    progress.dumping(40, 'Dumping chats...');

    // Dump conversations using detected paths (previously hardcoded)
    const chatsInput = dirStructure.chatsPath;
    const chatsOutput = path.join(dumpsterDir, 'chats');

    const dumpResult = await dumpChats(chatsInput, chatsOutput, {
      createSubdirs: false,
      preserveOriginal: true,
      overwrite: true,
      verbose,
    });

    if (dumpResult.errors > 0) {
      console.warn(`Dump completed with ${dumpResult.errors} errors`);
    }

    progress.extractingAssets(70, 'Extracting media assets...');

    // Extract assets using detected path (previously hardcoded)
    const chatHtmlPath = dirStructure.chatHtmlPath;
    const assetsJsonPath = path.join(dumpsterDir, 'assets.json');

    const assetResult = await extractAssetsFromHtml(chatHtmlPath, assetsJsonPath, {
      overwrite: true,
      verbose,
    });

    if (assetResult.success) {
      console.log(`Extracted ${assetResult.assetCount} assets`);
    } else {
      console.warn('No assets found or asset extraction failed');
    }

    progress.organizing(85, 'Organizing media files...');

    // Create media directory and move files
    const dumpsterMediaDir = path.join(dumpsterDir, 'media');

    const mediaResult = await AssetUtils.moveMediaFiles(dumpsterMediaDir, {
      verbose,
      tempMediaDir: dirStructure.mediaDir,
    });

    progress.validating(95, 'Validating dumpster...');

    // Validate dumpster structure
    const validation = await validateDumpster(dumpsterDir);

    if (!validation.isValid) {
      throw new Error(`Dumpster validation failed: ${validation.errors.join(', ')}`);
    }

    progress.completed('Dumpster processing complete!');

    console.log(`Dumpster "${sanitizedDumpsterName}" created successfully`);
    console.log(
      `Conversations: ${dumpResult.processed}, Assets: ${assetResult.assetCount || 0}`
    );

    return {
      success: true,
      dumpsterName: sanitizedDumpsterName,
      dumpsterDir,
      stats: {
        chats: dumpResult.processed,
        assets: assetResult.assetCount || 0,
        mediaFiles: mediaResult.moved,
      },
    };
  } catch (error) {
    console.error(`Dumpster processing failed: ${error.message}`);
    throw error;
  } finally {
    // Always clean up temporary directory
    try {
      await PathUtils.removeDirectories(tempDir);
      if (verbose) {
        console.debug('Cleaned up temporary directory');
      }
    } catch (cleanupError) {
      console.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
    }
  }
}

/**
 * Validate dumpster structure
 */
async function validateDumpster(dumpsterDir) {
  const errors = [];
  const warnings = [];

  try {
    // Check required directories
    const requiredDirs = ['chats', 'media'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(dumpsterDir, dir);
      try {
        await fs.access(dirPath);
      } catch {
        errors.push(`Missing required directory: ${dir}`);
      }
    }

    // Check chat files
    const chatsDir = path.join(dumpsterDir, 'chats');
    try {
      const files = await fs.readdir(chatsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        errors.push('No chat files found');
      }
    } catch {
      // Already caught above
    }

    // Check assets.json
    const assetsPath = path.join(dumpsterDir, 'assets.json');
    try {
      await fs.access(assetsPath);
      const content = await fs.readFile(assetsPath, 'utf8');
      JSON.parse(content); // Validate JSON
    } catch {
      warnings.push('assets.json missing or invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings,
    };
  }
}

/**
 * Main function for CLI usage
 */
async function main() {
  try {
    const options = parseArguments();

    if (!options.zipPath || !options.dumpsterName) {
      console.error('zipPath and dumpsterName are required');
      showHelp();
      process.exit(1);
    }

    // Check if ZIP file exists
    try {
      await fs.access(options.zipPath);
    } catch {
      console.error(`ZIP file not found: ${options.zipPath}`);
      process.exit(1);
    }

    // Read ZIP file
    const zipData = await fs.readFile(options.zipPath);

    // Process dumpster with progress callback
    await processDumpster(
      zipData,
      options.dumpsterName,
      options.baseDir,
      false, // isBuffer = false (we're reading from file)
      progress => {
        console.log(`[${progress.stage}] ${progress.progress}% - ${progress.message}`);
      },
      {
        preserveOriginal: options.preserveOriginal,
        overwrite: options.overwrite,
        verbose: options.verbose,
        zipPath: options.zipPath,
      }
    );

    console.log('Dumpster completed successfully!');
  } catch (error) {
    console.error('Dumpster processing failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  processDumpster,
  validateDumpster,
  createProjectTempDir,
};
