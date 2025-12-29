/**
 * Upcycle Manager
 * Main orchestration class for exporting dumpsters to various formats
 */

const { SchemaValidator } = require('./SchemaValidator');
const { AssetErrorTracker } = require('./upcycleHelpers');
const { ErrorHandler } = require('./ErrorHandler');
const FileUtils = require('./FileUtils');
const ChatUpcycler = require('./ChatUpcycler');
const { createProgressManager } = require('./ProgressManager');
const fs = require('fs').promises;
const MDFormatter = require('./formatters/MDFormatter');
const TXTFormatter = require('./formatters/TXTFormatter');
const HTMLFormatter = require('./formatters/HTMLFormatter');

class UpcycleManager {
  constructor(dumpsterManager, progressManager = null) {
    this.dumpsterManager = dumpsterManager;
    this.progressManager = progressManager;
    this.formatters = {
      md: MDFormatter,
      txt: TXTFormatter,
      html: HTMLFormatter,
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
    SchemaValidator.validateRequiredParams(
      [{ name: 'format', value: format }],
      'validateUpcycleOptions'
    );

    if (!this.formatters[format]) {
      throw new Error(
        `Unsupported format: ${format}. Available formats: ${this.getAvailableFormats().join(', ')}`
      );
    }

    const defaultOptions = {
      outputDir: './upcycle-bin',
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
    const assetErrorTracker = new AssetErrorTracker();

    try {
      const validatedOptions = this.validateUpcycleOptions(format, options);
      const formatter = this.formatters[format];
      const chatUpcycler = new ChatUpcycler(this.dumpsterManager.baseDir);

      // Use the passed progress manager if available, otherwise create one
      const pm =
        this.progressManager || createProgressManager(null, validatedOptions.verbose);

      // Get all chats from dumpster
      pm.update('loading', 10, 'Loading chats from dumpster...');
      const chats = await this.dumpsterManager.getChats(dumpsterName);

      if (chats.length === 0) {
        throw new Error(`No chats found in dumpster "${dumpsterName}"`);
      }

      pm.succeed(`Found ${chats.length} chats to process`);

      // Switch to progress bar for chat processing - stop spinner to avoid conflicts
      if (pm.spinner && pm.spinnerActive) {
        pm.stop();
      }
      pm.update('processing', 20, `Processing ${chats.length} chats...`);

      // Create a progress bar for chat processing
      const chatProgressBar = pm.createFileProgressBar(
        chats.length,
        'Processing chats'
      );

      // Create output directory
      const outputDir = FileUtils.joinPath(
        validatedOptions.outputDir,
        `${dumpsterName}-${format}`
      );
      await FileUtils.ensureDirectory(outputDir);

      let processedCount = 0;
      let skippedCount = 0;
      const results = [];

      // Process each chat
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        const progress = 20 + (i / chats.length) * 60; // 20-80% for chat processing

        // Only update progress if not using progress bar (verbose mode)
        if (validatedOptions.verbose) {
          pm.update(
            'processing',
            progress,
            `Processing ${chat.title || 'Untitled'}...`
          );
        }

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
              { ...validatedOptions, dumpsterName, assetErrorTracker }
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
              validatedOptions,
              assetErrorTracker
            );
            results.push(result);
          }
          processedCount++;
        } catch (error) {
          assetErrorTracker.addError('chat_processing', error.message, {
            chatTitle: chat.title || 'Untitled',
            chatIndex: i,
          });
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

      // Only add final progress update if in verbose mode (since progress bar already shows completion)
      if (validatedOptions.verbose) {
        pm.update(
          'completed',
          100,
          `Upcycle complete! Processed ${processedCount} chats.`
        );
      }

      const assetErrorSummary = assetErrorTracker.getErrorSummary();

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
        assetErrors: assetErrorSummary,
      };
    } catch (error) {
      ErrorHandler.logError(`Upcycle failed for dumpster "${dumpsterName}"`);
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
   * @param {AssetErrorTracker} assetErrorTracker - Error tracking instance
   * @returns {Promise<Object>} Export result
   */
  async upcycleChat(
    dumpsterName,
    chat,
    format,
    formatter,
    chatUpcycler,
    outputDir,
    options,
    assetErrorTracker = null
  ) {
    SchemaValidator.validateRequiredParams(
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
    const processOptions = { ...options, dumpsterName, assetErrorTracker };
    const processedChat = await chatUpcycler.processChatForExport(
      chat,
      format,
      processOptions
    );

    // Track asset errors from processed chat
    if (assetErrorTracker && processedChat.assets) {
      processedChat.assets.forEach(asset => {
        if (asset.error) {
          assetErrorTracker.addError(
            asset.error,
            asset.message || 'Unknown asset error',
            {
              pointer: asset.pointer,
              filename: asset.filename,
              contentType: asset.contentType,
              chatTitle: chat.title || 'Untitled',
            }
          );
        }
      });
    }

    // Generate formatted content
    const formattedContent = await formatter.formatChat(processedChat, options);

    // Generate filename
    const filename = this.generateFilename(chat, format);
    const filepath = FileUtils.joinPath(outputDir, filename);

    // Write file
    await FileUtils.writeFile(filepath, formattedContent);

    // Handle media assets if requested
    if (options.includeMedia && processedChat.assets.length > 0) {
      await this.copyChatAssets(
        processedChat.assets,
        outputDir,
        dumpsterName,
        assetErrorTracker
      );
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
   * @param {AssetErrorTracker} assetErrorTracker - Error tracking instance
   * @returns {Promise<void>}
   */
  async copyChatAssets(assets, outputDir, dumpsterName, assetErrorTracker = null) {
    if (assets.length === 0) return;

    const mediaDir = FileUtils.joinPath(outputDir, 'media');
    await FileUtils.ensureDirectory(mediaDir);

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
          if (assetErrorTracker) {
            assetErrorTracker.addWarning(
              'invalid_asset',
              'Asset missing pointer',
              asset
            );
          }
          continue;
        }

        // Get actual filename from asset mapping
        const actualFilename = assetMapping[asset.pointer];
        if (!actualFilename) {
          if (assetErrorTracker) {
            assetErrorTracker.addWarning(
              'asset_mapping_missing',
              `No mapping found for asset ${asset.pointer}`,
              asset
            );
          }
          continue;
        }

        // Get original asset path from dumpster
        const dumpsterMediaDir = FileUtils.joinPath(
          this.dumpsterManager.baseDir,
          'data/dumpsters',
          dumpsterName,
          'media'
        );

        const sourcePath = FileUtils.joinPath(dumpsterMediaDir, actualFilename);

        if (await FileUtils.fileExists(sourcePath)) {
          const destPath = FileUtils.joinPath(mediaDir, actualFilename);
          // Ensure destination subdirectory exists
          await FileUtils.ensureDirectory(FileUtils.getDirName(destPath));
          await fs.copyFile(sourcePath, destPath);
        } else {
          if (assetErrorTracker) {
            assetErrorTracker.addError(
              'asset_file_not_found',
              `Asset file not found: ${actualFilename}`,
              {
                ...asset,
                sourcePath,
                actualFilename,
              }
            );
          }
        }
      } catch (error) {
        if (assetErrorTracker) {
          assetErrorTracker.addError(
            'asset_copy_failed',
            `Failed to copy asset ${asset.pointer}`,
            {
              ...asset,
              error: error.message,
            }
          );
        }
      }
    }

    // Additionally, copy the entire media directory recursively to catch any files not in mapping
    try {
      const dumpsterMediaDir = FileUtils.joinPath(
        this.dumpsterManager.baseDir,
        'data/dumpsters',
        dumpsterName,
        'media'
      );

      if (await FileUtils.fileExists(dumpsterMediaDir)) {
        await FileUtils.copyDirectory(dumpsterMediaDir, mediaDir);
      }
    } catch (error) {
      if (assetErrorTracker) {
        assetErrorTracker.addWarning(
          'media_directory_copy_failed',
          'Failed to recursively copy media directory',
          {
            dumpsterName,
            error: error.message,
          }
        );
      }
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
    const filepath = FileUtils.joinPath(outputDir, filename);

    await FileUtils.writeFile(filepath, combinedContent);
  }
}

module.exports = UpcycleManager;
