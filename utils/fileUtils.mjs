/*
 * ES Module wrapper for fileUtils
 * Allows Express (ES modules) to use fileUtils (CommonJS)
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ensureDir, runMigration, processZipUpload, removeDirectories } = require('./fileUtils.js');

export { ensureDir, runMigration, processZipUpload, removeDirectories };