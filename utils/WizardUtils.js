const { input, select, confirm, checkbox } = require('@inquirer/prompts');
const chalk = require('chalk');
const { createProgressManager } = require('./ProgressManager');

/**
 * Wizard utility for complex CLI workflows
 * Provides progressive disclosure, conditional prompts, and state management
 */
class WizardUtils {
  /**
   * Create a formatted wizard step indicator for user display
   * @param {number} currentStep - Current step number (1-based indexing)
   * @param {number} totalSteps - Total number of steps in the wizard
   * @param {string} stepName - Human-readable name of current step
   * @returns {string} Formatted step indicator with progress and step name
   * @example
   * const indicator = WizardUtils.getStepIndicator(2, 5, 'User Information');
   * // Returns: "[2/5] User Information" (with colors applied)
   */
  static getStepIndicator(currentStep, totalSteps, stepName) {
    const progress = `[${currentStep}/${totalSteps}]`;
    const stepNameFormatted = chalk.blue(stepName);
    return `${chalk.dim(progress)} ${stepNameFormatted}`;
  }

  /**
   * Execute a multi-step wizard with progress tracking and error handling
   * @param {Array<Object>} steps - Array of step configuration objects in execution order
   * @param {Object} [context={}] - Initial context object with pre-populated values
   * @returns {Promise<Object>} Promise resolving to final context object with all collected answers
   * @throws {Error} If any step execution fails, with step number included in error context
   * @example
   * const steps = [
   *   { name: 'name', type: 'input', message: 'Enter name:' },
   *   { name: 'confirm', type: 'confirm', message: 'Confirm?' }
   * ];
   * const result = await WizardUtils.executeWizard(steps, { initial: 'value' });
   */
  static async executeWizard(steps, context = {}) {
    const pm = createProgressManager(null, false);
    const totalSteps = steps.length;
    let currentStep = 0;

    try {
      for (const step of steps) {
        currentStep++;
        const stepIndicator = this.getStepIndicator(currentStep, totalSteps, step.name);

        console.log(chalk.dim('\n' + '─'.repeat(50)));
        console.log(stepIndicator);

        // Execute step with conditional logic
        if (step.when && !step.when(context)) {
          continue; // Skip this step
        }

        // Validate required context for certain steps
        if (step.name === 'selectedChats' && !context.dumpsterName) {
          throw new Error('No dumpster selected. Please select a dumpster first.');
        }

        const stepResult = await this.executeStep(step, context);

        // Merge step result into context
        Object.assign(context, stepResult);

        // Show step completion if specified
        if (step.onComplete) {
          step.onComplete(context);
        }
      }

      console.log(chalk.dim('\n' + '─'.repeat(50)));
      console.log(chalk.green('✅ Wizard completed successfully!'));

      return context;
    } catch (error) {
      pm.fail(`Wizard failed at step ${currentStep}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a single wizard step by delegating to the appropriate prompt handler
   * @param {Object} step - Step configuration object
   * @param {string} step.type - Type of prompt ('select', 'checkbox', 'confirm', 'input')
   * @param {string} step.name - Name of the context property to store the result
   * @param {string|Function} step.message - Prompt message or function that returns a message
   * @param {*} [step.default] - Default value for the prompt
   * @param {Function} [step.validate] - Validation function for user input
   * @param {Array|Function} [step.choices] - Array of choices or function that returns choices (for select/checkbox)
   * @param {Function} [step.when] - Conditional function to determine if step should execute
   * @param {Function} [step.onComplete] - Callback function executed after step completion
   * @param {Object} _context - Current wizard context containing previous answers (unused)
   * @returns {Promise<Object>} Promise resolving to object with the step result mapped to step name
   * @throws {Error} If step.type is not one of the supported prompt types
   */
  static async executeStep(step, _context) {
    const { type } = step;

    // Handle different prompt types
    switch (type) {
      case 'select':
        return this.executeSelect(step, _context);
      case 'checkbox':
        return this.executeCheckbox(step, _context);
      case 'confirm':
        return this.executeConfirm(step, _context);
      case 'input':
        return this.executeInput(step, _context);
      default:
        throw new Error(`Unknown wizard step type: ${type}`);
    }
  }

  /**
   * Execute an input prompt step with text input from user
   * @param {Object} step - Step configuration object
   * @param {string} step.name - Name of the context property to store the result
   * @param {string|Function} step.message - Prompt message or function that returns a message
   * @param {string} [step.default] - Default value for the input
   * @param {Function} [step.validate] - Validation function for the input
   * @param {Object} context - Current wizard context containing previous answers
   * @returns {Promise<Object>} Promise resolving to object with the step result
   * @example
   * const result = await WizardUtils.executeInput({
   *   name: 'username',
   *   message: 'Enter your username:',
   *   validate: input => input.length > 0 || 'Username is required'
   * }, context);
   */
  static async executeInput(step, context) {
    const message =
      typeof step.message === 'function' ? step.message(context) : step.message;

    const result = await input({
      message,
      default: step.default,
      validate: step.validate,
    });

    return { [step.name]: result };
  }

  /**
   * Execute a checkbox prompt step for multi-select options
   * @param {Object} step - Step configuration object
   * @param {string} step.name - Name of the context property to store the result
   * @param {string|Function} step.message - Prompt message or function that returns a message
   * @param {Array<Object>|Function} step.choices - Array of choice objects or function that returns choices
   * @param {Array} [step.default] - Default selected choices
   * @param {Object} context - Current wizard context containing previous answers
   * @returns {Promise<Object>} Promise resolving to object with the array of selected choices
   * @example
   * const result = await WizardUtils.executeCheckbox({
   *   name: 'features',
   *   message: 'Select features:',
   *   choices: [
   *     { name: 'Feature A', value: 'a' },
   *     { name: 'Feature B', value: 'b' }
   *   ]
   * }, context);
   */
  static async executeCheckbox(step, context) {
    const choices =
      typeof step.choices === 'function' ? await step.choices(context) : step.choices;

    const message =
      typeof step.message === 'function' ? step.message(context) : step.message;

    const result = await checkbox({
      message,
      choices,
      default: step.default,
    });

    return { [step.name]: result };
  }

  /**
   * Execute a confirm prompt step for yes/no questions
   * @param {Object} step - Step configuration object
   * @param {string} step.name - Name of the context property to store the result
   * @param {string|Function} step.message - Prompt message or function that returns a message
   * @param {boolean} [step.default=false] - Default value if user doesn't provide input
   * @param {Object} context - Current wizard context containing previous answers
   * @returns {Promise<Object>} Promise resolving to object with the boolean result
   * @example
   * const result = await WizardUtils.executeConfirm({
   *   name: 'confirm',
   *   message: 'Do you want to continue?',
   *   default: true
   * }, context);
   */
  static async executeConfirm(step, context) {
    const message =
      typeof step.message === 'function' ? step.message(context) : step.message;

    const result = await confirm({
      message,
      default: step.default || false,
    });

    return { [step.name]: result };
  }

  /**
   * Execute a select prompt step for single-choice selection
   * @param {Object} step - Step configuration object
   * @param {string} step.name - Name of the context property to store the result
   * @param {string|Function} step.message - Prompt message or function that returns a message
   * @param {Array<Object>|Function} step.choices - Array of choice objects or function that returns choices
   * @param {string|number} [step.default] - Default choice value
   * @param {Object} context - Current wizard context containing previous answers
   * @returns {Promise<Object>} Promise resolving to object with the selected choice value
   * @example
   * const result = await WizardUtils.executeSelect({
   *   name: 'action',
   *   message: 'Choose an action:',
   *   choices: [
   *     { name: 'Create', value: 'create' },
   *     { name: 'Delete', value: 'delete' }
   *   ]
   * }, context);
   */
  static async executeSelect(step, context) {
    const choices =
      typeof step.choices === 'function' ? await step.choices(context) : step.choices;

    const message =
      typeof step.message === 'function' ? step.message(context) : step.message;

    const result = await select({
      message,
      choices,
      default: step.default,
    });

    return { [step.name]: result };
  }

  /**
   * Create a conditional prompt that only shows based on context evaluation
   * @param {Function} condition - Function that takes context and returns boolean to determine if step should show
   * @param {Object} step - Step configuration object to conditionally execute
   * @returns {Object} Step configuration with conditional logic attached
   * @example
   * const conditionalStep = WizardUtils.conditional(
   *   ctx => ctx.needsAdvanced,
   *   {
   *     name: 'advancedOption',
   *     type: 'confirm',
   *     message: 'Enable advanced features?'
   *   }
   * );
   */
  static conditional(condition, step) {
    return {
      ...step,
      when: context => condition(context),
    };
  }

  /**
   * Create a step with dynamic choices that are generated based on current context
   * @param {Function} choiceFunction - Function that takes context and returns array of choices
   * @param {Object} step - Step configuration object to modify
   * @returns {Object} Step configuration with dynamic choice generation
   * @example
   * const dynamicStep = WizardUtils.dynamicChoices(
   *   ctx => ctx.availableOptions.map(opt => ({ name: opt.label, value: opt.value })),
   *   {
   *     name: 'selection',
   *     type: 'select',
   *     message: 'Choose an option:'
   *   }
   * );
   */
  static dynamicChoices(choiceFunction, step) {
    return {
      ...step,
      choices: choiceFunction,
    };
  }

  /**
   * Create a reusable wizard for rummaging through dumpsters
   * @param {DumpsterManager} dm - Dumpster Manager instance for accessing chat data and search functionality
   * @param {BinManager} bm - Bin Manager instance for managing selection bins
   * @param {Array<Object>} dumpsters - Array of dumpster objects with name and chatCount properties
   * @returns {Array<Object>} Array of wizard step configurations for the rummaging workflow
   */
  static createRummageWizard(dm, bm, dumpsters) {
    return [
      // Step 1: Choose dumpster or use provided one
      this.conditional(ctx => !ctx.dumpsterName, {
        name: 'dumpsterName',
        type: 'select',
        message: '🗑️ Select a dumpster to rummage through:',
        choices: dumpsters.map(d => ({
          name: `${d.name} (${d.chatCount || '?'} chats)`,
          value: d.name,
        })),
      }),

      // Step 2: Choose action type
      {
        name: 'actionType',
        type: 'select',
        message: '🎯 What do you want to do?',
        choices: [
          { name: '🔍 Search for specific chats', value: 'search' },
          { name: '📋 Browse recent chats', value: 'browse' },
          { name: '📦 Manage selection bin', value: 'manage' },
        ],
      },

      // Step 3: Search configuration (conditional)
      this.conditional(ctx => ctx.actionType === 'search', {
        name: 'searchQuery',
        type: 'input',
        message: '🔍 Enter search query (leave empty to show all):',
        default: '',
      }),

      // Step 4: Search options (conditional)
      this.conditional(ctx => ctx.actionType === 'search' && ctx.searchQuery?.trim(), {
        name: 'searchScope',
        type: 'select',
        message: '📋 Search scope:',
        choices: [
          { name: '🔤 Search in titles and messages', value: 'all' },
          { name: '📝 Search in titles only', value: 'title' },
          { name: '💬 Search in message content only', value: 'content' },
        ],
        default: 'all',
      }),

      // Step 5: Case sensitivity (conditional)
      this.conditional(ctx => ctx.actionType === 'search' && ctx.searchQuery?.trim(), {
        name: 'caseSensitive',
        type: 'confirm',
        message: '🔤 Case sensitive search?',
        default: false,
      }),

      // Step 6: Chat limit for browsing (conditional)
      this.conditional(ctx => ctx.actionType === 'browse', {
        name: 'chatLimit',
        type: 'input',
        message: '📊 How many chats would you like to see? (leave empty for all):',
        default: '',
        validate: input => {
          if (input.trim() === '') return true;
          const num = parseInt(input);
          if (isNaN(num)) return 'Please enter a number or leave empty for all';
          if (num < 1) return 'Must show at least 1 chat';
          if (num > 100) return 'Maximum 100 chats at once';
          return true;
        },
      }),

      // Step 7: Chat selection
      {
        name: 'selectedChats',
        type: 'checkbox',
        message: ctx =>
          `📋 Select chats to ${ctx.actionType === 'manage' ? 'manage' : 'process'}:`,
        choices: async ctx => {
          try {
            // dumpsterName should always be available due to conditional selection step
            if (!ctx.dumpsterName) {
              console.error(
                chalk.red('❌ No dumpster selected. Please select a dumpster first.')
              );
              return [];
            }
            const dumpsterName = ctx.dumpsterName;

            let searchResults;
            if (ctx.actionType === 'search') {
              if (ctx.searchQuery?.trim()) {
                const searchResponse = await dm.searchChats(
                  dumpsterName,
                  ctx.searchQuery,
                  { scope: ctx.searchScope, caseSensitive: ctx.caseSensitive }
                );
                searchResults = searchResponse.results || [];
              } else {
                // Show all chats
                const limit = ctx.chatLimit ? parseInt(ctx.chatLimit) : 50;
                const chats = await dm.getChats(dumpsterName, limit);
                searchResults = chats.map((chat, index) => ({
                  chat,
                  searchResult: { matchCount: 0, relevanceScore: 0, matches: [] },
                  rank: index,
                }));
              }
            } else if (ctx.actionType === 'browse') {
              const limit = ctx.chatLimit ? parseInt(ctx.chatLimit) : 50;
              const chats = await dm.getChats(dumpsterName, limit);
              searchResults = chats.map((chat, index) => ({
                chat,
                searchResult: { matchCount: 0, relevanceScore: 0, matches: [] },
                rank: index,
              }));
            } else {
              // For manage action, show selection bin contents
              const bins = bm.listBins();
              const activeBin = bins.find(bin => bin.isActive);
              if (activeBin) {
                const chatsByDumpster = bm.getBinChatsByDumpster(activeBin.name);
                const allChats = Object.values(chatsByDumpster).flat();
                searchResults = allChats.map(chat => ({
                  chat,
                  searchResult: { matchCount: 0, relevanceScore: 0, matches: [] },
                  rank: 0,
                }));
              } else {
                searchResults = [];
              }
            }

            return searchResults.map((result, index) => {
              const chat = result.chat;
              const title = chat.title || 'Untitled Chat';
              const timestamp = chat.update_time || chat.create_time;
              const dateStr = timestamp
                ? new Date(timestamp * 1000).toLocaleDateString()
                : 'Unknown date';

              let matchInfo = '';
              if (result.searchResult && result.searchResult.matchCount > 0) {
                matchInfo = ` - ${result.searchResult.matchCount} match${result.searchResult.matchCount !== 1 ? 'es' : ''}`;
              }

              return {
                name: `${index + 1}. ${title} (${dateStr})${matchInfo}`,
                value: chat.filename,
              };
            });
          } catch (error) {
            console.error(chalk.red(`❌ Failed to load chats: ${error.message}`));
            return []; // Return empty choices on error
          }
        },
      },

      // Step 8: Action on selected chats (conditional)
      this.conditional(ctx => ctx.selectedChats && ctx.selectedChats.length > 0, {
        name: 'selectedAction',
        type: 'select',
        message: ctx =>
          `🎯 What do you want to do with ${ctx.selectedChats.length} selected chat${ctx.selectedChats.length !== 1 ? 's' : ''}?`,
        choices: [
          { name: '📋 Add to selection bin', value: 'add-to-bin' },
          { name: '🔄 Export/Upcycle selected chats', value: 'upcycle' },
          { name: '🔍 Start new search', value: 'new-search' },
          { name: '🗑️ Switch dumpster', value: 'switch-dumpster' },
          { name: '👋 Quit', value: 'quit' },
        ],
      }),

      // Step 9: Continue or quit (conditional)
      this.conditional(ctx => ctx.selectedChats && ctx.selectedChats.length === 0, {
        name: 'emptySelectionAction',
        type: 'select',
        message: 'No chats selected. What would you like to do?',
        choices: [
          { name: '🔍 Start new search', value: 'new-search' },
          { name: '🗑️ Switch dumpster', value: 'switch-dumpster' },
          { name: '👋 Quit', value: 'quit' },
        ],
      }),
    ];
  }
}

module.exports = { WizardUtils };
