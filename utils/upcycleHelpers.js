/**
 * Upcycle Helpers
 * Shared utilities for upcycle functionality
 */

const FileUtils = require('./FileUtils');
const { SchemaValidator } = require('./SchemaValidator');
const { ErrorHandler } = require('./ErrorHandler');

/**
 * Asset error tracking class
 */
class AssetErrorTracker {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  addError(type, details, assetInfo = {}) {
    this.errors.push({
      type,
      details,
      assetInfo,
      timestamp: Date.now(),
    });
  }

  addWarning(type, details, assetInfo = {}) {
    this.warnings.push({
      type,
      details,
      assetInfo,
      timestamp: Date.now(),
    });
  }

  getErrorSummary() {
    const errorsByType = {};
    this.errors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    const warningsByType = {};
    this.warnings.forEach(warning => {
      warningsByType[warning.type] = (warningsByType[warning.type] || 0) + 1;
    });

    return {
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      errorsByType,
      warningsByType,
    };
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  clear() {
    this.errors = [];
    this.warnings = [];
  }
}

/**
 * Sanitize filename for export
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'untitled';
  }

  // Remove problematic characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .toLowerCase()
    .substring(0, 50); // Limit length
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp
 * @param {string} format - Format type ('date', 'datetime', 'iso')
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp, format = 'datetime') {
  if (!timestamp || timestamp === 0) {
    return 'Unknown';
  }

  const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds

  switch (format) {
    case 'date':
      return date.toLocaleDateString();
    case 'datetime':
      return date.toLocaleString();
    case 'iso':
      return date.toISOString();
    case 'time':
      return date.toLocaleTimeString();
    default:
      return date.toLocaleString();
  }
}

/**
 * Generate unique filename for export
 * @param {string} baseFilename - Base filename
 * @param {string} extension - File extension
 * @param {Array} existingFiles - Array of existing filenames
 * @returns {string} Unique filename
 */
function generateUniqueFilename(baseFilename, extension, existingFiles = []) {
  let filename = `${baseFilename}.${extension}`;

  if (!existingFiles.includes(filename)) {
    return filename;
  }

  let counter = 1;
  do {
    filename = `${baseFilename}_${counter}.${extension}`;
    counter++;
  } while (existingFiles.includes(filename));

  return filename;
}

/**
 * Calculate file statistics for upcycle result
 * @param {Array} results - Array of export results
 * @returns {Object} Statistics object
 */
async function calculateUpcycleStats(results) {
  const stats = {
    totalFiles: results.length,
    totalMessages: 0,
    totalAssets: 0,
    totalSize: 0,
    formatBreakdown: {},
  };

  for (const result of results) {
    // Count messages and assets
    stats.totalMessages += result.messageCount || 0;
    stats.totalAssets += result.assetCount || 0;

    // Track format breakdown
    const extension = result.filename.split('.').pop().toLowerCase();
    stats.formatBreakdown[extension] = (stats.formatBreakdown[extension] || 0) + 1;

    // Calculate file size (estimated)
    if (result.filepath) {
      try {
        const fileStats = await FileUtils.getStats(result.filepath);
        stats.totalSize += fileStats.size || 0;
      } catch {
        // File might not exist yet or stats unavailable
        ErrorHandler.logWarning(
          `Could not get stats for ${result.filepath}`,
          'export stats'
        );
      }
    }
  }

  // Convert size to human readable
  stats.totalSizeHuman = formatFileSize(stats.totalSize);

  return stats;
}

/**
 * Format file size for human display
 * @param {number} bytes - Size in bytes
 * @returns {string} Human readable size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const threshold = 1024;

  let unitIndex = 0;
  let size = bytes;

  while (size >= threshold && unitIndex < units.length - 1) {
    size /= threshold;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Validate export directory
 * @param {string} outputDir - Output directory path
 * @param {boolean} createIfMissing - Create directory if it doesn't exist
 * @returns {Promise<string>} Validated output directory
 */
async function validateOutputDirectory(outputDir, createIfMissing = true) {
  SchemaValidator.validateNonEmptyString(outputDir, 'outputDir');

  try {
    const exists = await FileUtils.fileExists(outputDir);

    if (!exists) {
      if (createIfMissing) {
        await FileUtils.ensureDirectory(outputDir);
      } else {
        throw new Error(`Output directory does not exist: ${outputDir}`);
      }
    }

    // Check if it's actually a directory
    const stats = await FileUtils.getStats(outputDir);
    if (!stats.isDirectory()) {
      throw new Error(`Output path is not a directory: ${outputDir}`);
    }

    // Check write permissions
    const testFile = FileUtils.joinPath(outputDir, '.write-test');
    await FileUtils.writeFile(testFile, 'test');
    await FileUtils.deleteFile(testFile);

    return FileUtils.resolvePath(outputDir);
  } catch (error) {
    throw new Error(`Invalid output directory "${outputDir}": ${error.message}`);
  }
}

/**
 * Create progress message for upcycle operations
 * @param {string} operation - Current operation name
 * @param {number} current - Current progress count
 * @param {number} total - Total count
 * @returns {string} Progress message
 */
function createProgressMessage(operation, current, total) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  return `${operation}: ${current}/${total} (${percentage}%)`;
}

/**
 * Get chat metadata summary for display
 * @param {Object} metadata - Chat metadata object
 * @returns {string} Formatted summary
 */
function formatChatSummary(metadata) {
  if (!metadata) {
    return 'No metadata available';
  }

  const parts = [];

  if (metadata.title) {
    parts.push(`"${metadata.title}"`);
  }

  if (metadata.createTime) {
    parts.push(`created ${formatTimestamp(metadata.createTime, 'date')}`);
  }

  if (metadata.messageCount > 0) {
    parts.push(`${metadata.messageCount} messages`);
  }

  if (metadata.assetCount > 0) {
    parts.push(`${metadata.assetCount} attachments`);
  }

  return parts.join(', ');
}

/**
 * Generate export report
 * @param {Object} upcycleResult - Result from UpcycleManager
 * @param {boolean} verbose - Whether to show verbose report
 * @returns {string} Formatted report
 */
function generateExportReport(upcycleResult, verbose = false) {
  const {
    success,
    dumpsterName,
    format,
    outputDir,
    total,
    processed,
    skipped,
    files,
    options,
    assetErrors,
  } = upcycleResult;

  let report = '\n' + '='.repeat(50) + '\n';
  report += 'UPCYCLE REPORT\n';
  report += '='.repeat(50) + '\n\n';

  if (success) {
    report += `✅ Success! Upcycled dumpster "${dumpsterName}" to ${format.toUpperCase()}\n\n`;

    report += `📊 Statistics:\n`;
    report += `   Total chats: ${total}\n`;
    report += `   Processed: ${processed}\n`;
    report += `   Skipped: ${skipped}\n`;

    if (processed > 0) {
      report += `   Success rate: ${Math.round((processed / total) * 100)}%\n`;
    }

    report += `\n📁 Output: ${outputDir}\n`;

    // Show file summary (not full list) for non-verbose mode
    if (files.length > 0) {
      if (verbose && files.length <= 10) {
        report += `\n📄 Files created:\n`;
        files.forEach((file, index) => {
          report += `   ${index + 1}. ${file}\n`;
        });
      } else if (verbose) {
        report += `\n📄 Files created (${files.length} files):\n`;
        files.slice(0, 10).forEach((file, index) => {
          report += `   ${index + 1}. ${file}\n`;
        });
        if (files.length > 10) {
          report += `   ... and ${files.length - 10} more files\n`;
        }
      } else {
        report += `\n📄 Files: ${files.length} file${files.length !== 1 ? 's' : ''} created\n`;
      }
    }

    // Add asset error summary if available
    if (assetErrors && (assetErrors.totalErrors > 0 || assetErrors.totalWarnings > 0)) {
      report += `\n⚠️  Asset Issues:\n`;

      if (assetErrors.totalErrors > 0) {
        report += `   Errors: ${assetErrors.totalErrors}\n`;
        if (verbose) {
          Object.entries(assetErrors.errorsByType).forEach(([type, count]) => {
            report += `     ${type}: ${count}\n`;
          });
        }
      }

      if (assetErrors.totalWarnings > 0) {
        report += `   Warnings: ${assetErrors.totalWarnings}\n`;
        if (verbose) {
          Object.entries(assetErrors.warningsByType).forEach(([type, count]) => {
            report += `     ${type}: ${count}\n`;
          });
        }
      }
    }

    if (verbose) {
      if (options.includeMedia) {
        report += `\n🎨 Media: ${options.includeMedia ? 'Included' : 'Referenced'}\n`;
      }

      report += `\n📄 Format: Separate files per chat\n`;
    }
  } else {
    report += `❌ Failed to upcycle dumpster "${dumpsterName}"\n`;
  }

  report += '\n' + '='.repeat(50) + '\n';

  return report;
}

module.exports = {
  sanitizeFilename,
  formatTimestamp,
  generateUniqueFilename,
  calculateUpcycleStats,
  formatFileSize,
  validateOutputDirectory,
  createProgressMessage,
  formatChatSummary,
  generateExportReport,
  AssetErrorTracker,
};
