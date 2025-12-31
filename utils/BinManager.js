/**
 * Bin Manager
 * Manages multiple selection bins for organizing selected chats
 * Provides clean multi-bin functionality with proper metadata storage
 */

const FileUtils = require('./FileUtils');
const { ErrorHandler } = require('./ErrorHandler');
const chalk = require('chalk');
const { VERSION } = require('../config/constants');

class BinManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.binsFile = FileUtils.joinPath(baseDir, 'data', 'bins.json');
    this.bins = new Map();
    this.stagingBinName = 'staging';
    this.activeBinName = 'staging';
  }

  /**
   * Initialize the bin manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.loadBins();

      // Ensure staging bin exists
      if (!this.bins.has(this.stagingBinName)) {
        await this.createBin(
          this.stagingBinName,
          'Temporary storage for chat selections'
        );
      }

      // Ensure active bin is valid
      if (!this.bins.has(this.activeBinName)) {
        ErrorHandler.logError(
          `Bin ${this.activeBinName} not found. Switching to ${this.stagingBinName} instead`,
          'BinManager'
        );
        this.activeBinName = this.stagingBinName;
      }

      ErrorHandler.logInfo(
        `Bin manager initialized with ${this.bins.size} bins`,
        'BinManager'
      );
    } catch (fileError) {
      ErrorHandler.logError(`Failed to initialize bin manager: ${fileError}`);
      // Start with empty bins if loading fails
      this.bins = new Map();
      await this.createBin(
        this.stagingBinName,
        'Temporary storage for chat selections'
      );
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
    } catch (fileError) {
      ErrorHandler.logError('Failed to load bins');
      console.error(fileError); // Use error for eslint
      this.bins = new Map();
    }
  }

  /**
   * Save all bins to disk
   * @returns {Promise<void>}
   */
  async saveBins() {
    // Ensure data directory exists
    await FileUtils.ensureDirectory(FileUtils.getDirName(this.binsFile));

    // Convert to array format for serialization
    const binsArray = [...this.bins.entries()];
    await FileUtils.writeJsonFile(this.binsFile, binsArray);
  }

  /**
   * Migrate default bin to staging bin if needed
   * @returns {Promise<void>}
   */
  async migrateDefaultToStaging() {
    if (this._shouldMigrateDefaultToStaging()) {
      await this._performMigration();
    } else if (this.bins.has(this.stagingBinName)) {
      await this._cleanupLegacyDefaultBin();
    }
  }

  /**
   * Check if migration from default to staging is needed
   * @private
   * @returns {boolean} True if migration should occur
   */
  _shouldMigrateDefaultToStaging() {
    return this.bins.has('default') && !this.bins.has(this.stagingBinName);
  }

  /**
   * Perform migration from default bin to staging bin
   * @private
   * @returns {Promise<void>}
   */
  async _performMigration() {
    const defaultBin = this.bins.get('default');

    // Create staging bin with migrated data
    const stagingBin = {
      ...defaultBin,
      description: 'Temporary storage for chat selections (migrated from default)',
      lastModified: new Date(),
    };

    this.bins.set(this.stagingBinName, stagingBin);
    this.bins.delete('default');

    // Update active bin if it was default
    if (this.activeBinName === 'default') {
      this.activeBinName = this.stagingBinName;
    }

    ErrorHandler.logInfo('Migrated "default" bin to "staging" bin', 'BinManager');

    // Save the migration
    await this.saveBins();
  }

  /**
   * Remove legacy default bin if staging bin already exists
   * @private
   * @returns {Promise<void>}
   */
  async _cleanupLegacyDefaultBin() {
    if (this.bins.has('default')) {
      this.bins.delete('default');

      // Update active bin if it was default
      if (this.activeBinName === 'default') {
        this.activeBinName = this.stagingBinName;
      }

      await this.saveBins();
      ErrorHandler.logInfo(
        'Removed legacy "default" bin, using "staging" bin',
        'BinManager'
      );
    }
  }

  /**
   * Create a new empty bin structure
   * @param {string} description - Optional description for the bin
   * @returns {Object} Empty bin structure
   */
  createEmptyBinStructure(description = '') {
    return {
      version: VERSION,
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
      return false;
    }

    const sanitizedName = this.sanitizeBinName(binName);

    if (this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" already exists`,
        'createBin'
      );
      return false;
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
    if (!binName || typeof binName !== 'string') {
      ErrorHandler.handleValidationError(
        'Bin name must be a non-empty string',
        'deleteBin'
      );
      return false;
    }

    const sanitizedName = this.sanitizeBinName(binName);

    if (!this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" not found`,
        'deleteBin'
      );
      return false;
    }

    if (sanitizedName === this.stagingBinName) {
      ErrorHandler.handleValidationError('Cannot delete staging bin', 'deleteBin');
      return false;
    }

    try {
      this.bins.delete(sanitizedName);

      // Switch to staging bin if deleting the active bin
      if (this.activeBinName === sanitizedName) {
        this.activeBinName = this.stagingBinName;
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
    if (!oldName || typeof oldName !== 'string') {
      ErrorHandler.handleValidationError(
        'Old bin name must be a non-empty string',
        'renameBin'
      );
      return false;
    }

    if (!newName || typeof newName !== 'string') {
      ErrorHandler.handleValidationError(
        'New bin name must be a non-empty string',
        'renameBin'
      );
      return false;
    }

    const sanitizedOldName = this.sanitizeBinName(oldName);
    const sanitizedNewName = this.sanitizeBinName(newName);

    if (!this.bins.has(sanitizedOldName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedOldName}" not found`,
        'renameBin'
      );
      return false;
    }

    if (this.bins.has(sanitizedNewName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedNewName}" already exists`,
        'renameBin'
      );
      return false;
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
    if (!binName || typeof binName !== 'string') {
      ErrorHandler.handleValidationError(
        'Bin name must be a non-empty string',
        'setActiveBin'
      );
      return false;
    }

    const sanitizedName = this.sanitizeBinName(binName);

    if (!this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" not found`,
        'setActiveBin'
      );
      return false;
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
      // Fallback to staging bin if active bin is missing
      this.activeBinName = this.stagingBinName;
      return this.bins.get(this.stagingBinName) || this.createEmptyBinStructure();
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
    return this._addChatsToBinInternal(chats, sourceDumpster, activeBin, searchResult);
  }

  /**
   * Add chats to a specific bin
   * @param {Array} chats - Array of chat objects
   * @param {string} binName - Name of bin to add chats to
   * @param {string} sourceDumpster - Source dumpster name
   * @param {Object} searchResult - Optional search result metadata
   * @returns {Promise<number>} Number of chats added
   */
  async addChatsToBin(chats, binName, sourceDumpster, searchResult = null) {
    const sanitizedName = this.sanitizeBinName(binName);

    if (!this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" not found`,
        'addChatsToBin'
      );
    }

    const bin = this.bins.get(sanitizedName);
    return this._addChatsToBinInternal(chats, sourceDumpster, bin, searchResult);
  }

  /**
   * Internal method to add chats to a bin (shared logic)
   * @private
   * @param {Array} chats - Array of chat objects
   * @param {string} sourceDumpster - Source dumpster name
   * @param {Object} bin - Target bin object
   * @param {Object} searchResult - Optional search result metadata
   * @returns {Promise<number>} Number of chats added
   */
  async _addChatsToBinInternal(chats, sourceDumpster, bin, searchResult = null) {
    let addedCount = 0;

    if (!bin.items) {
      bin.items = [];
    }

    for (const chat of chats) {
      // Check if chat already exists in the bin
      const exists = bin.items.some(
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

        bin.items.push(selectionItem);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      bin.lastModified = new Date();
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
   * Get chats from a specific bin grouped by dumpster
   * @param {string} binName - Name of bin to get chats from
   * @returns {Object} Chats grouped by dumpster name
   */
  getBinChatsByDumpster(binName) {
    const sanitizedName = this.sanitizeBinName(binName);

    if (!this.bins.has(sanitizedName)) {
      ErrorHandler.handleValidationError(
        `Bin "${sanitizedName}" not found`,
        'getBinChatsByDumpster'
      );
    }

    const bin = this.bins.get(sanitizedName);
    const chatsByDumpster = {};

    if (bin.items) {
      for (const item of bin.items) {
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
  isActiveBinEmpty() {
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

  /**
   * Check if a bin is the staging bin
   * @param {string} binName - Name of bin to check
   * @returns {boolean} True if bin is staging bin
   */
  isStagingBin(binName) {
    const sanitizedName = this.sanitizeBinName(binName);
    return sanitizedName === this.stagingBinName;
  }

  /**
   * Move all chats from staging to another bin
   * @param {string} targetBinName - Name of target bin
   * @returns {Promise<number>} Number of chats moved
   */
  async moveFromStaging(targetBinName) {
    // Input validation
    if (!targetBinName || typeof targetBinName !== 'string') {
      ErrorHandler.handleValidationError(
        'Target bin name must be a non-empty string',
        'moveFromStaging'
      );
      return 0;
    }

    const sanitizedTargetName = this.sanitizeBinName(targetBinName);

    if (!this.bins.has(sanitizedTargetName)) {
      ErrorHandler.handleValidationError(
        `Target bin "${sanitizedTargetName}" not found`,
        'moveFromStaging'
      );
      return 0;
    }

    // Cannot move to staging bin itself
    if (sanitizedTargetName === this.stagingBinName) {
      ErrorHandler.handleValidationError(
        'Cannot move chats from staging to staging bin',
        'moveFromStaging'
      );
      return 0;
    }

    const stagingBin = this.bins.get(this.stagingBinName);
    const targetBin = this.bins.get(sanitizedTargetName);

    if (!stagingBin.items || stagingBin.items.length === 0) {
      ErrorHandler.logInfo('Staging bin is empty, nothing to move', 'BinManager');
      return 0;
    }

    // Initialize target bin items if needed
    if (!targetBin.items) {
      targetBin.items = [];
    }

    // Move all items from staging to target
    const itemsToMove = [...stagingBin.items];
    let movedCount = 0;

    for (const item of itemsToMove) {
      // Check if item already exists in target
      const exists = targetBin.items.some(
        targetItem =>
          targetItem.chatId === item.chatId &&
          targetItem.sourceDumpster === item.sourceDumpster
      );

      if (!exists) {
        targetBin.items.push({
          ...item,
          addedAt: new Date(), // Update added timestamp for new location
        });
        movedCount++;
      }
    }

    // Clear staging bin after successful move
    if (movedCount > 0) {
      stagingBin.items = [];
      stagingBin.lastModified = new Date();
      targetBin.lastModified = new Date();

      await this.saveBins();
      ErrorHandler.logSuccess(
        `Moved ${movedCount} chat${movedCount !== 1 ? 's' : ''} from staging to "${sanitizedTargetName}"`,
        'BinManager'
      );
    }

    return movedCount;
  }

  /**
   * Clear the staging bin
   * @returns {Promise<number>} Number of chats cleared
   */
  async clearStaging() {
    const stagingBin = this.bins.get(this.stagingBinName);

    if (!stagingBin.items || stagingBin.items.length === 0) {
      ErrorHandler.logInfo('Staging bin is already empty', 'BinManager');
      return 0;
    }

    const clearedCount = stagingBin.items.length;
    stagingBin.items = [];
    stagingBin.lastModified = new Date();

    await this.saveBins();
    ErrorHandler.logSuccess(
      `Cleared ${clearedCount} chat${clearedCount !== 1 ? 's' : ''} from staging bin`,
      'BinManager'
    );

    return clearedCount;
  }

  /**
   * Get staging bin information
   * @returns {Object} Staging bin info with chat count and metadata
   */
  getStagingBinInfo() {
    const stagingBin = this.bins.get(this.stagingBinName);

    if (!stagingBin) {
      return {
        name: this.stagingBinName,
        exists: false,
        chatCount: 0,
        isStaging: true,
      };
    }

    return {
      name: this.stagingBinName,
      exists: true,
      chatCount: stagingBin.items ? stagingBin.items.length : 0,
      description: stagingBin.description || '',
      createdAt: stagingBin.createdAt,
      lastModified: stagingBin.lastModified,
      isStaging: true,
      isActive: this.activeBinName === this.stagingBinName,
    };
  }
}

module.exports = { BinManager };
