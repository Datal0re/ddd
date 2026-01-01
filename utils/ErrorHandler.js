/*
 * ErrorHandler.js - Simplified centralized error handling utilities
 * Leverages Commander.js and Node.js for consistent error handling
 */

const { OutputManager } = require('./OutputManager');

/**
 * Custom error classes for better error categorization
 */
class ValidationError extends Error {
  constructor(message, context) {
    super(`${context}: ${message}`);
    this.name = 'ValidationError';
    this.exitCode = 4;
  }
}

class FileNotFoundError extends Error {
  constructor(filepath, context) {
    super(`${context}: File not found: ${filepath}`);
    this.name = 'FileNotFoundError';
    this.exitCode = 2;
  }
}

/**
 * Simplified centralized error handling class
 */
class ErrorHandler {
  /**
   * Get appropriate exit code for different error types
   * @param {Error} error - Error to categorize
   * @returns {number} Exit code
   */
  static getExitCode(error) {
    // User cancelled prompts - exit cleanly
    if (error.name === 'ExitPromptError') {
      return 0;
    }

    // Custom error classes
    if (error.exitCode) return error.exitCode;

    // Node.js system errors
    if (error.code === 'ENOENT') return 2; // File not found
    if (error.code === 'EACCES') return 3; // Permission denied

    // Error name patterns
    if (error.name === 'ValidationError') return 4;
    if (error.name === 'FileNotFoundError') return 2;
    if (error.message && error.message.includes('not found')) return 5;

    return 1; // Generic error
  }

  /**
   * Handle final error with proper exit code
   * @param {Error} error - Error to handle
   * @param {string} context - Optional context
   * @param {string} suggestion - Optional suggestion for recovery
   */
  static handleErrorAndExit(error, context = null, suggestion = null) {
    const exitCode = this.getExitCode(error);

    // Use OutputManager for consistent formatting
    OutputManager.error(error.message, context, suggestion);

    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }

    process.exit(exitCode);
  }

  /**
   * Handle error without exiting, providing recovery suggestions
   * @param {Error} error - Error to handle
   * @param {string} context - Optional context
   * @param {Array<string>} suggestions - Array of recovery suggestions
   */
  static handleErrorAndSuggest(error, context = null, suggestions = []) {
    const suggestion = suggestions.length > 0 ? suggestions.join('\n') : null;
    OutputManager.error(error.message, context, suggestion);
  }

  /**
   * Log success messages with consistent formatting
   * @param {string} message - Success message
   * @param {string} context - Optional context
   * @param {string} suggestion - Optional suggestion
   */
  static logSuccess(message, context = null, suggestion = null) {
    OutputManager.success(message, context, suggestion);
  }

  /**
   * Log error messages with consistent formatting
   * @param {string} message - Error message
   * @param {string} context - Optional context
   * @param {string} suggestion - Optional suggestion for recovery
   */
  static logError(message, context = null, suggestion = null) {
    OutputManager.error(message, context, suggestion);
  }

  /**
   * Log info messages with consistent formatting
   * @param {string} message - Info message
   * @param {string} context - Optional context
   */
  static logInfo(message, context = null) {
    OutputManager.info(message, context);
  }

  /**
   * Log warning messages with consistent formatting
   * @param {string} message - Warning message
   * @param {string} context - Optional context
   */
  static logWarning(message, context = null) {
    OutputManager.warning(message, context);
  }

  /**
   * Log progress messages with consistent formatting
   * @param {string} message - Progress message
   * @param {string} context - Optional context
   */
  static logProgress(message, context = null) {
    OutputManager.progress(message, context);
  }
}

module.exports = {
  ErrorHandler,
  ValidationError,
  FileNotFoundError,
};
