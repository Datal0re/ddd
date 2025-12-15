const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
const { createLogger } = require('./utils/logger');
// const { MigrationManager } = require('./utils/MigrationManager');
const { getProgressManager } = require('./utils/ProgressManager');
const logger = createLogger({ module: path.basename(__filename, '.js') });

let mainWindow;
const API_BASE_URL = `http://localhost:${process.env.API_PORT || 3001}/api`;
const progressManager = getProgressManager();
// const migrationManager = new MigrationManager(__dirname);

logger.info('Electron: API_BASE_URL =', API_BASE_URL);
logger.info('Electron: process.env.API_PORT =', process.env.API_PORT);

// Add retry mechanism for API connection
async function waitForApiServer(maxRetries = 5, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      logger.info(`API health check ${i + 1}:`, response.data);
      if (response.data.success) {
        logger.info('API server is ready');
        return true;
      }
    } catch (err) {
      logger.info(`API health check ${i + 1} failed:`, err.message);
      if (i === maxRetries - 1) {
        throw err;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Wait for API server to be ready before creating window
app.whenReady().then(async () => {
  logger.info('Electron app ready, waiting for API server...');

  // Initialize migration manager
  // await migrationManager.initialize();

  // Wait for API server with retry mechanism
  const apiReady = await waitForApiServer();
  if (apiReady) {
    logger.info('API server confirmed ready, creating window');
    createWindow();
  } else {
    logger.info('API server not ready after retries, exiting');
    app.quit(1);
  }
});

// Add error handling for API connection failures
process.on('uncaughtException', err => {
  logger.error('Uncaught exception:', err);
});

process.on('unhandledRejection', reason => {
  logger.error('Unhandled rejection:', reason);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'renderer.js'),
    },
  });

  // Load the initial view
  mainWindow.loadFile('views/index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      timeout: 30000,
    };

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
        config.headers = { 'Content-Type': 'application/json' };
      }
    }

    logger.info(`Making API call: ${method} ${config.url}`);
    const response = await axios(config);
    logger.info(
      `API response: ${response.status} ${JSON.stringify(response.data).substring(0, 100)}...`
    );
    return response.data;
  } catch (error) {
    logger.error(`API call failed: ${method} ${endpoint}`, error.message);
    if (error.code === 'ECONNREFUSED') {
      logger.error('Make sure the API server is running: npm run web');
    }
    throw error;
  }
}

// IPC handlers for file operations
ipcMain.handle('read-file', async (_, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (_, filePath, data) => {
  try {
    await fs.writeFile(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-path', async (_, pathName) => {
  return app.getPath(pathName);
});

// IPC handler for file selection
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
  });

  if (result.canceled) {
    return { success: false, error: 'File selection cancelled' };
  }

  return { success: true, filePath: result.filePaths[0] };
});

// IPC handler for upload processing
ipcMain.handle('process-upload', async (_, filePath, exportName) => {
  let uploadId = null;
  const eventSource = null;

  try {
    logger.info('Upload request received for file path:', filePath);

    if (!filePath) {
      throw new Error('File path is null or undefined');
    }

    const fileBuffer = await fs.readFile(filePath);
    logger.info('File read successfully, buffer size:', fileBuffer.length);

    // Create FormData for file upload
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chatgpt-export', fileBuffer, {
      filename: 'chatgpt-export.zip',
      contentType: 'application/zip',
    });

    // Add export name if provided
    if (exportName) {
      form.append('exportName', exportName);
    }

    logger.info('Sending file to API...');
    const response = await axios.post(`${API_BASE_URL}/upload`, form, {
      headers: form.getHeaders(),
      timeout: 60000, // 60 seconds for large files
    });

    logger.info('API response:', response.data);
    uploadId = response.data.uploadId;

    // Start progress polling (EventSource is not available in Node.js main process)
    let pollInterval = null;

    return new Promise((resolve, reject) => {
      let resolved = false;
      let pollCount = 0;
      const maxPolls = 240; // 2 minutes * 60 seconds / 500ms intervals

      const pollProgress = async () => {
        try {
          pollCount++;

          // Stop polling after max attempts
          if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            if (!resolved) {
              resolved = true;
              reject(new Error('Upload timeout'));
            }
            return;
          }

          const response = await axios.get(
            `${API_BASE_URL}/upload-progress/${uploadId}`,
            {
              timeout: 5000,
              headers: {
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
              },
            }
          );

          // Parse SSE data
          const data = response.data;
          const lines = data.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const progress = JSON.parse(line.slice(6));

                // Send progress to renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('upload-progress', progress);
                }

                // Handle completion
                if (progress.status === 'completed') {
                  if (!resolved) {
                    resolved = true;
                    clearInterval(pollInterval);
                    resolve({
                      success: true,
                      exportName: progress.exportName || progress.sessionId,
                    });
                  }
                } else if (progress.status === 'error') {
                  if (!resolved) {
                    resolved = true;
                    clearInterval(pollInterval);
                    reject(new Error(progress.error || 'Upload failed'));
                  }
                } else if (progress.status === 'cancelled') {
                  if (!resolved) {
                    resolved = true;
                    clearInterval(pollInterval);
                    reject(new Error('Upload cancelled'));
                  }
                }
              } catch (err) {
                logger.error('Error parsing progress event:', err);
              }
            }
          }
        } catch (err) {
          logger.error('Progress poll error:', err);
          if (pollCount > 10) {
            // Allow some initial failures
            clearInterval(pollInterval);
            if (!resolved) {
              resolved = true;
              reject(new Error('Progress tracking failed'));
            }
          }
        }
      };

      // Start polling
      pollInterval = setInterval(pollProgress, 500);

      // Initial poll
      pollProgress();
    });
  } catch (err) {
    logger.error('Upload error:', err);
    logger.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });

    // Clean up event source if it exists
    if (eventSource) {
      eventSource.close();
    }

    // Mark progress as failed if we had an upload ID
    if (uploadId) {
      progressManager.failProgress(uploadId, err.message || 'Upload failed');
    }

    return { success: false, error: err.message || 'Upload failed. Please try again.' };
  }
});

// IPC handler for getting file path from input (for browser file inputs)
ipcMain.handle('get-file-path', async (_, _fileObject) => {
  // In the browser context, we can't access the file path directly
  // This handler is a fallback that returns an error to force using the file dialog
  return {
    success: false,
    error:
      'Cannot access file path from browser input. Please use the Browse button instead.',
  };
});

// IPC handler for getting all exports
ipcMain.handle('get-all-exports', async () => {
  try {
    logger.debug('IPC: get-all-exports called');
    const response = await apiCall('GET', '/exports');
    logger.debug('IPC: get-all-exports response:', response);
    return response;
  } catch (err) {
    logger.error('IPC: get-all-exports error:', err);
    return { success: false, error: err.message || 'Error getting exports.' };
  }
});

// IPC handler for getting export info
ipcMain.handle('get-export', async (_, exportName) => {
  try {
    const response = await apiCall('GET', `/exports/${exportName}`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error loading export.' };
  }
});

// IPC handler for getting conversations
ipcMain.handle('get-conversations', async (_, exportName) => {
  try {
    const response = await apiCall('GET', `/conversations/${exportName}`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error loading conversations.' };
  }
});

// IPC handler for getting conversation details
ipcMain.handle('get-conversation', async (_, exportName, conversationId) => {
  try {
    const response = await apiCall(
      'GET',
      `/conversations/${exportName}/${conversationId}`
    );
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error loading conversation.' };
  }
});

// IPC handler for deleting an export
ipcMain.handle('delete-export', async (_, exportName) => {
  try {
    const response = await apiCall('DELETE', `/exports/${exportName}`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error deleting export.' };
  }
});

// ===== PROGRESS MANAGEMENT IPC HANDLERS =====

// IPC handler for getting upload progress
ipcMain.handle('get-upload-progress', async () => {
  try {
    const allProgress = progressManager.getAllProgress();
    return { success: true, progress: allProgress };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler for setting upload progress (for persistence)
ipcMain.handle('set-upload-progress', async (_, progressData) => {
  try {
    if (progressData.uploadId) {
      progressManager.updateProgress(progressData.uploadId, progressData);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler for cancelling upload
ipcMain.handle('cancel-upload', async (_, uploadId) => {
  try {
    if (uploadId) {
      progressManager.cancelProgress(uploadId);

      // Send cancellation to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('upload-cancelled', { uploadId });
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler for clearing upload progress
ipcMain.handle('clear-upload-progress', async () => {
  try {
    const allProgress = progressManager.getAllProgress();
    for (const progress of allProgress) {
      progressManager.removeProgress(progress.uploadId);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===== AI INTEGRATION IPC HANDLERS =====

// IPC handler for AI conversation analysis
ipcMain.handle(
  'ai-analyze-conversation',
  async (_, exportName, conversationId, analysisType) => {
    try {
      const response = await apiCall('POST', '/ai/analyze-conversation', {
        exportName,
        conversationId,
        analysisType,
      });
      return response;
    } catch (err) {
      return { success: false, error: err.message || 'AI analysis failed.' };
    }
  }
);

// IPC handler for AI conversation search
ipcMain.handle('ai-search-conversations', async (_, exportName, query, searchType) => {
  try {
    const response = await apiCall('POST', '/ai/search-conversations', {
      exportName,
      query,
      searchType,
    });
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'AI search failed.' };
  }
});

// IPC handler for AI export summarization
ipcMain.handle('ai-summarize-export', async (_, exportName, summaryType) => {
  try {
    const response = await apiCall('POST', '/ai/summarize-export', {
      exportName,
      summaryType,
    });
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'AI summarization failed.' };
  }
});

// IPC handler for getting migration progress
ipcMain.handle('get-migration-progress', async (_, migrationId) => {
  try {
    // This is a simplified implementation
    // In a real scenario, you'd want to track migration progress more robustly
    return {
      success: true,
      migrationId,
      status: 'processing',
      message: 'Migration in progress',
    };
  } catch (err) {
    logger.error('IPC: get-migration-progress error:', err);
    return {
      success: false,
      error: err.message || 'Error getting migration progress.',
    };
  }
});
