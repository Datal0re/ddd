import bcrypt from 'bcrypt';
import User from '../database/models/user.js';
import Session from '../database/models/session.js';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

class AuthService {
  constructor() {
    this.userModel = new User();
    this.sessionModel = new Session();
  }

  async hashPassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  validateRegistrationData(userData) {
    const { username, email, password } = userData;
    
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Valid email address is required');
    }
    
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }
    
    return true;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async register(userData) {
    this.validateRegistrationData(userData);
    
    const { username, email, password } = userData;
    
    // Check if user already exists
    const existingUser = await this.userModel.findByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }
    
    const existingEmail = await this.userModel.findByEmail(email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }
    
    const passwordHash = await this.hashPassword(password);
    
    const user = await this.userModel.create({
      username,
      email,
      passwordHash
    });
    
    return user;
  }

  async login(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    
    const user = await this.userModel.findByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }
    
    const isValidPassword = await this.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }
    
    // Update last login
    await this.userModel.updateLastLogin(user.id);
    
    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await this.sessionModel.create({
      userId: user.id,
      sessionId,
      expiresAt: expiresAt.toISOString()
    });
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        lastLogin: user.last_login
      },
      sessionId,
      expiresAt
    };
  }

  async logout(sessionId) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    const deleted = await this.sessionModel.delete(sessionId);
    return deleted > 0;
  }

  async validateSession(sessionId) {
    if (!sessionId) {
      return null;
    }
    
    const session = await this.sessionModel.findBySessionId(sessionId);
    if (!session) {
      return null;
    }
    
    return {
      id: session.id,
      sessionId: session.session_id,
      user: {
        id: session.user_id,
        username: session.username,
        email: session.email
      },
      expiresAt: session.expires_at
    };
  }

  async refreshSession(sessionId) {
    const session = await this.sessionModel.findBySessionId(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await this.sessionModel.updateExpiration(sessionId, newExpiresAt.toISOString());
    
    return {
      sessionId,
      expiresAt: newExpiresAt
    };
  }

  async cleanupExpiredSessions() {
    return await this.sessionModel.cleanupExpired();
  }
}

export default AuthService;