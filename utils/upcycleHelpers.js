/**
 * Upcycle Helpers
 * Shared utilities for upcycle functionality
 */

const FileSystemHelper = require('./fsHelpers');
const { validateNonEmptyString } = require('./validators');

/**
 * Log error with consistent formatting
 * @param {string} message - Error message
 * @param {Error|string} error - Optional error object or additional message
 */
function logError(message, error = null) {
  console.error(`❌ Error: ${message}${error ? ` - ${error.message || error}` : ''}`);
}

/**
 * Log warning with consistent formatting
 * @param {string} message - Warning message
 * @param {Error|string} error - Optional error object or additional message
 */
function logWarning(message, error = null) {
  console.warn(`⚠️  Warning: ${message}${error ? ` - ${error.message || error}` : ''}`);
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
        const fileStats = await FileSystemHelper.getStats(result.filepath);
        stats.totalSize += fileStats.size || 0;
      } catch (error) {
        // File might not exist yet or stats unavailable
        logWarning(`Could not get stats for ${result.filepath}`, error);
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
  validateNonEmptyString(outputDir, 'outputDir');

  try {
    const exists = await FileSystemHelper.fileExists(outputDir);

    if (!exists) {
      if (createIfMissing) {
        await FileSystemHelper.ensureDirectory(outputDir);
      } else {
        throw new Error(`Output directory does not exist: ${outputDir}`);
      }
    }

    // Check if it's actually a directory
    const stats = await FileSystemHelper.getStats(outputDir);
    if (!stats.isDirectory()) {
      throw new Error(`Output path is not a directory: ${outputDir}`);
    }

    // Check write permissions
    const testFile = FileSystemHelper.joinPath(outputDir, '.write-test');
    await FileSystemHelper.writeFile(testFile, 'test');
    await FileSystemHelper.deleteFile(testFile);

    return FileSystemHelper.resolvePath(outputDir);
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
 * @returns {string} Formatted report
 */
function generateExportReport(upcycleResult) {
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

    if (files.length > 0) {
      report += `\n📄 Files created:\n`;
      files.forEach((file, index) => {
        report += `   ${index + 1}. ${file}\n`;
      });
    }

    if (options.includeMedia) {
      report += `\n🎨 Media: ${options.includeMedia ? 'Included' : 'Referenced'}\n`;
    }

    if (options.singleFile) {
      report += `\n📄 Format: Single combined file\n`;
    } else {
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
  logError,
  logWarning,
};
