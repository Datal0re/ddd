import Session from '../database/models/session.js';

class DatabaseSessionStore {
  constructor(options = {}) {
    this.defaultOptions = {
      cleanupInterval: 60000, // 1 minute
      ...options
    };
    
    this.sessionModel = new Session();
    
    // Start cleanup interval
    if (this.defaultOptions.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, this.defaultOptions.cleanupInterval);
    }
  }

  async get(sid, callback) {
    try {
      const session = await this.sessionModel.findBySessionId(sid);
      if (!session) {
        return callback(null, null);
      }
      
      // Parse session data if stored as JSON
      let sessionData = {};
      if (session.session_data) {
        try {
          sessionData = JSON.parse(session.session_data);
        } catch (e) {
          console.error('Error parsing session data:', e);
        }
      }
      
      callback(null, sessionData);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      // For now, we'll use the existing session model structure
      // In a full implementation, you might want to add a session_data column
      // to store the actual session data
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback) {
    try {
      await this.sessionModel.delete(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      // Update expiration time
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await this.sessionModel.updateExpiration(sid, newExpiresAt.toISOString());
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async cleanup() {
    try {
      await this.sessionModel.cleanupExpired();
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  // Close the store and cleanup
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default DatabaseSessionStore;