const express = require('express');
const path = require('path');
const logger = require('./utils/logger').createLogger({ module: 'api-server' });
const { ExportManager } = require('./utils/ExportManager.js');
const { MigrationManager } = require('./utils/MigrationManager.js');
const { ExportBackupManager } = require('./utils/ExportBackupManager.js');
const { getProgressManager } = require('./utils/ProgressManager.js');
const multer = require('multer');

const app = express();
const port = process.env.API_PORT || 3001;

// Initialize managers
const exportManager = new ExportManager(__dirname);
const migrationManager = new MigrationManager(__dirname);
const backupManager = new ExportBackupManager();
const progressManager = getProgressManager();

// Async initialization function
async function initializeApp() {
  await exportManager.initialize();
  await migrationManager.initialize();
  await backupManager.initialize();

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

// Serve static media files from exports directory
app.use('/media', express.static(path.join(__dirname, 'data', 'exports')));

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

// Export Management APIs
app.get('/api/exports', async (req, res) => {
  try {
    const exports = exportManager.getAllExports();
    const exportArray = Array.from(exports.entries()).map(([name, info]) => ({
      name,
      createdAt: info.createdAt,
      conversationCount: info.conversationCount,
    }));
    res.json({ success: true, exports: exportArray });
  } catch (err) {
    logger.error('Error getting exports:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/exports/:exportName', async (req, res) => {
  try {
    const { exportName } = req.params;
    if (!exportManager.hasExport(exportName)) {
      return res.status(404).json({ success: false, error: 'Export not found' });
    }

    const exportInfo = await exportManager.getExportStats(exportName);
    res.json({ success: true, export: exportInfo });
  } catch (err) {
    logger.error('Error getting export:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/exports/:exportName', async (req, res) => {
  try {
    const { exportName } = req.params;
    const deleted = await exportManager.deleteExport(exportName);
    res.json({ success: true, deleted });
  } catch (err) {
    logger.error('Error deleting export:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Conversation APIs
app.get('/api/conversations/:exportName', async (req, res) => {
  try {
    const { exportName } = req.params;
    if (!exportManager.hasExport(exportName)) {
      return res.status(404).json({ success: false, error: 'Export not found' });
    }

    const conversations = await exportManager.getConversations(exportName);
    res.json({ success: true, conversations });
  } catch (err) {
    logger.error('Error getting conversations:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversations/:exportName/:conversationId', async (req, res) => {
  try {
    const { exportName, conversationId } = req.params;
    if (!exportManager.hasExport(exportName)) {
      return res.status(404).json({ success: false, error: 'Export not found' });
    }

    const conversation = await exportManager.getConversation(
      exportName,
      conversationId
    );
    res.json({ success: true, ...conversation });
  } catch (err) {
    logger.error('Error getting conversation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Media file serving
app.get('/api/media/:exportName/*', async (req, res) => {
  try {
    const { exportName } = req.params;
    const mediaPath = req.params[0];

    if (!exportManager.hasExport(exportName)) {
      return res.status(404).json({ success: false, error: 'Export not found' });
    }

    const filePath = exportManager.getMediaPath(exportName, mediaPath);
    const exists = await exportManager.mediaExists(exportName, mediaPath);

    if (!exists) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    logger.error('Error serving media file:', err);
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

    // Get export name from request body or use filename
    const exportName = req.body.exportName || req.file.originalname.replace('.zip', '');

    // Generate upload ID and create progress entry
    uploadId = progressManager.generateUploadId();
    progressManager.createProgress(uploadId);

    logger.info(
      'Calling exportManager.createExport with buffer size:',
      req.file.buffer.length
    );

    const createdExportName = await exportManager.createExport(
      req.file.buffer,
      exportName,
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
    progressManager.completeProgress(uploadId, createdExportName);
    logger.info('Export created successfully:', createdExportName);

    res.json({ success: true, exportName: createdExportName, uploadId });
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
    const { exportName, conversationId, analysisType } = req.body;

    // Placeholder: Simulate AI analysis
    logger.debug(
      `AI Analysis requested for conversation ${conversationId} in export ${exportName}`
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
    const { exportName, query, searchType } = req.body;

    // Placeholder: Simulate AI-powered semantic search
    logger.info(`AI Search requested in export ${exportName}`);
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

app.post('/api/ai/summarize-export', async (req, res) => {
  try {
    const { exportName, summaryType } = req.body;

    // Placeholder: Simulate AI export summarization
    logger.info(`AI Summary requested for export ${exportName}`);
    logger.info(`Summary type: ${summaryType}`);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const placeholderSummary = {
      totalConversations: 42,
      mainTopics: ['programming', 'web development', 'problem solving'],
      overview:
        'This export contains primarily technical discussions about programming concepts, web development, and problem-solving approaches.',
      keyInsights: [
        'Focus on modern JavaScript frameworks',
        'Regular discussion of best practices',
        'Collaborative problem-solving approaches',
      ],
      timeline: 'Conversations span from January to March 2024',
      message: 'Export summary completed (placeholder implementation)',
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

// ===== MIGRATION ENDPOINTS =====

// Get migratable sessions
app.get('/api/migration/sessions', async (req, res) => {
  try {
    const sessions = await migrationManager.getMigratableSessions();
    const hasMigratable = await migrationManager.hasMigratableSessions();

    res.json({
      success: true,
      sessions,
      hasMigratable,
      count: sessions.length,
    });
  } catch (err) {
    logger.error('Error getting migratable sessions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get migration statistics
app.get('/api/migration/stats', async (req, res) => {
  try {
    const stats = await migrationManager.getMigrationStats();
    const hasMigratable = await migrationManager.hasMigratableSessions();

    res.json({
      success: true,
      stats: { ...stats, hasMigratable },
    });
  } catch (err) {
    logger.error('Error getting migration stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Migrate a single session
app.post('/api/migration/session', async (req, res) => {
  try {
    const { sessionId, exportName } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    if (!exportName) {
      return res.status(400).json({ success: false, error: 'exportName is required' });
    }

    // Progress tracking
    const progressCallbacks = new Map();
    const migrationId = sessionId + '_' + Date.now();

    const onProgress = progress => {
      progressCallbacks.set(migrationId, progress);
    };

    // Start migration in background
    migrateSession(sessionId, exportName, onProgress)
      .then(result => {
        progressCallbacks.set(migrationId, { ...result, status: 'completed' });
      })
      .catch(error => {
        progressCallbacks.set(migrationId, {
          status: 'error',
          error: error.message,
        });
      });

    res.json({
      success: true,
      migrationId,
      message: 'Migration started',
    });
  } catch (err) {
    logger.error('Error starting migration:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get migration progress
app.get('/api/migration/progress/:migrationId', (req, res) => {
  try {
    const { migrationId } = req.params;
    // This is a simplified progress tracking
    // In a real implementation, you'd want a more robust progress tracking system
    res.json({
      success: true,
      migrationId,
      status: 'processing',
      message: 'Migration in progress',
    });
  } catch (err) {
    logger.error('Error getting migration progress:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0', // Updated version for Phase 2
  });
});

// =============================================
// BACKUP API ENDPOINTS
// =============================================

// List backups for an export
app.get('/api/exports/:exportName/backups', async (req, res) => {
  try {
    const { exportName } = req.params;
    const backups = await backupManager.listBackups(exportName);
    res.json({ success: true, data: backups });
  } catch (error) {
    logger.error('Failed to list backups', {
      exportName: req.params.exportName,
      error: error.message,
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create backup for an export
app.post('/api/exports/:exportName/backups', async (req, res) => {
  try {
    const { exportName } = req.params;
    const { incremental = false, cloudSync = false } = req.body;

    const backupInfo = await backupManager.createBackup(exportName, {
      incremental,
      cloudSync,
    });

    res.json({ success: true, data: backupInfo });
  } catch (error) {
    logger.error('Failed to create backup', {
      exportName: req.params.exportName,
      error: error.message,
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restore backup for an export
app.post('/api/exports/:exportName/backups/:backupId/restore', async (req, res) => {
  try {
    const { exportName, backupId } = req.params;

    const result = await backupManager.restoreBackup(exportName, backupId);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to restore backup', {
      exportName: req.params.exportName,
      backupId: req.params.backupId,
      error: error.message,
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete backup
app.delete('/api/exports/:exportName/backups/:backupId', async (req, res) => {
  try {
    const { exportName, backupId } = req.params;

    await backupManager.deleteBackup(exportName, backupId);

    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete backup', {
      exportName: req.params.exportName,
      backupId: req.params.backupId,
      error: error.message,
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get backup statistics
app.get('/api/backups/stats', async (req, res) => {
  try {
    const stats = await backupManager.getBackupStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get backup stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup old backups for an export
app.post('/api/exports/:exportName/backups/cleanup', async (req, res) => {
  try {
    const { exportName } = req.params;

    await backupManager.cleanupOldBackups(exportName);

    res.json({ success: true, message: 'Backup cleanup completed' });
  } catch (error) {
    logger.error('Failed to cleanup backups', {
      exportName: req.params.exportName,
      error: error.message,
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Helper function to migrate session (extracted for async use)
async function migrateSession(sessionId, exportName, onProgress) {
  return await migrationManager.migrateSession(sessionId, exportName, onProgress);
}
