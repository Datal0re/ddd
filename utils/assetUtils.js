/*
 * Asset-related utilities
 * Handles media file detection, file organization, and asset processing
 */

const fs = require('fs').promises;
const path = require('path');
const { MEDIA_PATTERNS } = require('../config/constants');
const FileSystemHelper = require('./fsHelpers');
const PathUtils = require('./pathUtils');

/**
 * Asset utilities class for handling media files and asset organization
 */
class AssetUtils {
  /**
   * Determines if file is a media file
   * @param {string} filePath - File path
   * @returns {boolean}
   */
  static isMediaFile(filePath) {
    return MEDIA_PATTERNS.some(pattern => pattern.test(filePath));
  }

  /**
   * Moves files from temp directory to final locations
   * @param {string} tempDir - Temporary directory
   * @param {string} exportDir - Final export directory
   * @param {string} mediaDir - Media directory
   * @param {Array} files - Extracted files list
   * @returns {Promise<string>} Path to conversations.json or null if not found
   */
  static async moveFilesToFinalLocations(tempDir, exportDir, mediaDir, files) {
    // Find conversations.json and detect top-level folder structure
    let conversationsPath = null;
    const topLevelDirs = new Set();

    for (const file of files) {
      const parts = file.path.split(path.sep);
      if (parts.length > 1) {
        topLevelDirs.add(parts[0]);
      }
    }

    console.debug('Top-level directories found:', [...topLevelDirs]);

    const hasSingleTopLevel = topLevelDirs.size === 1;
    const topLevelFolder = hasSingleTopLevel ? [...topLevelDirs][0] : '';

    console.debug('Has single top level:', hasSingleTopLevel);
    console.debug('Top level folder:', topLevelFolder);

    // Process each file
    for (const file of files) {
      // Validate file path to prevent path traversal
      if (!PathUtils.validatePath(file.path)) {
        console.warn(`Skipping file with dangerous path: ${file.path}`);
        continue;
      }

      const tempPath = path.join(tempDir, file.path);

      // Find conversations.json
      if (file.path.endsWith('conversations.json')) {
        const candidatePath = path.join(tempPath);
        const stats = await fs.stat(candidatePath);
        if (stats.isFile()) {
          const sample = await fs.readFile(candidatePath, { encoding: 'utf8' });
          if (sample && !sample.includes('\u0000')) {
            const finalPath = path.join(exportDir, 'conversations.json');
            await fs.rename(candidatePath, finalPath);
            conversationsPath = finalPath;
          }
        }
      }

      // Copy media assets
      else if (this.isMediaFile(file.path) && !file.path.endsWith('/')) {
        const src = tempPath;
        const relativePath =
          hasSingleTopLevel && file.path.startsWith(topLevelFolder + path.sep)
            ? file.path.slice((topLevelFolder + path.sep).length)
            : file.path;

        // Validate relative path as well
        if (!PathUtils.validatePath(relativePath)) {
          console.warn(
            `Skipping media file with dangerous relative path: ${relativePath}`
          );
          continue;
        }

        const destPath = path.join(mediaDir, relativePath);
        await FileSystemHelper.ensureDirectory(path.dirname(destPath));
        await fs.copyFile(src, destPath);
        console.debug(`Copied media file: ${file.path} -> ${relativePath}`);
      }

      // Move other files to export directory
      else if (!file.path.endsWith('/')) {
        const src = tempPath;
        const relativePath =
          hasSingleTopLevel && file.path.startsWith(topLevelFolder + path.sep)
            ? file.path.slice((topLevelFolder + path.sep).length)
            : file.path;

        // Validate relative path as well
        if (!PathUtils.validatePath(relativePath)) {
          console.warn(`Skipping file with dangerous relative path: ${relativePath}`);
          continue;
        }

        const destPath = path.join(exportDir, relativePath);
        await FileSystemHelper.ensureDirectory(path.dirname(destPath));
        await fs.rename(src, destPath);
      }
    }

    // Clean up nested directory if present
    if (hasSingleTopLevel && topLevelFolder) {
      const nestedDir = path.join(tempDir, topLevelFolder);
      try {
        await fs.rmdir(nestedDir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to delete nested directory ${nestedDir}:`, error.message);
      }
    }

    return conversationsPath;
  }

  /**
   * Moves media files from temp to dumpster directory
   * @param {string} tempDir - Temporary directory path
   * @param {string} dumpsterMediaDir - Dumpster media directory path
   * @param {Object} options - Options object
   * @param {boolean} options.verbose - Enable verbose logging
   * @returns {Promise<Object>} Move operation result with counts
   */
  static async moveMediaFiles(tempDir, dumpsterMediaDir, options = {}) {
    const { verbose = false } = options;

    try {
      await FileSystemHelper.ensureDirectory(dumpsterMediaDir);

      const tempMediaDir = path.join(tempDir, 'Test-Chat-Combine');

      // Check if temp media directory exists
      if (!(await FileSystemHelper.fileExists(tempMediaDir))) {
        if (verbose) {
          console.debug('No media directory found in temp files');
        }
        return { moved: 0, errors: 0 };
      }

      let moved = 0;
      let errors = 0;

      // Get all files and directories in temp media
      const items = await FileSystemHelper.listDirectory(tempMediaDir);

      for (const item of items) {
        // Skip chat.html and conversations.json (these are handled separately)
        if (item === 'chat.html' || item === 'conversations.json') {
          continue;
        }

        const srcPath = path.join(tempMediaDir, item);
        const destPath = path.join(dumpsterMediaDir, item);

        try {
          const stats = await FileSystemHelper.getStats(srcPath);

          if (stats.isDirectory()) {
            // Copy directory recursively
            await PathUtils.copyDirectory(srcPath, destPath);
          } else {
            // Copy file
            await fs.copyFile(srcPath, destPath);
          }

          moved++;

          if (verbose) {
            console.debug(`Moved media: ${item}`);
          }
        } catch (err) {
          console.error(`Error moving media file ${item}:`, err.message);
          errors++;
        }
      }

      return { moved, errors };
    } catch (err) {
      console.error('Error moving media files:', err.message);
      return { moved: 0, errors: 1 };
    }
  }

  /**
   * Processes HTML file to extract asset information
   * @param {string} htmlFilePath - Path to HTML file
   * @returns {Promise<Object>} Extracted asset information
   */
  static async extractAssetInfo(htmlFilePath) {
    const fs = require('fs').promises;
    const content = await fs.readFile(htmlFilePath, 'utf8');

    // Look for assetsJson variable in the HTML
    const assetJsonMatch = content.match(/const\s+assetsJson\s*=\s*(\{[\s\S]*?\});/);

    if (!assetJsonMatch) {
      throw new Error('No assetsJson found in HTML file');
    }

    try {
      // Parse JSON string safely instead of using eval
      const assetJsonString = assetJsonMatch[1];
      const assetsJson = JSON.parse(assetJsonString);
      return assetsJson;
    } catch (error) {
      throw new Error(`Failed to parse assetsJson: ${error.message}`);
    }
  }

  /**
   * Validates asset structure and content
   * @param {Object} assets - Asset object to validate
   * @returns {Promise<Object>} Validation result
   */
  static async validateAssetStructure(assets) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!assets || typeof assets !== 'object') {
      result.isValid = false;
      result.errors.push('Assets must be a valid object');
      return result;
    }

    // Check for common asset properties
    for (const [key, asset] of Object.entries(assets)) {
      if (!asset || typeof asset !== 'object') {
        result.warnings.push(`Asset ${key} is not a valid object`);
        continue;
      }

      // Check for required properties
      if (!asset.asset_pointer) {
        result.warnings.push(`Asset ${key} missing asset_pointer`);
      }

      // Check for media files
      if (this.isMediaFile(key)) {
        if (!(await FileSystemHelper.fileExists(asset.asset_pointer))) {
          result.warnings.push(
            `Media file for asset ${key} not found: ${asset.asset_pointer}`
          );
        }
      }
    }

    return result;
  }

  /**
   * Gets asset statistics from an assets object
   * @param {Object} assets - Assets object
   * @returns {Object} Asset statistics
   */
  static getAssetStats(assets) {
    const stats = {
      total: 0,
      byType: {
        image: 0,
        audio: 0,
        video: 0,
        file: 0,
        other: 0,
      },
      byFormat: {},
      totalSize: 0,
    };

    if (!assets || typeof assets !== 'object') {
      return stats;
    }

    for (const [key] of Object.entries(assets)) {
      stats.total++;

      // Categorize by type
      const extension = path.extname(key).toLowerCase();
      const filename = path.basename(key).toLowerCase();

      if (this.isMediaFile(key)) {
        if (extension.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          stats.byType.image++;
        } else if (extension.match(/\.(wav|mp3|m4a|ogg)$/)) {
          stats.byType.audio++;
        } else if (extension.match(/\.(mp4|webm|mov)$/)) {
          stats.byType.video++;
        } else if (filename.startsWith('file-')) {
          stats.byType.file++;
        } else {
          stats.byType.other++;
        }

        // Track format
        const format = extension || 'unknown';
        stats.byFormat[format] = (stats.byFormat[format] || 0) + 1;
      } else {
        stats.byType.other++;
      }
    }

    return stats;
  }
}

module.exports = AssetUtils;
