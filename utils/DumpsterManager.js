/**
 * Dumpster Manager
 * Direct file-based dumpster management system
 * Replaces session-based architecture with user-accessible dumpsters
 */
const FileSystemHelper = require('./fsHelpers');
const PathUtils = require('./pathUtils');

class DumpsterManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.dumpsters = new Map();
    this.dumpstersFile = FileSystemHelper.joinPath(baseDir, 'data', 'dumpsters.json');
    this.dumpstersDir = FileSystemHelper.joinPath(baseDir, 'data', 'dumpsters');
    this.tempDir = FileSystemHelper.joinPath(baseDir, 'data', 'temp');
    this.mediaDir = FileSystemHelper.joinPath(baseDir, 'data'); // Media is stored with dumpsters
  }

  /**
   * Initialize the dumpster manager
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.loadDumpsters();
  }

  /**
   * List all dumpsters
   * @returns {Promise<Array>} Array of dumpster objects
   */
  async listDumpsters() {
    const dumpsterInfo = [];
    for (const [name, data] of this.dumpsters) {
      try {
        const stats = await this.getDumpsterStats(name);
        dumpsterInfo.push({
          name,
          createdAt: data.createdAt,
          chatCount: stats.chatCount,
          totalSize: stats.totalSize,
        });
      } catch (error) {
        console.warn(`Error getting stats for dumpster ${name}:`, error.message);
        dumpsterInfo.push({
          name,
          createdAt: data.createdAt,
          chatCount: 'unknown',
          totalSize: 'unknown',
        });
      }
    }

    return dumpsterInfo;
  }

  /**
   * Get dumpster information
   * @param {string} dumpsterName - Dumpster name
   * @returns {Object|null} Dumpster info or null if not found
   */
  getDumpster(dumpsterName) {
    return this.dumpsters.get(dumpsterName) || null;
  }

  /**
   * Delete a dumpster and all its associated files
   * @param {string} dumpsterName - Name of dumpster to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteDumpster(dumpsterName) {
    const sanitizedName = this.sanitizeDumpsterName(dumpsterName);

    if (!this.dumpsters.has(sanitizedName)) {
      throw new Error(`Dumpster "${sanitizedName}" not found`);
    }

    const dumpsterDir = FileSystemHelper.joinPath(this.dumpstersDir, sanitizedName);

    try {
      // Remove dumpster directory and all contents
      await FileSystemHelper.removeDirectory(dumpsterDir);

      // Remove from metadata
      this.dumpsters.delete(dumpsterName);
      await this.saveDumpsters();

      console.log(`Deleted dumpster: "${dumpsterName}"`);
      return true;
    } catch {
      // continue
    }
  }

  /**
   * Get chats from a dumpster
   * @param {string} dumpsterName - Name of dumpster
   * @param {number|null} limit - Maximum number of chats to return
   * @returns {Promise<Array>} Array of chat objects
   */
  async getChats(dumpsterName, limit = null) {
    await this.loadDumpsters();

    if (!this.dumpsters.has(dumpsterName)) {
      throw new Error(`Dumpster "${dumpsterName}" not found`);
    }

    const dumpsterDir = FileSystemHelper.joinPath(this.dumpstersDir, dumpsterName);
    const conversationsDir = FileSystemHelper.joinPath(dumpsterDir, 'conversations');

    try {
      const files = await FileSystemHelper.listDirectory(conversationsDir);

      // Filter for JSON files and sort by filename (which includes date)
      const jsonFiles = files
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Reverse chronological order

      const chats = [];
      for (const file of limit ? jsonFiles.slice(0, limit) : jsonFiles) {
        try {
          const filePath = FileSystemHelper.joinPath(conversationsDir, file);
          const conversation = await FileSystemHelper.readJsonFile(filePath);
          chats.push({
            filename: file,
            ...conversation,
          });
        } catch (error) {
          console.warn(`Error reading chat file ${file}:`, error.message);
        }
      }

      return chats;
    } catch (error) {
      console.error(`Error loading chats for dumpster ${dumpsterName}:`, error);
      throw new Error('Error loading chats');
    }
  }

  /**
   * Get a specific chat from a dumpster
   * @param {string} dumpsterName - Name of dumpster
   * @param {string} chatId - ID/filename of chat
   * @returns {Promise<Object>} Chat object
   */
  async getChat(dumpsterName, chatId) {
    await this.loadDumpsters();

    if (!this.dumpsters.has(dumpsterName)) {
      throw new Error(`Dumpster "${dumpsterName}" not found`);
    }

    const dumpsterDir = FileSystemHelper.joinPath(this.dumpstersDir, dumpsterName);
    const conversationsDir = FileSystemHelper.joinPath(dumpsterDir, 'conversations');
    const chatFile = FileSystemHelper.joinPath(conversationsDir, chatId);

    try {
      const conversation = await FileSystemHelper.readJsonFile(chatFile);
      return {
        dumpsterName,
        filename: chatId,
        ...conversation,
      };
    } catch (error) {
      console.error(`Error loading chat ${chatId}:`, error);
      throw new Error('Error loading chat');
    }
  }

  /**
   * Get media file path for a dumpster
   * @param {string} dumpsterName - Dumpster name
   * @param {string} mediaPath - Relative media path
   * @returns {string} Full path to media file
   */
  getMediaPath(dumpsterName, mediaPath) {
    return FileSystemHelper.joinPath(
      this.dumpstersDir,
      dumpsterName,
      'media',
      mediaPath
    );
  }

  /**
   * Check if media file exists
   * @param {string} dumpsterName - Dumpster name
   * @param {string} mediaPath - Relative media path
   * @returns {Promise<boolean>} True if file exists
   */
  async mediaExists(dumpsterName, mediaPath) {
    const filePath = this.getMediaPath(dumpsterName, mediaPath);
    return await FileSystemHelper.fileExists(filePath);
  }

  /**
   * Get statistics for a dumpster
   * @param {string} dumpsterName - Name of dumpster
   * @returns {Promise<Object>} Dumpster statistics
   */
  async getDumpsterStats(dumpsterName) {
    const dumpsterDir = FileSystemHelper.joinPath(this.dumpstersDir, dumpsterName);

    try {
      let totalSize = 0;
      let chatCount = 0;

      const conversationsDir = FileSystemHelper.joinPath(dumpsterDir, 'conversations');
      const files = await FileSystemHelper.listDirectory(conversationsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = FileSystemHelper.joinPath(conversationsDir, file);
          const stats = await FileSystemHelper.getStats(filePath);
          totalSize += stats.size;
          chatCount++;
        }
      }

      // Check if media directory exists and count files
      const mediaDir = FileSystemHelper.joinPath(dumpsterDir, 'media');
      if (await FileSystemHelper.fileExists(mediaDir)) {
        try {
          const mediaFiles = await FileSystemHelper.listDirectory(mediaDir);
          for (const file of mediaFiles) {
            const mediaFilePath = FileSystemHelper.joinPath(mediaDir, file);
            try {
              const mediaStats = await FileSystemHelper.getStats(mediaFilePath);
              if (mediaStats.isFile()) {
                totalSize += mediaStats.size;
              }
            } catch {
              // Skip files that can't be accessed
            }
          }
        } catch {
          // Error reading media directory
        }
      }

      return {
        dumpsterName,
        totalSize,
        chatCount,
      };
    } catch (error) {
      console.error(`Error getting stats for dumpster ${dumpsterName}:`, error);
      return null;
    }
  }

  /**
   * Sanitize export name for file system compatibility
   * @param {string} name - User-provided export name
   * @returns {string} Sanitized export name
   */
  sanitizeExportName(name) {
    return PathUtils.sanitizeName(name, { type: 'export' });
  }

  /**
   * Get conversation count for a dumpster
   * @param {string} dumpsterName - Dumpster name
   * @returns {Promise<number>} Number of conversations
   */
  async getConversationCount(dumpsterName) {
    try {
      const conversationsDir = FileSystemHelper.joinPath(
        this.dumpstersDir,
        dumpsterName,
        'conversations'
      );
      const files = await FileSystemHelper.listDirectory(conversationsDir);
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
      const items = await FileSystemHelper.listDirectory(currentPath);

      for (const item of items) {
        const itemPath = FileSystemHelper.joinPath(currentPath, item);
        const stats = await FileSystemHelper.getStats(itemPath);

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
      await PathUtils.removeDirectories(this.tempDir);
      await FileSystemHelper.ensureDirectory(this.tempDir);
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  }

  /**
   * Ensure required data directories exist
   */
  async ensureDataDirectories() {
    await FileSystemHelper.ensureDirectory(this.dumpstersDir);
    await FileSystemHelper.ensureDirectory(this.tempDir);
  }

  /**
   * Sanitize dumpster name for filesystem safety
   * @param {string} name - Dumpster name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizeDumpsterName(name) {
    return PathUtils.sanitizeName(name, { type: 'dumpster' });
  }

  /**
   * Create a new dumpster from a ZIP file
   * @param {string|Buffer} zipData - Path to ZIP file or ZIP buffer
   * @param {string} dumpsterName - Name for the dumpster
   * @param {boolean} isBuffer - Whether zipData is a buffer (default: false)
   * @param {Function} onProgress - Progress callback function
   * @returns {Promise<Object>} Dumpster creation result
   */
  async createDumpster(zipData, dumpsterName, isBuffer = false, onProgress = null) {
    const { processExport } = require('../data/dumpster-processor.js');

    try {
      // Ensure data directories exist
      await this.ensureDataDirectories();

      // Process the export using the dumpster processor
      const result = await processExport(
        zipData,
        dumpsterName,
        this.baseDir,
        isBuffer,
        onProgress,
        {}
      );

      if (result.success) {
        // Add to dumpsters registry
        const sanitizedDumpsterName = this.sanitizeDumpsterName(dumpsterName);
        this.dumpsters.set(sanitizedDumpsterName, {
          name: sanitizedDumpsterName,
          displayName: dumpsterName,
          createdAt: new Date(),
          stats: result.stats,
          path: result.dumpsterDir,
        });

        // Save to disk
        await this.saveDumpsters();
      }

      return result;
    } catch (error) {
      console.error('Failed to create dumpster:', error.message);
      throw error;
    }
  }

  /**
   * Load dumpsters from disk
   */
  async loadDumpsters() {
    try {
      const parsed = await FileSystemHelper.readJsonFile(this.dumpstersFile);
      this.dumpsters = new Map(
        parsed.map(([name, info]) => [
          name,
          {
            ...info,
            createdAt: new Date(info.createdAt),
          },
        ])
      );
      console.log(`Loaded ${this.dumpsters.size} dumpsters from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to load dumpsters:', error.message);
      }
      this.dumpsters = new Map();
      console.log('Starting with empty dumpsters');
    }
  }

  /**
   * Save dumpsters to disk
   */
  async saveDumpsters() {
    try {
      await FileSystemHelper.writeJsonFile(this.dumpstersFile, [
        ...this.dumpsters.entries(),
      ]);
    } catch (error) {
      console.error('Failed to save dumpsters:', error.message);
      throw error;
    }
  }
}

module.exports = { DumpsterManager };
