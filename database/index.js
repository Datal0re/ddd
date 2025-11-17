import Database from './init.js';
import Migration from './migrations/migration.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize the database with proper schema and migrations
 */
async function initializeDatabase(dbPath = null) {
  const db = new Database(dbPath);
  
  try {
    await db.connect();
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    // Run migrations
    const migration = new Migration(db);
    await migration.runMigrations();
    
    console.log('Database initialized successfully');
    return db;
  } catch (err) {
    console.error('Failed to initialize database:', err);
    await db.close();
    throw err;
  }
}

/**
 * Get a database connection (will initialize if needed)
 */
async function getDatabase(dbPath = null) {
  const db = new Database(dbPath);
  await db.connect();
  return db;
}

export { initializeDatabase, getDatabase };
export default Database;