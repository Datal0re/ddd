/**
 * Example: Refactored app.js with proper logging
 */

const express = require('express');
const { SessionManager } = require('./utils/SessionManager.js');
const multer = require('multer');
const { createLogger } = require('./utils/logger');

// Create logger with context
const logger = createLogger({ module: 'ExpressServer' });

const app = express();
const port = process.env.API_PORT || 3001;

// Initialize session manager
const sessionManager = new SessionManager(__dirname);

// Async initialization function
async function initializeApp() {
  const startTime = Date.now();
  logger.info('Initializing Express application');

  try {
    await sessionManager.initialize();
    logger.info('SessionManager initialized successfully');

    // Periodically clean up old sessions
    setInterval(
      () => {
        logger.debug('Running scheduled session cleanup');
        sessionManager
          .cleanupOldSessions()
          .then(count =>
            logger.info('Session cleanup completed', { deletedCount: count })
          )
          .catch(err => logger.error('Session cleanup failed', err));
      },
      24 * 60 * 60 * 1000
    ); // Daily cleanup

    // Start server
    app.listen(port, () => {
      const startupTime = Date.now() - startTime;
      logger.info('Data Dumpster Diver API server started', {
        port,
        startupTime: `${startupTime}ms`,
        nodeEnv: process.env.NODE_ENV,
        pid: process.pid,
      });
    });
  } catch (error) {
    logger.error('Failed to initialize Express application', error, {
      startupTime: `${Date.now() - startTime}ms`,
    });
    process.exit(1);
  }
}

// Initialize the app
initializeApp();

// Middleware
app.use(express.json({ limit: '50mb' })); // Support large conversation data
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const requestId =
    req.headers['x-request-id'] ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  const startTime = Date.now();

  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentLength: req.get('Content-Length'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    });
  });

  next();
});

// Enable CORS for Electron app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID'
  );

  if (req.method === 'OPTIONS') {
    logger.debug('CORS preflight request', {
      requestId: req.requestId,
      origin: req.get('Origin'),
      method: req.get('Access-Control-Request-Method'),
    });
    res.sendStatus(200);
  } else {
    next();
  }
});

// Multer config for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

// ===== API ROUTES =====

// Session Management APIs
app.get('/api/sessions', async (req, res) => {
  const startTime = Date.now();

  try {
    logger.debug('Getting all sessions', { requestId: req.requestId });

    const sessions = sessionManager.getAllSessions();
    const sessionArray = Array.from(sessions.entries()).map(([id, info]) => ({
      id,
      uploadedAt: info.uploadedAt,
    }));

    const duration = Date.now() - startTime;
    logger.info('Sessions retrieved successfully', {
      requestId: req.requestId,
      sessionCount: sessionArray.length,
      duration: `${duration}ms`,
    });

    res.json({ success: true, sessions: sessionArray });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Error getting sessions', err, {
      requestId: req.requestId,
      duration: `${duration}ms`,
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sessions/:sessionId/conversations', async (req, res) => {
  const { sessionId } = req.params;
  const startTime = Date.now();

  try {
    logger.debug('Getting conversations for session', {
      requestId: req.requestId,
      sessionId,
    });

    if (!sessionManager.hasSession(sessionId)) {
      logger.warn('Session not found', {
        requestId: req.requestId,
        sessionId,
      });
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const conversations = await sessionManager.getConversations(sessionId);
    const duration = Date.now() - startTime;

    logger.info('Conversations retrieved successfully', {
      requestId: req.requestId,
      sessionId,
      conversationCount: conversations.length,
      duration: `${duration}ms`,
    });

    res.json({ success: true, conversations });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Error getting conversations', err, {
      requestId: req.requestId,
      sessionId,
      duration: `${duration}ms`,
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

// File Upload API
app.post('/api/upload', upload.single('chatgpt-export'), async (req, res) => {
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    logger.info('Upload request received', {
      requestId: req.requestId,
      uploadId,
      file: req.file
        ? {
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          sizeMB: Math.round((req.file.size / 1024 / 1024) * 100) / 100,
        }
        : null,
      headers: {
        'content-type': req.get('Content-Type'),
        'content-length': req.get('Content-Length'),
      },
    });

    if (!req.file) {
      logger.warn('No file provided in upload request', {
        requestId: req.requestId,
        uploadId,
      });
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    logger.info('Processing uploaded file', {
      requestId: req.requestId,
      uploadId,
      bufferSize: req.file.buffer.length,
    });

    const sessionId = await sessionManager.createSession(req.file.buffer, true);
    const duration = Date.now() - startTime;

    logger.info('Session created successfully from upload', {
      requestId: req.requestId,
      uploadId,
      sessionId,
      duration: `${duration}ms`,
    });

    res.json({ success: true, sessionId });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Upload processing failed', err, {
      requestId: req.requestId,
      uploadId,
      duration: `${duration}ms`,
      errorType: err.constructor.name,
    });
    res.status(500).json({ success: false, error: err.message || 'Upload failed' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  logger.debug('Health check requested', { requestId: req.requestId });

  const healthData = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
  };

  res.json(healthData);
});

// AI Integration endpoints (with placeholder logging)
app.post('/api/ai/analyze-conversation', async (req, res) => {
  const { sessionId, conversationId, analysisType } = req.body;
  const startTime = Date.now();

  logger.info('AI analysis requested', {
    requestId: req.requestId,
    sessionId,
    conversationId,
    analysisType,
  });

  try {
    // Placeholder: Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 1000));

    const placeholderResults = {
      sentiment: 'neutral',
      topics: ['technology', 'programming', 'discussion'],
      summary:
        'This conversation discusses technical topics related to programming and software development.',
      keyPoints: [
        'Discussion about programming concepts',
        'Technical problem solving',
        'Code review and feedback',
      ],
    };

    const duration = Date.now() - startTime;
    logger.info('AI analysis completed (placeholder)', {
      requestId: req.requestId,
      sessionId,
      conversationId,
      analysisType,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      analysis: placeholderResults,
      message: 'Analysis completed (placeholder implementation)',
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('AI analysis failed', err, {
      requestId: req.requestId,
      sessionId,
      conversationId,
      analysisType,
      duration: `${duration}ms`,
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  logger.warn('API endpoint not found', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
  });
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled Express error', err, {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
  });

  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

logger.info('Express server configuration complete');
