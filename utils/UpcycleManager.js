/**
 * Upcycle Manager
 * Main orchestration class for exporting dumpsters to various formats
 */

const { validateRequiredParams } = require('./Validators');
const { logError, logWarning } = require('./upcycleHelpers');
const FileSystemHelper = require('./FileSystemHelper');
const ChatUpcycler = require('./ChatUpcycler');
const { createProgressManager } = require('./ProgressManager');
const PathUtils = require('./PathUtils');
const fs = require('fs').promises;
const MDFormatter = require('./formatters/MDFormatter');
const TXTFormatter = require('./formatters/TXTFormatter');
const HTMLFormatter = require('./formatters/HTMLFormatter');

class UpcycleManager {
  constructor(dumpsterManager) {
    this.dumpsterManager = dumpsterManager;
    this.formatters = {
      md: new MDFormatter(),
      txt: new TXTFormatter(),
      html: new HTMLFormatter(),
    };
  }

  /**
   * Get available upcycle formats
   * @returns {Array<string>} Array of supported formats
   */
  getAvailableFormats() {
    return Object.keys(this.formatters);
  }

  /**
   * Validate upcycle options
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Object} Validated and normalized options
   */
  validateUpcycleOptions(format, options = {}) {
    validateRequiredParams(
      [{ name: 'format', value: format }],
      'validateUpcycleOptions'
    );

    if (!this.formatters[format]) {
      throw new Error(
        `Unsupported format: ${format}. Available formats: ${this.getAvailableFormats().join(', ')}`
      );
    }

    const defaultOptions = {
      outputDir: './upcycles',
      singleFile: false,
      perChat: true,
      includeMedia: false,
      selfContained: false,
      verbose: false,
    };

    return { ...defaultOptions, ...options };
  }

  /**
   * Upcycle entire dumpster to specified format
   * @param {string} dumpsterName - Name of dumpster to upcycle
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Upcycle result
   */
  async upcycleDumpster(dumpsterName, format, options = {}) {
    try {
      const validatedOptions = this.validateUpcycleOptions(format, options);
      const formatter = this.formatters[format];
      const chatUpcycler = new ChatUpcycler(this.dumpsterManager.baseDir);

      const pm = createProgressManager(null, validatedOptions.verbose);

      // Use spinner for initial operations
      pm.start('initializing', 'Starting upcycle process...', 0);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for spinner animation

      // Get all chats from dumpster
      pm.update('loading', 10, 'Loading chats from dumpster...');
      const chats = await this.dumpsterManager.getChats(dumpsterName);

      if (chats.length === 0) {
        throw new Error(`No chats found in dumpster "${dumpsterName}"`);
      }

      pm.succeed(`Found ${chats.length} chats to process`);

      // Switch to progress bar for chat processing
      pm.update('processing', 20, `Processing ${chats.length} chats...`);

      // Create a progress bar for chat processing
      const chatProgressBar = pm.createFileProgressBar(
        chats.length,
        'Processing chats'
      );

      // Create output directory
      const outputDir = FileSystemHelper.joinPath(
        validatedOptions.outputDir,
        `${dumpsterName}-${format}`
      );
      await FileSystemHelper.ensureDirectory(outputDir);

      let processedCount = 0;
      let skippedCount = 0;
      const results = [];

      // Process each chat
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        const progress = 20 + (i / chats.length) * 60; // 20-80% for chat processing

        pm.update('processing', progress, `Processing ${chat.title || 'Untitled'}...`);

        chatProgressBar(i + 1, {
          chat: chat.title || 'Untitled',
          files: processedCount + skippedCount,
        });

        try {
          // For single file mode, we only need to process the content, not create files
          if (validatedOptions.singleFile) {
            const processedChat = await chatUpcycler.processChatForExport(
              chat,
              format,
              { ...validatedOptions, dumpsterName }
            );
            results.push({
              filename: `chat-${i + 1}.${format}`,
              chatTitle: chat.title || 'Untitled',
              content: processedChat.content,
              filepath: null, // We don't create individual files in single file mode
            });
          } else {
            const result = await this.upcycleChat(
              dumpsterName,
              chat,
              format,
              formatter,
              chatUpcycler,
              outputDir,
              validatedOptions
            );
            results.push(result);
          }
          processedCount++;
        } catch (error) {
          logWarning(`Failed to process chat "${chat.title || 'Untitled'}"`, error);
          skippedCount++;
        }
      }

      pm.update('finalizing', 90, 'Finalizing upcycle...');

      // Handle single file option if requested
      if (validatedOptions.singleFile) {
        await this.createCombinedFile(results, outputDir, format, formatter);
      }

      chatProgressBar(chats.length, {
        total_files: results.length,
        skipped: skippedCount,
      });

      pm.update(
        'completed',
        100,
        `Upcycle complete! Processed ${processedCount} chats.`
      );

      return {
        success: true,
        dumpsterName,
        format,
        outputDir,
        total: chats.length,
        processed: processedCount,
        skipped: skippedCount,
        files: validatedOptions.singleFile
          ? [`combined.${format}`]
          : results.map(r => r.filename).filter(f => f), // Filter out null filenames from single-file mode
        options: validatedOptions,
      };
    } catch (error) {
      logError(`Upcycle failed for dumpster "${dumpsterName}"`, error);
      throw error;
    }
  }

  /**
   * Upcycle single chat to specified format
   * @param {string} dumpsterName - Name of dumpster
   * @param {Object} chat - Chat object
   * @param {string} format - Export format
   * @param {Object} formatter - Formatter instance
   * @param {ChatUpcycler} chatUpcycler - Chat upcycler instance
   * @param {string} outputDir - Output directory
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async upcycleChat(
    dumpsterName,
    chat,
    format,
    formatter,
    chatUpcycler,
    outputDir,
    options
  ) {
    validateRequiredParams(
      [
        { name: 'dumpsterName', value: dumpsterName },
        { name: 'chat', value: chat },
        { name: 'format', value: format },
        { name: 'formatter', value: formatter },
        { name: 'chatUpcycler', value: chatUpcycler },
        { name: 'outputDir', value: outputDir },
        { name: 'options', value: options },
      ],
      'upcycleChat'
    );

    // Process chat content
    const processOptions = { ...options, dumpsterName };
    const processedChat = await chatUpcycler.processChatForExport(
      chat,
      format,
      processOptions
    );

    // Generate formatted content
    const formattedContent = await formatter.formatChat(processedChat, options);

    // Generate filename
    const filename = this.generateFilename(chat, format);
    const filepath = FileSystemHelper.joinPath(outputDir, filename);

    // Write file
    await FileSystemHelper.writeFile(filepath, formattedContent);

    // Handle media assets if requested
    if (options.includeMedia && processedChat.assets.length > 0) {
      await this.copyChatAssets(processedChat.assets, outputDir, dumpsterName);
    }

    return {
      filename,
      chatTitle: chat.title || 'Untitled',
      assetCount: processedChat.assets.length,
      messageCount: processedChat.messages.length,
      filepath,
    };
  }

  /**
   * Generate filename for exported chat
   * @param {Object} chat - Chat object
   * @param {string} format - Export format
   * @returns {string} Generated filename
   */
  generateFilename(chat, format) {
    const { sanitizeFilename } = require('./upcycleHelpers');

    const title = chat.title || 'untitled';
    const cleanTitle = sanitizeFilename(title);
    const timestamp = chat.create_time
      ? new Date(chat.create_time * 1000).toISOString().split('T')[0]
      : 'unknown';

    return `${timestamp}_${cleanTitle}.${format}`;
  }

  /**
   * Copy assets for a chat to output directory
   * @param {Array} assets - Array of asset objects
   * @param {string} outputDir - Output directory
   * @param {string} dumpsterName - Source dumpster name
   * @returns {Promise<void>}
   */
  async copyChatAssets(assets, outputDir, dumpsterName) {
    if (assets.length === 0) return;

    const mediaDir = FileSystemHelper.joinPath(outputDir, 'media');
    await FileSystemHelper.ensureDirectory(mediaDir);

    // Load asset mapping to get correct filenames
    const ChatUpcycler = require('./ChatUpcycler');
    const assetMapping = await ChatUpcycler.loadAssetMapping(
      dumpsterName,
      this.dumpsterManager.baseDir
    );

    // Process individual assets from mapping
    for (const asset of assets) {
      try {
        if (!asset || !asset.pointer) {
          continue;
        }

        // Get actual filename from asset mapping
        const actualFilename = assetMapping[asset.pointer];
        if (!actualFilename) {
          logWarning(`No mapping found for asset ${asset.pointer}`, asset);
          continue;
        }

        // Get original asset path from dumpster
        const dumpsterMediaDir = FileSystemHelper.joinPath(
          this.dumpsterManager.baseDir,
          'data/dumpsters',
          dumpsterName,
          'media'
        );

        const sourcePath = FileSystemHelper.joinPath(dumpsterMediaDir, actualFilename);

        if (await FileSystemHelper.fileExists(sourcePath)) {
          const destPath = FileSystemHelper.joinPath(mediaDir, actualFilename);
          // Ensure destination subdirectory exists
          await FileSystemHelper.ensureDirectory(FileSystemHelper.getDirName(destPath));
          await fs.copyFile(sourcePath, destPath);
        } else {
          logWarning(`Asset file not found: ${actualFilename}`, { sourcePath });
        }
      } catch (error) {
        logWarning(`Failed to copy asset ${asset.pointer}`, error);
      }
    }

    // Additionally, copy the entire media directory recursively to catch any files not in mapping
    try {
      const dumpsterMediaDir = FileSystemHelper.joinPath(
        this.dumpsterManager.baseDir,
        'data/dumpsters',
        dumpsterName,
        'media'
      );

      if (await FileSystemHelper.fileExists(dumpsterMediaDir)) {
        await PathUtils.copyDirectory(dumpsterMediaDir, mediaDir);
      }
    } catch (error) {
      logWarning(`Failed to recursively copy media directory`, error);
    }
  }

  /**
   * Create combined file from multiple results
   * @param {Array} results - Array of export results
   * @param {string} outputDir - Output directory
   * @param {string} format - Export format
   * @param {Object} formatter - Formatter instance
   * @returns {Promise<void>}
   */
  async createCombinedFile(results, outputDir, format, formatter) {
    if (results.length === 0) return;

    const combinedContent = await formatter.combineChats(results);
    const filename = `combined.${format}`;
    const filepath = FileSystemHelper.joinPath(outputDir, filename);

    await FileSystemHelper.writeFile(filepath, combinedContent);
  }
}

module.exports = UpcycleManager;
