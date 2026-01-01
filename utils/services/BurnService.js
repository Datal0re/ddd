/**
 * Burn Service
 * Extracted business logic for burn command
 * Handles safety validation, statistics calculation, and dumpster deletion
 */

const { BaseCommandService } = require('./BaseCommandService');
const { SchemaValidator } = require('../SchemaValidator');
const { CliPrompts } = require('../CliPrompts');
const { FileNotFoundError } = require('../ErrorHandler');
const chalk = require('chalk');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling dumpster deletion (burn) operations
 * Extracted from CLI burn command handler
 */
class BurnService extends BaseCommandService {
  /**
   * Burn (delete) a dumpster with safety checks
   * @param {string} dumpsterName - Dumpster name (may be undefined, will prompt)
   * @param {Object} options - Command options
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Result object
   */
  async burnDumpster(dumpsterName, options = {}, managers) {
    try {
      // Validate and prepare inputs
      const validatedInputs = await this.validateAndPromptInputs(dumpsterName, options);

      // Validate dumpster exists
      const dumpster = await this.validateDumpsterExists(
        managers.dumpster,
        validatedInputs.dumpsterName
      );
      validatedInputs.dumpsterName = dumpster.name; // Fix unused variable

      // Calculate statistics for confirmation
      const stats = await this.calculateBurnStatistics(
        managers.dumpster,
        validatedInputs.dumpsterName
      );

      // Display preparation information
      this.displayBurnPreparation(validatedInputs.dumpsterName, stats);

      // Handle dry run
      if (validatedInputs.options.dryRun) {
        console.log(
          chalk.yellow('🔥 Dry run: Would have burned this dumpster to ashes')
        );
        return this.createResult(
          true,
          { dumpsterName: validatedInputs.dumpsterName, stats, dryRun: true },
          'Dry run completed'
        );
      }

      // Perform safety confirmation
      const confirmed = await this.performSafetyConfirmation(
        validatedInputs.dumpsterName,
        stats,
        validatedInputs.options.force
      );

      if (!confirmed) {
        console.log(
          chalk.yellow('💨 Fire extinguished - dumpster lives to see another day')
        );
        return this.createResult(
          true,
          { dumpsterName: validatedInputs.dumpsterName, action: 'cancelled' },
          'Burn cancelled by user'
        );
      }

      // Execute burning
      console.log(chalk.red('🔥 Lighting the match...'));
      const success = await managers.dumpster.deleteDumpster(
        validatedInputs.dumpsterName
      );

      if (success) {
        const successMessage = this.formatBurnSuccess(
          validatedInputs.dumpsterName,
          stats
        );
        managers.progress.succeed(successMessage);
        return this.createResult(
          true,
          { dumpsterName: validatedInputs.dumpsterName, stats, action: 'burned' },
          successMessage
        );
      } else {
        throw new Error(`Failed to burn dumpster "${validatedInputs.dumpsterName}"`);
      }
    } catch (error) {
      managers.progress?.fail(`Failed to start dumpster fire: ${error.message}`);
      return this.createResult(false, null, 'Burn operation failed', error);
    }
  }

  /**
   * Validate and prompt for inputs if needed
   * @param {string} dumpsterName - Provided dumpster name
   * @param {Object} options - Command options
   * @returns {Promise<Object>} Validated inputs
   */
  async validateAndPromptInputs(dumpsterName, options) {
    const validatedInputs = {};

    // Validate dumpster name
    if (!dumpsterName) {
      validatedInputs.requiresPrompt = true;
    } else {
      validatedInputs.dumpsterName = dumpsterName;
    }

    // Validate boolean options
    validatedInputs.options = this.validateCommandOptions(options, {
      force: { type: 'boolean', required: false, default: false },
      dryRun: { type: 'boolean', required: false, default: false },
    });

    return validatedInputs;
  }

  /**
   * Validate that dumpster exists
   * @param {DumpsterManager} dumpsterManager - Dumpster manager instance
   * @param {string} dumpsterName - Dumpster name to validate
   * @returns {Promise<Object>} Dumpster object
   * @throws {FileNotFoundError} If dumpster doesn't exist
   */
  async validateDumpsterExists(dumpsterManager, dumpsterName) {
    const dumpster = dumpsterManager.getDumpster(dumpsterName);
    if (!dumpster) {
      throw new FileNotFoundError(dumpsterName, 'burn command');
    }
    return dumpster;
  }

  /**
   * Calculate burn statistics for confirmation
   * @param {DumpsterManager} dumpsterManager - Dumpster manager instance
   * @param {string} dumpsterName - Dumpster name
   * @returns {Promise<Object>} Calculated statistics
   */
  async calculateBurnStatistics(dumpsterManager, dumpsterName) {
    const stats = await dumpsterManager.getDumpsterStats(dumpsterName);

    return {
      chatCount: stats?.chatCount || 'unknown',
      sizeInMB: stats?.totalSize
        ? Math.round(stats.totalSize / (1024 * 1024))
        : 'unknown',
      totalSize: stats?.totalSize || 0,
      createdAt: stats?.createdAt,
      lastModified: stats?.lastModified,
    };
  }

  /**
   * Display burn preparation information
   * @param {string} dumpsterName - Dumpster name
   * @param {Object} stats - Dumpster statistics
   */
  displayBurnPreparation(dumpsterName, stats) {
    console.log(chalk.yellow('🔥 Preparing to light a fire...'));
    console.log(chalk.dim(`Dumpster: ${dumpsterName}`));
    console.log(chalk.dim(`Chats to burn: ${stats.chatCount}`));
    console.log(chalk.dim(`Data to destroy: ${stats.sizeInMB}MB`));
  }

  /**
   * Perform safety confirmation for destructive action
   * @param {string} dumpsterName - Dumpster name
   * @param {Object} stats - Dumpster statistics
   * @param {boolean} force - Whether to skip confirmation
   * @returns {Promise<boolean>} Whether user confirmed
   */
  async performSafetyConfirmation(dumpsterName, stats, force) {
    if (force) {
      return true;
    }

    // First confirmation
    const shouldBurn = await CliPrompts.confirmAction(
      `Are you sure you want to permanently delete "${dumpsterName}"? \nThis will destroy ${stats.chatCount} chats (${stats.sizeInMB}MB) and cannot be undone.`
    );

    if (!shouldBurn) {
      return false;
    }

    // Additional safety challenge
    return await CliPrompts.promptForText(
      `Type "${dumpsterName}" to confirm deletion:`,
      input => {
        if (input !== dumpsterName) {
          return `Please type "${dumpsterName}" exactly to confirm`;
        }
        return true;
      }
    );
  }

  /**
   * Format burn success message
   * @param {string} dumpsterName - Dumpster name
   * @param {Object} stats - Dumpster statistics
   * @returns {string} Formatted success message
   */
  formatBurnSuccess(dumpsterName, stats) {
    const baseMessage = `Dumpster "${dumpsterName}" burned to ashes successfully!`;
    const details = `All ${stats.chatCount} chats and ${stats.sizeInMB}MB of data reduced to cinders`;

    return `${baseMessage}\n${chalk.dim(details)}`;
  }

  /**
   * Validate command options with schema
   * @param {Object} options - Options to validate
   * @param {Object} schema - Validation schema
   * @returns {Object} Validated options
   */
  validateCommandOptions(options, schema) {
    const validated = {};

    for (const [key, config] of Object.entries(schema)) {
      if (options[key] !== undefined) {
        const { type } = config;

        switch (type) {
          case 'boolean':
            validated[key] = SchemaValidator.validateBoolean(
              options[key],
              key,
              'burn command'
            );
            break;
          default:
            validated[key] = options[key];
        }
      } else {
        validated[key] = config.default;
      }
    }

    return validated;
  }

  /**
   * Get burn command statistics
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      name: 'BurnService',
      version: VERSION,
      description: 'Handles dumpster deletion with safety checks',
      capabilities: [
        'safety validation',
        'statistics calculation',
        'dry run support',
        'force deletion',
        'confirmation challenges',
        'progress tracking',
      ],
      safetyFeatures: [
        'user confirmation required',
        'text confirmation challenge',
        'dry run mode',
        'force flag available',
        'statistics display',
      ],
    };
  }
}

module.exports = {
  BurnService,
};
