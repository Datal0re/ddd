/*
 * ErrorHandler.js - Centralized error handling utilities
 * Provides consistent error handling patterns across the application
 */

const chalk = require('chalk');

/**
 * Centralized error handling class
 */
class ErrorHandler {
  /**
   * Handle file operation errors with consistent messaging
   * @param {Error} error - The error that occurred
   * @param {string} context - Context description for the error
   * @param {boolean} shouldThrow - Whether to re-throw the error (default: true)
   * @param {Function} cleanupFn - Optional cleanup function to run
   * @returns {Error|null} The error if not throwing, null if successful
   */
  static handleFileError(error, context, shouldThrow = true, cleanupFn = null) {
    const message = this._formatFileError(error, context);

    if (error.code === 'ENOENT') {
      console.warn(chalk.yellow(`⚠️ File not found: ${context}`));
    } else if (error.code === 'EACCES') {
      console.error(chalk.red(`🚨 Permission denied: ${context}`));
    } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
      console.error(chalk.red(`🚨 Too many open files: ${context}`));
    } else {
      console.error(chalk.red(`❌ File operation failed: ${message}`));
    }

    if (cleanupFn) {
      try {
        cleanupFn();
      } catch (cleanupError) {
        console.warn(chalk.yellow(`⚠️ Cleanup failed: ${cleanupError.message}`));
      }
    }

    if (shouldThrow) {
      throw error;
    }
    return error;
  }

  /**
   * Handle validation errors with consistent formatting
   * @param {string} message - Validation error message
   * @param {string} context - Context where validation failed
   * @param {boolean} shouldThrow - Whether to throw an Error (default: true)
   * @returns {Error|null}
   */
  static handleValidationError(message, context, shouldThrow = true) {
    const fullMessage = context ? `${context}: ${message}` : message;
    console.error(chalk.red(`🚨 Validation Error: ${fullMessage}`));

    if (shouldThrow) {
      throw new Error(fullMessage);
    }
    return new Error(fullMessage);
  }

  /**
   * Handle async operation errors with cleanup support
   * @param {Error} error - The error that occurred
   * @param {string} context - Context description
   * @param {Function} cleanupFn - Cleanup function to run
   * @param {boolean} shouldThrow - Whether to re-throw (default: true)
   * @returns {Error|null}
   */
  static handleAsyncError(error, context, cleanupFn = null, shouldThrow = true) {
    console.error(chalk.red(`❌ ${context}: ${error.message}`));

    if (cleanupFn) {
      try {
        cleanupFn();
      } catch (cleanupError) {
        console.warn(
          chalk.yellow(`⚠️ Cleanup failed during ${context}: ${cleanupError.message}`)
        );
      }
    }

    if (shouldThrow) {
      throw error;
    }
    return error;
  }

  /**
   * Create a cleanup handler that can be used with try-catch blocks
   * @param {Function} cleanupFn - Cleanup function to execute
   * @param {string} resource - Description of resource being cleaned up
   * @returns {Function} Cleanup handler function
   */
  static createCleanupHandler(cleanupFn, resource = 'resource') {
    return () => {
      try {
        if (cleanupFn) cleanupFn();
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️ Failed to cleanup ${resource}: ${error.message}`)
        );
      }
    };
  }

  /**
   * Handle cleanup errors gracefully (log but don't throw)
   * @param {Error} error - Cleanup error
   * @param {string} resource - Description of what was being cleaned up
   */
  static handleCleanupError(error, resource = 'resource') {
    console.warn(chalk.yellow(`⚠️ Failed to cleanup ${resource}: ${error.message}`));
  }

  /**
   * Log success messages with consistent formatting
   * @param {string} message - Success message
   * @param {string} context - Optional context
   */
  static logSuccess(message, context = null) {
    const fullMessage = context ? `${context}: ${message}` : message;
    console.log(chalk.green(`✅ ${fullMessage}`));
  }

  /**
   * Log warning messages with consistent formatting
   * @param {string} message - Warning message
   * @param {string} context - Optional context
   */
  static logWarning(message, context = null) {
    const fullMessage = context ? `${context}: ${message}` : message;
    console.warn(chalk.yellow(`⚠️ ${fullMessage}`));
  }

  /**
   * Log info messages with consistent formatting
   * @param {string} message - Info message
   * @param {string} context - Optional context
   */
  static logInfo(message, context = null) {
    const fullMessage = context ? `${context}: ${message}` : message;
    console.log(chalk.blue(`ℹ️ ${fullMessage}`));
  }

  /**
   * Format file-specific error messages
   * @private
   */
  static _formatFileError(error, context) {
    switch (error.code) {
      case 'ENOENT':
        return `File not found: ${context}`;
      case 'EACCES':
        return `Permission denied: ${context}`;
      case 'EISDIR':
        return `Expected file but got directory: ${context}`;
      case 'ENOTDIR':
        return `Expected directory but got file: ${context}`;
      case 'EMFILE':
      case 'ENFILE':
        return `System limit reached: ${context}`;
      default:
        return `${context}: ${error.message}`;
    }
  }

  /**
   * Handle multiple errors (e.g., from batch operations)
   * @param {Array<Error>} errors - Array of errors
   * @param {string} context - Context for the errors
   * @param {boolean} shouldThrow - Whether to throw if errors exist
   * @returns {Array<Error>} Array of errors
   */
  static handleMultipleErrors(errors, context = 'operation', shouldThrow = false) {
    if (errors.length === 0) return [];

    console.error(chalk.red(`🚨 ${context} completed with ${errors.length} errors:`));
    errors.forEach((error, index) => {
      console.error(chalk.red(`  ${index + 1}. ${error.message}`));
    });

    if (shouldThrow && errors.length > 0) {
      throw new Error(`${context} failed with ${errors.length} errors`);
    }

    return errors;
  }

  /**
   * Create a standardized error object with context
   * @param {string} message - Error message
   * @param {string} context - Error context
   * @param {string} code - Error code (optional)
   * @param {Object} details - Additional error details (optional)
   * @returns {Error} Enhanced error object
   */
  static createContextualError(message, context, code = null, details = null) {
    const error = new Error(`${context}: ${message}`);
    if (code) error.code = code;
    if (details) error.details = details;
    return error;
  }
}

module.exports = {
  ErrorHandler,
};
