/*
 * CommonUtils.js - Consolidated utility functions
 * Centralizes commonly used utility functions to eliminate duplication
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
      return Number(conversation.update_time);
    }
    if (conversation.create_time != null) {
      return Number(conversation.create_time);
    }
    return 0;
  }
}

/**
 * File size formatting utilities
 */
class FileSizeUtils {
  /**
   * Format file size for human readable display
   * @param {number} bytes - Size in bytes
   * @param {number} decimals - Number of decimal places (default: 1)
   * @returns {string} Human readable file size
   */
  static formatFileSize(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, index);

    return `${size.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`;
  }

  /**
   * Parse human readable file size back to bytes
   * @param {string} sizeStr - Human readable size (e.g., "1.5 MB")
   * @returns {number} Size in bytes
   */
  static parseFileSize(sizeStr) {
    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)$/i);
    if (!match) return 0;

    const [, size, unit] = match;
    const multipliers = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };

    return parseFloat(size) * (multipliers[unit.toUpperCase()] || 1);
  }
}

/**
 * String manipulation utilities
 */
class StringUtils {
  /**
   * Safely truncate string to specified length
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} suffix - Suffix to add if truncated (default: '...')
   * @returns {string} Truncated string
   */
  static truncate(str, maxLength, suffix = '...') {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Convert string to title case
   * @param {string} str - String to convert
   * @returns {string} Title case string
   */
  static toTitleCase(str) {
    if (!str) return str;
    return str.replace(
      /\w\S*/g,
      txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Clean and normalize whitespace in string
   * @param {string} str - String to clean
   * @returns {string} Cleaned string
   */
  static cleanWhitespace(str) {
    return str.trim().replace(/\s+/g, ' ');
  }

  /**
   * Escape string for use in regex
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  static escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Array and collection utilities
 */
class CollectionUtils {
  /**
   * Remove duplicates from array
   * @param {Array} arr - Array to deduplicate
   * @param {Function} keyFn - Optional function to extract comparison key
   * @returns {Array} Deduplicated array
   */
  static unique(arr, keyFn = null) {
    if (!Array.isArray(arr)) return [];

    if (keyFn) {
      const seen = new Set();
      return arr.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return [...new Set(arr)];
  }

  /**
   * Chunk array into smaller arrays
   * @param {Array} arr - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array<Array>} Array of chunks
   */
  static chunk(arr, size) {
    if (!Array.isArray(arr) || size <= 0) return [];

    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Group array items by key
   * @param {Array} arr - Array to group
   * @param {Function|string} keyFn - Function or property name to group by
   * @returns {Object} Object with grouped items
   */
  static groupBy(arr, keyFn) {
    if (!Array.isArray(arr)) return {};

    const groups = {};
    const getKey = typeof keyFn === 'function' ? keyFn : item => item[keyFn];

    for (const item of arr) {
      const key = getKey(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    return groups;
  }

  /**
   * Sort array of objects by multiple keys
   * @param {Array} arr - Array to sort
   * @param {Array} sortKeys - Array of sort configuration [{key, order, fn}]
   * @returns {Array} Sorted array
   */
  static sortBy(arr, sortKeys) {
    if (!Array.isArray(arr) || !Array.isArray(sortKeys)) return arr;

    return [...arr].sort((a, b) => {
      for (const { key, order = 'asc', fn } of sortKeys) {
        const aVal = key ? a[key] : a;
        const bVal = key ? b[key] : b;

        let comparison = 0;
        if (fn) {
          comparison = fn(aVal, bVal);
        } else if (aVal < bVal) {
          comparison = -1;
        } else if (aVal > bVal) {
          comparison = 1;
        }

        if (comparison !== 0) {
          return order === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }
}

/**
 * Color and formatting utilities
 */
class FormatUtils {
  /**
   * Format number with thousands separator
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  static formatNumber(num) {
    return num.toLocaleString();
  }

  /**
   * Format duration in seconds to human readable string
   * @param {number} seconds - Duration in seconds
   * @returns {string} Human readable duration
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
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

    const lines = [];

    // Add header
    if (header) {
      const headerLine = columns.map(col => col.padEnd(widths[col])).join('');
      lines.push(chalk.bold(headerLine));
    }

    // Add data rows
    data.forEach(row => {
      const dataLine = columns
        .map(col => String(row[col] || '').padEnd(widths[col]))
        .join('');
      lines.push(dataLine);
    });

    return lines.join('\n');
  }
}

/**
 * Validation utilities that work across the application
 */
class ValidationUtils {
  /**
   * Validate and normalize number value
   * @param {any} value - Value to validate
   * @param {number} defaultValue - Default value if invalid
   * @returns {number} Validated number
   */
  static toNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isNaN(num) ? defaultValue : num;
  }

  /**
   * Check if value is a non-empty string
   * @param {any} value - Value to check
   * @returns {boolean} True if non-empty string
   */
  static isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Check if value is a positive number
   * @param {any} value - Value to check
   * @returns {boolean} True if positive number
   */
  static isPositiveNumber(value) {
    return typeof value === 'number' && value > 0 && !Number.isNaN(value);
  }

  /**
   * Check if value is a valid timestamp (Unix epoch in seconds)
   * @param {any} value - Value to check
   * @returns {boolean} True if valid timestamp
   */
  static isValidTimestamp(value) {
    if (!ValidationUtils.isPositiveNumber(value)) return false;

    // Check if timestamp is reasonable (not too far in past or future)
    const date = new Date(value * 1000);
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
    const tenYearsFromNow = new Date(now.getFullYear() + 10, 0, 1);

    return date >= tenYearsAgo && date <= tenYearsFromNow;
  }
}

/**
 * Performance and timing utilities
 */
class PerformanceUtils {
  /**
   * Create a simple timer
   * @returns {Object} Timer object with start, stop, and elapsed methods
   */
  static createTimer() {
    const startTime = Date.now();

    return {
      start() {
        return Date.now();
      },
      stop() {
        return Date.now() - startTime;
      },
      elapsed() {
        return Date.now() - startTime;
      },
    };
  }

  /**
   * Measure execution time of a function
   * @param {Function} fn - Function to measure
   * @returns {Promise<{result: any, time: number}>} Result and execution time
   */
  static async measureTime(fn) {
    const timer = PerformanceUtils.createTimer();
    const result = await fn();
    const time = timer.stop();

    return { result, time };
  }
}

module.exports = {
  TimestampUtils,
  FileSizeUtils,
  StringUtils,
  CollectionUtils,
  FormatUtils,
  ValidationUtils,
  PerformanceUtils,
};
