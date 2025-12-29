/**
 * Markdown Formatter
 * Formats chats into clean, readable Markdown
 */

const BaseFormatter = require('./BaseFormatter');
const FileUtils = require('../FileUtils');

class MDFormatter extends BaseFormatter {
  constructor() {
    super();
  }

  /**
   * Get file extension for markdown format
   * @returns {string} File extension
   */
  getFileExtension() {
    return 'md';
  }

  /**
   * Get mime type for markdown format
   * @returns {string} MIME type
   */
  getMimeType() {
    return 'text/markdown';
  }

  /**
   * Format a chat for export
   * @param {Object} processedChat - Processed chat object from ChatUpcycler
   * @param {Object} options - Formatting options
   * @returns {Promise<string>} Formatted markdown content
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
        content += '\n\n---\n\n';
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
    const { includeMetadata = true } = options;

    if (!includeMetadata || !metadata) {
      return '';
    }

    // Create YAML front matter
    let header = `---\n`;

    if (metadata.createTime) {
      const date = new Date(metadata.createTime * 1000).toLocaleDateString();
      header += `created: ${date}\n`;
    }

    if (metadata.updateTime && metadata.updateTime !== metadata.createTime) {
      const updatedDate = new Date(metadata.updateTime * 1000).toLocaleDateString();
      header += `updated: ${updatedDate}\n`;
    }

    if (metadata.model && metadata.model !== 'Unknown') {
      header += `model: ${metadata.model}\n`;
    }

    header += `messages: ${metadata.messageCount}\n`;

    if (metadata.assetCount > 0) {
      header += `attachments: ${metadata.assetCount}\n`;
    }

    header += `---\n\n# ${metadata.title}\n\n`;

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

    let footer = '\n---\n\n';
    footer += `*Exported from Data Dumpster Diver on ${new Date().toLocaleDateString()}*\n`;

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
    const { includeTimestamps = true } = options;
    const { author, parts, createdAt } = message;

    let formatted = '';

    // Add timestamp and author
    if (includeTimestamps && createdAt) {
      const timestamp = new Date(createdAt * 1000).toLocaleString();
      formatted += `**${timestamp} - ${author}**\n\n`;
    } else {
      formatted += `**${author}**\n\n`;
    }

    // Process each part of the message
    for (const part of parts) {
      switch (part.type) {
        case 'text':
          // Text content - just use raw markdown
          formatted += part.raw + '\n';
          break;

        case 'transcript':
          formatted += `*Transcript:* ${part.content}\n`;
          break;

        case 'image':
        case 'audio':
        case 'video':
        case 'unknown':
          // Asset content - already formatted for markdown
          formatted += part.content + '\n';
          break;

        default:
          if (typeof part === 'string' && part.length) {
            formatted += part + '\n';
          }
          break;
      }
    }

    return formatted;
  }

  /**
   * Combine multiple chats into single markdown file
   * @param {Array} results - Array of chat export results
   * @returns {Promise<string>} Combined markdown content
   */
  async combineChats(results) {
    if (results.length === 0) {
      return '';
    }

    let content = `# Combined Chat Exports\n\n`;
    content += `*Combined ${results.length} chats on ${new Date().toLocaleDateString()}*\n\n`;
    content += '---\n\n';

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      // Read the file content if filepath exists, otherwise use content directly
      let fileContent;
      if (result.filepath) {
        fileContent = await FileUtils.readFile(result.filepath);
      } else if (result.content) {
        fileContent = result.content;
      } else {
        continue; // Skip if no content available
      }

      content += `## ${result.chatTitle}\n\n`;
      content += fileContent;

      if (i < results.length - 1) {
        content += '\n\n---\n\n## Next Chat\n\n';
      }
    }

    return content;
  }

  /**
   * Validate markdown-specific options
   * @param {Object} options - Options to validate
   * @returns {Object} Validated options
   */
  validateOptions(options = {}) {
    const defaultOptions = {
      includeMetadata: true,
      includeTimestamps: true,
      wrapCodeBlocks: true,
    };

    return { ...defaultOptions, ...options };
  }
}

module.exports = MDFormatter;
