import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import decompress from 'decompress';
import { v4 as uuidv4 } from 'uuid';
import { getConversationMessages } from './getConversationMessages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');

// Session storage (in-memory for now)
const sessions = new Map();

// Helper to clean up old sessions
async function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const [id, info] of sessions.entries()) {
    if (now - info.uploadedAt.getTime() > maxAgeMs) {
      // Remove session folder and media folder
      const sessionDir = path.join(__dirname, 'data', 'sessions', id);
      const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', id);
      try {
        await fs.rmdir(sessionDir, { recursive: true });
        await fs.rmdir(mediaDir, { recursive: true });
      } catch {
        // Ignore errors if already gone
      }
      sessions.delete(id);
    }
  }
}

// Multer config for memory storage (we’ll handle zip extraction manually)
const upload = multer({ storage: multer.memoryStorage() });

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
  const { spawn } = await import('child_process');
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

// Routes
app.get('/', (req, res) => {
  res.render('upload', { error: null });
});

app.post('/upload', upload.single('chatgpt-export'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).render('upload', { error: 'No file uploaded.' });
    }

    const sessionId = uuidv4();
    const sessionDir = path.join(__dirname, 'data', 'sessions', sessionId);
    const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', sessionId);
    await ensureDir(sessionDir);
    await ensureDir(mediaDir);

    // Save uploaded file temporarily
    const tempZipPath = path.join(sessionDir, 'upload.zip');
    await fs.writeFile(tempZipPath, req.file.buffer);

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
      return res.status(400).render('upload', { error: 'conversations.json not found in uploaded zip.' });
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

    // Redirect to conversation list
    res.redirect(`/conversations?session=${sessionId}`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).render('upload', { error: 'Upload failed. Please try again.' });
  }
});

app.get('/conversations', async (req, res) => {
  const { session } = req.query;
  if (!session || !sessions.has(session)) {
    return res.status(400).send('Invalid or missing session ID.');
  }
  const conversationsDir = path.join(__dirname, 'data', 'sessions', session, 'conversations');
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
    res.render('conversations', { conversations, session });
  } catch (err) {
    console.error('Error loading conversations:', err);
    res.status(500).send('Error loading conversations.');
  }
});

app.get('/conversation/:id', async (req, res) => {
  const { id } = req.params;
  const { session } = req.query;
  if (!session || !sessions.has(session)) {
    return res.status(400).send('Invalid or missing session ID.');
  }
  const filePath = path.join(__dirname, 'data', 'sessions', session, 'conversations', id);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const conv = JSON.parse(content);
    const messages = getConversationMessages(conv);
    res.render('conversation', { title: conv.title || 'Untitled', messages, session });
  } catch (err) {
    console.error('Error loading conversation:', err);
    res.status(500).send('Error loading conversation.');
  }
});

// DELETE /sessions/:id endpoint
app.delete('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  
  // Remove session folder and media folder
  const sessionDir = path.join(__dirname, 'data', 'sessions', id);
  const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', id);
  
  try {
    await fs.rmdir(sessionDir, { recursive: true });
    await fs.rmdir(mediaDir, { recursive: true });
  } catch {
    // Ignore errors if directories don't exist
  }
  
  sessions.delete(id);
  res.sendStatus(204);
});

// POST /cleanup endpoint
app.post('/cleanup', async (req, res) => {
  await cleanupOldSessions();
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Data Dumpster Diver listening on port ${port}`);
});