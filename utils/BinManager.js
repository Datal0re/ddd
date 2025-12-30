/**
 * Bin Manager
 * Manages multiple selection bins for organizing selected chats
 * Provides clean multi-bin functionality with proper metadata storage
 */

const FileUtils = require('./FileUtils');
const { ErrorHandler } = require('./ErrorHandler');
const chalk = require('chalk');

class BinManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.binsFile = FileUtils.joinPath(baseDir, 'data', 'bins.json');
    this.bins = new Map();
    this.activeBinName = 'default';
  }

  /**
   * Initialize the bin manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.loadBins();

      // Ensure default bin exists
      if (!this.bins.has('default')) {
        await this.createBin('default', 'Default selection bin');
      }

      // Ensure active bin is valid
      if (!this.bins.has(this.activeBinName)) {
        this.activeBinName = 'default';
      }

      ErrorHandler.logInfo(
        `Bin manager initialized with ${this.bins.size} bins`,
        'BinManager'
      );
    } catch (error) {
      ErrorHandler.handleFileError(error, 'initializing bin manager', false);
      // Start with empty bins if loading fails
      this.bins = new Map();
      await this.createBin('default', 'Default selection bin');
    }
  }

  /**
   * Load all bins from disk
   * @returns {Promise<void>}
   */
  async loadBins() {
    try {
      if (!(await FileUtils.fileExists(this.binsFile))) {
        this.bins = new Map();
        return;
      }

      const data = await FileUtils.readJsonFile(this.binsFile);

      if (!Array.isArray(data)) {
        ErrorHandler.logWarning('Invalid bins.json format, starting with empty bins');
        this.bins = new Map();
        return;
      }

      this.bins = new Map(
        data.map(([name, info]) => [
          name,
          {
            ...info,
            createdAt: new Date(info.createdAt),
            lastModified: new Date(info.lastModified),
          },
        ])
      );
    } catch (error) {
      ErrorHandler.handleFileError(error, 'loading bins', false);
      this.bins = new Map();
    }
  }

  /**
   * Save all bins to disk
   * @returns {Promise<void>}
   */
  async saveBins() {
    try {
      // Ensure data directory exists
      await FileUtils.ensureDirectory(FileUtils.getDirName(this.binsFile));

      // Convert to array format for serialization
      const binsArray = [...this.bins.entries()];
      await FileUtils.writeJsonFile(this.binsFile, binsArray);
    } catch (error) {
      ErrorHandler.handleFileError(error, 'saving bins', true);
    }
  }

  /**
   * Create a new empty bin structure
   * @param {string} description - Optional description for the bin
   * @returns {Object} Empty bin structure
   */
  createEmptyBinStructure(description = '') {
    return {
      version: '0.0.5',
      createdAt: new Date(),
      lastModified: new Date(),
      description: description,
      items: [],
    };
  }

  /**
   * Create a new bin
   * @param {string} binName - Name for the new bin
   * @param {string} description - Optional description for the bin
   * @returns {Promise<boolean>} True if created successfully
   */
  async createBin(binName, description = '') {
    if (!binName || typeof binName !== 'string') {
      ErrorHandler.handleValidationError(
        'Bin name must be a non-empty string',
        'createBin'
      );
    }

    const sanitizedName = this.sanitizeBinName(binName);

    if (this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" already exists`,
        'createBin'
      );
    }

    try {
      const newBin = this.createEmptyBinStructure(description);
      this.bins.set(sanitizedName, newBin);
      await this.saveBins();

      ErrorHandler.logSuccess(`Created bin "${sanitizedName}"`, 'BinManager');
      return true;
    } catch (error) {
      ErrorHandler.handleAsyncError(error, 'creating bin', null, true);
    }
  }

  /**
   * Delete a bin
   * @param {string} binName - Name of bin to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteBin(binName) {
    const sanitizedName = this.sanitizeBinName(binName);

    if (!this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" not found`,
        'deleteBin'
      );
    }

    if (sanitizedName === 'default') {
      ErrorHandler.handleValidationError('Cannot delete the default bin', 'deleteBin');
    }

    try {
      this.bins.delete(sanitizedName);

      // Switch to default bin if deleting the active bin
      if (this.activeBinName === sanitizedName) {
        this.activeBinName = 'default';
      }

      await this.saveBins();
      ErrorHandler.logSuccess(`Deleted bin "${sanitizedName}"`, 'BinManager');
      return true;
    } catch (error) {
      ErrorHandler.handleAsyncError(error, 'deleting bin', null, true);
    }
  }

  /**
   * Rename a bin
   * @param {string} oldName - Current bin name
   * @param {string} newName - New bin name
   * @returns {Promise<boolean>} True if renamed successfully
   */
  async renameBin(oldName, newName) {
    const sanitizedOldName = this.sanitizeBinName(oldName);
    const sanitizedNewName = this.sanitizeBinName(newName);

    if (!this.bins.has(sanitizedOldName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedOldName}" not found`,
        'renameBin'
      );
    }

    if (this.bins.has(sanitizedNewName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedNewName}" already exists`,
        'renameBin'
      );
    }

    if (!newName || typeof newName !== 'string') {
      ErrorHandler.handleValidationError(
        'New bin name must be a non-empty string',
        'renameBin'
      );
    }

    try {
      const binData = this.bins.get(sanitizedOldName);
      binData.lastModified = new Date();

      this.bins.delete(sanitizedOldName);
      this.bins.set(sanitizedNewName, binData);

      // Update active bin if it was renamed
      if (this.activeBinName === sanitizedOldName) {
        this.activeBinName = sanitizedNewName;
      }

      await this.saveBins();
      ErrorHandler.logSuccess(
        `Renamed bin "${sanitizedOldName}" to "${sanitizedNewName}"`,
        'BinManager'
      );
      return true;
    } catch (error) {
      ErrorHandler.handleAsyncError(error, 'renaming bin', null, true);
    }
  }

  /**
   * Set the active bin
   * @param {string} binName - Name of bin to set as active
   * @returns {Promise<boolean>} True if set successfully
   */
  async setActiveBin(binName) {
    const sanitizedName = this.sanitizeBinName(binName);

    if (!this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" not found`,
        'setActiveBin'
      );
    }

    this.activeBinName = sanitizedName;
    ErrorHandler.logSuccess(`Set active bin to "${sanitizedName}"`, 'BinManager');
    return true;
  }

  /**
   * Get a list of all bins with metadata
   * @returns {Array<Object>} Array of bin information objects
   */
  listBins() {
    return Array.from(this.bins.entries()).map(([name, info]) => ({
      name,
      description: info.description || '',
      chatCount: info.items ? info.items.length : 0,
      createdAt: info.createdAt,
      lastModified: info.lastModified,
      isActive: name === this.activeBinName,
    }));
  }

  /**
   * Get a specific bin's data
   * @param {string} binName - Name of bin to retrieve
   * @returns {Object|null} Bin data or null if not found
   */
  getBin(binName) {
    const sanitizedName = this.sanitizeBinName(binName);
    return this.bins.get(sanitizedName) || null;
  }

  /**
   * Get the active bin's data
   * @returns {Object} Active bin data
   */
  getActiveBin() {
    const activeBin = this.bins.get(this.activeBinName);
    if (!activeBin) {
      // Fallback to default bin if active bin is missing
      this.activeBinName = 'default';
      return this.bins.get('default') || this.createEmptyBinStructure();
    }
    return activeBin;
  }

  /**
   * Get the name of the active bin
   * @returns {string} Active bin name
   */
  getActiveBinName() {
    return this.activeBinName;
  }

  /**
   * Add chats to the active bin
   * @param {Array} chats - Array of chat objects
   * @param {string} sourceDumpster - Source dumpster name
   * @param {Object} searchResult - Optional search result metadata
   * @returns {Promise<number>} Number of chats added
   */
  async addChatsToActiveBin(chats, sourceDumpster, searchResult = null) {
    const activeBin = this.getActiveBin();
    let addedCount = 0;

    if (!activeBin.items) {
      activeBin.items = [];
    }

    for (const chat of chats) {
      // Check if chat already exists in the bin
      const exists = activeBin.items.some(
        item =>
          item.chatId === (chat.chatId || chat.filename) &&
          item.sourceDumpster === sourceDumpster
      );

      if (!exists) {
        const selectionItem = {
          chatId: chat.chatId || chat.filename,
          filename: chat.filename,
          title: chat.title || 'Untitled Chat',
          sourceDumpster,
          addedAt: new Date(),
          metadata: {
            messageCount: this.countMessages(chat),
            createTime: chat.create_time || chat.created_time,
            updateTime: chat.update_time || chat.updated_time,
            preview: this.generateChatPreview(chat),
            ...(searchResult && {
              searchQuery: searchResult.query,
              relevanceScore: searchResult.relevanceScore,
              matchCount: searchResult.matchCount,
            }),
          },
        };

        activeBin.items.push(selectionItem);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      activeBin.lastModified = new Date();
      await this.saveBins();
    }

    return addedCount;
  }

  /**
   * Remove chats from the active bin
   * @param {Array} chatIds - Array of chat IDs to remove
   * @returns {Promise<number>} Number of chats removed
   */
  async removeChatsFromActiveBin(chatIds) {
    const activeBin = this.getActiveBin();
    const originalCount = activeBin.items ? activeBin.items.length : 0;

    if (!activeBin.items) {
      return 0;
    }

    activeBin.items = activeBin.items.filter(item => !chatIds.includes(item.chatId));

    const removedCount = originalCount - activeBin.items.length;

    if (removedCount > 0) {
      activeBin.lastModified = new Date();
      await this.saveBins();
    }

    return removedCount;
  }

  /**
   * Clear all chats from the active bin
   * @returns {Promise<void>}
   */
  async clearActiveBin() {
    const activeBin = this.getActiveBin();
    activeBin.items = [];
    activeBin.lastModified = new Date();
    await this.saveBins();
  }

  /**
   * Get statistics for the active bin
   * @returns {Object} Statistics object
   */
  getActiveBinStats() {
    const activeBin = this.getActiveBin();
    const stats = {
      totalCount: activeBin.items ? activeBin.items.length : 0,
      byDumpster: {},
      totalMessages: 0,
    };

    if (activeBin.items) {
      for (const item of activeBin.items) {
        // Count by dumpster
        if (!stats.byDumpster[item.sourceDumpster]) {
          stats.byDumpster[item.sourceDumpster] = 0;
        }
        stats.byDumpster[item.sourceDumpster]++;

        // Count total messages
        if (item.metadata && item.metadata.messageCount) {
          stats.totalMessages += item.metadata.messageCount;
        }
      }
    }

    return stats;
  }

  /**
   * Get chats from the active bin grouped by dumpster
   * @returns {Object} Chats grouped by dumpster name
   */
  getActiveBinChatsByDumpster() {
    const activeBin = this.getActiveBin();
    const chatsByDumpster = {};

    if (activeBin.items) {
      for (const item of activeBin.items) {
        if (!chatsByDumpster[item.sourceDumpster]) {
          chatsByDumpster[item.sourceDumpster] = [];
        }

        chatsByDumpster[item.sourceDumpster].push({
          filename: item.filename,
          title: item.title,
          chatId: item.chatId,
          addedAt: item.addedAt,
          metadata: item.metadata,
        });
      }
    }

    return chatsByDumpster;
  }

  /**
   * Check if the active bin is empty
   * @returns {boolean} True if empty
   */
  is_activeBinEmpty() {
    const stats = this.getActiveBinStats();
    return stats.totalCount === 0;
  }

  /**
   * Get total number of chats in the active bin
   * @returns {number} Total count
   */
  getActiveBinCount() {
    const stats = this.getActiveBinStats();
    return stats.totalCount;
  }

  /**
   * Sanitize bin name for filesystem safety
   * @param {string} name - Bin name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizeBinName(name) {
    if (!name || typeof name !== 'string') {
      return 'unnamed';
    }

    // Remove invalid characters and replace spaces with underscores
    return name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 50);
  }

  /**
   * Count messages in a chat object
   * @param {Object} chat - Chat object
   * @returns {number} Message count
   */
  countMessages(chat) {
    if (!chat.mapping) {
      return 0;
    }

    let messageCount = 0;

    const traverseMessages = node => {
      if (node && node.message && node.message.content) {
        messageCount++;
      }

      if (node && node.children) {
        for (const childId of node.children) {
          if (typeof chat.mapping[childId] !== 'undefined') {
            traverseMessages(chat.mapping[childId]);
          }
        }
      }
    };

    Object.values(chat.mapping).forEach(node => {
      if (node && !node.parent) {
        traverseMessages(node);
      }
    });

    return messageCount;
  }

  /**
   * Generate a preview of the chat content
   * @param {Object} chat - Chat object
   * @returns {string} Preview text
   */
  generateChatPreview(chat) {
    if (!chat.mapping) {
      return chat.title || 'Untitled chat';
    }

    // Find first message with content
    for (const node of Object.values(chat.mapping)) {
      if (node && node.message && node.message.content) {
        let content = '';

        if (typeof node.message.content === 'string') {
          content = node.message.content;
        } else if (Array.isArray(node.message.content)) {
          content = node.message.content
            .filter(part => part.text)
            .map(part => part.text)
            .join(' ');
        }

        if (content && content.trim() !== '') {
          const preview = content.trim();
          if (preview.length > 100) {
            return preview.substring(0, 100) + '...';
          }
          return preview;
        }
      }
    }

    return chat.title || 'Untitled chat';
  }

  /**
   * Get a formatted summary of the active bin
   * @returns {string} Formatted summary
   */
  getActiveBinSummary() {
    const stats = this.getActiveBinStats();
    const activeBin = this.getActiveBin();

    if (stats.totalCount === 0) {
      return chalk.gray(`Active bin "${this.activeBinName}" is empty`);
    }

    let summary = chalk.blue(
      `📋 Bin "${this.activeBinName}" (${stats.totalCount} chats):\n`
    );

    // Show description if available
    if (activeBin.description) {
      summary += chalk.dim(`  "${activeBin.description}"\n`);
    }

    // Show breakdown by dumpster
    for (const [dumpster, count] of Object.entries(stats.byDumpster)) {
      summary += `  • ${chalk.green(dumpster)}: ${count} chat${count !== 1 ? 's' : ''}\n`;
    }

    // Show total message count if available
    if (stats.totalMessages > 0) {
      summary += `  📊 Total messages: ${stats.totalMessages}\n`;
    }

    // Show recent additions
    if (activeBin.items && activeBin.items.length > 0) {
      const recentItems = activeBin.items
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        .slice(0, 3);

      if (recentItems.length > 0) {
        summary += chalk.dim('\nRecently added:\n');
        for (const item of recentItems) {
          const addedTime = new Date(item.addedAt).toLocaleDateString();
          summary += chalk.dim(`  • ${item.title} (${addedTime})\n`);
        }
      }
    }

    return summary.trim();
  }
}

module.exports = { BinManager };
