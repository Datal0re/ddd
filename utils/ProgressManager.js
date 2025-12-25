/*
 * ProgressManager.js - Centralized progress tracking using ora and cli-progress
 * Provides consistent progress reporting, spinners, and progress bars across application
 */

const ora = require('ora').default;
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
      progressStyle: 'auto', // 'auto', 'spinner', 'bar'
      ...options,
    };
    this.multibar = null;
    this.activeBars = new Map();
    this.barCounter = 0;
    this.spinnerActive = false;

    // Create spinner if we should use it (regardless of onProgress callback)
    if (this.useSpinner && this.shouldUseSpinner()) {
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

    // Update spinner if active and spinning
    if (this.spinner && this.spinnerActive) {
      const percentage = Math.round(progressData.progress);
      const stageName = this._formatStageName(stage);
      this.spinner.text = `${stageName}: ${message} (${percentage}%)`;

      if (progressData.progress >= 100) {
        this.spinner.succeed(`${stageName}: ${message} completed`);
        this.spinnerActive = false;
      }
    }

    // Call external callback if provided
    if (this.onProgress) {
      this.onProgress(progressData);
    }

    // Log progress if no spinner is active
    if (!this.spinnerActive && this.useSpinner) {
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
      const stageName = this._formatStageName(stage);
      const initialText = `${stageName}: ${message} (${initialProgress}%)`;
      this.spinner.start(initialText);
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
    this.stopAllBars();
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
   * Create a true progress bar using cli-progress with fallback
   * @param {number} total - Total items to process
   * @param {string} message - Progress message
   * @param {Object} options - Progress bar options
   * @returns {Function} Function to call for each processed item
   */
  createFileProgressBar(total, message, options = {}) {
    if (!this.shouldUseProgressBar()) {
      // Fallback to original createProgressBar for verbose mode
      return this.createProgressBar(total, message, options.onItem);
    }

    let processed = 0;
    const startTime = Date.now();

    return (value = 1, payload = {}) => {
      processed = value;
      const progress = (processed / total) * 100;
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = total - processed;
      const eta = remaining / rate;

      // Create simple text progress bar that works in any environment
      const barLength = 20;
      const filledChars = Math.floor((progress / 100) * barLength);
      const emptyChars = barLength - filledChars;
      const bar = '[' + '='.repeat(filledChars) + '-'.repeat(emptyChars) + ']';

      // Format with additional payload info
      let payloadStr = '';
      if (payload && Object.keys(payload).length > 0) {
        payloadStr =
          ' | ' +
          Object.entries(payload)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
      }

      const output = `${message} ${bar} ${Math.round(progress)}% | ${processed}/${total} | Speed: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s${payloadStr}`;

      // Clear line and write new progress (works in most terminals)
      process.stdout.write('\r' + output);

      if (processed >= total) {
        process.stdout.write('\n');
        console.log(
          chalk.green(
            `✅ ${message} completed (${total} items in ${Math.round(elapsed / 1000)}s)`
          )
        );
      }

      return processed;
    };
  }

  /**
   * Create multiple progress bars for concurrent operations (simplified version)
   * @param {Object} options - MultiBar options
   * @returns {Object} MultiBar controller and createBar function
   */
  createMultiProgressBar(_options = {}) {
    const bars = new Map();
    let barCounter = 0;

    return {
      createBar: (total, message, _barOptions = {}) => {
        const barId = `multi_${++barCounter}`;
        let processed = 0;

        const bar = {
          update: (value, payload = {}) => {
            processed = value;
            const progress = (processed / total) * 100;

            // Create simple text progress bar
            const barLength = 15;
            const filledChars = Math.floor((progress / 100) * barLength);
            const emptyChars = barLength - filledChars;
            const progressBar =
              '[' + '='.repeat(filledChars) + '-'.repeat(emptyChars) + ']';

            let payloadStr = '';
            if (payload && Object.keys(payload).length > 0) {
              payloadStr =
                ' | ' +
                Object.entries(payload)
                  .map(([key, val]) => `${key}: ${val}`)
                  .join(', ');
            }

            const output = `${message}: ${progressBar} ${Math.round(progress)}% | ${processed}/${total}${payloadStr}`;

            // Store for batch display
            bars.set(barId, {
              message: message.split(' ')[0], // First word as label
              output,
              priority: bars.size,
            });

            // Display all bars together
            this.displayMultipleBars(bars);
          },
          stop: () => {
            bars.delete(barId);
          },
        };

        return bar;
      },
      stop: () => {
        bars.clear();
        console.log(); // New line after all bars complete
      },
    };
  }

  /**
   * Display multiple progress bars together
   * @private
   */
  displayMultipleBars(bars) {
    // Clear previous lines and redraw
    process.stdout.write('\n');

    // Sort by priority and display
    const sortedBars = Array.from(bars.entries()).sort(
      ([, a], [, b]) => a.priority - b.priority
    );

    sortedBars.forEach(([, barData], index) => {
      if (index > 0) process.stdout.write('\n');
      process.stdout.write(`\r${barData.output}`);
    });
  }

  /**
   * Stop all active progress bars and multi-bar instances
   */
  stopAllBars() {
    // Clear any remaining output
    if (this.activeBars.size > 0) {
      console.log();
    }

    // Stop all single bars
    this.activeBars.forEach((bar, _id) => {
      if (typeof bar.stop === 'function') {
        bar.stop();
      }
    });
    this.activeBars.clear();

    // Stop multi-bar
    if (this.multibar) {
      this.multibar = null;
      this.activeBars.clear();
    }
  }

  /**
   * Determine if spinner should be used
   * @private
   */
  shouldUseSpinner() {
    const progressStyle = this.options.progressStyle || 'auto';
    if (progressStyle === 'spinner') return true;
    if (progressStyle === 'bar') return false;
    // 'auto' mode: use spinner for indeterminate progress, bars for determinate
    return true;
  }

  /**
   * Determine if progress bar should be used
   * @private
   */
  shouldUseProgressBar() {
    const progressStyle = this.options.progressStyle || 'auto';
    if (progressStyle === 'bar') return true;
    if (progressStyle === 'spinner') return false;
    // 'auto' mode: use bars when not in verbose mode
    return this.useSpinner;
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
          activeBars: this.activeBars.size,
          hasMultiBar: !!this.multibar,
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

/**
 * Create a progress manager with bar-style preference
 * @param {Function} onProgress - Optional progress callback
 * @param {boolean} verbose - Whether to show verbose output
 * @param {Object} options - Additional options
 * @returns {ProgressManager} Configured progress manager with bar preference
 */
function createProgressBarManager(onProgress = null, verbose = false, options = {}) {
  return new ProgressManager(onProgress, !verbose, {
    progressStyle: 'bar',
    ...options,
  });
}

module.exports = {
  ProgressManager,
  createProgressManager,
  createProgressBarManager,
};
