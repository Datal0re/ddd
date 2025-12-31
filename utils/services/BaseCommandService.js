/**
 * Base Command Service
 * Provides common functionality for all command services
 * Serves as foundation for consistent error handling, progress tracking, and manager coordination
 */

const { ErrorHandler } = require('../ErrorHandler');
const { createProgressManager } = require('../ProgressManager');

/**
 * Base class for all command services
 * Provides common patterns for error handling, progress tracking, and manager coordination
 */
class BaseCommandService {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.managers = new Map();
    this.progressManager = null;
  }

  /**
   * Initialize progress manager with options
   * @param {boolean} verbose - Whether to enable verbose output
   * @param {Function} onProgress - Progress callback function
   * @returns {Object} Progress manager instance
   */
  initializeProgressManager(verbose = false, onProgress = null) {
    this.progressManager = createProgressManager(onProgress, verbose);
    return this.progressManager;
  }

  /**
   * Handle command errors consistently
   * @param {Error} error - Error to handle
   * @param {string} commandContext - Context for error reporting
   * @param {Object} options - Additional error handling options
   */
  handleError(error, commandContext, options = {}) {
    // Fail progress if available
    if (this.progressManager && !options.skipProgressFail) {
      this.progressManager.fail(`${commandContext} failed: ${error.message}`);
    }

    // Handle error based on type
    if (options.shouldExit !== false) {
      ErrorHandler.handleErrorAndExit(error, commandContext);
    } else {
      ErrorHandler.logError(error.message, commandContext);
    }
  }

  /**
   * Validate and get required managers
   * @param {Array<string>} managerTypes - Array of manager types needed
   * @param {Map<string, Object>} availableManagers - Map of available managers
   * @returns {Object} Object containing required managers
   * @throws {Error} If required manager is not available
   */
  getRequiredManagers(managerTypes, availableManagers) {
    const required = {};
    const missing = [];

    for (const type of managerTypes) {
      if (availableManagers.has(type)) {
        required[type] = availableManagers.get(type);
      } else {
        missing.push(type);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Required managers not available: ${missing.join(', ')}`);
    }

    return required;
  }

  /**
   * Create a standardized result object
   * @param {boolean} success - Whether operation was successful
   * @param {any} data - Result data if successful
   * @param {string} message - Result message
   * @param {Error} error - Error if unsuccessful
   * @returns {Object} Standardized result object
   */
  createResult(success = true, data = null, message = '', error = null) {
    return {
      success,
      data,
      message,
      error,
      timestamp: Date.now(),
    };
  }

  /**
   * Wrap an async operation with consistent error handling
   * @param {Function} operation - Async operation to wrap
   * @param {string} operationName - Name of operation for error reporting
   * @param {Object} options - Error handling options
   * @returns {Promise<Object>} Result object
   */
  async wrapOperation(operation, operationName, options = {}) {
    try {
      const result = await operation();
      return this.createResult(true, result.data || result, result.message || '');
    } catch (error) {
      if (options.throwErrors) {
        throw error;
      }

      this.handleError(error, operationName, options);
      return this.createResult(false, null, '', error);
    }
  }

  /**
   * Format a success message consistently
   * @param {string} operation - Operation description
   * @param {string|number} target - Target of operation
   * @param {Object} details - Additional details
   * @returns {string} Formatted success message
   */
  formatSuccessMessage(operation, target, details = {}) {
    let message = `✅ ${operation} "${target}"`;

    if (details.count) {
      message += ` (${details.count} item${details.count !== 1 ? 's' : ''})`;
    }

    if (details.additional) {
      message += ` - ${details.additional}`;
    }

    return message;
  }

  /**
   * Format a warning message consistently
   * @param {string} message - Warning message
   * @param {string} context - Context for warning
   * @returns {string} Formatted warning message
   */
  formatWarningMessage(message, context = '') {
    const prefix = context ? `⚠️ ${context}: ` : '⚠️ ';
    return `${prefix}${message}`;
  }

  /**
   * Format an info message consistently
   * @param {string} message - Info message
   * @param {string} context - Context for info
   * @returns {string} Formatted info message
   */
  formatInfoMessage(message, context = '') {
    const prefix = context ? `ℹ️ ${context}: ` : 'ℹ️ ';
    return `${prefix}${message}`;
  }

  /**
   * Validate that required context is available
   * @param {Object} context - Context object to validate
   * @param {Array<string>} requiredFields - Array of required field names
   * @param {string} operationName - Name of operation for error reporting
   * @throws {Error} If required context is missing
   */
  validateContext(context, requiredFields, operationName) {
    const missing = [];
    const invalid = [];

    for (const field of requiredFields) {
      if (context[field] === undefined || context[field] === null) {
        missing.push(field);
      } else if (typeof context[field] === 'string' && context[field].trim() === '') {
        invalid.push(`${field} (empty string)`);
      }
    }

    if (missing.length > 0 || invalid.length > 0) {
      const issues = [...missing, ...invalid];
      throw new Error(
        `${operationName}: Missing or invalid context: ${issues.join(', ')}`
      );
    }
  }

  /**
   * Clean up resources and managers
   * Override in subclasses if specific cleanup is needed
   */
  async cleanup() {
    this.managers.clear();
    this.progressManager = null;
  }
}

module.exports = {
  BaseCommandService,
};
