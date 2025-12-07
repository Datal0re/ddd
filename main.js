const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
const { createLogger } = require('./utils/logger');
const logger = createLogger({ module: path.basename(__filename, '.js') });

let mainWindow;
const API_BASE_URL = `http://localhost:${process.env.API_PORT || 3001}/api`;

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
ipcMain.handle('process-upload', async (_, filePath) => {
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

    logger.info('Sending file to API...');
    const response = await axios.post(`${API_BASE_URL}/upload`, form, {
      headers: form.getHeaders(),
      timeout: 60000, // 60 seconds for large files
    });

    logger.info('API response:', response.data);
    return { success: true, sessionId: response.data.sessionId };
  } catch (err) {
    logger.error('Upload error:', err);
    logger.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
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

// IPC handler for getting all sessions
ipcMain.handle('get-all-sessions', async () => {
  try {
    logger.debug('IPC: get-all-sessions called');
    const response = await apiCall('GET', '/sessions');
    logger.debug('IPC: get-all-sessions response:', response);
    return response;
  } catch (err) {
    logger.error('IPC: get-all-sessions error:', err);
    return { success: false, error: err.message || 'Error getting sessions.' };
  }
});

// IPC handler for getting conversations
ipcMain.handle('get-conversations', async (_, sessionId) => {
  try {
    const response = await apiCall('GET', `/sessions/${sessionId}/conversations`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error loading conversations.' };
  }
});

// IPC handler for getting conversation details
ipcMain.handle('get-conversation', async (_, sessionId, conversationId) => {
  try {
    const response = await apiCall(
      'GET',
      `/sessions/${sessionId}/conversations/${conversationId}`
    );
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error loading conversation.' };
  }
});

// IPC handler for deleting a session
ipcMain.handle('delete-session', async (_, sessionId) => {
  try {
    const response = await apiCall('DELETE', `/sessions/${sessionId}`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error deleting session.' };
  }
});

// IPC handler for session cleanup
ipcMain.handle('cleanup-sessions', async () => {
  try {
    const response = await apiCall('POST', '/sessions/cleanup');
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Error cleaning up sessions.' };
  }
});

// ===== AI INTEGRATION IPC HANDLERS =====

// IPC handler for AI conversation analysis
ipcMain.handle(
  'ai-analyze-conversation',
  async (_, sessionId, conversationId, analysisType) => {
    try {
      const response = await apiCall('POST', '/ai/analyze-conversation', {
        sessionId,
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
ipcMain.handle('ai-search-conversations', async (_, sessionId, query, searchType) => {
  try {
    const response = await apiCall('POST', '/ai/search-conversations', {
      sessionId,
      query,
      searchType,
    });
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'AI search failed.' };
  }
});

// IPC handler for AI session summarization
ipcMain.handle('ai-summarize-session', async (_, sessionId, summaryType) => {
  try {
    const response = await apiCall('POST', '/ai/summarize-session', {
      sessionId,
      summaryType,
    });
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'AI summarization failed.' };
  }
});

// ===== BACKUP MANAGEMENT IPC HANDLERS =====

// IPC handler for creating session backup
ipcMain.handle('create-backup', async (_, sessionId) => {
  try {
    const response = await apiCall('POST', `/sessions/${sessionId}/backup`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Backup creation failed.' };
  }
});

// IPC handler for listing session backups
ipcMain.handle('list-backups', async (_, sessionId) => {
  try {
    const response = await apiCall('GET', `/sessions/${sessionId}/backups`);
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Failed to list backups.' };
  }
});

// IPC handler for restoring session backup
ipcMain.handle('restore-backup', async (_, sessionId, backupFile) => {
  try {
    const response = await apiCall('POST', `/sessions/${sessionId}/restore`, {
      backupFile,
    });
    return response;
  } catch (err) {
    return { success: false, error: err.message || 'Backup restore failed.' };
  }
});
