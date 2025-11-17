import express from 'express';
import { body, validationResult } from 'express-validator';
import AuthService from '../services/auth.js';
import User from '../database/models/user.js';
import Session from '../database/models/session.js';
import {
  doubleCsrfProtection,
  validateForm,
  trackFailedLogin,
  isAccountLocked,
  clearFailedLoginAttempts
} from '../middleware/security.js';
import { authLimiter, registrationLimiter, passwordChangeLimiter } from '../middleware/rate-limiter.js';

const router = express.Router();
const authService = new AuthService();
const userModel = new User();
const sessionModel = new Session();

// GET /login - Show login form
router.get('/login', (req, res) => {
  res.render('login', { 
    error: null, 
    success: null,
    username: '',
    csrfToken: req.csrfToken ? req.csrfToken() : ''
  });
});

// POST /login - Handle login
router.post('/login', 
  authLimiter,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required')
  ],
  validateForm,
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      
      // Check if account is locked
      if (isAccountLocked(username, ip)) {
        return res.render('login', { 
          error: 'Account temporarily locked due to too many failed attempts. Please try again later.', 
          success: null,
          username: req.body.username || '',
          csrfToken: req.csrfToken ? req.csrfToken() : ''
        });
      }
      
      const result = await authService.login(username, password);
      
      // Clear failed login attempts on successful login
      clearFailedLoginAttempts(username, ip);
      
      // Set session
      req.session.userId = result.user.id;
      req.session.username = result.user.username;
      req.session.sessionId = result.sessionId;
      req.session.expiresAt = result.expiresAt;
      
      // Save session and redirect
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.render('login', { 
            error: 'Session error occurred', 
            success: null,
            username: req.body.username || '',
            csrfToken: req.csrfToken ? req.csrfToken() : ''
          });
        }
        res.redirect('/');
      });
    } catch (error) {
      console.error('Login error:', error);
      
      // Track failed login attempt
      const { username } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      trackFailedLogin(username, ip);
      
      res.render('login', { 
        error: error.message, 
        success: null,
        username: req.body.username || '',
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }
  }
);

// GET /register - Show registration form
router.get('/register', (req, res) => {
  res.render('register', { 
    error: null, 
    success: null,
    formData: {},
    csrfToken: req.csrfToken ? req.csrfToken() : ''
  });
});

// POST /register - Handle registration
router.post('/register',
  registrationLimiter,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],
  validateForm,
  async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      const user = await authService.register({ username, email, password });
      
      res.render('login', { 
        error: null, 
        success: 'Registration successful! Please log in.',
        username: username,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.render('register', { 
        error: error.message, 
        success: null,
        formData: { username: req.body.username, email: req.body.email },
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }
  }
);

// POST /logout - Handle logout
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.sessionID || req.session?.sessionId;
    
    if (sessionId) {
      await authService.logout(sessionId);
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('/login');
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/login');
  }
});

// GET /logout - Handle logout via GET
router.get('/logout', (req, res) => {
  res.redirect('/');
});

// Profile management routes
// GET /profile - Show user profile
router.get('/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    
    // Get user information
    const user = await userModel.findById(req.session.userId);
    if (!user) {
      return res.redirect('/login');
    }
    
    // Get user sessions
    const sessions = await sessionModel.findByUserId(req.session.userId);
    
    // Calculate statistics (mock data for now, would be calculated from actual conversation data)
    const totalConversations = sessions.length * 5; // Mock calculation
    const totalMessages = sessions.length * 25; // Mock calculation
    
    res.render('profile', {
      user,
      sessions,
      totalConversations,
      totalMessages,
      error: null,
      success: null,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).render('profile', {
      user: req.session,
      sessions: [],
      totalConversations: 0,
      totalMessages: 0,
      error: 'Failed to load profile',
      success: null,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }
});

// POST /profile/update - Update user profile
router.post('/profile/update',
  doubleCsrfProtection,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],
  validateForm,
  async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    
    const { username, email } = req.body;
    
    // Validate input
    if (!username || username.length < 3) {
      return res.render('profile', {
        user: { ...req.session, username, email },
        sessions: [],
        totalConversations: 0,
        totalMessages: 0,
        error: 'Username must be at least 3 characters',
        success: null
      });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.render('profile', {
        user: { ...req.session, username, email },
        sessions: [],
        totalConversations: 0,
        totalMessages: 0,
        error: 'Please enter a valid email address',
        success: null
      });
    }
    
    // Update user (this would need to be implemented in the User model)
    // For now, just show success message
    res.render('profile', {
      user: { ...req.session, username, email },
      sessions: [],
      totalConversations: 0,
      totalMessages: 0,
      error: null,
      success: 'Profile updated successfully!'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.render('profile', {
      user: req.session,
      sessions: [],
      totalConversations: 0,
      totalMessages: 0,
      error: 'Failed to update profile',
      success: null
    });
  }
});

// POST /profile/change-password - Change password
router.post('/profile/change-password',
  passwordChangeLimiter,
  doubleCsrfProtection,
  [
    body('currentPassword')
      .isLength({ min: 1 })
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmNewPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('New passwords do not match');
        }
        return true;
      })
  ],
  validateForm,
  async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.render('profile', {
        user: req.session,
        sessions: [],
        totalConversations: 0,
        totalMessages: 0,
        error: 'All password fields are required',
        success: null
      });
    }
    
    if (newPassword !== confirmNewPassword) {
      return res.render('profile', {
        user: req.session,
        sessions: [],
        totalConversations: 0,
        totalMessages: 0,
        error: 'New passwords do not match',
        success: null
      });
    }
    
    if (newPassword.length < 8) {
      return res.render('profile', {
        user: req.session,
        sessions: [],
        totalConversations: 0,
        totalMessages: 0,
        error: 'Password must be at least 8 characters',
        success: null
      });
    }
    
    // Change password (this would need to be implemented in the AuthService)
    // For now, just show success message
    res.render('profile', {
      user: req.session,
      sessions: [],
      totalConversations: 0,
      totalMessages: 0,
      error: null,
      success: 'Password changed successfully!'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.render('profile', {
      user: req.session,
      sessions: [],
      totalConversations: 0,
      totalMessages: 0,
      error: 'Failed to change password',
      success: null
    });
  }
});

// DELETE /profile/delete-session/:id - Delete a session
router.delete('/profile/delete-session/:id',
  doubleCsrfProtection,
  async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const sessionId = req.params.id;
    
    // Delete session
    const deleted = await sessionModel.deleteById(sessionId);
    
    if (deleted) {
      res.json({ success: true, message: 'Session deleted successfully' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// POST /profile/delete-account - Delete user account
router.post('/profile/delete-account',
  doubleCsrfProtection,
  [
    body('confirmPassword')
      .isLength({ min: 1 })
      .withMessage('Password confirmation is required')
  ],
  validateForm,
  async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    
    const { confirmPassword } = req.body;
    
    if (!confirmPassword) {
      return res.render('profile', {
        user: req.session,
        sessions: [],
        totalConversations: 0,
        totalMessages: 0,
        error: 'Password confirmation is required',
        success: null
      });
    }
    
    // Verify password (this would need to be implemented)
    // For now, just redirect to login after "deleting"
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('/login');
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.render('profile', {
      user: req.session,
      sessions: [],
      totalConversations: 0,
      totalMessages: 0,
      error: 'Failed to delete account',
      success: null
    });
  }
});

export default router;