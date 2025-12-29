/**
 * Chat Upcycler
 * Refactored from conversation-messages.js for export-friendly chat processing
 * Removes web dependencies and focuses on export functionality
 */

const { CONTENT_TYPES, ASSET_PREFIXES } = require('../config/constants');
const FileUtils = require('./FileUtils');
const { SchemaValidator } = require('./SchemaValidator');
const { ErrorHandler } = require('./ErrorHandler');

/**
 * Extract relative path from media directory for a file
 * @param {string} fullPath - Full absolute path to file
 * @param {string} mediaDir - Media directory path
 * @returns {string} Relative path from media directory
 */
function extractRelativePathFromMedia(fullPath, mediaDir) {
  if (!fullPath || !mediaDir) return null;

  // Normalize both paths and extract relative path
  const normalizedMedia = FileUtils.resolvePath(mediaDir);
  const normalizedFile = FileUtils.resolvePath(fullPath);

  if (normalizedFile.startsWith(normalizedMedia)) {
    const relativePath = normalizedFile.slice(normalizedMedia.length);
    // Remove leading separator if present
    return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  }

  return null;
}

/**
 * Get media directory path for a dumpster
 * @param {string} baseDir - Base directory of application
 * @param {string} dumpsterName - The dumpster name
 * @returns {string} Media directory path
 */
function getMediaDir(baseDir, dumpsterName) {
  SchemaValidator.validateRequiredParams(
    [
      { name: 'baseDir', value: baseDir },
      { name: 'dumpsterName', value: dumpsterName },
    ],
    'getMediaDir'
  );
  SchemaValidator.validateNonEmptyString(baseDir, 'baseDir');
  SchemaValidator.validateNonEmptyString(dumpsterName, 'dumpsterName');

  return FileUtils.joinPath(baseDir, 'data', 'dumpsters', dumpsterName, 'media');
}

/**
 * Extract filename from asset pointer
 * @param {string} assetPointer - Asset pointer (e.g., "file-service://file-abc123")
 * @returns {string} Extracted filename
 */
function extractFilenameFromPointer(assetPointer) {
  if (!assetPointer || typeof assetPointer !== 'string') {
    return null;
  }

  let assetKey = assetPointer;
  if (assetPointer.startsWith(ASSET_PREFIXES.FILE_SERVICE)) {
    assetKey = assetPointer.replace(ASSET_PREFIXES.FILE_SERVICE, '');
  } else if (assetPointer.startsWith(ASSET_PREFIXES.SEDIMENT)) {
    assetKey = assetPointer.replace(ASSET_PREFIXES.SEDIMENT, '');
    // Remove file extension for sediment files since they're stored with .dat extension
    assetKey = assetKey.replace(/\.(dat|wav|mp3|m4a)$/i, '');
  }

  // Clean up any remaining URL encoding or special characters
  try {
    assetKey = decodeURIComponent(assetKey);
  } catch {
    // If decoding fails, use the original key
  }

  return assetKey;
}

/**
 * Load asset mapping from assets.json file
 * @param {string} dumpsterName - The dumpster name
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<Object>} Asset mapping object
 */
async function loadAssetMapping(dumpsterName, baseDir) {
  try {
    SchemaValidator.validateRequiredParams(
      [
        { name: 'dumpsterName', value: dumpsterName },
        { name: 'baseDir', value: baseDir },
      ],
      'loadAssetMapping'
    );
    SchemaValidator.validateNonEmptyString(dumpsterName, 'dumpsterName');
    SchemaValidator.validateNonEmptyString(baseDir, 'baseDir');

    // Try to load from assets.json first (preferred method)
    const assetsJsonPath = FileUtils.joinPath(
      baseDir,
      'data',
      'dumpsters',
      dumpsterName,
      'assets.json'
    );

    try {
      const assetsContent = await FileUtils.readFile(assetsJsonPath);
      const assetMapping = JSON.parse(assetsContent);
      return assetMapping;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        ErrorHandler.logWarning('Error reading assets.json:', 'loadAssetMapping');
      }
    }

    return {};
  } catch {
    ErrorHandler.logError('Error in loadAssetMapping');
    return {};
  }
}

/**
 * Find the actual file path for an asset pointer
 * @param {string} assetPointer - The asset pointer
 * @param {string} dumpsterName - The dumpster name
 * @param {string} baseDir - Base directory of the application
 * @param {Object} assetMapping - Asset mapping from assets.json
 * @returns {Promise<string|null>} The local path to access the asset or null if not found
 */
async function findAssetFile(assetPointer, dumpsterName, baseDir, assetMapping = {}) {
  if (!assetPointer || !dumpsterName || !baseDir) {
    return null;
  }

  // Extract filename from asset pointer
  const assetKey = extractFilenameFromPointer(assetPointer);
  if (!assetKey) {
    return null;
  }

  const mediaDir = getMediaDir(baseDir, dumpsterName);

  // Simplified asset mapping search with 2 main strategies
  const mappingStrategies = [
    // Direct pointer mapping (most common case)
    () => assetMapping[assetPointer],
    // Try filename without prefix
    () => assetMapping[assetKey],
  ];

  // Try mapping strategies
  for (const strategy of mappingStrategies) {
    try {
      const mappedFile = strategy();
      if (mappedFile) {
        const filename =
          typeof mappedFile === 'string' ? mappedFile : mappedFile.name || '';
        if (filename) {
          const foundPath = await searchForFileInMedia(
            mediaDir,
            filename,
            dumpsterName
          );
          if (foundPath) {
            return foundPath;
          }
        }
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Enhanced filename search with more possibilities
  const baseAssetId = assetPointer.replace(/^(file-service:\/\/|sediment:\/\/)/, '');
  const possibleNames = [
    assetKey,
    baseAssetId,
    `file-${baseAssetId.replace(/^file-/, '')}`,
    baseAssetId + '.jpeg',
    baseAssetId + '.jpg',
    baseAssetId + '.png',
    baseAssetId + '.webp',
    baseAssetId + '.gif',
    baseAssetId + '.mp4',
    baseAssetId + '.webm',
    baseAssetId + '.wav',
    baseAssetId + '.mp3',
    baseAssetId + '.m4a',
    baseAssetId + '.dat',
  ];

  // Search with simple filename
  const foundPath = await searchForFileInMedia(
    mediaDir,
    possibleNames[0], // Use first name as primary
    dumpsterName
  );
  if (foundPath) {
    return foundPath;
  }

  return null;
}

/**
 * Helper function to search for a specific file in media directory
 */
async function searchForFileInMedia(mediaDir, filename, _dumpsterName) {
  try {
    const files = await FileUtils.cachedRecursivelyFindFiles(mediaDir, filename);
    if (files.length > 0) {
      // Extract relative path from the found file
      const relativePath = extractRelativePathFromMedia(files[0], mediaDir);
      if (relativePath) {
        return FileUtils.joinPath('media', relativePath);
      }
      // Fallback to original behavior
      return FileUtils.joinPath('media', filename);
    }
  } catch {
    // Continue if partial search fails
  }
  return null;
}

/**
 * Helper function to search with multiple possible names
 */

/**
 * Generate content for different asset types for export
 * @param {Object} asset - The asset object
 * @param {string} _dumpsterName - The dumpster name (unused, kept for interface compatibility)
 * @param {string} baseDir - Base directory of the application
 * @param {string} format - Export format (md, txt, html)
 * @param {Object} assetMapping - Asset mapping from assets.json
 * @returns {Promise<Object|null>} Object with content and metadata or null if asset can't be processed
 */
async function generateAssetContent(
  asset,
  _dumpsterName,
  baseDir,
  format,
  assetMapping = {}
) {
  try {
    const assetPointer = asset.asset_pointer || asset.pointer || '';
    const contentType = asset.content_type || '';

    if (!assetPointer) {
      return {
        type: 'missing',
        pointer: 'unknown',
        contentType,
        message: 'Asset pointer missing',
        error: 'no_pointer',
      };
    }

    const assetPath = await findAssetFile(
      assetPointer,
      _dumpsterName,
      baseDir,
      assetMapping
    );

    if (!assetPath) {
      const filename = extractFilenameFromPointer(assetPointer);
      return {
        type: 'missing',
        pointer: assetPointer,
        filename,
        contentType,
        message: `Asset file not found: ${filename || assetPointer}`,
        error: 'file_not_found',
      };
    }

    // Generate content based on format
    switch (format) {
      case 'md':
        return generateMarkdownAsset(assetPath, assetPointer, contentType);
      case 'txt':
        return generateTextAsset(assetPath, assetPointer, contentType);
      case 'html':
        return generateHTMLAsset(assetPath, assetPointer, contentType);
      default:
        return {
          type: 'unknown',
          pointer: assetPointer,
          path: assetPath,
          contentType,
        };
    }
  } catch (error) {
    return {
      type: 'error',
      pointer: asset.asset_pointer || asset.pointer || 'unknown',
      contentType: asset.content_type || '',
      message: `Error processing asset: ${error.message}`,
      error: 'processing_error',
      errorDetails: error,
    };
  }
}

/**
 * Generate markdown asset content
 * @param {string} assetPath - Relative asset path
 * @param {string} assetPointer - Asset pointer
 * @param {string} contentType - Content type
 * @returns {Object} Asset content object
 */
function generateMarkdownAsset(assetPath, assetPointer, contentType) {
  const filename = extractFilenameFromPointer(assetPointer);

  switch (contentType) {
    case CONTENT_TYPES.IMAGE:
      return {
        type: 'image',
        content: `![${filename}](${assetPath})`,
        path: assetPath,
        alt: filename,
      };
    case CONTENT_TYPES.AUDIO:
      return {
        type: 'audio',
        content: `[🔊 Audio: ${filename}](${assetPath})`,
        path: assetPath,
        filename,
      };
    case CONTENT_TYPES.VIDEO:
      return {
        type: 'video',
        content: `[🎥 Video: ${filename}](${assetPath})`,
        path: assetPath,
        filename,
      };
    default:
      return {
        type: 'unknown',
        content: `[📎 File: ${filename}](${assetPath})`,
        path: assetPath,
        filename,
      };
  }
}

/**
 * Generate text asset content
 * @param {string} assetPath - Relative asset path
 * @param {string} assetPointer - Asset pointer
 * @param {string} contentType - Content type
 * @returns {Object} Asset content object
 */
function generateTextAsset(assetPath, assetPointer, contentType) {
  const filename = extractFilenameFromPointer(assetPointer);

  switch (contentType) {
    case CONTENT_TYPES.IMAGE:
      return {
        type: 'image',
        content: `[Image: ${filename} -> ${assetPath}]`,
        path: assetPath,
        filename,
      };
    case CONTENT_TYPES.AUDIO:
      return {
        type: 'audio',
        content: `[Audio: ${filename} -> ${assetPath}]`,
        path: assetPath,
        filename,
      };
    case CONTENT_TYPES.VIDEO:
      return {
        type: 'video',
        content: `[Video: ${filename} -> ${assetPath}]`,
        path: assetPath,
        filename,
      };
    default:
      return {
        type: 'unknown',
        content: `[File: ${filename} -> ${assetPath}]`,
        path: assetPath,
        filename,
      };
  }
}

/**
 * Generate HTML asset content
 * @param {string} assetPath - Relative asset path
 * @param {string} assetPointer - Asset pointer
 * @param {string} contentType - Content type
 * @returns {Object} Asset content object
 */
function generateHTMLAsset(assetPath, assetPointer, contentType) {
  const filename = extractFilenameFromPointer(assetPointer);

  switch (contentType) {
    case CONTENT_TYPES.IMAGE:
      return {
        type: 'image',
        content: `<img src="${assetPath}" alt="${filename}" style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5rem 0;" loading="lazy">`,
        path: assetPath,
        alt: filename,
      };
    case CONTENT_TYPES.AUDIO:
      return {
        type: 'audio',
        content: `<audio controls src="${assetPath}" style="width: 100%; margin: 0.5rem 0;">
            <p>Your browser does not support the audio element.</p>
            </audio>`,
        path: assetPath,
        filename,
      };
    case CONTENT_TYPES.VIDEO:
      return {
        type: 'video',
        content: `<video controls src="${assetPath}" style="width: 100%; max-height: 400px; border-radius: 0.5rem; margin: 0.5rem 0;">
            <p>Your browser does not support the video element.</p>
            </video>`,
        path: assetPath,
        filename,
      };
    default:
      return {
        type: 'unknown',
        content: `<div class="asset-info" style="margin: 0.5rem 0; padding: 0.5rem; background: #f5f5f5; border-radius: 0.25rem;">
              📎 <a href="${assetPath}" target="_blank" style="color: #0066cc; text-decoration: none;">Download ${filename}</a>
              </div>`,
        path: assetPath,
        filename,
      };
  }
}

/**
 * Process chat messages for export
 * @param {Object} chat - Chat object
 * @param {string} exportName - The export/dumpster name
 * @param {string} baseDir - Base directory of the application
 * @param {string} format - Export format
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed chat object
 */
async function processChatForExport(
  chat,
  exportName = null,
  baseDir = null,
  format = 'md',
  _options = {}
) {
  const assetErrorTracker = _options.assetErrorTracker;

  try {
    SchemaValidator.validateRequiredParams(
      [{ name: 'chat', value: chat }],
      'processChatForExport'
    );

    if (exportName) {
      SchemaValidator.validateNonEmptyString(exportName, 'exportName');
    }
    if (baseDir) {
      SchemaValidator.validateNonEmptyString(baseDir, 'baseDir');
    }

    const nodes =
      chat && (chat.nodes || chat.mapping)
        ? Object.values(chat.nodes || chat.mapping)
        : [];

    // Load asset mapping once for the entire chat
    let assetMapping = {};
    if (exportName && baseDir) {
      assetMapping = await loadAssetMapping(exportName, baseDir);
    }

    const messages = [];
    const assets = [];

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
          // Process text content
          parts.push({ type: 'text', content: p, raw: p });
        } else if (p && p.content_type === CONTENT_TYPES.TRANSCRIPTION) {
          parts.push({ type: 'transcript', content: p.text || '' });
        } else if (
          p &&
          [CONTENT_TYPES.AUDIO, CONTENT_TYPES.IMAGE, CONTENT_TYPES.VIDEO].includes(
            p.content_type
          )
        ) {
          // Process asset
          if (p.asset_pointer) {
            const assetContent = await generateAssetContent(
              p,
              exportName,
              baseDir,
              format,
              assetMapping
            );
            if (assetContent) {
              parts.push(assetContent);
              const assetInfo = {
                pointer: p.asset_pointer,
                contentType: p.content_type,
                filename: extractFilenameFromPointer(p.asset_pointer),
              };

              // Include error information if available
              if (assetContent.error) {
                assetInfo.error = assetContent.error;
                assetInfo.message = assetContent.message;
              }

              assets.push(assetInfo);
            }
          } else {
            if (assetErrorTracker) {
              assetErrorTracker.addWarning(
                'asset_missing_pointer',
                'Asset missing asset_pointer',
                {
                  contentType: p.content_type,
                  exportName,
                }
              );
            }
          }
        } else if (p.video_container_asset_pointer) {
          // Process video asset
          if (p.video_container_asset_pointer) {
            const assetContent = await generateAssetContent(
              p.video_container_asset_pointer,
              exportName,
              baseDir,
              format,
              assetMapping
            );
            if (assetContent) {
              parts.push(assetContent);
              const assetInfo = {
                pointer: p.video_container_asset_pointer,
                contentType: CONTENT_TYPES.VIDEO,
                filename: extractFilenameFromPointer(p.video_container_asset_pointer),
              };

              // Include error information if available
              if (assetContent.error) {
                assetInfo.error = assetContent.error;
                assetInfo.message = assetContent.message;
              }

              assets.push(assetInfo);
            }
          } else {
            if (assetErrorTracker) {
              assetErrorTracker.addWarning(
                'video_asset_missing_pointer',
                'Video asset missing video_container_asset_pointer',
                {
                  exportName,
                }
              );
            }
          }
        } else if (Array.isArray(p.frames_asset_pointers)) {
          // Process frame assets
          for (const f of p.frames_asset_pointers) {
            if (f) {
              const assetContent = await generateAssetContent(
                f,
                exportName,
                baseDir,
                format,
                assetMapping
              );
              if (assetContent) {
                parts.push(assetContent);
                const assetInfo = {
                  pointer: f,
                  contentType: CONTENT_TYPES.IMAGE,
                  filename: extractFilenameFromPointer(f),
                };

                // Include error information if available
                if (assetContent.error) {
                  assetInfo.error = assetContent.error;
                  assetInfo.message = assetContent.message;
                }

                assets.push(assetInfo);
              }
            } else {
              if (assetErrorTracker) {
                assetErrorTracker.addWarning(
                  'frame_asset_null',
                  'Frame asset pointer is null',
                  {
                    exportName,
                  }
                );
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

    // Extract chat metadata
    const metadata = {
      title: chat.title || 'Untitled',
      createTime: chat.create_time,
      updateTime: chat.update_time,
      messageCount: messages.length,
      assetCount: assets.length,
      model: chat.model_slug || 'Unknown',
    };

    return {
      metadata,
      messages,
      assets,
      originalChat: chat,
    };
  } catch (error) {
    ErrorHandler.logError('Error in processChatForExport');
    throw error;
  }
}

class ChatUpcycler {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  /**
   * Process chat for export (main public method)
   * @param {Object} chat - Chat object
   * @param {string} format - Export format
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed chat object
   */
  async processChatForExport(chat, format, _options = {}) {
    return await processChatForExport(
      chat,
      _options.dumpsterName,
      this.baseDir,
      format,
      _options
    );
  }
}

module.exports = ChatUpcycler;

// Export helper functions as static properties
ChatUpcycler.loadAssetMapping = loadAssetMapping;
ChatUpcycler.getMediaDir = getMediaDir;
ChatUpcycler.findAssetFile = findAssetFile;
ChatUpcycler.generateAssetContent = generateAssetContent;
ChatUpcycler.processChatForExport = processChatForExport;
