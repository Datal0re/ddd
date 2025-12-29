/*
 * Consolidated file utilities
 * Merges FileSystemHelper and PathUtils functionality
 * Provides unified file operations, path manipulation, and search capabilities
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const {
  PATHS,
  SEARCH_CONFIG,
  SANITIZATION_DEFAULTS,
  TEMP_CONFIG,
} = require('../config/constants');
const { SchemaValidator } = require('./SchemaValidator');

// Simple file cache to improve performance for repeated searches
const fileCache = new Map();

// Clear cache to ensure fresh results for testing
fileCache.clear();

/**
 * Consolidated file utilities class
 * Combines all file system operations, path utilities, and search functionality
 */
class FileUtils {
  // ===== Core File Operations =====

  /**
   * Ensures a directory exists, creating it if necessary
   * @param {string} dirPath - Directory path to ensure
   * @throws {Error} If directory creation fails
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Reads and parses a JSON file
   * @param {string} filePath - Path to JSON file
   * @returns {Promise<any>} Parsed JSON data
   * @throws {Error} If file doesn't exist or contains invalid JSON
   */
  static async readJsonFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Writes data to a JSON file
   * @param {string} filePath - Path to write JSON file
   * @param {any} data - Data to serialize and write
   * @param {Object} options - Write options
   * @param {boolean} options.pretty - Whether to format JSON prettily (default: true)
   * @throws {Error} If file write fails
   */
  static async writeJsonFile(filePath, data, options = {}) {
    const { pretty = true } = options;
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Checks if a file or directory exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if path exists
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely reads a file with consistent encoding
   * @param {string} filePath - Path to file
   * @param {string} encoding - File encoding (default: 'utf8')
   * @returns {Promise<string>} File contents
   * @throws {Error} If file doesn't exist or can't be read
   */
  static async readFile(filePath, encoding = 'utf8') {
    return await fs.readFile(filePath, encoding);
  }

  /**
   * Writes data to a file
   * @param {string} filePath - Path to write file
   * @param {string|Buffer} data - Data to write
   * @param {string} encoding - File encoding (default: 'utf8')
   * @throws {Error} If file write fails
   */
  static async writeFile(filePath, data, encoding = 'utf8') {
    await fs.writeFile(filePath, data, encoding);
  }

  /**
   * Gets file statistics
   * @param {string} filePath - Path to file
   * @returns {Promise<fs.Stats>} File statistics
   * @throws {Error} If file doesn't exist
   */
  static async getStats(filePath) {
    return await fs.stat(filePath);
  }

  /**
   * Deletes a file
   * @param {string} filePath - Path to the file to delete
   * @returns {Promise<void>}
   * @throws {Error} If file doesn't exist or can't be deleted
   */
  static async deleteFile(filePath) {
    return await fs.unlink(filePath);
  }

  /**
   * Creates a secure temporary directory in the system temp directory
   * @param {string} prefix - Directory name prefix (default: 'dddiver-')
   * @returns {Promise<string>} Path to created system temp directory
   */
  static async createSystemTempDir(prefix = 'dddiver-') {
    const tempDir = path.join(
      os.tmpdir(),
      `${prefix}${crypto.randomBytes(TEMP_CONFIG.RANDOM_BYTES_LENGTH).toString('hex')}`
    );
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Safely removes a directory and all its contents
   * @param {string} dirPath - Directory path to remove
   */
  static async removeDirectory(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors - temp dirs may be locked by OS
      console.warn(`Failed to remove directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Lists files in a directory
   * @param {string} dirPath - Directory path to list
   * @returns {Promise<string[]>} Array of file names
   * @throws {Error} If directory doesn't exist or can't be read
   */
  static async listDirectory(dirPath) {
    return await fs.readdir(dirPath);
  }

  // ===== Path Operations =====

  /**
   * Joins path segments safely
   * @param {...string} segments - Path segments
   * @returns {string} Joined path
   */
  static joinPath(...segments) {
    return path.join(...segments);
  }

  /**
   * Gets the directory name from a path
   * @param {string} filePath - File path
   * @returns {string} Directory path
   */
  static getDirName(filePath) {
    return path.dirname(filePath);
  }

  /**
   * Gets the base name from a path
   * @param {string} filePath - File path
   * @param {string} extension - Optional extension to remove
   * @returns {string} Base name
   */
  static getBaseName(filePath, extension) {
    return path.basename(filePath, extension);
  }

  /**
   * Gets the file extension from a path
   * @param {string} filePath - File path
   * @returns {string} File extension (including dot)
   */
  static getExtension(filePath) {
    return path.extname(filePath);
  }

  /**
   * Resolves a path to an absolute path
   * @param {...string} segments - Path segments
   * @returns {string} Absolute path
   */
  static resolvePath(...segments) {
    return path.resolve(...segments);
  }

  /**
   * Checks if a path is absolute
   * @param {string} filePath - Path to check
   * @returns {boolean} True if path is absolute
   */
  static isAbsolute(filePath) {
    return path.isAbsolute(filePath);
  }

  // ===== File Search Operations =====

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

  // ===== Path Security and Validation =====

  /**
   * Consolidated path validation to prevent traversal attacks
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

  // ===== Application-Specific Path Operations =====

  /**
   * Build standard dumpster path
   * @param {string} baseDir - Base application directory
   * @param {string} dumpsterName - Sanitized dumpster name
   * @returns {string} Full path to dumpster directory
   */
  static buildDumpsterPath(baseDir, dumpsterName) {
    return this.joinPath(baseDir, PATHS.DUMPSTERS_DIR, dumpsterName);
  }

  /**
   * Build standard chats path within dumpster
   * @param {string} dumpsterPath - Path to dumpster directory
   * @returns {string} Path to chats directory
   */
  static buildChatsPath(dumpsterPath) {
    return this.joinPath(dumpsterPath, PATHS.CHATS_DIR);
  }

  /**
   * Build standard media path within dumpster
   * @param {string} dumpsterPath - Path to dumpster directory
   * @returns {string} Path to media directory
   */
  static buildMediaPath(dumpsterPath) {
    return this.joinPath(dumpsterPath, PATHS.MEDIA_DIR);
  }

  /**
   * Build standard temp path
   * @param {string} baseDir - Base application directory
   * @param {string} tempName - Temp directory name
   * @returns {string} Path to temp directory
   */
  static buildTempPath(baseDir, tempName = null) {
    return tempName
      ? this.joinPath(baseDir, PATHS.TEMP_DIR, tempName)
      : this.joinPath(baseDir, PATHS.TEMP_DIR);
  }

  /**
   * Gets the media directory path for an export
   * @param {string} baseDir - Base directory of the application
   * @param {string} exportName - The export name
   * @returns {string} Media directory path
   */
  static getMediaDir(baseDir, exportName) {
    SchemaValidator.validateRequiredParams(
      [
        { name: 'baseDir', value: baseDir },
        { name: 'exportName', value: exportName },
      ],
      'getMediaDir'
    );
    SchemaValidator.validateNonEmptyString(baseDir, 'baseDir');
    SchemaValidator.validateNonEmptyString(exportName, 'exportName');

    return this.joinPath(baseDir, 'media', exportName);
  }

  /**
   * Ensure complete dumpster directory structure
   * @param {string} dumpsterPath - Path to dumpster directory
   * @returns {Promise<void>}
   */
  static async ensureDumpsterStructure(dumpsterPath) {
    await this.ensureDirectory(dumpsterPath);
    await this.ensureDirectory(this.buildChatsPath(dumpsterPath));
    await this.ensureDirectory(this.buildMediaPath(dumpsterPath));
  }

  /**
   * Get all standard paths for a dumpster
   * @param {string} baseDir - Base application directory
   * @param {string} dumpsterName - Sanitized dumpster name
   * @returns {Object} Object containing all standard paths
   */
  static getDumpsterPaths(baseDir, dumpsterName) {
    const dumpsterPath = this.buildDumpsterPath(baseDir, dumpsterName);
    return {
      baseDir,
      dumpsterPath,
      chatsPath: this.buildChatsPath(dumpsterPath),
      mediaPath: this.buildMediaPath(dumpsterPath),
      assetsJsonPath: this.joinPath(dumpsterPath, 'assets.json'),
      chatHtmlPath: this.joinPath(dumpsterPath, 'chat.html'),
    };
  }

  /**
   * Validate that dumpster structure exists and is complete
   * @param {string} dumpsterPath - Path to dumpster directory
   * @returns {Promise<{isValid: boolean, missing: string[]}>}
   */
  static async validateDumpsterStructure(dumpsterPath) {
    const required = [
      this.buildChatsPath(dumpsterPath),
      this.buildMediaPath(dumpsterPath),
    ];

    const missing = [];
    for (const requiredPath of required) {
      if (!(await this.fileExists(requiredPath))) {
        missing.push(requiredPath);
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  // ===== Advanced File Operations =====

  /**
   * Safely copy file with overwrite check
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @param {boolean} overwrite - Whether to overwrite existing file
   * @returns {Promise<boolean>} True if file was copied
   */
  static async safeCopyFile(sourcePath, destPath, overwrite = false) {
    if (!overwrite && (await this.fileExists(destPath))) {
      return false;
    }

    await this.ensureDirectory(this.getDirName(destPath));
    await fs.copyFile(sourcePath, destPath);
    return true;
  }

  /**
   * Consolidated recursive directory copy implementation
   * @param {string} src - Source directory to copy from
   * @param {string} dest - Destination directory to copy to
   * @returns {Promise<void>} Resolves when copy completes
   */
  static async copyDirectory(src, dest) {
    await this.ensureDirectory(dest);

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

  /**
   * Removes directories safely with error handling
   * @param {...string} dirs - Directory paths to remove
   */
  static async removeDirectories(...dirs) {
    for (const dir of dirs) {
      try {
        await this.removeDirectory(dir);
      } catch (error) {
        // Ignore errors if directories don't exist
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to remove directory ${dir}:`, error.message);
        }
      }
    }
  }

  // ===== Utility Functions =====

  /**
   * Format file size for human readable display
   * @param {number} bytes - Size in bytes
   * @returns {string} Human readable file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, index);
    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }
}

module.exports = FileUtils;
