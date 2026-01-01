/**
 * Hoard Service
 * Extracted business logic for hoard command
 * Handles dumpster and bin listing with formatting
 */

const { BaseCommandService } = require('./BaseCommandService');
const { FormatUtils } = require('../CommonUtils');
const chalk = require('chalk');
const { VERSION } = require('../../config/constants');

/**
 * Service for handling hoard (listing) operations
 * Extracted from CLI hoard command handler
 */
class HoardService extends BaseCommandService {
  /**
   * List dumpsters and bins with formatting
   * @param {Object} managers - Required managers (dumpster, bin)
   * @param {Object} options - Command options
   * @returns {Promise<Object>} Result object
   */
  async listHoard(managers, options = {}) {
    const results = {
      dumpsters: null,
      bins: null,
      hasDumpsters: false,
      hasBins: false,
      message: '',
    };

    try {
      // List dumpsters
      results.dumpsters = await this.listDumpstersWithFormatting(
        managers.dumpster,
        options.verbose
      );
      results.hasDumpsters = results.dumpsters.success && results.dumpsters.count > 0;

      // List bins
      results.bins = await this.listBinsWithFormatting(managers.bin, options.verbose);
      results.hasBins = results.bins.success && results.bins.count > 0;

      // Generate overall message
      results.message = this.generateHoardMessage(results);

      return this.createResult(true, results, results.message);
    } catch (error) {
      return this.createResult(false, null, 'Failed to list hoard', error);
    }
  }

  /**
   * List dumpsters with appropriate formatting
   * @param {DumpsterManager} dumpsterManager - Dumpster manager instance
   * @param {boolean} verbose - Whether to show detailed information
   * @returns {Promise<Object>} Formatted dumpster listing
   */
  async listDumpstersWithFormatting(dumpsterManager, verbose) {
    try {
      const dumpsters = await dumpsterManager.listDumpsters();

      if (dumpsters.length === 0) {
        return {
          success: false,
          message: 'No dumpsters found. Use "ddd dump" to process a ZIP file.',
          count: 0,
          data: null,
        };
      }

      const formattedData = verbose
        ? this.formatDumpstersTable(dumpsters)
        : this.formatDumpstersList(dumpsters);

      return {
        success: true,
        data: formattedData,
        count: dumpsters.length,
        dumpsters: dumpsters,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list dumpsters: ${error.message}`,
        count: 0,
        data: null,
      };
    }
  }

  /**
   * Format dumpsters as detailed table
   * @param {Array} dumpsters - Array of dumpster objects
   * @returns {string} Formatted table string
   */
  formatDumpstersTable(dumpsters) {
    const tableData = dumpsters.map(dumpster => ({
      name: dumpster.name,
      created: new Date(dumpster.createdAt).toLocaleDateString(),
      chats: dumpster.chatCount || 'unknown',
    }));

    return FormatUtils.formatTable(tableData, ['name', 'created', 'chats'], {
      padding: 2,
    });
  }

  /**
   * Format dumpsters as simple list
   * @param {Array} dumpsters - Array of dumpster objects
   * @returns {string} Formatted list string
   */
  formatDumpstersList(dumpsters) {
    let result = chalk.blue('🗑️ Available dumpsters:\n');

    dumpsters.forEach(dumpster => {
      result += `  ${chalk.green(dumpster.name)}\n`;
    });

    return result;
  }

  /**
   * List bins with appropriate formatting
   * @param {BinManager} bm - Bin manager instance
   * @param {boolean} verbose - Whether to show detailed information
   * @returns {Promise<Object>} Formatted bin listing
   */
  async listBinsWithFormatting(bm, verbose) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        return {
          success: true,
          message: '',
          count: 0,
          data: null,
        };
      }

      const formattedData = verbose
        ? this.formatBinsTable(bins)
        : this.formatBinsList(bins);

      return {
        success: true,
        data: formattedData,
        count: bins.length,
        bins: bins,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list bins: ${error.message}`,
        count: 0,
        data: null,
      };
    }
  }

  /**
   * Format bins as detailed table
   * @param {Array} bins - Array of bin objects
   * @returns {string} Formatted table string
   */
  formatBinsTable(bins) {
    const tableData = bins.map(bin => ({
      name: bin.name,
      created: new Date(bin.createdAt).toLocaleDateString(),
      chats: bin.chatCount,
      status: bin.isActive ? chalk.green('Active') : chalk.dim('Inactive'),
    }));

    return FormatUtils.formatTable(tableData, ['name', 'created', 'chats', 'status'], {
      padding: 2,
    });
  }

  /**
   * Format bins as simple list
   * @param {Array} bins - Array of bin objects
   * @returns {string} Formatted list string
   */
  formatBinsList(bins) {
    let result = chalk.blue('\n📋 Available bins:\n');

    bins.forEach(bin => {
      const status = bin.isActive ? chalk.green('(active)') : '';
      result += `  🗑️ ${chalk.cyan(bin.name)} (${bin.chatCount} chats) ${status}\n`;
    });

    return result;
  }

  /**
   * Generate overall hoard message
   * @param {Object} results - Hoard results object
   * @returns {string} Formatted message
   */
  generateHoardMessage(results) {
    let message = '';

    if (results.hasDumpsters) {
      message += this.formatSuccessMessage('Found', results.dumpsters.count, {
        type: 'dumpster',
        count: results.dumpsters.count,
      });
      message += '\n';

      if (results.dumpsters.data) {
        message += results.dumpsters.data;
      }
    } else {
      message += chalk.yellow(
        '🗑️ No dumpsters found. Use "ddd dump" to process a ZIP file.'
      );
      message += '\n';
    }

    if (results.hasBins) {
      message += this.formatSuccessMessage('Found', results.bins.count, {
        type: 'bin',
        count: results.bins.count,
      });
      message += '\n';

      if (results.bins.data) {
        message += results.bins.data;
      }
    }

    return message.trim();
  }

  /**
   * Get hoard command statistics
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      name: 'HoardService',
      version: VERSION,
      description: 'Handles dumpster and bin listing operations',
      capabilities: [
        'dumpster listing',
        'bin listing',
        'table formatting',
        'simple list formatting',
        'statistics aggregation',
      ],
    };
  }
}

module.exports = {
  HoardService,
};
