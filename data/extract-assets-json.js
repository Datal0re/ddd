#!/usr/bin/env node

/**
 * Extract assetsJson from chat.html files and save as assets.json
 *
 * Usage:
 *   node data/extract-assets-json.js                    # Process all sessions
 *   node data/extract-assets-json.js <session-id>       # Process specific session
 *
 * This script finds `var assetsJson = {...}` (or `var assetsJson={}`) in chat.html files
 * and saves the JSON content as assets.json in the session root directory.
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger({ module: 'extract-assets-json' });

/**
 * Extract assetsJson from chat.html and save as assets.json
 * @param {string} sessionId - The session ID
 * @param {string} baseDir - Base directory of the application
 */
async function extractAssetsJson(sessionId, baseDir) {
  if (!sessionId || !baseDir) {
    logger.warn('Invalid parameters for extractAssetsJson:', { sessionId, baseDir });
    return false;
  }

  // Look for chat.html in Test-Chat-Combine directory (based on existing code pattern)
  const chatHtmlPath = path.join(
    baseDir,
    'data',
    'sessions',
    sessionId,
    'Test-Chat-Combine',
    'chat.html'
  );

  const sessionRootPath = path.join(baseDir, 'data', 'sessions', sessionId);
  const assetsJsonPath = path.join(sessionRootPath, 'assets.json');

  try {
    // Check if chat.html exists
    await fs.access(chatHtmlPath);
    logger.info(`Processing chat.html for session: ${sessionId}`);
    logger.debug(`Chat HTML path: ${chatHtmlPath}`);

    // Read the chat.html content
    const chatHtmlContent = await fs.readFile(chatHtmlPath, 'utf8');

    // Look for assetsJson variable in HTML (support both with and without space)
    // Also support object format (not just array)
    // Use a more precise regex that captures the complete JSON object
    // The object can be very long and span multiple lines
    const assetJsonMatch = chatHtmlContent.match(
      /var\s+assetsJson\s*=\s*(\{[\s\S]*?\})\s*;?/
    );

    if (assetJsonMatch && assetJsonMatch[1]) {
      // Parse and validate the JSON string
      const assetJsonString = assetJsonMatch[1];
      let assetJsonData;

      try {
        assetJsonData = JSON.parse(assetJsonString);
      } catch (parseError) {
        logger.error(
          `Failed to parse assetsJson for session ${sessionId}:`,
          parseError.message
        );
        logger.debug(`Asset JSON string was: ${assetJsonString.substring(0, 200)}...`);
        return false;
      }

      // Write the assets.json file
      await fs.writeFile(
        assetsJsonPath,
        JSON.stringify(assetJsonData, null, 2),
        'utf8'
      );

      const assetCount = Array.isArray(assetJsonData)
        ? assetJsonData.length
        : Object.keys(assetJsonData).length;
      logger.info(
        `Successfully extracted assets.json for session ${sessionId} with ${assetCount} assets`
      );
      return true;
    } else {
      logger.debug(`No assetsJson found in chat.html for session ${sessionId}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.debug(`chat.html not found for session ${sessionId}`);
    } else {
      logger.error(`Error processing session ${sessionId}:`, error.message);
    }
    return false;
  }
}

/**
 * Get all session IDs from sessions.json
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<Array>} Array of session IDs
 */
async function getAllSessionIds(baseDir) {
  const sessionsJsonPath = path.join(baseDir, 'data', 'sessions.json');

  try {
    const sessionsData = await fs.readFile(sessionsJsonPath, 'utf8');
    const sessions = JSON.parse(sessionsData);

    // Extract session IDs from the sessions array format
    return sessions.map(session => session[0]); // Each session is [sessionId, metadata]
  } catch (error) {
    logger.error('Error reading sessions.json:', error.message);
    return [];
  }
}

/**
 * Main function to extract assets.json for all sessions
 */
async function main() {
  const baseDir = path.resolve(__dirname);

  logger.info('Starting assets.json extraction for all sessions...');

  const sessionIds = await getAllSessionIds(baseDir);

  if (sessionIds.length === 0) {
    logger.warn('No sessions found to process');
    return;
  }

  logger.info(`Found ${sessionIds.length} sessions to process`);

  let successCount = 0;
  let skippedCount = 0;

  for (const sessionId of sessionIds) {
    const result = await extractAssetsJson(sessionId, baseDir);
    if (result) {
      successCount++;
    } else {
      skippedCount++;
    }
  }

  logger.info(
    `Extraction complete: ${successCount} successful, ${skippedCount} skipped`
  );
}

// Run the script if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Process specific session ID
    const sessionId = args[0];
    const baseDir = path.resolve(__dirname, '..');

    logger.info(`Processing specific session: ${sessionId}`);
    extractAssetsJson(sessionId, baseDir)
      .then(result => {
        if (result) {
          logger.info(`Successfully extracted assets.json for session ${sessionId}`);
          process.exit(0);
        } else {
          logger.warn(`Failed to extract assets.json for session ${sessionId}`);
          process.exit(1);
        }
      })
      .catch(error => {
        logger.error('Script failed:', error);
        process.exit(1);
      });
  } else {
    // Process all sessions
    main().catch(error => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
  }
}

module.exports = { extractAssetsJson, getAllSessionIds };
