/*
 * Asset-related utilities
 * Handles media file detection, file organization, and asset processing
 */

const fs = require('fs').promises;
const path = require('path');
const { MEDIA_PATTERNS } = require('../config/constants');
const FileSystemHelper = require('./FileSystemHelper');
const PathUtils = require('./PathUtils');

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
   * Consolidated function to move media files from temp to dumpster directory
   *
   * This is the primary implementation for media file movement. Handles directories
   * and files, preserves directory structure, and provides detailed operation feedback.
   * Previously duplicated in dumpster-processor.js - now consolidated here as single source.
   *
   * @param {string} dumpsterMediaDir - Destination dumpster media directory path
   * @param {Object} options - Configuration options
   * @param {boolean} options.verbose - Enable verbose logging for debug output
   * @param {string} options.tempMediaDir - Source media directory (overrides detection)
   * @returns {Promise<Object>} Operation result with {moved: number, errors: number}
   */
  static async moveMediaFiles(dumpsterMediaDir, options = {}) {
    const { verbose = false, tempMediaDir: providedMediaDir } = options;

    try {
      await FileSystemHelper.ensureDirectory(dumpsterMediaDir);

      // Use provided media directory or fallback to default detection
      const tempMediaDir = providedMediaDir;

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
        if (
          [
            'chat.html',
            'conversations.json',
            'user.json',
            'message_feedback.json',
          ].includes(item)
        ) {
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
        } else if (extension.match(/\.(dat|wav|mp3|m4a|ogg)$/)) {
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

  /**
   * Extract directory name from ZIP file path with fallback scanning
   *
   * Primary approach: Extract directory name from ZIP filename (minus .zip extension)
   * Fallback: Scan temp directory for required files if primary approach fails
   *
   * @param {string} zipPath - Path to the original ZIP file
   * @param {string} tempDir - Temporary directory where ZIP was extracted
   * @returns {Promise<Object>} Directory structure information
   */
  static async getDirectoryStructure(zipPath, tempDir) {
    const path = require('path');
    const fs = require('fs').promises;

    // Primary approach: extract directory name from ZIP filename
    const expectedDir = path.basename(zipPath, '.zip');
    const expectedPath = path.join(tempDir, expectedDir);

    try {
      // Check if expected directory exists and contains required files
      await fs.access(expectedPath);

      // Verify it contains conversations.json (minimal validation)
      const conversationsPath = path.join(expectedPath, 'conversations.json');
      await fs.access(conversationsPath);

      return {
        success: true,
        directoryName: expectedDir,
        method: 'path-based',
        chatsPath: conversationsPath,
        chatHtmlPath: path.join(expectedPath, 'chat.html'),
        mediaDir: expectedPath,
      };
    } catch {
      // Fallback: scan temp directory for valid structure
      const fallbackDir = await this.findValidDirectory(tempDir);

      if (fallbackDir) {
        return {
          success: true,
          directoryName: fallbackDir,
          method: 'fallback-scan',
          chatsPath: path.join(tempDir, fallbackDir, 'conversations.json'),
          chatHtmlPath: path.join(tempDir, fallbackDir, 'chat.html'),
          mediaDir: path.join(tempDir, fallbackDir),
        };
      }

      return {
        success: false,
        directoryName: null,
        method: 'failed',
        error: `No valid directory structure found. Expected "${expectedDir}" but could not locate required files.`,
      };
    }
  }

  /**
   * Scan temp directory to find a valid ChatGPT export directory
   * A valid directory contains conversations.json
   *
   * @param {string} tempDir - Temporary directory to scan
   * @returns {Promise<string|null>} Directory name or null if not found
   */
  static async findValidDirectory(tempDir) {
    const path = require('path');
    const fs = require('fs').promises;

    try {
      const items = await fs.readdir(tempDir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          const itemPath = path.join(tempDir, item.name);
          try {
            // Check if this directory contains conversations.json
            const conversationsPath = path.join(itemPath, 'conversations.json');
            await fs.access(conversationsPath);
            return item.name;
          } catch {
            // Skip directories without required files
            continue;
          }
        }
      }
    } catch {
      // If we can't read the directory, return null
      return null;
    }

    return null;
  }

  /**
   * Extract directory name from ZIP file path (utility function)
   *
   * @param {string} zipPath - Path to ZIP file
   * @returns {string} Directory name extracted from ZIP filename
   */
  static extractDirectoryName(zipPath) {
    const path = require('path');
    return path.basename(zipPath, '.zip');
  }
}

module.exports = AssetUtils;
