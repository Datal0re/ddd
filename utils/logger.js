/**
 * Centralized Logger Configuration
 * Handles logging for both Electron and Node.js environments
 */

const isElectronMain = process.type === 'browser';
const isElectronRenderer = process.type === 'renderer';

let logger;

if (isElectronMain || isElectronRenderer) {
  // Electron environment - use electron-log
  const log = require('electron-log');

  // Configure electron-log
  log.transports.file.level = 'info';
  log.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'debug' : 'info';

  // Set up log rotation (max 10MB, keep 5 files)
  log.transports.file.maxSize = 10 * 1024 * 1024;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  // Add custom formatting for better readability
  log.hooks.push((message, transport) => {
    if (transport !== log.transports.console) return message;

    // Add colors and formatting for console output
    const colors = {
      error: '\x1b[31m', // red
      warn: '\x1b[33m', // yellow
      info: '\x1b[36m', // cyan
      debug: '\x1b[37m', // white
    };

    const reset = '\x1b[0m';
    const color = colors[message.level] || '';

    message.text = `${color}[${message.level.toUpperCase()}]${reset} ${message.text}`;
    return message;
  });

  logger = log;
} else {
  // Node.js environment (Express server) - use Pino
  const pino = require('pino');
  const fs = require('fs');
  const path = require('path');

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Create Pino logger with multi-stream
  const streams = [
    {
      level: 'info',
      stream: fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' }),
    },
    {
      level: 'error',
      stream: fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' }),
    },
  ];

  // Add console stream in development
  if (process.env.NODE_ENV === 'development') {
    streams.push({
      level: 'debug',
      stream: process.stdout,
    });
  }

  logger = pino(
    {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      formatters: {
        level: label => ({ level: label }),
        log: object => ({
          ...object,
          pid: process.pid,
          service: 'data-dumpster-diver-api',
        }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams)
  );
}

// Create a unified interface
const createLogger = (context = {}) => {
  if (isElectronMain || isElectronRenderer) {
    // electron-log wrapper
    return {
      debug: (message, meta = {}) =>
        logger.debug(`${context.module || ''}: ${message}`, meta),
      info: (message, meta = {}) =>
        logger.info(`${context.module || ''}: ${message}`, meta),
      warn: (message, meta = {}) =>
        logger.warn(`${context.module || ''}: ${message}`, meta),
      error: (message, error = null, meta = {}) => {
        const logData = {
          ...meta,
          ...(error && { error: error.message, stack: error.stack }),
        };
        logger.error(`${context.module || ''}: ${message}`, logData);
      },
    };
  } else {
    // Pino wrapper
    const childLogger = context.module
      ? logger.child({ module: context.module })
      : logger;

    return {
      debug: (message, meta = {}) => childLogger.debug({ ...meta, msg: message }),
      info: (message, meta = {}) => childLogger.info({ ...meta, msg: message }),
      warn: (message, meta = {}) => childLogger.warn({ ...meta, msg: message }),
      error: (message, error = null, meta = {}) => {
        const logData = {
          ...meta,
          ...(error && { error: error.message, stack: error.stack }),
        };
        childLogger.error({ ...logData, msg: message });
      },
    };
  }
};

// Export the unified logger creator
module.exports = { createLogger };
