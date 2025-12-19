/*
 * Centralized progress tracking utility
 * Provides consistent progress reporting across all CLI tools
 */

/**
 * Progress tracker class for standardized progress reporting
 */
class ProgressTracker {
  /**
   * Create a new progress tracker
   * @param {Function} userCallback - User-provided progress callback (optional)
   * @param {boolean} verbose - Whether to log to console (optional, default: false)
   * @param {Object} options - Additional options
   * @param {boolean} options.showPercentage - Whether to show percentage in console output (default: true)
   */
  constructor(userCallback = null, verbose = false, options = {}) {
    this.userCallback = userCallback;
    this.verbose = verbose;
    this.showPercentage = options.showPercentage !== false; // default true
    this.startTime = Date.now();
    this.lastStage = null;
    this.stages = {};
  }

  /**
   * Update progress with stage, percentage, and message
   * @param {string} stage - Current stage identifier
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} message - Progress message
   * @param {Object} metadata - Additional metadata to include in progress data
   */
  update(stage, percentage, message, metadata = {}) {
    // Clamp percentage to valid range
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    // Update stage tracking
    if (stage !== this.lastStage) {
      this.lastStage = stage;
      if (!this.stages[stage]) {
        this.stages[stage] = { startTime: Date.now(), completed: false };
      }
    }

    // Mark stage as complete if 100%
    if (clampedPercentage === 100 && this.stages[stage]) {
      this.stages[stage].completed = true;
      this.stages[stage].endTime = Date.now();
    }

    // Create progress data object
    const progressData = {
      stage,
      progress: clampedPercentage,
      message,
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      ...metadata,
    };

    // Add stage duration info
    if (this.stages[stage]) {
      progressData.stageElapsed = Date.now() - this.stages[stage].startTime;
    }

    // Call user callback if provided
    if (this.userCallback) {
      this.userCallback(progressData);
    }

    // Log to console if verbose
    if (this.verbose) {
      this.logToConsole(progressData);
    }
  }

  /**
   * Log progress to console with consistent formatting
   * @param {Object} progressData - Progress data object
   */
  logToConsole(progressData) {
    const { stage, progress, message } = progressData;
    let logMessage = `${stage}`;

    if (this.showPercentage) {
      logMessage += `: ${progress}%`;
    }

    if (message) {
      logMessage += ` - ${message}`;
    }

    console.log(logMessage);
  }

  /**
   * Complete tracking for a stage
   * @param {string} stage - Stage to complete
   * @param {string} message - Completion message
   */
  completeStage(stage, message = 'Completed') {
    this.update(stage, 100, message);
  }

  /**
   * Mark overall process as completed
   * @param {string} message - Completion message
   */
  complete(message = 'Process completed successfully') {
    const totalElapsed = Date.now() - this.startTime;
    this.update('completed', 100, message, { totalElapsed });

    if (this.verbose) {
      const seconds = Math.round(totalElapsed / 1000);
      console.log(`Total time: ${seconds}s`);
    }
  }

  /**
   * Start a new stage
   * @param {string} stage - Stage to start
   * @param {string} message - Start message
   */
  startStage(stage, message) {
    this.update(stage, 0, message);
  }

  /**
   * Update progress within a stage with automatic percentage calculation
   * @param {string} stage - Current stage
   * @param {number} current - Current count
   * @param {number} total - Total count
   * @param {string} message - Progress message
   */
  updateWithCount(stage, current, total, message) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.update(stage, percentage, message, { current, total });
  }

  /**
   * Get stage timing information
   * @param {string} stage - Stage to get info for (optional, returns all stages if not provided)
   * @returns {Object} Stage timing information
   */
  getStageInfo(stage) {
    if (stage) {
      return this.stages[stage] || null;
    }
    return { ...this.stages };
  }

  /**
   * Get overall tracking summary
   * @returns {Object} Summary of all progress tracking
   */
  getSummary() {
    const totalElapsed = Date.now() - this.startTime;
    const completedStages = Object.values(this.stages).filter(s => s.completed).length;
    const totalStages = Object.keys(this.stages).length;

    return {
      totalElapsed,
      stages: this.stages,
      completedStages,
      totalStages,
      completionRate: totalStages > 0 ? (completedStages / totalStages) * 100 : 0,
    };
  }

  /**
   * Reset the tracker (useful for reusing the same tracker instance)
   */
  reset() {
    this.startTime = Date.now();
    this.lastStage = null;
    this.stages = {};
  }
}

/**
 * Factory function to create a progress tracker with common configuration
 * @param {Function} userCallback - User-provided progress callback
 * @param {boolean} verbose - Whether to enable verbose logging
 * @param {Object} options - Additional options
 * @returns {ProgressTracker} New progress tracker instance
 */
function createProgressTracker(userCallback = null, verbose = false, options = {}) {
  return new ProgressTracker(userCallback, verbose, options);
}

/**
 * Simple progress callback that just logs to console
 * @param {boolean} verbose - Whether to log (default: false)
 * @returns {Function} Progress callback function
 */
function createConsoleProgressCallback(verbose = false) {
  if (!verbose) {
    return null;
  }

  return progressData => {
    const { stage, progress, message } = progressData;
    console.log(`${stage}: ${progress}% - ${message}`);
  };
}

module.exports = {
  ProgressTracker,
  createProgressTracker,
  createConsoleProgressCallback,
};
