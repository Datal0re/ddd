/*
 * Centralized file system utilities
 * Provides common file operations with consistent error handling
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * Centralized file system helper class
 */
class FileSystemHelper {
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
   * Creates a secure temporary directory in the system temp directory
   *
   * Use this for short-lived temporary files that can be safely cleaned up by the OS.
   * Creates directories in os.tmpdir() with secure random names.
   *
   * @param {string} prefix - Directory name prefix (default: 'dddiver-')
   * @returns {Promise<string>} Path to created system temp directory
   */
  static async createSystemTempDir(prefix = 'dddiver-') {
    const tempDir = path.join(
      os.tmpdir(),
      `${prefix}${crypto.randomBytes(8).toString('hex')}`
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
}

module.exports = FileSystemHelper;
