import AuthService from '../services/auth.js';
import { generateToken } from './security.js';

const authService = new AuthService();

const requireAuth = async (req, res, next) => {
  try {
    const sessionId = req.session?.sessionId || req.headers['x-session-id'];
    
    if (!sessionId) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/login');
    }
    
    const session = await authService.validateSession(sessionId);
    if (!session) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      return res.redirect('/login');
    }
    
    req.user = session.user;
    req.sessionData = session;
    
    // Generate CSRF token for authenticated users
    req.csrfToken = () => generateToken(req, res);
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    res.redirect('/login');
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const sessionId = req.session?.sessionId || req.headers['x-session-id'];
    
    if (sessionId) {
      const session = await authService.validateSession(sessionId);
      if (session) {
        req.user = session.user;
        req.sessionData = session;
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

export { requireAuth, optionalAuth };