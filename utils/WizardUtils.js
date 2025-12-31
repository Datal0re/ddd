const { input, select, confirm, checkbox } = require('@inquirer/prompts');
const chalk = require('chalk');
const { createProgressManager } = require('./ProgressManager');

/**
 * Wizard utility for complex CLI workflows
 * Provides progressive disclosure, conditional prompts, and state management
 */
class WizardUtils {
  /**
   * Create a wizard step indicator
   * @param {number} currentStep - Current step number (1-based)
   * @param {number} totalSteps - Total number of steps
   * @param {string} stepName - Name of current step
   * @returns {string} Formatted step indicator
   */
  static getStepIndicator(currentStep, totalSteps, stepName) {
    const progress = `[${currentStep}/${totalSteps}]`;
    const stepNameFormatted = chalk.blue(stepName);
    return `${chalk.dim(progress)} ${stepNameFormatted}`;
  }

  /**
   * Execute a multi-step wizard
   * @param {Array} steps - Array of step configurations
   * @param {Object} context - Initial context object
   * @returns {Promise<Object>} Final context with all answers
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
   * Execute a single wizard step
   * @param {Object} step - Step configuration
   * @param {Object} _context - Current wizard context (unused)
   * @returns {Promise<Object>} Step result
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
   * Execute a select prompt step
   */
  static async executeSelect(step, _context) {
    const choices =
      typeof step.choices === 'function' ? step.choices(_context) : step.choices;

    const result = await select({
      message: step.message,
      choices,
      default: step.default,
    });

    return { [step.name]: result };
  }

  /**
   * Execute a checkbox prompt step
   */
  static async executeCheckbox(step, _context) {
    const choices =
      typeof step.choices === 'function' ? step.choices(_context) : step.choices;

    const result = await checkbox({
      message: step.message,
      choices,
      default: step.default,
    });

    return { [step.name]: result };
  }

  /**
   * Execute a confirm prompt step
   */
  static async executeConfirm(step, _context) {
    const result = await confirm({
      message: step.message,
      default: step.default || false,
    });

    return { [step.name]: result };
  }

  /**
   * Execute an input prompt step
   */
  static async executeInput(step, _context) {
    const result = await input({
      message: step.message,
      default: step.default,
      validate: step.validate,
    });

    return { [step.name]: result };
  }

  /**
   * Create a conditional prompt that only shows based on context
   */
  static conditional(condition, step) {
    return {
      ...step,
      when: context => condition(context),
    };
  }

  /**
   * Create a step with dynamic choices based on context
   */
  static dynamicChoices(choiceFunction, step) {
    return {
      ...step,
      choices: choiceFunction,
    };
  }

  /**
   * Create a reusable wizard for rummaging through dumpsters
   */
  static createRummageWizard(dumpsterManager, binManager, dumpsters) {
    return [
      // Step 1: Choose dumpster or use provided one
      this.conditional(ctx => !ctx.dumpsterName, {
        name: 'dumpsterSelection',
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
          const dumpsterName = ctx.dumpsterName || dumpsterName;

          let searchResults;
          if (ctx.actionType === 'search') {
            if (ctx.searchQuery?.trim()) {
              searchResults = await dumpsterManager.searchChats(
                dumpsterName,
                ctx.searchQuery,
                { scope: ctx.searchScope, caseSensitive: ctx.caseSensitive }
              );
            } else {
              // Show all chats
              const limit = ctx.chatLimit ? parseInt(ctx.chatLimit) : 50;
              const chats = await dumpsterManager.getChats(dumpsterName, limit);
              searchResults = chats.map((chat, index) => ({
                chat,
                searchResult: { matchCount: 0, relevanceScore: 0, matches: [] },
                rank: index,
              }));
            }
          } else if (ctx.actionType === 'browse') {
            const limit = ctx.chatLimit ? parseInt(ctx.chatLimit) : 50;
            const chats = await dumpsterManager.getChats(dumpsterName, limit);
            searchResults = chats.map((chat, index) => ({
              chat,
              searchResult: { matchCount: 0, relevanceScore: 0, matches: [] },
              rank: index,
            }));
          } else {
            // For manage action, show selection bin contents
            const bins = binManager.listBins();
            const activeBin = bins.find(bin => bin.isActive);
            if (activeBin) {
              const chatsByDumpster = binManager.getBinChatsByDumpster(activeBin.name);
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
