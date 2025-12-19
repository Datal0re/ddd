#!/usr/bin/env node

/**
 * Unified Export Processor for ChatGPT Data Exports
 *
 * This script combines ZIP extraction, conversation migration, and asset extraction
 * into a single streamlined process for the new direct file-based architecture.
 *
 * Usage:
 *   node process-export.js [zipPath] [exportName] [baseDir] [options]
 *   node process-export.js ./chatgpt-export.zip "my-chat-history" ./ --verbose
 *   node process-export.js --help
 */

const fs = require('fs').promises;
const path = require('path');
const {
  ensureDir,
  removeDirectories,
  validateAndExtractZip,
} = require('../utils/fileUtils');
const { dumpConversations } = require('./dump.js');
const { extractAssetsFromHtml } = require('./extract-assets-json.js');

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    zipPath: null,
    exportName: null,
    baseDir: null,
    tempDir: null,
    isBuffer: false,
    preserveOriginal: false,
    overwrite: false,
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
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
        if (!options.zipPath) {
          options.zipPath = arg;
        } else if (!options.exportName) {
          options.exportName = arg;
        } else if (!options.baseDir) {
          options.baseDir = arg;
        }
        break;
    }
  }

  // Set defaults
  options.baseDir = options.baseDir || path.resolve(__dirname, '..');

  return options;
}

function showHelp() {
  console.log(`
Usage: node process-export.js [zipPath] [exportName] [baseDir] [options]

Arguments:
  zipPath      Path to ChatGPT export ZIP file (required)
  exportName   Name for the export directory (required)
  baseDir      Base directory of the application (default: parent directory)

Options:
  --preserve   Keep original ZIP file after processing
  --overwrite  Overwrite existing export directory
  --verbose    Enable verbose logging
  --help       Show this help message

Examples:
  # Basic usage
  node process-export.js ./chatgpt-export.zip "my-chat-history"
  
  # With custom base directory
  node process-export.js ./export.zip "work-chat" /path/to/app
  
  # Overwrite existing export
  node process-export.js ./export.zip "my-chat" --overwrite
  
  # Verbose output
  node process-export.js ./export.zip "my-chat" --verbose
`);
}

/**
 * Generate a temporary directory name
 */
function generateTempDir(baseDir) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return path.join(baseDir, 'data', 'temp', `export_${timestamp}_${random}`);
}

/**
 * Move media files from temp to export directory
 */
async function moveMediaFiles(tempDir, exportMediaDir, options = {}) {
  const { verbose = false } = options;

  try {
    await ensureDir(exportMediaDir);

    const tempMediaDir = path.join(tempDir, 'Test-Chat-Combine');

    // Check if temp media directory exists
    try {
      await fs.access(tempMediaDir);
    } catch {
      if (verbose) {
        console.debug('No media directory found in temp files');
      }
      return { moved: 0, errors: 0 };
    }

    let moved = 0;
    let errors = 0;

    // Get all files and directories in temp media
    const items = await fs.readdir(tempMediaDir);

    for (const item of items) {
      // Skip chat.html and conversations.json (these are handled separately)
      if (item === 'chat.html' || item === 'conversations.json') {
        continue;
      }

      const srcPath = path.join(tempMediaDir, item);
      const destPath = path.join(exportMediaDir, item);

      try {
        const stats = await fs.stat(srcPath);

        if (stats.isDirectory()) {
          // Copy directory recursively
          await copyDirectory(srcPath, destPath);
        } else {
          // Copy file
          await fs.copyFile(srcPath, destPath);
        }

        moved++;

        if (verbose) {
          console.debug(`Moved media: ${item}`);
        }
      } catch (error) {
        console.error(`Error moving media item ${item}: ${error.message}`);
        errors++;
      }
    }

    if (verbose) {
      console.log(`Media files moved: ${moved}, errors: ${errors}`);
    }

    return { moved, errors };
  } catch (error) {
    console.error(`Error moving media files: ${error.message}`);
    throw error;
  }
}

/**
 * Copy directory recursively
 */
async function copyDirectory(src, dest) {
  await ensureDir(dest);

  const items = await fs.readdir(src);

  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stats = await fs.stat(srcPath);

    if (stats.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Copy essential files to media directory
 */
async function copyEssentialFiles(tempDir, exportMediaDir, options = {}) {
  const { verbose = false } = options;

  const essentialFiles = ['chat.html', 'conversations.json'];
  let copied = 0;
  let errors = 0;

  for (const file of essentialFiles) {
    const srcPath = path.join(tempDir, 'Test-Chat-Combine', file);
    const destPath = path.join(exportMediaDir, file);

    try {
      await fs.access(srcPath);
      await fs.copyFile(srcPath, destPath);
      copied++;

      if (verbose) {
        console.debug(`Copied essential file: ${file}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error copying essential file ${file}: ${error.message}`);
        errors++;
      }
    }
  }

  if (verbose) {
    console.log(`Essential files copied: ${copied}, errors: ${errors}`);
  }

  return { copied, errors };
}

/**
 * Main export processing function
 */
async function processExport(
  zipData,
  exportName,
  baseDir,
  isBuffer = false,
  onProgress = null,
  options = {}
) {
  const { overwrite = false, verbose = false } = options;

  // Validate inputs
  if (!zipData || !exportName || !baseDir) {
    throw new Error('zipData, exportName, and baseDir are required');
  }

  // Sanitize export name
  const sanitizedExportName = exportName
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const exportDir = path.join(baseDir, 'data', 'exports', sanitizedExportName);
  const tempDir = generateTempDir(baseDir);

  // Check if export already exists
  if (!overwrite) {
    try {
      await fs.access(exportDir);
      throw new Error(
        `Export "${sanitizedExportName}" already exists. Use --overwrite to replace it.`
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  try {
    // Progress callback wrapper
    const progressCallback = (stage, progress, message) => {
      if (onProgress) {
        onProgress({ stage, progress, message });
      }
      if (verbose) {
        console.log(`${stage}: ${progress}% - ${message}`);
      }
    };

    // Clean up existing export directory if overwriting
    if (overwrite) {
      try {
        await removeDirectories(exportDir);
        console.log(`Removed existing export directory: ${sanitizedExportName}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to remove existing directory: ${error.message}`);
        }
      }
    }

    progressCallback('extracting', 5, 'Setting up directories...');

    // Ensure directories exist
    await ensureDir(tempDir);
    await ensureDir(exportDir);

    progressCallback('extracting', 10, 'Extracting ZIP file...');

    // Extract ZIP file
    await validateAndExtractZip(zipData, tempDir, isBuffer);

    progressCallback('migrating', 40, 'Migrating conversations...');

    // Dump conversations
    const conversationsInput = path.join(
      tempDir,
      'Test-Chat-Combine',
      'conversations.json'
    );
    const conversationsOutput = path.join(exportDir, 'conversations');

    const migrationResult = await dumpConversations(
      conversationsInput,
      conversationsOutput,
      {
        createSubdirs: false,
        preserveOriginal: true,
        overwrite: true,
        verbose,
      }
    );

    if (migrationResult.errors > 0) {
      console.warn(`Migration completed with ${migrationResult.errors} errors`);
    }

    progressCallback('extracting-assets', 70, 'Extracting media assets...');

    // Extract assets
    const chatHtmlPath = path.join(tempDir, 'Test-Chat-Combine', 'chat.html');
    const assetsJsonPath = path.join(exportDir, 'assets.json');

    const assetResult = await extractAssetsFromHtml(chatHtmlPath, assetsJsonPath, {
      overwrite: true,
      verbose,
    });

    if (assetResult.success) {
      console.log(`Extracted ${assetResult.assetCount} assets`);
    } else {
      console.warn('No assets found or asset extraction failed');
    }

    progressCallback('organizing', 85, 'Organizing media files...');

    // Create media directory and move files
    const exportMediaDir = path.join(exportDir, 'media');

    const mediaResult = await moveMediaFiles(tempDir, exportMediaDir, { verbose });
    const essentialResult = await copyEssentialFiles(tempDir, exportMediaDir, {
      verbose,
    });

    progressCallback('validating', 95, 'Validating export...');

    // Validate export structure
    const validation = await validateExport(exportDir);

    if (!validation.isValid) {
      throw new Error(`Export validation failed: ${validation.errors.join(', ')}`);
    }

    progressCallback('completed', 100, 'Export processing complete!');

    console.log(`Export "${sanitizedExportName}" created successfully`);
    console.log(
      `Conversations: ${migrationResult.processed}, Assets: ${assetResult.assetCount || 0}`
    );

    return {
      success: true,
      exportName: sanitizedExportName,
      exportDir,
      stats: {
        conversations: migrationResult.processed,
        assets: assetResult.assetCount || 0,
        mediaFiles: mediaResult.moved,
        essentialFiles: essentialResult.copied,
      },
    };
  } catch (error) {
    console.error(`Export processing failed: ${error.message}`);
    throw error;
  } finally {
    // Always clean up temporary directory
    try {
      await removeDirectories(tempDir);
      if (verbose) {
        console.debug('Cleaned up temporary directory');
      }
    } catch (cleanupError) {
      console.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
    }
  }
}

/**
 * Validate export structure
 */
async function validateExport(exportDir) {
  const errors = [];
  const warnings = [];

  try {
    // Check required directories
    const requiredDirs = ['conversations', 'media'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(exportDir, dir);
      try {
        await fs.access(dirPath);
      } catch {
        errors.push(`Missing required directory: ${dir}`);
      }
    }

    // Check conversation files
    const conversationsDir = path.join(exportDir, 'conversations');
    try {
      const files = await fs.readdir(conversationsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        errors.push('No conversation files found');
      }
    } catch {
      // Already caught above
    }

    // Check assets.json
    const assetsPath = path.join(exportDir, 'assets.json');
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

    if (!options.zipPath || !options.exportName) {
      console.error('zipPath and exportName are required');
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

    // Process export with progress callback
    await processExport(
      zipData,
      options.exportName,
      options.baseDir,
      false, // isBuffer = false (we're reading from file)
      progress => {
        console.log(`[${progress.stage}] ${progress.progress}% - ${progress.message}`);
      },
      {
        preserveOriginal: options.preserveOriginal,
        overwrite: options.overwrite,
        verbose: options.verbose,
      }
    );

    console.log('Export completed successfully!');
  } catch (error) {
    console.error('Export processing failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  processExport,
  validateExport,
  generateTempDir,
  moveMediaFiles,
  copyEssentialFiles,
};
