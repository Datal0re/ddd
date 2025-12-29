/*
 * CommonUtils.js - Essential utility functions
 * Keeps only the most commonly used utilities
 */

const chalk = require('chalk');

/**
 * Timestamp formatting utilities
 */
class TimestampUtils {
  /**
   * Format timestamp from ChatGPT data (seconds since epoch)
   * @param {number} timestamp - Timestamp in seconds
   * @param {string} format - Format type ('iso', 'readable', 'date', 'time')
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp, format = 'readable') {
    if (!timestamp || timestamp === 0) return 'Unknown';

    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds

    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'readable':
        return date.toLocaleString();
      case 'date':
        return date.toLocaleDateString();
      case 'time':
        return date.toLocaleTimeString();
      case 'filedate': {
        // Format for filenames: YYYY.MM.DD
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
      }
      default:
        return date.toLocaleString();
    }
  }

  /**
   * Extract timestamp from ChatGPT conversation object
   * @param {Object} conversation - ChatGPT conversation object
   * @returns {number} Timestamp in seconds, or 0 if not found
   */
  static extractTimestamp(conversation) {
    if (conversation.update_time != null) {
      return conversation.update_time;
    }

    // Fallback to created_time or created_at
    if (conversation.created_time != null) {
      return conversation.created_time;
    }

    if (conversation.created_at != null) {
      return conversation.created_at;
    }

    return 0;
  }
}

/**
 * Table formatting utilities
 */
class FormatUtils {
  /**
   * Format table data for console output
   * @param {Array<Object>} data - Table data
   * @param {Array<string>} columns - Column names
   * @param {Object} options - Formatting options
   * @returns {string} Formatted table
   */
  static formatTable(data, columns, options = {}) {
    const { padding = 2, header = true } = options;

    // Calculate column widths
    const widths = {};
    columns.forEach(col => {
      const maxWidth = Math.max(
        col.length,
        ...data.map(row => String(row[col] || '').length)
      );
      widths[col] = maxWidth + padding;
    });

    let result = '';

    // Add header if requested
    if (header) {
      const headerRow = columns.map(col => col.padEnd(widths[col])).join('');
      result += headerRow + '\n';
    }

    // Add data rows
    data.forEach(row => {
      const dataRow = columns
        .map(col => String(row[col] || '').padEnd(widths[col]))
        .join('');
      result += dataRow + '\n';
    });

    return result;
  }

  /**
   * Create status badge with color
   * @param {string} status - Status text
   * @param {string} color - Color name or function
   * @returns {string} Colored status badge
   */
  static createBadge(status, color = 'blue') {
    const colorFn = typeof color === 'string' ? chalk[color] : color;
    return colorFn(`[${status}]`);
  }
}

module.exports = {
  TimestampUtils,
  FormatUtils,
};
