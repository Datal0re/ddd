/*
 * ProgressManager.js - Enhanced progress tracking with cli-progress and cancellation support
 * Provides spinners, progress bars, and ESC key handling for CLI operations
 */

const ora = require('ora').default;
const cliProgress = require('cli-progress');
const chalk = require('chalk');
const readline = require('readline');
const { PROGRESS_STAGES } = require('../config/constants');

/**
 * Enhanced progress management class with cancellation support
 */
class ProgressManager {
  /**
   * Create a new progress manager
   * @param {Function} onProgress - Optional callback for progress updates
   * @param {boolean} useSpinner - Whether to use ora spinner (default: true)
   * @param {Object} options - Progress options
   */
  constructor(onProgress = null, useSpinner = true, options = {}) {
    this.onProgress = onProgress;
    this.useSpinner = useSpinner;
    this.spinner = null;
    this.currentStage = null;
    this.spinnerActive = false;
    this.cancelled = false;
    this.cancellationCallbacks = [];
    this.keypressListener = null;
    this.readlineInterface = null;
    this.activeProgressBar = null;

    // Simple options
    this.options = {
      color: 'cyan',
      spinner: 'dots',
      enableCancellation: true,
      ...options,
    };

    // Create spinner if needed
    if (this.useSpinner) {
      this.spinner = ora({
        color: this.options.color,
        spinner: this.options.spinner,
        isSilent: !useSpinner,
      });
    }
  }

  /**
   * Update progress for a specific stage
   * @param {string} stage - Progress stage name
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  update(stage, progress, message) {
    // Check if operation was cancelled
    if (this.cancelled) {
      return;
    }

    this.currentStage = stage;
    const progressData = {
      stage,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      timestamp: Date.now(),
    };

    // Update spinner if active
    if (this.spinner && this.spinnerActive) {
      this.spinner.text = message;

      if (progressData.progress >= 100) {
        const stageName = this._formatStageName(stage);
        this.spinner.succeed(`${stageName}: ${message} completed`);
        this.spinnerActive = false;
        this._disableCancellation(); // Clean up when complete
      }
    }

    // Update active progress bar if exists
    if (this.activeProgressBar) {
      const percentage = Math.round(progressData.progress);
      this.activeProgressBar.update(percentage, {
        message: message,
      });

      if (percentage >= 100) {
        this.activeProgressBar.stop();
        this.activeProgressBar = null;
      }
    }

    // Call external callback if provided
    if (this.onProgress) {
      this.onProgress(progressData);
    }

    // Log progress if no spinner or progress bar is active
    if (!this.spinnerActive && !this.activeProgressBar && this.useSpinner) {
      const percentage = Math.round(progressData.progress);
      const stageName = this._formatStageName(stage);
      console.log(chalk.blue(`${stageName}: ${message} (${percentage}%)`));
    }
  }

  /**
   * Start a new progress stage with spinner
   * @param {string} stage - Progress stage name
   * @param {string} message - Initial message
   * @param {number} initialProgress - Initial progress (default: 0)
   */
  start(stage, message, initialProgress = 0) {
    if (this.spinner && !this.spinnerActive) {
      this.spinner.start(message);
      this.spinnerActive = true;
    }

    // Enable ESC key cancellation if supported
    if (this.options.enableCancellation && this.useSpinner) {
      this._enableCancellation();
    }

    this.update(stage, initialProgress, message);
  }

  /**
   * Mark current stage as successful
   * @param {string} message - Success message
   */
  succeed(message) {
    if (this.spinner && this.spinnerActive) {
      this.spinner.succeed(message);
      this.spinnerActive = false;
    } else if (this.activeProgressBar) {
      this.activeProgressBar.stop();
      this.activeProgressBar = null;
    } else {
      console.log(chalk.green(`✅ ${message}`));
    }
  }

  /**
   * Mark current stage as failed
   * @param {string} message - Failure message
   */
  fail(message) {
    if (this.spinner && this.spinnerActive) {
      this.spinner.fail(message);
      this.spinnerActive = false;
    } else if (this.activeProgressBar) {
      this.activeProgressBar.stop();
      this.activeProgressBar = null;
    } else {
      console.error(chalk.red(`❌ ${message}`));
    }
  }

  /**
   * Show a warning message
   * @param {string} message - Warning message
   */
  warn(message) {
    if (this.spinner && this.spinnerActive) {
      this.spinner.warn(message);
    } else {
      console.warn(chalk.yellow(`⚠️ ${message}`));
    }
  }

  /**
   * Show an info message
   * @param {string} message - Info message
   */
  info(message) {
    if (this.spinner && this.spinnerActive) {
      this.spinner.info(message);
    } else {
      console.log(chalk.blue(`ℹ️ ${message}`));
    }
  }

  /**
   * Stop current spinner
   */
  stop() {
    if (this.spinner && this.spinnerActive) {
      this.spinner.stop();
      this.spinnerActive = false;
    }

    if (this.activeProgressBar) {
      this.activeProgressBar.stop();
      this.activeProgressBar = null;
    }

    // Clean up cancellation listeners
    this._disableCancellation();
  }

  /**
   * Check if operation was cancelled
   * @returns {boolean} Whether operation was cancelled
   */
  isCancelled() {
    return this.cancelled;
  }

  /**
   * Add a callback to be executed when operation is cancelled
   * @param {Function} callback - Cancellation callback
   */
  onCancellation(callback) {
    if (typeof callback === 'function') {
      this.cancellationCallbacks.push(callback);
    }
  }

  /**
   * Cancel the current operation
   * @param {string} message - Cancellation message
   */
  cancel(message = 'Operation cancelled by user') {
    if (this.cancelled) return; // Already cancelled

    this.cancelled = true;

    // Stop spinner/progress bar with warning message
    if (this.spinner && this.spinnerActive) {
      this.spinner.warn(message);
      this.spinnerActive = false;
    } else if (this.activeProgressBar) {
      this.activeProgressBar.stop();
      this.activeProgressBar = null;
      console.warn(chalk.yellow(`⚠️ ${message}`));
    } else {
      console.warn(chalk.yellow(`⚠️ ${message}`));
    }

    // Execute cancellation callbacks
    this.cancellationCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error(`Error in cancellation callback: ${error.message}`);
      }
    });

    // Clean up
    this._disableCancellation();
  }

  /**
   * Create a real progress bar using cli-progress
   * @param {number} total - Total items to process
   * @param {string} message - Progress message
   * @param {Object} options - Additional options
   * @returns {Object} Progress bar instance with update method
   */
  createProgressBar(total, message, options = {}) {
    const defaultOptions = {
      format: `${message} |{bar}| {percentage}% | {value}/{total}`,
      barCompleteChar: '=',
      barIncompleteChar: '-',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: false,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Enable ESC key cancellation
    if (this.options.enableCancellation) {
      this._enableCancellation();
    }

    const progressBar = new cliProgress.SingleBar(mergedOptions);

    // Start the progress bar
    progressBar.start(total, 0);
    this.activeProgressBar = progressBar;

    return {
      update: (current, payload = {}) => {
        if (this.cancelled) {
          progressBar.stop();
          this.activeProgressBar = null;
          return;
        }

        const percentage = Math.round((current / total) * 100);
        progressBar.update(current, { ...payload });

        if (current >= total) {
          progressBar.stop();
          this.activeProgressBar = null;
        }
      },
      stop: () => {
        progressBar.stop();
        this.activeProgressBar = null;
        this._disableCancellation();
      },
    };
  }

  /**
   * Create a file progress bar for processing files
   * @param {number} total - Total items to process
   * @param {string} message - Progress message
   * @param {Object} options - Additional options
   * @returns {Function} Progress function to call for each item
   */
  createFileProgressBar(total, message, _options = {}) {
    const options = {
      format: `${message} |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
    };

    return this.createProgressBar(total, message, options);
  }

  /**
   * Get current progress state
   * @returns {Object|null} Current progress state
   */
  getCurrentState() {
    return this.currentStage
      ? {
          stage: this.currentStage,
          spinnerActive: !!this.spinner,
          progressBarActive: !!this.activeProgressBar,
        }
      : null;
  }

  /**
   * Enable ESC key cancellation
   * @private
   */
  _enableCancellation() {
    if (this.keypressListener) return; // Already enabled

    try {
      // Create readline interface for keypress detection
      this.readlineInterface = readline.createInterface({
        input: process.stdin,
        escapeCodeTimeout: 50,
      });

      readline.emitKeypressEvents(process.stdin, this.readlineInterface);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      // Add keypress listener
      this.keypressListener = (str, key) => {
        // Check for ESC key or Ctrl+C
        if ((key && key.name === 'escape') || (key && key.ctrl && key.name === 'c')) {
          this.cancel('Operation cancelled by user (ESC/Ctrl+C pressed)');
        }
      };

      process.stdin.on('keypress', this.keypressListener);
    } catch (error) {
      // If readline setup fails, continue without cancellation
      console.warn('Warning: Could not enable ESC key cancellation');
    }
  }

  /**
   * Disable ESC key cancellation and clean up
   * @private
   */
  _disableCancellation() {
    if (this.keypressListener) {
      process.stdin.removeListener('keypress', this.keypressListener);
      this.keypressListener = null;
    }

    if (this.readlineInterface) {
      this.readlineInterface.close();
      this.readlineInterface = null;
    }

    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Format stage name for display
   * @private
   */
  _formatStageName(stage) {
    const stageMap = {
      [PROGRESS_STAGES.INITIALIZING]: 'Initializing',
      [PROGRESS_STAGES.EXTRACTING]: 'Extracting',
      [PROGRESS_STAGES.DUMPING]: 'Processing',
      [PROGRESS_STAGES.EXTRACTING_ASSETS]: 'Extracting Assets',
      [PROGRESS_STAGES.ORGANIZING]: 'Organizing',
      [PROGRESS_STAGES.VALIDATING]: 'Validating',
      [PROGRESS_STAGES.COMPLETED]: 'Completed',
    };

    return stageMap[stage] || stage;
  }
}

/**
 * Create a progress manager with consistent configuration
 * @param {Function} onProgress - Optional progress callback
 * @param {boolean} verbose - Whether to show verbose output
 * @param {Object} options - Additional options
 * @returns {ProgressManager} Configured progress manager
 */
function createProgressManager(onProgress = null, verbose = false, options = {}) {
  const useSpinner = !verbose; // Use spinner unless verbose mode
  return new ProgressManager(onProgress, useSpinner, {
    enableCancellation: !verbose, // Enable cancellation unless verbose mode
    ...options,
  });
}

module.exports = {
  ProgressManager,
  createProgressManager,
};
