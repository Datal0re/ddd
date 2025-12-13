/*
 * Migration Manager
 * Handles migration from session-based architecture to export-based architecture
 * Provides utilities for converting existing sessions to exports
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./logger');
const { ensureDir, removeDirectories, copyFile } = require('./fileUtils');

const logger = createLogger({ module: 'MigrationManager' });

class MigrationManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.sessionsDir = path.join(baseDir, 'data', 'sessions');
    this.exportsDir = path.join(baseDir, 'data', 'exports');
    this.sessionsFile = path.join(baseDir, 'data', 'sessions.json');
    this.exportsFile = path.join(baseDir, 'data', 'exports.json');
    this.publicMediaDir = path.join(baseDir, 'public', 'media', 'sessions');
    this.dataMediaDir = path.join(baseDir, 'data', 'exports'); // Media moves to data/exports
  }

  /**
   * Initialize migration manager
   */
  async initialize() {
    await ensureDir(this.exportsDir);
    logger.info('MigrationManager initialized');
  }

  /**
   * Get all existing sessions that can be migrated
   * @returns {Promise<Array>} Array of session information
   */
  async getMigratableSessions() {
    try {
      const sessions = await this.loadSessions();
      const migratableSessions = [];

      for (const [sessionId, sessionInfo] of sessions.entries()) {
        const sessionPath = path.join(this.sessionsDir, sessionId);

        // Check if session directory exists
        try {
          await fs.access(sessionPath);

          // Get session statistics
          const stats = await this.getSessionStats(sessionId);

          migratableSessions.push({
            id: sessionId,
            name:
              sessionInfo.exportName || this.generateExportName(sessionId, sessionInfo),
            uploadedAt: sessionInfo.uploadedAt,
            status: sessionInfo.status,
            size: sessionInfo.size,
            stats,
            canMigrate: stats.conversationCount > 0,
          });
        } catch (err) {
          logger.warn(`Session ${sessionId} directory not accessible:`, err.message);
        }
      }

      return migratableSessions;
    } catch (error) {
      logger.error('Error getting migratable sessions:', error);
      return [];
    }
  }

  /**
   * Get statistics for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats(sessionId) {
    const sessionPath = path.join(this.sessionsDir, sessionId);
    const stats = {
      conversationCount: 0,
      mediaFileCount: 0,
      totalSize: 0,
      hasAssets: false,
      hasMedia: false,
    };

    try {
      // Check conversations directory
      const conversationsDir = path.join(sessionPath, 'conversations');
      try {
        const conversationFiles = await fs.readdir(conversationsDir);
        stats.conversationCount = conversationFiles.filter(f =>
          f.endsWith('.json')
        ).length;
      } catch {
        // Conversations directory doesn't exist
      }

      // Check for assets.json
      const assetsPath = path.join(sessionPath, 'assets.json');
      try {
        await fs.access(assetsPath);
        const assetsData = await fs.readFile(assetsPath, 'utf8');
        const assets = JSON.parse(assetsData);
        stats.hasAssets = true;
        stats.mediaFileCount = Array.isArray(assets)
          ? assets.length
          : Object.keys(assets).length;
      } catch {
        // No assets file
      }

      // Check media directory
      const mediaPath = path.join(this.publicMediaDir, sessionId);
      try {
        const mediaFiles = await this.getAllFiles(mediaPath);
        stats.hasMedia = true;
        stats.mediaFileCount += mediaFiles.length;

        // Calculate total size
        for (const file of mediaFiles) {
          const fileStats = await fs.stat(file);
          stats.totalSize += fileStats.size;
        }
      } catch {
        // No media directory
      }

      // Add conversation files size
      if (stats.conversationCount > 0) {
        try {
          const conversationFiles = await fs.readdir(conversationsDir);
          for (const file of conversationFiles.filter(f => f.endsWith('.json'))) {
            const filePath = path.join(conversationsDir, file);
            const fileStats = await fs.stat(filePath);
            stats.totalSize += fileStats.size;
          }
        } catch {
          // Error reading conversation files
        }
      }
    } catch (err) {
      logger.warn(`Error getting stats for session ${sessionId}:`, err.message);
    }

    return stats;
  }

  /**
   * Migrate a single session to export format
   * @param {string} sessionId - Session ID to migrate
   * @param {string} exportName - Name for the new export
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Object>} Migration result
   */
  async migrateSession(sessionId, exportName, onProgress = null) {
    const progressCallback = (stage, progress, message) => {
      if (onProgress) {
        onProgress({ sessionId, stage, progress, message });
      }
      logger.info(`Migration [${sessionId}]: ${stage} - ${progress}% - ${message}`);
    };

    try {
      progressCallback('validating', 5, 'Validating session data...');

      // Validate session exists
      const sessionPath = path.join(this.sessionsDir, sessionId);
      await fs.access(sessionPath);

      // Sanitize export name
      const sanitizedExportName = this.sanitizeExportName(exportName);
      const exportPath = path.join(this.exportsDir, sanitizedExportName);

      // Check if export already exists
      try {
        await fs.access(exportPath);
        throw new Error(
          `Export "${sanitizedExportName}" already exists. Please choose a different name.`
        );
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      progressCallback('preparing', 10, 'Preparing export directory...');

      // Create export directory structure
      await ensureDir(path.join(exportPath, 'conversations'));
      await ensureDir(path.join(exportPath, 'media'));

      progressCallback('copying-conversations', 30, 'Copying conversation files...');

      // Copy conversation files
      const conversationStats = await this.copyConversations(sessionId, exportPath);

      progressCallback('copying-assets', 60, 'Copying assets and media...');

      // Copy assets.json
      const assetStats = await this.copyAssets(sessionId, exportPath);

      // Copy media files
      const mediaStats = await this.copyMedia(sessionId, sanitizedExportName);

      progressCallback('updating-exports', 90, 'Updating export registry...');

      // Register the new export
      await this.registerExport(sanitizedExportName, {
        name: sanitizedExportName,
        migratedFrom: sessionId,
        migratedAt: new Date(),
        conversationCount: conversationStats.conversationCount,
        mediaFileCount: assetStats.assetCount + mediaStats.fileCount,
        totalSize:
          conversationStats.totalSize + assetStats.totalSize + mediaStats.totalSize,
      });

      progressCallback('completed', 100, 'Migration completed successfully');

      logger.info(
        `Session ${sessionId} successfully migrated to export "${sanitizedExportName}"`
      );

      return {
        success: true,
        sessionId,
        exportName: sanitizedExportName,
        stats: {
          conversations: conversationStats,
          assets: assetStats,
          media: mediaStats,
        },
      };
    } catch (error) {
      logger.error(`Migration failed for session ${sessionId}:`, error);
      progressCallback('error', 0, `Migration failed: ${error.message}`);

      // Cleanup partial migration
      await this.cleanupPartialMigration(exportName);

      throw error;
    }
  }

  /**
   * Copy conversation files from session to export
   * @param {string} sessionId - Source session ID
   * @param {string} exportPath - Destination export path
   * @returns {Promise<Object>} Copy statistics
   */
  async copyConversations(sessionId, exportPath) {
    const stats = {
      conversationCount: 0,
      totalSize: 0,
    };

    const sessionConversationsDir = path.join(
      this.sessionsDir,
      sessionId,
      'conversations'
    );
    const exportConversationsDir = path.join(exportPath, 'conversations');

    try {
      const conversationFiles = await fs.readdir(sessionConversationsDir);

      for (const file of conversationFiles.filter(f => f.endsWith('.json'))) {
        const srcPath = path.join(sessionConversationsDir, file);
        const destPath = path.join(exportConversationsDir, file);

        await copyFile(srcPath, destPath);

        const fileStats = await fs.stat(destPath);
        stats.totalSize += fileStats.size;
        stats.conversationCount++;
      }
    } catch (error) {
      logger.warn(
        `Error copying conversations for session ${sessionId}:`,
        error.message
      );
    }

    return stats;
  }

  /**
   * Copy assets.json from session to export
   * @param {string} sessionId - Source session ID
   * @param {string} exportPath - Destination export path
   * @returns {Promise<Object>} Copy statistics
   */
  async copyAssets(sessionId, exportPath) {
    const stats = {
      assetCount: 0,
      totalSize: 0,
    };

    const sessionAssetsPath = path.join(this.sessionsDir, sessionId, 'assets.json');
    const exportAssetsPath = path.join(exportPath, 'assets.json');

    try {
      await fs.access(sessionAssetsPath);
      await copyFile(sessionAssetsPath, exportAssetsPath);

      const fileStats = await fs.stat(exportAssetsPath);
      stats.totalSize += fileStats.size;

      // Count assets in the JSON file
      const assetsData = await fs.readFile(exportAssetsPath, 'utf8');
      const assets = JSON.parse(assetsData);
      stats.assetCount = Array.isArray(assets)
        ? assets.length
        : Object.keys(assets).length;
    } catch {
      this.log.debug('Session no longer exists');
    }

    return stats;
  }

  /**
   * Copy media files from session to export
   * @param {string} sessionId - Source session ID
   * @param {string} exportName - Destination export name
   * @returns {Promise<Object>} Copy statistics
   */
  async copyMedia(sessionId, exportName) {
    const stats = {
      fileCount: 0,
      totalSize: 0,
    };

    const sessionMediaPath = path.join(this.publicMediaDir, sessionId);
    const exportMediaPath = path.join(this.dataMediaDir, exportName, 'media');

    try {
      await fs.access(sessionMediaPath);

      // Recursively copy all media files
      await this.copyDirectory(sessionMediaPath, exportMediaPath);

      // Count files and calculate size
      const allFiles = await this.getAllFiles(exportMediaPath);
      for (const file of allFiles) {
        const fileStats = await fs.stat(file);
        stats.totalSize += fileStats.size;
        stats.fileCount++;
      }
    } catch {
      logger.debug(`No media directory found for session ${sessionId}`);
    }

    return stats;
  }

  /**
   * Recursively copy directory
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   */
  async copyDirectory(src, dest) {
    await ensureDir(dest);

    const items = await fs.readdir(src);

    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stats = await fs.stat(srcPath);

      if (stats.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Register a new export in the exports registry
   * @param {string} exportName - Export name
   * @param {Object} exportInfo - Export information
   */
  async registerExport(exportName, exportInfo) {
    try {
      let exports = new Map();

      // Load existing exports
      try {
        const data = await fs.readFile(this.exportsFile, 'utf8');
        const parsed = JSON.parse(data);
        exports = new Map(
          parsed.map(([name, info]) => [
            name,
            {
              ...info,
              createdAt: new Date(info.createdAt),
            },
          ])
        );
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn('Failed to load exports:', err.message);
        }
      }

      // Add new export
      exports.set(exportName, {
        ...exportInfo,
        createdAt: exportInfo.createdAt || new Date(),
      });

      // Save exports registry
      const data = JSON.stringify([...exports.entries()], null, 2);
      await fs.writeFile(this.exportsFile, data);

      logger.info(`Export "${exportName}" registered successfully`);
    } catch (err) {
      logger.warn('Failed to register export:', err);
      throw err;
    }
  }

  /**
   * Load sessions from sessions.json
   * @returns {Promise<Map>} Sessions map
   */
  async loadSessions() {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf8');
      const parsed = JSON.parse(data);
      return new Map(
        parsed.map(([id, info]) => [
          id,
          {
            ...info,
            uploadedAt: new Date(info.uploadedAt),
          },
        ])
      );
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn('Failed to load sessions:', err.message);
      }
      return new Map();
    }
  }

  /**
   * Generate export name from session information
   * @param {string} sessionId - Session ID
   * @param {Object} sessionInfo - Session information
   * @returns {string} Generated export name
   */
  generateExportName(sessionId, sessionInfo) {
    // Try to extract date from upload time
    const date = sessionInfo.uploadedAt ? new Date(sessionInfo.uploadedAt) : new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Use first 8 characters of session ID
    const shortId = sessionId.substring(0, 8);

    return `ChatGPT_Export_${dateStr}_${shortId}`;
  }

  /**
   * Sanitize export name for file system compatibility
   * @param {string} name - Raw export name
   * @returns {string} Sanitized export name
   */
  sanitizeExportName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim() // Remove leading/trailing whitespace
      .substring(0, 50); // Limit length
  }

  /**
   * Cleanup partial migration if it fails
   * @param {string} exportName - Export name to cleanup
   */
  async cleanupPartialMigration(exportName) {
    try {
      const exportPath = path.join(this.exportsDir, exportName);
      await removeDirectories(exportPath);
      logger.info(`Cleaned up partial migration for ${exportName}`);
    } catch (err) {
      logger.warn(`Failed to cleanup partial migration: ${err.message}`);
    }
  }

  /**
   * Get all files in directory recursively
   * @param {string} dirPath - Directory path
   * @returns {Promise<Array>} Array of file paths
   */
  async getAllFiles(dirPath) {
    const files = [];

    async function traverse(currentPath) {
      try {
        const items = await fs.readdir(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stats = await fs.stat(itemPath);

          if (stats.isDirectory()) {
            await traverse(itemPath);
          } else {
            files.push(itemPath);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    await traverse(dirPath);
    return files;
  }

  /**
   * Check if there are any sessions that can be migrated
   * @returns {Promise<boolean>} True if migratable sessions exist
   */
  async hasMigratableSessions() {
    const sessions = await this.getMigratableSessions();
    return sessions.length > 0;
  }

  /**
   * Get migration statistics
   * @returns {Promise<Object>} Migration statistics
   */
  async getMigrationStats() {
    const sessions = await this.getMigratableSessions();

    return {
      totalSessions: sessions.length,
      migratableSessions: sessions.filter(s => s.canMigrate).length,
      totalSize: sessions.reduce((sum, s) => sum + (s.stats.totalSize || 0), 0),
      totalConversations: sessions.reduce(
        (sum, s) => sum + (s.stats.conversationCount || 0),
        0
      ),
      totalMediaFiles: sessions.reduce(
        (sum, s) => sum + (s.stats.mediaFileCount || 0),
        0
      ),
    };
  }
}

module.exports = { MigrationManager };
