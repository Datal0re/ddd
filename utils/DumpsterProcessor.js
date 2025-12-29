/*
 * DumpsterProcessor.js - Unified Dumpster Processing utility
 * Combines ZIP extraction, conversation dumping, and asset extraction
 */

const FileUtils = require('./FileUtils.js');
const ZipProcessor = require('./ZipProcessor.js');
const AssetUtils = require('./AssetUtils.js');
const { createProgressManager } = require('./ProgressManager.js');
const { SchemaValidator } = require('./SchemaValidator');
const { dumpChats } = require('./ChatDumper.js');
const { extractAssetsFromHtml } = require('./AssetExtractor.js');

/**
 * Creates a temporary directory within the project's data/temp directory
 *
 * Use this for long-lived temporary files during dumpster processing that need to
 * persist within the project structure. Uses timestamp + random for human-readable names.
 * Creates directories under {baseDir}/data/temp/ for easier debugging and manual cleanup.
 *
 * @param {string} baseDir - Base directory of the application
 * @returns {string} Path to project temp directory
 */
function createProjectTempDir(baseDir) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return FileUtils.joinPath(baseDir, 'data', 'temp', `dumpster_${timestamp}_${random}`);
}

/**
 * Main dumpster processing function
 */
async function processDumpster(
  zipData,
  dumpsterName,
  baseDir,
  isBuffer = false,
  onProgress = null,
  options = {}
) {
  const { overwrite = false, verbose = false, zipPath = null } = options;

  // Validate inputs
  SchemaValidator.validateRequiredParams(
    [
      { name: 'zipPath', value: zipPath },
      { name: 'dumpsterName', value: dumpsterName },
      { name: 'baseDir', value: baseDir },
    ],
    'createDumpster'
  );

  SchemaValidator.validateNonEmptyString(dumpsterName, 'dumpsterName');
  SchemaValidator.validateNonEmptyString(baseDir, 'baseDir');

  // Create unified progress tracker
  const baseTracker = createProgressManager(onProgress, verbose);
  const progress = {
    initializing: message => baseTracker.update('initializing', 0, message),
    extracting: (percent, message) =>
      baseTracker.update('extracting', percent, message),
    dumping: (percent, message) => baseTracker.update('dumping', percent, message),
    extractingAssets: (percent, message) =>
      baseTracker.update('extractingAssets', percent, message),
    organizing: (percent, message) =>
      baseTracker.update('organizing', percent, message),
    validating: (percent, message) =>
      baseTracker.update('validating', percent, message),
    completed: message => baseTracker.update('completed', 100, message),
  };
  progress.initializing('Initializing dumpster processing...');

  // Sanitize dumpster name
  const sanitizedDumpsterName = FileUtils.sanitizeName(dumpsterName, {
    type: 'dumpster',
  });

  // Create base directories
  await FileUtils.ensureDirectory(baseDir);
  const paths = FileUtils.getDumpsterPaths(baseDir, sanitizedDumpsterName);
  const tempDir = createProjectTempDir(baseDir);

  // Check if dumpster already exists
  if (!overwrite) {
    const exists = await FileUtils.fileExists(paths.dumpsterPath);
    if (exists) {
      throw new Error(
        `Dumpster "${sanitizedDumpsterName}" already exists. Use --overwrite to replace it.`
      );
    }
  }

  try {
    // Progress tracker already created above, no need for wrapper

    // Clean up existing dumpster directory if overwriting
    if (overwrite) {
      await FileUtils.removeDirectory(paths.dumpsterPath);
      if (verbose) {
        console.log(`Removed existing dumpster directory: ${sanitizedDumpsterName}`);
      }
    }

    progress.extracting(5, 'Setting up directories...');

    // Ensure directories exist
    await FileUtils.ensureDirectory(tempDir);
    await FileUtils.ensureDumpsterStructure(paths.dumpsterPath);

    progress.extracting(10, 'Extracting ZIP file...');

    // Extract ZIP file
    await ZipProcessor.validateAndExtractZip(zipData, tempDir, isBuffer);

    progress.dumping(30, 'Detecting directory structure...');

    // Detect directory structure dynamically
    if (!zipPath) {
      throw new Error('zipPath is required for directory detection');
    }

    const dirStructure = await AssetUtils.getDirectoryStructure(zipPath, tempDir);

    if (!dirStructure.success) {
      throw new Error(`Failed to detect directory structure: ${dirStructure.error}`);
    }

    if (verbose) {
      console.log(`Detected directory structure using ${dirStructure.method} approach`);
      console.log(`Directory: ${dirStructure.directoryName}`);
    }

    progress.dumping(40, 'Dumping chats...');

    // Dump conversations using detected paths (previously hardcoded)
    const chatsInput = dirStructure.chatsPath;
    const chatsOutput = paths.chatsPath;

    const dumpResult = await dumpChats(chatsInput, chatsOutput, {
      createSubdirs: false,
      preserveOriginal: true,
      overwrite: true,
      verbose,
    });

    if (verbose && dumpResult.errors > 0) {
      console.warn(`Dump completed with ${dumpResult.errors} errors`);
    }

    progress.extractingAssets(70, 'Extracting media assets...');

    // Extract assets using detected path (previously hardcoded)
    const chatHtmlPath = dirStructure.chatHtmlPath;
    const assetsJsonPath = paths.assetsJsonPath;

    const assetResult = await extractAssetsFromHtml(chatHtmlPath, assetsJsonPath, {
      overwrite: true,
      verbose,
    });

    if (verbose) {
      if (assetResult.success) {
        console.log(`Extracted ${assetResult.assetCount} assets`);
      } else {
        console.warn('No assets found or asset extraction failed');
      }
    }

    progress.organizing(85, 'Organizing media files...');

    // Create media directory and move files
    const dumpsterMediaDir = paths.mediaPath;

    const mediaResult = await AssetUtils.moveMediaFiles(dumpsterMediaDir, {
      verbose,
      tempMediaDir: dirStructure.mediaDir,
    });

    progress.validating(95, 'Validating dumpster...');

    // Validate dumpster structure
    const validation = await validateDumpster(paths.dumpsterPath);

    if (!validation.isValid) {
      throw new Error(`Dumpster validation failed: ${validation.errors.join(', ')}`);
    }

    pm.succeed('Dumpster processing complete!');

    // Verify actual file count matches processing count
    const actualChatCount = await FileUtils.listDirectory(paths.chatsPath).then(
      files => files.filter(f => f.endsWith('.json')).length
    );

    const discrepancyMessage =
      actualChatCount !== dumpResult.processed
        ? `⚠️ Chat count discrepancy detected: ${dumpResult.processed} processed, ${actualChatCount} files written`
        : null;

    if (discrepancyMessage && !verbose) {
      console.warn(discrepancyMessage);
    }

    if (verbose) {
      console.log(`Final verification: ${actualChatCount} chat files written to disk`);
      if (discrepancyMessage) {
        console.log(discrepancyMessage);
      }
    }

    return {
      success: true,
      dumpsterName: sanitizedDumpsterName,
      dumpsterDir: paths.dumpsterPath,
      stats: {
        chats: actualChatCount, // Use actual file count for accuracy
        assets: assetResult.assetCount || 0,
        mediaFiles: mediaResult.moved,
        processingStats: {
          attempted: dumpResult.total,
          processed: dumpResult.processed,
          errors: dumpResult.errors,
        },
      },
    };
  } catch (error) {
    console.error(`Dumpster processing failed: ${error.message}`);
    throw error;
  } finally {
    // Always clean up temporary directory
    await FileUtils.removeDirectory(tempDir);
    if (verbose) {
      console.debug('Cleaned up temporary directory');
    }
  }
}

/**
 * Validate dumpster structure
 */
async function validateDumpster(dumpsterPath) {
  const errors = [];
  const warnings = [];

  try {
    // Use FileUtils for basic structure validation
    const structureValidation = await FileUtils.validateDumpsterStructure(dumpsterPath);

    if (!structureValidation.isValid) {
      errors.push(
        ...structureValidation.missing.map(
          path => `Missing required directory: ${path}`
        )
      );
    }

    // Get standard paths for this dumpster
    const paths = FileUtils.getDumpsterPaths(
      FileUtils.getDirName(dumpsterPath),
      FileUtils.getBaseName(dumpsterPath)
    );

    // Check chat files
    try {
      const files = await FileUtils.listDirectory(paths.chatsPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        errors.push('No chat files found');
      }
    } catch {
      // Already caught above in structure validation
    }

    // Check assets.json
    try {
      await FileUtils.readJsonFile(paths.assetsJsonPath);
    } catch {
      warnings.push('assets.json missing or invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings,
    };
  }
}

module.exports = {
  processDumpster,
  validateDumpster,
  createProjectTempDir,
};
