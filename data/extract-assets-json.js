#!/usr/bin/env node

/**
 * Enhanced extract-assets-json.js for direct file processing
 *
 * Extracts assetsJson variables from chat.html files and saves them as assets.json
 *
 * Usage:
 *   node extract-assets-json.js [inputPath] [outputPath] [options]
 *   node extract-assets-json.js /path/to/chat.html /path/to/output.json
 *   node extract-assets-json.js /path/to/directory /output/dir/ --recursive
 *   node extract-assets-json.js --help
 *
 * Options:
 *   --recursive    Process all HTML files in directory recursively
 *   --overwrite    Overwrite existing assets.json files
 *   --preserve     Keep original HTML files
 *   --verbose      Enable verbose logging
 *   --help         Show this help message
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger({ module: 'extract-assets-json' });

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    inputPath: null,
    outputPath: null,
    recursive: false,
    overwrite: false,
    preserve: false,
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--recursive':
        options.recursive = true;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
      case '--preserve':
        options.preserve = true;
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
        } else if (!options.outputPath) {
          options.outputPath = arg;
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Usage: node extract-assets-json.js [inputPath] [outputPath] [options]

Arguments:
  inputPath     Path to chat.html file or directory containing HTML files
  outputPath    Path for output assets.json file or directory

Options:
  --recursive   Process all HTML files in directory recursively
  --overwrite   Overwrite existing assets.json files
  --preserve    Keep original HTML files
  --verbose     Enable verbose logging
  --help        Show this help message

Examples:
  # Process single file
  node extract-assets-json.js chat.html assets.json
  
  # Process directory
  node extract-assets-json.js ./extracted-files ./output
  
  # Process directory recursively
  node extract-assets-json.js ./data ./output --recursive
  
  # Overwrite existing files
  node extract-assets-json.js chat.html assets.json --overwrite
`);
}

/**
 * Find all HTML files in a directory
 */
async function findHtmlFiles(dirPath, recursive = false) {
  const files = [];

  async function traverse(currentPath) {
    try {
      const items = await fs.readdir(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory() && recursive) {
          await traverse(itemPath);
        } else if (
          stats.isFile() &&
          (item.endsWith('.html') || item.endsWith('.htm'))
        ) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      logger.warn(`Error accessing directory ${currentPath}: ${error.message}`);
    }
  }

  await traverse(dirPath);
  return files;
}

/**
 * Extract assetsJson from a single HTML file
 */
async function extractAssetsFromHtml(htmlPath, outputPath, options = {}) {
  const { overwrite = false, verbose = false } = options;

  try {
    // Check if output file exists and overwrite is disabled
    if (!overwrite) {
      try {
        await fs.access(outputPath);
        if (verbose) {
          logger.info(`Skipping existing file: ${outputPath}`);
        }
        return { success: false, reason: 'exists' };
      } catch {
        // File doesn't exist, proceed
      }
    }

    // Read HTML content
    const htmlContent = await fs.readFile(htmlPath, 'utf8');

    if (verbose) {
      logger.info(`Processing HTML file: ${htmlPath}`);
    }

    // Look for assetsJson variable with robust regex
    const assetJsonMatch = htmlContent.match(
      /var\s+assetsJson\s*=\s*(\{[\s\S]*?\})\s*;?/
    );

    if (assetJsonMatch && assetJsonMatch[1]) {
      const assetJsonString = assetJsonMatch[1];
      let assetJsonData;

      try {
        assetJsonData = JSON.parse(assetJsonString);
      } catch (parseError) {
        logger.error(
          `Failed to parse assetsJson in ${htmlPath}: ${parseError.message}`
        );
        if (verbose) {
          logger.debug(`Asset JSON preview: ${assetJsonString.substring(0, 200)}...`);
        }
        return { success: false, reason: 'parse_error', error: parseError.message };
      }

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Write assets.json file
      await fs.writeFile(outputPath, JSON.stringify(assetJsonData, null, 2), 'utf8');

      const assetCount = Array.isArray(assetJsonData)
        ? assetJsonData.length
        : Object.keys(assetJsonData).length;

      logger.info(`Extracted ${assetCount} assets to ${outputPath}`);

      return {
        success: true,
        assetCount,
        inputPath: htmlPath,
        outputPath,
      };
    } else {
      if (verbose) {
        logger.debug(`No assetsJson found in ${htmlPath}`);
      }
      return { success: false, reason: 'not_found' };
    }
  } catch (error) {
    logger.error(`Error processing ${htmlPath}: ${error.message}`);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Process a directory of HTML files
 */
async function processDirectory(inputDir, outputDir, options = {}) {
  const { recursive = false } = options;

  try {
    const htmlFiles = await findHtmlFiles(inputDir, recursive);

    if (htmlFiles.length === 0) {
      logger.warn(`No HTML files found in ${inputDir}`);
      return { processed: 0, skipped: 0, errors: 0 };
    }

    logger.info(`Found ${htmlFiles.length} HTML files to process`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const htmlFile of htmlFiles) {
      // Generate output path
      const relativePath = path.relative(inputDir, htmlFile);
      const outputPath = path.join(
        outputDir,
        path.dirname(relativePath),
        'assets.json'
      );

      const result = await extractAssetsFromHtml(htmlFile, outputPath, options);

      if (result.success) {
        processed++;
      } else if (result.reason === 'exists') {
        skipped++;
      } else {
        errors++;
      }
    }

    logger.info(
      `Directory processing complete: ${processed} processed, ${skipped} skipped, ${errors} errors`
    );

    return { processed, skipped, errors };
  } catch (error) {
    logger.error(`Error processing directory ${inputDir}: ${error.message}`);
    throw error;
  }
}

/**
 * Legacy function for session-based processing (backward compatibility)
 */
async function extractAssetsJson(sessionId, baseDir) {
  logger.warn(
    'Using legacy session-based function. Consider using direct file processing.'
  );

  const chatHtmlPath = path.join(
    baseDir,
    'data',
    'sessions',
    sessionId,
    'Test-Chat-Combine',
    'chat.html'
  );

  const assetsJsonPath = path.join(
    baseDir,
    'data',
    'sessions',
    sessionId,
    'assets.json'
  );

  const result = await extractAssetsFromHtml(chatHtmlPath, assetsJsonPath, {
    overwrite: true,
  });
  return result.success;
}

/**
 * Main function for CLI usage
 */
async function main() {
  try {
    const options = parseArguments();

    if (!options.inputPath) {
      logger.error('Input path is required');
      showHelp();
      process.exit(1);
    }

    // Resolve paths
    const resolvedInputPath = path.resolve(options.inputPath);
    let resolvedOutputPath = options.outputPath
      ? path.resolve(options.outputPath)
      : null;

    // Check if input is file or directory
    const stats = await fs.stat(resolvedInputPath);

    if (stats.isFile()) {
      // Process single file
      if (!resolvedOutputPath) {
        // Default output to same directory with assets.json name
        resolvedOutputPath = path.join(path.dirname(resolvedInputPath), 'assets.json');
      }

      if (options.verbose) {
        logger.info(
          `Processing single file: ${resolvedInputPath} -> ${resolvedOutputPath}`
        );
      }

      const result = await extractAssetsFromHtml(
        resolvedInputPath,
        resolvedOutputPath,
        options
      );

      if (result.success) {
        logger.info('Extraction completed successfully');
        process.exit(0);
      } else {
        logger.error('Extraction failed');
        process.exit(1);
      }
    } else if (stats.isDirectory()) {
      // Process directory
      if (!resolvedOutputPath) {
        // Default output to subdirectory
        resolvedOutputPath = path.join(resolvedInputPath, 'extracted-assets');
      }

      if (options.verbose) {
        logger.info(
          `Processing directory: ${resolvedInputPath} -> ${resolvedOutputPath}`
        );
      }

      const result = await processDirectory(
        resolvedInputPath,
        resolvedOutputPath,
        options
      );

      if (result.errors > 0) {
        logger.warn(`Processing completed with ${result.errors} errors`);
        process.exit(1);
      } else {
        logger.info('Directory processing completed successfully');
        process.exit(0);
      }
    } else {
      logger.error('Input path is not a file or directory');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  extractAssetsFromHtml,
  processDirectory,
  findHtmlFiles,
  extractAssetsJson, // Legacy function
  parseArguments,
};
