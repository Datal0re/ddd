import Database from '../init.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Migration {
  constructor(db) {
    this.db = db;
  }

  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.db.run(sql);
  }

  async getExecutedMigrations() {
    const sql = 'SELECT filename FROM migrations ORDER BY filename';
    const rows = await this.db.all(sql);
    return rows.map(row => row.filename);
  }

  async markMigrationExecuted(filename) {
    const sql = 'INSERT INTO migrations (filename) VALUES (?)';
    await this.db.run(sql, [filename]);
  }

  async loadMigrationFiles() {
    const migrationsDir = __dirname;
    try {
      const files = await fs.readdir(migrationsDir);
      return files
        .filter(file => file.endsWith('.js') && file !== 'migration.js')
        .sort();
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async runMigrations() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.loadMigrationFiles();

    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        console.log(`Running migration: ${file}`);
        const migrationPath = path.join(__dirname, file);
        const migration = await import(migrationPath);
        
        if (typeof migration.up === 'function') {
          await migration.up(this.db);
          await this.markMigrationExecuted(file);
          console.log(`Migration completed: ${file}`);
        } else {
          throw new Error(`Migration ${file} must export an 'up' function`);
        }
      }
    }
  }
}

export default Migration;