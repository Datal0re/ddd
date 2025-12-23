/*
 * SchemaValidator.js - Centralized validation utilities
 * Provides consistent parameter and data validation across the application
 */

const {
  FILE_EXTENSIONS,
  CONTENT_TYPES,
  SANITIZATION_DEFAULTS,
} = require('../config/constants');

/**
 * Centralized validation class
 */
class SchemaValidator {
  /**
   * Validate required parameters with consistent error handling
   * @param {Array<{name: string, value: any}>} params - Array of parameter objects
   * @param {string} context - Context for validation (function name, operation, etc.)
   * @throws {Error} If any required parameter is missing or invalid
   */
  static validateRequired(params, context = 'operation') {
    const missing = [];
    const invalid = [];

    for (const param of params) {
      if (param.value === undefined || param.value === null) {
        missing.push(param.name);
      } else if (typeof param.value === 'string' && param.value.trim() === '') {
        invalid.push(`${param.name} (empty string)`);
      } else if (Array.isArray(param.value) && param.value.length === 0) {
        invalid.push(`${param.name} (empty array)`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`${context}: Missing required parameters: ${missing.join(', ')}`);
    }

    if (invalid.length > 0) {
      throw new Error(`${context}: Invalid parameters: ${invalid.join(', ')}`);
    }
  }

  /**
   * Validate non-empty string with specific error messaging
   * @param {string} value - String to validate
   * @param {string} name - Parameter name for error messages
   * @param {string} context - Context for validation
   * @throws {Error} If string is empty, null, or undefined
   */
  static validateNonEmptyString(value, name, context = 'validation') {
    if (typeof value !== 'string') {
      throw new Error(`${context}: ${name} must be a string`);
    }
    if (value.trim() === '') {
      throw new Error(`${context}: ${name} cannot be empty`);
    }
  }

  /**
   * Validate file path with security and existence checks
   * @param {string} filePath - Path to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.mustExist - Check if path must exist (default: false)
   * @param {boolean} options.allowRelative - Allow relative paths (default: true)
   * @param {boolean} options.checkTraversal - Check for path traversal (default: true)
   * @param {string} options.context - Context for error messages
   * @returns {Promise<void>}
   * @throws {Error} If path is invalid
   */
  static async validatePath(filePath, options = {}) {
    const {
      mustExist = false,
      allowRelative = true,
      checkTraversal = true,
      context = 'path validation',
    } = options;

    this.validateNonEmptyString(filePath, 'filePath', context);

    // Check for path traversal
    if (checkTraversal && (filePath.includes('../') || filePath.includes('..\\'))) {
      throw new Error(`${context}: Path traversal detected in: ${filePath}`);
    }

    // Check if path is absolute when relative not allowed
    if (!allowRelative && !filePath.startsWith('/')) {
      throw new Error(`${context}: Absolute path required: ${filePath}`);
    }

    // Check existence if required
    if (mustExist) {
      const FileSystemHelper = require('./FileSystemHelper');
      if (!(await FileSystemHelper.fileExists(filePath))) {
        throw new Error(`${context}: Path does not exist: ${filePath}`);
      }
    }
  }

  /**
   * Validate dumpster name against allowed characters and patterns
   * @param {string} name - Dumpster name to validate
   * @param {Object} options - Validation options
   * @param {number} options.maxLength - Maximum length (default: from SANITIZATION_DEFAULTS)
   * @param {string} options.context - Context for error messages
   * @returns {string} Validated dumpster name
   * @throws {Error} If name is invalid
   */
  static validateDumpsterName(name, options = {}) {
    const {
      maxLength = SANITIZATION_DEFAULTS.DUMPSTER.maxLength,
      context = 'dumpster name validation',
    } = options;

    this.validateNonEmptyString(name, 'name', context);

    if (name.length > maxLength) {
      throw new Error(
        `${context}: Dumpster name too long (max ${maxLength} characters)`
      );
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      throw new Error(`${context}: Dumpster name contains invalid characters: ${name}`);
    }

    // Check for reserved names (Windows)
    const reservedNames = [
      'CON',
      'PRN',
      'AUX',
      'NUL',
      'COM1',
      'COM2',
      'COM3',
      'COM4',
      'COM5',
      'COM6',
      'COM7',
      'COM8',
      'COM9',
      'LPT1',
      'LPT2',
      'LPT3',
      'LPT4',
      'LPT5',
      'LPT6',
      'LPT7',
      'LPT8',
      'LPT9',
    ];
    if (reservedNames.includes(name.toUpperCase())) {
      throw new Error(`${context}: Dumpster name is reserved: ${name}`);
    }

    return name;
  }

  /**
   * Validate export format against supported formats
   * @param {string} format - Export format to validate
   * @param {Array<string>} allowedFormats - Array of allowed formats (default: ['txt', 'md', 'html'])
   * @param {string} context - Context for error messages
   * @returns {string} Normalized format (lowercase)
   * @throws {Error} If format is not supported
   */
  static validateExportFormat(
    format,
    allowedFormats = ['txt', 'md', 'html'],
    context = 'export format validation'
  ) {
    this.validateNonEmptyString(format, 'format', context);

    const normalizedFormat = format.toLowerCase();
    if (!allowedFormats.includes(normalizedFormat)) {
      throw new Error(
        `${context}: Unsupported export format "${format}". Supported: ${allowedFormats.join(', ')}`
      );
    }

    return normalizedFormat;
  }

  /**
   * Validate file extension against known types
   * @param {string} filename - Filename to validate
   * @param {Array<string>} allowedExtensions - Array of allowed extensions (default: all from config)
   * @param {string} context - Context for error messages
   * @returns {boolean} True if extension is allowed
   */
  static validateFileExtension(
    filename,
    allowedExtensions = null,
    context = 'file extension validation'
  ) {
    this.validateNonEmptyString(filename, 'filename', context);

    const FileSystemHelper = require('./FileSystemHelper');
    const ext = FileSystemHelper.getExtension(filename).toLowerCase();

    if (!allowedExtensions) {
      // Use all known extensions from config
      allowedExtensions = [
        ...Object.values(FILE_EXTENSIONS.AUDIO),
        ...Object.values(FILE_EXTENSIONS.IMAGE),
        ...Object.values(FILE_EXTENSIONS.VIDEO),
      ];
    }

    return allowedExtensions.includes(ext);
  }

  /**
   * Validate numeric input with range checking
   * @param {number|string} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.min - Minimum allowed value
   * @param {number} options.max - Maximum allowed value
   * @param {boolean} options.integer - Require integer value
   * @param {string} options.context - Context for error messages
   * @returns {number} Validated numeric value
   * @throws {Error} If value is invalid
   */
  static validateNumber(value, name, options = {}) {
    const {
      min = null,
      max = null,
      integer = false,
      context = 'number validation',
    } = options;

    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`${context}: ${name} must be a number`);
    }

    if (integer && !Number.isInteger(num)) {
      throw new Error(`${context}: ${name} must be an integer`);
    }

    if (min !== null && num < min) {
      throw new Error(`${context}: ${name} must be at least ${min}`);
    }

    if (max !== null && num > max) {
      throw new Error(`${context}: ${name} must be at most ${max}`);
    }

    return num;
  }

  /**
   * Validate boolean input from various sources
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {string} context - Context for error messages
   * @returns {boolean} Validated boolean value
   */
  static validateBoolean(value, name, context = 'boolean validation') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    throw new Error(`${context}: ${name} must be a boolean value`);
  }

  /**
   * Validate array input with type checking
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {string} options.itemType - Expected type of array items ('string', 'number', 'object')
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @param {string} options.context - Context for error messages
   * @returns {Array} Validated array
   * @throws {Error} If value is invalid
   */
  static validateArray(value, name, options = {}) {
    const {
      itemType = null,
      minLength = 0,
      maxLength = null,
      context = 'array validation',
    } = options;

    if (!Array.isArray(value)) {
      throw new Error(`${context}: ${name} must be an array`);
    }

    if (value.length < minLength) {
      throw new Error(`${context}: ${name} must have at least ${minLength} items`);
    }

    if (maxLength !== null && value.length > maxLength) {
      throw new Error(`${context}: ${name} must have at most ${maxLength} items`);
    }

    if (itemType) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const actualType = Array.isArray(item) ? 'array' : typeof item;
        if (actualType !== itemType) {
          throw new Error(
            `${context}: ${name}[${i}] must be of type ${itemType}, got ${actualType}`
          );
        }
      }
    }

    return value;
  }

  /**
   * Validate content type against known types
   * @param {string} contentType - Content type to validate
   * @param {string} context - Context for error messages
   * @returns {string} Validated content type
   * @throws {Error} If content type is unknown
   */
  static validateContentType(contentType, context = 'content type validation') {
    this.validateNonEmptyString(contentType, 'contentType', context);

    const validTypes = Object.values(CONTENT_TYPES);
    if (!validTypes.includes(contentType)) {
      throw new Error(
        `${context}: Unknown content type "${contentType}". Valid: ${validTypes.join(', ')}`
      );
    }

    return contentType;
  }

  /**
   * Validate batch of parameters using schema
   * @param {Object} data - Object containing parameters to validate
   * @param {Object} schema - Schema object defining validation rules
   * @param {string} context - Context for error messages
   * @returns {Object} Validated and normalized data
   * @throws {Error} If validation fails
   */
  static validateSchema(data, schema, context = 'schema validation') {
    const result = { ...data };

    for (const [key, rules] of Object.entries(schema)) {
      const value = result[key];

      // Handle required fields
      if (rules.required && (value === undefined || value === null)) {
        throw new Error(`${context}: Required field "${key}" is missing`);
      }

      // Skip validation if field is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (rules.type && typeof value !== rules.type) {
        throw new Error(`${context}: Field "${key}" must be of type ${rules.type}`);
      }

      // Custom validation function
      if (rules.validate) {
        const validated = rules.validate(value, key, context);
        if (validated !== undefined) {
          result[key] = validated;
        }
      }

      // Array item validation
      if (rules.itemType && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (typeof item !== rules.itemType) {
            throw new Error(
              `${context}: ${key}[${i}] must be of type ${rules.itemType}`
            );
          }
        }
      }
    }

    return result;
  }
}

module.exports = {
  SchemaValidator,
};
