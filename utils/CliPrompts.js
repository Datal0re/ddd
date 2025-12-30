const { input, select, confirm, checkbox } = require('@inquirer/prompts');
const { SchemaValidator } = require('./SchemaValidator');
const fs = require('fs').promises;
const { UI_CONFIG } = require('../config/constants');
const chalk = require('chalk');

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
   * Prompt user for chat limit
   * @param {string} message - Prompt message
   * @param {string} defaultValue - Default value
   * @returns {Promise<number|null>} Validated number or null for "show all"
   */
  static async promptForChatLimit(
    message = 'How many chats would you like to see? (leave empty for all):',
    defaultValue = ''
  ) {
    const userInput = await input({
      message,
      default: defaultValue,
      validate: inputValue => {
        // Allow empty input for "show all"
        if (inputValue.trim() === '') return true;

        const num = parseInt(inputValue);
        if (isNaN(num)) return 'Please enter a number or leave empty for all';
        if (num < 1) return 'Must show at least 1 chat';
        if (num > UI_CONFIG.MAX_CHAT_SELECTION)
          return `Maximum ${UI_CONFIG.MAX_CHAT_SELECTION} chats at once`;
        return true;
      },
    });

    // Return null for empty input (show all), otherwise return number
    return userInput.trim() === '' ? null : parseInt(userInput);
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

  /**
   * Prompt user for search query
   * @param {string} message - Prompt message
   * @returns {Promise<string>} Search query (can be empty)
   */
  static async promptSearchQuery(
    message = '🔍 Enter search query (leave empty to show all):'
  ) {
    return await input({
      message,
      default: '', // Allow empty input for "show all"
    });
  }

  /**
   * Prompt user for search options
   * @returns {Promise<Object>} Search options object
   */
  static async promptSearchOptions() {
    const scope = await select({
      message: '📋 Search scope:',
      default: 'all',
      choices: [
        {
          name: '🔤 Search in titles and messages',
          value: 'all',
        },
        {
          name: '📝 Search in titles only',
          value: 'title',
        },
        {
          name: '💬 Search in message content only',
          value: 'content',
        },
      ],
    });

    const caseSensitive = await confirm({
      message: '🔤 Case sensitive search?',
      default: false,
    });

    return {
      scope,
      caseSensitive,
    };
  }

  /**
   * Prompt user to select multiple chats using checkboxes
   * @param {Array} searchResults - Array of search result objects
   * @param {string} message - Prompt message
   * @param {Array} defaultSelected - Array of default selected chat IDs
   * @returns {Promise<Array>} Array of selected chat objects
   */
  static async selectMultipleChats(searchResults, message, defaultSelected = []) {
    const choices = searchResults.map((result, index) => {
      const chat = result.chat;
      const title = chat.title || 'Untitled Chat';
      const timestamp = chat.update_time || chat.create_time;
      const dateStr = timestamp
        ? new Date(timestamp * 1000).toLocaleDateString()
        : 'Unknown date';

      // Show match information if available
      let matchInfo = '';
      if (result.searchResult && result.searchResult.matchCount > 0) {
        matchInfo = ` - ${result.searchResult.matchCount} match${result.searchResult.matchCount !== 1 ? 'es' : ''}`;
      }

      return {
        name: `${index + 1}. ${title} (${dateStr})${matchInfo}`,
        value: result.chat.filename,
        checked: defaultSelected.includes(result.chat.filename),
      };
    });

    const selectedFilenames = await checkbox({
      message,
      choices,
      pageSize: UI_CONFIG.CHECKBOX_PAGE_SIZE, // Show items at a time
    });

    // Return the full chat objects for selected items
    return searchResults
      .filter(result => selectedFilenames.includes(result.chat.filename))
      .map(result => result.chat);
  }

  /**
   * Prompt user for action after selecting chats
   * @param {Array} selectedChats - Array of selected chat objects
   * @param {Object} _selectionStats - Selection statistics (optional, unused)
   * @returns {Promise<string>} Selected action
   */
  static async promptSelectionActions(selectedChats, _selectionStats = null) {
    const message = `📊 Selected: ${selectedChats.length} chat${selectedChats.length !== 1 ? 's' : ''}`;

    const choices = [
      {
        name: `📋 Add to selection bin`,
        value: 'add-to-bin',
      },
      {
        name: `🔄 Upcycle selected chats`,
        value: 'upcycle',
      },
      {
        name: '🔍 New search in same dumpster',
        value: 'new-search',
      },
      {
        name: '🗑️ Switch dumpster',
        value: 'switch-dumpster',
      },
      {
        name: '❌ Quit',
        value: 'quit',
      },
    ];

    return await select({
      message,
      choices,
    });
  }

  /**
   * Prompt user for upcycle source selection
   * @param {Object} selectionStats - Current selection statistics
   * @returns {Promise<string>} Selection choice
   */
  static async promptUpcycleSource(selectionStats) {
    const choices = [
      {
        name: '📦 Export entire dumpster',
        value: 'dumpster',
      },
    ];

    if (selectionStats && selectionStats.totalCount > 0) {
      // Calculate additional stats for better UX
      const totalMessages = Object.values(selectionStats.chatsByDumpster || {}).reduce(
        (sum, chats) =>
          sum +
          chats.reduce(
            (msgSum, chat) => msgSum + (chat.metadata?.messageCount || 0),
            0
          ),
        0
      );
      const dumpsterCount = Object.keys(selectionStats.chatsByDumpster || {}).length;

      let selectionDescription = `📋 Export from selection bin (${selectionStats.totalCount} chats`;
      if (totalMessages > 0) {
        selectionDescription += `, ${totalMessages} messages`;
      }
      if (dumpsterCount > 1) {
        selectionDescription += `, from ${dumpsterCount} dumpsters`;
      }
      selectionDescription += ')';

      choices.unshift({
        name: selectionDescription,
        value: 'selection',
      });
    }

    if (choices.length === 1) {
      console.log('📋 Selection bin is empty, will export from dumpster.');
      console.log(
        chalk.dim('   💡 Tip: Use "ddd rummage" to select chats for export.')
      );
      return 'dumpster';
    }

    return await select({
      message: '🔄 Choose export source:',
      choices,
    });
  }

  /**
   * Prompt user to confirm selection action
   * @param {string} action - Action being performed
   * @param {number} count - Number of items
   * @returns {Promise<boolean>} User confirmation
   */
  static async confirmSelectionAction(action, count) {
    return await confirm({
      message: `${action} ${count} chat${count !== 1 ? 's' : ''}?`,
      default: true,
    });
  }

  /**
   * Prompt user for next rummage action
   * @returns {Promise<string>} User choice
   */
  static async promptRummageNextAction() {
    return await select({
      message: 'What would you like to do next?',
      choices: [
        { name: '🔍 New search', value: 'new_search' },
        { name: '🔄 Switch dumpster', value: 'switch_dumpster' },
        { name: '📋 View selection bin', value: 'view_selection' },
        { name: '🚀 Export selection bin', value: 'upcycle_selection' },
        { name: '👋 Quit', value: 'quit' },
      ],
    });
  }

  /**
   * Prompt user to continue or quit after an action
   * @param {string} action - Action that was completed
   * @returns {Promise<string>} User choice
   */
  static async promptContinueOrQuit(action) {
    return await select({
      message: `${action} completed. What would you like to do?`,
      choices: [
        { name: '🔍 New search', value: 'new_search' },
        { name: '🔄 Switch dumpster', value: 'switch_dumpster' },
        { name: '📋 View selection bin', value: 'view_selection' },
        { name: '🚀 Export selection', value: 'upcycle_selection' },
        { name: '👋 Quit', value: 'quit' },
      ],
    });
  }
}

module.exports = { CliPrompts };
