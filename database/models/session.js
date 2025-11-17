import Database from '../init.js';

class Session {
  constructor(db = null) {
    this.db = db || new Database();
    this._connected = false;
  }

  async ensureConnected() {
    if (!this._connected) {
      await this.db.connect();
      this._connected = true;
    }
  }

  async create(sessionData) {
    await this.ensureConnected();
    const { userId, sessionId, expiresAt } = sessionData;
    
    if (!userId || !sessionId || !expiresAt) {
      throw new Error('User ID, session ID, and expires at are required');
    }

    const sql = `
      INSERT INTO user_sessions (user_id, session_id, expires_at)
      VALUES (?, ?, ?)
    `;
    
    try {
      const result = await this.db.run(sql, [userId, sessionId, expiresAt]);
      return await this.findById(result.id);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('Session ID already exists');
      }
      throw err;
    }
  }

  async findById(id) {
    await this.ensureConnected();
    const sql = `
      SELECT s.*, u.username, u.email 
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async findBySessionId(sessionId) {
    await this.ensureConnected();
    const sql = `
      SELECT s.*, u.username, u.email 
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
    `;
    return await this.db.get(sql, [sessionId]);
  }

  async findByUserId(userId, activeOnly = true) {
    await this.ensureConnected();
    let sql = `
      SELECT s.*, u.username, u.email 
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ?
    `;
    
    const params = [userId];
    
    if (activeOnly) {
      sql += ' AND s.expires_at > CURRENT_TIMESTAMP';
    }
    
    sql += ' ORDER BY s.created_at DESC';
    
    return await this.db.all(sql, params);
  }

  async updateExpiration(sessionId, newExpiresAt) {
    await this.ensureConnected();
    const sql = 'UPDATE user_sessions SET expires_at = ? WHERE session_id = ?';
    const result = await this.db.run(sql, [newExpiresAt, sessionId]);
    return result.changes > 0;
  }

  async delete(sessionId) {
    await this.ensureConnected();
    const sql = 'DELETE FROM user_sessions WHERE session_id = ?';
    const result = await this.db.run(sql, [sessionId]);
    return result.changes > 0;
  }

  async deleteById(id) {
    await this.ensureConnected();
    const sql = 'DELETE FROM user_sessions WHERE id = ?';
    const result = await this.db.run(sql, [id]);
    return result.changes > 0;
  }

  async deleteExpired() {
    await this.ensureConnected();
    const sql = 'DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP';
    const result = await this.db.run(sql);
    return result.changes;
  }

  async deleteAllForUser(userId) {
    await this.ensureConnected();
    const sql = 'DELETE FROM user_sessions WHERE user_id = ?';
    const result = await this.db.run(sql, [userId]);
    return result.changes;
  }

  async count(userId = null) {
    await this.ensureConnected();
    let sql = 'SELECT COUNT(*) as count FROM user_sessions';
    const params = [];
    
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    const result = await this.db.get(sql, params);
    return result.count;
  }

  async cleanupExpired() {
    return await this.deleteExpired();
  }
}

export default Session;