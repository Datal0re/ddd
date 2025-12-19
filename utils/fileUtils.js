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
    console.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
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

    console.debug(
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
  try {
    // Create secure temp directory for processing
    tempDir = await createTempDir();
    const tempZipPath = path.join(tempDir, 'extract.zip');

    console.log(`Validating and extracting ZIP: isBuffer=${isBuffer}`);

    // Validate upload before processing
    await validateUpload(zipData);

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
    if (totalExtractedSize > MAX_EXTRACTED_SIZE) {
      throw new Error(
        `Extracted content too large: ${Math.round(totalExtractedSize / 1024 / 1024)}MB (max: ${Math.round(MAX_EXTRACTED_SIZE / 1024 / 1024)}MB)`
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
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Runs dump script on a given conversations.json file
 * @param {string} dumpsterName - Dumpster name
 * @param {string} outputDir - Output directory for dumped conversations
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<void>}
 */
async function runDump(dumpsterName, outputDir, baseDir) {
  const inputPath = path.join(
    baseDir,
    'data',
    'dumpsters',
    dumpsterName,
    'conversations.json'
  );
  await ensureDir(outputDir);

  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      [path.join(baseDir, 'data', 'dump.js'), inputPath, outputDir],
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
        console.debug('Dump stdout:', stdout);
        resolve();
      } else {
        console.error('Dump stderr:', stderr);
        console.error('Dump stdout:', stdout);
        reject(new Error(`Dump exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Runs asset extraction for an export
 * @param {string} dumpsterName - Dumpster name
 * @param {string} baseDir - Base directory of the application
 * @returns {Promise<void>}
 */
async function runAssetExtraction(dumpsterName, baseDir) {
  return new Promise((resolve, _reject) => {
    const child = spawn(
      'node',
      [path.join(baseDir, 'data', 'extract-assets.js'), dumpsterName],
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
        console.debug('Asset extraction stdout:', stdout);
        resolve();
      } else {
        console.warn('Asset extraction failed (non-critical):', stderr);
        console.debug('Asset extraction stdout:', stdout);
        // Don't reject - asset extraction is non-critical
        resolve();
      }
    });
  });
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
async function processZipUpload(
  zipData,
  dumpsterName,
  exportDir,
  mediaDir,
  isBuffer = true,
  onProgress = null
) {
  const decompress = await getDecompress();
  const tempDir = await createTempDir();
  const tempZipPath = path.join(tempDir, `${dumpsterName}.zip`);

  try {
    console.debug(
      `Processing zip upload: isBuffer=${isBuffer}, dumpsterName=${dumpsterName}`
    );

    // Create unified progress tracker
    const progress = createProgressTracker(onProgress);

    // Validate upload before processing
    progress.validating(0, 'Validating upload...');
    await validateUpload(zipData);

    // Save or copy zip file to temp location
    if (isBuffer) {
      console.debug('Writing buffer to temp file:', tempZipPath);
      await fs.writeFile(tempZipPath, zipData);
    } else {
      console.debug('Copying file to temp location:', tempZipPath);
      await fs.copyFile(zipData, tempZipPath);
    }

    progress.extracting(10, 'Extracting archive...');
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
    if (totalExtractedSize > MAX_EXTRACTED_SIZE) {
      throw new Error(
        `Extracted content too large: ${Math.round(totalExtractedSize / 1024 / 1024)}MB (max: ${Math.round(MAX_EXTRACTED_SIZE / 1024 / 1024)}MB)`
      );
    }

    progress.organizing(50, 'Organizing files...');

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

    progress.completed('Upload processing complete');
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

  console.debug('Top-level directories found:', [...topLevelDirs]);

  const hasSingleTopLevel = topLevelDirs.size === 1;
  const topLevelFolder = hasSingleTopLevel ? [...topLevelDirs][0] : '';

  console.debug('Has single top level:', hasSingleTopLevel);
  console.debug('Top level folder:', topLevelFolder);

  // Process each file
  for (const file of files) {
    // Validate file path to prevent path traversal
    if (!validatePath(file.path)) {
      console.warn(`Skipping file with dangerous path: ${file.path}`);
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
        console.warn(
          `Skipping media file with dangerous relative path: ${relativePath}`
        );
        continue;
      }

      const destPath = path.join(mediaDir, relativePath);
      await ensureDir(path.dirname(destPath));
      await fs.copyFile(src, destPath);
      console.debug(`Copied media file: ${file.path} -> ${relativePath}`);
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
        console.warn(`Skipping file with dangerous relative path: ${relativePath}`);
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
      console.warn(`Failed to delete nested directory ${nestedDir}:`, error.message);
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
        console.warn(`Failed to remove directory ${dir}:`, error.message);
      }
    }
  }
}

/**
 * Unified CLI argument parser for common options
 * @param {Object} config - Configuration for argument parsing
 * @param {Array} config.args - Arguments array (default: process.argv.slice(2))
 * @param {Object} config.defaults - Default options
 * @param {Array} config.flags - Array of flag definitions {name, flag, description}
 * @param {Array} config.positional - Array of positional argument names
 * @returns {Object} Parsed options object
 */
function parseCLIArguments(argsOrConfig = []) {
  // Allow both parseCLIArguments(args, config) and parseCLIArguments(config)
  let args, config;
  if (Array.isArray(argsOrConfig)) {
    args = argsOrConfig;
    config = arguments[1] || {};
  } else {
    args = process.argv.slice(2);
    config = argsOrConfig;
  }

  const { defaults = {}, flags = [], positional = [] } = config;

  const options = { ...defaults };
  let positionalIndex = 0;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check if it's a flag
    const flagConfig = flags.find(f => f.flag === arg);
    if (flagConfig) {
      if (flagConfig.type === 'boolean') {
        options[flagConfig.name] = true;
      } else if (flagConfig.type === 'string' && i + 1 < args.length) {
        options[flagConfig.name] = args[++i];
      }
      continue;
    }

    // Handle special flags that aren't in config
    if (arg === '--help') {
      options.help = true;
      continue;
    }

    // Handle positional arguments
    if (positionalIndex < positional.length) {
      options[positional[positionalIndex]] = arg;
      positionalIndex++;
    }
  }

  return options;
}

/**
 * Common flag definitions for reuse across scripts
 */
const COMMON_FLAGS = {
  preserve: {
    name: 'preserveOriginal',
    flag: '--preserve',
    type: 'boolean',
    description: 'Keep original file after processing',
  },
  overwrite: {
    name: 'overwrite',
    flag: '--overwrite',
    type: 'boolean',
    description: 'Overwrite existing files',
  },
  verbose: {
    name: 'verbose',
    flag: '--verbose',
    type: 'boolean',
    description: 'Enable verbose logging',
  },
  help: {
    name: 'help',
    flag: '--help',
    type: 'boolean',
    description: 'Show help message',
  },
};

/**
 * Generate help text from configuration
 * @param {Object} config - Configuration object
 * @param {string} config.usage - Usage string
 * @param {Array} config.positional - Positional arguments array
 * @param {Array} config.flags - Flags array
 * @param {Array} config.examples - Examples array
 * @returns {string} Formatted help text
 */
function generateHelpText(config = {}) {
  const { usage = '', positional = [], flags = [], examples = [] } = config;

  let helpText = `\nUsage: ${usage}\n\n`;

  if (positional.length > 0) {
    helpText += 'Arguments:\n';
    positional.forEach(arg => {
      helpText += `  ${arg.padEnd(15)} Description for ${arg}\n`;
    });
    helpText += '\n';
  }

  if (flags.length > 0) {
    helpText += 'Options:\n';
    flags.forEach(flag => {
      const line = `  ${flag.flag.padEnd(15)} ${flag.description}`;
      helpText += line + '\n';
    });
    helpText += '\n';
  }

  if (examples.length > 0) {
    helpText += 'Examples:\n';
    examples.forEach(example => {
      helpText += `  ${example}\n`;
    });
  }

  return helpText;
}

/**
 * Unified progress callback utility
 * @param {Function} userCallback - User-provided progress callback (optional)
 * @param {boolean} verbose - Whether to log to console (optional)
 * @returns {Function} Standardized progress callback function
 */
function createProgressCallback(userCallback = null, verbose = false) {
  return (stage, progress, message) => {
    const progressData = { stage, progress, message };

    // Call user callback if provided
    if (userCallback) {
      userCallback(progressData);
    }

    // Log to console if verbose
    if (verbose) {
      console.log(`${stage}: ${progress}% - ${message}`);
    }
  };
}

/**
 * Standard progress stages for consistency
 */
const PROGRESS_STAGES = {
  INITIALIZING: 'initializing',
  EXTRACTING: 'extracting',
  DUMPING: 'dumping',
  EXTRACTING_ASSETS: 'extracting-assets',
  ORGANIZING: 'organizing',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
};

/**
 * Create a progress tracker with automatic percentage calculation
 * @param {Function} userCallback - User-provided progress callback
 * @param {boolean} verbose - Whether to log to console
 * @returns {Object} Progress tracker with update method
 */
function createProgressTracker(userCallback = null, verbose = false) {
  const callback = createProgressCallback(userCallback, verbose);

  return {
    /**
     * Update progress with automatic stage management
     * @param {string} stage - Current stage
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} message - Progress message
     */
    update: (stage, percentage, message) => {
      callback(stage, percentage, message);
    },

    /**
     * Convenience methods for common stages
     */
    initializing: message => callback(PROGRESS_STAGES.INITIALIZING, 0, message),
    extracting: (percentage, message) =>
      callback(PROGRESS_STAGES.EXTRACTING, percentage, message),
    dumping: (percentage, message) =>
      callback(PROGRESS_STAGES.DUMPING, percentage, message),
    extractingAssets: (percentage, message) =>
      callback(PROGRESS_STAGES.EXTRACTING_ASSETS, percentage, message),
    organizing: (percentage, message) =>
      callback(PROGRESS_STAGES.ORGANIZING, percentage, message),
    validating: (percentage, message) =>
      callback(PROGRESS_STAGES.VALIDATING, percentage, message),
    completed: message => callback(PROGRESS_STAGES.COMPLETED, 100, message),
  };
}

/**
 * Unified file search utility with multiple filtering options
 * @param {string} dir - Directory to search in
 * @param {Object} options - Search options
 * @param {boolean} options.recursive - Search subdirectories recursively (default: false)
 * @param {Function} options.filter - Filter function (filename, fullPath, stats) => boolean
 * @param {string} options.pattern - Regex pattern to match filenames against
 * @param {string} options.extension - File extension to match (e.g., '.js', '.json')
 * @param {string} options.prefix - Filename prefix to match
 * @param {boolean} options.includeDirs - Include directories in results (default: false)
 * @param {number} options.maxDepth - Maximum recursion depth (default: unlimited)
 * @returns {Promise<Array>} Array of matching file paths
 */
async function findFiles(dir, options = {}) {
  const {
    recursive = false,
    filter = null,
    pattern = null,
    extension = null,
    prefix = null,
    includeDirs = false,
    maxDepth = Infinity,
  } = options;

  if (!dir || typeof dir !== 'string') {
    throw new Error('Directory path is required and must be a string');
  }

  const results = [];

  async function traverse(currentPath, currentDepth = 0) {
    try {
      // Check depth limit
      if (currentDepth > maxDepth) {
        return;
      }

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const stats = await fs.stat(fullPath);

        // Apply filters
        let include = true;

        if (filter && typeof filter === 'function') {
          include = filter(entry.name, fullPath, stats);
        }

        if (pattern) {
          include = include && new RegExp(pattern).test(entry.name);
        }

        if (extension) {
          include = include && entry.name.endsWith(extension);
        }

        if (prefix) {
          include = include && entry.name.startsWith(prefix);
        }

        // Add to results if included
        if (include) {
          if (stats.isFile() || includeDirs) {
            results.push(fullPath);
          }
        }

        // Recurse into subdirectories if enabled
        if (recursive && stats.isDirectory() && currentDepth < maxDepth) {
          await traverse(fullPath, currentDepth + 1);
        }
      }
    } catch (error) {
      console.warn(`Error accessing directory ${currentPath}: ${error.message}`);
    }
  }

  await traverse(dir);
  return results;
}

/**
 * Convenience function for finding files by extension
 * @param {string} dir - Directory to search
 * @param {string} extension - File extension (e.g., '.html', '.json')
 * @param {boolean} recursive - Search recursively (default: false)
 * @returns {Promise<Array>} Array of matching file paths
 */
async function findFilesByExtension(dir, extension, recursive = false) {
  return findFiles(dir, {
    recursive,
    extension: extension.startsWith('.') ? extension : `.${extension}`,
  });
}

/**
 * Convenience function for finding files by name pattern
 * @param {string} dir - Directory to search
 * @param {string} prefix - Filename prefix to match
 * @param {boolean} recursive - Search recursively (default: true)
 * @returns {Promise<Array>} Array of matching file paths
 */
async function findFilesByPrefix(dir, prefix, recursive = true) {
  return findFiles(dir, {
    recursive,
    prefix,
  });
}

/**
 * Convenience function for finding files by regex pattern
 * @param {string} dir - Directory to search
 * @param {string|RegExp} pattern - Regex pattern to match
 * @param {boolean} recursive - Search recursively (default: false)
 * @returns {Promise<Array>} Array of matching file paths
 */
async function findFilesByPattern(dir, pattern, recursive = false) {
  return findFiles(dir, {
    recursive,
    pattern: typeof pattern === 'string' ? pattern : pattern.source,
  });
}

/**
 * Unified name sanitization function for different use cases
 * @param {string} name - Name to sanitize
 * @param {Object} options - Sanitization options
 * @param {string} options.type - Type of sanitization: 'dumpster', 'export', 'filename'
 * @param {number} options.maxLength - Maximum length (default varies by type)
 * @param {string} options.caseTransform - Case transformation: 'lower', 'upper', 'none' (default varies by type)
 * @param {string} options.spaceReplacement - What to replace spaces with (default varies by type)
 * @returns {string} Sanitized name
 */
function sanitizeName(name, options = {}) {
  const {
    type = 'dumpster',
    maxLength = type === 'dumpster' ? 50 : type === 'export' ? 50 : 100,
    caseTransform = type === 'dumpster' ? 'lower' : 'none',
    spaceReplacement = type === 'dumpster' ? '_' : type === 'export' ? ' ' : '_',
    allowPrefixNumbers = type !== 'dumpster',
  } = options;

  let sanitized = name;

  if (type === 'dumpster') {
    // Strict alphanumeric + underscore + dash only
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Ensure starts with letter (if not allowed to start with numbers)
    if (!allowPrefixNumbers) {
      sanitized = sanitized.replace(/^[^a-zA-Z]/, '_');
    }
  } else if (type === 'export') {
    // Replace filesystem-invalid characters with dash
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '-');
  } else {
    // Remove characters not suitable for filenames
    sanitized = sanitized.replace(/[^\w\s-]/g, '');
  }

  // Replace multiple spaces with single space replacement
  sanitized = sanitized.replace(/\s+/g, spaceReplacement);

  // Remove leading/trailing whitespace/space replacement
  sanitized = sanitized.trim();

  // Limit length
  sanitized = sanitized.substring(0, maxLength);

  // Case transformation
  if (caseTransform === 'lower') {
    sanitized = sanitized.toLowerCase();
  } else if (caseTransform === 'upper') {
    sanitized = sanitized.toUpperCase();
  }

  // Ensure it's not empty
  if (sanitized.length === 0) {
    return type === 'dumpster'
      ? 'untitled_dumpster'
      : type === 'export'
        ? 'untitled_export'
        : 'untitled';
  }

  return sanitized;
}

module.exports = {
  ensureDir,
  runDump,
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
  sanitizeName,
  parseCLIArguments,
  COMMON_FLAGS,
  generateHelpText,
  createProgressCallback,
  createProgressTracker,
  PROGRESS_STAGES,
  findFiles,
  findFilesByExtension,
  findFilesByPrefix,
  findFilesByPattern,
};
