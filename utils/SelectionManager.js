/**
 * Selection Manager
 * Manages the selection bin for storing selected chats across sessions
 */

const FileUtils = require('./FileUtils');
const { ErrorHandler } = require('./ErrorHandler');
const chalk = require('chalk');
const { UI_CONFIG } = require('../config/constants');

class SelectionManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.selectionBinFile = FileUtils.joinPath(baseDir, 'data', 'selection-bin.json');
  }

  /**
   * Load the current selection bin from disk
   * @returns {Promise<Object>} Selection bin data
   */
  async loadSelectionBin() {
    try {
      if (!(await FileUtils.fileExists(this.selectionBinFile))) {
        return this.createEmptySelectionBin();
      }

      const selectionData = await FileUtils.readJsonFile(this.selectionBinFile);

      // Validate and migrate if needed
      return this.validateSelectionBin(selectionData);
    } catch (error) {
      ErrorHandler.logWarning(
        `Failed to load selection bin: ${error.message}`,
        'SelectionManager'
      );
      return this.createEmptySelectionBin();
    }
  }

  /**
   * Create an empty selection bin structure
   * @returns {Object} Empty selection bin
   */
  createEmptySelectionBin() {
    return {
      version: '1.0.0',
      createdAt: Date.now(),
      lastModified: Date.now(),
      items: [],
    };
  }

  /**
   * Validate and migrate selection bin data
   * @param {Object} data - Raw selection bin data
   * @returns {Object} Validated selection bin
   */
  validateSelectionBin(data) {
    const selectionBin = {
      version: data.version || '1.0.0',
      createdAt: data.createdAt || Date.now(),
      lastModified: Date.now(),
      items: [],
    };

    if (Array.isArray(data.items)) {
      selectionBin.items = data.items.filter(
        item => item && item.chatId && item.filename && item.sourceDumpster
      );
    }

    return selectionBin;
  }

  /**
   * Save the selection bin to disk
   * @param {Object} selectionBin - Selection bin data to save
   * @returns {Promise<void>}
   */
  async saveSelectionBin(selectionBin) {
    try {
      // Ensure the data directory exists
      await FileUtils.ensureDirectory(FileUtils.getDirName(this.selectionBinFile));

      // Update last modified timestamp
      selectionBin.lastModified = Date.now();

      await FileUtils.writeJsonFile(this.selectionBinFile, selectionBin);
    } catch (error) {
      ErrorHandler.logError(
        `Failed to save selection bin: ${error.message}`,
        'SelectionManager'
      );
      throw error;
    }
  }

  /**
   * Add chats to the selection bin
   * @param {Array} chats - Array of chat objects with search results
   * @param {string} sourceDumpster - Name of the source dumpster
   * @param {Object} searchResult - Search result data (optional)
   * @returns {Promise<number>} Number of chats added
   */
  async addChats(chats, sourceDumpster, searchResult = null) {
    const selectionBin = await this.loadSelectionBin();
    let addedCount = 0;

    for (const chat of chats) {
      // Check if chat already exists in selection
      const exists = selectionBin.items.some(
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
          addedAt: Date.now(),
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

        selectionBin.items.push(selectionItem);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await this.saveSelectionBin(selectionBin);
    }

    return addedCount;
  }

  /**
   * Remove chats from the selection bin
   * @param {Array} chatIds - Array of chat IDs to remove
   * @returns {Promise<number>} Number of chats removed
   */
  async removeChats(chatIds) {
    const selectionBin = await this.loadSelectionBin();
    const originalCount = selectionBin.items.length;

    selectionBin.items = selectionBin.items.filter(
      item => !chatIds.includes(item.chatId)
    );

    const removedCount = originalCount - selectionBin.items.length;

    if (removedCount > 0) {
      await this.saveSelectionBin(selectionBin);
    }

    return removedCount;
  }

  /**
   * Clear all selections
   * @returns {Promise<void>}
   */
  async clearSelection() {
    const selectionBin = this.createEmptySelectionBin();
    await this.saveSelectionBin(selectionBin);
  }

  /**
   * Get selection statistics
   * @returns {Promise<Object>} Selection statistics
   */
  async getSelectionStats() {
    const selectionBin = await this.loadSelectionBin();

    const stats = {
      totalCount: selectionBin.items.length,
      byDumpster: {},
      totalMessages: 0,
    };

    for (const item of selectionBin.items) {
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

    return stats;
  }

  /**
   * Get a formatted summary of the selection bin
   * @returns {Promise<string>} Formatted summary
   */
  async getSelectionSummary() {
    const stats = await this.getSelectionStats();
    const selectionBin = await this.loadSelectionBin();

    if (stats.totalCount === 0) {
      return chalk.gray('Selection bin is empty');
    }

    let summary = chalk.blue(`📋 Selection Bin (${stats.totalCount} chats):\n`);

    // Show breakdown by dumpster
    for (const [dumpster, count] of Object.entries(stats.byDumpster)) {
      summary += `  • ${chalk.green(dumpster)}: ${count} chat${count !== 1 ? 's' : ''}\n`;
    }

    // Show total message count if available
    if (stats.totalMessages > 0) {
      summary += `  📊 Total messages: ${stats.totalMessages}\n`;
    }

    // Show recent additions
    const recentItems = selectionBin.items
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 3);

    if (recentItems.length > 0) {
      summary += chalk.dim('\nRecently added:\n');
      for (const item of recentItems) {
        const addedTime = new Date(item.addedAt).toLocaleDateString();
        summary += chalk.dim(`  • ${item.title} (${addedTime})\n`);
      }
    }

    return summary.trim();
  }

  /**
   * Get selected chats grouped by dumpster for upcycling
   * @returns {Promise<Object>} Chats grouped by dumpster name
   */
  async getChatsByDumpster() {
    const selectionBin = await this.loadSelectionBin();
    const chatsByDumpster = {};

    for (const item of selectionBin.items) {
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

    return chatsByDumpster;
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
          if (preview.length > UI_CONFIG.MESSAGE_PREVIEW_LENGTH) {
            return preview.substring(0, UI_CONFIG.MESSAGE_PREVIEW_LENGTH) + '...';
          }
          return preview;
        }
      }
    }

    return chat.title || 'Untitled chat';
  }

  /**
   * Check if selection bin is empty
   * @returns {Promise<boolean>} True if empty
   */
  async isEmpty() {
    const stats = await this.getSelectionStats();
    return stats.totalCount === 0;
  }

  /**
   * Get total number of selected chats
   * @returns {Promise<number>} Total count
   */
  async getSelectionCount() {
    const stats = await this.getSelectionStats();
    return stats.totalCount;
  }
}

module.exports = { SelectionManager };
