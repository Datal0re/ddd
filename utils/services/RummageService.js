/**
 * Rummage Service
 * Extracted business logic for rummage command
 * Handles wizard orchestration, search result processing, and chat selection
 */

const { BaseCommandService } = require('./BaseCommandService');
const { WizardUtils } = require('../WizardUtils');
const { CliPrompts } = require('../CliPrompts');
const chalk = require('chalk');

/**
 * Service for handling rummage (search and selection) operations
 * Extracted from CLI rummage command handler
 */
class RummageService extends BaseCommandService {
  /**
   * Perform wizard-based rummaging through dumpsters
   * @param {string} initialDumpsterName - Initial dumpster name (optional)
   * @param {Object} options - Command options
   * @param {Object} managers - Required managers (dumpster, bin)
   * @returns {Promise<Object>} Result object
   */
  async performWizardRummage(initialDumpsterName, options = {}) {
    const managers = this.getManagers(['dumpster', 'bin', 'progress']);
    try {
      // Get available dumpsters
      const dumpsters = await managers.dumpster.listDumpsters();

      if (dumpsters.length === 0) {
        console.log(
          chalk.yellow('No dumpsters found. Use "ddd dump" to process a ZIP file.')
        );
        return this.createResult(true, null, 'No dumpsters available');
      }

      // Display welcome message
      this.displayWizardWelcome();

      let continueRummaging = true;
      let currentDumpsterName = initialDumpsterName;

      while (continueRummaging) {
        // Execute wizard step
        const wizardResult = await this.executeWizardStep(
          managers,
          dumpsters,
          currentDumpsterName,
          options
        );

        // Process wizard results
        await this.processWizardResults(wizardResult, managers);

        // Determine if user wants to continue
        const action = wizardResult.selectedAction || wizardResult.emptySelectionAction;

        continueRummaging = this.shouldContinueRummaging(action);

        if (continueRummaging) {
          currentDumpsterName = this.getNextDumpsterName(action, currentDumpsterName);
        }
      }

      console.log(chalk.blue('\n👋 Happy rummaging!'));
      return this.createResult(true, null, 'Rummage completed successfully');
    } catch (error) {
      return this.createResult(false, null, 'Rummage wizard failed', error);
    }
  }

  /**
   * Display wizard welcome message
   */
  displayWizardWelcome() {
    console.log(chalk.blue('\n🧙‍♂️ Welcome to the Rummage Wizard!'));
    console.log(
      chalk.dim('This wizard will guide you through searching and selecting chats.')
    );
  }

  /**
   * Execute a single wizard step
   * @param {Object} managers - Required managers
   * @param {Array} dumpsters - Available dumpsters
   * @param {string} currentDumpsterName - Current dumpster name
   * @param {Object} options - Command options
   * @returns {Object} Wizard result
   */
  async executeWizardStep(managers, dumpsters, currentDumpsterName, options) {
    const initialContext = {
      dumpsterName: currentDumpsterName,
      verbose: options.verbose,
      actionType: null,
      selectedChats: [],
      selectedAction: null,
      emptySelectionAction: null,
    };

    return await WizardUtils.executeWizard(
      WizardUtils.createRummageWizard(managers.dumpster, managers.bin, dumpsters),
      initialContext
    );
  }

  /**
   * Process wizard results and execute appropriate actions
   * @param {Object} wizardResult - Results from wizard execution
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Processing result
   */
  async processWizardResults(wizardResult, managers) {
    const { dumpsterName, selectedChats, selectedAction, emptySelectionAction } =
      wizardResult;
    const action = selectedAction || emptySelectionAction;

    // Handle empty selection
    if (!selectedChats || selectedChats.length === 0) {
      return this.handleEmptySelection(action);
    }

    // Process selected action with chats
    return this.processActionWithChats(action, selectedChats, dumpsterName, managers);
  }

  /**
   * Handle empty selection scenarios
   * @param {string} action - Selected action
   * @returns {Object} Processing result
   */
  handleEmptySelection(action) {
    switch (action) {
      case 'new-search':
        console.log(chalk.blue('↻ Preparing new search...'));
        return { action: 'new-search', handled: true };

      case 'switch-dumpster':
        console.log(chalk.blue('🗑️ Switching dumpster...'));
        return { action: 'switch-dumpster', handled: true };

      case 'quit':
        console.log(chalk.blue('👋 Exiting rummage wizard...'));
        return { action: 'quit', handled: true };

      default:
        return { action, handled: false, message: `Unknown action: ${action}` };
    }
  }

  /**
   * Process action with selected chats
   * @param {string} action - Selected action
   * @param {Array} selectedChats - Selected chat objects
   * @param {string} dumpsterName - Source dumpster name
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Processing result
   */
  async processActionWithChats(action, selectedChats, dumpsterName, managers) {
    try {
      switch (action) {
        case 'add-to-bin':
          return await this.handleAddToBin(managers.bin, selectedChats, dumpsterName);

        case 'upcycle':
          return await this.handleUpcycleSelected(
            managers,
            selectedChats,
            dumpsterName
          );

        case 'new-search':
          console.log(chalk.blue('↻ Preparing new search...'));
          return { action: 'new-search', handled: true };

        case 'switch-dumpster':
          console.log(chalk.blue('🗑️ Switching dumpster...'));
          return { action: 'switch-dumpster', handled: true };

        case 'quit':
          console.log(chalk.blue('👋 Exiting rummage wizard...'));
          return { action: 'quit', handled: true };

        default:
          console.log(chalk.yellow(`⚠️ Unknown or unhandled action: ${action}`));
          return { action, handled: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      console.error(
        chalk.red(`❌ Failed to process action ${action}: ${error.message}`)
      );
      return { action, handled: false, error };
    }
  }

  /**
   * Handle adding chats to selection bin
   * @param {BinManager} binManager - Bin manager instance
   * @param {Array} selectedChats - Selected chat objects
   * @param {string} dumpsterName - Source dumpster name
   * @returns {Promise<Object>} Result object
   */
  async handleAddToBin(binManager, selectedChats, dumpsterName) {
    try {
      const targetBin = await this.addChatsToSelection(
        binManager,
        selectedChats,
        dumpsterName
      );

      console.log(
        chalk.green(
          `✅ Added ${selectedChats.length} chat${selectedChats.length !== 1 ? 's' : ''} to "${targetBin}" bin`
        )
      );

      return {
        action: 'add-to-bin',
        handled: true,
        targetBin,
        chatCount: selectedChats.length,
      };
    } catch (error) {
      console.error(chalk.red(`❌ Failed to add chats to bin: ${error.message}`));
      return {
        action: 'add-to-bin',
        handled: false,
        error,
      };
    }
  }

  /**
   * Handle upcycling selected chats
   * @param {Object} managers - Required managers
   * @param {Array} selectedChats - Selected chat objects
   * @param {string} dumpsterName - Source dumpster name
   * @returns {Promise<Object>} Result object
   */
  async handleUpcycleSelected(managers, selectedChats, dumpsterName) {
    try {
      // Temporarily add selected chats to selection bin
      await this.addChatsToSelection(managers.bin, selectedChats, dumpsterName);

      console.log(chalk.blue('🔄 Starting upcycle with selected chats...'));

      const UpcycleManager = require('./UpcycleManager');
      const upcycleManager = new UpcycleManager(managers.dumpster, managers.progress);

      const format = await CliPrompts.selectExportFormat();
      const result = await upcycleManager.upcycleSelection(format, {
        includeMedia: true,
        verbose: true,
      });

      // Display results
      const { generateExportReport } = require('./upcycleHelpers');
      const report = generateExportReport(result, true);
      console.log(report);

      return {
        action: 'upcycle',
        handled: true,
        format,
        result,
      };
    } catch (error) {
      console.error(chalk.red(`❌ Failed to upcycle selected chats: ${error.message}`));
      return {
        action: 'upcycle',
        handled: false,
        error,
      };
    }
  }

  /**
   * Add selected chats to selection bin
   * @param {BinManager} binManager - Bin manager instance
   * @param {Array} selectedChats - Selected chat objects
   * @param {string} dumpsterName - Source dumpster name
   * @returns {Promise<string>} Target bin name
   */
  async addChatsToSelection(binManager, selectedChats, dumpsterName) {
    const availableBins = binManager.listBins();

    // If only one bin (default), use it directly
    if (availableBins.length === 1) {
      const chatData = this.prepareChatData(selectedChats, dumpsterName);
      await binManager.addChatsToActiveBin(chatData, dumpsterName);
      return availableBins[0].name;
    }

    // Prompt user to select which bin to add to
    const selectedBinName = await CliPrompts.selectBinForSelection(
      availableBins,
      selectedChats.length
    );

    let targetBinName = selectedBinName;

    // If user wants to create a new bin
    if (selectedBinName === 'create-new') {
      const newBinName = await CliPrompts.promptNewBinName();
      await binManager.createBin(
        newBinName,
        `Created during rummage from ${dumpsterName}`
      );
      targetBinName = newBinName;
    }

    // Prepare chat data
    const chatData = this.prepareChatData(selectedChats, dumpsterName);

    // Add to the selected bin
    if (targetBinName === binManager.getActiveBinName()) {
      await binManager.addChatsToActiveBin(chatData, dumpsterName);
    } else {
      await binManager.addChatsToBin(chatData, targetBinName, dumpsterName);
    }

    return targetBinName;
  }

  /**
   * Prepare chat data for bin addition
   * @param {Array} selectedChats - Selected chat objects
   * @param {string} dumpsterName - Source dumpster name
   * @returns {Array} Prepared chat data array
   */
  prepareChatData(selectedChats, dumpsterName) {
    return selectedChats.map(chat => ({
      chatId: chat.filename,
      filename: chat.filename,
      title: chat.title || 'Untitled',
      sourceDumpster: dumpsterName,
      addedAt: Date.now(),
      metadata: {
        messageCount: chat.messageCount || 0,
        createTime: chat.create_time,
        updateTime: chat.update_time,
        preview: chat.title || 'Untitled',
      },
    }));
  }

  /**
   * Determine if user wants to continue rummaging
   * @param {string} action - Action taken
   * @returns {boolean} Whether to continue
   */
  shouldContinueRummaging(action) {
    return !['quit', 'upcycle'].includes(action);
  }

  /**
   * Get next dumpster name for continued rummaging
   * @param {string} action - Current action
   * @param {string} currentDumpsterName - Current dumpster name
   * @returns {string|null} Next dumpster name
   */
  getNextDumpsterName(action, currentDumpsterName) {
    if (['new-search', 'switch-dumpster'].includes(action)) {
      return null; // Reset for new selection
    }

    return currentDumpsterName;
  }

  /**
   * Get rummage command statistics
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      name: 'RummageService',
      version: '1.0.0',
      description: 'Handles wizard-guided search and chat selection',
      capabilities: [
        'wizard orchestration',
        'search result processing',
        'chat selection handling',
        'bin integration',
        'export workflow',
        'interactive workflows',
      ],
      wizardFeatures: [
        'search with options',
        'multi-select checkboxes',
        'action menus',
        'bin management',
        'export integration',
      ],
      complexity: 'high - wizard-based workflow',
    };
  }
}

module.exports = {
  RummageService,
};
