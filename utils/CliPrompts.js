const { input, select, confirm, checkbox } = require('@inquirer/prompts');
const { SchemaValidator } = require('./SchemaValidator');
const fs = require('fs').promises;
const { UI_CONFIG } = require('../config/constants');

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
   * Prompt user to select export source (dumpster or bins)
   * @param {Object} selectionStats - Statistics for bins
   * @param {BinManager} bm - BinManager instance for getting bin statistics
   * @returns {Promise<string>} Selected source ('dumpster' or 'bins')
   */
  static async promptUpcycleSource(_selectionStats, bm = null) {
    const choices = [
      {
        name: '📦 Export entire dumpster',
        value: 'dumpster',
      },
    ];

    // Get actual chats by dumpster for accurate information
    if (!bm) {
      const { BinManager } = require('./BinManager');
      bm = new BinManager(process.cwd());
      await bm.initialize();
    }
    const bins = bm.listBins();

    // Check if any bins have content
    let totalChats = 0;
    let totalMessages = 0;
    let totalDumpsters = 0;

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
    }

    if (totalChats > 0) {
      let selectionDescription = `📋 Export from selection bins (${totalChats} chats`;
      if (totalMessages > 0) {
        selectionDescription += `, ${totalMessages} messages`;
      }
      if (totalDumpsters > 0) {
        selectionDescription += `, from ${totalDumpsters} dumpsters`;
      }
      selectionDescription += ')';

      choices.unshift({
        name: selectionDescription,
        value: 'selection',
      });
    }

    if (choices.length === 1) {
      return choices[0].value;
    }

    return await select({
      message: 'What would you like to upcycle?',
      choices,
    });
  }

  /**
   * Select bin for upcycle export
   * @param {Array} bins - Array of bin objects with their chat counts
   * @returns {Promise<string>} Selected bin name
   */
  static async selectBinForUpcycle(bins) {
    // Filter bins that have content
    const binsWithContent = bins.filter(bin => bin.chatCount > 0);

    if (binsWithContent.length === 0) {
      throw new Error('No bins contain any chats to upcycle');
    }

    const choices = binsWithContent.map(bin => ({
      name: `${bin.name} (${bin.chatCount} chat${bin.chatCount !== 1 ? 's' : ''}${bin.isActive ? ' - current' : ''})`,
      value: bin.name,
      description: bin.description || `Export from "${bin.name}" bin`,
    }));

    return await select({
      message: '📋 Select bin to upcycle:',
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
        { name: '🗑️ Clear selection bin', value: 'clear_selection' },
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
        { name: '🗑️ Clear selection bin', value: 'clear_selection' },
        { name: '🚀 Export selection', value: 'upcycle_selection' },
        { name: '👋 Quit', value: 'quit' },
      ],
    });
  }

  /**
   * Prompt user for bin name
   * @param {string} context - Context for the prompt (create/rename)
   * @returns {Promise<string>} Bin name
   */
  static async promptForBinName(context = 'new') {
    const message =
      context === 'new' ? 'Enter name for new bin:' : 'Enter new bin name:';

    return await input({
      message,
      validate: input => {
        if (!input || input.trim() === '') {
          return 'Bin name cannot be empty';
        }

        if (input.length < 2) {
          return 'Bin name must be at least 2 characters';
        }

        if (input.length > 50) {
          return 'Bin name cannot exceed 50 characters';
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
          return 'Bin name can only contain letters, numbers, underscores, and hyphens';
        }

        return true;
      },
    });
  }

  /**
   * Select from available bins
   * @param {Array} bins - Array of bin objects
   * @param {string} message - Selection prompt message
   * @returns {Promise<string>} Selected bin name
   */
  static async selectFromBins(bins, message = 'Select a bin:') {
    if (bins.length === 0) {
      throw new Error('No bins available to select from');
    }

    const choices = bins.map(bin => ({
      name: bin.name,
      value: bin.name,
      description: `${bin.chatCount} chat${bin.chatCount !== 1 ? 's' : ''}${bin.isActive ? ' (current)' : ''}`,
    }));

    return await select({
      message,
      choices,
    });
  }

  /**
   * Select bin for adding chats with option to create new bin
   * @param {Array} bins - Array of bin objects
   * @param {number} selectedCount - Number of selected chats
   * @returns {Promise<string>} Selected bin name or 'create-new'
   */
  static async selectBinForSelection(bins, selectedCount) {
    const message = `📋 Where to add ${selectedCount} chat${selectedCount !== 1 ? 's' : ''}:`;

    const choices = [];

    // Separate staging bin from named bins
    const stagingBin = bins.find(bin => bin.name === 'staging');
    const namedBins = bins.filter(bin => bin.name !== 'staging');

    // Add staging bin first if it exists
    if (stagingBin) {
      choices.push({
        name: `📋 Add to staging (temporary)`,
        value: 'staging',
        description: `Add to temporary staging area (${stagingBin.chatCount} chat${stagingBin.chatCount !== 1 ? 's' : ''})`,
      });
    }

    // Add named bins
    namedBins.forEach(bin => {
      choices.push({
        name: `📋 Add to "${bin.name}" (${bin.chatCount} chat${bin.chatCount !== 1 ? 's' : ''}${bin.isActive ? ' - active' : ''})`,
        value: bin.name,
        description: bin.description || `Add to "${bin.name}" bin`,
      });
    });

    // Add option to create new bin
    choices.push({
      name: '+ Create new bin',
      value: 'create-new',
      description: 'Create a new named bin for organization',
    });

    return await select({
      message,
      choices,
    });
  }

  /**
   * Prompt for staging bin actions
   * @param {number} chatCount - Number of chats in staging
   * @returns {Promise<string>} Selected action
   */
  static async promptStagingBinAction(chatCount = 0) {
    const message =
      chatCount > 0
        ? `📋 Staging bin contains ${chatCount} chat${chatCount !== 1 ? 's' : ''}. What would you like to do?`
        : '📋 Staging bin is empty. What would you like to do?';

    const choices = [
      {
        name: '+ Create new bin',
        value: 'create-new',
        description: 'Create a new named bin and move chats there',
      },
    ];

    // Add bin options if they exist
    // Note: This would need BinManager instance to get available bins
    // For now, just show create option

    if (chatCount > 0) {
      choices.unshift({
        name: '💾 Keep in staging for later',
        value: 'keep-staging',
        description: 'Leave chats in staging area for future organization',
      });

      choices.push({
        name: '🗑️ Clear staging bin',
        value: 'clear-staging',
        description: 'Remove all chats from staging area',
      });
    }

    return await select({
      message,
      choices,
    });
  }
}

module.exports = { CliPrompts };
