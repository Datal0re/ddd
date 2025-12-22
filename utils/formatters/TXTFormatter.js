/**
 * Text Formatter
 * Formats chats into clean, readable plain text
 */

const BaseFormatter = require('./BaseFormatter');
const FileSystemHelper = require('../fsHelpers');

class TXTFormatter extends BaseFormatter {
  constructor() {
    super();
  }

  /**
   * Get file extension for text format
   * @returns {string} File extension
   */
  getFileExtension() {
    return 'txt';
  }

  /**
   * Get mime type for text format
   * @returns {string} MIME type
   */
  getMimeType() {
    return 'text/plain';
  }

  /**
   * Format a chat for export
   * @param {Object} processedChat - Processed chat object from ChatUpcycler
   * @param {Object} options - Formatting options
   * @returns {Promise<string>} Formatted text content
   */
  async formatChat(processedChat, options = {}) {
    const validatedOptions = this.validateOptions(options);
    const { metadata, messages } = processedChat;

    let content = this.formatHeader(metadata, validatedOptions);

    // Format each message
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      content += this.formatMessage(message, i, validatedOptions);

      // Add separator between messages
      if (i < messages.length - 1) {
        content += '\n' + '='.repeat(80) + '\n\n';
      }
    }

    content += this.formatFooter(metadata, validatedOptions);

    return content;
  }

  /**
   * Format header for chat content
   * @param {Object} metadata - Chat metadata
   * @param {Object} options - Formatting options
   * @returns {string} Formatted header
   */
  formatHeader(metadata, options = {}) {
    const { includeMetadata = true, asciiBorders = false } = options;

    if (!includeMetadata || !metadata) {
      return '';
    }

    let header = '';

    if (asciiBorders) {
      header += '+' + '='.repeat(78) + '+\n';
      header += `| ${metadata.title.padEnd(76)} |\n`;
      header += '+' + '='.repeat(78) + '+\n\n';
    } else {
      header += `${metadata.title}\n`;
      header += '-'.repeat(metadata.title.length) + '\n\n';
    }

    if (metadata.createTime) {
      const date = new Date(metadata.createTime * 1000).toLocaleString();
      header += `Created: ${date}\n`;
    }

    if (metadata.updateTime && metadata.updateTime !== metadata.createTime) {
      const updatedDate = new Date(metadata.updateTime * 1000).toLocaleString();
      header += `Updated: ${updatedDate}\n`;
    }

    if (metadata.model && metadata.model !== 'Unknown') {
      header += `Model: ${metadata.model}\n`;
    }

    header += `Messages: ${metadata.messageCount}\n`;

    if (metadata.assetCount > 0) {
      header += `Attachments: ${metadata.assetCount}\n`;
    }

    header += '\n';

    return header;
  }

  /**
   * Format footer for chat content
   * @param {Object} metadata - Chat metadata
   * @param {Object} options - Formatting options
   * @returns {string} Formatted footer
   */
  formatFooter(metadata, options = {}) {
    const { includeMetadata = true } = options;

    if (!includeMetadata || !metadata) {
      return '';
    }

    let footer = '\n' + '-'.repeat(50) + '\n';
    footer += `Exported from Data Dumpster Diver on ${new Date().toLocaleString()}\n`;
    footer += `Chat: ${metadata.title}\n`;

    return footer;
  }

  /**
   * Format message content
   * @param {Object} message - Message object
   * @param {number} index - Message index
   * @param {Object} options - Formatting options
   * @returns {string} Formatted message
   */
  formatMessage(message, index, options = {}) {
    const { includeTimestamps = true, messageNumbers = false } = options;
    const { author, parts, createdAt } = message;

    let formatted = '';

    // Add message number if requested
    if (messageNumbers) {
      formatted += `[Message ${index + 1}]\n`;
    }

    // Add timestamp and author
    if (includeTimestamps && createdAt) {
      const timestamp = new Date(createdAt * 1000).toLocaleString();
      formatted += `[${timestamp}] ${author}:\n`;
    } else {
      formatted += `${author}:\n`;
    }

    // Process each part of the message
    formatted += this.processMessageParts(parts);

    return formatted + '\n';
  }

  /**
   * Process message parts into text format
   * @param {Array} parts - Message parts array
   * @returns {string} Processed parts
   */
  processMessageParts(parts) {
    let content = '';

    for (const part of parts) {
      switch (part.type) {
        case 'text':
          // Text content - add indentation and wrap if needed
          {
            const wrappedText = this.wrapText(part.raw || part.content || '', 76);
            content += wrappedText + '\n';
          }
          break;

        case 'transcript':
          content += `Transcript: ${part.content}\n`;
          break;

        case 'image':
          content += `[Image: ${part.filename || 'unknown'}]\n`;
          if (part.path) {
            content += `  Path: ${part.path}\n`;
          }
          break;

        case 'audio':
          content += `[Audio: ${part.filename || 'unknown'}]\n`;
          if (part.path) {
            content += `  Path: ${part.path}\n`;
          }
          break;

        case 'video':
          content += `[Video: ${part.filename || 'unknown'}]\n`;
          if (part.path) {
            content += `  Path: ${part.path}\n`;
          }
          break;

        case 'unknown':
          content += `[File: ${part.filename || 'unknown'}]\n`;
          if (part.path) {
            content += `  Path: ${part.path}\n`;
          }
          if (part.pointer) {
            content += `  Asset ID: ${part.pointer}\n`;
          }
          break;

        default:
          if (typeof part === 'string' && part.length) {
            const wrappedText = this.wrapText(part, 76);
            content += wrappedText + '\n';
          }
          break;
      }
    }

    return content;
  }

  /**
   * Wrap text to specified width
   * @param {string} text - Text to wrap
   * @param {number} width - Maximum line width
   * @returns {string} Wrapped text
   */
  wrapText(text, width) {
    if (!text) return '';

    const lines = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  /**
   * Combine multiple chats into single text file
   * @param {Array} results - Array of chat export results
   * @returns {Promise<string>} Combined text content
   */
  async combineChats(results) {
    if (results.length === 0) {
      return '';
    }

    let content = `Combined Chat Exports\n`;
    content += `${'='.repeat(50)}\n`;
    content += `Combined ${results.length} chats on ${new Date().toLocaleString()}\n`;
    content += `${'='.repeat(50)}\n\n`;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      // Read the actual file content if filepath exists, otherwise use content directly
      let fileContent;
      if (result.filepath) {
        fileContent = await FileSystemHelper.readFile(result.filepath);
      } else if (result.content) {
        fileContent = result.content;
      } else {
        continue; // Skip if no content available
      }

      content += `\n${'/'.repeat(30)}\n`;
      content += `Chat ${i + 1}: ${result.chatTitle}\n`;
      content += `${'/'.repeat(30)}\n\n`;
      content += fileContent;

      if (i < results.length - 1) {
        content += '\n\n';
      }
    }

    return content;
  }

  /**
   * Validate text-specific options
   * @param {Object} options - Options to validate
   * @returns {Object} Validated options
   */
  validateOptions(options = {}) {
    const defaultOptions = {
      includeMetadata: true,
      includeTimestamps: true,
      messageNumbers: false,
      asciiBorders: false,
      wrapWidth: 76,
    };

    return { ...defaultOptions, ...options };
  }
}

module.exports = TXTFormatter;
