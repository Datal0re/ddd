/*
 * Progress Manager
 * Handles persistent progress tracking for upload operations
 * Supports progress persistence across navigation and app restarts
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger({ module: 'ProgressManager' });

class ProgressManager {
  constructor() {
    this.progress = new Map();
    this.progressFile = path.join(__dirname, '..', 'data', 'upload-progress.json');
    this.cleanupInterval = null;
    this.initialize();
  }

  /**
   * Initialize progress manager
   */
  async initialize() {
    try {
      await this.loadPersistedProgress();
      this.startCleanupInterval();
    } catch (error) {
      logger.error('Failed to initialize ProgressManager:', error);
    }
  }

  /**
   * Generate timestamp-based upload ID
   * @returns {string} Upload ID
   */
  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create new progress entry
   * @param {string} uploadId - Upload ID
   * @returns {Object} Initial progress object
   */
  createProgress(uploadId) {
    const progress = {
      uploadId,
      stage: 'initializing',
      progress: 0,
      message: 'Initializing upload...',
      sessionId: null,
      status: 'processing',
      error: null,
      startTime: Date.now(),
      estimatedTimeRemaining: null,
      lastUpdated: Date.now(),
    };

    this.progress.set(uploadId, progress);
    this.saveProgress();
    logger.info(`Created progress for upload: ${uploadId}`);
    return progress;
  }

  /**
   * Update progress for an upload
   * @param {string} uploadId - Upload ID
   * @param {Object} updates - Progress updates
   */
  updateProgress(uploadId, updates) {
    const current = this.progress.get(uploadId);
    if (!current) {
      logger.warn(`Attempted to update non-existent progress: ${uploadId}`);
      return null;
    }

    const updated = {
      ...current,
      ...updates,
      lastUpdated: Date.now(),
    };

    // Calculate estimated time remaining
    if (updates.progress !== undefined && updates.progress > current.progress) {
      const elapsed = Date.now() - current.startTime;
      const rate = updates.progress / elapsed;
      updated.estimatedTimeRemaining =
        rate > 0 ? Math.round((100 - updates.progress) / rate) : null;
    }

    this.progress.set(uploadId, updated);
    this.saveProgress();
    logger.debug(
      `Updated progress for ${uploadId}: ${updated.progress}% - ${updated.stage}`
    );
    return updated;
  }

  /**
   * Get progress for an upload
   * @param {string} uploadId - Upload ID
   * @returns {Object|null} Progress object or null
   */
  getProgress(uploadId) {
    return this.progress.get(uploadId) || null;
  }

  /**
   * Get all active progress
   * @returns {Array} Array of progress objects
   */
  getAllProgress() {
    return Array.from(this.progress.values());
  }

  /**
   * Complete an upload
   * @param {string} uploadId - Upload ID
   * @param {string} sessionId - Session ID (optional)
   */
  completeProgress(uploadId, sessionId = null) {
    this.updateProgress(uploadId, {
      status: 'completed',
      progress: 100,
      stage: 'completed',
      message: 'Upload processing complete!',
      sessionId,
    });
  }

  /**
   * Mark upload as failed
   * @param {string} uploadId - Upload ID
   * @param {string} error - Error message
   */
  failProgress(uploadId, error) {
    this.updateProgress(uploadId, {
      status: 'error',
      stage: 'error',
      error,
      message: `Upload failed: ${error}`,
    });
  }

  /**
   * Cancel an upload
   * @param {string} uploadId - Upload ID
   */
  cancelProgress(uploadId) {
    this.updateProgress(uploadId, {
      status: 'cancelled',
      stage: 'cancelled',
      message: 'Upload cancelled by user',
    });
  }

  /**
   * Remove progress entry
   * @param {string} uploadId - Upload ID
   */
  removeProgress(uploadId) {
    const removed = this.progress.delete(uploadId);
    if (removed) {
      this.saveProgress();
      logger.info(`Removed progress for upload: ${uploadId}`);
    }
    return removed;
  }

  /**
   * Save progress to file
   */
  async saveProgress() {
    try {
      const progressData = {};
      this.progress.forEach((value, key) => {
        progressData[key] = value;
      });

      await fs.writeFile(this.progressFile, JSON.stringify(progressData, null, 2));
    } catch (error) {
      logger.error('Failed to save progress:', error);
    }
  }

  /**
   * Load persisted progress from file
   */
  async loadPersistedProgress() {
    try {
      const data = await fs.readFile(this.progressFile, 'utf8');
      const progressData = JSON.parse(data);

      Object.entries(progressData).forEach(([key, value]) => {
        // Only restore recent progress (less than 24 hours)
        const age = Date.now() - value.startTime;
        if (age < 24 * 60 * 60 * 1000) {
          this.progress.set(key, value);
        }
      });

      logger.info(`Loaded ${this.progress.size} persisted progress entries`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load persisted progress:', error);
      }
    }
  }

  /**
   * Start cleanup interval for old progress
   */
  startCleanupInterval() {
    // Clean up every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldProgress();
      },
      60 * 60 * 1000
    );
  }

  /**
   * Clean up progress older than 24 hours
   */
  cleanupOldProgress() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    for (const [uploadId, progress] of this.progress.entries()) {
      if (now - progress.startTime > maxAge) {
        this.progress.delete(uploadId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.saveProgress();
      logger.info(`Cleaned up ${cleanedCount} old progress entries`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
let progressManager = null;

/**
 * Get progress manager instance
 * @returns {ProgressManager} Progress manager instance
 */
function getProgressManager() {
  if (!progressManager) {
    progressManager = new ProgressManager();
  }
  return progressManager;
}

module.exports = {
  ProgressManager,
  getProgressManager,
};
