const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./utils/logger');
const logger = createLogger({ module: 'getConversationMessages' });

/**
 * Get the media directory path for a session
 * @param {string} baseDir - Base directory of the application
 * @param {string} sessionId - The session ID
 * @returns {string} Media directory path
 */
function getMediaDir(baseDir, sessionId) {
  return path.join(baseDir, 'public', 'media', 'sessions', sessionId);
}

/**
 * Build a web URL from a file path
 * @param {string} filePath - Absolute file path
 * @param {string} baseDir - Base directory of the application
 * @returns {string} Web URL path
 */
function buildAssetUrl(filePath, baseDir) {
  const relativePath = path.relative(path.join(baseDir, 'public'), filePath);
  return '/' + relativePath.replace(/\\/g, '/');
}

/**
 * Handle file operation errors consistently
 * @param {Error} error - The error object
 * @param {string} operation - Description of the operation
 * @param {string} context - Additional context (optional)
 */
function handleFileError(error, operation, context = '') {
  const message = context ? `${operation}: ${context}` : operation;
  logger.warn(`Error ${message}:`, error.message);
}

/**
 * Load asset mapping from assets.json file (preferred) or fallback to chat.html
 * @param {string} sessionId - The session ID
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<Object>} Asset mapping object
 */
async function loadAssetMapping(sessionId, baseDir) {
  if (!sessionId || !baseDir) {
    logger.warn('Invalid parameters for loadAssetMapping:', { sessionId, baseDir });
    return {};
  }

  // Try to load from assets.json first (preferred method)
  const assetsJsonPath = path.join(
    baseDir,
    'data',
    'sessions',
    sessionId,
    'assets.json'
  );

  try {
    const assetsContent = await fs.readFile(assetsJsonPath, 'utf8');
    const assetMapping = JSON.parse(assetsContent);
    logger.debug(
      `Loaded asset mapping from assets.json for session ${sessionId} with ${Object.keys(assetMapping).length} assets`
    );
    return assetMapping;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('Error reading assets.json:', error.message);
    }
  }

  // Fallback to chat.html if assets.json doesn't exist
  const chatHtmlPath = path.join(
    baseDir,
    'data',
    'sessions',
    sessionId,
    'Test-Chat-Combine',
    'chat.html'
  );

  try {
    const chatHtmlContent = await fs.readFile(chatHtmlPath, 'utf8');

    // Look for assetsJson variable in HTML (updated regex to handle objects)
    const assetJsonMatch = chatHtmlContent.match(
      /var\s+assetsJson\s*=\s*(\{[\s\S]*?\})\s*;?/
    );

    if (assetJsonMatch && assetJsonMatch[1]) {
      // Parse JSON string
      const assetJsonString = assetJsonMatch[1];
      logger.debug(
        `Found asset mapping in chat.html for session ${sessionId} (fallback method)`
      );
      return JSON.parse(assetJsonString);
    } else {
      logger.debug(`No asset mapping found in chat.html for session ${sessionId}`);
    }
  } catch (error) {
    handleFileError(error, 'loading asset mapping from chat.html', sessionId);
  }

  return {};
}

/**
 * Find the actual file path for an asset pointer
 * @param {string} assetPointer - The asset pointer (e.g., "file-service://file-abc123")
 * @param {string} sessionId - The session ID
 * @param {string} baseDir - Base directory of the application
 * @param {Object} assetMapping - Asset mapping from assets.json or chat.html
 * @returns {string|null} The URL to access the asset or null if not found
 */
async function findAssetFile(assetPointer, sessionId, baseDir, assetMapping = {}) {
  if (!assetPointer || !sessionId || !baseDir) {
    logger.warn('Invalid parameters for findAssetFile:', {
      assetPointer,
      sessionId,
      baseDir,
    });
    return null;
  }

  // Extract filename from asset pointer (handle both file-service:// and sediment://)
  let assetKey = assetPointer;
  if (assetPointer.startsWith('file-service://')) {
    assetKey = assetPointer.replace('file-service://', '');
  } else if (assetPointer.startsWith('sediment://')) {
    assetKey = assetPointer.replace('sediment://', '');
  }

  const mediaDir = getMediaDir(baseDir, sessionId);

  // First try to use asset mapping if available
  if (assetMapping[assetPointer]) {
    const mappedFile = assetMapping[assetPointer];
    // Handle both string filename and object with name property
    const filename =
      typeof mappedFile === 'string' ? mappedFile : mappedFile.name || '';

    if (filename) {
      try {
        const files = await recursivelyFindFiles(mediaDir, filename);
        if (files.length > 0) {
          logger.debug(`Found mapped asset: ${assetPointer} -> ${filename}`);
          return buildAssetUrl(files[0], baseDir);
        }
      } catch (error) {
        handleFileError(error, 'finding mapped asset file', assetKey);
      }
    }
  }

  // Fallback to original search if mapping fails
  try {
    const files = await recursivelyFindFiles(mediaDir, assetKey);
    if (files.length > 0) {
      logger.debug(`Found asset by filename search: ${assetKey}`);
      return buildAssetUrl(files[0], baseDir);
    }
  } catch (error) {
    handleFileError(error, 'finding asset file', assetKey);
  }

  logger.debug(`Asset not found: ${assetPointer}`);
  return null;
}

/**
 * Recursively search for files matching a pattern
 * @param {string} dir - Directory to search
 * @param {string} filename - Filename pattern to match
 * @returns {Array} Array of matching file paths
 */
async function recursivelyFindFiles(dir, filename) {
  if (!dir || !filename) {
    logger.warn('Invalid parameters for recursivelyFindFiles:', { dir, filename });
    return [];
  }

  const results = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subResults = await recursivelyFindFiles(fullPath, filename);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.startsWith(filename)) {
        // Found a matching file (files may have UUID suffixes)
        results.push(fullPath);
      }
    }
  } catch (error) {
    // Directory might not exist or be inaccessible
    // Silently ignore as this is expected for non-existent directories
    void error; // Mark as used to avoid ESLint warning
  }

  return results;
}

/**
 * Generate a URL for an asset pointer
 * @param {string} assetPointer - The asset pointer (e.g., "file-service://file-abc123")
 * @param {string} sessionId - The session ID
 * @param {string} baseDir - Base directory of the application
 * @param {Object} assetMapping - Asset mapping from assets.json or chat.html (optional)
 * @returns {Promise<string|null>} The URL to access the asset or null if not found
 */
async function generateAssetUrl(assetPointer, sessionId, baseDir, assetMapping = {}) {
  if (!assetPointer || !sessionId || !baseDir) {
    logger.warn('Invalid parameters for generateAssetUrl:', {
      assetPointer,
      sessionId,
      baseDir,
    });
    return null;
  }

  return await findAssetFile(assetPointer, sessionId, baseDir, assetMapping);
}

/**
 * Generate HTML for different asset types
 * @param {Object} asset - The asset object
 * @param {string} sessionId - The session ID
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<Object|null>} Object with html property or null if asset can't be processed
 */
async function generateAssetHtml(asset, sessionId, baseDir) {
  if (!asset || !sessionId || !baseDir) {
    logger.warn('Invalid parameters for generateAssetHtml:', {
      asset,
      sessionId,
      baseDir,
    });
    return null;
  }

  // Extract asset pointer and content type from asset object
  const assetPointer = asset.asset_pointer || asset.pointer || '';
  const contentType = asset.content_type || '';

  // Load asset mapping from assets.json (preferred) or chat.html (fallback)
  const assetMapping = await loadAssetMapping(sessionId, baseDir);

  const assetUrl = await generateAssetUrl(
    assetPointer,
    sessionId,
    baseDir,
    assetMapping
  );
  if (!assetUrl) {
    // File not found - show helpful message
    return {
      html: `<div class="asset-missing" style="margin: 0.5rem 0; padding: 0.5rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 0.25rem; color: #856404;">
          🖼️ <strong>Asset Not Available</strong>
          <br><small style="color: #856404;">Asset file not found: ${assetPointer}</small>
          </div>`,
      type: 'missing',
    };
  }

  // Generate HTML based on content type
  switch (contentType) {
  case 'image_asset_pointer':
    return {
      html: `<img src="${assetUrl}" alt="Image" style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5rem 0;" loading="lazy">`,
      type: 'image',
    };

  case 'audio_asset_pointer':
    return {
      html: `<audio controls src="${assetUrl}" style="width: 100%; margin: 0.5rem 0;">
          <p>Your browser does not support the audio element.</p>
        </audio>`,
      type: 'audio',
    };

  case 'video_container_asset_pointer':
    return {
      html: `<video controls src="${assetUrl}" style="width: 100%; max-height: 400px; border-radius: 0.5rem; margin: 0.5rem 0;">
          <p>Your browser does not support the video element.</p>
        </video>`,
      type: 'video',
    };

  default: {
    // For unknown types, try to determine from filename or asset pointer
    const assetLower = assetPointer.toLowerCase();
    if (
      assetLower.includes('.wav') ||
        assetLower.includes('.mp3') ||
        assetLower.includes('.m4a')
    ) {
      return {
        html: `<audio controls src="${assetUrl}" style="width: 100%; margin: 0.5rem 0;">
            <p>Your browser does not support the audio element.</p>
          </audio>`,
        type: 'audio',
      };
    } else if (
      assetLower.includes('.webp') ||
        assetLower.includes('.png') ||
        assetLower.includes('.jpg') ||
        assetLower.includes('.jpeg')
    ) {
      return {
        html: `<img src="${assetUrl}" alt="Image" style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5rem 0;" loading="lazy">`,
        type: 'image',
      };
    }

    // Fallback: show as download link
    return {
      html: `<div class="asset-info" style="margin: 0.5rem 0; padding: 0.5rem; background: #f5f5f5; border-radius: 0.25rem;">
          📎 <a href="${assetUrl}" target="_blank" style="color: #0066cc; text-decoration: none;">Download Asset</a>
          <br><small style="color: #666;">${assetPointer}</small>
          </div>`,
      type: 'unknown',
    };
  }
  }
}

async function getConversationMessages(conversation, sessionId = null, baseDir = null) {
  const messages = [];
  const nodes =
    conversation && (conversation.nodes || conversation.mapping)
      ? Object.values(conversation.nodes || conversation.mapping)
      : [];

  // Load asset mapping once for the entire conversation (performance optimization)
  let assetMapping = {};
  if (sessionId && baseDir) {
    assetMapping = await loadAssetMapping(sessionId, baseDir);
  }

  for (const node of nodes) {
    if (!node || !node.message) {
      continue;
    }
    const msg = node.message;
    const content = msg.content;
    if (!content || !Array.isArray(content.parts) || content.parts.length === 0) {
      continue;
    }
    const isSystem =
      msg.author &&
      msg.author.role === 'system' &&
      !(msg.metadata && msg.metadata.is_user_system_message);
    if (isSystem) {
      continue;
    }

    let author = msg.author && msg.author.role;
    if (author === 'assistant') author = 'ChatGPT';
    else if (author === 'tool') author = msg.author.name || 'Tool';

    const parts = [];
    for (const p of content.parts) {
      if (typeof p === 'string' && p.length) {
        // Convert markdown string to safe HTML
        const rawHtml = marked.parse(p);
        const safeHtml = sanitizeHtml(rawHtml, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'img',
            'h1',
            'h2',
            'u',
            's',
            'pre',
            'code',
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'title'],
          },
        });
        parts.push({ html: safeHtml, raw: p });
      } else if (p && p.content_type === 'audio_transcription') {
        parts.push({ transcript: p.text || '' });
      } else if (
        p &&
        [
          'audio_asset_pointer',
          'image_asset_pointer',
          'video_container_asset_pointer',
        ].includes(p.content_type)
      ) {
        const assetHtml = await generateAssetHtml(p, sessionId, baseDir, assetMapping);
        if (assetHtml) {
          parts.push(assetHtml);
        } else {
          parts.push({ asset: p }); // Fallback to original behavior
        }
      } else if (p && p.content_type === 'real_time_user_audio_video_asset_pointer') {
        if (p.audio_asset_pointer) {
          const audioHtml = await generateAssetHtml(
            p.audio_asset_pointer,
            sessionId,
            baseDir,
            assetMapping
          );
          if (audioHtml) {
            parts.push(audioHtml);
          } else {
            parts.push({ asset: p.audio_asset_pointer });
          }
        }
        if (p.video_container_asset_pointer) {
          const videoHtml = await generateAssetHtml(
            p.video_container_asset_pointer,
            sessionId,
            baseDir,
            assetMapping
          );
          if (videoHtml) {
            parts.push(videoHtml);
          } else {
            parts.push({ asset: p.video_container_asset_pointer });
          }
        }
        if (Array.isArray(p.frames_asset_pointers)) {
          for (const f of p.frames_asset_pointers) {
            const frameHtml = await generateAssetHtml(
              f,
              sessionId,
              baseDir,
              assetMapping
            );
            if (frameHtml) {
              parts.push(frameHtml);
            } else {
              parts.push({ asset: f });
            }
          }
        }
      }
    }

    if (parts.length > 0) {
      messages.push({
        author,
        parts,
        createdAt: msg.create_time || node.create_time || 0,
      });
    }
  }
  messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return messages;
}

module.exports = { getConversationMessages };
