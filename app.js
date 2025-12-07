const express = require('express');
const path = require('path');
const logger = require('./utils/logger').createLogger({ module: 'api-server' });
const { SessionManager } = require('./utils/SessionManager.js');
const { getProgressManager } = require('./utils/ProgressManager.js');
const multer = require('multer');

const app = express();
const port = process.env.API_PORT || 3001;

// Initialize session manager and progress manager
const sessionManager = new SessionManager(__dirname);
const progressManager = getProgressManager();

// Async initialization function
async function initializeApp() {
  await sessionManager.initialize();

  // Periodically clean up old sessions
  setInterval(() => sessionManager.cleanupOldSessions(), 24 * 60 * 60 * 1000); // Daily cleanup

  // Start server
  app.listen(port, () => {
    logger.info('Data Dumpster Diver API server listening on port ${port}');
  });
}

// Initialize the app
initializeApp().catch(logger.error);

// Middleware
app.use(express.json({ limit: '50mb' })); // Support large conversation data
app.use(express.urlencoded({ extended: true }));

// Serve static media files
app.use('/media', express.static(path.join(__dirname, 'public', 'media')));

// Enable CORS for Electron app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Multer config for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ===== API ROUTES =====

// Session Management APIs
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    const sessionArray = Array.from(sessions.entries()).map(([id, info]) => ({
      id,
      uploadedAt: info.uploadedAt,
    }));
    res.json({ success: true, sessions: sessionArray });
  } catch (err) {
    logger.error('Error getting sessions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sessions/:sessionId/conversations', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const conversations = await sessionManager.getConversations(sessionId);
    res.json({ success: true, conversations });
  } catch (err) {
    logger.error('Error getting conversations:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sessions/:sessionId/conversations/:conversationId', async (req, res) => {
  try {
    const { sessionId, conversationId } = req.params;
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const conversation = await sessionManager.getConversation(
      sessionId,
      conversationId
    );
    res.json({ success: true, ...conversation });
  } catch (err) {
    logger.error('Error getting conversation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const deleted = await sessionManager.deleteSession(sessionId);
    res.json({ success: true, deleted });
  } catch (err) {
    logger.error('Error deleting session:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/cleanup', async (req, res) => {
  try {
    const deletedCount = await sessionManager.cleanupOldSessions();
    res.json({ success: true, deletedCount });
  } catch (err) {
    logger.error('Error cleaning up sessions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Backup Management APIs
app.post('/api/sessions/:sessionId/backup', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate session exists before processing
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const backupPath = await sessionManager.createBackup(sessionId);
    res.json({ success: true, data: { backupPath } });
  } catch (err) {
    logger.error('Error creating backup:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sessions/:sessionId/backups', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate session exists before processing
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const backups = await sessionManager.listBackups(sessionId);
    res.json({ success: true, data: { backups } });
  } catch (err) {
    logger.error('Error listing backups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:sessionId/restore', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { backupFile } = req.body;

    // Validate session exists before processing
    if (!sessionManager.hasSession(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Validate backupFile parameter
    if (!backupFile || typeof backupFile !== 'string') {
      return res.status(400).json({ success: false, error: 'Backup file is required' });
    }

    const success = await sessionManager.restoreBackup(sessionId, backupFile);
    res.json({ success: true, data: { restored: success } });
  } catch (err) {
    logger.error('Error restoring backup:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// File Upload API
app.post('/api/upload', upload.single('chatgpt-export'), async (req, res) => {
  let uploadId = null;
  try {
    logger.info('Upload request received:', {
      file: req.file
        ? {
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
          }
        : null,
      headers: req.headers,
    });

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Generate upload ID and create progress entry
    uploadId = progressManager.generateUploadId();
    progressManager.createProgress(uploadId);

    logger.info(
      'Calling sessionManager.createSession with buffer size:',
      req.file.buffer.length
    );

    const sessionId = await sessionManager.createSession(
      req.file.buffer,
      true, // true = buffer
      progressUpdate => {
        // Update progress manager with backend progress
        progressManager.updateProgress(uploadId, {
          stage: progressUpdate.stage,
          progress: progressUpdate.progress,
          message: progressUpdate.message,
        });

        logger.info(
          `Upload progress: ${progressUpdate.stage} - ${progressUpdate.progress}% - ${progressUpdate.message}`
        );
      }
    );

    // Mark progress as completed
    progressManager.completeProgress(uploadId, sessionId);
    logger.info('Session created successfully:', sessionId);

    res.json({ success: true, sessionId, uploadId });
  } catch (err) {
    logger.error('Upload error:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name,
    });

    // Mark progress as failed if we had an upload ID
    if (uploadId) {
      progressManager.failProgress(uploadId, err.message || 'Upload failed');
    }

    res.status(500).json({ success: false, error: err.message || 'Upload failed' });
  }
});

// Progress streaming endpoint
app.get('/api/upload-progress/:uploadId', (req, res) => {
  const { uploadId } = req.params;

  logger.info(`Progress stream requested for upload: ${uploadId}`);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial progress
  const initialProgress = progressManager.getProgress(uploadId);
  if (initialProgress) {
    res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ error: 'Upload not found' })}\n\n`);
  }

  // Set up progress tracking interval
  const progressInterval = setInterval(() => {
    const progress = progressManager.getProgress(uploadId);

    if (!progress) {
      clearInterval(progressInterval);
      res.write(`data: ${JSON.stringify({ error: 'Upload not found' })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify(progress)}\n\n`);

    // End stream if completed, error, or cancelled
    if (['completed', 'error', 'cancelled'].includes(progress.status)) {
      clearInterval(progressInterval);
      res.end();
      logger.info(`Progress stream ended for upload: ${uploadId} (${progress.status})`);
    }
  }, 500); // Update every 500ms

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(progressInterval);
    logger.info(`Progress stream closed by client for upload: ${uploadId}`);
  });
});

// ===== AI INTEGRATION ENDPOINTS (PLACEHOLDERS) =====

app.post('/api/ai/analyze-conversation', async (req, res) => {
  try {
    const { sessionId, conversationId, analysisType } = req.body;

    // Placeholder: Simulate AI analysis
    logger.debug(
      `AI Analysis requested for conversation ${conversationId} in session ${sessionId}`
    );
    logger.info(`Analysis type: ${analysisType}`);

    // Simulate processing delay
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
      message: 'AI analysis completed successfully (placeholder)',
    };

    res.json({
      success: true,
      analysis: placeholderResults,
      message: 'Analysis completed (placeholder implementation)',
    });
  } catch (err) {
    logger.error('AI analysis error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ai/search-conversations', async (req, res) => {
  try {
    const { sessionId, query, searchType } = req.body;

    // Placeholder: Simulate AI-powered semantic search
    logger.info(`AI Search requested in session ${sessionId}`);
    logger.info(`Query: ${query}, Search type: ${searchType}`);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const placeholderResults = [
      {
        conversationId: 'conv_123',
        title: 'Discussion about React hooks',
        relevanceScore: 0.95,
        snippet: '...talking about useState and useEffect hooks in React...',
      },
      {
        conversationId: 'conv_456',
        title: 'JavaScript async patterns',
        relevanceScore: 0.87,
        snippet: '...explaining promises and async/await patterns...',
      },
    ];

    res.json({
      success: true,
      results: placeholderResults,
      message: 'Search completed (placeholder implementation)',
    });
  } catch (err) {
    logger.error('AI search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ai/summarize-session', async (req, res) => {
  try {
    const { sessionId, summaryType } = req.body;

    // Placeholder: Simulate AI session summarization
    logger.info(`AI Summary requested for session ${sessionId}`);
    logger.info(`Summary type: ${summaryType}`);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const placeholderSummary = {
      totalConversations: 42,
      mainTopics: ['programming', 'web development', 'problem solving'],
      overview:
        'This session contains primarily technical discussions about programming concepts, web development, and problem-solving approaches.',
      keyInsights: [
        'Focus on modern JavaScript frameworks',
        'Regular discussion of best practices',
        'Collaborative problem-solving approaches',
      ],
      timeline: 'Conversations span from January to March 2024',
      message: 'Session summary completed (placeholder implementation)',
    };

    res.json({
      success: true,
      summary: placeholderSummary,
      message: 'Summary completed (placeholder implementation)',
    });
  } catch (err) {
    logger.error('AI summary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});
