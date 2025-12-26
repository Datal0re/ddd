/*
 * Input validation utilities
 * Provides common validation functions for parameters and inputs
 */

/**
 * Validation utilities class for input validation
 */
class Validators {
  /**
   * Validate required parameters for a function
   * @param {Array<{name: string, value: any}>} params - Array of parameter objects with name and value
   * @param {string} functionName - Name of the function for error reporting
   * @throws {Error} If any required parameters are missing or invalid
   */
  static validateRequiredParams(params, functionName) {
    const missing = params.filter(p => !p.value);
    if (missing.length > 0) {
      throw new Error(
        `${functionName}: Missing required parameters: ${missing.map(p => p.name).join(', ')}`
      );
    }
  }

  /**
   * Validate that a parameter is a non-empty string
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @throws {Error} If parameter is not a non-empty string
   */
  static validateNonEmptyString(param, paramName) {
    if (typeof param !== 'string' || param.trim() === '') {
      throw new Error(`${paramName} must be a non-empty string`);
    }
  }

  /**
   * Validate that a parameter is a valid file path
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @param {Object} options - Validation options
   * @param {boolean} options.shouldExist - Whether file should exist (default: true)
   * @throws {Error} If parameter is not a valid file path
   */
  static validateFilePath(param, paramName, options = {}) {
    const { shouldExist = true } = options;

    this.validateNonEmptyString(param, paramName);

    // Basic path format validation
    if (param.includes('\0') || param.includes('\r') || param.includes('\n')) {
      throw new Error(`${paramName} contains invalid characters`);
    }

    if (shouldExist) {
      const fs = require('fs');
      if (!fs.existsSync(param)) {
        throw new Error(`${paramName} does not exist: ${param}`);
      }
    }
  }

  /**
   * Validate that a parameter is within a range
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @throws {Error} If parameter is not within range
   */
  static validateRange(param, paramName, min, max) {
    if (typeof param !== 'number' || isNaN(param)) {
      throw new Error(`${paramName} must be a valid number`);
    }

    if (param < min || param > max) {
      throw new Error(`${paramName} must be between ${min} and ${max}`);
    }
  }

  /**
   * Validate that a parameter is of a specific type
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @param {string} expectedType - Expected type ('string', 'number', 'boolean', 'object', 'function')
   * @throws {Error} If parameter is not of expected type
   */
  static validateType(param, paramName, expectedType) {
    const actualType = Array.isArray(param) ? 'array' : typeof param;

    if (actualType !== expectedType) {
      throw new Error(
        `${paramName} must be of type ${expectedType}, got ${actualType}`
      );
    }
  }

  /**
   * Validate that a parameter is a valid email address
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @throws {Error} If parameter is not a valid email
   */
  static validateEmail(param, paramName) {
    this.validateNonEmptyString(param, paramName);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(param)) {
      throw new Error(`${paramName} must be a valid email address`);
    }
  }

  /**
   * Validate that a parameter is a valid URL
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @param {Object} options - Validation options
   * @param {Array} options.allowedProtocols - Array of allowed protocols (default: ['http', 'https'])
   * @throws {Error} If parameter is not a valid URL
   */
  static validateUrl(param, paramName, options = {}) {
    const { allowedProtocols = ['http', 'https'] } = options;

    this.validateNonEmptyString(param, paramName);

    try {
      // Use whatwg URL constructor if available, fallback to built-in
      const url = new url.URL(param);
      if (!allowedProtocols.includes(url.protocol.replace(':', ''))) {
        throw new Error(`${paramName} has unsupported protocol: ${url.protocol}`);
      }
    } catch (error) {
      throw new Error(`${paramName} must be a valid URL: ${error.message}`);
    }
  }

  /**
   * Validate that a parameter matches a regex pattern
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @param {RegExp|string} pattern - Pattern to match against
   * @param {string} errorMessage - Custom error message (optional)
   * @throws {Error} If parameter does not match pattern
   */
  static validatePattern(param, paramName, pattern, errorMessage = null) {
    this.validateNonEmptyString(param, paramName);

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    if (!regex.test(param)) {
      throw new Error(errorMessage || `${paramName} does not match required pattern`);
    }
  }

  /**
   * Validate that a parameter is a valid array
   * @param {any} param - Parameter to validate
   * @param {string} paramName - Name of the parameter for error reporting
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @throws {Error} If parameter is not a valid array
   */
  static validateArray(param, paramName, options = {}) {
    const { minLength = 0, maxLength = Infinity } = options;

    if (!Array.isArray(param)) {
      throw new Error(`${paramName} must be an array`);
    }

    if (param.length < minLength) {
      throw new Error(`${paramName} must have at least ${minLength} elements`);
    }

    if (param.length > maxLength) {
      throw new Error(`${paramName} must have at most ${maxLength} elements`);
    }
  }
}

module.exports = Validators;
