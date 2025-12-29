/*
 * Path manipulation and validation utilities
 * Handles path operations, validation, and file searching
 */

const fs = require('fs').promises;
const path = require('path');
const { SEARCH_CONFIG, SANITIZATION_DEFAULTS } = require('../config/constants');
const FileSystemHelper = require('./FileSystemHelper');
const { SchemaValidator } = require('./SchemaValidator');

// Simple file cache to improve performance for repeated searches
const fileCache = new Map();

// Clear cache to ensure fresh results for testing
fileCache.clear();

/**
 * Path utilities class for path manipulation and file searching
 */
class PathUtils {
  /**
   * Unified file search utility with multiple filtering options
   * @param {string} dir - Directory to search in
   * @param {Object} options - Search options
   * @param {boolean} options.recursive - Search subdirectories recursively (default: false)
   * @param {Function} options.filter - Filter function (filename, fullPath, stats) => boolean
   * @param {string} options.pattern - Regex pattern to match filenames against
   * @param {string} options.extension - File extension to match (e.g., '.js', '.json')
   * @param {string} options.prefix - Filename prefix to match
   * @param {boolean} options.includeDirs - Include directories in results (default: false)
   * @param {number} options.maxDepth - Maximum recursion depth (default: unlimited)
   * @returns {Promise<Array>} Array of matching file paths
   */
  static async findFiles(dir, options = {}) {
    const {
      recursive = false,
      filter = null,
      pattern = null,
      extension = null,
      prefix = null,
      includeDirs = false,
      maxDepth = SEARCH_CONFIG.DEFAULT_MAX_DEPTH,
    } = options;

    SchemaValidator.validateNonEmptyString(dir, 'dir');

    const results = [];

    async function traverse(currentPath, currentDepth = 0) {
      try {
        // Check depth limit
        if (currentDepth > maxDepth) {
          return;
        }

        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const stats = await fs.stat(fullPath);

          // Apply filters
          let include = true;

          if (filter && typeof filter === 'function') {
            include = filter(entry.name, fullPath, stats);
          }

          if (pattern) {
            include = include && new RegExp(pattern).test(entry.name);
          }

          if (extension) {
            include = include && entry.name.endsWith(extension);
          }

          if (prefix) {
            include = include && entry.name.startsWith(prefix);
          }

          // Add to results if included
          if (include) {
            if (stats.isFile() || includeDirs) {
              results.push(fullPath);
            }
          }

          // Recurse into subdirectories if enabled
          if (recursive && stats.isDirectory() && currentDepth < maxDepth) {
            await traverse(fullPath, currentDepth + 1);
          }
        }
      } catch (error) {
        console.warn(`Error accessing directory ${currentPath}: ${error.message}`);
      }
    }

    await traverse(dir);
    return results;
  }

  /**
   * Convenience function for finding files by extension
   * @param {string} dir - Directory to search
   * @param {string} extension - File extension (e.g., '.html', '.json')
   * @param {boolean} recursive - Search recursively (default: false)
   * @returns {Promise<Array>} Array of matching file paths
   */
  static async findFilesByExtension(dir, extension, recursive = false) {
    return this.findFiles(dir, {
      recursive,
      extension: extension.startsWith('.') ? extension : `.${extension}`,
    });
  }

  /**
   * Convenience function for finding files by name pattern
   * @param {string} dir - Directory to search
   * @param {string} prefix - Filename prefix to match
   * @param {boolean} recursive - Search recursively (default: true)
   * @returns {Promise<Array>} Array of matching file paths
   */
  static async findFilesByPrefix(dir, prefix, recursive = true) {
    return this.findFiles(dir, {
      recursive,
      prefix,
    });
  }

  /**
   * Get cached file search results or perform new search
   * @param {string} dir - Directory to search
   * @param {string} filename - Filename to search for
   * @returns {Promise<Array>} Array of matching file paths
   */
  static async cachedRecursivelyFindFiles(dir, filename) {
    const cacheKey = `${dir}:${filename}`;

    if (fileCache.has(cacheKey)) {
      return fileCache.get(cacheKey);
    }

    const results = await this.findFilesByPrefix(dir, filename, true);

    // Implement simple LRU-like behavior
    if (fileCache.size >= SEARCH_CONFIG.MAX_CACHE_SIZE) {
      const firstKey = fileCache.keys().next().value;
      fileCache.delete(firstKey);
    }

    fileCache.set(cacheKey, results);
    return results;
  }

  /**
   * Convenience function for finding files by regex pattern
   * @param {string} dir - Directory to search
   * @param {string|RegExp} pattern - Regex pattern to match
   * @param {boolean} recursive - Search recursively (default: false)
   * @returns {Promise<Array>} Array of matching file paths
   */
  static async findFilesByPattern(dir, pattern, recursive = false) {
    return this.findFiles(dir, {
      recursive,
      pattern: typeof pattern === 'string' ? pattern : pattern.source,
    });
  }

  /**
   * Consolidated path validation to prevent traversal attacks
   *
   * This is the primary implementation for path security validation. Previously
   * duplicated in ZipProcessor.js - now consolidated here as single source of truth.
   * Validates against path traversal, null bytes, and dangerous characters.
   *
   * @param {string} filePath - File path to validate for security
   * @returns {boolean} True if path is safe, false if potentially dangerous
   */
  static validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // Normalize path to resolve any .. sequences
    const normalized = path.normalize(filePath);

    // Check for path traversal attempts
    if (
      normalized.includes('..') ||
      normalized.startsWith('/') ||
      normalized.includes('\\')
    ) {
      return false;
    }

    // Check for null bytes and other dangerous characters
    if (
      normalized.includes('\0') ||
      normalized.includes('\r') ||
      normalized.includes('\n')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Unified name sanitization function for different use cases
   * @param {string} name - Name to sanitize
   * @param {Object} options - Sanitization options
   * @param {string} options.type - Type of sanitization: 'dumpster', 'export', 'filename'
   * @param {number} options.maxLength - Maximum length (default varies by type)
   * @param {string} options.caseTransform - Case transformation: 'lower', 'upper', 'none' (default varies by type)
   * @param {string} options.spaceReplacement - What to replace spaces with (default varies by type)
   * @returns {string} Sanitized name
   */
  static sanitizeName(name, options = {}) {
    const {
      type = 'dumpster',
      maxLength = SANITIZATION_DEFAULTS[type.toUpperCase()].maxLength,
      caseTransform = SANITIZATION_DEFAULTS[type.toUpperCase()].caseTransform,
      spaceReplacement = SANITIZATION_DEFAULTS[type.toUpperCase()].spaceReplacement,
      allowPrefixNumbers = SANITIZATION_DEFAULTS[type.toUpperCase()].allowPrefixNumbers,
    } = options;

    let sanitized = name;

    if (type === 'dumpster') {
      // Strict alphanumeric + underscore + dash only
      sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Ensure starts with letter (if not allowed to start with numbers)
      if (!allowPrefixNumbers) {
        sanitized = sanitized.replace(/^[^a-zA-Z]/, '_');
      }
    } else if (type === 'export') {
      // Replace filesystem-invalid characters with dash
      sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '-');
    } else {
      // Remove characters not suitable for filenames
      sanitized = sanitized.replace(/[^\w\s-]/g, '');
    }

    // Replace multiple spaces with single space replacement
    sanitized = sanitized.replace(/\s+/g, spaceReplacement);

    // Remove leading/trailing whitespace/space replacement
    sanitized = sanitized.trim();

    // Limit length
    sanitized = sanitized.substring(0, maxLength);

    // Case transformation
    if (caseTransform === 'lower') {
      sanitized = sanitized.toLowerCase();
    } else if (caseTransform === 'upper') {
      sanitized = sanitized.toUpperCase();
    }

    // Ensure it's not empty
    if (sanitized.length === 0) {
      return type === 'dumpster'
        ? 'untitled_dumpster'
        : type === 'export'
          ? 'untitled_export'
          : 'untitled';
    }

    return sanitized;
  }

  /**
   * Gets the media directory path for an export
   * @param {string} baseDir - Base directory of the application
   * @param {string} exportName - The export name
   * @returns {string} Media directory path
   */
  static getMediaDir(baseDir, exportName) {
    const { SchemaValidator } = require('./SchemaValidator');

    SchemaValidator.validateRequiredParams(
      [
        { name: 'baseDir', value: baseDir },
        { name: 'exportName', value: exportName },
      ],
      'getMediaDir'
    );
    SchemaValidator.validateNonEmptyString(baseDir, 'baseDir');
    SchemaValidator.validateNonEmptyString(exportName, 'exportName');

    return FileSystemHelper.joinPath(baseDir, 'media', exportName);
  }

  /**
   * Removes directories safely with error handling
   * @param {...string} dirs - Directory paths to remove
   */
  static async removeDirectories(...dirs) {
    for (const dir of dirs) {
      try {
        await FileSystemHelper.removeDirectory(dir);
      } catch (error) {
        // Ignore errors if directories don't exist
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to remove directory ${dir}:`, error.message);
        }
      }
    }
  }

  /**
   * Consolidated recursive directory copy implementation
   *
   * This is the primary implementation for directory copying. Previously duplicated
   * in dumpster-processor.js - now consolidated here as single source of truth.
   * Uses { withFileTypes: true } for better performance than fs.stat().
   *
   * @param {string} src - Source directory to copy from
   * @param {string} dest - Destination directory to copy to
   * @returns {Promise<void>} Resolves when copy completes
   */
  static async copyDirectory(src, dest) {
    await FileSystemHelper.ensureDirectory(dest);

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

module.exports = PathUtils;
