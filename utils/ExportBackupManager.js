/**
 * Enhanced Backup Manager for Export System
 *
 * Provides comprehensive backup and recovery functionality for exports,
 * including incremental backups, compression, and cloud integration hooks.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const tar = require('tar');
const logger = require('./logger');

class ExportBackupManager {
  constructor(options = {}) {
    this.backupDir = options.backupDir || path.join(process.cwd(), 'backups-exports');
    this.exportsDir = options.exportsDir || path.join(process.cwd(), 'data', 'exports');
    this.maxBackups = options.maxBackups || 10;
    this.compressionLevel = options.compressionLevel || 6;
    this.incrementalEnabled = options.incremental !== false;
    this.cloudProvider = options.cloudProvider || null;

    this.backupIndexFile = path.join(this.backupDir, 'backup-index.json');
    this.backupLog = logger.child({ component: 'ExportBackupManager' });
  }

  /**
   * Initialize backup system
   */
  async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });

      // Load existing backup index
      await this.loadBackupIndex();

      this.backupLog.info('Export backup system initialized', {
        backupDir: this.backupDir,
        incrementalEnabled: this.incrementalEnabled,
      });

      return true;
    } catch (error) {
      this.backupLog.error('Failed to initialize backup system', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Load backup index from disk
   */
  async loadBackupIndex() {
    try {
      const indexData = await fs.readFile(this.backupIndexFile, 'utf8');
      this.backupIndex = JSON.parse(indexData);
    } catch {
      this.backupLog.warn('No existing backup index found, starting fresh');
      this.backupIndex = {
        version: '1.0.0',
        created: new Date().toISOString(),
        exports: {},
        lastCleanup: null,
      };
    }
  }

  /**
   * Save backup index to disk
   */
  async saveBackupIndex() {
    try {
      await fs.writeFile(
        this.backupIndexFile,
        JSON.stringify(this.backupIndex, null, 2),
        'utf8'
      );
    } catch (error) {
      this.backupLog.error('Failed to save backup index', { error: error.message });
      throw error;
    }
  }

  /**
   * Create full backup of an export
   */
  async createBackup(exportName, options = {}) {
    const startTime = Date.now();
    const backupId = this.generateBackupId();

    try {
      const exportPath = path.join(this.exportsDir, exportName);
      const exportExists = await this.pathExists(exportPath);

      if (!exportExists) {
        throw new Error(`Export "${exportName}" not found`);
      }

      const backupInfo = {
        id: backupId,
        exportName,
        type: options.incremental && this.incrementalEnabled ? 'incremental' : 'full',
        created: new Date().toISOString(),
        size: 0,
        compressedSize: 0,
        fileCount: 0,
        checksum: null,
        cloudSync: options.cloudSync || false,
      };

      this.backupLog.info('Creating backup', {
        exportName,
        backupId,
        type: backupInfo.type,
      });

      // Create backup file
      const backupFile = path.join(this.backupDir, `${backupId}.tar.gz`);
      await this.createBackupFile(exportPath, backupFile, backupInfo);

      // Calculate checksum
      backupInfo.checksum = await this.calculateFileChecksum(backupFile);

      // Update backup index
      if (!this.backupIndex.exports[exportName]) {
        this.backupIndex.exports[exportName] = {
          created: new Date().toISOString(),
          backups: [],
        };
      }

      this.backupIndex.exports[exportName].backups.push(backupInfo);
      this.backupIndex.exports[exportName].lastBackup = backupInfo.created;

      // Cleanup old backups
      await this.cleanupOldBackups(exportName);

      // Save updated index
      await this.saveBackupIndex();

      const duration = Date.now() - startTime;

      this.backupLog.info('Backup created successfully', {
        exportName,
        backupId,
        type: backupInfo.type,
        size: this.formatBytes(backupInfo.size),
        compressedSize: this.formatBytes(backupInfo.compressedSize),
        compressionRatio:
          backupInfo.size > 0
            ? (backupInfo.compressedSize / backupInfo.size).toFixed(2)
            : 0,
        fileCount: backupInfo.fileCount,
        duration: `${duration}ms`,
      });

      // Cloud sync if enabled
      if (options.cloudSync && this.cloudProvider) {
        await this.syncToCloud(backupFile, backupInfo);
      }

      return backupInfo;
    } catch (error) {
      this.backupLog.error('Backup creation failed', {
        exportName,
        backupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create backup file (full or incremental)
   */
  async createBackupFile(sourcePath, backupFile, backupInfo) {
    const { type } = backupInfo;

    if (type === 'incremental') {
      await this.createIncrementalBackup(sourcePath, backupFile, backupInfo);
    } else {
      await this.createFullBackup(sourcePath, backupFile, backupInfo);
    }
  }

  /**
   * Create full backup
   */
  async createFullBackup(sourcePath, backupFile, backupInfo) {
    const stats = await this.getDirectoryStats(sourcePath);
    backupInfo.size = stats.totalSize;
    backupInfo.fileCount = stats.fileCount;

    // Create tar.gz backup
    await tar.create(
      {
        file: backupFile,
        gzip: { level: this.compressionLevel },
        cwd: path.dirname(sourcePath),
        prefix: path.basename(sourcePath),
      },
      [path.basename(sourcePath)]
    );

    const compressedStats = await fs.stat(backupFile);
    backupInfo.compressedSize = compressedStats.size;
  }

  /**
   * Create incremental backup
   */
  async createIncrementalBackup(sourcePath, backupFile, backupInfo) {
    const exportName = backupInfo.exportName;
    const lastBackup = this.getLastFullBackup(exportName);

    if (!lastBackup) {
      this.backupLog.warn('No full backup found, falling back to full backup');
      backupInfo.type = 'full';
      await this.createFullBackup(sourcePath, backupFile, backupInfo);
      return;
    }

    // Get modified files since last backup
    const modifiedFiles = await this.getModifiedFiles(sourcePath, lastBackup.created);

    if (modifiedFiles.length === 0) {
      this.backupLog.info('No modified files since last backup');
      throw new Error('No changes to backup');
    }

    // Create incremental backup with only modified files
    const stats = await this.getFilesStats(modifiedFiles);
    backupInfo.size = stats.totalSize;
    backupInfo.fileCount = stats.fileCount;

    await tar.create(
      {
        file: backupFile,
        gzip: { level: this.compressionLevel },
        cwd: sourcePath,
      },
      modifiedFiles
    );

    const compressedStats = await fs.stat(backupFile);
    backupInfo.compressedSize = compressedStats.size;
  }

  /**
   * Restore export from backup
   */
  async restoreBackup(exportName, backupId) {
    const startTime = Date.now();

    try {
      const backupInfo = this.getBackupInfo(exportName, backupId);
      if (!backupInfo) {
        throw new Error(`Backup "${backupId}" not found for export "${exportName}"`);
      }

      const backupFile = path.join(this.backupDir, `${backupId}.tar.gz`);
      const backupExists = await this.pathExists(backupFile);

      if (!backupExists) {
        throw new Error(`Backup file "${backupFile}" not found`);
      }

      this.backupLog.info('Starting backup restore', {
        exportName,
        backupId,
        backupType: backupInfo.type,
      });

      // Create export directory
      const exportPath = path.join(this.exportsDir, exportName);
      await fs.mkdir(exportPath, { recursive: true });

      // If restoring incremental, need full backup first
      if (backupInfo.type === 'incremental') {
        const fullBackup = this.getLastFullBackup(exportName);
        if (fullBackup) {
          await this.restoreBackupFile(fullBackup.id, exportPath);
        }
      }

      // Restore backup
      await this.restoreBackupFile(backupId, exportPath);

      const duration = Date.now() - startTime;

      this.backupLog.info('Backup restored successfully', {
        exportName,
        backupId,
        duration: `${duration}ms`,
      });

      return {
        exportName,
        backupId,
        restoredAt: new Date().toISOString(),
        backupInfo,
      };
    } catch (error) {
      this.backupLog.error('Backup restore failed', {
        exportName,
        backupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Restore specific backup file
   */
  async restoreBackupFile(backupId, targetPath) {
    const backupFile = path.join(this.backupDir, `${backupId}.tar.gz`);

    await tar.extract({
      file: backupFile,
      cwd: path.dirname(targetPath),
      strip: 1, // Remove top-level directory
    });
  }

  /**
   * List all backups for an export
   */
  async listBackups(exportName) {
    try {
      const exportInfo = this.backupIndex.exports[exportName];
      if (!exportInfo) {
        return [];
      }

      return exportInfo.backups.sort(
        (a, b) => new Date(b.created) - new Date(a.created)
      );
    } catch (error) {
      this.backupLog.error('Failed to list backups', {
        exportName,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Delete specific backup
   */
  async deleteBackup(exportName, backupId) {
    try {
      const backupInfo = this.getBackupInfo(exportName, backupId);
      if (!backupInfo) {
        throw new Error(`Backup "${backupId}" not found for export "${exportName}"`);
      }

      // Delete backup file
      const backupFile = path.join(this.backupDir, `${backupId}.tar.gz`);
      if (await this.pathExists(backupFile)) {
        await fs.unlink(backupFile);
      }

      // Remove from index
      const exportInfo = this.backupIndex.exports[exportName];
      exportInfo.backups = exportInfo.backups.filter(b => b.id !== backupId);

      await this.saveBackupIndex();

      this.backupLog.info('Backup deleted', { exportName, backupId });
      return true;
    } catch (error) {
      this.backupLog.error('Failed to delete backup', {
        exportName,
        backupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats() {
    try {
      const stats = {
        totalExports: Object.keys(this.backupIndex.exports).length,
        totalBackups: 0,
        totalSize: 0,
        totalCompressedSize: 0,
        oldestBackup: null,
        newestBackup: null,
        exports: {},
      };

      for (const [exportName, exportInfo] of Object.entries(this.backupIndex.exports)) {
        const exportStats = {
          backupCount: exportInfo.backups.length,
          totalSize: 0,
          totalCompressedSize: 0,
          lastBackup: exportInfo.lastBackup,
        };

        exportInfo.backups.forEach(backup => {
          exportStats.totalSize += backup.size;
          exportStats.totalCompressedSize += backup.compressedSize;

          if (
            !stats.oldestBackup ||
            new Date(backup.created) < new Date(stats.oldestBackup)
          ) {
            stats.oldestBackup = backup.created;
          }
          if (
            !stats.newestBackup ||
            new Date(backup.created) > new Date(stats.newestBackup)
          ) {
            stats.newestBackup = backup.created;
          }
        });

        stats.totalBackups += exportStats.backupCount;
        stats.totalSize += exportStats.totalSize;
        stats.totalCompressedSize += exportStats.totalCompressedSize;
        stats.exports[exportName] = exportStats;
      }

      return stats;
    } catch (error) {
      this.backupLog.error('Failed to get backup stats', { error: error.message });
      return null;
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups(exportName) {
    try {
      const exportInfo = this.backupIndex.exports[exportName];
      if (!exportInfo || exportInfo.backups.length <= this.maxBackups) {
        return;
      }

      // Sort backups by date (newest first)
      const sortedBackups = [...exportInfo.backups].sort(
        (a, b) => new Date(b.created) - new Date(a.created)
      );

      // Keep the latest maxBackups
      const backupsToKeep = sortedBackups.slice(0, this.maxBackups);
      const backupsToDelete = sortedBackups.slice(this.maxBackups);

      // Delete old backups
      for (const backup of backupsToDelete) {
        // Always keep the latest full backup
        if (
          backup.type === 'full' &&
          backupsToKeep.filter(b => b.type === 'full').length === 0
        ) {
          continue;
        }

        await this.deleteBackup(exportName, backup.id);
      }

      this.backupLog.info('Cleaned up old backups', {
        exportName,
        deletedCount: backupsToDelete.length,
        remainingCount: backupsToKeep.length,
      });
    } catch (error) {
      this.backupLog.error('Failed to cleanup old backups', {
        exportName,
        error: error.message,
      });
    }
  }

  /**
   * Sync backup to cloud (placeholder for cloud integration)
   */
  async syncToCloud(backupFile, backupInfo) {
    try {
      if (!this.cloudProvider) {
        this.backupLog.debug('No cloud provider configured');
        return;
      }

      // Placeholder for cloud integration
      this.backupLog.info('Cloud sync not implemented yet', {
        backupFile,
        backupId: backupInfo.id,
      });

      // TODO: Implement cloud sync based on provider
      // - AWS S3
      // - Google Cloud Storage
      // - Azure Blob Storage
      // - etc.
    } catch (error) {
      this.backupLog.error('Cloud sync failed', {
        backupId: backupInfo.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get backup info from index
   */
  getBackupInfo(exportName, backupId) {
    const exportInfo = this.backupIndex.exports[exportName];
    if (!exportInfo) {
      return null;
    }

    return exportInfo.backups.find(b => b.id === backupId) || null;
  }

  /**
   * Get last full backup for an export
   */
  getLastFullBackup(exportName) {
    const exportInfo = this.backupIndex.exports[exportName];
    if (!exportInfo) {
      return null;
    }

    const fullBackups = exportInfo.backups
      .filter(b => b.type === 'full')
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return fullBackups[0] || null;
  }

  /**
   * Get modified files since timestamp
   */
  async getModifiedFiles(dirPath, since) {
    const modifiedFiles = [];
    const sinceTime = new Date(since).getTime();

    async function walkDir(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          if (stats.mtime.getTime() > sinceTime) {
            modifiedFiles.push(path.relative(dirPath, fullPath));
          }
        }
      }
    }

    await walkDir(dirPath);
    return modifiedFiles;
  }

  /**
   * Get directory statistics
   */
  async getDirectoryStats(dirPath) {
    let totalSize = 0;
    let fileCount = 0;

    async function walkDir(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    }

    await walkDir(dirPath);
    return { totalSize, fileCount };
  }

  /**
   * Get statistics for specific files
   */
  async getFilesStats(filePaths) {
    let totalSize = 0;
    let fileCount = 0;

    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileCount++;
      } catch {
        // File might have been deleted
      }
    }

    return { totalSize, fileCount };
  }

  /**
   * Calculate file checksum
   */
  async calculateFileChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = require('fs').createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Generate unique backup ID
   */
  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Check if path exists
   */
  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = ExportBackupManager;
