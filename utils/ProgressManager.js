/*
 * ProgressManager.js - Enhanced progress tracking using cli-progress
 * Provides spinners, progress bars for CLI operations
 */

const ora = require('ora').default;
const cliProgress = require('cli-progress');
const chalk = require('chalk');
const { PROGRESS_STAGES } = require('../config/constants');

/**
 * Enhanced progress management class
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
    this.activeProgressBar = null;

    // Simple options
    this.options = {
      color: 'cyan',
      spinner: 'dots',
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

    const progressBar = new cliProgress.SingleBar(mergedOptions);

    // Start the progress bar
    progressBar.start(total, 0);
    this.activeProgressBar = progressBar;

    return {
      update: (current, payload = {}) => {
        progressBar.update(current, { ...payload });

        if (current >= total) {
          progressBar.stop();
          this.activeProgressBar = null;
        }
      },
      stop: () => {
        progressBar.stop();
        this.activeProgressBar = null;
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
  return new ProgressManager(onProgress, useSpinner, options);
}

module.exports = {
  ProgressManager,
  createProgressManager,
};
