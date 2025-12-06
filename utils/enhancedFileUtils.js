/*
 * Enhanced file processing utilities with better temp management
 * Follows best practices for security, performance, and cleanup
 */
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Creates a secure temporary directory for processing
 * @returns {Promise<string>} Path to temp directory
 */
async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `dddiver-${crypto.randomBytes(8).toString('hex')}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Safely cleans up temporary directory
 * @param {string} tempDir - Directory to clean up
 */
async function cleanupTempDir(tempDir) {
  try {
    await fs.rmdir(tempDir, { recursive: true });
  } catch (error) {
    // Ignore cleanup errors - temp dirs may be locked by OS
    console.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
  }
}

/**
 * Validates uploaded file for security
 * @param {Buffer|string} fileData - File data or path
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {Promise<boolean>} True if file is safe
 */
async function validateUpload(fileData, maxSize = 500 * 1024 * 1024) { // 500MB default
  try {
    const size = typeof fileData === 'string' 
      ? (await fs.stat(fileData)).size 
      : fileData.length;
    
    // Size validation
    if (size > maxSize) {
      throw new Error(`File too large: ${size} bytes (max: ${maxSize})`);
    }
    
    // Basic zip signature validation
    const buffer = typeof fileData === 'string' 
      ? await fs.readFile(fileData)
      : fileData;
    
    const zipSignatures = [
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP
      Buffer.from([0x50, 0x4B, 0x05, 0x06]), // ZIP
      Buffer.from([0x50, 0x4B, 0x07, 0x08]), // ZIP
    ];
    
    const isValidZip = zipSignatures.some(sig => 
      buffer.slice(0, sig.length).equals(sig)
    );
    
    if (!isValidZip) {
      throw new Error('Invalid file format - expected ZIP archive');
    }
    
    return true;
  } catch (error) {
    console.error('Upload validation failed:', error);
    return false;
  }
}

/**
 * Processes uploaded file with enhanced security and cleanup
 * @param {Buffer|string} zipData - ZIP file data or path
 * @param {string} sessionId - Session identifier
 * @param {string} baseDir - Base application directory
 * @returns {Promise<Object>} Processing results
 */
async function processUploadEnhanced(zipData, sessionId, baseDir) {
  let tempDir = null;
  let tempZipPath = null;
  
  try {
    // Create secure temp directory
    tempDir = await createTempDir();
    tempZipPath = path.join(tempDir, 'upload.zip');
    
    // Validate upload
    await validateUpload(zipData);
    
    // Write temp file
    if (Buffer.isBuffer(zipData)) {
      await fs.writeFile(tempZipPath, zipData);
    } else {
      await fs.copyFile(zipData, tempZipPath);
    }
    
    // Create session directories
    const sessionDir = path.join(baseDir, 'data', 'sessions', sessionId);
    const rawDir = path.join(sessionDir, 'raw');
    const processedDir = path.join(sessionDir, 'processed');
    const mediaDir = path.join(sessionDir, 'media');
    
    await fs.mkdir(rawDir, { recursive: true });
    await fs.mkdir(processedDir, { recursive: true });
    await fs.mkdir(mediaDir, { recursive: true });
    
    // Extract to temp location first
    const { getDecompress } = await import('./decompress-handler.js');
    const decompress = await getDecompress();
    const files = await decompress(tempZipPath, tempDir);
    
    // Move files to appropriate locations
    const results = {
      conversationsPath: null,
      mediaFiles: [],
      metadata: {
        originalFileCount: files.length,
        processedAt: new Date().toISOString(),
        sessionId
      }
    };
    
    for (const file of files) {
      const tempPath = path.join(tempDir, file.path);
      
      if (file.path.endsWith('conversations.json')) {
        // Move to raw directory
        const destPath = path.join(rawDir, 'conversations.json');
        await fs.rename(tempPath, destPath);
        results.conversationsPath = destPath;
      } else if (isMediaFile(file.path)) {
        // Organize media by type
        const mediaType = getMediaType(file.path);
        const typeDir = path.join(mediaDir, mediaType);
        await fs.mkdir(typeDir, { recursive: true });
        
        const destPath = path.join(typeDir, path.basename(file.path));
        await fs.rename(tempPath, destPath);
        results.mediaFiles.push({
          originalPath: file.path,
          finalPath: destPath,
          type: mediaType
        });
      } else {
        // Move other files to raw
        const destPath = path.join(rawDir, file.path);
        await ensureDir(path.dirname(destPath));
        await fs.rename(tempPath, destPath);
      }
    }
    
    // Save processing metadata
    const metadataPath = path.join(sessionDir, 'session.json');
    await fs.writeFile(metadataPath, JSON.stringify(results.metadata, null, 2));
    
    return results;
    
  } finally {
    // Always cleanup temp files
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Determines if file is a media file
 * @param {string} filePath - File path
 * @returns {boolean}
 */
function isMediaFile(filePath) {
  const mediaPatterns = [
    /^file-/,                    // ChatGPT file attachments
    /^audio\//,                  // Audio files
    /^dalle-generations\//,        // DALL-E images
    /\.(jpeg|jpg|png|gif|webp)$/i,  // Image extensions
    /\.(wav|mp3|m4a|ogg)$/i,        // Audio extensions
  ];
  
  return mediaPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Categorizes media file type
 * @param {string} filePath - File path
 * @returns {string} Media type category
 */
function getMediaType(filePath) {
  if (filePath.includes('audio/')) return 'audio';
  if (filePath.includes('dalle-generations/')) return 'dalle-generations';
  if (filePath.startsWith('file-')) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext)) {
      return 'images';
    }
  }
  return 'other';
}

module.exports = {
  createTempDir,
  cleanupTempDir,
  validateUpload,
  processUploadEnhanced,
  isMediaFile,
  getMediaType
};