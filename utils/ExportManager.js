/*
 * Export Manager
 * Direct file-based export management system
 * Replaces session-based architecture with user-accessible exports
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger').createLogger({ module: 'ExportManager' });
const { ensureDir, removeDirectories } = require('./fileUtils.js');
const { processExport } = require('../data/process-export.js');

class ExportManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.exports = new Map();
    this.exportsFile = path.join(baseDir, 'data', 'exports.json');
    this.exportsDir = path.join(baseDir, 'data', 'exports');
    this.tempDir = path.join(baseDir, 'data', 'temp');
    this.mediaDir = path.join(baseDir, 'data'); // Media is stored with exports
  }

  /**
   * Initialize the export manager
   * Loads existing exports and ensures directories exist
   */
  async initialize() {
    await this.loadExports();
    await this.ensureDataDirectories();
    await this.cleanupTempDirectory(); // Clean any leftover temp files
    logger.info('ExportManager initialized');
  }

  /**
   * Create a new export from uploaded zip data
   * @param {Buffer|string} zipData - Zip file buffer or path
   * @param {string} exportName - User-chosen export name
   * @param {boolean} isBuffer - True if zipData is buffer, false if path
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<string>} Export name
   */
  async createExport(zipData, exportName, isBuffer = true, onProgress = null) {
    // Validate export name
    const sanitizedName = this.sanitizeExportName(exportName);

    // Check if export already exists
    if (this.exports.has(sanitizedName)) {
      throw new Error(
        `Export "${sanitizedName}" already exists. Please choose a different name.`
      );
    }

    logger.info(`Creating export "${sanitizedName}" with isBuffer=${isBuffer}`);

    const exportDir = path.join(this.exportsDir, sanitizedName);
    await ensureDir(exportDir);

    try {
      // Process the export using our unified processor
      await processExport(zipData, sanitizedName, this.baseDir, isBuffer, progress => {
        logger.info(
          `Export progress: ${progress.stage} - ${progress.progress}% - ${progress.message}`
        );
        onProgress?.(progress);
      });

      // Store export info
      this.exports.set(sanitizedName, {
        name: sanitizedName,
        createdAt: new Date(),
        size: Buffer.isBuffer(zipData) ? zipData.length : 0,
        status: 'completed',
        conversationCount: await this.getConversationCount(sanitizedName),
      });
      await this.saveExports();

      logger.info(`Export created successfully: "${sanitizedName}"`);
      return sanitizedName;
    } catch (error) {
      logger.error('Export creation failed:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      });

      // Clean up on failure
      try {
        await removeDirectories(exportDir);
        logger.info('Cleanup completed after export failure');
      } catch (cleanupError) {
        logger.error('Cleanup failed:', cleanupError);
      }

      throw error;
    }
  }

  /**
   * Get export information
   * @param {string} exportName - Export name
   * @returns {Object|null} Export info or null if not found
   */
  getExport(exportName) {
    return this.exports.get(exportName) || null;
  }

  /**
   * Check if export exists
   * @param {string} exportName - Export name
   * @returns {boolean} True if export exists
   */
  hasExport(exportName) {
    return this.exports.has(exportName);
  }

  /**
   * Get all exports
   * @returns {Map} All exports
   */
  getAllExports() {
    return new Map(this.exports);
  }

  /**
   * Delete an export and all its data
   * @param {string} exportName - Export name to delete
   * @returns {Promise<boolean>} True if export was deleted
   */
  async deleteExport(exportName) {
    if (!this.exports.has(exportName)) {
      return false;
    }

    const exportDir = path.join(this.exportsDir, exportName);

    // Remove export directory
    await removeDirectories(exportDir);

    // Remove from memory
    this.exports.delete(exportName);
    await this.saveExports();

    logger.info(`Deleted export: "${exportName}"`);
    return true;
  }

  /**
   * Get conversations for an export
   * @param {string} exportName - Export name
   * @returns {Promise<Array>} Array of conversation objects
   */
  async getConversations(exportName) {
    if (!this.exports.has(exportName)) {
      throw new Error('Export not found');
    }

    const conversationsDir = path.join(this.exportsDir, exportName, 'conversations');
    try {
      const files = await fs.readdir(conversationsDir);
      const conversations = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(conversationsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const conv = JSON.parse(content);
          conversations.push({
            id: file,
            title: conv.title || 'Untitled',
            date: file.split('_')[0],
            exportName,
          });
        }
      }

      // Sort by date (newest first)
      conversations.sort((a, b) => b.id.localeCompare(a.id));

      return conversations;
    } catch (error) {
      logger.error(`Error loading conversations for export ${exportName}:`, error);
      throw new Error('Error loading conversations');
    }
  }

  /**
   * Get specific conversation details
   * @param {string} exportName - Export name
   * @param {string} conversationId - Conversation file ID
   * @returns {Promise<Object>} Conversation details
   */
  async getConversation(exportName, conversationId) {
    if (!this.exports.has(exportName)) {
      throw new Error('Export not found');
    }

    const filePath = path.join(
      this.exportsDir,
      exportName,
      'conversations',
      conversationId
    );

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const conv = JSON.parse(content);

      // Import getConversationMessages function
      const { getConversationMessages } = require('./getConversationMessages.js');
      const messages = await getConversationMessages(conv, exportName, this.baseDir);

      return {
        title: conv.title || 'Untitled',
        messages,
        exportName,
      };
    } catch (error) {
      logger.error(`Error loading conversation ${conversationId}:`, error);
      throw new Error('Error loading conversation');
    }
  }

  /**
   * Get media file path for an export
   * @param {string} exportName - Export name
   * @param {string} mediaPath - Relative media path
   * @returns {string} Full path to media file
   */
  getMediaPath(exportName, mediaPath) {
    return path.join(this.exportsDir, exportName, 'media', mediaPath);
  }

  /**
   * Check if media file exists
   * @param {string} exportName - Export name
   * @param {string} mediaPath - Relative media path
   * @returns {Promise<boolean>} True if file exists
   */
  async mediaExists(exportName, mediaPath) {
    const filePath = this.getMediaPath(exportName, mediaPath);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get export statistics
   * @param {string} exportName - Export name
   * @returns {Promise<Object>} Export statistics
   */
  async getExportStats(exportName) {
    if (!this.exports.has(exportName)) {
      throw new Error('Export not found');
    }

    const exportInfo = this.exports.get(exportName);
    const exportDir = path.join(this.exportsDir, exportName);

    let totalSize = 0;
    let conversationCount = 0;
    let mediaCount = 0;

    try {
      // Count conversations and calculate size
      const conversationsDir = path.join(exportDir, 'conversations');
      const conversations = await fs.readdir(conversationsDir);
      conversationCount = conversations.filter(f => f.endsWith('.json')).length;

      for (const file of conversations) {
        if (file.endsWith('.json')) {
          const filePath = path.join(conversationsDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      // Count media files
      const mediaDir = path.join(exportDir, 'media');
      try {
        const mediaFiles = await this.getAllFiles(mediaDir);
        mediaCount = mediaFiles.length;

        for (const file of mediaFiles) {
          const stats = await fs.stat(file);
          totalSize += stats.size;
        }
      } catch {
        // Media directory might not exist
      }

      return {
        ...exportInfo,
        conversationCount,
        mediaCount,
        totalSize,
      };
    } catch (error) {
      logger.error(`Error getting stats for export ${exportName}:`, error);
      return exportInfo;
    }
  }

  /**
   * Sanitize export name for file system compatibility
   * @param {string} name - User-provided export name
   * @returns {string} Sanitized export name
   */
  sanitizeExportName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim() // Remove leading/trailing whitespace
      .substring(0, 50); // Limit length
  }

  /**
   * Get count of conversations in an export
   * @param {string} exportName - Export name
   * @returns {Promise<number>} Number of conversations
   */
  async getConversationCount(exportName) {
    try {
      const conversationsDir = path.join(this.exportsDir, exportName, 'conversations');
      const files = await fs.readdir(conversationsDir);
      return files.filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Recursively get all files in a directory
   * @param {string} dirPath - Directory path
   * @returns {Promise<Array>} Array of file paths
   */
  async getAllFiles(dirPath) {
    const files = [];

    async function traverse(currentPath) {
      const items = await fs.readdir(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await traverse(itemPath);
        } else {
          files.push(itemPath);
        }
      }
    }

    await traverse(dirPath);
    return files;
  }

  /**
   * Clean up temporary directory
   */
  async cleanupTempDirectory() {
    try {
      await removeDirectories(this.tempDir);
      await ensureDir(this.tempDir);
    } catch (error) {
      logger.warn('Failed to cleanup temp directory:', error.message);
    }
  }

  /**
   * Load exports from disk
   */
  async loadExports() {
    try {
      const data = await fs.readFile(this.exportsFile, 'utf8');
      const parsed = JSON.parse(data);
      this.exports = new Map(
        parsed.map(([name, info]) => [
          name,
          {
            ...info,
            createdAt: new Date(info.createdAt),
          },
        ])
      );
      logger.info(`Loaded ${this.exports.size} exports from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load exports:', error.message);
      }
      this.exports = new Map();
      logger.info('Starting with empty exports');
    }
  }

  /**
   * Save exports to disk
   */
  async saveExports() {
    try {
      const data = JSON.stringify([...this.exports.entries()], null, 2);
      await fs.writeFile(this.exportsFile, data);
    } catch (error) {
      logger.error('Failed to save exports:', error.message);
      throw error;
    }
  }

  /**
   * Ensure required data directories exist
   */
  async ensureDataDirectories() {
    await ensureDir(this.exportsDir);
    await ensureDir(this.tempDir);
  }
}

module.exports = { ExportManager };
