const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const {
  CONTENT_TYPES,
  FILE_EXTENSIONS,
  ASSET_PREFIXES,
  SEARCH_CONFIG,
} = require('../config/constants');
const FileSystemHelper = require('./fsHelpers');
const PathUtils = require('./pathUtils');

const { validateRequiredParams, validateNonEmptyString } = require('./validators');

// Simple file cache to improve performance
const fileCache = new Map();

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

  const results = await PathUtils.findFilesByPrefix(dir, filename, true);

  // Implement simple LRU-like behavior
  if (fileCache.size >= SEARCH_CONFIG.MAX_CACHE_SIZE) {
    const firstKey = fileCache.keys().next().value;
    fileCache.delete(firstKey);
  }

  fileCache.set(cacheKey, results);
  return results;
}

/**
 * Get media directory path for an export
 * @param {string} baseDir - Base directory of application
 * @param {string} exportName - The export name
 * @returns {string} Media directory path
 */
function getMediaDir(baseDir, exportName) {
  validateRequiredParams(
    [
      { name: 'baseDir', value: baseDir },
      { name: 'exportName', value: exportName },
    ],
    'getMediaDir'
  );
  validateNonEmptyString(baseDir, 'baseDir');
  validateNonEmptyString(exportName, 'exportName');

  return FileSystemHelper.joinPath(baseDir, 'data', 'exports', exportName, 'media');
}

/**
 * Build a web URL from a file path
 * @param {string} filePath - Absolute file path
 * @param {string} baseDir - Base directory of application
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

  const path = require('path');
  const relativePath = path.relative(
    FileSystemHelper.joinPath(baseDir, 'public'),
    filePath
  );
  // Return absolute URL to ensure proper loading through web server
  const port = process.env.API_PORT || 3001;
  return `http://localhost:${port}/` + relativePath.replace(/\\/g, '/');
}

/**
 * Handle file operation errors consistently
 * @param {Error} error - The error object
 * @param {string} operation - Description of operation
 * @param {string} context - Additional context (optional)
 */
function handleFileError(error, operation, context = '') {
  const message = context ? `${operation}: ${context}` : operation;
  console.warn(`Error ${message}:`, error.message);
}

/**
 * Load asset mapping from assets.json file (preferred) or fallback to chat.html
 * @param {string} exportName - The export name
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<Object>} Asset mapping object
 */
async function loadAssetMapping(exportName, baseDir) {
  try {
    validateRequiredParams(
      [
        { name: 'exportName', value: exportName },
        { name: 'baseDir', value: baseDir },
      ],
      'loadAssetMapping'
    );
    validateNonEmptyString(exportName, 'exportName');
    validateNonEmptyString(baseDir, 'baseDir');

    // Try to load from assets.json first (preferred method)
    const assetsJsonPath = FileSystemHelper.joinPath(
      baseDir,
      'data',
      'exports',
      exportName,
      'assets.json'
    );

    try {
      const assetsContent = await FileSystemHelper.readFile(assetsJsonPath);
      const assetMapping = JSON.parse(assetsContent);
      console.debug(
        `Loaded asset mapping from assets.json for export ${exportName} with ${Object.keys(assetMapping).length} assets`
      );
      return assetMapping;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Error reading assets.json:', error.message);
      }
    }

    // Fallback to chat.html if assets.json doesn't exist
    const path = require('path');
    const chatHtmlPath = path.join(
      baseDir,
      'data',
      'exports',
      exportName,
      'media',
      'chat.html'
    );

    try {
      const chatHtmlContent = await FileSystemHelper.readFile(chatHtmlPath);

      // Look for assetsJson variable in HTML (updated regex to handle objects)
      const assetJsonMatch = chatHtmlContent.match(
        /var\s+assetsJson\s*=\s*(\{[\s\S]*?\})\s*;?/
      );

      if (assetJsonMatch && assetJsonMatch[1]) {
        // Parse JSON string
        const assetJsonString = assetJsonMatch[1];
        console.debug(
          `Found asset mapping in chat.html for export ${exportName} (fallback method)`
        );
        return JSON.parse(assetJsonString);
      } else {
        console.debug(`No asset mapping found in chat.html for export ${exportName}`);
      }
    } catch (error) {
      handleFileError(error, 'loading asset mapping from chat.html', exportName);
    }

    return {};
  } catch (error) {
    console.error('Error in loadAssetMapping:', error);
    return {};
  }
}

/**
 * Find the actual file path for an asset pointer
 * @param {string} assetPointer - The asset pointer (e.g., "file-service://file-abc123")
 * @param {string} exportName - The export name
 * @param {string} baseDir - Base directory of the application
 * @param {Object} assetMapping - Asset mapping from assets.json or chat.html
 * @returns {string|null} The URL to access the asset or null if not found
 */
async function findAssetFile(assetPointer, exportName, baseDir, assetMapping = {}) {
  if (!assetPointer || !exportName || !baseDir) {
    console.warn('Invalid parameters for findAssetFile:', {
      assetPointer,
      exportName,
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

  const mediaDir = getMediaDir(baseDir, exportName);

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
          console.debug(`Found mapped asset: ${assetPointer} -> ${filename}`);
          return buildAssetUrl(files[0], baseDir);
        }
      } catch (error) {
        handleFileError(error, 'finding mapped asset file', assetKey);
      }
    }
  }

  // If mapping fails, try to extract base filename from asset pointer and search for files with similar names
  // This handles cases where asset mapping is incorrect or missing
  const baseAssetId = assetPointer.replace(/^(file-service:\/\/|sediment:\/\/)/, '');
  const possibleNames = [
    baseAssetId, // Exact match
    baseAssetId + '.jpeg', // With extension
    baseAssetId + '.jpg', // With extension
    baseAssetId + '.png', // With extension
  ];

  // Search in both main media directory and Test-Chat-Combine subdirectory
  const searchDirs = [mediaDir, require('path').join(mediaDir, 'Test-Chat-Combine')];

  for (const searchDir of searchDirs) {
    for (const name of possibleNames) {
      try {
        const files = await cachedRecursivelyFindFiles(searchDir, name);
        if (files.length > 0) {
          console.debug(
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
    console.debug(`Searching for asset: ${assetKey} in directory: ${mediaDir}`);
    const files = await cachedRecursivelyFindFiles(mediaDir, assetKey);
    console.debug(`Found ${files.length} files matching ${assetKey}:`, files);
    if (files.length > 0) {
      console.debug(`Found asset by filename search: ${assetKey}`);
      return buildAssetUrl(files[0], baseDir);
    }
  } catch (error) {
    handleFileError(error, 'finding asset file', assetKey);
    console.error(`Failed to find asset ${assetPointer}:`, {
      error: error.message,
      mediaDir,
      assetKey,
      searchFiles: 'cachedRecursivelyFindFiles',
    });
  }

  console.debug(`Asset not found: ${assetPointer}`);
  return null;
}

/**
 * Recursively find files by filename prefix
 * @param {string} dir - Directory to search in
 * @param {string} filename - Filename to search for (prefix)
 * @returns {Promise<Array>} Array of file paths
 */
// Unused function - can be removed
// async function recursivelyFindFiles(dir, filename) {
//   if (!dir || !filename) {
//     console.warn('Invalid parameters for recursivelyFindFiles:', { dir, filename });
//     return [];
//   }
//
//   validateNonEmptyString(dir, 'dir');
//   validateNonEmptyString(filename, 'filename');
//
//   const { findFilesByPrefix } = require('./pathUtils');
//
//   try {
//     const results = await findFilesByPrefix(dir, filename, true);
//     return results;
//   } catch (error) {
//     console.error(`Error searching directory ${dir}:`, error);
//     return [];
//   }
// }

/**
 * Generate HTML for different asset types
 * @param {Object} asset - The asset object
 * @param {string} exportName - The export name
 * @param {string} baseDir - Base directory of the application
 * @param {Object} assetMapping - Asset mapping from assets.json or chat.html (optional)
 * @returns {Promise<Object|null>} Object with html property or null if asset can't be processed
 */
async function generateAssetHtml(asset, exportName, baseDir, assetMapping = {}) {
  try {
    validateRequiredParams(
      [
        { name: 'asset', value: asset },
        { name: 'exportName', value: exportName },
        { name: 'baseDir', value: baseDir },
      ],
      'generateAssetHtml'
    );
    validateNonEmptyString(exportName, 'exportName');
    validateNonEmptyString(baseDir, 'baseDir');
  } catch (error) {
    console.warn('Invalid parameters for generateAssetHtml:', {
      asset: asset ? 'present' : 'missing',
      exportName,
      baseDir,
      error: error.message,
    });
    return null;
  }

  // Extract asset pointer and content type from asset object
  const assetPointer = asset.asset_pointer || asset.pointer || '';
  const contentType = asset.content_type || '';
  console.debug(`Processing asset: ${assetPointer}, content type: ${contentType}`);

  const assetUrl = await findAssetFile(assetPointer, exportName, baseDir, assetMapping);
  if (!assetUrl) {
    console.debug(`Asset URL not found for: ${assetPointer}`);
    // File not found - show helpful message
    return {
      html: `<div class="asset-missing" style="margin: 0.5rem 0; padding: 0.5rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 0.25rem;">
            🖼️ <strong>Asset Not Available</strong>
            <br><small style="color: #856404;">Asset file not found: ${assetPointer}</small>
            </div>`,
      type: 'missing',
    };
  }

  console.debug(`Generated asset URL: ${assetPointer} -> ${assetUrl}`);

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

/**
 * Get conversation messages with proper asset processing
 * @param {Object} conversation - Conversation object
 * @param {string} exportName - The export name
 * @param {string} baseDir - Base directory of the application
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of processed messages
 */
async function getChatMessages(chat, exportName = null, baseDir = null) {
  try {
    validateRequiredParams([{ name: 'chat', value: chat }], 'getChatMessages');

    if (exportName) {
      validateNonEmptyString(exportName, 'exportName');
    }
    if (baseDir) {
      validateNonEmptyString(baseDir, 'baseDir');
    }
  } catch (error) {
    console.warn('Invalid parameters for getChatMessages:', error.message);
    return [];
  }

  const messages = [];
  const nodes =
    chat && (chat.nodes || chat.mapping)
      ? Object.values(chat.nodes || chat.mapping)
      : [];

  // Load asset mapping once for the entire conversation (performance optimization)
  let assetMapping = {};
  if (exportName && baseDir) {
    assetMapping = await loadAssetMapping(exportName, baseDir);
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
        console.debug(
          `Processing asset: ${p.asset_pointer}, content_type: ${p.content_type}`
        );
        const assetHtml = await generateAssetHtml(p, exportName, baseDir, assetMapping);
        if (assetHtml) {
          console.debug(
            `Successfully processed asset: ${p.asset_pointer} -> ${assetHtml.type}`
          );
          parts.push(assetHtml);
        } else {
          console.warn(`Failed to process asset: ${p.asset_pointer}`);
          parts.push({ asset: p }); // Fallback to original behavior
        }
      } else if (p.video_container_asset_pointer) {
        const videoHtml = await generateAssetHtml(
          p.video_container_asset_pointer,
          exportName,
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
            exportName,
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

module.exports = { getChatMessages };
