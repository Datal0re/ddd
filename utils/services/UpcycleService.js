/**
 * Upcycle Service
 * Extracted business logic for upcycle command
 * Handles export format validation, source determination, and export execution
 */

const { BaseCommandService } = require('./BaseCommandService');
const { SchemaValidator } = require('../SchemaValidator');
const { CliPrompts } = require('../CliPrompts');
const chalk = require('chalk');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling export/upcycle operations
 * Extracted from CLI upcycle command handler
 */
class UpcycleService extends BaseCommandService {
  /**
   * Perform upcycle export operation
   * @param {string} format - Export format (may be undefined, will prompt)
   * @param {string} dumpsterName - Dumpster name (may be undefined)
   * @param {Object} options - Command options
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Result object
   */
  async upcycleExport(format, dumpsterName, options = {}, managers) {
    try {
      managers.progress.start('initializing', 'Preparing to upcycle...');

      // Validate and prepare inputs
      const validatedInputs = await this.validateAndPrepareInputs(
        format,
        dumpsterName,
        options,
        managers
      );

      // Determine export source
      const exportSource = await this.determineExportSource(
        validatedInputs.dumpsterName,
        managers.bin,
        validatedInputs.format
      );

      // Validate dumpster if needed
      let finalDumpsterName = validatedInputs.dumpsterName;
      if (exportSource.source === 'dumpster') {
        finalDumpsterName = await this.validateAndSelectDumpster(
          managers.dumpster,
          exportSource.dumpsterName
        );
      }

      // Perform export
      const result = await this.performUpcycle(
        exportSource.source,
        finalDumpsterName,
        validatedInputs.format,
        validatedInputs.options,
        managers
      );

      // Generate and display report
      const report = this.generateAndDisplayReport(
        result,
        validatedInputs.options.verbose
      );

      const successMessage = this.formatUpcycleSuccess(
        exportSource.source,
        finalDumpsterName,
        result.processed || 0,
        validatedInputs.format
      );

      managers.progress.succeed(successMessage);
      return this.createResult(true, { ...result, report }, successMessage);
    } catch (error) {
      managers.progress?.fail(`Upcycle failed: ${error.message}`);
      return this.createResult(false, null, 'Upcycle operation failed', error);
    }
  }

  /**
   * Validate and prepare all inputs
   * @param {string} format - Export format
   * @param {string} dumpsterName - Dumpster name
   * @param {Object} options - Command options
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Validated inputs
   */
  async validateAndPrepareInputs(format, dumpsterName, options, _managers) {
    const validatedInputs = {};

    // Check and display selection bin status first
    const binStatus = await this.calculateSelectionBinStatus(_managers.bin);
    // const selectedSource =
    //   binStatus.hasContent && !dumpsterName ? 'selection' : 'dumpster';
    // validatedInputs.binStatus = binStatus;

    if (binStatus.hasContent && !dumpsterName) {
      this.displaySelectionBinStatus(binStatus);
    }

    // Validate export format
    if (!format) {
      validatedInputs.requiresFormatPrompt = true;
    } else {
      const formatValidation = SchemaValidator.validateExportFormat(
        format,
        ['txt', 'md', 'html'],
        'upcycle command'
      );

      if (!formatValidation.valid) {
        throw new Error(formatValidation.message);
      }

      validatedInputs.format = formatValidation.format;
    }

    // Validate options
    validatedInputs.options = this.validateUpcycleOptions(options);

    // Store dumpster name for later use
    validatedInputs.dumpsterName = dumpsterName;

    return validatedInputs;
  }

  /**
   * Calculate selection bin status (extracted from CLI lines 622-656)
   * @param {BinManager} binManager - Bin manager instance
   * @returns {Object} Bin status information
   */
  async calculateSelectionBinStatus(binManager) {
    const chatsByDumpster = binManager.getActiveBinChatsByDumpster();
    const allChats = Object.values(chatsByDumpster).flat();
    const totalCount = allChats.length;

    if (totalCount === 0) {
      return {
        hasContent: false,
        totalCount: 0,
        totalMessages: 0,
        dumpsterCount: 0,
        chatsByDumpster: {},
      };
    }

    const totalMessages = allChats.reduce(
      (sum, chat) => sum + (chat.metadata?.messageCount || 0),
      0
    );
    const dumpsterCount = Object.keys(chatsByDumpster).length;

    return {
      hasContent: true,
      totalCount,
      totalMessages,
      dumpsterCount,
      chatsByDumpster,
    };
  }

  /**
   * Display selection bin status (extracted from CLI lines 632-655)
   * @param {Object} binStatus - Bin status information
   */
  displaySelectionBinStatus(binStatus) {
    console.log(chalk.blue(`\n📋 Selection Bin Status:`));
    console.log(`   ${binStatus.totalCount} chats selected`);

    if (binStatus.totalMessages > 0) {
      console.log(`   ${binStatus.totalMessages} total messages`);
    }

    if (binStatus.dumpsterCount > 0) {
      console.log(
        `   From ${binStatus.dumpsterCount} dumpster${binStatus.dumpsterCount !== 1 ? 's' : ''}`
      );

      // Show dumpsters with chat counts
      Object.entries(binStatus.chatsByDumpster).forEach(([name, chats]) => {
        console.log(
          `   • ${name}: ${chats.length} chat${chats.length !== 1 ? 's' : ''}`
        );
      });
    }

    console.log();
  }

  /**
   * Determine export source (dumpster vs selection)
   * @param {string} dumpsterName - Provided dumpster name
   * @param {BinManager} binManager - Bin manager instance
   * @returns {Promise<Object>} Export source information
   */
  async determineExportSource(dumpsterName, binManager) {
    // If dumpster name provided, use it
    if (dumpsterName) {
      return {
        source: 'dumpster',
        dumpsterName: dumpsterName,
      };
    }

    // Prompt user for choice
    const exportSource = await CliPrompts.promptUpcycleSource(null, binManager);

    if (exportSource === 'dumpster') {
      return {
        source: 'dumpster',
        requiresPrompt: true,
      };
    }

    return {
      source: 'selection',
    };
  }

  /**
   * Validate and select dumpster if needed
   * @param {DumpsterManager} dumpsterManager - Dumpster manager instance
   * @param {string} suggestedName - Suggested dumpster name
   * @returns {Promise<string>} Selected dumpster name
   */
  async validateAndSelectDumpster(dumpsterManager, _suggestedName) {
    if (_suggestedName) {
      return _suggestedName;
    }

    const dumpsters = await dumpsterManager.listDumpsters();

    if (dumpsters.length === 0) {
      throw new Error('No dumpsters available. Use "ddd dump" to process a ZIP file.');
    }

    return await CliPrompts.selectFromDumpsters(
      dumpsters,
      'Select a dumpster to upcycle:'
    );
  }

  /**
   * Validate upcycle command options
   * @param {Object} options - Options object
   * @returns {Object} Validated options
   */
  validateUpcycleOptions(options) {
    const schema = {
      output: { type: 'string', required: false },
      includeMedia: { type: 'boolean', required: false, default: true },
      selfContained: { type: 'boolean', required: false, default: false },
      verbose: { type: 'boolean', required: false, default: false },
    };

    return SchemaValidator.validateCommandOptions(options, schema, 'upcycle command')
      .options;
  }

  /**
   * Perform the actual upcycle operation
   * @param {string} source - Export source ('dumpster' or 'selection')
   * @param {string} dumpsterName - Dumpster name (if source is 'dumpster')
   * @param {string} format - Export format
   * @param {Object} options - Validated options
   * @param {Object} managers - Required managers
   * @returns {Promise<Object>} Upcycle result
   */
  async performUpcycle(source, dumpsterName, format, options, managers) {
    const upcycleOptions = {
      ...options,
      outputDir: options.output || './data/upcycle-bin',
      onProgress: progress => {
        managers.progress.update(progress.stage, progress.progress, progress.message);
      },
    };

    let result;
    if (source === 'selection') {
      // Get bins with content for selection
      const bins = managers.bin.listBins();
      const binsWithContent = bins.filter(bin => bin.chatCount > 0);

      if (binsWithContent.length === 0) {
        throw new Error('No bins contain any chats to upcycle');
      }

      // Select bin if multiple have content
      let selectedBinName;
      if (binsWithContent.length > 1) {
        selectedBinName = await CliPrompts.selectBinForUpcycle(binsWithContent);
      } else {
        selectedBinName = binsWithContent[0].name;
      }

      result = await managers.upcycle.upcycleBin(format, selectedBinName, {
        ...upcycleOptions,
        copyEntireMediaDir: false, // Only copy referenced assets for selection
      });
    } else {
      // Dumpster export
      result = await managers.upcycle.upcycleDumpster(
        dumpsterName,
        format,
        upcycleOptions
      );
    }

    return result;
  }

  /**
   * Generate and display export report (extracted from CLI lines 794-822)
   * @param {Object} result - Upcycle result
   * @param {boolean} verbose - Whether to show verbose output
   * @param {string} format - Export format
   * @returns {string} Report text
   */
  generateAndDisplayReport(result, verbose) {
    const { generateExportReport } = require('../upcycleHelpers');
    const report = generateExportReport(result, verbose);

    if (verbose) {
      console.log(report);
    } else {
      // Show minimal summary in non-verbose mode
      const reportLines = report
        .split('\n')
        .filter(
          line =>
            line.includes('✅ Success!') ||
            line.includes('Total chats:') ||
            line.includes('Output:') ||
            line.includes('===')
        );
      console.log(reportLines.join('\n'));
    }

    return report;
  }

  /**
   * Format upcycle success message
   * @param {string} source - Export source
   * @param {string} dumpsterName - Dumpster name
   * @param {string} format - Export format
   * @param {number} processedCount - Number of processed items
   * @returns {string} Formatted success message
   */
  formatUpcycleSuccess(source, dumpsterName, processedCount, _format) {
    const sourceDescription =
      source === 'selection'
        ? `selection bin (${processedCount} chats)`
        : `"${dumpsterName}"`;

    return `Upcycle of ${sourceDescription} to ${_format.toUpperCase()} complete!`;
  }

  /**
   * Get upcycle command statistics
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      name: 'UpcycleService',
      version: VERSION,
      description: 'Handles export operations to various formats',
      capabilities: [
        'format validation',
        'export source determination',
        'selection bin processing',
        'export execution',
        'report generation',
        'progress tracking',
      ],
      supportedFormats: ['txt', 'md', 'html'],
      exportSources: ['dumpster', 'selection bin'],
      complexity: 'high - most complex CLI command',
    };
  }
}

module.exports = {
  UpcycleService,
};
