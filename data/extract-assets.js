#!/usr/bin/env node

/**
 * Enhanced extract-assets.js for direct file processing
 *
 * Extracts assetsJson variables from chat.html files and saves them as assets.json
 *
 * Usage:
 *   node extract-assets.js [inputPath] [outputPath] [options]
 *   node extract-assets.js /path/to/chat.html /path/to/output.json
 *   node extract-assets.js /path/to/directory /output/dir/ --recursive
 *   node extract-assets.js --help
 *
 * Options:
 *   --recursive    Process all HTML files in directory recursively
 *   --overwrite    Overwrite existing assets.json files
 *   --preserve     Keep original HTML files
 *   --verbose      Enable verbose logging
 *   --help         Show this help message
 */

const { CLIFramework } = require('../utils/cliFramework');
const FileSystemHelper = require('../utils/FileSystemHelper');
const fs = require('fs').promises; // Keep for operations not in fsHelpers
const path = require('path');

/**
 * Parse command line arguments
 */
function parseArguments() {
  const config = {
    defaults: {
      recursive: false,
      overwrite: false,
      preserve: false,
      verbose: false,
    },
    flags: [
      {
        name: 'recursive',
        flag: '--recursive',
        type: 'boolean',
        description: 'Process all HTML files in directory recursively',
      },
    ],
    positional: ['inputPath', 'outputPath'],
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
    usage: 'node extract-assets.js [inputPath] [outputPath] [options]',
    positional: [
      {
        name: 'inputPath',
        description: 'Path to chat.html file or directory containing HTML files',
      },
      {
        name: 'outputPath',
        description: 'Path for output assets.json file or directory',
      },
    ],
    flags: [
      {
        name: 'recursive',
        flag: '--recursive',
        type: 'boolean',
        description: 'Process all HTML files in directory recursively',
      },
    ],
    examples: [
      '# Process single file',
      'node extract-assets.js chat.html assets.json',
      '',
      '# Process directory',
      'node extract-assets.js ./extracted-files ./output',
      '',
      '# Process directory recursively',
      'node extract-assets.js ./data ./output --recursive',
      '',
      '# Overwrite existing files',
      'node extract-assets.js chat.html assets.json --overwrite',
    ],
  };

  console.log(CLIFramework.generateHelpText(config));
}

/**
 * Find all HTML files in a directory
 */
async function findHtmlFiles(dirPath, recursive = false) {
  const PathUtils = require('../utils/PathUtils');

  try {
    const htmlPattern = '\\.(html?|htm)$';
    return await PathUtils.findFilesByPattern(dirPath, htmlPattern, recursive);
  } catch (error) {
    console.warn(`Error accessing directory ${dirPath}: ${error.message}`);
    return [];
  }
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
          console.log(`Skipping existing file: ${outputPath}`);
        }
        return { success: false, reason: 'exists' };
      } catch {
        // File doesn't exist, proceed
      }
    }

    // Read HTML content
    const htmlContent = await fs.readFile(htmlPath, 'utf8');

    if (verbose) {
      console.log(`Processing HTML file: ${htmlPath}`);
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
        console.error(
          `Failed to parse assetsJson in ${htmlPath}: ${parseError.message}`
        );
        if (verbose) {
          console.debug(`Asset JSON preview: ${assetJsonString.substring(0, 200)}...`);
        }
        return { success: false, reason: 'parse_error', error: parseError.message };
      }

      // Ensure output directory exists
      await FileSystemHelper.ensureDirectory(path.dirname(outputPath));

      // Write assets.json file
      await FileSystemHelper.writeJsonFile(outputPath, assetJsonData);

      const assetCount = Array.isArray(assetJsonData)
        ? assetJsonData.length
        : Object.keys(assetJsonData).length;

      console.log(`Extracted ${assetCount} assets to ${outputPath}`);

      return {
        success: true,
        assetCount,
        inputPath: htmlPath,
        outputPath,
      };
    } else {
      if (verbose) {
        console.debug(`No assetsJson found in ${htmlPath}`);
      }
      return { success: false, reason: 'not_found' };
    }
  } catch (error) {
    console.error(`Error processing ${htmlPath}: ${error.message}`);
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
      console.warn(`No HTML files found in ${inputDir}`);
      return { processed: 0, skipped: 0, errors: 0 };
    }

    console.log(`Found ${htmlFiles.length} HTML files to process`);

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

    console.log(
      `Directory processing complete: ${processed} processed, ${skipped} skipped, ${errors} errors`
    );

    return { processed, skipped, errors };
  } catch (error) {
    console.error(`Error processing directory ${inputDir}: ${error.message}`);
    throw error;
  }
}

/**
 * Main function for CLI usage
 */
async function main() {
  try {
    const options = parseArguments();

    if (!options.inputPath) {
      console.error('Input path is required');
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
        console.log(
          `Processing single file: ${resolvedInputPath} -> ${resolvedOutputPath}`
        );
      }

      const result = await extractAssetsFromHtml(
        resolvedInputPath,
        resolvedOutputPath,
        options
      );

      if (result.success) {
        console.log('Extraction completed successfully');
        process.exit(0);
      } else {
        console.error('Extraction failed');
        process.exit(1);
      }
    } else if (stats.isDirectory()) {
      // Process directory
      if (!resolvedOutputPath) {
        // Default output to subdirectory
        resolvedOutputPath = path.join(resolvedInputPath, 'extracted-assets');
      }

      if (options.verbose) {
        console.log(
          `Processing directory: ${resolvedInputPath} -> ${resolvedOutputPath}`
        );
      }

      const result = await processDirectory(
        resolvedInputPath,
        resolvedOutputPath,
        options
      );

      if (result.errors > 0) {
        console.warn(`Processing completed with ${result.errors} errors`);
        process.exit(1);
      } else {
        console.log('Directory processing completed successfully');
        process.exit(0);
      }
    } else {
      console.error('Input path is not a file or directory');
      process.exit(1);
    }
  } catch (error) {
    console.error('Script failed:', error);
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
  parseArguments,
};
