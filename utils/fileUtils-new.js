/*
 * Legacy file utilities - deprecated
 *
 * This file is kept for backward compatibility during refactoring.
 * Most functionality has been moved to specialized modules:
 * - utils/fsHelpers.js - Basic file operations
 * - utils/zipProcessor.js - ZIP processing and validation
 * - utils/pathUtils.js - Path manipulation and searching
 * - utils/assetUtils.js - Asset-related operations
 * - utils/validators.js - Input validation
 * - config/constants.js - Configuration constants
 *
 * New code should import from the specialized modules directly.
 */

// Legacy exports for backward compatibility
const FileSystemHelper = require('./fsHelpers');
const ZipProcessor = require('./zipProcessor');
const PathUtils = require('./pathUtils');
const AssetUtils = require('./assetUtils');
const Validators = require('./validators');
const { CLIFramework, COMMON_FLAGS, PROGRESS_STAGES } = require('./cliFramework');
const { createProgressTracker } = require('./progressTracker');
const {
  LIMITS,
  FILE_EXTENSIONS,
  CONTENT_TYPES,
  ASSET_PREFIXES,
  PATHS,
  SANITIZATION_DEFAULTS,
} = require('../config/constants');

// Legacy function wrappers for backward compatibility
const legacyWrapper = {
  // File operations (now in fsHelpers)
  ensureDir: dirPath => FileSystemHelper.ensureDirectory(dirPath),
  createTempDir: () => ZipProcessor.createTempDir(),
  cleanupTempDir: tempDir => ZipProcessor.cleanupTempDir(tempDir),
  removeDirectories: (...dirs) => PathUtils.removeDirectories(...dirs),

  // ZIP operations (now in zipProcessor)
  validateUpload: (fileData, maxSize) => ZipProcessor.validateUpload(fileData, maxSize),
  validateZipStructure: zipBuffer => ZipProcessor.validateZipStructure(zipBuffer),
  validateAndExtractZip: (zipData, targetDir, isBuffer) =>
    ZipProcessor.validateAndExtractZip(zipData, targetDir, isBuffer),
  processZipUpload: (
    zipData,
    dumpsterName,
    exportDir,
    mediaDir,
    isBuffer,
    onProgress
  ) =>
    ZipProcessor.processZipUpload(
      zipData,
      dumpsterName,
      exportDir,
      mediaDir,
      isBuffer,
      onProgress
    ),

  // Path operations (now in pathUtils)
  validatePath: filePath => PathUtils.validatePath(filePath),
  sanitizeName: (name, options) => PathUtils.sanitizeName(name, options),
  findFiles: (dir, options) => PathUtils.findFiles(dir, options),
  findFilesByExtension: (dir, extension, recursive) =>
    PathUtils.findFilesByExtension(dir, extension, recursive),
  findFilesByPrefix: (dir, prefix, recursive) =>
    PathUtils.findFilesByPrefix(dir, prefix, recursive),
  findFilesByPattern: (dir, pattern, recursive) =>
    PathUtils.findFilesByPattern(dir, pattern, recursive),

  // Asset operations (now in assetUtils)
  isMediaFile: filePath => AssetUtils.isMediaFile(filePath),
  moveFilesToFinalLocations: (tempDir, exportDir, mediaDir, files) =>
    AssetUtils.moveFilesToFinalLocations(tempDir, exportDir, mediaDir, files),

  // Validation (now in validators)
  validateRequiredParams: (params, functionName) =>
    Validators.validateRequiredParams(params, functionName),
  validateNonEmptyString: (param, paramName) =>
    Validators.validateNonEmptyString(param, paramName),

  // CLI operations (now in cliFramework)
  parseCLIArguments: config => CLIFramework.parseArguments(config),
  COMMON_FLAGS,
  generateHelpText: config => CLIFramework.generateHelpText(config),

  // Progress tracking (now in progressTracker)
  createProgressCallback: (userCallback, verbose) => {
    if (!userCallback && !verbose) return null;
    return createProgressTracker(userCallback, verbose).update.bind(
      createProgressTracker()
    );
  },
  createProgressTracker,
  PROGRESS_STAGES,
};

// Legacy exports
module.exports = {
  // Modern exports (prefer these)
  FileSystemHelper,
  ZipProcessor,
  PathUtils,
  AssetUtils,
  Validators,
  CLIFramework,
  createProgressTracker,

  // Configuration
  LIMITS,
  FILE_EXTENSIONS,
  CONTENT_TYPES,
  ASSET_PREFIXES,
  PATHS,
  COMMON_FLAGS,
  PROGRESS_STAGES,
  SANITIZATION_DEFAULTS,

  // Legacy function wrappers (deprecated, use modern exports above)
  ...legacyWrapper,
};
