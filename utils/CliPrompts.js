const { input, select, confirm } = require('@inquirer/prompts');
const { SchemaValidator } = require('./SchemaValidator');
const fs = require('fs').promises;

/**
 * Common CLI prompt utilities for Data Dumpster Diver
 */
class CliPrompts {
  /**
   * Prompt user for a file path to a ChatGPT export ZIP
   * @returns {Promise<string>} Validated file path
   */
  static async promptForFilePath() {
    return await input({
      message: 'Enter the path to your ChatGPT export ZIP file:',
      validate: async input => {
        if (!input.trim()) return 'Please enter a file path';
        if (!input.endsWith('.zip')) return 'Please provide a ZIP file';
        try {
          await fs.access(input);
          return true;
        } catch {
          return 'File not found. Please check the path and try again.';
        }
      },
    });
  }

  /**
   * Prompt user for a dumpster name
   * @param {string} defaultName - Default name suggestion
   * @returns {Promise<string>} Validated dumpster name
   */
  static async promptForDumpsterName(defaultName) {
    return await input({
      message: 'Enter a name for this dumpster:',
      default: defaultName,
      validate: input => {
        if (!input.trim()) return 'Please enter a name';
        SchemaValidator.validateDumpsterName(input, { context: 'dump command' });
        return true;
      },
    });
  }

  /**
   * Prompt user to select from available dumpsters
   * @param {Array} dumpsters - Array of dumpster objects
   * @param {string} message - Prompt message
   * @returns {Promise<string>} Selected dumpster name
   */
  static async selectFromDumpsters(dumpsters, message) {
    return await select({
      message,
      choices: dumpsters.map(d => ({
        name: `${d.name} (${d.chatCount || '?'} chats)`,
        value: d.name,
      })),
    });
  }

  /**
   * Prompt user to select export format
   * @returns {Promise<string>} Selected format (txt, md, html)
   */
  static async selectExportFormat() {
    return await select({
      message: 'Choose export format:',
      choices: [
        {
          name: '📄 Plain Text (.txt) - Simple, universal format',
          value: 'txt',
        },
        {
          name: '📝 Markdown (.md) - Great for documentation and GitHub',
          value: 'md',
        },
        {
          name: '🌐 HTML (.html) - Rich formatting with styling',
          value: 'html',
        },
      ],
    });
  }

  /**
   * Prompt user for number of chats to display
   * @param {string} message - Prompt message
   * @param {string} defaultValue - Default value
   * @returns {Promise<number>} Validated number
   */
  static async promptForChatLimit(
    message = 'How many chats would you like to see?',
    defaultValue = '10'
  ) {
    const userInput = await input({
      message,
      default: defaultValue,
      validate: inputValue => {
        const num = parseInt(inputValue);
        if (isNaN(num)) return 'Please enter a number';
        if (num < 1) return 'Must show at least 1 chat';
        if (num > 100) return 'Maximum 100 chats at once';
        return true;
      },
    });
    return parseInt(userInput);
  }

  /**
   * Prompt user for confirmation
   * @param {string} message - Confirmation message
   * @param {boolean} defaultValue - Default value
   * @returns {Promise<boolean>} User's choice
   */
  static async confirmAction(message, defaultValue = false) {
    return await confirm({
      message,
      default: defaultValue,
    });
  }

  /**
   * Prompt user for text input with validation
   * @param {string} message - Prompt message
   * @param {Function} validator - Validation function
   * @returns {Promise<string>} Validated input
   */
  static async promptForText(message, validator = null) {
    return await input({
      message,
      validate:
        validator ||
        (input => {
          if (!input.trim()) return 'Please enter a value';
          return true;
        }),
    });
  }
}

module.exports = { CliPrompts };
