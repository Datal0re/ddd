/*
 * ErrorHandler.js - Simplified centralized error handling utilities
 * Leverages Commander.js and Node.js for consistent error handling
 */

const chalk = require('chalk');

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
   */
  static handleErrorAndExit(error, context = null) {
    const exitCode = this.getExitCode(error);
    const errorMessage = context ? `${context}: ${error.message}` : error.message;

    this.logError(errorMessage);

    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }

    process.exit(exitCode);
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
   * Log error messages with consistent formatting (reduced to just ❌)
   * @param {string} message - Error message
   * @param {string} context - Optional context
   */
  static logError(message, context = null) {
    const fullMessage = context ? `${context}: ${message}` : message;
    console.error(chalk.red(`❌ Error: ${fullMessage}`));
  }

  static logInfo(message, context = null) {
    const fullMessage = context ? `${context}: ${message}` : message;
    console.log(chalk.blue(`ℹ️ ${fullMessage}`));
  }
}

module.exports = {
  ErrorHandler,
  ValidationError,
  FileNotFoundError,
};
