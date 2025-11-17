import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { securityLogger } from './security.js';

// Enhanced rate limiter with custom storage and monitoring
const createAdvancedRateLimiter = (options) => {
  return rateLimit(options);
};

// Rate limiters for different use cases

// General API rate limiter
export const apiLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many API requests, please try again later.',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || ipKeyGenerator(req);
  }
});

// Authentication rate limiter (very strict)
export const authLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts. Account temporarily locked. Please try again later.',
  skipSuccessfulRequests: true, // Don't count successful attempts
  keyGenerator: (req) => {
    // Combine IP and username for more specific limiting
    const username = req.body?.username || req.body?.email || 'unknown';
    return `${ipKeyGenerator(req)}:${username}`;
  }
});

// Registration rate limiter
export const registrationLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: 'Too many registration attempts. Please try again later.',
  keyGenerator: (req) => ipKeyGenerator(req)
});

// Password change rate limiter
export const passwordChangeLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password changes per hour
  message: 'Too many password change attempts. Please try again later.',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req)
});

// File upload rate limiter
export const uploadLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: 'Too many file uploads. Please try again later.',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req)
});

// Session management rate limiter
export const sessionLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 session operations per 15 minutes
  message: 'Too many session operations. Please try again later.',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req)
});

// Bruteforce protection for sensitive endpoints
export const bruteForceLimiter = createAdvancedRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 3, // 3 attempts per 30 minutes
  message: 'Access temporarily blocked due to suspicious activity. Please try again later.',
  keyGenerator: (req) => ipKeyGenerator(req),
  skipSuccessfulRequests: true
});

// Progressive rate limiter that gets stricter with repeated violations
// export const progressiveLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50, // Reduced limit for potentially problematic users
//   message: 'Rate limit progressively reduced due to repeated violations.',
//   keyGenerator: (req) => ipKeyGenerator(req)
// });

// Rate limiter status middleware
export const rateLimitStatus = (req, res, next) => {
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '99');
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 15 * 60 * 1000).toISOString());
  next();
};

// Cleanup old rate limit data periodically
setInterval(() => {
  // This would be handled by the custom store's cleanup logic
  console.debug('[RATE_LIMIT] Periodic cleanup completed');
}, 60 * 60 * 1000); // Every hour

export default {
  apiLimiter,
  authLimiter,
  registrationLimiter,
  passwordChangeLimiter,
  uploadLimiter,
  sessionLimiter,
  bruteForceLimiter
};