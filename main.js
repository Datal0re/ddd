const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SessionManager } = require('./utils/SessionManager.js');

let mainWindow;
let sessionManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'renderer.js')
    }
  });

  // Load the initial view
  mainWindow.loadFile('views/upload.html');
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Initialize session manager
  sessionManager = new SessionManager(__dirname);
  await sessionManager.initialize();
  
  createWindow();
});

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



// Helper to ensure a directory exists
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Helper to run migration script on a given conversations.json
async function runMigration(sessionId, outputDir) {
  const inputPath = path.join(__dirname, 'data', 'sessions', sessionId, 'conversations.json');
  await ensureDir(outputDir);
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, 'data', 'migration.js'), inputPath, outputDir], {
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Migration exited with code ${code}`));
    });
  });
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
    filters: [
      { name: 'ZIP Files', extensions: ['zip'] }
    ]
  });
  
  if (result.canceled) {
    return { success: false, error: 'File selection cancelled' };
  }
  
  return { success: true, filePath: result.filePaths[0] };
});

// IPC handler for upload processing
ipcMain.handle('process-upload', async (_, filePath) => {
  try {
    const sessionId = await sessionManager.createSession(filePath, false); // false = path, not buffer
    return { success: true, sessionId };
  } catch (err) {
    console.error('Upload error:', err);
    return { success: false, error: err.message || 'Upload failed. Please try again.' };
  }
});

// IPC handler for getting conversations
ipcMain.handle('get-conversations', async (_, sessionId) => {
  try {
    const conversations = await sessionManager.getConversations(sessionId);
    return { success: true, conversations };
  } catch (err) {
    console.error('Error loading conversations:', err);
    return { success: false, error: err.message || 'Error loading conversations.' };
  }
});

// IPC handler for getting conversation details
ipcMain.handle('get-conversation', async (_, sessionId, conversationId) => {
  try {
    const conversation = await sessionManager.getConversation(sessionId, conversationId);
    return { success: true, ...conversation };
  } catch (err) {
    console.error('Error loading conversation:', err);
    return { success: false, error: err.message || 'Error loading conversation.' };
  }
});

// IPC handler for session cleanup
ipcMain.handle('cleanup-sessions', async () => {
  try {
    const deletedCount = await sessionManager.cleanupOldSessions();
    return { success: true, deletedCount };
  } catch (err) {
    console.error('Error cleaning up sessions:', err);
    return { success: false, error: err.message || 'Error cleaning up sessions.' };
  }
});

// IPC handler for deleting a session
ipcMain.handle('delete-session', async (_, sessionId) => {
  try {
    const deleted = await sessionManager.deleteSession(sessionId);
    return { success: true, deleted };
  } catch (err) {
    console.error('Error deleting session:', err);
    return { success: false, error: err.message || 'Error deleting session.' };
  }
});