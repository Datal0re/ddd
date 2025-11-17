import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { csrfSync } from 'csrf-sync';
import { validationResult } from 'express-validator';
import sanitizeHtml from 'sanitize-html';

// Security configuration
const securityConfig = {
  sessionSecret: process.env.SESSION_SECRET || 'data-dumpster-diver-secret-key-change-in-production',
  csrfSecret: process.env.CSRF_SECRET || 'csrf-secret-key-change-in-production',
  environment: process.env.NODE_ENV || 'development'
};

// CSRF protection setup
const csrf = csrfSync({
  getSecret: () => securityConfig.csrfSecret,
  cookieName: 'ddd-csrf-token',
  cookieOptions: {
    secure: securityConfig.environment === 'production',
    httpOnly: true,
    sameSite: 'strict'
  },
  size: 64,
  getTokenFromRequest: (req) => req.body._csrf || req.headers['x-csrf-token']
});

const { generateToken, validateRequest: validateCsrf } = csrf;

// Create double CSRF protection middleware
const doubleCsrfProtection = (req, res, next) => {
  validateCsrf(req, res, next);
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// General rate limiter for all requests
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later.'
);



// Strict rate limiter for authentication routes
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 auth attempts per windowMs
  'Too many authentication attempts, please try again later.'
);

// Rate limiter for registration
const registrationLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // limit each IP to 3 registration attempts per hour
  'Too many registration attempts, please try again later.'
);

// Failed login attempt tracking
const failedLoginAttempts = new Map();

const trackFailedLogin = (username, ip) => {
  const key = `${username}:${ip}`;
  const attempts = failedLoginAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  failedLoginAttempts.set(key, attempts);
  
  // Clean up old entries (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [k, v] of failedLoginAttempts.entries()) {
    if (v.lastAttempt < oneHourAgo) {
      failedLoginAttempts.delete(k);
    }
  }
};

const isAccountLocked = (username, ip) => {
  const key = `${username}:${ip}`;
  const attempts = failedLoginAttempts.get(key);
  
  if (!attempts) return false;
  
  // Lock account after 5 failed attempts for 30 minutes
  if (attempts.count >= 5) {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    if (attempts.lastAttempt > thirtyMinutesAgo) {
      return true;
    } else {
      // Reset attempts if lock period has passed
      failedLoginAttempts.delete(key);
      return false;
    }
  }
  
  return false;
};

const clearFailedLoginAttempts = (username, ip) => {
  const key = `${username}:${ip}`;
  failedLoginAttempts.delete(key);
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Allow basic HTML for certain fields but sanitize dangerous content
        const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br'];
        const allowedAttributes = {};
        
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags,
          allowedAttributes,
          textFilter: (text) => text.trim()
        });
      }
    }
  }
  next();
};

// Validation middleware for API endpoints
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const ip = req.ip || req.connection.remoteAddress;
    console.warn(`Validation failed for IP: ${ip}, Path: ${req.path}, Errors:`, errors.array());
    
    return res.status(400).json({
      error: 'Invalid input provided',
      details: errors.array()
    });
  }
  next();
};

// Validation middleware for form submissions
const validateForm = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const ip = req.ip || req.connection.remoteAddress;
    console.warn(`Validation failed for IP: ${ip}, Path: ${req.path}, Errors:`, errors.array());
    
    // Store errors in locals for template rendering
    res.locals.validationErrors = errors.array();
    return next();
  }
  next();
};

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: securityConfig.environment === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Security logging middleware
const securityLogger = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const timestamp = new Date().toISOString();
  
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempt
    /union.*select/i,  // SQL injection attempt
    /javascript:/i  // JavaScript protocol
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.body)) ||
    pattern.test(JSON.stringify(req.query))
  );
  
  if (isSuspicious) {
    console.warn(`[SECURITY] Suspicious request detected - IP: ${ip}, User-Agent: ${userAgent}, URL: ${req.url}, Body: ${JSON.stringify(req.body)}`);
  }
  
  // Log authentication attempts
  if (req.path.includes('/login') || req.path.includes('/register')) {
    console.info(`[AUTH] ${req.method} ${req.path} - IP: ${ip}, User-Agent: ${userAgent}, Time: ${timestamp}`);
  }
  
  next();
};

// Secure cookie configuration helper
const getSecureCookieOptions = () => ({
  httpOnly: true,
  secure: securityConfig.environment === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
});

export {
  securityHeaders,
  generalLimiter,
  doubleCsrfProtection,
  generateToken,
  validateInput,
  validateForm,
  sanitizeInput,
  securityLogger,
  trackFailedLogin,
  isAccountLocked,
  clearFailedLoginAttempts,
  getSecureCookieOptions,
  securityConfig
};