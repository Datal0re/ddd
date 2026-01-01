/**
 * Bin Service
 * Extracted business logic for bin management
 * Handles bin creation, deletion, listing, and operations
 */

const { BaseCommandService } = require('./BaseCommandService');
const { SchemaValidator } = require('../SchemaValidator');
const { CliPrompts } = require('../CliPrompts');
const { StatisticsUtils } = require('../StatisticsUtils');
const { OutputManager } = require('../OutputManager');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling bin management operations
 * Extracted from CLI bin command handler and CliPrompts business logic
 */
class BinService extends BaseCommandService {
  constructor(baseDir) {
    super(baseDir);
    // Create specialized logger for consistent context handling
    this.output = OutputManager.createLogger('bin operation');
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
        this.output.error(errorMessage);
        return this.createResult(false, null, errorMessage, nameValidation.context);
      }

      // Get bin name (prompt if not provided)
      const binName =
        nameValidation.validatedInputs.binName || (await CliPrompts.promptForBinName());

      // Validate bin doesn't already exist
      const existenceValidation = this.validateBinExistence(bm, binName, 'create');
      if (!existenceValidation.valid) {
        const errorMessage = `Cannot create bin "${binName}": ${existenceValidation.error}`;
        this.output.error(errorMessage);
        return this.createResult(
          false,
          null,
          errorMessage,
          existenceValidation.context
        );
      }

      await bm.createBin(binName);

      const successMessage = this.formatSuccessMessage('Created bin', binName);
      this.output.success(successMessage);

      return this.createResult(true, { binName }, successMessage);
    } catch (error) {
      const errorMessage = `Failed to create bin: ${error.message}`;
      this.output.error(errorMessage, 'Check bin name and permissions');
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
        this.output.warning('No bins to burn');
        return this.createResult(true, null, 'No bins available');
      }

      // Validate and prepare bin name using SchemaValidator pattern
      let binName;
      if (name) {
        const nameValidation = this.validateAndPrepareBinName(name, 'burn');
        if (!nameValidation.valid) {
          const errorMessage = `Cannot burn bin: ${nameValidation.message || nameValidation.error.message}`;
          this.output.error(errorMessage);
          return this.createResult(false, null, errorMessage, nameValidation.context);
        }
        binName = nameValidation.validatedInputs.binName;

        // Validate bin exists
        const existenceValidation = this.validateBinExistence(bm, binName, 'delete');
        if (!existenceValidation.valid) {
          const errorMessage = `Cannot burn bin "${binName}": ${existenceValidation.error}`;
          this.output.error(errorMessage);
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
        this.output.action('burn', successMessage);
        return this.createResult(true, { binName, action: 'burned' }, successMessage);
      } else {
        this.output.warning('Bin burning cancelled', 'Bin was not deleted');
        return this.createResult(
          true,
          { binName, action: 'cancelled' },
          'Bin burning cancelled'
        );
      }
    } catch (error) {
      const errorMessage = `Failed to burn bin${name ? ` "${name}"` : ''}: ${error.message}`;
      this.output.error(errorMessage, 'Check bin name and permissions');
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
        this.output.list([], 'Available bins', 'No bins found');
        this.output.info('Use "ddd bin create <name>" to create your first bin');
        return this.createResult(true, [], 'No bins found');
      }

      const formattedBins = bins.map(bin => ({
        name: `${bin.name} (${bin.chatCount} chats)${bin.isActive ? ' (active)' : ''}`,
        description: bin.isActive
          ? 'Currently active selection bin'
          : 'Inactive selection bin',
      }));

      this.output.list(formattedBins, 'Available bins');

      // Show current bin info
      const currentSummary = bm.getActiveBinSummary();
      this.output.info(currentSummary);

      return this.createResult(true, bins, `Found ${bins.length} bins`);
    } catch (error) {
      const errorMessage = `Failed to list bins: ${error.message}`;
      this.output.error(errorMessage, 'Check bin manager availability');
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
        this.output.warning('No bins to rename');
        return this.createResult(true, null, 'No bins available');
      }

      const oldName =
        name || (await CliPrompts.selectFromBins(bins, 'Select a bin to rename:'));
      const newName = await CliPrompts.promptForBinName('new');

      if (oldName === newName) {
        this.output.warning('Bin name is the same', 'Choose a different name');
        return this.createResult(true, { oldName, newName }, 'Name unchanged');
      }

      await bm.renameBin(oldName, newName);
      const successMessage = `Renamed bin "${oldName}" to "${newName}"`;
      this.output.success(successMessage);

      return this.createResult(true, { oldName, newName }, successMessage);
    } catch (error) {
      const errorMessage = `Failed to rename bin: ${error.message}`;
      this.output.error(errorMessage, 'Check bin permissions and names');
      return this.createResult(false, null, errorMessage, error);
    }
  }

  /**
   * Calculate bin statistics using centralized StatisticsUtils
   * @param {BinManager} bm - Bin manager instance
   * @returns {Object} Bin statistics
   */
  calculateBinStatistics(bm) {
    return StatisticsUtils.calculateBinStatistics(bm);
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
      const errorMessage =
        'No subcommand provided. Use: ddd bin <create|burn|list|rename> [name]';
      this.output.error(
        errorMessage,
        'Available subcommands: create, burn, list, rename'
      );
      return this.createResult(false, null, errorMessage, 'missing_subcommand');
    }

    const { bin } = managers;
    if (!bin) {
      const errorMessage =
        'Bin manager not available. This should not happen - please report this issue.';
      this.output.error(errorMessage, 'Please report this as a bug');
      return this.createResult(false, null, errorMessage, 'missing_manager');
    }

    try {
      const operation = subcommand.toLowerCase();
      const errorMessage = `Unknown subcommand "${subcommand}". Valid subcommands are: create, burn, list, rename`;

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
          this.output.error(errorMessage, 'Use one of the valid subcommands');
          return this.createResult(false, null, errorMessage, 'unknown_subcommand');
      }
    } catch (error) {
      const errorMessage = `Failed to execute bin command "${subcommand}"${name ? ` with name "${name}"` : ''}: ${error.message}`;
      this.output.error(errorMessage, 'Check command syntax and bin availability');
      return this.createResult(false, error, errorMessage, 'execution_error');
    }
  }
}

module.exports = {
  BinService,
};
