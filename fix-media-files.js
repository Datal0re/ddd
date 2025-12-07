#!/usr/bin/env node
/**
 * Fix media files for existing sessions
 * This script copies missing media files from data directory to public directory
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./utils/logger');

const logger = createLogger({ module: 'fix-media-files' });

async function fixMediaFiles(baseDir) {
  const dataDir = path.join(baseDir, 'data', 'sessions');
  const publicMediaDir = path.join(baseDir, 'public', 'media', 'sessions');

  try {
    const sessions = await fs.readdir(dataDir);

    for (const sessionId of sessions) {
      const sessionDataDir = path.join(dataDir, sessionId);
      const sessionPublicDir = path.join(publicMediaDir, sessionId);

      // Skip if not a directory
      const stat = await fs.stat(sessionDataDir).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      logger.info(`Processing session: ${sessionId}`);

      // Ensure public media directory exists
      await fs.mkdir(sessionPublicDir, { recursive: true });

      // Find and copy media files
      await copyMediaFiles(sessionDataDir, sessionPublicDir);
    }

    logger.info('Media file fix completed successfully');
  } catch (error) {
    logger.error('Error fixing media files:', error);
  }
}

async function copyMediaFiles(sourceDir, targetDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const targetSubDir = path.join(targetDir, entry.name);
      await fs.mkdir(targetSubDir, { recursive: true });
      await copyMediaFiles(sourcePath, targetSubDir);
    } else if (entry.isFile() && isMediaFile(entry.name)) {
      // Copy media files
      const targetPath = path.join(targetDir, entry.name);
      await fs.copyFile(sourcePath, targetPath);
      logger.debug(`Copied media file: ${entry.name}`);
    }
  }
}

function isMediaFile(fileName) {
  const mediaPatterns = [
    /^file-/, // ChatGPT file attachments
    /\.(jpeg|jpg|png|gif|webp)$/i, // Image extensions
    /\.(wav|mp3|m4a|ogg)$/i, // Audio extensions
  ];

  return mediaPatterns.some(pattern => pattern.test(fileName));
}

// Run the script
const baseDir = __dirname;
fixMediaFiles(baseDir);
