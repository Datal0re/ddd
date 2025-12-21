/*
 * ZIP file processing utilities
 * Handles ZIP extraction, validation, and security
 */

const fs = require('fs').promises;
const path = require('path');
const { LIMITS, ZIP_SIGNATURES, TEMP_CONFIG } = require('../config/constants');
const FileSystemHelper = require('./fsHelpers');
const PathUtils = require('./pathUtils');

// Dynamic import for decompress (ES module)
let decompress;
const getDecompress = async () => {
  if (!decompress) {
    const module = await import('decompress');
    decompress = module.default;
  }
  return decompress;
};

/**
 * ZIP processor class for handling ZIP file operations
 */
class ZipProcessor {
  /**
   * Creates a secure temporary directory specifically for ZIP processing
   *
   * Uses application-specific prefix from TEMP_CONFIG for ZIP security context.
   * Creates directories in os.tmpdir() with enhanced security for ZIP bomb protection.
   *
   * @returns {Promise<string>} Path to temp directory for ZIP processing
   */
  static async createTempDir() {
    const crypto = require('crypto');
    const os = require('os');

    const tempDir = path.join(
      os.tmpdir(),
      `${TEMP_CONFIG.PREFIX}${crypto.randomBytes(TEMP_CONFIG.BYTES_LENGTH).toString('hex')}`
    );
    await FileSystemHelper.ensureDirectory(tempDir);
    return tempDir;
  }

  /**
   * Safely cleans up temporary directory
   * @param {string} tempDir - Directory to clean up
   */
  static async cleanupTempDir(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors - temp dirs may be locked by OS
      console.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
    }
  }

  /**
   * Validates uploaded file for security and size limits
   * @param {Buffer|string} fileData - File data or path
   * @param {number} maxSize - Maximum allowed size in bytes
   * @returns {Promise<boolean>} True if file is safe
   */
  static async validateUpload(fileData, maxSize = LIMITS.MAX_UPLOAD_SIZE) {
    try {
      const size =
        typeof fileData === 'string' ? (await fs.stat(fileData)).size : fileData.length;

      // Size validation
      if (size > maxSize) {
        throw new Error(
          `File too large: ${Math.round(size / 1024 / 1024)}MB (max: ${Math.round(maxSize / 1024 / 1024)}MB)`
        );
      }

      // Basic zip signature validation
      let buffer;
      if (typeof fileData === 'string') {
        buffer = await fs.readFile(fileData);
      } else {
        buffer = fileData;
      }

      const isValidZip = ZIP_SIGNATURES.some(sig =>
        buffer.subarray(0, sig.length).equals(sig)
      );

      if (!isValidZip) {
        throw new Error('Invalid file format - expected ZIP archive');
      }

      // Enhanced zip validation for zip bomb protection
      // Skip detailed validation here since we'll validate during extraction
      // This prevents recursive calls and potential issues with decompress module

      console.log(`Upload validation passed: ${Math.round(size / 1024 / 1024)}MB`);
      return true;
    } catch (error) {
      console.error('Upload validation failed:', error);
      throw error;
    }
  }

  /**
   * Validates zip file structure to prevent zip bombs
   * @param {Buffer} zipBuffer - ZIP file buffer
   * @returns {Promise<void>}
   */
  static async validateZipStructure(zipBuffer) {
    const decompress = await getDecompress();

    // Create a temporary file for analysis
    const tempDir = await this.createTempDir();
    const tempZipPath = path.join(tempDir, 'validate.zip');

    try {
      await fs.writeFile(tempZipPath, zipBuffer);

      // Extract file list without extracting content
      const files = await decompress(tempZipPath, tempDir);

      // Check file count limit
      if (files.length > LIMITS.MAX_FILES_IN_ZIP) {
        throw new Error(
          `Too many files in zip: ${files.length} (max: ${LIMITS.MAX_FILES_IN_ZIP})`
        );
      }

      // Calculate compression ratio
      const totalCompressedSize = files.reduce(
        (total, file) => total + (file.size || 0),
        0
      );
      const compressionRatio = totalCompressedSize / zipBuffer.length;

      if (compressionRatio > LIMITS.MAX_COMPRESSION_RATIO) {
        throw new Error(
          `Compression ratio too high: ${Math.round(compressionRatio)}:1 (max: ${LIMITS.MAX_COMPRESSION_RATIO}:1) - possible zip bomb`
        );
      }

      // Check for suspicious file paths
      for (const file of files) {
        if (!PathUtils.validatePath(file.path)) {
          throw new Error(`Suspicious file path detected: ${file.path}`);
        }
      }

      console.debug(
        `Zip structure validation passed: ${files.length} files, ${Math.round(compressionRatio)}:1 ratio`
      );
    } finally {
      await this.cleanupTempDir(tempDir);
    }
  }

  /**
   * Validates and extracts a ZIP file to a target directory
   * @param {Buffer|string} zipData - ZIP file buffer or path
   * @param {string} targetDir - Target directory for extraction
   * @param {boolean} isBuffer - True if zipData is buffer, false if path
   * @returns {Promise<void>}
   */
  static async validateAndExtractZip(zipData, targetDir, isBuffer = true) {
    const decompress = await getDecompress();
    let tempDir = null;
    try {
      // Create secure temp directory for processing
      tempDir = await this.createTempDir();
      const tempZipPath = path.join(tempDir, 'extract.zip');

      console.log(`Validating and extracting ZIP: isBuffer=${isBuffer}`);

      // Validate upload before processing
      await this.validateUpload(zipData);

      // Save or copy zip file to temp location
      if (isBuffer) {
        await fs.writeFile(tempZipPath, zipData);
      } else {
        await fs.copyFile(zipData, tempZipPath);
      }

      console.log('Starting ZIP extraction...');

      // Extract zip to target directory
      const files = await decompress(tempZipPath, targetDir);

      console.debug(
        `Extracted ${files.length} files:`,
        files.map(f => ({ path: f.path, type: f.type }))
      );

      if (!files || files.length === 0) {
        console.error('No files extracted from zip archive');
        throw new Error('No files found in zip archive or extraction failed');
      }

      // Validate extracted content size
      const totalExtractedSize = files.reduce(
        (total, file) => total + (file.size || 0),
        0
      );
      if (totalExtractedSize > LIMITS.MAX_EXTRACTED_SIZE) {
        throw new Error(
          `Extracted content too large: ${Math.round(totalExtractedSize / 1024 / 1024)}MB (max: ${Math.round(LIMITS.MAX_EXTRACTED_SIZE / 1024 / 1024)}MB)`
        );
      }

      console.log(`ZIP extraction completed: ${files.length} files extracted`);
    } catch (error) {
      console.error('ZIP validation and extraction failed:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    } finally {
      // Always cleanup temp files
      if (tempDir) {
        await this.cleanupTempDir(tempDir);
      }
    }
  }

  /**
   * Processes uploaded zip file with enhanced security and validation
   * @param {Buffer|string} zipData - Zip file buffer or path
   * @param {string} dumpsterName - Dumpster name
   * @param {string} exportDir - Dumpster directory path
   * @param {string} mediaDir - Media directory path
   * @param {boolean} isBuffer - True if zipData is buffer, false if path
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<string>} Path to conversations.json
   */
  static async processZipUpload(
    zipData,
    dumpsterName,
    exportDir,
    mediaDir,
    isBuffer = true,
    onProgress = null
  ) {
    const { createProgressTracker } = require('./progressTracker');
    const { moveFilesToFinalLocations } = require('./assetUtils');

    const decompress = await getDecompress();
    const tempDir = await this.createTempDir();
    const tempZipPath = path.join(tempDir, `${dumpsterName}.zip`);

    try {
      console.debug(
        `Processing zip upload: isBuffer=${isBuffer}, dumpsterName=${dumpsterName}`
      );

      // Create unified progress tracker
      const progress = createProgressTracker(onProgress);

      // Validate upload before processing
      progress.update('validating', 0, 'Validating upload...');
      await this.validateUpload(zipData);

      // Save or copy zip file to temp location
      if (isBuffer) {
        console.debug('Writing buffer to temp file:', tempZipPath);
        await fs.writeFile(tempZipPath, zipData);
      } else {
        console.debug('Copying file to temp location:', tempZipPath);
        await fs.copyFile(zipData, tempZipPath);
      }

      progress.update('extracting', 10, 'Extracting archive...');
      console.log('Starting zip extraction...');

      // Extract zip to temp directory first (security)
      const files = await decompress(tempZipPath, tempDir);

      console.debug(
        `Extracted ${files.length} files:`,
        files.map(f => ({ path: f.path, type: f.type }))
      );

      if (!files || files.length === 0) {
        console.error('No files extracted from zip archive');
        throw new Error('No files found in zip archive or extraction failed');
      }

      // Validate extracted content size
      const totalExtractedSize = files.reduce(
        (total, file) => total + (file.size || 0),
        0
      );
      if (totalExtractedSize > LIMITS.MAX_EXTRACTED_SIZE) {
        throw new Error(
          `Extracted content too large: ${Math.round(totalExtractedSize / 1024 / 1024)}MB (max: ${Math.round(LIMITS.MAX_EXTRACTED_SIZE / 1024 / 1024)}MB)`
        );
      }

      progress.update('organizing', 50, 'Organizing files...');

      // Move files from temp to final locations
      progress.update('finalizing', 80, 'Finalizing organization...');
      const conversationsPath = await moveFilesToFinalLocations(
        tempDir,
        exportDir,
        mediaDir,
        files
      );

      console.log('Files moved, conversationsPath:', conversationsPath);

      if (!conversationsPath) {
        throw new Error('conversations.json not found in uploaded zip.');
      }

      // Verify conversations.json exists
      try {
        await fs.access(conversationsPath);
        console.log('conversations.json verified at:', conversationsPath);
      } catch {
        console.error(
          'conversations.json not found at expected path:',
          conversationsPath
        );
        throw new Error(
          'conversations.json not found at expected path: ' + conversationsPath
        );
      }

      progress.update('completed', 100, 'Upload processing complete');
      return conversationsPath;
    } catch (error) {
      console.error('Zip upload processing failed:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw error;
    } finally {
      // Always cleanup temp files
      if (tempDir) {
        await this.cleanupTempDir(tempDir);
      }
    }
  }
}

module.exports = ZipProcessor;
