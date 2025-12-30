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
const { SelectionManager } = require('./SelectionManager');
const fs = require('fs').promises;
const chalk = require('chalk');
const MDFormatter = require('./formatters/MDFormatter');
const TXTFormatter = require('./formatters/TXTFormatter');
const HTMLFormatter = require('./formatters/HTMLFormatter');

class UpcycleManager {
  constructor(dumpsterManager, progressManager = null) {
    this.dumpsterManager = dumpsterManager;
    this.progressManager = progressManager;
    this.selectionManager = new SelectionManager(dumpsterManager.baseDir);
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
      outputDir: './data/upcycle-bin',
      includeMedia: true,
      selfContained: false,
      verbose: false,
    };

    return { ...defaultOptions, ...options };
  }

  /**
   * Upcycle selection bin to specified format
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Upcycle result
   */
  async upcycleSelection(format, options = {}) {
    const assetErrorTracker = new AssetErrorTracker();

    try {
      const validatedOptions = this.validateUpcycleOptions(format, options);
      const formatter = this.formatters[format];
      const chatUpcycler = new ChatUpcycler(this.dumpsterManager.baseDir);

      // Use the passed progress manager if available, otherwise create one
      const pm =
        this.progressManager || createProgressManager(null, validatedOptions.verbose);

      // Load selection and get chats grouped by dumpster
      pm.start('loading', 'Loading selection bin...');

      const chatsByDumpster = await this.selectionManager.getChatsByDumpster();

      if (Object.keys(chatsByDumpster).length === 0) {
        throw new Error('Selection bin is empty');
      }

      if (validatedOptions.verbose) {
        const dumpsterDetails = Object.entries(chatsByDumpster)
          .map(
            ([name, chats]) =>
              `${name}: ${chats.length} chat${chats.length !== 1 ? 's' : ''}`
          )
          .join(', ');
        console.log(chalk.dim(`📊 Selection bin distribution: ${dumpsterDetails}`));
      }

      pm.succeed(
        `Found chats in ${Object.keys(chatsByDumpster).length} dumpster${Object.keys(chatsByDumpster).length !== 1 ? 's' : ''}`
      );

      // Switch to progress bar for chat processing
      if (pm.spinner && pm.spinnerActive) {
        pm.stop();
      }

      // Create output directory
      const outputDir = FileUtils.joinPath(
        validatedOptions.outputDir,
        `selection-${format}`
      );
      await FileUtils.ensureDirectory(outputDir);

      let totalProcessed = 0;
      let totalSkipped = 0;
      const allResults = [];
      const totalChats = Object.values(chatsByDumpster).reduce(
        (sum, chats) => sum + chats.length,
        0
      );

      pm.update('processing', 20, `Processing ${totalChats} selected chats...`);

      // Create a progress bar for chat processing
      const chatProgressBar = pm.createProgressBar(
        totalChats,
        'Processing selected chats'
      );

      // Collect all assets from all selected chats for deduplication
      const globalAssetMap = new Map(); // Map<dumpsterName, Set<assetPointer>>
      const processedChats = [];

      // First pass: Load all chats and collect asset references
      for (const [dumpsterName, selectedChats] of Object.entries(chatsByDumpster)) {
        pm.update(
          'processing',
          20 + (totalProcessed / totalChats) * 30,
          `Loading chats from ${dumpsterName}...`
        );

        // Initialize asset tracking for this dumpster
        if (!globalAssetMap.has(dumpsterName)) {
          globalAssetMap.set(dumpsterName, new Set());
        }

        // Load and process chats to collect asset references
        for (let i = 0; i < selectedChats.length; i++) {
          const selectedItem = selectedChats[i];

          try {
            // Load full chat data
            const chat = await this.dumpsterManager.getChat(
              dumpsterName,
              selectedItem.filename
            );

            // Process chat content to identify assets (without copying yet)
            const processOptions = {
              ...validatedOptions,
              dumpsterName,
              assetErrorTracker,
            };
            const processedChat = await chatUpcycler.processChatForExport(
              chat,
              format,
              processOptions
            );

            // Collect asset references for this chat
            if (processedChat.assets && processedChat.assets.length > 0) {
              processedChat.assets.forEach(asset => {
                if (asset.pointer && !asset.error) {
                  globalAssetMap.get(dumpsterName).add(asset.pointer);
                }
              });
            }

            processedChats.push({
              dumpsterName,
              chat,
              processedChat,
              selectedItem,
            });

            totalProcessed++;
          } catch (error) {
            assetErrorTracker.addError('chat_processing', error.message, {
              chatTitle: selectedItem.title || 'Untitled',
              chatId: selectedItem.filename,
              dumpsterName,
            });
            totalSkipped++;
          }

          // Update progress bar
          chatProgressBar.update(totalProcessed + totalSkipped, {
            dumpster: dumpsterName,
            processed: totalProcessed,
            skipped: totalSkipped,
          });
        }
      }

      // Second pass: Copy all unique assets once
      if (validatedOptions.includeMedia && globalAssetMap.size > 0) {
        const totalUniqueAssets = Array.from(globalAssetMap.values()).reduce(
          (sum, assets) => sum + assets.size,
          0
        );
        pm.update(
          'copying_assets',
          60,
          `Copying ${totalUniqueAssets} unique media assets...`
        );

        if (validatedOptions.verbose) {
          const assetDetails = Array.from(globalAssetMap.entries())
            .map(
              ([name, assets]) =>
                `${name}: ${assets.size} unique asset${assets.size !== 1 ? 's' : ''}`
            )
            .join(', ');
          console.log(chalk.dim(`🎨 Asset deduplication: ${assetDetails}`));
        }

        for (const [dumpsterName, assetPointers] of globalAssetMap.entries()) {
          if (assetPointers.size > 0) {
            // Convert Set to array of asset objects
            const uniqueAssets = Array.from(assetPointers).map(pointer => ({
              pointer,
            }));

            await this.copyChatAssets(
              uniqueAssets,
              outputDir,
              dumpsterName,
              assetErrorTracker,
              {
                copyEntireMediaDir: false, // Never copy entire directory for selection
              }
            );
          }
        }
      }

      // Third pass: Generate formatted content and write files
      pm.update('generating_files', 70, 'Generating export files...');

      for (const { chat, processedChat } of processedChats) {
        // Generate formatted content
        const formattedContent = await formatter.formatChat(
          processedChat,
          validatedOptions
        );

        // Generate filename
        const filename = this.generateFilename(chat, format);
        const filepath = FileUtils.joinPath(outputDir, filename);

        // Write file (assets are already copied)
        await FileUtils.writeFile(filepath, formattedContent);

        allResults.push({
          filename,
          chatTitle: chat.title || 'Untitled',
          assetCount: processedChat.assets.length,
          messageCount: processedChat.messages.length,
          filepath,
        });
      }

      pm.update('finalizing', 90, 'Finalizing upcycle...');

      chatProgressBar.update(totalChats, {
        total_processed: totalProcessed,
        total_skipped: totalSkipped,
      });

      // Final progress completion
      pm.update(
        'completed',
        100,
        `Selection upcycle complete! Processed ${totalProcessed} chats.`
      );

      const assetErrorSummary = assetErrorTracker.getErrorSummary();

      return {
        success: true,
        source: 'selection',
        dumpsterCount: Object.keys(chatsByDumpster).length,
        format,
        outputDir,
        total: totalChats,
        processed: totalProcessed,
        skipped: totalSkipped,
        files: allResults.map(r => r.filename).filter(f => f),
        options: validatedOptions,
        assetErrors: assetErrorSummary,
      };
    } catch (error) {
      ErrorHandler.logError('Selection upcycle failed');
      throw error;
    }
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
      const chatProgressBar = pm.createProgressBar(chats.length, 'Processing chats');

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

        chatProgressBar.update(i + 1, {
          chat: chat.title || 'Untitled',
          files: processedCount + skippedCount,
        });

        try {
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

      chatProgressBar.update(chats.length, {
        total_files: results.length,
        skipped: skippedCount,
      });

      // Final progress completion (progress bar handles its own display)
      pm.update(
        'completed',
        100,
        `Upcycle complete! Processed ${processedCount} chats.`
      );

      const assetErrorSummary = assetErrorTracker.getErrorSummary();

      return {
        success: true,
        dumpsterName,
        format,
        outputDir,
        total: chats.length,
        processed: processedCount,
        skipped: skippedCount,
        files: results.map(r => r.filename).filter(f => f),
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
}

module.exports = UpcycleManager;
