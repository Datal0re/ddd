import Database from '../init.js';

class User {
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

  async create(userData) {
    await this.ensureConnected();
    const { username, email, passwordHash } = userData;
    
    if (!username || !email || !passwordHash) {
      throw new Error('Username, email, and password hash are required');
    }

    const sql = `
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `;
    
    try {
      const result = await this.db.run(sql, [username, email, passwordHash]);
      return await this.findById(result.id);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        if (err.message.includes('username')) {
          throw new Error('Username already exists');
        } else if (err.message.includes('email')) {
          throw new Error('Email already exists');
        }
      }
      throw err;
    }
  }

  async findById(id) {
    await this.ensureConnected();
    const sql = 'SELECT id, username, email, created_at, last_login FROM users WHERE id = ?';
    return await this.db.get(sql, [id]);
  }

  async findByUsername(username) {
    await this.ensureConnected();
    const sql = 'SELECT id, username, email, password_hash, created_at, last_login FROM users WHERE username = ?';
    return await this.db.get(sql, [username]);
  }

  async findByEmail(email) {
    await this.ensureConnected();
    const sql = 'SELECT id, username, email, password_hash, created_at, last_login FROM users WHERE email = ?';
    return await this.db.get(sql, [email]);
  }

  async updateLastLogin(userId) {
    await this.ensureConnected();
    const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
    const result = await this.db.run(sql, [userId]);
    return result.changes > 0;
  }

  async updatePassword(userId, passwordHash) {
    await this.ensureConnected();
    const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
    const result = await this.db.run(sql, [passwordHash, userId]);
    return result.changes > 0;
  }

  async delete(id) {
    await this.ensureConnected();
    const sql = 'DELETE FROM users WHERE id = ?';
    const result = await this.db.run(sql, [id]);
    return result.changes > 0;
  }

  async getAll(limit = 100, offset = 0) {
    await this.ensureConnected();
    const sql = `
      SELECT id, username, email, created_at, last_login 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    return await this.db.all(sql, [limit, offset]);
  }

  async count() {
    const sql = 'SELECT COUNT(*) as count FROM users';
    const result = await this.db.get(sql);
    return result.count;
  }
}

export default User;