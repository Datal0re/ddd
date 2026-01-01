/**
 * Dumpster Manager
 * Direct file-based dumpster management system
 * Replaces session-based architecture with user-accessible dumpsters
 */
const FileUtils = require('./FileUtils');
const { SearchManager } = require('./SearchManager');

class DumpsterManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.dumpsters = new Map();
    this.dumpstersFile = FileUtils.joinPath(baseDir, 'data', 'dumpsters.json');
    this.dumpstersDir = FileUtils.joinPath(baseDir, 'data', 'dumpsters');
    this.tempDir = FileUtils.joinPath(baseDir, 'data', 'temp');
    this.mediaDir = FileUtils.joinPath(baseDir, 'data'); // Media is stored with dumpsters
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

    const dumpsterDir = FileUtils.joinPath(this.dumpstersDir, sanitizedName);

    try {
      // Remove dumpster directory and all contents
      await FileUtils.removeDirectory(dumpsterDir);

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

    const dumpsterDir = FileUtils.joinPath(this.dumpstersDir, dumpsterName);
    const chatsDir = FileUtils.joinPath(dumpsterDir, 'chats');

    try {
      const files = await FileUtils.listDirectory(chatsDir);

      // Filter for JSON files and sort by filename (which includes date)
      const jsonFiles = files
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Reverse chronological order

      const chats = [];
      for (const file of limit ? jsonFiles.slice(0, limit) : jsonFiles) {
        try {
          const filePath = FileUtils.joinPath(chatsDir, file);
          const chat = await FileUtils.readJsonFile(filePath);
          chats.push({
            filename: file,
            ...chat,
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

    const dumpsterDir = FileUtils.joinPath(this.dumpstersDir, dumpsterName);
    const chatsDir = FileUtils.joinPath(dumpsterDir, 'chats');
    const chatFile = FileUtils.joinPath(chatsDir, chatId);

    try {
      const conversation = await FileUtils.readJsonFile(chatFile);
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
    return FileUtils.joinPath(this.dumpstersDir, dumpsterName, 'media', mediaPath);
  }

  /**
   * Check if media file exists
   * @param {string} dumpsterName - Dumpster name
   * @param {string} mediaPath - Relative media path
   * @returns {Promise<boolean>} True if file exists
   */
  async mediaExists(dumpsterName, mediaPath) {
    const filePath = this.getMediaPath(dumpsterName, mediaPath);
    return await FileUtils.fileExists(filePath);
  }

  /**
   * Get statistics for a dumpster
   * @param {string} dumpsterName - Name of dumpster
   * @returns {Promise<Object>} Dumpster statistics
   */
  async getDumpsterStats(dumpsterName) {
    const dumpsterDir = FileUtils.joinPath(this.dumpstersDir, dumpsterName);

    try {
      let totalSize = 0;
      let chatCount = 0;

      const chatsDir = FileUtils.joinPath(dumpsterDir, 'chats');
      const files = await FileUtils.listDirectory(chatsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = FileUtils.joinPath(chatsDir, file);
          const stats = await FileUtils.getStats(filePath);
          totalSize += stats.size;
          chatCount++;
        }
      }

      // Check if media directory exists and count files
      const mediaDir = FileUtils.joinPath(dumpsterDir, 'media');
      if (await FileUtils.fileExists(mediaDir)) {
        try {
          const mediaFiles = await FileUtils.listDirectory(mediaDir);
          for (const file of mediaFiles) {
            const mediaFilePath = FileUtils.joinPath(mediaDir, file);
            try {
              const mediaStats = await FileUtils.getStats(mediaFilePath);
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
    return FileUtils.sanitizeName(name, { type: 'export' });
  }

  /**
   * Search chats within a dumpster
   * @param {string} dumpsterName - Name of dumpster to search
   * @param {string} query - Search query (empty string returns all chats)
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of search results
   */
  async searchChats(dumpsterName, query = '', options = {}) {
    const {
      scope = 'all', // 'title', 'content', 'all'
      caseSensitive = false,
      messageLimit = 100, // TODO: Use UI_CONFIG.DEFAULT_MESSAGE_LIMIT when circular dependency is resolved
      limit = null, // Maximum results to return (null = show all)
    } = options;

    await this.loadDumpsters();

    if (!this.dumpsters.has(dumpsterName)) {
      throw new Error(`Dumpster "${dumpsterName}" not found`);
    }

    const dumpsterDir = FileUtils.joinPath(this.dumpstersDir, dumpsterName);
    const chatsDir = FileUtils.joinPath(dumpsterDir, 'chats');

    try {
      const files = await FileUtils.listDirectory(chatsDir);

      // Filter for JSON files and sort by filename (which includes date)
      const jsonFiles = files
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Reverse chronological order

      const searchResults = [];
      const maxFiles = limit ? Math.min(jsonFiles.length, limit) : jsonFiles.length;

      for (let i = 0; i < maxFiles; i++) {
        const file = jsonFiles[i];
        try {
          const filePath = FileUtils.joinPath(chatsDir, file);
          const chat = await FileUtils.readJsonFile(filePath);

          // Perform search
          const searchResult = SearchManager.searchInChat(chat, query, {
            scope,
            caseSensitive,
            messageLimit,
          });

          // Include all results if no query, or only matches if query provided
          if (!query || query.trim() === '' || searchResult.matchCount > 0) {
            searchResults.push({
              chat: {
                filename: file,
                ...chat,
              },
              searchResult,
              rank: i, // Original position for tie-breaking
            });
          }
        } catch (error) {
          console.warn(`Error reading chat file ${file}:`, error.message);
        }
      }

      // Sort results by relevance if query provided
      let finalResults = searchResults;
      if (query && query.trim() !== '') {
        finalResults = SearchManager.sortByRelevance(searchResults);
      }

      // Return results with metadata for summary generation
      return {
        results: finalResults,
        totalChats: jsonFiles.length,
        matchCount: finalResults.length,
      };
    } catch (error) {
      console.error(`Error searching chats for dumpster ${dumpsterName}:`, error);
      throw new Error('Error searching chats');
    }
  }

  /**
   * Get a specific chat with full content
   * @param {string} dumpsterName - Name of dumpster
   * @param {string} chatId - ID/filename of chat
   * @returns {Promise<Object>} Chat object with full content
   */
  async getChatWithContent(dumpsterName, chatId) {
    return await this.getChat(dumpsterName, chatId);
  }

  /**
   * Get chat count for a dumpster
   * @param {string} dumpsterName - Dumpster name
   * @returns {Promise<number>} Number of chats
   */
  async getChatCount(dumpsterName) {
    try {
      const chatsDir = FileUtils.joinPath(this.dumpstersDir, dumpsterName, 'chats');
      const files = await FileUtils.listDirectory(chatsDir);
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
      const items = await FileUtils.listDirectory(currentPath);

      for (const item of items) {
        const itemPath = FileUtils.joinPath(currentPath, item);
        const stats = await FileUtils.getStats(itemPath);

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
      await FileUtils.removeDirectories(this.tempDir);
      await FileUtils.ensureDirectory(this.tempDir);
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  }

  /**
   * Ensure required data directories exist
   */
  async ensureDataDirectories() {
    await FileUtils.ensureDirectory(this.dumpstersDir);
    await FileUtils.ensureDirectory(this.tempDir);
  }

  /**
   * Sanitize dumpster name for filesystem safety
   * @param {string} name - Dumpster name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizeDumpsterName(name) {
    return FileUtils.sanitizeName(name, { type: 'dumpster' });
  }

  /**
   * Creates a new dumpster from a ChatGPT export ZIP file
   * @param {Buffer|string} zipData - ZIP file buffer or path
   * @param {string} dumpsterName - Name for the dumpster
   * @param {boolean} isBuffer - True if zipData is buffer, false if path
   * @param {Function} onProgress - Progress callback function
   * @param {Object} options - Additional options
   * @param {string} options.zipPath - Original ZIP file path
   * @returns {Promise<Object>} Dumpster creation result
   */
  async createDumpster(
    zipData,
    dumpsterName,
    isBuffer = false,
    onProgress = null,
    options = {}
  ) {
    const { processDumpster } = require('./DumpsterProcessor.js');

    try {
      // Ensure data directories exist
      await this.ensureDataDirectories();

      // Process the export using the dumpster processor
      const result = await processDumpster(
        zipData,
        dumpsterName,
        this.baseDir,
        isBuffer,
        onProgress,
        {
          zipPath: options.zipPath,
        }
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
      const parsed = await FileUtils.readJsonFile(this.dumpstersFile);
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
      await FileUtils.writeJsonFile(this.dumpstersFile, [...this.dumpsters.entries()]);
    } catch (error) {
      console.error('Failed to save dumpsters:', error.message);
      throw error;
    }
  }
}

module.exports = { DumpsterManager };
