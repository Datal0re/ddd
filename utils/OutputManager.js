/*
 * OutputManager.js - Unified console output management
 * Provides consistent formatting and messaging across all CLI operations
 */

const chalk = require('chalk');

/**
 * Context mapping for human-readable command names
 */
const CONTEXT_MAPPING = {
  dump: 'Dump command',
  hoard: 'Hoard command',
  rummage: 'Rummage command',
  burn: 'Burn command',
  upcycle: 'Upcycle command',
  bin: 'Bin operation',
  selection: 'Selection operation',
  search: 'Search operation',
  validation: 'Validation',
  extraction: 'Extraction',
  processing: 'Processing',
};

/**
 * Unified output management class
 * Provides consistent formatting and messaging patterns across the CLI
 */
class OutputManager {
  /**
   * Global configuration for output behavior
   */
  static config = {
    showSuggestions: true,
    showContext: true,
    verboseMode: false,
  };

  /**
   * Configure global output behavior
   * @param {Object} options - Configuration options
   */
  static configure(options = {}) {
    this.config = { ...this.config, ...options };
  }

  /**
   * Format context string for display
   * @param {string} context - Raw context
   * @returns {string} Formatted context
   */
  static formatContext(context) {
    if (!context || !this.config.showContext) {
      return '';
    }

    const formattedContext = CONTEXT_MAPPING[context] || context;
    return `${formattedContext}: `;
  }

  /**
   * Log success messages with consistent formatting
   * @param {string} message - Success message
   * @param {string} context - Optional context
   * @param {string} suggestion - Optional suggestion
   */
  static success(message, context = null, suggestion = null) {
    const fullMessage = this.formatContext(context) + message;
    console.log(chalk.green(`✅ ${fullMessage}`));

    if (suggestion && this.config.showSuggestions) {
      console.log(chalk.dim(`💡 ${suggestion}`));
    }
  }

  /**
   * Log error messages with consistent formatting
   * @param {string} message - Error message
   * @param {string} context - Optional context
   * @param {string} suggestion - Optional suggestion for recovery
   */
  static error(message, context = null, suggestion = null) {
    const fullMessage = this.formatContext(context) + message;
    console.error(chalk.red(`❌ Error: ${fullMessage}`));

    if (suggestion && this.config.showSuggestions) {
      console.error(chalk.yellow(`💡 ${suggestion}`));
    }
  }

  /**
   * Log warning messages with consistent formatting
   * @param {string} message - Warning message
   * @param {string} context - Optional context
   */
  static warning(message, context = null) {
    const fullMessage = this.formatContext(context) + message;
    console.warn(chalk.yellow(`⚠️ ${fullMessage}`));
  }

  /**
   * Log info messages with consistent formatting
   * @param {string} message - Info message
   * @param {string} context - Optional context
   */
  static info(message, context = null) {
    const fullMessage = this.formatContext(context) + message;
    console.log(chalk.blue(`ℹ️ ${fullMessage}`));
  }

  /**
   * Log progress messages with consistent formatting
   * @param {string} message - Progress message
   * @param {string} context - Optional context
   */
  static progress(message, context = null) {
    const fullMessage = this.formatContext(context) + message;
    console.log(chalk.blue(`⏳ ${fullMessage}`));
  }

  /**
   * Log step indicators for multi-step processes
   * @param {string} message - Step description
   * @param {number} stepNumber - Current step number
   * @param {number} totalSteps - Total number of steps
   * @param {string} context - Optional context
   */
  static step(message, stepNumber = null, totalSteps = null, context = null) {
    const prefix =
      stepNumber && totalSteps
        ? `Step ${stepNumber}/${totalSteps}:`
        : stepNumber
          ? `Step ${stepNumber}:`
          : '';
    const fullMessage =
      this.formatContext(context) + prefix + (prefix ? ' ' : '') + message;
    console.log(chalk.blue(`📍 ${fullMessage}`));
  }

  /**
   * Log wizard-specific messages
   * @param {string} message - Wizard message
   * @param {string} context - Optional context
   */
  static wizard(message, context = null) {
    const fullMessage = this.formatContext(context) + message;
    console.log(chalk.blue(`🧙‍♂️ ${fullMessage}`));
  }

  /**
   * Display formatted reports and data
   * @param {Object|Array} data - Data to display
   * @param {string} title - Optional title for the report
   * @param {string} context - Optional context
   */
  static report(data, title = null, context = null) {
    if (title) {
      console.log(chalk.bold(`\n📊 ${title}`));
    }

    if (context) {
      console.log(chalk.dim(`${this.formatContext(context)}`));
    }

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        console.log(chalk.dim(`  ${index + 1}. ${item}`));
      });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        console.log(chalk.dim(`  ${key}: ${value}`));
      });
    } else {
      console.log(chalk.dim(`  ${data}`));
    }

    console.log(); // Add spacing
  }

  /**
   * Display formatted lists with optional title and empty message
   * @param {Array} items - Items to display
   * @param {string} title - Optional title for the list
   * @param {string} emptyMessage - Message when list is empty
   * @param {string} context - Optional context
   */
  static list(items, title = null, emptyMessage = 'No items found', _context = null) {
    if (title) {
      console.log(chalk.blue(`\n📋 ${title}`));
    }

    if (items.length === 0) {
      console.log(chalk.yellow(emptyMessage));
    } else {
      items.forEach(item => {
        if (typeof item === 'string') {
          console.log(`  ${chalk.cyan('•')} ${item}`);
        } else if (item && typeof item === 'object') {
          const name = item.name || item.title || JSON.stringify(item);
          const description = item.description
            ? ` - ${chalk.dim(item.description)}`
            : '';
          console.log(`  ${chalk.cyan('•')} ${name}${description}`);
        } else {
          console.log(`  ${chalk.cyan('•')} ${JSON.stringify(item)}`);
        }
      });
    }

    console.log(); // Add spacing
  }

  /**
   * Display action-specific messages with consistent emoji usage
   * @param {string} action - Action type (burn, delete, create, etc.)
   * @param {string} message - Action message
   * @param {string} context - Optional context
   */
  static action(action, message, context = null) {
    const actionEmojis = {
      burn: '🔥',
      delete: '🗑️',
      create: '✨',
      export: '📤',
      import: '📥',
      search: '🔍',
      select: '☑️',
      cancel: '❌',
      complete: '✅',
      warning: '⚠️',
      info: 'ℹ️',
      default: '📍',
    };

    const emoji = actionEmojis[action] || actionEmojis.default;
    const fullMessage = this.formatContext(context) + message;
    console.log(chalk.blue(`${emoji} ${fullMessage}`));
  }

  /**
   * Display divider lines for visual separation
   * @param {number} length - Length of the divider
   * @param {string} character - Character to use for divider
   */
  static divider(length = 50, character = '─') {
    console.log(chalk.dim('\n' + character.repeat(length)));
  }

  /**
   * Execute a callback with temporary context
   * @param {string} context - Temporary context
   * @param {Function} callback - Function to execute
   * @returns {*} Result of callback execution
   */
  static withContext(context, callback) {
    const originalShowContext = this.config.showContext;
    const originalContext = this._temporaryContext;

    this._temporaryContext = context;
    this.config.showContext = true;

    try {
      return callback();
    } finally {
      this.config.showContext = originalShowContext;
      this._temporaryContext = originalContext;
    }
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  static getConfiguration() {
    return { ...this.config };
  }

  /**
   * Reset configuration to defaults
   */
  static resetConfiguration() {
    this.config = {
      showSuggestions: true,
      showContext: true,
      verboseMode: false,
    };
  }

  /**
   * Create a specialized logger for a specific context
   * @param {string} context - Default context for all messages
   * @returns {Object} Specialized logger instance
   */
  static createLogger(context) {
    return {
      success: (message, suggestion) => this.success(message, context, suggestion),
      error: (message, suggestion) => this.error(message, context, suggestion),
      warning: message => this.warning(message, context),
      info: message => this.info(message, context),
      progress: message => this.progress(message, context),
      step: (message, stepNum, total) => this.step(message, stepNum, total, context),
      action: (action, message) => this.action(action, message, context),
      report: (data, title) => this.report(data, title, context),
      list: (items, title, emptyMsg) => this.list(items, title, emptyMsg, context),
    };
  }
}

// Initialize with default configuration
OutputManager.resetConfiguration();

module.exports = {
  OutputManager,
};
