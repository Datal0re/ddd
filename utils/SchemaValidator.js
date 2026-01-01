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
   * Validate required parameters (alias for validateRequired for compatibility)
   * @param {Array<{name: string, value: any}>} params - Array of parameter objects
   * @param {string} functionName - Name of function for error reporting
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
      const FileUtils = require('./FileUtils');
      if (!(await FileUtils.fileExists(filePath))) {
        throw new Error(`${context}: Path does not exist: ${filePath}`);
      }
    }
  }

  /**
   * Validate bin name against allowed characters and patterns
   * @param {string} name - Bin name to validate
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum length (default: 2)
   * @param {number} options.maxLength - Maximum length (default: 50)
   * @param {string} options.context - Context for error messages
   * @returns {string} Validated bin name
   * @throws {Error} If name is invalid
   */
  static validateBinName(name, options = {}) {
    const { minLength = 2, maxLength = 50, context = 'bin name validation' } = options;

    this.validateNonEmptyString(name, 'name', context);

    if (name.length < minLength) {
      throw new Error(`${context}: Bin name must be at least ${minLength} characters`);
    }

    if (name.length > maxLength) {
      throw new Error(`${context}: Bin name cannot exceed ${maxLength} characters`);
    }

    // Check for invalid characters (only alphanumeric, underscore, hyphen allowed)
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(name)) {
      throw new Error(
        `${context}: Bin name can only contain letters, numbers, underscores, and hyphens`
      );
    }

    return name;
  }

  /**
   * Safe validation version of validateBinName - returns result object instead of throwing
   * @param {string} name - Bin name to validate
   * @param {Object} options - Validation options
   * @param {string} options.context - Context for error messages
   * @param {boolean} options.detectEmpty - Whether to detect empty strings and return requiresPrompt
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether validation passed
   * @returns {string} returns.data - Validated bin name (if valid)
   * @returns {Error} returns.error - Error object (if invalid)
   * @returns {string} returns.message - Error message (if invalid)
   * @returns {boolean} returns.requiresPrompt - Whether prompting is required (if empty detection enabled)
   * @returns {string} returns.reason - Reason for prompting requirement
   */
  static safeValidateBinName(name, options = {}) {
    return this.safeValidate(
      this.validateBinName.bind(this),
      name,
      { ...options, emptyReason: 'name is empty' },
      { context: options.context || 'validation' }
    );
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

    const FileUtils = require('./FileUtils');
    const ext = FileUtils.getExtension(filename).toLowerCase();

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

  /**
   * Safe validation version of validateRequired - returns result object instead of throwing
   * @param {Array<{name: string, value: any}>} params - Array of parameter objects
   * @param {string} context - Context for validation (function name, operation, etc.)
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether validation passed
   * @returns {Array<{name: string, value: any}>} returns.data - Validated parameters (if valid)
   * @returns {Error} returns.error - Error object (if invalid)
   * @returns {string} returns.message - Error message (if invalid)
   */
  static safeValidateRequired(params, context = 'operation') {
    try {
      this.validateRequired(params, context);
      return { valid: true, data: params };
    } catch (error) {
      return { valid: false, error, message: error.message };
    }
  }

  /**
   * Safe validation version of validateDumpsterName - returns result object instead of throwing
   * @param {string} name - Dumpster name to validate
   * @param {Object} options - Validation options
   * @param {string} options.context - Context for error messages
   * @param {boolean} options.detectEmpty - Whether to detect empty strings and return requiresPrompt
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether validation passed
   * @returns {string} returns.data - Validated dumpster name (if valid)
   * @returns {Error} returns.error - Error object (if invalid)
   * @returns {string} returns.message - Error message (if invalid)
   * @returns {boolean} returns.requiresPrompt - Whether prompting is required (if empty detection enabled)
   * @returns {string} returns.reason - Reason for prompting requirement
   */
  static safeValidateDumpsterName(name, options = {}) {
    return this.safeValidate(
      this.validateDumpsterName.bind(this),
      name,
      { ...options, emptyReason: 'name is empty' },
      { context: options.context || 'validation' }
    );
  }

  /**
   * Safe validation version of validatePath - returns result object instead of throwing
   * @param {string} filePath - Path to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.mustExist - Check if path must exist (default: false)
   * @param {boolean} options.allowRelative - Allow relative paths (default: true)
   * @param {boolean} options.checkTraversal - Check for path traversal (default: true)
   * @param {string} options.context - Context for error messages
   * @param {boolean} options.detectEmpty - Whether to detect empty strings and return requiresPrompt
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether validation passed
   * @returns {string} returns.data - Validated file path (if valid)
   * @returns {Error} returns.error - Error object (if invalid)
   * @returns {string} returns.message - Error message (if invalid)
   * @returns {boolean} returns.requiresPrompt - Whether prompting is required (if empty detection enabled)
   * @returns {string} returns.reason - Reason for prompting requirement
   */
  static safeValidatePath(filePath, options = {}) {
    const {
      mustExist = false,
      allowRelative = true,
      checkTraversal = true,
      context = 'path validation',
      detectEmpty = true,
    } = options;

    // Special handling for path validation due to async nature and special cases
    if (detectEmpty && (!filePath || filePath.trim() === '')) {
      return { valid: false, requiresPrompt: true, reason: 'path is empty' };
    }

    try {
      this.validatePath(filePath, {
        mustExist,
        allowRelative,
        checkTraversal,
        context,
      });
      return { valid: true, data: filePath };
    } catch (error) {
      if (mustExist && detectEmpty && error.message.includes('does not exist')) {
        return { valid: false, requiresPrompt: true, reason: 'file does not exist' };
      }
      return { valid: false, error, message: error.message };
    }
  }

  /**
   * Generic safe validation wrapper - handles empty detection and error catching
   * @param {Function} validationMethod - The validation method to call (should throw on error)
   * @param {any} value - Value to validate
   * @param {Object} options - Validation options
   * @param {string} options.context - Context for error messages
   * @param {boolean} options.detectEmpty - Whether to detect empty values and return requiresPrompt
   * @param {string} options.emptyReason - Custom reason for empty detection
   * @param {Array} additionalArgs - Additional arguments to pass to validation method
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether validation passed
   * @returns {any} returns.data - Validated value (if valid)
   * @returns {Error} returns.error - Error object (if invalid)
   * @returns {string} returns.message - Error message (if invalid)
   * @returns {boolean} returns.requiresPrompt - Whether prompting is required (if empty detection enabled)
   * @returns {string} returns.reason - Reason for prompting requirement
   */
  static safeValidate(validationMethod, value, options = {}, ...additionalArgs) {
    const {
      context = 'validation',
      detectEmpty = true,
      emptyReason = 'value is empty',
    } = options;

    if (
      detectEmpty &&
      (value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0))
    ) {
      return { valid: false, requiresPrompt: true, reason: emptyReason };
    }

    try {
      const validatedValue = validationMethod.call(this, value, ...additionalArgs);
      return { valid: true, data: validatedValue };
    } catch (error) {
      return { valid: false, error, message: error.message };
    }
  }

  /**
   * Safe validation version of validateExportFormat - returns result object instead of throwing
   * @param {string} format - Export format to validate
   * @param {Array<string>} allowedFormats - Array of allowed formats (default: ['txt', 'md', 'html'])
   * @param {Object} options - Validation options
   * @param {string} options.context - Context for error messages
   * @param {boolean} options.detectEmpty - Whether to detect empty strings and return requiresPrompt
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether validation passed
   * @returns {string} returns.data - Validated export format (if valid)
   * @returns {Error} returns.error - Error object (if invalid)
   * @returns {string} returns.message - Error message (if invalid)
   * @returns {boolean} returns.requiresPrompt - Whether prompting is required (if empty detection enabled)
   * @returns {string} returns.reason - Reason for prompting requirement
   */
  static safeValidateExportFormat(format, allowedFormats = null, options = {}) {
    return this.safeValidate(
      this.validateExportFormat.bind(this),
      format,
      { ...options, emptyReason: 'format is missing or invalid' },
      allowedFormats || ['txt', 'md', 'html'],
      options.context || 'export format validation'
    );
  }

  /**
   * Validate dump command inputs with comprehensive error handling and prompt detection
   * @param {string} file - File path (may be undefined)
   * @param {string} name - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether all provided inputs are valid
   * @returns {Object} returns.validatedInputs - Object containing validated inputs
   * @returns {string} returns.validatedInputs.file - Validated file path (if provided and valid)
   * @returns {string} returns.validatedInputs.name - Validated dumpster name (if provided and valid)
   * @returns {Array<Object>} returns.prompts - Array of prompts needed for missing/invalid inputs
   * @returns {string} returns.prompts[].type - Type of prompt needed ('file' or 'name')
   * @returns {string} returns.prompts[].reason - Reason prompting is needed
   * @returns {Error} returns.error - Error object (if validation failed due to invalid inputs)
   * @returns {string} returns.message - Error message (if validation failed)
   */
  static validateDumpCommand(file, name, _options = {}) {
    const results = {
      valid: true,
      validatedInputs: {},
      prompts: [],
    };

    // Validate file path
    const fileValidation = this.safeValidatePath(file, {
      mustExist: false, // Will prompt if not provided
      context: 'dump command',
      detectEmpty: true,
    });

    if (!fileValidation.valid) {
      if (fileValidation.requiresPrompt) {
        results.prompts.push({ type: 'file', reason: fileValidation.reason });
      } else {
        return {
          valid: false,
          error: fileValidation.error,
          message: fileValidation.message,
        };
      }
    } else {
      results.validatedInputs.file = fileValidation.data;
    }

    // Validate dumpster name
    const nameValidation = this.safeValidateDumpsterName(name, {
      context: 'dump command',
      detectEmpty: true,
    });

    if (!nameValidation.valid) {
      if (nameValidation.requiresPrompt) {
        results.prompts.push({ type: 'name', reason: nameValidation.reason });
      } else {
        return {
          valid: false,
          error: nameValidation.error,
          message: nameValidation.message,
        };
      }
    } else {
      results.validatedInputs.name = nameValidation.data;
    }

    return results;
  }

  /**
   * Validate burn command inputs with comprehensive error handling and prompt detection
   * @param {string} dumpsterName - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @param {boolean} options.force - Force deletion without confirmation
   * @param {boolean} options.dryRun - Perform dry run without actual deletion
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether all provided inputs are valid
   * @returns {Object} returns.validatedInputs - Object containing validated inputs
   * @returns {string} returns.validatedInputs.dumpsterName - Validated dumpster name (if provided)
   * @returns {Object} returns.validatedInputs.options - Validated options object
   * @returns {Array<Object>} returns.prompts - Array of prompts needed for missing inputs
   * @returns {string} returns.prompts[].type - Type of prompt needed ('dumpster')
   * @returns {string} returns.prompts[].reason - Reason prompting is needed
   * @returns {Error} returns.error - Error object (if validation failed)
   * @returns {string} returns.message - Error message (if validation failed)
   */
  static validateBurnCommand(dumpsterName, options = {}) {
    const results = {
      valid: true,
      validatedInputs: {},
      prompts: [],
    };

    // Validate dumpster name if provided
    if (dumpsterName) {
      const nameValidation = this.safeValidateDumpsterName(dumpsterName, {
        context: 'burn command',
        detectEmpty: false, // We know it's provided, just validate format
      });

      if (!nameValidation.valid) {
        return {
          valid: false,
          error: nameValidation.error,
          message: nameValidation.message,
        };
      }
      results.validatedInputs.dumpsterName = nameValidation.data;
    } else {
      results.prompts.push({ type: 'dumpster', reason: 'dumpster name not provided' });
    }

    // Validate boolean options using safe validation
    const validatedOptions = {};
    const optionsSchema = {
      force: { type: 'boolean', required: false, default: false },
      dryRun: { type: 'boolean', required: false, default: false },
    };

    for (const [key, config] of Object.entries(optionsSchema)) {
      const value = options[key];

      if (value === undefined || value === null) {
        validatedOptions[key] = config.default;
        continue;
      }

      // validateBoolean throws, so we need to catch and wrap it
      try {
        const validatedValue = this.validateBoolean(value, key, 'burn command');
        validatedOptions[key] = validatedValue;
      } catch (error) {
        return {
          valid: false,
          error,
          message: `Invalid ${key} option: ${error.message}`,
        };
      }
    }

    results.validatedInputs.options = validatedOptions;
    return results;
  }

  /**
   * Validate upcycle command inputs with comprehensive error handling and prompt detection
   * @param {string} format - Export format (may be undefined)
   * @param {string} dumpsterName - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @param {string} options.output - Output directory path
   * @param {boolean} options.includeMedia - Include media assets in export
   * @param {boolean} options.selfContained - Create self-contained export
   * @param {boolean} options.verbose - Enable verbose output
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether all provided inputs are valid
   * @returns {Object} returns.validatedInputs - Object containing validated inputs
   * @returns {string} returns.validatedInputs.format - Validated export format (if provided)
   * @returns {string} returns.validatedInputs.dumpsterName - Validated dumpster name (if provided)
   * @returns {Object} returns.validatedInputs.options - Validated options object
   * @returns {Array<Object>} returns.prompts - Array of prompts needed for missing inputs
   * @returns {string} returns.prompts[].type - Type of prompt needed ('format' or 'dumpster')
   * @returns {string} returns.prompts[].reason - Reason prompting is needed
   * @returns {Error} returns.error - Error object (if validation failed)
   * @returns {string} returns.message - Error message (if validation failed)
   */
  static validateUpcycleCommand(format, dumpsterName, options = {}) {
    const results = {
      valid: true,
      validatedInputs: {},
      prompts: [],
    };

    // Validate export format if provided
    if (format) {
      const formatValidation = this.safeValidateExportFormat(
        format,
        ['txt', 'md', 'html'],
        {
          context: 'upcycle command',
          detectEmpty: false, // We know it's provided, just validate format
        }
      );

      if (!formatValidation.valid) {
        if (formatValidation.requiresPrompt) {
          results.prompts.push({ type: 'format', reason: formatValidation.reason });
        } else {
          return {
            valid: false,
            error: formatValidation.error,
            message: formatValidation.message,
          };
        }
      } else {
        results.validatedInputs.format = formatValidation.data;
      }
    } else {
      results.prompts.push({ type: 'format', reason: 'export format not provided' });
    }

    // Validate dumpster name if provided
    if (dumpsterName) {
      const nameValidation = this.safeValidateDumpsterName(dumpsterName, {
        context: 'upcycle command',
        detectEmpty: false, // We know it's provided, just validate format
      });

      if (!nameValidation.valid) {
        return {
          valid: false,
          error: nameValidation.error,
          message: nameValidation.message,
        };
      }
      results.validatedInputs.dumpsterName = nameValidation.data;
    }

    // Validate options
    const validatedOptions = {};
    const optionsSchema = {
      output: { type: 'string', required: false },
      includeMedia: { type: 'boolean', required: false, default: true },
      selfContained: { type: 'boolean', required: false, default: false },
      verbose: { type: 'boolean', required: false, default: false },
    };

    for (const [key, config] of Object.entries(optionsSchema)) {
      const value = options[key];

      if (value === undefined || value === null) {
        validatedOptions[key] = config.default;
        continue;
      }

      let validatedValue;
      try {
        switch (config.type) {
          case 'boolean':
            validatedValue = this.validateBoolean(value, key, 'upcycle command');
            break;
          case 'string':
            validatedValue = value.trim();
            break;
          default:
            return {
              valid: false,
              error: new Error(`Unknown validation type: ${config.type}`),
              message: `Unknown validation type: ${config.type} for ${key}`,
            };
        }
        validatedOptions[key] = validatedValue;
      } catch (error) {
        return {
          valid: false,
          error,
          message: `Invalid ${key} option: ${error.message}`,
        };
      }
    }

    results.validatedInputs.options = validatedOptions;
    return results;
  }
}

module.exports = {
  SchemaValidator,
};
