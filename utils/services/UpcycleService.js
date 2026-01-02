/**
 * Upcycle Service
 * Extracted business logic for upcycle command
 * Handles export format validation, source determination, and export execution
 */

const { BaseCommandService } = require('./BaseCommandService');
const { SchemaValidator } = require('../SchemaValidator');
const { CliPrompts } = require('../CliPrompts');
const { StatisticsUtils } = require('../StatisticsUtils');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling export/upcycle operations
 * Extracted from CLI upcycle command handler
 */
class UpcycleService extends BaseCommandService {
  constructor(baseDir) {
    super(baseDir);
  }

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

      // Prompt for format if not provided
      if (validatedInputs.requiresFormatPrompt) {
        validatedInputs.format = await CliPrompts.selectExportFormat();
      }

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

      // Perform upcycle
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
  async validateAndPrepareInputs(format, dumpsterName, options, managers) {
    const validatedInputs = {};

    // Check and display selection bin status first
    const binStatus = this.calculateSelectionBinStatus(managers.bin);

    if (binStatus.hasContent && !dumpsterName) {
      this.displaySelectionBinStatus(binStatus);
    }

    // Validate export format
    if (!format) {
      validatedInputs.requiresFormatPrompt = true;
    } else {
      const formatValidation = SchemaValidator.safeValidateExportFormat(
        format,
        ['txt', 'md', 'html'],
        'upcycle command'
      );

      if (!formatValidation.valid) {
        throw new Error(formatValidation.message);
      }

      // Ensure format is properly assigned
      if (formatValidation.valid && formatValidation.data) {
        validatedInputs.format = formatValidation.data;
      } else {
        validatedInputs.format = undefined;
      }
    }

    // Validate options using SchemaValidator
    const optionsValidation = SchemaValidator.validateUpcycleCommand(
      validatedInputs.format,
      null, // dumpster name not needed for options validation
      options
    );

    if (!optionsValidation.valid) {
      throw new Error(optionsValidation.message);
    }

    validatedInputs.options = optionsValidation.validatedInputs.options;

    // Store dumpster name for later use
    validatedInputs.dumpsterName = dumpsterName;

    return validatedInputs;
  }

  /**
   * Calculate selection bin status using centralized StatisticsUtils
   * @param {BinManager} bm - Bin manager instance
   * @returns {Object} Bin status information
   */
  async calculateSelectionBinStatus(bm) {
    return StatisticsUtils.calculateSelectionBinStatus(bm);
  }

  /**
   * Determine export source (dumpster vs selection)
   * @param {string} dumpsterName - Provided dumpster name
   * @param {BinManager} bm - Bin manager instance
   * @param {string} format - Export format (may be undefined)
   * @returns {Promise<Object>} Export source information
   */
  async determineExportSource(dumpsterName, bm, format) {
    // If dumpster name provided, use it
    if (dumpsterName) {
      return {
        source: 'dumpster',
        dumpsterName: dumpsterName,
        format: format, // Pass through format parameter
      };
    }

    // Prompt user for choice
    const exportSource = await CliPrompts.promptUpcycleSource(null, bm);

    if (exportSource === 'dumpster') {
      return {
        source: 'dumpster',
        requiresPrompt: true,
        format: format, // Pass through format if already provided
      };
    }

    return {
      source: 'selection',
      format: format, // Pass through format if already provided
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
