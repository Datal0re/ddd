/**
 * Dump Service
 * Extracted business logic for the dump command
 * Handles file validation, dumpster creation, and result formatting
 */

const path = require('path');
const { BaseCommandService } = require('./BaseCommandService');
const { SchemaValidator } = require('../validators/CommandValidator');
const { CliPrompts } = require('../CliPrompts');

/**
 * Service for handling dumpster creation operations
 * Extracted from CLI dump command handler
 */
class DumpService extends BaseCommandService {
  /**
   * Create a new dumpster from a ChatGPT export ZIP file
   * @param {string} file - Path to ZIP file (may be undefined, will prompt)
   * @param {string} name - Custom dumpster name (may be undefined, will prompt)
   * @param {Object} options - Command options
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Result object
   */
  async createDumpster(file, name, _options = {}, managers) {
    try {
      // Validate and get file path
      const validatedFile = await this.validateAndPromptFileInput(file, 'dump command');

      // Generate suggested name from file path if no name provided
      const suggestedName = path.basename(validatedFile, '.zip');

      // Validate and get dumpster name
      const validatedName = await this.validateAndPromptDumpsterName(
        name,
        suggestedName,
        'dump command'
      );

      // Validate file exists
      await this.validateFilePath(validatedFile, 'dump command');

      // Start progress tracking
      managers.progress.start('initializing', 'Initializing dumpster creation...');

      // Create progress callback
      const onProgress = progress => {
        managers.progress.update(progress.stage, progress.progress, progress.message);
      };

      // Create the dumpster
      const result = await managers.dumpster.createDumpster(
        validatedFile,
        validatedName,
        false,
        onProgress,
        { zipPath: validatedFile }
      );

      // Format and display success message
      const successMessage = this.formatDumpsterStats(
        result.stats || {},
        validatedName
      );
      managers.progress.succeed(successMessage);

      return this.createResult(true, result, successMessage);
    } catch (error) {
      managers.progress?.fail(`Dumpster creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate file path or prompt user if not provided
   * @param {string} file - File path (may be undefined)
   * @param {string} context - Context for validation
   * @returns {Promise<string>} Validated file path
   */
  async validateAndPromptFileInput(file, context) {
    if (!file) {
      return await CliPrompts.promptForFilePath();
    }

    // Validate provided file
    const validation = this.validateRequiredParameters(
      [{ name: 'file', value: file }],
      context
    );

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    return file;
  }

  /**
   * Validate dumpster name or prompt user if not provided
   * @param {string} name - Dumpster name (may be undefined or 'default')
   * @param {string} defaultName - Suggested name
   * @param {string} context - Context for validation
   * @returns {Promise<string>} Validated dumpster name
   */
  async validateAndPromptDumpsterName(name, defaultName, context) {
    if (!name || name === 'default') {
      return await CliPrompts.promptForDumpsterName(defaultName);
    }

    // Validate provided name
    try {
      SchemaValidator.validateDumpsterName(name, { context });
      return name;
    } catch (error) {
      throw new Error(`Invalid dumpster name: ${error.message}`);
    }
  }

  /**
   * Validate file path exists
   * @param {string} filePath - File path to validate
   * @param {string} context - Context for validation
   */
  async validateFilePath(filePath, context) {
    const validation = SchemaValidator.validatePath(filePath, {
      mustExist: true,
      context: context,
    });

    if (!validation.valid) {
      throw new Error(validation.message);
    }
  }

  /**
   * Format dumpster creation statistics
   * @param {Object} stats - Statistics object from dumpster creation
   * @param {string} dumpsterName - Name of created dumpster
   * @returns {string} Formatted success message
   */
  formatDumpsterStats(stats, dumpsterName) {
    const chatCount = stats.chats || 0;
    const assetCount = stats.assets || 0;

    return `Dumpster "${dumpsterName}" created successfully!\n${chatCount} conversations processed, ${assetCount} assets extracted`;
  }

  /**
   * Validate and prepare inputs for dumpster creation
   * @param {string} file - Input file path
   * @param {string} name - Input dumpster name
   * @param {Object} options - Command options
   * @returns {Promise<Object>} Validated inputs
   */
  async prepareInputs(file, name, _options) {
    const validatedInputs = {};

    // File validation
    if (!file) {
      validatedInputs.requiresFilePrompt = true;
    } else {
      validatedInputs.file = file;
      // Check if file exists
      try {
        const validation = SchemaValidator.validatePath(file, {
          mustExist: true,
          context: 'dump command',
        });
        validatedInputs.fileValid = validation.valid;
        if (!validation.valid) {
          validatedInputs.fileError = validation.message;
        }
      } catch (error) {
        validatedInputs.fileValid = false;
        validatedInputs.fileError = error.message;
      }
    }

    // Name validation and suggestion generation
    if (!name || name === 'default') {
      validatedInputs.requiresNamePrompt = true;
      if (file) {
        validatedInputs.suggestedName = path.basename(file, '.zip');
      }
    } else {
      try {
        SchemaValidator.validateDumpsterName(name, { context: 'dump command' });
        validatedInputs.name = name;
        validatedInputs.nameValid = true;
      } catch (error) {
        validatedInputs.nameValid = false;
        validatedInputs.nameError = error.message;
      }
    }

    return validatedInputs;
  }

  /**
   * Get dump command statistics
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      name: 'DumpService',
      version: '1.0.0',
      description: 'Handles dumpster creation from ChatGPT export files',
      capabilities: [
        'file validation',
        'dumpster name validation',
        'progress tracking',
        'statistics formatting',
      ],
    };
  }
}

module.exports = {
  DumpService,
};
