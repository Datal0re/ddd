const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./logger');
const logger = createLogger({ module: 'getConversationMessages' });

/**
 * Validate required parameters for a function
 * @param {Array<{name: string, value: any}>} params - Array of parameter objects with name and value
 * @param {string} functionName - Name of the function for error reporting
 * @throws {Error} If any required parameters are missing or invalid
 */
function validateRequiredParams(params, functionName) {
  const missing = params.filter(p => !p.value);
  if (missing.length > 0) {
    throw new Error(
      `${functionName}: Missing required parameters: ${missing.map(p => p.name).join(', ')}`
    );
  }
}

/**
 * Validate that a parameter is a non-empty string
 * @param {any} param - Parameter to validate
 * @param {string} paramName - Name of the parameter for error reporting
 * @throws {Error} If parameter is not a non-empty string
 */
function validateNonEmptyString(param, paramName) {
  if (typeof param !== 'string' || param.trim() === '') {
    throw new Error(`${paramName} must be a non-empty string`);
  }
}

// Content type constants
const CONTENT_TYPES = {
  IMAGE: 'image_asset_pointer',
  AUDIO: 'audio_asset_pointer',
  VIDEO: 'video_container_asset_pointer',
  TRANSCRIPTION: 'audio_transcription',
};

// File extension constants
const FILE_EXTENSIONS = {
  AUDIO: ['.wav', '.mp3', '.m4a', '.dat'],
  IMAGE: ['.webp', '.png', '.jpg', '.jpeg'],
};

// Asset pointer prefixes
const ASSET_PREFIXES = {
  FILE_SERVICE: 'file-service://',
  SEDIMENT: 'sediment://',
};

// Simple file cache to improve performance
const fileCache = new Map();
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

// Clear cache to ensure fresh results for testing
fileCache.clear();

/**
 * Get cached file search results or perform new search
 * @param {string} dir - Directory to search
 * @param {string} filename - Filename to search for
 * @returns {Promise<Array>} Array of matching file paths
 */
async function cachedRecursivelyFindFiles(dir, filename) {
  const cacheKey = `${dir}:${filename}`;

  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey);
  }

  const results = await recursivelyFindFiles(dir, filename);

  // Implement simple LRU-like behavior
  if (fileCache.size >= MAX_CACHE_SIZE) {
    const firstKey = fileCache.keys().next().value;
    fileCache.delete(firstKey);
  }

  fileCache.set(cacheKey, results);
  return results;
}

/**
 * Get the media directory path for a session
 * @param {string} baseDir - Base directory of the application
 * @param {string} sessionId - The session ID
 * @returns {string} Media directory path
 */
function getMediaDir(baseDir, sessionId) {
  validateRequiredParams(
    [
      { name: 'baseDir', value: baseDir },
      { name: 'sessionId', value: sessionId },
    ],
    'getMediaDir'
  );
  validateNonEmptyString(baseDir, 'baseDir');
  validateNonEmptyString(sessionId, 'sessionId');

  return path.join(baseDir, 'public', 'media', 'sessions', sessionId);
}

/**
 * Build a web URL from a file path
 * @param {string} filePath - Absolute file path
 * @param {string} baseDir - Base directory of the application
 * @returns {string} Web URL path
 */
function buildAssetUrl(filePath, baseDir) {
  validateRequiredParams(
    [
      { name: 'filePath', value: filePath },
      { name: 'baseDir', value: baseDir },
    ],
    'buildAssetUrl'
  );
  validateNonEmptyString(filePath, 'filePath');
  validateNonEmptyString(baseDir, 'baseDir');

  const relativePath = path.relative(path.join(baseDir, 'public'), filePath);
  // Return absolute URL to ensure proper loading through the web server
  const port = process.env.API_PORT || 3001;
  return `http://localhost:${port}/` + relativePath.replace(/\\/g, '/');
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
  try {
    validateRequiredParams(
      [
        { name: 'sessionId', value: sessionId },
        { name: 'baseDir', value: baseDir },
      ],
      'loadAssetMapping'
    );
    validateNonEmptyString(sessionId, 'sessionId');
    validateNonEmptyString(baseDir, 'baseDir');
  } catch (error) {
    logger.warn('Invalid parameters for loadAssetMapping:', {
      sessionId,
      baseDir,
      error: error.message,
    });
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
  if (assetPointer.startsWith(ASSET_PREFIXES.FILE_SERVICE)) {
    assetKey = assetPointer.replace(ASSET_PREFIXES.FILE_SERVICE, '');
  } else if (assetPointer.startsWith(ASSET_PREFIXES.SEDIMENT)) {
    assetKey = assetPointer.replace(ASSET_PREFIXES.SEDIMENT, '');
    // Remove file extension for sediment files since they're stored with .dat extension
    assetKey = assetKey.replace(/\.(dat|wav|mp3|m4a)$/i, '');
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
        const files = await cachedRecursivelyFindFiles(mediaDir, filename);
        if (files.length > 0) {
          logger.debug(`Found mapped asset: ${assetPointer} -> ${filename}`);
          return buildAssetUrl(files[0], baseDir);
        }
      } catch (error) {
        handleFileError(error, 'finding mapped asset file', assetKey);
      }
    }
  }

  // If mapping fails, try to extract base filename from asset pointer and search for files with similar names
  // This handles cases where the asset mapping is incorrect or missing
  const baseAssetId = assetPointer.replace(/^(file-service:\/\/|sediment:\/\/)/, '');
  const possibleNames = [
    baseAssetId, // Exact match
    baseAssetId + '.jpeg', // With extension
    baseAssetId + '.jpg', // With extension
    baseAssetId + '.png', // With extension
  ];

  // Search in both main media directory and Test-Chat-Combine subdirectory
  const searchDirs = [mediaDir, path.join(mediaDir, 'Test-Chat-Combine')];

  for (const searchDir of searchDirs) {
    for (const name of possibleNames) {
      try {
        const files = await cachedRecursivelyFindFiles(searchDir, name);
        if (files.length > 0) {
          logger.debug(
            `Found asset by pattern search: ${assetPointer} -> ${name} in ${searchDir}`
          );
          return buildAssetUrl(files[0], baseDir);
        }
      } catch {
        // Continue to next pattern
        continue;
      }
    }
  }

  // Fallback to original search if mapping fails
  try {
    logger.debug(`Searching for asset: ${assetKey} in directory: ${mediaDir}`);
    const files = await cachedRecursivelyFindFiles(mediaDir, assetKey);
    logger.debug(`Found ${files.length} files matching ${assetKey}:`, files);
    if (files.length > 0) {
      logger.debug(`Found asset by filename search: ${assetKey}`);
      return buildAssetUrl(files[0], baseDir);
    }
  } catch (error) {
    handleFileError(error, 'finding asset file', assetKey);
    logger.error(`Failed to find asset ${assetPointer}:`, {
      error: error.message,
      mediaDir,
      assetKey,
      searchFiles: 'cachedRecursivelyFindFiles',
    });
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

  validateNonEmptyString(dir, 'dir');
  validateNonEmptyString(filename, 'filename');

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
    // Log at debug level as this is expected for non-existent directories
    logger.debug(`Directory not accessible during file search: ${dir}`, error.message);
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
 * @param {Object} assetMapping - Asset mapping from assets.json or chat.html (optional)
 * @returns {Promise<Object|null>} Object with html property or null if asset can't be processed
 */
async function generateAssetHtml(asset, sessionId, baseDir, assetMapping = {}) {
  try {
    validateRequiredParams(
      [
        { name: 'asset', value: asset },
        { name: 'sessionId', value: sessionId },
        { name: 'baseDir', value: baseDir },
      ],
      'generateAssetHtml'
    );
    validateNonEmptyString(sessionId, 'sessionId');
    validateNonEmptyString(baseDir, 'baseDir');
  } catch (error) {
    logger.warn('Invalid parameters for generateAssetHtml:', {
      asset: asset ? 'present' : 'missing',
      sessionId,
      baseDir,
      error: error.message,
    });
    return null;
  }

  // Extract asset pointer and content type from asset object
  const assetPointer = asset.asset_pointer || asset.pointer || '';
  const contentType = asset.content_type || '';
  logger.debug(`Processing asset: ${assetPointer}, content type: ${contentType}`);

  const assetUrl = await generateAssetUrl(
    assetPointer,
    sessionId,
    baseDir,
    assetMapping
  );
  if (!assetUrl) {
    logger.debug(`Asset URL not found for: ${assetPointer}`);
    // File not found - show helpful message
    return {
      html: `<div class="asset-missing" style="margin: 0.5rem 0; padding: 0.5rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 0.25rem; color: #856404;">
          🖼️ <strong>Asset Not Available</strong>
          <br><small style="color: #856404;">Asset file not found: ${assetPointer}</small>
          </div>`,
      type: 'missing',
    };
  }

  logger.debug(`Generated asset URL: ${assetPointer} -> ${assetUrl}`);

  // Generate HTML based on content type
  switch (contentType) {
    case CONTENT_TYPES.IMAGE:
      return {
        html: `<img src="${assetUrl}" alt="Image" style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5rem 0;" loading="lazy">`,
        type: 'image',
      };

    case CONTENT_TYPES.AUDIO:
      return {
        html: `<audio controls src="${assetUrl}" style="width: 100%; margin: 0.5rem 0;">
          <p>Your browser does not support the audio element.</p>
        </audio>`,
        type: 'audio',
      };

    case CONTENT_TYPES.VIDEO:
      return {
        html: `<video controls src="${assetUrl}" style="width: 100%; max-height: 400px; border-radius: 0.5rem; margin: 0.5rem 0;">
          <p>Your browser does not support the video element.</p>
        </video>`,
        type: 'video',
      };

    default: {
      // For unknown types, try to determine from filename or asset pointer
      const assetLower = assetPointer.toLowerCase();

      // Special handling for sediment audio files (often stored as .dat files)
      if (
        assetPointer.startsWith('sediment://file_') &&
        contentType === CONTENT_TYPES.AUDIO
      ) {
        return {
          html: `<audio controls src="${assetUrl}" style="width: 100%; margin: 0.5rem 0;">
            <p>Your browser does not support the audio element.</p>
          </audio>`,
          type: 'audio',
        };
      }

      // Check file extensions for type detection
      const isAudioFile = FILE_EXTENSIONS.AUDIO.some(ext => assetLower.includes(ext));
      const isImageFile = FILE_EXTENSIONS.IMAGE.some(ext => assetLower.includes(ext));

      if (isAudioFile) {
        return {
          html: `<audio controls src="${assetUrl}" style="width: 100%; margin: 0.5rem 0;">
            <p>Your browser does not support the audio element.</p>
          </audio>`,
          type: 'audio',
        };
      } else if (isImageFile) {
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
  try {
    validateRequiredParams(
      [{ name: 'conversation', value: conversation }],
      'getConversationMessages'
    );

    if (sessionId) {
      validateNonEmptyString(sessionId, 'sessionId');
    }
    if (baseDir) {
      validateNonEmptyString(baseDir, 'baseDir');
    }
  } catch (error) {
    logger.warn('Invalid parameters for getConversationMessages:', error.message);
    return [];
  }

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
      } else if (p && p.content_type === CONTENT_TYPES.TRANSCRIPTION) {
        parts.push({ transcript: p.text || '' });
      } else if (
        p &&
        [CONTENT_TYPES.AUDIO, CONTENT_TYPES.IMAGE, CONTENT_TYPES.VIDEO].includes(
          p.content_type
        )
      ) {
        logger.debug(
          `Processing asset: ${p.asset_pointer}, content_type: ${p.content_type}`
        );
        const assetHtml = await generateAssetHtml(p, sessionId, baseDir, assetMapping);
        if (assetHtml) {
          logger.debug(
            `Successfully processed asset: ${p.asset_pointer} -> ${assetHtml.type}`
          );
          parts.push(assetHtml);
        } else {
          logger.warn(`Failed to process asset: ${p.asset_pointer}`);
          parts.push({ asset: p }); // Fallback to original behavior
        }
      } else if (p.video_container_asset_pointer) {
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
      } else if (Array.isArray(p.frames_asset_pointers)) {
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
