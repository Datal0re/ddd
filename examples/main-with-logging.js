/**
 * Example: Refactored main.js with proper logging
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
const { createLogger } = require('./utils/logger');

// Create logger with context
const logger = createLogger({ module: 'MainProcess' });

let mainWindow;
const API_BASE_URL = `http://localhost:${process.env.API_PORT || 3001}/api`;

logger.info('Application starting', {
  nodeEnv: process.env.NODE_ENV,
  apiPort: process.env.API_PORT,
  apiBaseUrl: API_BASE_URL,
});

// Add retry mechanism for API connection
async function waitForApiServer(maxRetries = 5, delay = 1000) {
  logger.info('Waiting for API server to be ready', { maxRetries, delay });

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      logger.debug(`API health check ${i + 1} successful`, {
        status: response.status,
        data: response.data,
      });

      if (response.data.success) {
        logger.info('API server is ready');
        return true;
      }
    } catch (err) {
      logger.warn(`API health check ${i + 1} failed`, {
        attempt: i + 1,
        error: err.message,
        code: err.code,
      });

      if (i === maxRetries - 1) {
        logger.error('API server not ready after all retries', err);
        throw err;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Wait for API server to be ready before creating window
app.whenReady().then(async () => {
  logger.info('Electron app ready, initiating API server connection');

  try {
    const apiReady = await waitForApiServer();
    if (apiReady) {
      logger.info('API server confirmed ready, creating main window');
      createWindow();
    } else {
      logger.error('API server not ready after retries, exiting application');
      app.quit(1);
    }
  } catch (error) {
    logger.error('Failed to connect to API server during startup', error);
    app.quit(1);
  }
});

// Error handling
process.on('uncaughtException', err => {
  logger.error('Uncaught exception occurred', err, {
    type: 'uncaughtException',
    timestamp: new Date().toISOString(),
  });
});

process.on('unhandledRejection', reason => {
  logger.error('Unhandled promise rejection', new Error(reason), {
    type: 'unhandledRejection',
    timestamp: new Date().toISOString(),
  });
});

function createWindow() {
  logger.info('Creating main browser window');

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
  logger.info('Main window loaded with index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
    logger.debug('Developer tools opened');
  }
}

// Helper function to make API calls
// async function apiCall(method, endpoint, data = null) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.debug('Making API call', {
    requestId,
    method,
    endpoint,
    hasData: !!data,
    url: `${API_BASE_URL}${endpoint}`,
  });

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

    const response = await axios(config);
    const duration = Date.now() - startTime;

    logger.info('API call successful', {
      requestId,
      method,
      endpoint,
      status: response.status,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(response.data).length,
    });

    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('API call failed', error, {
      requestId,
      method,
      endpoint,
      duration: `${duration}ms`,
      code: error.code,
      status: error.response?.status,
    });

    if (error.code === 'ECONNREFUSED') {
      logger.warn('API server connection refused - ensure server is running', {
        command: 'npm run web',
      });
    }

    throw error;
  }
}

// IPC handler for file selection
ipcMain.handle('select-file', async () => {
  logger.debug('File selection requested');

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
    });

    if (result.canceled) {
      logger.info('File selection cancelled by user');
      return { success: false, error: 'File selection cancelled' };
    }

    const filePath = result.filePaths[0];
    logger.info('File selected successfully', { filePath });

    return { success: true, filePath };
  } catch (error) {
    logger.error('File selection dialog failed', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for upload processing
ipcMain.handle('process-upload', async (_, filePath) => {
  const uploadId = `upload_${Date.now()}`;
  logger.info('Upload request received', { uploadId, filePath });

  try {
    if (!filePath) {
      throw new Error('File path is null or undefined');
    }

    const fileBuffer = await fs.readFile(filePath);
    logger.info('File read successfully', {
      uploadId,
      size: fileBuffer.length,
      sizeMB: Math.round((fileBuffer.length / 1024 / 1024) * 100) / 100,
    });

    // Create FormData for file upload
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chatgpt-export', fileBuffer, {
      filename: 'chatgpt-export.zip',
      contentType: 'application/zip',
    });

    logger.info('Sending file to API server', { uploadId });
    const response = await axios.post(`${API_BASE_URL}/upload`, form, {
      headers: form.getHeaders(),
      timeout: 60000, // 60 seconds for large files
    });

    logger.info('Upload completed successfully', {
      uploadId,
      sessionId: response.data.sessionId,
      status: response.status,
    });

    return { success: true, sessionId: response.data.sessionId };
  } catch (err) {
    logger.error('Upload processing failed', err, {
      uploadId,
      filePath,
      errorType: err.constructor.name,
    });

    return {
      success: false,
      error: err.message || 'Upload failed. Please try again.',
    };
  }
});

// ... other IPC handlers would follow the same pattern

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  logger.debug('Application activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

logger.info('Main process initialization complete');
