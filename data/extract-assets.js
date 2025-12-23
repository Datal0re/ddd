/*
 * extract-assets.js - Asset extraction utility
 * Extracts assetsJson variables from chat.html files and saves them as assets.json
 */

const FileSystemHelper = require('../utils/FileSystemHelper');
const fs = require('fs').promises; // Keep for operations not in FileSystemHelper
const path = require('path');

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

module.exports = {
  extractAssetsFromHtml,
  processDirectory,
  findHtmlFiles,
};
