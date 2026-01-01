/**
 * Bin Service
 * Extracted business logic for bin management
 * Handles bin creation, deletion, listing, and operations
 */

const { BaseCommandService } = require('./BaseCommandService');
const { SchemaValidator } = require('../SchemaValidator');
const { CliPrompts } = require('../CliPrompts');
const chalk = require('chalk');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling bin management operations
 * Extracted from CLI bin command handler and CliPrompts business logic
 */
class BinService extends BaseCommandService {
  constructor(baseDir) {
    super(baseDir);
  }

  /**
   * Validate and prepare bin operation inputs using SchemaValidator pattern
   * @param {string} name - Bin name to validate
   * @param {string} operation - Operation context for error messages
   * @returns {Object} Validation result following SchemaValidator pattern
   */
  validateAndPrepareBinName(name, operation = 'operation') {
    // Use SchemaValidator's safe validation pattern with custom bin rules
    const nameValidation = this.safeValidateBinName(name, { context: operation });

    if (!nameValidation.valid) {
      if (nameValidation.requiresPrompt) {
        return {
          valid: true,
          validatedInputs: { requiresNamePrompt: true },
        };
      }
      return {
        valid: false,
        error: nameValidation.error,
        message: nameValidation.message,
        context: `${operation} name validation`,
      };
    }

    return {
      valid: true,
      validatedInputs: { binName: nameValidation.data },
    };
  }

  /**
   * Safe validation version of validateBinName - delegates to SchemaValidator
   * @param {string} name - Bin name to validate
   * @param {Object} options - Validation options
   * @param {string} options.context - Context for error messages
   * @param {boolean} options.detectEmpty - Whether to detect empty strings and return requiresPrompt
   * @returns {Object} Validation result object from SchemaValidator
   */
  safeValidateBinName(name, options = {}) {
    return SchemaValidator.safeValidateBinName(name, options);
  }

  /**
   * Validate bin existence and availability
   * @param {BinManager} bm - Bin manager instance
   * @param {string} binName - Bin name to check
   * @param {string} operation - Operation context
   * @returns {Object} Validation result
   */
  validateBinExistence(bm, binName, operation = 'operation') {
    const bins = bm.listBins();
    const binExists = bins.some(bin => bin.name === binName);

    switch (operation) {
      case 'create':
        if (binExists) {
          return {
            valid: false,
            error: `Bin "${binName}" already exists. Choose a different name or use 'rename' to modify existing bin.`,
            context: 'bin creation validation',
          };
        }
        break;
      case 'delete':
      case 'rename':
      case 'add_chats':
        if (!binExists) {
          return {
            valid: false,
            error: `Bin "${binName}" not found. Available bins: ${bins.map(b => b.name).join(', ')}`,
            context: 'bin existence validation',
          };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Create a new selection bin
   * @param {BinManager} bm - Bin manager instance
   * @param {string} name - Bin name (optional, will prompt if not provided)
   * @returns {Promise<Object>} Result object
   */
  async createBin(bm, name = null) {
    try {
      // Validate and prepare inputs using SchemaValidator pattern
      const nameValidation = this.validateAndPrepareBinName(name, 'create');
      if (!nameValidation.valid) {
        const errorMessage = `Cannot create bin: ${nameValidation.message || nameValidation.error.message}`;
        console.error(`❌ ${errorMessage}`);
        return this.createResult(false, null, errorMessage, nameValidation.context);
      }

      // Get bin name (prompt if not provided)
      const binName =
        nameValidation.validatedInputs.binName || (await CliPrompts.promptForBinName());

      // Validate bin doesn't already exist
      const existenceValidation = this.validateBinExistence(bm, binName, 'create');
      if (!existenceValidation.valid) {
        const errorMessage = `Cannot create bin "${binName}": ${existenceValidation.error}`;
        console.error(`❌ ${errorMessage}`);
        return this.createResult(
          false,
          null,
          errorMessage,
          existenceValidation.context
        );
      }

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
      // Check if any bins exist
      const bins = bm.listBins();
      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins to burn.'));
        return this.createResult(true, null, 'No bins available');
      }

      // Validate and prepare bin name using SchemaValidator pattern
      let binName;
      if (name) {
        const nameValidation = this.validateAndPrepareBinName(name, 'burn');
        if (!nameValidation.valid) {
          const errorMessage = `Cannot burn bin: ${nameValidation.message || nameValidation.error.message}`;
          console.error(`❌ ${errorMessage}`);
          return this.createResult(false, null, errorMessage, nameValidation.context);
        }
        binName = nameValidation.validatedInputs.binName;

        // Validate bin exists
        const existenceValidation = this.validateBinExistence(bm, binName, 'delete');
        if (!existenceValidation.valid) {
          const errorMessage = `Cannot burn bin "${binName}": ${existenceValidation.error}`;
          console.error(`❌ ${errorMessage}`);
          return this.createResult(
            false,
            null,
            errorMessage,
            existenceValidation.context
          );
        }
      } else {
        binName = await CliPrompts.selectFromBins(bins, 'Select a bin to burn:');
      }

      // Confirm deletion
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
      const errorMessage = `Failed to burn bin${name ? ` "${name}"` : ''}: ${error.message}`;
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
   * Validate bin name using SchemaValidator
   * @param {string} name - Bin name to validate
   * @param {string} context - Context for validation
   * @returns {Object} Validation result
   */
  validateBinName(name, context = 'validation') {
    try {
      const validatedName = SchemaValidator.validateBinName(name, { context });
      return { valid: true, name: validatedName };
    } catch (error) {
      return { valid: false, error: error.message };
    }
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
        'No subcommand provided. Use: ddd bin <create|burn|list|rename> [name]',
        'missing_subcommand'
      );
    }

    const { bin } = managers;
    if (!bin) {
      return this.createResult(
        false,
        null,
        'Bin manager not available. This should not happen - please report this issue.',
        'missing_manager'
      );
    }

    try {
      const operation = subcommand.toLowerCase();

      switch (operation) {
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
            `Unknown subcommand "${subcommand}". Valid subcommands are: create, burn, list, rename`,
            'unknown_subcommand'
          );
      }
    } catch (error) {
      const errorMessage = `Failed to execute bin command "${subcommand}"${name ? ` with name "${name}"` : ''}: ${error.message}`;
      return this.createResult(false, error, errorMessage, 'execution_error');
    }
  }
}

module.exports = {
  BinService,
};
