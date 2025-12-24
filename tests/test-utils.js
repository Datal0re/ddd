#!/usr/bin/env node

/**
 * Test utilities for data-dumpster-diver CLI testing
 * Provides common testing functionality with proper validation and error handling
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const FileSystemHelper = require('../utils/FileSystemHelper');
const Validators = require('../utils/Validators');

/**
 * Test utilities class
 */
class TestUtils {
  /**
   * Validate that the test ZIP file exists and is accessible
   * @param {string} zipPath - Path to the ZIP file
   * @throws {Error} If ZIP file doesn't exist or is invalid
   */
  static async validateTestZip(zipPath) {
    try {
      Validators.validateNonEmptyString(zipPath, 'zipPath');

      // Check if file exists
      try {
        await fs.access(zipPath);
      } catch (error) {
        throw new Error(
          `Test ZIP file not found: ${zipPath}\nPlease update the zip variable to a valid path or place a test.zip file in the tests/ directory.`
        );
      }

      // Check if it's actually a ZIP file
      if (!zipPath.toLowerCase().endsWith('.zip')) {
        throw new Error(`File must be a ZIP file: ${zipPath}`);
      }

      // Check file size to ensure it's not empty
      const stats = await fs.stat(zipPath);
      if (stats.size === 0) {
        throw new Error(`Test ZIP file is empty: ${zipPath}`);
      }

      console.log(`✓ Test ZIP validated: ${zipPath} (${stats.size} bytes)`);
    } catch (error) {
      if (error.message.includes('Test ZIP file')) {
        throw error; // Re-throw our custom errors
      }
      throw new Error(`ZIP validation failed: ${error.message}`);
    }
  }

  /**
   * Run a CLI command with proper error handling and output capture
   * @param {string[]} args - Command arguments (e.g., ['dump', '-n', 'test', 'file.zip'])
   * @param {Object} options - Execution options
   * @param {boolean} options.captureOutput - Whether to capture output (default: true)
   * @param {boolean} options.showRealTime - Whether to show real-time output (default: true)
   * @returns {Promise<Object>} Result object with exitCode, stdout, stderr
   */
  static async runCLICommand(args, options = {}) {
    const { captureOutput = true, showRealTime = true } = options;

    return new Promise(resolve => {
      const cliPath = path.join(__dirname, '../cli.js');
      const childProcess = spawn('node', [cliPath, ...args]);

      let stdout = '';
      let stderr = '';

      if (showRealTime) {
        childProcess.stdout.on('data', data => {
          const output = data.toString();
          if (captureOutput) stdout += output;
          try {
            process.stdout.write(output);
          } catch (error) {
            // Ignore EPIPE errors when output pipe is closed
            if (error.code !== 'EPIPE') {
              console.error('stdout write error:', error);
            }
          }
        });

        childProcess.stderr.on('data', data => {
          const output = data.toString();
          if (captureOutput) stderr += output;
          try {
            process.stderr.write(output);
          } catch (error) {
            // Ignore EPIPE errors when error pipe is closed
            if (error.code !== 'EPIPE') {
              console.error('stderr write error:', error);
            }
          }
        });
      } else if (captureOutput) {
        childProcess.stdout.on('data', data => {
          stdout += data.toString();
        });

        childProcess.stderr.on('data', data => {
          stderr += data.toString();
        });
      }

      childProcess.on('close', exitCode => {
        resolve({
          exitCode,
          stdout: captureOutput ? stdout : '',
          stderr: captureOutput ? stderr : '',
          success: exitCode === 0,
        });
      });

      childProcess.on('error', error => {
        console.error(`Process error: ${error.message}`);
        resolve({
          exitCode: -1,
          stdout: '',
          stderr: error.message,
          success: false,
        });
      });
    });
  }

  /**
   * Create a test logger that writes to both console and file
   * @param {string} outputPath - Path to the log file
   * @returns {Object} Logger object with log methods
   */
  static createTestLogger(outputPath) {
    // Ensure logs directory exists
    const logsDir = path.dirname(outputPath);
    FileSystemHelper.ensureDirectory(logsDir);

    return {
      /**
       * Log a message with timestamp
       * @param {string} message - Message to log
       */
      log: async message => {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${message}\n`;

        // Write to file
        await fs.appendFile(outputPath, formattedMessage);

        // Also display on console
        console.log(message);
      },

      /**
       * Log a separator line
       * @param {string} title - Optional title for the separator
       */
      separator: async (title = '') => {
        const separator = title
          ? `\n${'='.repeat(20)} ${title} ${'='.repeat(20)}\n`
          : '\n' + '-'.repeat(50) + '\n';

        await fs.appendFile(outputPath, separator);
        if (title) {
          console.log(`\n${'='.repeat(20)} ${title} ${'='.repeat(20)}`);
        } else {
          console.log('\n' + '-'.repeat(50));
        }
      },

      /**
       * Log the output from a CLI command
       * @param {string} commandDescription - Description of what was tested
       * @param {Object} result - Result from runCLICommand
       */
      logCommandResult: async (commandDescription, result) => {
        const title = `Testing: ${commandDescription}`;
        const testSeparator = `\n${'='.repeat(20)} ${title} ${'='.repeat(20)}\n`;

        await fs.appendFile(outputPath, testSeparator);
        await fs.appendFile(outputPath, `Command: node cli.js ${commandDescription}\n`);
        await fs.appendFile(outputPath, `Exit Code: ${result.exitCode}\n`);
        await fs.appendFile(outputPath, `Success: ${result.success}\n`);

        if (result.stdout) {
          await fs.appendFile(outputPath, '\nSTDOUT:\n');
          await fs.appendFile(outputPath, result.stdout);
        }

        if (result.stderr) {
          await fs.appendFile(outputPath, '\nSTDERR:\n');
          await fs.appendFile(outputPath, result.stderr);
        }

        await fs.appendFile(outputPath, '\n');
      },
    };
  }

  /**
   * Check if a dumpster exists by running the hoard command
   * @param {string} dumpsterName - Name of the dumpster to check
   * @returns {Promise<boolean>} True if dumpster exists
   */
  static async checkDumpsterExists(dumpsterName) {
    try {
      const result = await this.runCLICommand(['hoard'], {
        captureOutput: true,
        showRealTime: false,
      });

      return result.stdout.includes(dumpsterName);
    } catch (error) {
      console.error(`Error checking dumpster existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Setup test environment
   * @param {string} logPath - Path to the log file
   * @returns {Promise<Object>} Logger instance
   */
  static async setupTestEnvironment(logPath) {
    const logger = this.createTestLogger(logPath);

    await logger.log('Test environment setup started');
    await logger.log(`Test started on: ${new Date().toLocaleString()}`);

    return logger;
  }

  /**
   * Clean up test environment
   * @param {string} dumpsterName - Name of dumpster to clean up
   * @param {Object} logger - Logger instance
   */
  static async cleanupTestEnvironment(dumpsterName, logger) {
    if (dumpsterName && (await this.checkDumpsterExists(dumpsterName))) {
      await logger.log(`Cleaning up test dumpster: ${dumpsterName}`);

      // Force delete the dumpster
      const result = await this.runCLICommand(['burn', '-f', dumpsterName], {
        showRealTime: false,
      });

      if (result.success) {
        await logger.log(`✓ Successfully cleaned up dumpster: ${dumpsterName}`);
      } else {
        await logger.log(`✗ Failed to clean up dumpster: ${dumpsterName}`);
        await logger.log(`Error: ${result.stderr}`);
      }
    }

    await logger.log('Test environment cleanup completed');
  }
}

// Allow running validation directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--validate-only')) {
    const zipPath = path.join(__dirname, 'test.zip');

    (async () => {
      try {
        await TestUtils.validateTestZip(zipPath);
        console.log('✓ Test ZIP file is valid');
        process.exit(0);
      } catch (error) {
        console.error('✗ Validation failed:', error.message);
        process.exit(1);
      }
    })();
  }
}

module.exports = { TestUtils };
