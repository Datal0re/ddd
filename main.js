const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
// const fsSync = require('fs');
// const multer = require('multer');
const decompress = require('decompress');
const { spawn } = require('child_process');

// Dynamic import for uuid (ES module)
let uuidv4;
(async () => {
  const { v4 } = await import('uuid');
  uuidv4 = v4;
})();

let mainWindow;

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

app.whenReady().then(createWindow);

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

// Session storage (in-memory for now)
let sessions;

(async () => {
  try {

const { deserializeSessions } = require("./utils/sessionUtils");
sessions = await deserializeSessions();
  } catch (err) {
    console.error('Failed to load existing sessions:', err);
    sessions = new Map();
  }
})();

// Helper to clean up old sessions
async function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const [id, info] of sessions.entries()) {
    if (now - info.uploadedAt.getTime() > maxAgeMs) {
    // Add new session to map
    sessions.set(sessionId, { uploadedAt: new Date() });

    // Serialize sessions to disk with error handling
    try {
      await serializeSessions(sessions);
      console.log('Session serialized successfully');
    } catch (error) {
      console.error(`Serialization failed: ${error.message}`);
      // Optionally send error response to client
      // res.status(500).send('Failed to save session data');
    }
    const sessionDir = path.join(__dirname, 'data', 'sessions', id);
    const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', id);
    
    try {
      await fs.rmdir(sessionDir, { recursive: true });
      await fs.rmdir(mediaDir, { recursive: true });
    } catch {
      // Ignore errors if directories don't exist
    }
    
    sessions.delete(id);
    await serializeSessions(sessions);
    await serializeSessions(sessions);
    }
  }
}

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
    if (!uuidv4) {
      const { v4 } = await import('uuid');
      uuidv4 = v4;
    }
    const sessionId = uuidv4();
    const sessionDir = path.join(__dirname, 'data', 'sessions', sessionId);
    const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', sessionId);
    await ensureDir(sessionDir);
    await ensureDir(mediaDir);

    // Copy uploaded file to session directory
    const tempZipPath = path.join(sessionDir, 'upload.zip');
    await fs.copyFile(filePath, tempZipPath);

    // Extract zip
    const files = await decompress(tempZipPath, sessionDir);
    
    // Find conversations.json and media assets
    let conversationsPath = null;
    // Detect if there is a single top-level folder (common in macOS exports)
    const topLevelDirs = new Set();
    for (const file of files) {
      const parts = file.path.split(path.sep);
      if (parts.length > 1) {
        topLevelDirs.add(parts[0]);
      }
    }
    const hasSingleTopLevel = topLevelDirs.size === 1;
    const topLevelFolder = hasSingleTopLevel ? [...topLevelDirs][0] : null;

    for (const file of files) {
      if (file.path.endsWith('conversations.json')) {
        const candidatePath = path.join(sessionDir, file.path);
        // Validate it's a text file (UTF-8) and not binary
        const stats = await fs.stat(candidatePath);
        if (stats.isFile()) {
          const sample = await fs.readFile(candidatePath, { encoding: 'utf8' });
          if (sample && !sample.includes('\u0000')) {
            conversationsPath = candidatePath;
          }
        }
      }
      // Copy media assets to public/media/sessions/<sessionId>/ preserving relative structure
      // Only copy files, skip directories
      if ((file.path.startsWith('file-') || file.path.includes('audio/') || file.path.includes('dalle-generations/')) && !file.path.endsWith('/')) {
        const src = path.join(sessionDir, file.path);
        // Strip top-level folder if present to keep media paths clean
        const relativePath = hasSingleTopLevel && file.path.startsWith(topLevelFolder + path.sep)
          ? file.path.slice((topLevelFolder + path.sep).length)
          : file.path;
        const destPath = path.join(mediaDir, relativePath);
        await ensureDir(path.dirname(destPath));
        await fs.copyFile(src, destPath);
      }
    }

    if (!conversationsPath) {
      return { success: false, error: 'conversations.json not found in uploaded zip.' };
    }

    // Ensure conversations.json is at session root for migration
    const targetConversationsPath = path.join(sessionDir, 'conversations.json');
    if (conversationsPath && conversationsPath !== targetConversationsPath) {
      await fs.rename(conversationsPath, targetConversationsPath);
    }
    // Delete any other top-level folders to avoid confusion
    if (hasSingleTopLevel && topLevelFolder) {
      const nestedDir = path.join(sessionDir, topLevelFolder);
      try {
        await fs.rmdir(nestedDir, { recursive: true });
      } catch {
        // Ignore if already removed or not empty
      }
    }

    // Clean up temporary zip
    await fs.unlink(tempZipPath);

    // Run migration with session-scoped output directory
    await runMigration(sessionId, path.join(sessionDir, 'conversations'));

  // Store session info
  sessions.set(sessionId, { uploadedAt: new Date() });
  await serializeSessions(sessions);
  await serializeSessions(sessions);

    return { success: true, sessionId };
  } catch (err) {
    console.error('Upload error:', err);
    return { success: false, error: 'Upload failed. Please try again.' };
  }
});

// IPC handler for getting conversations
ipcMain.handle('get-conversations', async (_, sessionId) => {
  if (!sessionId || !sessions.has(sessionId)) {
    return { success: false, error: 'Invalid or missing session ID.' };
  }
  
  const conversationsDir = path.join(__dirname, 'data', 'sessions', sessionId, 'conversations');
  try {
    const files = await fs.readdir(conversationsDir);
    const conversations = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(conversationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const conv = JSON.parse(content);
        conversations.push({ id: file, title: conv.title || 'Untitled', date: file.split('_')[0] });
      }
    }
    return { success: true, conversations };
  } catch (err) {
    console.error('Error loading conversations:', err);
    return { success: false, error: 'Error loading conversations.' };
  }
});

// IPC handler for getting conversation details
ipcMain.handle('get-conversation', async (_, sessionId, conversationId) => {
  if (!sessionId || !sessions.has(sessionId)) {
    return { success: false, error: 'Invalid or missing session ID.' };
  }
  
  const filePath = path.join(__dirname, 'data', 'sessions', sessionId, 'conversations', conversationId);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const conv = JSON.parse(content);
    
    // Import getConversationMessages function
    const { getConversationMessages } = require('./getConversationMessages.js');
    const messages = getConversationMessages(conv);
    
    return { success: true, title: conv.title || 'Untitled', messages };
  } catch (err) {
    console.error('Error loading conversation:', err);
    return { success: false, error: 'Error loading conversation.' };
  }
});

  // IPC handler for session cleanup
  ipcMain.handle('cleanup-sessions', async () => {
    await cleanupOldSessions();
    await serializeSessions(sessions);
    return { success: true };
  });

// IPC handler for deleting a session
ipcMain.handle('delete-session', async (_, sessionId) => {
  // Remove session folder and media folder
  const sessionDir = path.join(__dirname, 'data', 'sessions', sessionId);
  const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', sessionId);
  
  try {
    await fs.rmdir(sessionDir, { recursive: true });
    await fs.rmdir(mediaDir, { recursive: true });
  } catch {
    // Ignore errors if directories don't exist
  }
  
  sessions.delete(sessionId);
  return { success: true };
});