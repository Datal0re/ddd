/*
 * Session backup and recovery utilities
 * Provides automated backup and recovery for user data
 */
const fsPromises = require('fs').promises;
const path = require('path');
const { createLogger } = require('./logger');
const logger = createLogger({ module: 'BackupManager' });

class BackupManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.backupDir = path.join(baseDir, 'backups');
    this.maxBackups = 10; // Keep last 10 backups
    this.backupLocks = new Map(); // Track ongoing backup operations
  }

  /**
   * Creates backup of session data
   * @param {string} sessionId - Session to backup
   * @returns {Promise<string>} Backup path
   */
  async createBackup(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Session ID must be a non-empty string');
    }

    // Check if backup is already in progress for this session
    if (this.backupLocks.has(sessionId)) {
      throw new Error(`Backup already in progress for session ${sessionId}`);
    }

    // Set lock to prevent race conditions
    this.backupLocks.set(sessionId, true);

    try {
      await fsPromises.mkdir(this.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${sessionId}_${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupName);

      const sessionDir = path.join(this.baseDir, 'data', 'sessions', sessionId);

      // Check if session directory exists
      if (
        !(await fsPromises
          .access(sessionDir)
          .then(() => true)
          .catch(() => false))
      ) {
        throw new Error(`Session directory not found: ${sessionDir}`);
      }

      // Check if backup with same timestamp already exists (race condition check)
      try {
        await fsPromises.access(backupPath);
        throw new Error(`Backup with timestamp ${timestamp} already exists`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, which is what we want
      }

      // Read all files in session directory and create JSON backup
      const files = await fsPromises.readdir(sessionDir);
      const backupData = {
        sessionId,
        timestamp: new Date().toISOString(),
        files: {},
      };

      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        const stats = await fsPromises.stat(filePath);

        if (stats.isFile()) {
          const content = await fsPromises.readFile(filePath, 'utf8');
          backupData.files[file] = {
            content,
            lastModified: stats.mtime.toISOString(),
            size: stats.size,
          };
        }
      }

      // Write backup as JSON file
      await fsPromises.writeFile(backupPath, JSON.stringify(backupData, null, 2));

      // Clean up old backups
      await this.cleanupOldBackups(sessionId);

      logger.info(`Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error(`Backup failed for session ${sessionId}:`, error);
      throw error;
    } finally {
      // Always release the lock
      this.backupLocks.delete(sessionId);
    }
  }

  /**
   * Lists available backups for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} List of backup info
   */
  async listBackups(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Session ID must be a non-empty string');
    }

    if (
      !(await fsPromises
        .access(this.backupDir)
        .then(() => true)
        .catch(() => false))
    ) {
      return []; // Backup directory doesn't exist yet
    }

    try {
      const files = await fsPromises.readdir(this.backupDir);
      const backupPromises = files
        .filter(file => file.startsWith(sessionId) && file.endsWith('.json'))
        .map(async file => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fsPromises.stat(filePath);
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
          };
        });

      const backups = await Promise.all(backupPromises);
      return backups.sort((a, b) => b.created - a.created); // Newest first
    } catch (error) {
      logger.error(`Failed to list backups for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Cleans up old backups keeping only maxBackups
   * @param {string} sessionId - Session ID
   */
  async cleanupOldBackups(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Session ID must be a non-empty string');
    }

    try {
      const backups = await this.listBackups(sessionId);

      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);

        for (const backup of toDelete) {
          await fsPromises.unlink(backup.path);
          logger.info(`Deleted old backup: ${backup.filename}`);
        }
      }
    } catch (error) {
      logger.warn('Backup cleanup failed:', error);
    }
  }

  /**
   * Restores session from backup
   * @param {string} sessionId - Session ID
   * @param {string} backupFile - Backup filename
   * @returns {Promise<boolean>} Success status
   */
  async restoreBackup(sessionId, backupFile) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Session ID must be a non-empty string');
    }

    if (!backupFile || typeof backupFile !== 'string') {
      throw new Error('Backup file must be a non-empty string');
    }

    const backupPath = path.join(this.backupDir, backupFile);
    const sessionDir = path.join(this.baseDir, 'data', 'sessions', sessionId);
    let preRestoreBackup = null;
    const originalFiles = new Map(); // Store original file contents for rollback

    // Check if backup file exists
    if (
      !(await fsPromises
        .access(backupPath)
        .then(() => true)
        .catch(() => false))
    ) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      // Create backup of current state before restore
      if (
        await fsPromises
          .access(sessionDir)
          .then(() => true)
          .catch(() => false)
      ) {
        try {
          preRestoreBackup = await this.createBackup(sessionId);
          logger.info(`Created pre-restore backup: ${preRestoreBackup}`);

          // Store original files for potential rollback
          const files = await fsPromises.readdir(sessionDir);
          for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const stats = await fsPromises.stat(filePath);
            if (stats.isFile()) {
              const content = await fsPromises.readFile(filePath, 'utf8');
              originalFiles.set(file, content);
            }
          }
        } catch (error) {
          logger.warn('Failed to create pre-restore backup:', error.message);
        }
      }

      // Ensure session directory exists
      await fsPromises.mkdir(path.dirname(sessionDir), { recursive: true });

      // Extract backup from JSON
      const backupData = JSON.parse(await fsPromises.readFile(backupPath, 'utf8'));

      // Validate backup structure
      if (!backupData.sessionId || !backupData.timestamp || !backupData.files) {
        throw new Error('Invalid backup file structure');
      }

      // Ensure session directory exists
      await fsPromises.mkdir(sessionDir, { recursive: true });

      // Restore all files
      const restoredFiles = [];
      for (const [filename, fileData] of Object.entries(backupData.files)) {
        const filePath = path.join(sessionDir, filename);
        await fsPromises.writeFile(filePath, fileData.content, 'utf8');
        restoredFiles.push(filename);
      }

      logger.info(
        `Session ${sessionId} restored from ${backupFile} (${restoredFiles.length} files)`
      );
      return true;
    } catch (error) {
      logger.error(`Restore failed for session ${sessionId}:`, error);

      // Attempt rollback if we have original files
      if (originalFiles.size > 0) {
        try {
          logger.info('Attempting to restore original files...');
          for (const [filename, content] of originalFiles.entries()) {
            const filePath = path.join(sessionDir, filename);
            await fsPromises.writeFile(filePath, content, 'utf8');
          }
          logger.info('Rollback completed successfully');
        } catch (rollbackError) {
          logger.error('Rollback failed:', rollbackError);
          logger.error(
            `Manual recovery may be needed. Pre-restore backup: ${preRestoreBackup}`
          );
        }
      }

      throw error;
    }
  }

  /**
   * Validates backup integrity
   * @param {string} backupPath - Path to backup file
   * @returns {Promise<boolean>} True if backup is valid
   */
  async validateBackup(backupPath) {
    if (!backupPath || typeof backupPath !== 'string') {
      return false;
    }

    try {
      const stats = await fsPromises.stat(backupPath);

      // Basic validation
      if (stats.size === 0) {
        return false;
      }

      // Try to parse as JSON and validate structure
      const content = await fsPromises.readFile(backupPath, 'utf8');
      const backupData = JSON.parse(content);

      // Check required fields
      if (!backupData.sessionId || !backupData.timestamp || !backupData.files) {
        return false;
      }

      // Check if files object is valid
      if (typeof backupData.files !== 'object' || Array.isArray(backupData.files)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

module.exports = BackupManager;
