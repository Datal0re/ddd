/**
 * Dumpster Manager
 * Direct file-based dumpster management system
 * Replaces session-based architecture with user-accessible dumpsters
 */
const fs = require('fs').promises;
const path = require('path');
const { ensureDir, removeDirectories } = require('./fileUtils.js');

class DumpsterManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.dumpsters = new Map();
    this.dumpstersFile = path.join(baseDir, 'data', 'dumpsters.json');
    this.dumpstersDir = path.join(baseDir, 'data', 'dumpsters');
    this.tempDir = path.join(baseDir, 'data', 'temp');
    this.mediaDir = path.join(baseDir, 'data'); // Media is stored with dumpsters
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

    const dumpsterDir = path.join(this.dumpstersDir, sanitizedName);

    try {
      // Remove dumpster directory and all contents
      await removeDirectories(dumpsterDir);

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

    const dumpsterDir = path.join(this.dumpstersDir, dumpsterName);
    const conversationsDir = path.join(dumpsterDir, 'conversations');

    try {
      const files = await fs.readdir(conversationsDir);

      // Filter for JSON files and sort by filename (which includes date)
      const jsonFiles = files
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Reverse chronological order

      const chats = [];
      for (const file of limit ? jsonFiles.slice(0, limit) : jsonFiles) {
        try {
          const filePath = path.join(conversationsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const conversation = JSON.parse(content);
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

    const dumpsterDir = path.join(this.dumpstersDir, dumpsterName);
    const conversationsDir = path.join(dumpsterDir, 'conversations');
    const chatFile = path.join(conversationsDir, chatId);

    try {
      const content = await fs.readFile(chatFile, 'utf8');
      const conversation = JSON.parse(content);
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
    return path.join(this.dumpstersDir, dumpsterName, 'media', mediaPath);
  }

  /**
   * Check if media file exists
   * @param {string} dumpsterName - Dumpster name
   * @param {string} mediaPath - Relative media path
   * @returns {Promise<boolean>} True if file exists
   */
  async mediaExists(dumpsterName, mediaPath) {
    const filePath = this.getMediaPath(dumpsterName, mediaPath);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics for a dumpster
   * @param {string} dumpsterName - Name of dumpster
   * @returns {Promise<Object>} Dumpster statistics
   */
  async getDumpsterStats(dumpsterName) {
    const dumpsterDir = path.join(this.dumpstersDir, dumpsterName);

    try {
      let totalSize = 0;
      let chatCount = 0;

      const conversationsDir = path.join(dumpsterDir, 'conversations');
      const files = await fs.readdir(conversationsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(conversationsDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          chatCount++;
        }
      }

      // Check if media directory exists and count files
      const mediaDir = path.join(dumpsterDir, 'media');
      try {
        const mediaFiles = await fs.readdir(mediaDir);
        for (const file of mediaFiles) {
          const mediaFilePath = path.join(mediaDir, file);
          try {
            const mediaStats = await fs.stat(mediaFilePath);
            if (mediaStats.isFile()) {
              totalSize += mediaStats.size;
            }
          } catch {
            // Skip files that can't be accessed
          }
        }
      } catch {
        // Media directory doesn't exist, which is fine
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
    return name
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim() // Remove leading/trailing whitespace
      .substring(0, 50); // Limit length
  }

  /**
   * Get conversation count for a dumpster
   * @param {string} dumpsterName - Dumpster name
   * @returns {Promise<number>} Number of conversations
   */
  async getConversationCount(dumpsterName) {
    try {
      const conversationsDir = path.join(
        this.dumpstersDir,
        dumpsterName,
        'conversations'
      );
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
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  }

  /**
   * Ensure required data directories exist
   */
  async ensureDataDirectories() {
    await ensureDir(this.dumpstersDir);
    await ensureDir(this.tempDir);
  }

  /**
   * Sanitize dumpster name for filesystem safety
   * @param {string} name - Dumpster name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizeDumpsterName(name) {
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[^a-zA-Z]/, '_')
      .toLowerCase();
  }

  /**
   * Load dumpsters from disk
   */
  async loadDumpsters() {
    try {
      const data = await fs.readFile(this.dumpstersFile, 'utf8');
      const parsed = JSON.parse(data);
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
      const data = JSON.stringify([...this.dumpsters.entries()], null, 2);
      await fs.writeFile(this.dumpstersFile, data);
    } catch (error) {
      console.error('Failed to save dumpsters:', error.message);
      throw error;
    }
  }
}

module.exports = { DumpsterManager };
