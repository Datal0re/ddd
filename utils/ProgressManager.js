/*
 * ProgressManager.js - Centralized progress tracking using ora
 * Provides consistent progress reporting and spinners across application
 */

const ora = require('ora');
const chalk = require('chalk');
const { PROGRESS_STAGES } = require('../config/constants');

/**
 * Centralized progress management class
 */
class ProgressManager {
  /**
   * Create a new progress manager with optional spinner
   * @param {Function} onProgress - Optional callback for progress updates
   * @param {boolean} useSpinner - Whether to use ora spinner (default: true)
   * @param {Object} options - Spinner options
   * @returns {ProgressManager} Progress manager instance
   */
  constructor(onProgress = null, useSpinner = true, options = {}) {
    this.onProgress = onProgress;
    this.useSpinner = useSpinner;
    this.spinner = null;
    this.currentStage = null;
    this.options = {
      color: 'cyan',
      spinner: 'dots',
      ...options,
    };

    if (this.useSpinner && onProgress) {
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
    if (this.spinner) {
      const percentage = Math.round(progressData.progress);
      const stageName = this._formatStageName(stage);
      this.spinner.text = `${stageName}: ${message} (${percentage}%)`;

      if (progressData.progress >= 100) {
        this.spinner.succeed(`${stageName}: ${message} completed`);
        this.spinner = null; // Don't reuse spinner
      }
    }

    // Call external callback if provided
    if (this.onProgress) {
      this.onProgress(progressData);
    }

    // Log progress if no spinner
    if (!this.spinner && this.useSpinner) {
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
    if (this.spinner) {
      const stageName = this._formatStageName(stage);
      this.spinner.start(`${stageName}: ${message} (${initialProgress}%)`);
    }
    this.update(stage, initialProgress, message);
  }

  /**
   * Mark current stage as successful
   * @param {string} message - Success message
   */
  succeed(message) {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    } else {
      console.log(chalk.green(`✅ ${message}`));
    }
  }

  /**
   * Mark current stage as failed
   * @param {string} message - Failure message
   */
  fail(message) {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    } else {
      console.error(chalk.red(`❌ ${message}`));
    }
  }

  /**
   * Show a warning message
   * @param {string} message - Warning message
   */
  warn(message) {
    if (this.spinner) {
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
    if (this.spinner) {
      this.spinner.info(message);
    } else {
      console.log(chalk.blue(`ℹ️ ${message}`));
    }
  }

  /**
   * Stop current spinner
   */
  stop() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Create progress tracking functions for specific stages
   * @param {Object} stageConfig - Configuration for stages
   * @returns {Object} Object with stage-specific update functions
   */
  createStageTrackers(stageConfig = {}) {
    const stages = {
      initializing: message => this.update(PROGRESS_STAGES.INITIALIZING, 0, message),
      extracting: (progress, message) =>
        this.update(PROGRESS_STAGES.EXTRACTING, progress, message),
      dumping: (progress, message) =>
        this.update(PROGRESS_STAGES.DUMPING, progress, message),
      extractingAssets: (progress, message) =>
        this.update(PROGRESS_STAGES.EXTRACTING_ASSETS, progress, message),
      organizing: (progress, message) =>
        this.update(PROGRESS_STAGES.ORGANIZING, progress, message),
      validating: (progress, message) =>
        this.update(PROGRESS_STAGES.VALIDATING, progress, message),
      completed: message => this.update(PROGRESS_STAGES.COMPLETED, 100, message),
      ...stageConfig,
    };

    return stages;
  }

  /**
   * Create a simple progress bar for file operations
   * @param {number} total - Total items to process
   * @param {string} message - Progress message
   * @param {Function} onItem - Callback for each item (optional)
   * @returns {Function} Function to call for each processed item
   */
  createProgressBar(total, message, onItem = null) {
    let processed = 0;
    const startTime = Date.now();

    return (item = null) => {
      processed++;
      const progress = (processed / total) * 100;
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = total - processed;
      const eta = remaining / rate;

      if (onItem && item) {
        onItem(item, processed, total);
      }

      this.update(
        this.currentStage || PROGRESS_STAGES.DUMPING,
        progress,
        `${message} (${processed}/${total}) - ETA: ${Math.round(eta)}s`
      );

      if (processed === total) {
        this.succeed(
          `${message} completed (${total} items in ${Math.round(elapsed / 1000)}s)`
        );
      }

      return processed;
    };
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

  /**
   * Get current progress state
   * @returns {Object|null} Current progress state
   */
  getCurrentState() {
    return this.currentStage
      ? {
          stage: this.currentStage,
          spinnerActive: !!this.spinner,
        }
      : null;
  }

  /**
   * Create a nested progress manager for sub-operations
   * @param {string} parentStage - Parent stage name
   * @param {number} parentWeight - Weight of parent progress (0-100)
   * @param {Function} onProgress - Optional callback for sub-progress
   * @returns {ProgressManager} Nested progress manager
   */
  createNested(parentStage, parentWeight, onProgress = null) {
    const nestedManager = new ProgressManager(
      subProgress => {
        // Convert sub-progress (0-100) to weighted contribution
        const contribution = (subProgress.progress / 100) * parentWeight;
        const totalProgress = Math.min(100, contribution);

        this.update(parentStage, totalProgress, subProgress.message);

        if (onProgress) {
          onProgress({
            stage: subProgress.stage,
            progress: totalProgress,
            message: subProgress.message,
            parentStage,
          });
        }
      },
      false // Don't create nested spinner
    );

    return nestedManager;
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
