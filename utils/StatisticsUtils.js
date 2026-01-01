/**
 * StatisticsUtils.js - Centralized statistics calculation utilities
 * Provides consistent statistics calculation across services for bins, chats, and dumpsters
 */

/**
 * Utility class for calculating various statistics
 * Centralizes duplicated statistics logic from multiple services
 */
class StatisticsUtils {
  /**
   * Calculate comprehensive bin statistics
   * @param {BinManager} bm - Bin manager instance
   * @returns {Object} Bin statistics including totals and breakdowns
   */
  static calculateBinStatistics(bm) {
    const bins = bm.listBins();
    const activeBinName = bm.getActiveBinName();

    let totalChats = 0;
    let totalMessages = 0;
    let totalDumpsters = 0;
    let activeCount = 0;
    const binDetails = [];

    for (const bin of bins) {
      const chatsByDumpster = bm.getBinChatsByDumpster(bin.name);
      const binChatCount = Object.values(chatsByDumpster).flat().length;
      const binDumpsterCount = Object.keys(chatsByDumpster).length;

      // Count messages (assuming chat objects have messageCount property)
      let binMessageCount = 0;
      for (const dumpsterChats of Object.values(chatsByDumpster)) {
        binMessageCount += dumpsterChats.reduce(
          (sum, chat) => sum + (chat.messageCount || 0),
          0
        );
      }

      totalChats += binChatCount;
      totalMessages += binMessageCount;
      totalDumpsters += binDumpsterCount;

      if (bin.name === activeBinName) {
        activeCount = binChatCount;
      }

      binDetails.push({
        name: bin.name,
        description: bin.description,
        chatCount: binChatCount,
        messageCount: binMessageCount,
        dumpsterCount: binDumpsterCount,
        isActive: bin.name === activeBinName,
      });
    }

    return {
      totalBins: bins.length,
      totalChats,
      totalMessages,
      totalDumpsters,
      activeBinName,
      activeChatCount: activeCount,
      binDetails,
      summary: {
        chatsPerBin: bins.length > 0 ? Math.round(totalChats / bins.length) : 0,
        messagesPerChat: totalChats > 0 ? Math.round(totalMessages / totalChats) : 0,
        dumpstersPerBin: bins.length > 0 ? Math.round(totalDumpsters / bins.length) : 0,
      },
    };
  }

  /**
   * Calculate selection bin status for upcycle operations
   * @param {BinManager} bm - Bin manager instance
   * @returns {Object} Selection bin status information
   */
  static calculateSelectionBinStatus(bm) {
    const chatsByDumpster = bm.getActiveBinChatsByDumpster();
    const allChats = Object.values(chatsByDumpster).flat();
    const totalCount = allChats.length;

    if (totalCount === 0) {
      return {
        hasContent: false,
        totalCount: 0,
        dumpsterCount: 0,
        messageCount: 0,
        dumpsters: [],
      };
    }

    const dumpsters = [];
    let totalMessages = 0;

    for (const [dumpsterName, dumpsterChats] of Object.entries(chatsByDumpster)) {
      const chatCount = dumpsterChats.length;
      const messageCount = dumpsterChats.reduce(
        (sum, chat) => sum + (chat.messageCount || 0),
        0
      );

      totalMessages += messageCount;
      dumpsters.push({
        name: dumpsterName,
        chatCount,
        messageCount,
        percentage: Math.round((chatCount / totalCount) * 100),
      });
    }

    return {
      hasContent: true,
      totalCount,
      dumpsterCount: dumpsters.length,
      totalMessages,
      dumpsters,
      averageMessagesPerChat: Math.round(totalMessages / totalCount),
      averageChatsPerDumpster: Math.round(totalCount / dumpsters.length),
    };
  }

  /**
   * Calculate dumpster statistics
   * @param {DumpsterManager} dumpsterManager - Dumpster manager instance
   * @returns {Object} Dumpster statistics
   */
  static calculateDumpsterStatistics(dumpsterManager) {
    const dumpsters = dumpsterManager.listDumpsters();

    const totalDumpsters = dumpsters.length;
    let totalChats = 0;
    let totalMessages = 0;
    let totalSize = 0;

    for (const dumpster of dumpsters) {
      totalChats += dumpster.chatCount || 0;
      totalMessages += dumpster.messageCount || 0;
      totalSize += dumpster.size || 0;
    }

    return {
      totalDumpsters,
      totalChats,
      totalMessages,
      totalSize,
      averageChatsPerDumpster:
        totalDumpsters > 0 ? Math.round(totalChats / totalDumpsters) : 0,
      averageMessagesPerChat:
        totalChats > 0 ? Math.round(totalMessages / totalChats) : 0,
      averageSizePerDumpster:
        totalDumpsters > 0 ? Math.round(totalSize / totalDumpsters) : 0,
    };
  }

  /**
   * Calculate comprehensive system statistics
   * @param {BinManager} bm - Bin manager instance
   * @param {DumpsterManager} dumpsterManager - Dumpster manager instance
   * @returns {Object} Complete system statistics
   */
  static calculateSystemStatistics(bm, dumpsterManager) {
    const binStats = this.calculateBinStatistics(bm);
    const dumpsterStats = this.calculateDumpsterStatistics(dumpsterManager);

    return {
      bins: binStats,
      dumpsters: dumpsterStats,
      overall: {
        totalStorageBins: binStats.totalBins,
        totalDataDumpsters: dumpsterStats.totalDumpsters,
        totalSelectedChats: binStats.totalChats,
        totalAvailableChats: dumpsterStats.totalChats,
        selectionRate:
          dumpsterStats.totalChats > 0
            ? Math.round((binStats.totalChats / dumpsterStats.totalChats) * 100)
            : 0,
      },
    };
  }

  /**
   * Format statistics for display
   * @param {Object} stats - Statistics object
   * @param {string} type - Type of statistics ('bin', 'dumpster', 'system')
   * @returns {Array} Array of formatted statistic lines
   */
  static formatStatisticsForDisplay(stats, type = 'bin') {
    switch (type) {
      case 'bin':
        return [
          `📊 Total bins: ${stats.totalBins}`,
          `💬 Total chats: ${stats.totalChats}`,
          `📝 Total messages: ${stats.totalMessages}`,
          `🗃️ Total dumpsters: ${stats.totalDumpsters}`,
          `⭐ Active bin: ${stats.activeBinName} (${stats.activeChatCount} chats)`,
          `📈 Average: ${stats.summary.chatsPerBin} chats/bin, ${stats.summary.messagesPerChat} messages/chat`,
        ];

      case 'dumpster':
        return [
          `🗃️ Total dumpsters: ${stats.totalDumpsters}`,
          `💬 Total chats: ${stats.totalChats}`,
          `📝 Total messages: ${stats.totalMessages}`,
          `💾 Total size: ${stats.totalSize}`,
          `📈 Average: ${stats.averageChatsPerDumpster} chats/dumpster, ${stats.averageMessagesPerChat} messages/chat`,
        ];

      case 'system':
        return [
          `🗂️ Storage bins: ${stats.bins.totalBins}`,
          `🗃️ Data dumpsters: ${stats.dumpsters.totalDumpsters}`,
          `💬 Selected chats: ${stats.bins.totalChats} (${stats.overall.selectionRate}% selection rate)`,
          `📝 Available chats: ${stats.dumpsters.totalChats}`,
        ];

      default:
        return ['Unknown statistics type'];
    }
  }
}

module.exports = {
  StatisticsUtils,
};
