/*
 * Unified CLI framework for consistent command-line interface
 * Provides centralized argument parsing, help generation, and progress tracking
 */

/**
 * Common flag definitions for reuse across scripts
 */
const COMMON_FLAGS = {
  preserve: {
    name: 'preserveOriginal',
    flag: '--preserve',
    type: 'boolean',
    description: 'Keep original file after processing',
  },
  overwrite: {
    name: 'overwrite',
    flag: '--overwrite',
    type: 'boolean',
    description: 'Overwrite existing files',
  },
  verbose: {
    name: 'verbose',
    flag: '--verbose',
    type: 'boolean',
    description: 'Enable verbose logging',
  },
  help: {
    name: 'help',
    flag: '--help',
    type: 'boolean',
    description: 'Show help message',
  },
};

/**
 * Standard progress stages for consistency
 */
const PROGRESS_STAGES = {
  INITIALIZING: 'initializing',
  EXTRACTING: 'extracting',
  DUMPING: 'dumping',
  EXTRACTING_ASSETS: 'extracting-assets',
  ORGANIZING: 'organizing',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
};

/**
 * CLI Framework class for unified command-line interface handling
 */
class CLIFramework {
  /**
   * Parse command-line arguments with consistent behavior
   * @param {Object} config - Configuration for argument parsing
   * @param {Array} config.args - Arguments array (default: process.argv.slice(2))
   * @param {Object} config.defaults - Default options
   * @param {Array} config.flags - Array of flag definitions {name, flag, type, description}
   * @param {Array} config.positional - Array of positional argument names
   * @returns {Object} Parsed options object
   */
  static parseArguments(config = {}) {
    const {
      args = process.argv.slice(2),
      defaults = {},
      flags = [],
      positional = [],
    } = config;

    const options = { ...defaults };
    let positionalIndex = 0;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Check if it's a flag
      const flagConfig = flags.find(f => f.flag === arg);
      if (flagConfig) {
        if (flagConfig.type === 'boolean') {
          options[flagConfig.name] = true;
        } else if (flagConfig.type === 'string' && i + 1 < args.length) {
          options[flagConfig.name] = args[++i];
        }
        continue;
      }

      // Handle special flags that aren't in config
      if (arg === '--help') {
        options.help = true;
        continue;
      }

      // Handle positional arguments
      if (positionalIndex < positional.length) {
        options[positional[positionalIndex]] = arg;
        positionalIndex++;
      }
    }

    return options;
  }

  /**
   * Generate formatted help text from configuration
   * @param {Object} config - Configuration object
   * @param {string} config.usage - Usage string
   * @param {Array} config.positional - Positional arguments with descriptions
   * @param {Array} config.flags - Flags array (will merge with common flags)
   * @param {Array} config.examples - Examples array
   * @returns {string} Formatted help text
   */
  static generateHelpText(config = {}) {
    const { usage = '', positional = [], flags = [], examples = [] } = config;

    let helpText = `\nUsage: ${usage}\n\n`;

    // Arguments section
    if (positional.length > 0) {
      helpText += 'Arguments:\n';
      positional.forEach(arg => {
        const name = typeof arg === 'string' ? arg : arg.name;
        const desc =
          typeof arg === 'string'
            ? `Description for ${name}`
            : arg.description || `Description for ${name}`;
        helpText += `  ${name.padEnd(15)} ${desc}\n`;
      });
      helpText += '\n';
    }

    // Options section - merge provided flags with common flags
    const allFlags = [...flags, ...Object.values(COMMON_FLAGS)];
    if (allFlags.length > 0) {
      helpText += 'Options:\n';
      allFlags.forEach(flag => {
        const line = `  ${flag.flag.padEnd(15)} ${flag.description}`;
        helpText += line + '\n';
      });
      helpText += '\n';
    }

    // Examples section
    if (examples.length > 0) {
      helpText += 'Examples:\n';
      examples.forEach(example => {
        helpText += `  ${example}\n`;
      });
    }

    return helpText;
  }

  /**
   * Get common flag definitions
   * @returns {Object} Common flags object
   */
  static getCommonFlags() {
    return { ...COMMON_FLAGS };
  }

  /**
   * Get progress stage constants
   * @returns {Object} Progress stages object
   */
  static getProgressStages() {
    return { ...PROGRESS_STAGES };
  }

  /**
   * Create a standardized command configuration
   * @param {string} commandName - Name of the command
   * @param {string} description - Description of what the command does
   * @param {Array} positionalArgs - Positional arguments
   * @param {Array} additionalFlags - Additional command-specific flags
   * @param {Array} examples - Usage examples
   * @returns {Object} Command configuration object
   */
  static createCommandConfig(
    commandName,
    description,
    positionalArgs = [],
    additionalFlags = [],
    examples = []
  ) {
    return {
      name: commandName,
      description,
      positional: positionalArgs,
      flags: [...additionalFlags, ...Object.values(COMMON_FLAGS)],
      examples,
    };
  }

  /**
   * Validate required arguments and show help if missing
   * @param {Object} options - Parsed options object
   * @param {Array} requiredArgs - Array of required argument names
   * @param {string} commandName - Name of the command for error messages
   * @returns {boolean} True if all required arguments are present
   */
  static validateRequiredArgs(options, requiredArgs, commandName) {
    const missing = requiredArgs.filter(arg => !options[arg]);
    if (missing.length > 0) {
      console.error(
        `Error: ${commandName} requires the following arguments: ${missing.join(', ')}`
      );
      console.error('Use --help for usage information.');
      return false;
    }
    return true;
  }
}

module.exports = { CLIFramework, COMMON_FLAGS, PROGRESS_STAGES };
