#!/usr/bin/env node

import { initializeDatabase } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Database initialization script
 * Usage: node database/setup.js [database_path]
 */
async function main() {
  const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'app.db');
  
  try {
    console.log('Initializing database...');
    const db = await initializeDatabase(dbPath);
    console.log('Database setup completed successfully!');
    await db.close();
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}