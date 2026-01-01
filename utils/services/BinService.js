/**
 * Bin Service
 * Extracted business logic for bin management
 * Handles bin creation, deletion, listing, and operations
 */

const { BaseCommandService } = require('./BaseCommandService');
const { CliPrompts } = require('../CliPrompts');
const chalk = require('chalk');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling bin management operations
 * Extracted from CLI bin command handler and CliPrompts business logic
 */
class BinService extends BaseCommandService {
  constructor() {
    super();
    // Note: BinService doesn't need baseDir for all operations
    this.baseDir = null;
  }

  /**
   * Create a new selection bin
   * @param {BinManager} bm - Bin manager instance
   * @param {string} name - Bin name (optional, will prompt if not provided)
   * @returns {Promise<Object>} Result object
   */
  async createBin(bm, name = null) {
    try {
      const binName = name || (await CliPrompts.promptForBinName());

      await bm.createBin(binName);

      const successMessage = this.formatSuccessMessage('Created bin', binName);
      console.log(`✅ ${successMessage}`);

      return this.createResult(true, { binName }, successMessage);
    } catch (error) {
      const errorMessage = `Failed to create bin: ${error.message}`;
      console.error(`❌ ${errorMessage}`);
      return this.createResult(false, null, errorMessage, error);
    }
  }

  /**
   * Delete (burn) a selection bin
   * @param {BinManager} bm - Bin manager instance
   * @param {string} name - Bin name (optional, will prompt if not provided)
   * @returns {Promise<Object>} Result object
   */
  async burnBin(bm, name = null) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins to burn.'));
        return this.createResult(true, null, 'No bins available');
      }

      const binName =
        name || (await CliPrompts.selectFromBins(bins, 'Select a bin to burn:'));

      const confirmed = await CliPrompts.confirmAction(
        `Burn bin "${binName}"? This will permanently delete all selected chats.`
      );

      if (confirmed) {
        await bm.deleteBin(binName);
        const successMessage = `Burned bin "${binName}" to ashes`;
        console.log(chalk.green(`🔥 ${successMessage}`));
        return this.createResult(true, { binName, action: 'burned' }, successMessage);
      } else {
        console.log(chalk.yellow('💨 Bin burning cancelled.'));
        return this.createResult(
          true,
          { binName, action: 'cancelled' },
          'Bin burning cancelled'
        );
      }
    } catch (error) {
      const errorMessage = `Failed to burn bin: ${error.message}`;
      console.error(chalk.red(`❌ ${errorMessage}`));
      return this.createResult(false, null, errorMessage, error);
    }
  }

  /**
   * List all selection bins
   * @param {BinManager} bm - Bin manager instance
   * @returns {Promise<Object>} Result object
   */
  async listBins(bm) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins found.'));
        console.log(
          chalk.dim('   💡 Tip: Use "ddd bin create <name>" to create your first bin.')
        );
        return this.createResult(true, [], 'No bins found');
      }

      console.log(chalk.blue('📋 Available bins:'));

      bins.forEach(bin => {
        const status = bin.isActive ? chalk.green('(active)') : '';
        console.log(`  🗑️ ${chalk.cyan(bin.name)} (${bin.chatCount} chats) ${status}`);
      });

      // Show current bin info
      const currentSummary = bm.getActiveBinSummary();
      console.log(`\n${chalk.dim(currentSummary)}`);

      return this.createResult(true, bins, `Found ${bins.length} bins`);
    } catch (error) {
      const errorMessage = `Failed to list bins: ${error.message}`;
      console.error(chalk.red(`❌ ${errorMessage}`));
      return this.createResult(false, null, errorMessage, error);
    }
  }

  /**
   * Rename a selection bin
   * @param {BinManager} bm - Bin manager instance
   * @param {string} name - Current bin name (optional, will prompt if not provided)
   * @returns {Promise<Object>} Result object
   */
  async renameBin(bm, name = null) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins to rename.'));
        return this.createResult(true, null, 'No bins available');
      }

      const oldName =
        name || (await CliPrompts.selectFromBins(bins, 'Select a bin to rename:'));
      const newName = await CliPrompts.promptForBinName('new');

      if (oldName === newName) {
        console.log(chalk.yellow('📋 Bin name is the same.'));
        return this.createResult(true, { oldName, newName }, 'Name unchanged');
      }

      await bm.renameBin(oldName, newName);
      const successMessage = `Renamed bin "${oldName}" to "${newName}"`;
      console.log(chalk.green(`✅ ${successMessage}`));

      return this.createResult(true, { oldName, newName }, successMessage);
    } catch (error) {
      const errorMessage = `Failed to rename bin: ${error.message}`;
      console.error(chalk.red(`❌ ${errorMessage}`));
      return this.createResult(false, null, errorMessage, error);
    }
  }

  /**
   * Calculate bin statistics (extracted from CliPrompts)
   * @param {BinManager} bm - Bin manager instance
   * @returns {Object} Bin statistics
   */
  calculateBinStatistics(bm) {
    const bins = bm.listBins();

    let totalChats = 0;
    let totalMessages = 0;
    let totalDumpsters = 0;
    let activeCount = 0;

    for (const bin of bins) {
      const chatsByDumpster = bm.getBinChatsByDumpster(bin.name);
      const binChatCount = Object.values(chatsByDumpster).flat().length;
      totalChats += binChatCount;

      if (binChatCount > 0) {
        totalDumpsters += Object.keys(chatsByDumpster).length;
        totalMessages += Object.values(chatsByDumpster).reduce(
          (sum, chats) =>
            sum +
            chats.reduce(
              (msgSum, chat) => msgSum + (chat.metadata?.messageCount || 0),
              0
            ),
          0
        );
      }

      if (bin.isActive) {
        activeCount++;
      }
    }

    return {
      totalBins: bins.length,
      totalChats,
      totalMessages,
      totalDumpsters,
      activeCount,
      averageChatsPerBin: bins.length > 0 ? Math.round(totalChats / bins.length) : 0,
      hasContent: totalChats > 0,
    };
  }

  /**
   * Get bins with content for selection
   * @param {BinManager} bm - Bin manager instance
   * @returns {Array} Array of bins that have content
   */
  getBinsWithContent(bm) {
    const bins = bm.listBins();
    return bins.filter(bin => bin.chatCount > 0);
  }

  /**
   * Format bin status for display
   * @param {Object} stats - Bin statistics
   * @returns {string} Formatted status string
   */
  formatBinStatus(stats) {
    if (!stats.hasContent) {
      return 'No bins contain any content';
    }

    let status = `${stats.totalChats} chats selected`;
    if (stats.totalMessages > 0) {
      status += `, ${stats.totalMessages} total messages`;
    }
    if (stats.totalDumpsters > 0) {
      status += `, from ${stats.totalDumpsters} dumpster${stats.totalDumpsters !== 1 ? 's' : ''}`;
    }

    return status;
  }

  /**
   * Validate bin name
   * @param {string} name - Bin name to validate
   * @param {string} context - Context for validation
   * @returns {Object} Validation result
   */
  validateBinName(name, _context = 'validation') {
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Bin name cannot be empty' };
    }

    if (name.length < 2) {
      return { valid: false, error: 'Bin name must be at least 2 characters' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Bin name cannot exceed 50 characters' };
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return {
        valid: false,
        error: 'Bin name can only contain letters, numbers, underscores, and hyphens',
      };
    }

    return { valid: true, name };
  }

  /**
   * Get bin command statistics
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      name: 'BinService',
      version: VERSION,
      description: 'Handles bin management operations',
      capabilities: [
        'bin creation',
        'bin deletion',
        'bin listing',
        'bin renaming',
        'bin statistics',
        'content validation',
      ],
    };
  }

  /**
   * Execute bin command with subcommand routing
   * @param {string} subcommand - The subcommand to execute (create, burn, list, rename)
   * @param {string} name - Optional bin name for create/rename operations
   * @param {Object} managers - Manager instances from CommandInitService
   * @returns {Promise<Object>} Result object with success status
   */
  async executeBinCommand(subcommand, name, managers) {
    if (!subcommand) {
      return this.createResult(
        false,
        null,
        'No subcommand provided. Use create, burn, list, or rename.',
        'missing_subcommand'
      );
    }

    const { bin } = managers;
    if (!bin) {
      return this.createResult(
        false,
        null,
        'Bin manager not available',
        'missing_manager'
      );
    }

    try {
      switch (subcommand.toLowerCase()) {
        case 'create':
          return await this.createBin(bin, name);

        case 'burn':
          return await this.burnBin(bin, name);

        case 'list':
          return await this.listBins(bin);

        case 'rename':
          return await this.renameBin(bin, name);

        default:
          return this.createResult(
            false,
            null,
            `Unknown subcommand: ${subcommand}. Use create, burn, list, or rename.`,
            'unknown_subcommand'
          );
      }
    } catch (error) {
      return this.createResult(
        false,
        error,
        `Failed to execute bin command "${subcommand}": ${error.message}`,
        'execution_error'
      );
    }
  }
}

module.exports = {
  BinService,
};
