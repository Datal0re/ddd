/*
 * Performance-optimized session processing
 * Implements streaming, progress tracking, and resource management
 */
const fs = require('fs').promises;
const path = require('path');
const { Transform } = require('stream');

/**
 * Processes large uploads with progress tracking
 * @param {Buffer|string} zipData - ZIP file data
 * @param {string} sessionId - Session identifier
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Processing results
 */
async function processUploadWithProgress(zipData, sessionId, onProgress) {
  const startTime = Date.now();
  let processedBytes = 0;
  let totalBytes = Buffer.isBuffer(zipData) ? zipData.length : 0;
  
  try {
    // Get total size for progress tracking
    if (!Buffer.isBuffer(zipData)) {
      const stats = await fs.stat(zipData);
      totalBytes = stats.size;
    }
    
    onProgress({ 
      stage: 'validating', 
      progress: 0, 
      message: 'Validating upload...' 
    });
    
    // Stream processing for large files
    const results = await processZipStream(zipData, sessionId, (bytes) => {
      processedBytes += bytes;
      const progress = Math.min((processedBytes / totalBytes) * 100, 100);
      
      onProgress({
        stage: 'processing',
        progress,
        message: `Processing... ${Math.round(progress)}%`,
        processedBytes,
        totalBytes,
        elapsed: Date.now() - startTime
      });
    });
    
    onProgress({ 
      stage: 'completed', 
      progress: 100, 
      message: 'Processing complete!',
      results
    });
    
    return results;
    
  } catch (error) {
    onProgress({ 
      stage: 'error', 
      progress: 0, 
      message: `Error: ${error.message}`,
      error 
    });
    throw error;
  }
}

/**
 * Memory-efficient ZIP processing with streams
 * @param {Buffer|string} zipData - ZIP data
 * @param {string} sessionId - Session ID
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function processZipStream(zipData, sessionId, onProgress) {
  const { createReadStream } = require('fs');
  const { pipeline } = require('stream/promises');
  const { getDecompress } = await import('./decompress-handler.js');
  
  return new Promise((resolve, reject) => {
    const results = {
      conversationsPath: null,
      mediaFiles: [],
      metadata: {
        sessionId,
        processedAt: new Date().toISOString(),
        fileCount: 0
      }
    };
    
    // Create processing streams
    let readStream;
    if (Buffer.isBuffer(zipData)) {
      readStream = new Readable({
        read() {
          this.push(zipData);
          this.push(null);
        }
      });
    } else {
      readStream = createReadStream(zipData);
    }
    
    // Process with decompress stream
    const decompress = getDecompress();
    const transform = new Transform({
      objectMode: true,
      transform(file, encoding, callback) {
        results.metadata.fileCount++;
        
        // Process file asynchronously to avoid blocking
        processFileAsync(file, sessionId)
          .then(result => {
            if (result.type === 'conversation') {
              results.conversationsPath = result.path;
            } else if (result.type === 'media') {
              results.mediaFiles.push(result);
            }
            callback();
          })
          .catch(callback);
      }
    });
    
    // Pipeline with error handling
    pipeline(
      readStream,
      decompress(),
      transform,
      async (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      }
    );
  });
}

/**
 * Asynchronous file processing to prevent blocking
 * @param {Object} file - File object from decompress
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>}
 */
async function processFileAsync(file, sessionId) {
  const baseDir = path.join(process.cwd(), 'data', 'sessions', sessionId);
  const sessionDir = path.join(baseDir, sessionId);
  
  if (file.path.endsWith('conversations.json')) {
    const destPath = path.join(sessionDir, 'raw', 'conversations.json');
    await ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, file.data);
    return { type: 'conversation', path: destPath };
  } else if (isMediaFile(file.path)) {
    const mediaType = getMediaType(file.path);
    const destPath = path.join(sessionDir, 'media', mediaType, path.basename(file.path));
    await ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, file.data);
    return { type: 'media', path: destPath, mediaType };
  }
  
  return { type: 'other', path: file.path };
}

module.exports = {
  processUploadWithProgress,
  processZipStream,
  processFileAsync
};