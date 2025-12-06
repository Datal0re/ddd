/**
 * Example: Refactored SessionManager.js with proper logging
 */

const fs = require('fs').promises;
const path = require('path');
const {
  ensureDir,
  runMigration,
  processZipUpload,
  removeDirectories,
} = require('./fileUtils.js');
const BackupManager = require('./BackupManager.js');
const { createLogger } = require('./logger');

// Create logger with context
const logger = createLogger({ module: 'SessionManager' });

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

    logger.debug('SessionManager instance created', {
      baseDir,
      sessionsFile: this.sessionsFile,
      dataDir: this.dataDir,
      mediaDir: this.mediaDir,
    });
  }

  /**
   * Initialize the session manager
   * Loads existing sessions and ensures directories exist
   */
  async initialize() {
    const startTime = Date.now();
    logger.info('Initializing SessionManager');

    try {
      await this.loadSessions();
      await this.ensureDataDirectories();

      const duration = Date.now() - startTime;
      logger.info('SessionManager initialized successfully', {
        existingSessions: this.sessions.size,
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('SessionManager initialization failed', error, {
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Create a new session from uploaded zip data
   * @param {Buffer|string} zipData - Zip file buffer or path
   * @param {boolean} isBuffer - True if zipData is buffer, false if path
   * @returns {Promise<string>} Session ID
   */
  async createSession(zipData, isBuffer = true) {
    const sessionId = await getUuid();
    const startTime = Date.now();

    logger.info('Creating new session', {
      sessionId,
      isBuffer,
      dataSize: isBuffer ? zipData.length : 'N/A',
    });

    try {
      const sessionDir = path.join(this.dataDir, sessionId);
      const mediaSessionDir = path.join(this.mediaDir, sessionId);

      // Ensure directories exist
      await ensureDir(sessionDir);
      await ensureDir(mediaSessionDir);

      logger.debug('Session directories created', {
        sessionId,
        sessionDir,
        mediaSessionDir,
      });

      // Process the zip upload
      const processingResult = await processZipUpload(
        zipData,
        sessionId,
        sessionDir,
        mediaSessionDir,
        isBuffer,
        progress => {
          logger.debug('Upload progress', {
            sessionId,
            progress: progress.progress,
            stage: progress.stage,
            message: progress.message,
          });
        }
      );

      // Run migration if needed
      logger.debug('Running data migration for session', { sessionId });
      await runMigration(sessionDir);

      // Store session metadata
      this.sessions.set(sessionId, {
        id: sessionId,
        uploadedAt: new Date().toISOString(),
        conversationCount: processingResult.conversationCount,
        mediaCount: processingResult.mediaCount,
        size: processingResult.totalSize,
      });

      await this.saveSessions();

      const duration = Date.now() - startTime;
      logger.info('Session created successfully', {
        sessionId,
        conversationCount: processingResult.conversationCount,
        mediaCount: processingResult.mediaCount,
        totalSize: processingResult.totalSize,
        duration: `${duration}ms`,
      });

      return sessionId;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Session creation failed', error, {
        sessionId,
        isBuffer,
        duration: `${duration}ms`,
      });

      // Cleanup on failure
      try {
        logger.info('Cleaning up failed session', { sessionId });
        await this.cleanupFailedSession(sessionId);
      } catch (cleanupError) {
        logger.error('Session cleanup failed', cleanupError, { sessionId });
      }

      throw error;
    }
  }

  /**
   * Get all conversations for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Array of conversations
   */
  async getConversations(sessionId) {
    const startTime = Date.now();

    try {
      logger.debug('Getting conversations for session', { sessionId });

      if (!this.hasSession(sessionId)) {
        logger.warn('Session not found when getting conversations', { sessionId });
        throw new Error('Session not found');
      }

      const sessionDir = path.join(this.dataDir, sessionId);
      const conversationsFile = path.join(sessionDir, 'conversations.json');

      const data = await fs.readFile(conversationsFile, 'utf8');
      const conversations = JSON.parse(data);

      const duration = Date.now() - startTime;
      logger.debug('Conversations retrieved successfully', {
        sessionId,
        conversationCount: conversations.length,
        duration: `${duration}ms`,
      });

      return conversations;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get conversations', error, {
        sessionId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Get a specific conversation
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Conversation data
   */
  async getConversation(sessionId, conversationId) {
    const startTime = Date.now();

    try {
      logger.debug('Getting specific conversation', { sessionId, conversationId });

      const conversations = await this.getConversations(sessionId);
      const conversation = conversations.find(conv => conv.id === conversationId);

      if (!conversation) {
        logger.warn('Conversation not found', { sessionId, conversationId });
        throw new Error('Conversation not found');
      }

      const duration = Date.now() - startTime;
      logger.debug('Conversation retrieved successfully', {
        sessionId,
        conversationId,
        messageCount: conversation.messages?.length || 0,
        duration: `${duration}ms`,
      });

      return { conversation };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get conversation', error, {
        sessionId,
        conversationId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteSession(sessionId) {
    const startTime = Date.now();

    try {
      logger.info('Deleting session', { sessionId });

      if (!this.hasSession(sessionId)) {
        logger.warn('Attempted to delete non-existent session', { sessionId });
        return false;
      }

      const sessionDir = path.join(this.dataDir, sessionId);
      const mediaSessionDir = path.join(this.mediaDir, sessionId);

      // Remove session directories
      await removeDirectories([sessionDir, mediaSessionDir]);

      // Remove from sessions map
      this.sessions.delete(sessionId);
      await this.saveSessions();

      const duration = Date.now() - startTime;
      logger.info('Session deleted successfully', {
        sessionId,
        duration: `${duration}ms`,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to delete session', error, {
        sessionId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Clean up old sessions (older than 30 days)
   * @returns {Promise<number>} Number of sessions deleted
   */
  async cleanupOldSessions() {
    const startTime = Date.now();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    logger.info('Starting old session cleanup', { cutoffDate: thirtyDaysAgo });

    try {
      const sessionsToDelete = [];

      for (const [sessionId, sessionInfo] of this.sessions.entries()) {
        const uploadedDate = new Date(sessionInfo.uploadedAt);
        if (uploadedDate < thirtyDaysAgo) {
          sessionsToDelete.push(sessionId);
        }
      }

      logger.info('Found sessions to delete', {
        totalSessions: this.sessions.size,
        sessionsToDelete: sessionsToDelete.length,
      });

      for (const sessionId of sessionsToDelete) {
        try {
          await this.deleteSession(sessionId);
          deletedCount++;
        } catch (error) {
          logger.error('Failed to delete old session', error, { sessionId });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Session cleanup completed', {
        deletedCount,
        attemptedDeletions: sessionsToDelete.length,
        duration: `${duration}ms`,
      });

      return deletedCount;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Session cleanup failed', error, {
        deletedCount,
        duration: `${duration}ms`,
      });
      throw error;
    }
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
   * @returns {Map} Sessions map
   */
  getAllSessions() {
    return this.sessions;
  }

  /**
   * Load sessions from file
   */
  async loadSessions() {
    try {
      logger.debug('Loading sessions from file', { sessionsFile: this.sessionsFile });

      const data = await fs.readFile(this.sessionsFile, 'utf8');
      const sessions = JSON.parse(data);

      this.sessions = new Map(Object.entries(sessions));

      logger.debug('Sessions loaded successfully', {
        sessionCount: this.sessions.size,
        sessionsFile: this.sessionsFile,
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('Sessions file not found, starting with empty sessions', {
          sessionsFile: this.sessionsFile,
        });
        this.sessions = new Map();
      } else {
        logger.error('Failed to load sessions file', error, {
          sessionsFile: this.sessionsFile,
        });
        throw error;
      }
    }
  }

  /**
   * Save sessions to file
   */
  async saveSessions() {
    try {
      const sessionsObject = Object.fromEntries(this.sessions);
      await fs.writeFile(this.sessionsFile, JSON.stringify(sessionsObject, null, 2));

      logger.debug('Sessions saved successfully', {
        sessionCount: this.sessions.size,
        sessionsFile: this.sessionsFile,
      });
    } catch (error) {
      logger.error('Failed to save sessions file', error, {
        sessionsFile: this.sessionsFile,
        sessionCount: this.sessions.size,
      });
      throw error;
    }
  }

  /**
   * Ensure data directories exist
   */
  async ensureDataDirectories() {
    const directories = [path.dirname(this.sessionsFile), this.dataDir, this.mediaDir];

    logger.debug('Ensuring data directories exist', { directories });

    for (const dir of directories) {
      await ensureDir(dir);
    }

    logger.debug('Data directories ensured', { directories });
  }

  /**
   * Clean up a failed session
   * @param {string} sessionId - Session ID to clean up
   */
  async cleanupFailedSession(sessionId) {
    logger.info('Cleaning up failed session', { sessionId });

    try {
      const sessionDir = path.join(this.dataDir, sessionId);
      const mediaSessionDir = path.join(this.mediaDir, sessionId);

      await removeDirectories([sessionDir, mediaSessionDir]);

      // Remove from sessions map if it was added
      this.sessions.delete(sessionId);

      logger.debug('Failed session cleaned up successfully', { sessionId });
    } catch (error) {
      logger.error('Failed to clean up session', error, { sessionId });
      throw error;
    }
  }
}

module.exports = SessionManager;
