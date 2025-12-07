/*
 * Unified Session Manager
 * Eliminates code duplication between Electron (main.js) and Express (app.js)
 * Handles all session lifecycle operations
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger').createLogger({ module: 'SessionManager' });
const {
  ensureDir,
  runMigration,
  processZipUpload,
  removeDirectories,
} = require('./fileUtils.js');
const BackupManager = require('./BackupManager.js');

// Dynamic import for uuid (ES module)
let uuidv4;
const getUuid = async () => {
  if (!uuidv4) {
    const { v4 } = await import('uuid');
    uuidv4 = v4;
  }
  return uuidv4;
};

class SessionManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.sessions = new Map();
    this.sessionsFile = path.join(baseDir, 'data', 'sessions.json');
    this.dataDir = path.join(baseDir, 'data', 'sessions');
    this.mediaDir = path.join(baseDir, 'public', 'media', 'sessions');
    this.backupManager = new BackupManager(baseDir);
  }

  /**
   * Initialize the session manager
   * Loads existing sessions and ensures directories exist
   */
  async initialize() {
    await this.loadSessions();
    await this.ensureDataDirectories();
    logger.info('SessionManager initialized');
  }

  /**
   * Create a new session from uploaded zip data
   * @param {Buffer|string} zipData - Zip file buffer or path
   * @param {boolean} isBuffer - True if zipData is buffer, false if path
   * @returns {Promise<string>} Session ID
   */
  async createSession(zipData, isBuffer = true) {
    const uuidv4 = await getUuid();
    const sessionId = uuidv4();
    const sessionDir = path.join(this.dataDir, sessionId);
    const mediaDir = path.join(this.mediaDir, sessionId);

    logger.info('Creating session ${sessionId} with isBuffer=${isBuffer}');

    // Ensure directories exist
    await ensureDir(sessionDir);
    await ensureDir(mediaDir);

    try {
      // Process zip upload with enhanced security and progress tracking
      logger.info('Starting enhanced zip upload processing...');

      await processZipUpload(
        zipData,
        sessionId,
        sessionDir,
        mediaDir,
        isBuffer,
        progress => {
          logger.info(
            `Upload progress: ${progress.stage} - ${progress.progress}% - ${progress.message}`
          );
        }
      );

      logger.info('Zip upload completed successfully');

      // Run migration
      logger.info('Starting migration process...');
      await runMigration(
        sessionId,
        path.join(sessionDir, 'conversations'),
        this.baseDir
      );
      logger.info('Migration completed successfully');

      // Store session info with enhanced metadata
      this.sessions.set(sessionId, {
        uploadedAt: new Date(),
        size: Buffer.isBuffer(zipData) ? zipData.length : 0,
        status: 'completed',
      });
      await this.saveSessions();

      logger.info('Session created successfully: ${sessionId}');
      return sessionId;
    } catch (error) {
      logger.error('Session creation failed:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      });

      // Clean up on failure
      try {
        await removeDirectories(sessionDir, mediaDir);
        logger.info('Cleanup completed after failure');
      } catch (cleanupError) {
        logger.error('Cleanup failed:', cleanupError);
      }

      throw error;
    }
  }

  /**
   * Get session information
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session info or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Check if session exists
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if session exists
   */
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all sessions
   * @returns {Map} All sessions
   */
  getAllSessions() {
    return new Map(this.sessions);
  }

  /**
   * Delete a session and all its data
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} True if session was deleted
   */
  async deleteSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      return false;
    }

    const sessionDir = path.join(this.dataDir, sessionId);
    const mediaDir = path.join(this.mediaDir, sessionId);

    // Remove directories
    await removeDirectories(sessionDir, mediaDir);

    // Remove from memory
    this.sessions.delete(sessionId);
    await this.saveSessions();

    logger.info('Deleted session: ${sessionId}');
    return true;
  }

  /**
   * Creates backup of a session
   * @param {string} sessionId - Session ID to backup
   * @returns {Promise<string>} Backup path
   */
  async createBackup(sessionId) {
    try {
      const backupPath = await this.backupManager.createBackup(sessionId);
      logger.info('Backup created for session ${sessionId}: ${backupPath}');
      return backupPath;
    } catch (error) {
      logger.error(`Backup failed for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Lists available backups for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} List of backup info
   */
  async listBackups(sessionId) {
    try {
      const backups = await this.backupManager.listBackups(sessionId);
      logger.info('Found ${backups.length} backups for session ${sessionId}');
      return backups;
    } catch (error) {
      logger.error(`Failed to list backups for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Restores session from backup
   * @param {string} sessionId - Session ID
   * @param {string} backupFile - Backup filename
   * @returns {Promise<boolean>} Success status
   */
  async restoreBackup(sessionId, backupFile) {
    try {
      const success = await this.backupManager.restoreBackup(sessionId, backupFile);
      if (success) {
        // Reload sessions after restore
        await this.loadSessions();
        logger.info('Session ${sessionId} restored from ${backupFile}');
      }
      return success;
    } catch (error) {
      logger.error(`Restore failed for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Clean up old sessions
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 24 hours)
   * @returns {Promise<number>} Number of sessions deleted
   */
  async cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const sessionsToDelete = [];

    // Find sessions to delete
    for (const [id, info] of this.sessions.entries()) {
      if (now - info.uploadedAt.getTime() > maxAgeMs) {
        sessionsToDelete.push(id);
      }
    }

    // Delete old sessions
    for (const id of sessionsToDelete) {
      await this.deleteSession(id);
    }

    if (sessionsToDelete.length > 0) {
      logger.info('Cleaned up ${sessionsToDelete.length} old sessions');
    }

    return sessionsToDelete.length;
  }

  /**
   * Get conversations for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Array of conversation objects
   */
  async getConversations(sessionId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Session not found');
    }

    const conversationsDir = path.join(this.dataDir, sessionId, 'conversations');
    try {
      const files = await fs.readdir(conversationsDir);
      const conversations = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(conversationsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const conv = JSON.parse(content);
          conversations.push({
            id: file,
            title: conv.title || 'Untitled',
            date: file.split('_')[0],
          });
        }
      }

      return conversations;
    } catch (error) {
      logger.error(`Error loading conversations for session ${sessionId}:`, error);
      throw new Error('Error loading conversations');
    }
  }

  /**
   * Get specific conversation details
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation file ID
   * @returns {Promise<Object>} Conversation details
   */
  async getConversation(sessionId, conversationId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Session not found');
    }

    const filePath = path.join(
      this.dataDir,
      sessionId,
      'conversations',
      conversationId
    );
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const conv = JSON.parse(content);

      // Import getConversationMessages function
      const { getConversationMessages } = require('../getConversationMessages.js');
      const messages = await getConversationMessages(conv, sessionId, this.baseDir);

      return {
        title: conv.title || 'Untitled',
        messages,
      };
    } catch (error) {
      logger.error(`Error loading conversation ${conversationId}:`, error);
      throw new Error('Error loading conversation');
    }
  }

  /**
   * Load sessions from disk
   */
  async loadSessions() {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf8');
      const parsed = JSON.parse(data);
      this.sessions = new Map(
        parsed.map(([id, info]) => [
          id,
          {
            ...info,
            uploadedAt: new Date(info.uploadedAt),
          },
        ])
      );
      logger.info(`Loaded ${this.sessions.size} sessions from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load sessions:', error.message);
      }
      this.sessions = new Map();
      logger.info('Starting with empty sessions');
    }
  }

  /**
   * Save sessions to disk
   */
  async saveSessions() {
    try {
      const data = JSON.stringify([...this.sessions.entries()], null, 2);
      await fs.writeFile(this.sessionsFile, data);
    } catch (error) {
      logger.error('Failed to save sessions:', error.message);
      throw error;
    }
  }

  /**
   * Ensure required data directories exist
   */
  async ensureDataDirectories() {
    await ensureDir(this.dataDir);
    await ensureDir(this.mediaDir);
  }
}

module.exports = { SessionManager };
