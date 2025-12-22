/**
 * HTML Formatter
 * Formats chats into static, self-contained HTML
 */

const BaseFormatter = require('./BaseFormatter');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const FileSystemHelper = require('../fsHelpers');

class HTMLFormatter extends BaseFormatter {
  constructor() {
    super();
  }

  /**
   * Get file extension for HTML format
   * @returns {string} File extension
   */
  getFileExtension() {
    return 'html';
  }

  /**
   * Get mime type for HTML format
   * @returns {string} MIME type
   */
  getMimeType() {
    return 'text/html';
  }

  /**
   * Format a chat for export
   * @param {Object} processedChat - Processed chat object from ChatUpcycler
   * @param {Object} options - Formatting options
   * @returns {Promise<string>} Formatted HTML content
   */
  async formatChat(processedChat, options = {}) {
    const validatedOptions = this.validateOptions(options);
    const { metadata, messages } = processedChat;

    let content = this.generateHTMLStart(metadata, validatedOptions);
    content += this.formatHeader(metadata, validatedOptions);

    // Format each message
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      content += this.formatMessage(message, i, validatedOptions);
    }

    content += this.formatFooter(metadata, validatedOptions);
    content += this.generateHTMLEnd();

    return content;
  }

  /**
   * Generate HTML document start with CSS
   * @param {Object} metadata - Chat metadata
   * @param {Object} options - Formatting options
   * @returns {string} HTML document start
   */
  generateHTMLStart(metadata, options = {}) {
    const { theme = 'light', includeCSS = true } = options;

    let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '  <meta charset="UTF-8">\n';
    html +=
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';

    if (metadata) {
      html += `  <title>${this.escapeHTML(metadata.title || 'Untitled Chat')}</title>\n`;
    } else {
      html += '  <title>Chat Export</title>\n';
    }

    if (includeCSS) {
      html += '  <style>\n';
      html += this.getCSS(theme);
      html += '  </style>\n';
    }

    html += '</head>\n<body>\n';
    html += '  <div class="chat-container">\n';

    return html;
  }

  /**
   * Generate HTML document end
   * @returns {string} HTML document end
   */
  generateHTMLEnd() {
    return '  </div>\n</body>\n</html>';
  }

  /**
   * Get CSS for styling
   * @param {string} theme - Theme name ('light' or 'dark')
   * @returns {string} CSS styles
   */
  getCSS(theme = 'light') {
    const lightTheme = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f8f9fa;
        margin: 0;
        padding: 20px;
      }
      .chat-container {
        max-width: 800px;
        margin: 0 auto;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      .chat-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        text-align: center;
      }
      .chat-header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
      .chat-metadata {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin-top: 10px;
        font-size: 14px;
        opacity: 0.9;
      }
      .message {
        padding: 16px 20px;
        border-bottom: 1px solid #eee;
      }
      .message:last-child {
        border-bottom: none;
      }
      .message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .message-author {
        font-weight: 600;
        color: #2563eb;
      }
      .message-author.assistant {
        color: #10b981;
      }
      .message-author.tool {
        color: #8b5cf6;
      }
      .message-time {
        font-size: 12px;
        color: #6b7280;
      }
      .message-content {
        line-height: 1.6;
      }
      .message-content p {
        margin: 0 0 12px 0;
      }
      .message-content p:last-child {
        margin-bottom: 0;
      }
      .message-content pre {
        background: #f1f5f9;
        border-radius: 4px;
        padding: 12px;
        overflow-x: auto;
        border-left: 3px solid #0ea5e9;
      }
      .message-content code {
        background: #f1f5f9;
        padding: 2px 4px;
        border-radius: 2px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      }
      .asset-container {
        margin: 12px 0;
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }
      .asset-missing {
        background: #fef3c7;
        border-color: #f59e0b;
        color: #92400e;
      }
      .chat-footer {
        background: #f8f9fa;
        padding: 16px 20px;
        text-align: center;
        font-size: 12px;
        color: #6b7280;
        border-top: 1px solid #eee;
      }
      .message-separator {
        height: 1px;
        background: #e5e7eb;
        margin: 0 20px;
      }
    `;

    const darkTheme = lightTheme.replace(
      /#f8f9fa|#333|#fff|#eee|#6b7280|#f1f5f9|#0ea5e9|#f9fafb|#e5e7eb/g,
      function (match) {
        const colorMap = {
          '#f8f9fa': '#1a1a1a',
          '#333': '#e5e5e5',
          '#fff': '#2a2a2a',
          '#eee': '#404040',
          '#6b7280': '#9ca3af',
          '#f1f5f9': '#1e293b',
          '#0ea5e9': '#0284c7',
          '#f9fafb': '#374151',
          '#e5e7eb': '#4b5563',
        };
        return colorMap[match] || match;
      }
    );

    return theme === 'dark' ? darkTheme : lightTheme;
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

    let header = '    <div class="chat-header">\n';
    header += `      <h1>${this.escapeHTML(metadata.title || 'Untitled Chat')}</h1>\n`;

    if (metadata.createTime || metadata.model) {
      header += '      <div class="chat-metadata">\n';

      if (metadata.createTime) {
        const date = new Date(metadata.createTime * 1000).toLocaleDateString();
        header += `        <span>Created: ${date}</span>\n`;
      }

      if (metadata.model && metadata.model !== 'Unknown') {
        header += `        <span>Model: ${metadata.model}</span>\n`;
      }

      header += '      </div>\n';
    }

    header += '    </div>\n';

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

    let footer = '    <div class="chat-footer">\n';
    footer += `      <p>Exported from Data Dumpster Diver on ${new Date().toLocaleDateString()}</p>\n`;

    if (metadata.messageCount > 0) {
      footer += `      <p>${metadata.messageCount} messages`;
      if (metadata.assetCount > 0) {
        footer += ` with ${metadata.assetCount} attachments`;
      }
      footer += '</p>\n';
    }

    footer += '    </div>\n';

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

    let formatted = '    <div class="message">\n';
    formatted += '      <div class="message-header">\n';

    // Author and timestamp
    formatted += `        <span class="message-author ${author.toLowerCase()}">${this.escapeHTML(author)}</span>\n`;

    if (includeTimestamps && createdAt) {
      const timestamp = new Date(createdAt * 1000).toLocaleString();
      formatted += `        <span class="message-time">${timestamp}</span>\n`;
    }

    formatted += '      </div>\n';
    formatted += '      <div class="message-content">\n';

    // Process each part of the message
    for (const part of parts) {
      formatted += this.processMessagePart(part);
    }

    formatted += '      </div>\n';
    formatted += '    </div>\n';

    // Add separator except for last message
    if (index !== undefined) {
      formatted += '    <div class="message-separator"></div>\n';
    }

    return formatted;
  }

  /**
   * Process individual message part
   * @param {Object} part - Message part object
   * @returns {string} Processed HTML
   */
  processMessagePart(part) {
    switch (part.type) {
      case 'text': {
        // Text content - convert from markdown to safe HTML
        const rawHtml = marked.parse(part.raw || '');
        const safeHtml = sanitizeHtml(rawHtml, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'img',
            'h1',
            'h2',
            'u',
            's',
            'pre',
            'code',
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'title'],
          },
        });
        return `        <p>${safeHtml}</p>\n`;
      }

      case 'transcript':
        return `        <p><em>Transcript:</em> ${this.escapeHTML(part.content || '')}</p>\n`;

      case 'image':
      case 'audio':
      case 'video':
      case 'unknown':
        // Asset content - already formatted for HTML
        return `        <div class="asset-container">${part.content}</div>\n`;

      default:
        if (typeof part === 'string' && part.length) {
          return `        <p>${this.escapeHTML(part)}</p>\n`;
        }
        return '';
    }
  }

  /**
   * Combine multiple chats into single HTML file
   * @param {Array} results - Array of chat export results
   * @returns {Promise<string>} Combined HTML content
   */
  async combineChats(results) {
    if (results.length === 0) {
      return '';
    }

    let content = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    content += '  <meta charset="UTF-8">\n';
    content +=
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    content += '  <title>Combined Chat Exports</title>\n';
    content += '  <style>\n';
    content += this.getCSS();
    content += '  </style>\n';
    content += '</head>\n<body>\n';
    content += '  <div class="chat-container">\n';

    content += '    <div class="chat-header">\n';
    content += '      <h1>Combined Chat Exports</h1>\n';
    content += `      <div class="chat-metadata">\n`;
    content += `        <span>Combined ${results.length} chats</span>\n`;
    content += `        <span>${new Date().toLocaleDateString()}</span>\n`;
    content += '      </div>\n';
    content += '    </div>\n';

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

      content += '    <div class="chat-section">\n';
      content += `      <h2>${this.escapeHTML(result.chatTitle)}</h2>\n`;
      content += '      <div class="message-separator"></div>\n';

      // Extract just the message content (skip the full HTML structure)
      const messageContent = fileContent.match(/<div class="message">(.*?)<\/div>/gs);
      if (messageContent) {
        content += messageContent.join('\n');
      }

      if (i < results.length - 1) {
        content += '      <div class="message-separator"></div>\n';
      }

      content += '    </div>\n';
    }

    content += '  </div>\n</body>\n</html>';

    return content;
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHTML(text) {
    if (typeof text !== 'string') return '';

    // Fallback for Node.js environment
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validate HTML-specific options
   * @param {Object} options - Options to validate
   * @returns {Object} Validated options
   */
  validateOptions(options = {}) {
    const defaultOptions = {
      includeMetadata: true,
      includeTimestamps: true,
      theme: 'light', // 'light' or 'dark'
      includeCSS: true,
    };

    const validated = { ...defaultOptions, ...options };

    // Validate theme
    if (!['light', 'dark'].includes(validated.theme)) {
      validated.theme = 'light';
    }

    return validated;
  }
}

module.exports = HTMLFormatter;
