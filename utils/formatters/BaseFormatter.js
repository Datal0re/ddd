/**
 * Base Formatter Class
 * Abstract base class for all upcycle formatters
 * Defines the interface that all formatters must implement
 */

class BaseFormatter {
  /**
   * Format a chat for export
   * @param {Object} processedChat - Processed chat object from ChatUpcycler
   * @param {Object} _options - Formatting options
   * @returns {Promise<string>} Formatted content
   */
  async formatChat(processedChat, _options = {}) {
    throw new Error('formatChat must be implemented by subclass');
  }

  /**
   * Combine multiple chats into single file
   * @param {Array} _results - Array of chat export results
   * @returns {Promise<string>} Combined content
   */
  async combineChats(_results) {
    throw new Error('combineChats must be implemented by subclass');
  }

  /**
   * Get file extension for this format
   * @returns {string} File extension (without dot)
   */
  getFileExtension() {
    throw new Error('getFileExtension must be implemented by subclass');
  }

  /**
   * Get mime type for this format
   * @returns {string} MIME type
   */
  getMimeType() {
    throw new Error('getMimeType must be implemented by subclass');
  }

  /**
   * Format header for chat content
   * @param {Object} _metadata - Chat metadata
   * @returns {string} Formatted header
   */
  formatHeader(_metadata) {
    return '';
  }

  /**
   * Format footer for chat content
   * @param {Object} _metadata - Chat metadata
   * @returns {string} Formatted footer
   */
  formatFooter(_metadata) {
    return '';
  }

  /**
   * Format message content
   * @param {Object} _message - Message object
   * @returns {string} Formatted message
   */
  formatMessage(_message) {
    throw new Error('formatMessage must be implemented by subclass');
  }

  /**
   * Validate format-specific options
   * @param {Object} _options - Options to validate
   * @returns {Object} Validated options
   */
  validateOptions(_options = {}) {
    return _options;
  }
}

module.exports = BaseFormatter;
