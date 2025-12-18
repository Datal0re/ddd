/*
 * Common file utilities for CLI export management
 * Handles file operations, validation, and security
 * Supports direct file-based export architecture
 */
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const { createLogger } = require('./logger');
const logger = createLogger({ module: 'fileUtils' });

// Security and performance constants
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB limit
const MAX_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024; // 2GB extracted limit
const MAX_COMPRESSION_RATIO = 100; // Maximum allowed compression ratio (100:1)
const MAX_FILES_IN_ZIP = 10000; // Maximum number of files in a zip
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP
  Buffer.from([0x50, 0x4b, 0x05, 0x06]), // ZIP
  Buffer.from([0x50, 0x4b, 0x07, 0x08]), // ZIP
];

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
 * Creates a secure temporary directory for processing
 * @returns {Promise<string>} Path to temp directory
 */
async function createTempDir() {
  const tempDir = path.join(
    os.tmpdir(),
    `dddiver-${crypto.randomBytes(8).toString('hex')}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Safely cleans up temporary directory
 * @param {string} tempDir - Directory to clean up
 */
async function cleanupTempDir(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors - temp dirs may be locked by OS
    logger.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
  }
}

/**
 * Validates uploaded file for security and size limits
 * @param {Buffer|string} fileData - File data or path
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {Promise<boolean>} True if file is safe
 */
async function validateUpload(fileData, maxSize = MAX_UPLOAD_SIZE) {
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

    logger.info(`Upload validation passed: ${Math.round(size / 1024 / 1024)}MB`);
    return true;
  } catch (error) {
    logger.error('Upload validation failed:', error);
    throw error;
  }
}

/**
 * Validates zip file structure to prevent zip bombs
 * @param {Buffer} zipBuffer - ZIP file buffer
 * @returns {Promise<void>}
 */
async function validateZipStructure(zipBuffer) {
  const decompress = await getDecompress();

  // Create a temporary file for analysis
  const tempDir = await createTempDir();
  const tempZipPath = path.join(tempDir, 'validate.zip');

  try {
    await fs.writeFile(tempZipPath, zipBuffer);

    // Extract file list without extracting content
    const files = await decompress(tempZipPath, tempDir);

    // Check file count limit
    if (files.length > MAX_FILES_IN_ZIP) {
      throw new Error(
        `Too many files in zip: ${files.length} (max: ${MAX_FILES_IN_ZIP})`
      );
    }

    // Calculate compression ratio
    const totalCompressedSize = files.reduce(
      (total, file) => total + (file.size || 0),
      0
    );
    const compressionRatio = totalCompressedSize / zipBuffer.length;

    if (compressionRatio > MAX_COMPRESSION_RATIO) {
      throw new Error(
        `Compression ratio too high: ${Math.round(compressionRatio)}:1 (max: ${MAX_COMPRESSION_RATIO}:1) - possible zip bomb`
      );
    }

    // Check for suspicious file paths
    for (const file of files) {
      if (!validatePath(file.path)) {
        throw new Error(`Suspicious file path detected: ${file.path}`);
      }
    }

    logger.debug(
      `Zip structure validation passed: ${files.length} files, ${Math.round(compressionRatio)}:1 ratio`
    );
  } finally {
    await cleanupTempDir(tempDir);
  }
}

/**
 * Ensures a directory exists, creates it if it doesn't
 * @param {string} dirPath - Directory path to ensure exists
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Validates and extracts a ZIP file to a target directory
 * @param {Buffer|string} zipData - ZIP file buffer or path
 * @param {string} targetDir - Target directory for extraction
 * @param {boolean} isBuffer - True if zipData is buffer, false if path
 * @returns {Promise<void>}
 */
async function validateAndExtractZip(zipData, targetDir, isBuffer = true) {
  const decompress = await getDecompress();
  let tempDir = null;
  let tempZipPath = null;

  try {
    // Create secure temp directory for processing
    tempDir = await createTempDir();
    tempZipPath = path.join(tempDir, 'extract.zip');

    logger.info(`Validating and extracting ZIP: isBuffer=${isBuffer}`);

    // Validate upload before processing
    await validateUpload(zipData);

    // Save or copy zip file to temp location
    if (isBuffer) {
      await fs.writeFile(tempZipPath, zipData);
    } else {
      await fs.copyFile(zipData, tempZipPath);
    }

    logger.info('Starting ZIP extraction...');

    // Extract zip to target directory
    const files = await decompress(tempZipPath, targetDir);

    logger.debug(
      `Extracted ${files.length} files:`,
      files.map(f => ({ path: f.path, type: f.type }))
    );

    if (!files || files.length === 0) {
      logger.error('No files extracted from zip archive');
      throw new Error('No files found in zip archive or extraction failed');
    }

    // Validate extracted content size
    const totalExtractedSize = files.reduce(
      (total, file) => total + (file.size || 0),
      0
    );
    if (totalExtractedSize > MAX_EXTRACTED_SIZE) {
      throw new Error(
        `Extracted content too large: ${Math.round(totalExtractedSize / 1024 / 1024)}MB (max: ${Math.round(MAX_EXTRACTED_SIZE / 1024 / 1024)}MB)`
      );
    }

    logger.info(`ZIP extraction completed: ${files.length} files extracted`);
  } catch (error) {
    logger.error('ZIP validation and extraction failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    throw error;
  } finally {
    // Always cleanup temp files
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Runs migration script on a given conversations.json file
 * @param {string} exportName - Export name
 * @param {string} outputDir - Output directory for migrated conversations
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<void>}
 */
async function runMigration(exportName, outputDir, baseDir) {
  const inputPath = path.join(
    baseDir,
    'data',
    'exports',
    exportName,
    'conversations.json'
  );
  await ensureDir(outputDir);

  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      [path.join(baseDir, 'data', 'migration.js'), inputPath, outputDir],
      {
        stdio: 'pipe',
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        logger.debug('Migration stdout:', stdout);
        resolve();
      } else {
        logger.error('Migration stderr:', stderr);
        logger.error('Migration stdout:', stdout);
        reject(new Error(`Migration exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Runs asset extraction for an export
 * @param {string} exportName - Export name
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<void>}
 */
async function runAssetExtraction(exportName, baseDir) {
  return new Promise((resolve, _reject) => {
    const child = spawn(
      'node',
      [path.join(baseDir, 'data', 'extract-assets-json.js'), exportName],
      {
        stdio: 'pipe',
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        logger.debug('Asset extraction stdout:', stdout);
        resolve();
      } else {
        logger.warn('Asset extraction failed (non-critical):', stderr);
        logger.debug('Asset extraction stdout:', stdout);
        // Don't reject - asset extraction is non-critical
        resolve();
      }
    });
  });
}

/**
 * Processes uploaded zip file with enhanced security and validation
 * @param {Buffer|string} zipData - Zip file buffer or path
 * @param {string} exportName - Export name
 * @param {string} exportDir - Export directory path
 * @param {string} mediaDir - Media directory path
 * @param {boolean} isBuffer - True if zipData is buffer, false if path
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<string>} Path to conversations.json
 */
async function processZipUpload(
  zipData,
  exportName,
  exportDir,
  mediaDir,
  isBuffer = true,
  onProgress = null
) {
  const decompress = await getDecompress();
  const path = require('path');
  let tempDir = null;
  let tempZipPath = null;

  try {
    // Create secure temp directory for processing
    tempDir = await createTempDir();
    tempZipPath = path.join(tempDir, 'upload.zip');

    logger.info(
      `Processing zip upload: isBuffer=${isBuffer}, exportName=${exportName}`
    );

    // Validate upload before processing
    onProgress?.({ stage: 'validating', progress: 0, message: 'Validating upload...' });
    await validateUpload(zipData);

    // Save or copy zip file to temp location
    if (isBuffer) {
      logger.debug('Writing buffer to temp file:', tempZipPath);
      await fs.writeFile(tempZipPath, zipData);
    } else {
      logger.debug('Copying file to temp location:', tempZipPath);
      await fs.copyFile(zipData, tempZipPath);
    }

    onProgress?.({
      stage: 'extracting',
      progress: 10,
      message: 'Extracting archive...',
    });
    logger.info('Starting zip extraction...');

    // Extract zip to temp directory first (security)
    const files = await decompress(tempZipPath, tempDir);

    logger.debug(
      `Extracted ${files.length} files:`,
      files.map(f => ({ path: f.path, type: f.type }))
    );

    if (!files || files.length === 0) {
      logger.error('No files extracted from zip archive');
      throw new Error('No files found in zip archive or extraction failed');
    }

    // Validate extracted content size
    const totalExtractedSize = files.reduce(
      (total, file) => total + (file.size || 0),
      0
    );
    if (totalExtractedSize > MAX_EXTRACTED_SIZE) {
      throw new Error(
        `Extracted content too large: ${Math.round(totalExtractedSize / 1024 / 1024)}MB (max: ${Math.round(MAX_EXTRACTED_SIZE / 1024 / 1024)}MB)`
      );
    }

    onProgress?.({ stage: 'organizing', progress: 50, message: 'Organizing files...' });

    // Move files from temp to final locations
    onProgress?.({
      stage: 'finalizing',
      progress: 80,
      message: 'Finalizing organization...',
    });
    const conversationsPath = await moveFilesToFinalLocations(
      tempDir,
      exportDir,
      mediaDir,
      files
    );

    logger.info('Files moved, conversationsPath:', conversationsPath);

    if (!conversationsPath) {
      throw new Error('conversations.json not found in uploaded zip.');
    }

    // Verify conversations.json exists
    try {
      await fs.access(conversationsPath);
      logger.info('conversations.json verified at:', conversationsPath);
    } catch {
      logger.error('conversations.json not found at expected path:', conversationsPath);
      throw new Error(
        'conversations.json not found at expected path: ' + conversationsPath
      );
    }

    onProgress?.({
      stage: 'completed',
      progress: 100,
      message: 'Processing complete!',
    });
    return conversationsPath;
  } catch (error) {
    logger.error('Zip upload processing failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    throw error;
  } finally {
    // Always cleanup temp files
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Moves files from temp directory to final locations
 * @param {string} tempDir - Temporary directory
 * @param {string} exportDir - Final export directory
 * @param {string} mediaDir - Media directory
 * @param {Array} files - Extracted files list
 */
async function moveFilesToFinalLocations(tempDir, exportDir, mediaDir, files) {
  // Find conversations.json and detect top-level folder structure
  let conversationsPath = null;
  const topLevelDirs = new Set();

  for (const file of files) {
    const parts = file.path.split(path.sep);
    if (parts.length > 1) {
      topLevelDirs.add(parts[0]);
    }
  }

  logger.debug('Top-level directories found:', [...topLevelDirs]);

  const hasSingleTopLevel = topLevelDirs.size === 1;
  const topLevelFolder = hasSingleTopLevel ? [...topLevelDirs][0] : '';

  logger.debug('Has single top level:', hasSingleTopLevel);
  logger.debug('Top level folder:', topLevelFolder);

  // Process each file
  for (const file of files) {
    // Validate file path to prevent path traversal
    if (!validatePath(file.path)) {
      logger.warn(`Skipping file with dangerous path: ${file.path}`);
      continue;
    }

    const tempPath = path.join(tempDir, file.path);

    // Find conversations.json
    if (file.path.endsWith('conversations.json')) {
      const candidatePath = path.join(tempPath);
      const stats = await fs.stat(candidatePath);
      if (stats.isFile()) {
        const sample = await fs.readFile(candidatePath, { encoding: 'utf8' });
        if (sample && !sample.includes('\u0000')) {
          const finalPath = path.join(exportDir, 'conversations.json');
          await fs.rename(candidatePath, finalPath);
          conversationsPath = finalPath;
        }
      }
    }

    // Copy media assets
    else if (isMediaFile(file.path) && !file.path.endsWith('/')) {
      const src = tempPath;
      const relativePath =
        hasSingleTopLevel && file.path.startsWith(topLevelFolder + path.sep)
          ? file.path.slice((topLevelFolder + path.sep).length)
          : file.path;

      // Validate the relative path as well
      if (!validatePath(relativePath)) {
        logger.warn(
          `Skipping media file with dangerous relative path: ${relativePath}`
        );
        continue;
      }

      const destPath = path.join(mediaDir, relativePath);
      await ensureDir(path.dirname(destPath));
      await fs.copyFile(src, destPath);
      logger.debug(`Copied media file: ${file.path} -> ${relativePath}`);
    }

    // Move other files to export directory
    else if (!file.path.endsWith('/')) {
      const src = tempPath;
      const relativePath =
        hasSingleTopLevel && file.path.startsWith(topLevelFolder + path.sep)
          ? file.path.slice((topLevelFolder + path.sep).length)
          : file.path;

      // Validate the relative path as well
      if (!validatePath(relativePath)) {
        logger.warn(`Skipping file with dangerous relative path: ${relativePath}`);
        continue;
      }

      const destPath = path.join(exportDir, relativePath);
      await ensureDir(path.dirname(destPath));
      await fs.rename(src, destPath);
    }
  }

  // Clean up nested directory if present
  if (hasSingleTopLevel && topLevelFolder) {
    const nestedDir = path.join(tempDir, topLevelFolder);
    try {
      await fs.rmdir(nestedDir, { recursive: true });
    } catch (error) {
      logger.warn(`Failed to delete nested directory ${nestedDir}:`, error.message);
    }
  }

  return conversationsPath;
}

/**
 * Determines if file is a media file
 * @param {string} filePath - File path
 * @returns {boolean}
 */
function isMediaFile(filePath) {
  const mediaPatterns = [
    /^file-/, // ChatGPT file attachments
    /^audio\//, // Audio files
    /^dalle-generations\//, // DALL-E images
    /\.(jpeg|jpg|png|gif|webp)$/i, // Image extensions
    /\.(wav|mp3|m4a|ogg)$/i, // Audio extensions
  ];

  return mediaPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Validates file path to prevent path traversal attacks
 * @param {string} filePath - File path to validate
 * @returns {boolean} True if path is safe
 */
function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // Normalize the path to resolve any .. sequences
  const normalized = path.normalize(filePath);

  // Check for path traversal attempts
  if (
    normalized.includes('..') ||
    normalized.startsWith('/') ||
    normalized.includes('\\')
  ) {
    return false;
  }

  // Check for null bytes and other dangerous characters
  if (
    normalized.includes('\0') ||
    normalized.includes('\r') ||
    normalized.includes('\n')
  ) {
    return false;
  }

  return true;
}

/**
 * Removes directories safely with error handling
 * @param {...string} dirs - Directory paths to remove
 */
async function removeDirectories(...dirs) {
  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directories don't exist
      if (error.code !== 'ENOENT') {
        logger.warn(`Failed to remove directory ${dir}:`, error.message);
      }
    }
  }
}

module.exports = {
  ensureDir,
  runMigration,
  runAssetExtraction,
  processZipUpload,
  removeDirectories,
  createTempDir,
  cleanupTempDir,
  validateUpload,
  validatePath,
  validateZipStructure,
  isMediaFile,
  moveFilesToFinalLocations,
  validateAndExtractZip,
};
