/*
 * ProgressTracker.js - Legacy compatibility layer
 * Provides backward compatibility for existing ProgressTracker usage
 * @deprecated Use ProgressManager instead
 */

const { createProgressManager } = require('./ProgressManager');

/**
 * Legacy ProgressTracker class for backward compatibility
 * @deprecated Use ProgressManager instead
 */
class ProgressTracker {
  constructor(userCallback = null, verbose = false, options = {}) {
    this.progressManager = createProgressManager(userCallback, verbose, options);
    this.startTime = Date.now();
    this.lastStage = null;
    this.stages = {};
  }

  update(stage, percentage, message, _metadata = {}) {
    this.lastStage = stage;

    // Track stage timing for compatibility
    if (!this.stages[stage]) {
      this.stages[stage] = { startTime: Date.now(), completed: false };
    }

    if (percentage === 100 && this.stages[stage]) {
      this.stages[stage].completed = true;
      this.stages[stage].endTime = Date.now();
    }

    this.progressManager.update(stage, percentage, message);
  }

  logToConsole(progressData) {
    const { stage, progress, message } = progressData;
    console.log(`${stage}: ${progress}% - ${message}`);
  }

  completeStage(stage, message = 'Completed') {
    this.update(stage, 100, message);
  }

  complete(message = 'Process completed successfully') {
    const totalElapsed = Date.now() - this.startTime;
    this.update('completed', 100, message, { totalElapsed });
  }

  startStage(stage, message) {
    this.update(stage, 0, message);
  }

  updateWithCount(stage, current, total, message) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.update(stage, percentage, message, { current, total });
  }

  getStageInfo(stage) {
    if (stage) {
      return this.stages[stage] || null;
    }
    return { ...this.stages };
  }

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

  reset() {
    this.startTime = Date.now();
    this.lastStage = null;
    this.stages = {};
    this.progressManager = createProgressManager(
      this.progressManager.onProgress,
      this.progressManager.useSpinner
    );
  }
}

/**
 * Factory function to create a progress tracker with common configuration
 * @deprecated Use createProgressManager instead
 */
function createProgressTracker(userCallback = null, verbose = false, options = {}) {
  return new ProgressTracker(userCallback, verbose, options);
}

/**
 * Simple progress callback that just logs to console
 * @deprecated Use ProgressManager with verbose mode instead
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
