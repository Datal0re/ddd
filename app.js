import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SessionManager } from './utils/SessionManager.mjs';
import { dirname } from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { getConversationMessages } from './getConversationMessages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Initialize session manager
const sessionManager = new SessionManager(__dirname);
await sessionManager.initialize();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');

// Periodically clean up old sessions
setInterval(() => sessionManager.cleanupOldSessions(), 24 * 60 * 60 * 1000); // Daily cleanup

// Multer config for memory storage (we'll handle zip extraction manually)
const upload = multer({ storage: multer.memoryStorage() });
  
  const now = Date.now();

  // Iterate through disk-persisted sessions
  for (const [id, info] of diskSessions) {
    if (now - info.uploadedAt.getTime() > maxAgeMs) {
      const sessionDir = path.join(__dirname, 'data', 'sessions', id);
      const mediaDir = path.join(__dirname, 'public', 'media', 'sessions', id);
      try {
        await fs.rmdir(sessionDir, { recursive: true });
        await fs.rmdir(mediaDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to delete session ${id}:`, err);
      }
      sessions.delete(id); // Remove from in-memory map
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

    const sessionId = await sessionManager.createSession(req.file.buffer, true); // true = buffer
    res.redirect(`/conversations?session=${sessionId}`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).render('upload', { error: err.message || 'Upload failed. Please try again.' });
  }
});

app.get('/conversations', async (req, res) => {
  const { session } = req.query;
  if (!session || !sessionManager.hasSession(session)) {
    return res.status(400).send('Invalid or missing session ID.');
  }
  
  try {
    const conversations = await sessionManager.getConversations(session);
    res.render('conversations', { conversations, session });
  } catch (err) {
    console.error('Error loading conversations:', err);
    res.status(500).send('Error loading conversations.');
  }
});

app.get('/conversation/:id', async (req, res) => {
  const { id } = req.params;
  const { session } = req.query;
  if (!session || !sessionManager.hasSession(session)) {
    return res.status(400).send('Invalid or missing session ID.');
  }
  
  try {
    const conversation = await sessionManager.getConversation(session, id);
    res.render('conversation', { title: conversation.title, messages: conversation.messages, session });
  } catch (err) {
    console.error('Error loading conversation:', err);
    res.status(500).send('Error loading conversation.');
  }
});

// DELETE /sessions/:id endpoint
app.delete('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await sessionManager.deleteSession(id);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).send('Error deleting session.');
  }
});

// POST /cleanup endpoint
app.post('/cleanup', async (req, res) => {
  try {
    await sessionManager.cleanupOldSessions();
    res.redirect('/');
  } catch (err) {
    console.error('Error cleaning up sessions:', err);
    res.status(500).send('Error cleaning up sessions.');
  }
});

app.listen(port, () => {
  console.log(`Data Dumpster Diver listening on port ${port}`);
});