/**
 * Search Manager
 * Handles content searching within ChatGPT conversations
 */

const chalk = require('chalk');
const { UI_CONFIG } = require('../config/constants');

class SearchManager {
  /**
   * Search for query within a chat
   * @param {Object} chat - Chat object
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search result with matches and relevance score
   */
  static searchInChat(chat, query, options = {}) {
    const {
      scope = 'all', // 'title', 'content', 'all'
      caseSensitive = false,
      messageLimit = UI_CONFIG.DEFAULT_MESSAGE_LIMIT,
    } = options;

    if (!query || query.trim() === '') {
      return {
        matches: [],
        relevanceScore: 0,
        matchCount: 0,
      };
    }

    const searchTerm = caseSensitive ? query : query.toLowerCase();
    const matches = [];
    let relevanceScore = 0;

    // Search in title
    if (scope === 'title' || scope === 'all') {
      const title = chat.title || '';
      const searchText = caseSensitive ? title : title.toLowerCase();

      if (searchText.includes(searchTerm)) {
        matches.push({
          type: 'title',
          text: title,
          context: title,
        });
        relevanceScore += 10; // Title matches weighted higher
      }
    }

    // Search in message content
    if (scope === 'content' || scope === 'all') {
      const messageTexts = this.extractSearchableText(chat, messageLimit);

      for (let i = 0; i < messageTexts.length; i++) {
        const messageText = messageTexts[i];
        const searchText = caseSensitive
          ? messageText.content
          : messageText.content.toLowerCase();

        if (searchText.includes(searchTerm)) {
          const matchIndex = searchText.indexOf(searchTerm);
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(searchText.length, matchIndex + searchTerm.length + 50);
          const context = searchText.substring(start, end);

          matches.push({
            type: 'content',
            text: messageText.content,
            context: `...${context}...`,
            messageIndex: messageText.index,
            author: messageText.author,
          });

          // Calculate relevance for content matches
          relevanceScore += 2; // Base score for content match

          // Bonus for exact phrase matches
          if (searchText === searchTerm) {
            relevanceScore += 3;
          }

          // Bonus for matches in user messages
          if (messageText.author === 'user') {
            relevanceScore += 1;
          }
        }
      }
    }

    return {
      matches,
      relevanceScore,
      matchCount: matches.length,
    };
  }

  /**
   * Extract searchable text from chat messages
   * @param {Object} chat - Chat object
   * @param {number} messageLimit - Maximum messages to process
   * @returns {Array} Array of message objects with content and metadata
   */
  static extractSearchableText(chat, messageLimit = UI_CONFIG.DEFAULT_MESSAGE_LIMIT) {
    const messageTexts = [];

    if (!chat.mapping) {
      return messageTexts;
    }

    let messageCount = 0;

    // Traverse the message tree to extract content
    const traverseMessages = node => {
      if (!node || messageCount >= messageLimit) {
        return;
      }

      // Process current node if it has content
      if (node.message && node.message.content) {
        let content = '';

        // Handle different content types
        if (typeof node.message.content === 'string') {
          content = node.message.content;
        } else if (Array.isArray(node.message.content)) {
          // Extract text from content parts
          content = node.message.content
            .filter(part => part.text)
            .map(part => part.text)
            .join(' ');
        }

        if (content && content.trim() !== '') {
          const author = node.message.author?.role || 'unknown';

          messageTexts.push({
            content: content.trim(),
            author,
            index: messageCount,
            messageId: node.id,
            timestamp: node.message.create_time || node.message.update_time,
          });

          messageCount++;
        }
      }

      // Recursively process children
      if (node.children) {
        for (const childId of node.children) {
          if (typeof chat.mapping[childId] !== 'undefined') {
            traverseMessages(chat.mapping[childId]);
          }
        }
      }
    };

    // Find root messages and start traversal
    Object.values(chat.mapping).forEach(node => {
      if (node && !node.parent) {
        traverseMessages(node);
      }
    });

    return messageTexts;
  }

  /**
   * Generate search preview for chat
   * @param {Object} chat - Chat object
   * @param {Object} searchResult - Result from searchInChat
   * @param {string} query - Search query
   * @returns {string} Preview text
   */
  static generatePreview(chat, searchResult, query) {
    if (!query || searchResult.matchCount === 0) {
      // Return a preview of the first message content
      const messageTexts = this.extractSearchableText(chat, 1);
      if (messageTexts.length > 0) {
        let content = messageTexts[0].content;
        if (content.length > UI_CONFIG.MESSAGE_PREVIEW_LENGTH) {
          content = content.substring(0, UI_CONFIG.MESSAGE_PREVIEW_LENGTH) + '...';
        }
        return content;
      }
      return chat.title || 'Untitled chat';
    }

    // Show context of the first match
    if (searchResult.matches.length > 0) {
      const firstMatch = searchResult.matches[0];

      // Prefer title matches for preview
      if (firstMatch.type === 'title') {
        return `📌 Title match: ${firstMatch.text}`;
      }

      // Show content match context
      return `🔍 ${firstMatch.context}`;
    }

    return chat.title || 'Untitled chat';
  }

  /**
   * Highlight matches in text using chalk
   * @param {string} text - Text to highlight
   * @param {string} query - Search query
   * @param {boolean} caseSensitive - Case sensitivity
   * @returns {string} Text with highlighted matches
   */
  static highlightMatches(text, query, caseSensitive = false) {
    if (!query || !text) {
      return text;
    }

    const searchTerm = caseSensitive ? query : query.toLowerCase();
    const searchText = caseSensitive ? text : text.toLowerCase();
    const matches = [];
    let index = searchText.indexOf(searchTerm);

    while (index !== -1) {
      matches.push({
        start: index,
        end: index + searchTerm.length,
      });
      index = searchText.indexOf(searchTerm, index + 1);
    }

    if (matches.length === 0) {
      return text;
    }

    // Build highlighted text
    let result = '';
    let lastIndex = 0;

    matches.forEach(match => {
      // Add text before match
      result += text.substring(lastIndex, match.start);
      // Add highlighted match
      result += chalk.yellow(text.substring(match.start, match.end));
      lastIndex = match.end;
    });

    // Add remaining text
    result += text.substring(lastIndex);

    return result;
  }

  /**
   * Sort search results by relevance score
   * @param {Array} searchResults - Array of search results
   * @returns {Array} Sorted results
   */
  static sortByRelevance(searchResults) {
    return searchResults.sort((a, b) => {
      // First by relevance score (descending)
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      // Then by update time (descending - most recent first)
      const aTime = a.chat.update_time || a.chat.create_time || 0;
      const bTime = b.chat.update_time || b.chat.create_time || 0;

      return bTime - aTime;
    });
  }

  /**
   * Generate search summary text
   * @param {number} totalChats - Total chats searched
   * @param {number} matchCount - Number of chats with matches
   * @param {string} query - Search query
   * @param {string} scope - Search scope
   * @returns {string} Summary text
   */
  static generateSearchSummary(totalChats, matchCount, query, scope) {
    if (!query || query.trim() === '') {
      return `Found ${totalChats} chats`;
    }

    const scopeText =
      scope === 'title'
        ? 'titles'
        : scope === 'content'
          ? 'content'
          : 'titles and content';
    return `${matchCount} of ${totalChats} chats match "${query}" in ${scopeText}`;
  }
}

module.exports = { SearchManager };
