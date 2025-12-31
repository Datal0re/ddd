/**
 * Command Initialization Service
 * Centralizes all manager instantiation and initialization
 * Provides dependency injection and manager caching
 */

const { ErrorHandler } = require('../ErrorHandler');
const { createProgressManager } = require('../ProgressManager');

/**
 * Service for centralized command initialization
 * Handles manager instantiation, caching, and dependency injection
 */
class CommandInitializationService {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.managers = new Map();
  }

  /**
   * Get or create a manager of specified type
   * @param {string} type - Type of manager ('dumpster', 'bin', 'progress', 'upcycle')
   * @param {Object} options - Options for manager creation
   * @returns {Promise<Object>} Manager instance
   * @throws {Error} If manager type is unknown or creation fails
   */
  async getManager(type, options = {}) {
    const cacheKey = `${type}_${JSON.stringify(options)}`;

    // Return cached manager if available
    if (this.managers.has(cacheKey)) {
      return this.managers.get(cacheKey);
    }

    let manager;

    try {
      switch (type) {
        case 'dumpster':
          manager = await this.createDumpsterManager();
          break;

        case 'bin':
          manager = await this.createBinManager();
          break;

        case 'progress':
          manager = this.createProgressManager(options);
          break;

        case 'upcycle':
          manager = await this.createUpcycleManager(options);
          break;

        default:
          throw new Error(`Unknown manager type: ${type}`);
      }

      this.managers.set(cacheKey, manager);
      ErrorHandler.logInfo(`Created ${type} manager`, 'CommandInitializationService');
      return manager;
    } catch (error) {
      ErrorHandler.logError(
        `Failed to create ${type} manager: ${error.message}`,
        'CommandInitializationService'
      );
      throw error;
    }
  }

  /**
   * Create and initialize DumpsterManager
   * @returns {Promise<DumpsterManager>} Initialized DumpsterManager instance
   */
  async createDumpsterManager() {
    const { DumpsterManager } = require('../DumpsterManager');
    const manager = new DumpsterManager(this.baseDir);
    await manager.initialize();
    return manager;
  }

  /**
   * Create and initialize BinManager
   * @returns {Promise<BinManager>} Initialized BinManager instance
   */
  async createBinManager() {
    const { BinManager } = require('../BinManager');
    const manager = new BinManager(this.baseDir);
    await manager.initialize();
    return manager;
  }

  /**
   * Create ProgressManager with options
   * @param {Object} options - ProgressManager options
   * @returns {Object} ProgressManager instance
   */
  createProgressManager(options = {}) {
    const { onProgress = null, verbose = false } = options;
    return createProgressManager(onProgress, verbose);
  }

  /**
   * Create and initialize UpcycleManager
   * @param {Object} options - UpcycleManager options
   * @returns {Promise<UpcycleManager>} Initialized UpcycleManager instance
   */
  async createUpcycleManager(options = {}) {
    const { UpcycleManager } = require('../UpcycleManager');

    // Get required managers
    const dumpsterManager = await this.getManager('dumpster');
    const progressManager = this.createProgressManager(options);

    const manager = new UpcycleManager(dumpsterManager, progressManager);

    // Initialize bin manager if needed
    if (options.initializeBinManager) {
      await manager.initializeBinManager();
    }

    return manager;
  }

  /**
   * Initialize all required managers for a specific command
   * @param {string} commandType - Type of command ('dump', 'hoard', 'bin', 'rummage', 'burn', 'upcycle')
   * @param {Object} options - Command-specific options
   * @returns {Promise<Object>} Object containing all required managers
   * @throws {Error} If command type is unknown
   */
  async initializeCommand(commandType, options = {}) {
    const requiredManagers = this.getRequiredManagers(commandType);
    const managers = {};

    // Initialize each required manager
    for (const managerType of requiredManagers) {
      try {
        managers[managerType] = await this.getManager(managerType, {
          ...options,
          commandType,
        });
      } catch (error) {
        ErrorHandler.logError(
          `Failed to initialize ${managerType} for ${commandType}: ${error.message}`,
          'CommandInitializationService'
        );
        throw new Error(
          `Command initialization failed for ${commandType}: ${error.message}`
        );
      }
    }

    ErrorHandler.logInfo(
      `Initialized ${commandType} command with managers: ${Object.keys(managers).join(', ')}`,
      'CommandInitializationService'
    );
    return managers;
  }

  /**
   * Get list of required managers for each command type
   * @param {string} commandType - Type of command
   * @returns {Array<string>} Array of required manager types
   */
  getRequiredManagers(commandType) {
    const requirements = {
      dump: ['dumpster', 'progress'],
      hoard: ['dumpster', 'bin'],
      bin: ['dumpster', 'bin'],
      rummage: ['dumpster', 'bin'],
      burn: ['dumpster', 'progress'],
      upcycle: ['dumpster', 'bin', 'progress', 'upcycle'],
    };

    const required = requirements[commandType];
    if (!required) {
      throw new Error(`Unknown command type: ${commandType}`);
    }

    return required;
  }

  /**
   * Get statistics about manager usage and caching
   * @returns {Object} Manager usage statistics
   */
  getManagerStats() {
    const stats = {
      totalManagers: this.managers.size,
      cachedManagers: this.managers.size,
      managerTypes: {},
    };

    for (const key of this.managers.keys()) {
      const type = key.split('_')[0];
      stats.managerTypes[type] = (stats.managerTypes[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear cached managers (useful for testing or memory management)
   * @param {string} type - Specific manager type to clear, or undefined to clear all
   */
  clearCache(type = null) {
    if (type) {
      // Clear specific type
      const keysToDelete = [];
      for (const key of this.managers.keys()) {
        if (key.startsWith(`${type}_`)) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.managers.delete(key);
      }

      ErrorHandler.logInfo(
        `Cleared ${keysToDelete.length} cached ${type} managers`,
        'CommandInitializationService'
      );
    } else {
      // Clear all managers
      const count = this.managers.size;
      this.managers.clear();
      ErrorHandler.logInfo(
        `Cleared all ${count} cached managers`,
        'CommandInitializationService'
      );
    }
  }

  /**
   * Clean up all managers and perform shutdown operations
   */
  async cleanup() {
    const managerCount = this.managers.size;

    // Call cleanup on managers that have it
    for (const [key, manager] of this.managers.entries()) {
      if (typeof manager.cleanup === 'function') {
        try {
          await manager.cleanup();
        } catch (error) {
          ErrorHandler.logError(
            `Error during manager cleanup for ${key}: ${error.message}`,
            'CommandInitializationService'
          );
        }
      }
    }

    this.managers.clear();
    ErrorHandler.logInfo(
      `Cleaned up ${managerCount} managers`,
      'CommandInitializationService'
    );
  }
}

module.exports = {
  CommandInitializationService,
};
