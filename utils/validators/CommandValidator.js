/**
 * Command Validator
 * Centralizes all validation logic extracted from CLI layer
 * Provides consistent parameter and business rule validation
 */

const { SchemaValidator } = require('../SchemaValidator');
const { ValidationError } = require('../ErrorHandler');

/**
 * Service for centralized command validation
 * Extracts and consolidates validation patterns from CLI commands
 */
class CommandValidator {
  /**
   * Validate required parameters consistently
   * @param {Array<{name: string, value: any}>} params - Array of parameter objects
   * @param {string} context - Context for validation (function name, operation, etc.)
   * @returns {Object} Validation result
   */
  validateRequiredParameters(params, context = 'operation') {
    try {
      SchemaValidator.validateRequired(params, context);
      return { valid: true, params };
    } catch (error) {
      return { valid: false, error, message: error.message };
    }
  }

  /**
   * Validate dumpster name with context
   * @param {string} name - Dumpster name to validate
   * @param {string} context - Context for validation
   * @returns {Object} Validation result
   */
  validateDumpsterName(name, context = 'validation') {
    if (!name || name.trim() === '') {
      return { valid: false, requiresPrompt: true, reason: 'name is empty' };
    }

    try {
      SchemaValidator.validateDumpsterName(name, { context });
      return { valid: true, name };
    } catch (error) {
      return { valid: false, error, message: error.message };
    }
  }

  /**
   * Validate file path with existence check
   * @param {string} path - File path to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateFilePath(path, options = {}) {
    const {
      mustExist = true,
      context = 'validation',
      allowedExtensions = ['.zip'],
    } = options;

    if (!path || path.trim() === '') {
      return { valid: false, requiresPrompt: true, reason: 'path is empty' };
    }

    // Check file extension
    if (allowedExtensions.length > 0) {
      const hasValidExtension = allowedExtensions.some(ext => path.endsWith(ext));
      if (!hasValidExtension) {
        return {
          valid: false,
          error: new ValidationError(
            `Invalid file extension. Must be one of: ${allowedExtensions.join(', ')}`,
            context
          ),
        };
      }
    }

    try {
      const validationOptions = {
        mustExist,
        context,
      };

      SchemaValidator.validatePath(path, validationOptions);
      return { valid: true, path };
    } catch (error) {
      if (mustExist) {
        return { valid: false, requiresPrompt: true, reason: 'file does not exist' };
      }
      throw error;
    }
  }

  /**
   * Validate command options based on schema
   * @param {Object} options - Options object to validate
   * @param {Object} schema - Validation schema
   * @param {string} context - Context for validation
   * @returns {Object} Validation result
   */
  validateCommandOptions(options, schema, context = 'validation') {
    const validatedOptions = {};
    const errors = [];

    for (const [key, config] of Object.entries(schema)) {
      const { type, required = false, default: defaultValue } = config;
      const value = options[key];

      if (value === undefined || value === null) {
        if (required) {
          errors.push(`${key} is required`);
          continue;
        }
        validatedOptions[key] = defaultValue;
        continue;
      }

      // Type-specific validation
      let validationResult;
      switch (type) {
        case 'boolean':
          validationResult = this.validateBoolean(value, key, context);
          break;
        case 'string':
          validationResult = this.validateString(value, key, context);
          break;
        case 'number':
          validationResult = this.validateNumber(value, key, context);
          break;
        case 'array':
          validationResult = this.validateArray(value, key, context);
          break;
        default:
          errors.push(`Unknown validation type: ${type} for ${key}`);
          continue;
      }

      if (validationResult.valid) {
        validatedOptions[key] = validationResult.value;
      } else {
        errors.push(validationResult.message);
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        message: `Validation errors: ${errors.join(', ')}`,
      };
    }

    return { valid: true, options: validatedOptions };
  }

  /**
   * Validate boolean value
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name
   * @param {string} context - Validation context
   * @returns {Object} Validation result
   */
  validateBoolean(value, paramName, _context) {
    try {
      const booleanValue = SchemaValidator.validateBoolean(value, paramName, _context);
      return { valid: true, value: booleanValue };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }

  /**
   * Validate string value
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name
   * @param {string} context - Validation context
   * @returns {Object} Validation result
   */
  validateString(value, paramName, _context) {
    if (typeof value !== 'string') {
      return { valid: false, message: `${paramName} must be a string` };
    }

    return { valid: true, value: value.trim() };
  }

  /**
   * Validate number value
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name
   * @param {string} context - Validation context
   * @returns {Object} Validation result
   */
  validateNumber(value, paramName, _context) {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, message: `${paramName} must be a number` };
    }

    return { valid: true, value: num };
  }

  /**
   * Validate array value
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name
   * @param {string} context - Validation context
   * @returns {Object} Validation result
   */
  validateArray(value, paramName, _context) {
    if (!Array.isArray(value)) {
      return { valid: false, message: `${paramName} must be an array` };
    }

    return { valid: true, value };
  }

  /**
   * Validate export format
   * @param {string} format - Export format to validate
   * @param {Array<string>} allowedFormats - Array of allowed formats
   * @param {string} context - Validation context
   * @returns {Object} Validation result
   */
  validateExportFormat(format, allowedFormats, context = 'validation') {
    if (!format || typeof format !== 'string') {
      return {
        valid: false,
        requiresPrompt: true,
        reason: 'format is missing or invalid',
      };
    }

    const normalizedFormat = format.toLowerCase();

    try {
      const validatedFormat = SchemaValidator.validateExportFormat(
        normalizedFormat,
        allowedFormats,
        context
      );
      return { valid: true, format: validatedFormat };
    } catch (error) {
      return {
        valid: false,
        error,
        message: `Invalid format: ${format}. Allowed formats: ${allowedFormats.join(', ')}`,
      };
    }
  }

  /**
   * Validate dump command inputs
   * @param {string} file - File path (may be undefined)
   * @param {string} name - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @returns {Object} Validation result
   */
  validateDumpCommand(file, name, _options = {}) {
    const results = {
      valid: true,
      validatedInputs: {},
      prompts: [],
    };

    // Validate file path
    const fileValidation = this.validateFilePath(file, {
      mustExist: false, // Will prompt if not provided
      context: 'dump command',
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
      results.validatedInputs.file = fileValidation.path;
    }

    // Validate dumpster name
    const nameValidation = this.validateDumpsterName(name, 'dump command');
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
      results.validatedInputs.name = nameValidation.name;
    }

    return results;
  }

  /**
   * Validate burn command inputs
   * @param {string} dumpsterName - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @returns {Object} Validation result
   */
  validateBurnCommand(dumpsterName, options = {}) {
    const results = {
      valid: true,
      validatedInputs: {},
      prompts: [],
    };

    // Validate dumpster name if provided
    if (dumpsterName) {
      const nameValidation = this.validateDumpsterName(dumpsterName, 'burn command');
      if (!nameValidation.valid) {
        return {
          valid: false,
          error: nameValidation.error,
          message: nameValidation.message,
        };
      }
      results.validatedInputs.dumpsterName = nameValidation.name;
    } else {
      results.prompts.push({ type: 'dumpster', reason: 'dumpster name not provided' });
    }

    // Validate boolean options
    const optionsSchema = {
      force: { type: 'boolean', required: false, default: false },
      dryRun: { type: 'boolean', required: false, default: false },
    };

    const optionsValidation = this.validateCommandOptions(
      options,
      optionsSchema,
      'burn command'
    );
    if (!optionsValidation.valid) {
      return optionsValidation;
    }

    results.validatedInputs.options = optionsValidation.options;
    return results;
  }

  /**
   * Validate upcycle command inputs
   * @param {string} format - Export format (may be undefined)
   * @param {string} dumpsterName - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @returns {Object} Validation result
   */
  validateUpcycleCommand(format, dumpsterName, options = {}) {
    const results = {
      valid: true,
      validatedInputs: {},
      prompts: [],
    };

    // Validate export format if provided
    if (format) {
      const formatValidation = this.validateExportFormat(
        format,
        ['txt', 'md', 'html'],
        'upcycle command'
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
        results.validatedInputs.format = formatValidation.format;
      }
    } else {
      results.prompts.push({ type: 'format', reason: 'export format not provided' });
    }

    // Validate dumpster name if provided
    if (dumpsterName) {
      const nameValidation = this.validateDumpsterName(dumpsterName, 'upcycle command');
      if (!nameValidation.valid) {
        return {
          valid: false,
          error: nameValidation.error,
          message: nameValidation.message,
        };
      }
      results.validatedInputs.dumpsterName = nameValidation.name;
    }

    // Validate options schema
    const optionsSchema = {
      output: { type: 'string', required: false },
      includeMedia: { type: 'boolean', required: false, default: true },
      selfContained: { type: 'boolean', required: false, default: false },
      verbose: { type: 'boolean', required: false, default: false },
    };

    const optionsValidation = this.validateCommandOptions(
      options,
      optionsSchema,
      'upcycle command'
    );
    if (!optionsValidation.valid) {
      return optionsValidation;
    }

    results.validatedInputs.options = optionsValidation.options;
    return results;
  }

  /**
   * Check if validation result requires user prompting
   * @param {Object} validationResult - Result from validation method
   * @returns {boolean} Whether prompting is required
   */
  requiresPrompting(validationResult) {
    return (
      !validationResult.valid &&
      validationResult.prompts &&
      validationResult.prompts.length > 0
    );
  }

  /**
   * Get list of required prompts from validation result
   * @param {Object} validationResult - Result from validation method
   * @returns {Array<string>} Array of prompt types needed
   */
  getRequiredPrompts(validationResult) {
    if (!this.requiresPrompting(validationResult)) {
      return [];
    }

    return validationResult.prompts.map(prompt => prompt.type);
  }
}

module.exports = {
  CommandValidator,
};
