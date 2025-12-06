/*
 * ES Module wrapper for SessionManager
 * Allows Express (ES modules) to use SessionManager (CommonJS)
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { SessionManager } = require('./SessionManager.js');

export { SessionManager };