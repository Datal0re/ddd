/**
 * Formatter Interface Definition
 * Simple object interface for all upcycle formatters
 * Defines the structure that formatters must implement
 */

/**
 * Formatter interface - formatters should be objects with these methods
 * @interface Formatter
 */

/**
 * Format a chat for export
 * @function formatChat
 * @param {Object} processedChat - Processed chat object from ChatUpcycler
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted content
 */

/**
 * Combine multiple chats into single file
 * @function combineChats
 * @param {Array} results - Array of chat export results
 * @returns {Promise<string>} Combined content
 */

/**
 * Get file extension for this format
 * @function getFileExtension
 * @returns {string} File extension (without dot)
 */

/**
 * Get mime type for this format
 * @function getMimeType
 * @returns {string} MIME type
 */

/**
 * Format message content
 * @function formatMessage
 * @param {Object} message - Message object
 * @param {number} index - Message index
 * @param {Object} options - Formatting options
 * @returns {string} Formatted message
 */

/**
 * Format header for chat content (optional)
 * @function formatHeader
 * @param {Object} metadata - Chat metadata
 * @param {Object} options - Formatting options
 * @returns {string} Formatted header
 */

/**
 * Format footer for chat content (optional)
 * @function formatFooter
 * @param {Object} metadata - Chat metadata
 * @param {Object} options - Formatting options
 * @returns {string} Formatted footer
 */

/**
 * Validate format-specific options (optional)
 * @function validateOptions
 * @param {Object} options - Options to validate
 * @returns {Object} Validated options
 */

module.exports = {}; // Export empty object - this file serves as documentation
