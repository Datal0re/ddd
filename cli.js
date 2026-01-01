#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const logo = require('./logo');
const { VERSION } = require('./config/constants');

const { ErrorHandler } = require('./utils/ErrorHandler');

// Service layer imports
const { CommandInitService } = require('./utils/services/CommandInitService');
const { DumpService } = require('./utils/services/DumpService');
const { HoardService } = require('./utils/services/HoardService');
const { BurnService } = require('./utils/services/BurnService');
const { UpcycleService } = require('./utils/services/UpcycleService');
const { RummageService } = require('./utils/services/RummageService');

const program = new Command();

// Process-level error handling for unexpected errors
process.on('uncaughtException', error => {
  ErrorHandler.logError('Uncaught Exception');
  ErrorHandler.logError(error.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }

  process.exit(99); // Fatal error
});

process.on('unhandledRejection', (reason, promise) => {
  ErrorHandler.logError('Unhandled Promise Rejection');
  ErrorHandler.logError(reason);

  if (process.env.NODE_ENV === 'development') {
    console.error('Promise:', promise);
  }

  process.exit(98); // Promise rejection
});

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log(
    chalk.yellow('\n👋 Received interrupt signal. Gracefully shutting down...')
  );
  process.exit(130); // Standard exit code for SIGINT
});

process.on('SIGTERM', () => {
  console.log(
    chalk.yellow('\n👋 Received termination signal. Gracefully shutting down...')
  );
  process.exit(143); // Standard exit code for SIGTERM
});

program
  .name('ddd')
  .description(
    `${logo}

CLI tool to process and explore exported ChatGPT conversation data
`
  )
  .version(VERSION);

program
  .command('dump')
  .description('Unpack and process a ChatGPT export ZIP file')
  .argument('[file]', 'path to the ZIP file (optional - will prompt if not provided)')
  .option(
    '-n, --name <name>',
    'custom name for the dumpster (optional - will prompt if not provided)'
  )
  .option('-v, --verbose', 'verbose output')
  .action(async (file, options) => {
    try {
      // Initialize service layer
      const initService = new CommandInitService(__dirname);
      const managers = await initService.initializeCommand('dump', options);
      const dumpService = new DumpService(__dirname);

      // Use service for dumpster creation
      const result = await dumpService.createDumpster(
        file,
        options.name,
        options,
        managers
      );

      if (!result.success) {
        throw new Error(result.message || 'Dumpster creation failed');
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'dump command');
    }
  });

(program
  .command('hoard')
  .description('View your dumpster hoard')
  .option('-v, --verbose', 'show detailed information')
  .action(async options => {
    try {
      // Initialize service layer
      const initService = new CommandInitService(__dirname);
      const managers = await initService.initializeCommand('hoard', options);
      const hoardService = new HoardService(__dirname);

      // Use service for hoard listing
      const result = await hoardService.listHoard(managers, options);

      if (!result.success) {
        ErrorHandler.handleErrorAndExit(
          result.error || new Error(result.message),
          'hoard command'
        );
      }

      // Display the hoard listing
      if (result.message) {
        console.log(result.message);
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'hoard command');
    }
  }),
  program
    .command('bin')
    .description('Manage selection bins for organizing chat selections')
    .argument('[subcommand]', 'Subcommand: create, burn, list, rename')
    .argument('[name]', 'Bin name for create/rename operations (optional)')
    .option('-v, --verbose', 'Verbose output')
    .action(async (subcommand, name) => {
      try {
        const { BinService } = require('./utils/services/BinService');

        // Initialize service layer
        const initService = new CommandInitService(__dirname);
        const managers = await initService.initializeCommand('bin');
        const binService = new BinService(__dirname);
        // Execute bin subcommand through service
        const result = await binService.executeBinCommand(subcommand, name, managers);
        if (!result.success) {
          const error =
            result.error instanceof Error
              ? result.error
              : new Error(result.message || 'Unknown error occurred');
          ErrorHandler.handleErrorAndExit(error, 'bin command');
        }
      } catch (error) {
        ErrorHandler.handleErrorAndExit(error, 'bin command');
      }
    }));

program
  .command('rummage')
  .description(
    'Rummage through chats in a dumpster with wizard-guided search and selection'
  )
  .argument(
    '[dumpster-name]',
    'name of dumpster to rummage through (optional - will prompt for selection)'
  )
  .option('-v, --verbose', 'Verbose output')
  .action(async (dumpsterName, options) => {
    try {
      // Initialize service layer
      const initService = new CommandInitService(__dirname);
      const managers = await initService.initializeCommand('rummage', options);
      const rummageService = new RummageService(__dirname);

      // Use service for wizard rummaging
      const result = await rummageService.performWizardRummage(
        dumpsterName,
        options,
        managers
      );

      if (!result.success && result.error) {
        ErrorHandler.handleErrorAndExit(result.error, 'rummage command');
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'rummage command');
    }
  });

program
  .command('burn')
  .description('Set a dumpster on fire - watch it burn to ashes')
  .argument(
    '[dumpster-name]',
    'name of dumpster to burn (optional - will prompt for selection)'
  )
  .option('-f, --force', 'skip confirmation prompt')
  .option('--dry-run', 'show what would be burned without actually burning')
  .action(async (dumpsterName, options) => {
    try {
      // Initialize service layer
      const initService = new CommandInitService(__dirname);
      const managers = await initService.initializeCommand('burn', options);
      const burnService = new BurnService(__dirname);

      // Use service for dumpster burning
      const result = await burnService.burnDumpster(dumpsterName, options, managers);

      if (!result.success) {
        ErrorHandler.handleErrorAndExit(
          result.error || new Error(result.message),
          'burn command'
        );
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'burn command');
    }
  });

program
  .command('upcycle')
  .description('Upcycle dumpsters to various formats')
  .argument(
    '[format]',
    'Export format: txt, md, html (optional - will prompt for selection)'
  )
  .argument(
    '[dumpster-name]',
    'Name of dumpster to upcycle (optional - will prompt for selection)'
  )
  .option('-o, --output <path>', 'Output directory', './data/upcycle-bin')
  .option('--include-media', 'Copy media assets to export directory', true)
  .option('--self-contained', 'Embed assets in output (HTML only)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (format, dumpsterName, options) => {
    try {
      // Initialize service layer
      const initService = new CommandInitService(__dirname);
      const managers = await initService.initializeCommand('upcycle', options);
      const upcycleService = new UpcycleService(__dirname);

      // Use service for upcycle export
      const result = await upcycleService.upcycleExport(
        format,
        dumpsterName,
        options,
        managers
      );

      if (!result.success) {
        ErrorHandler.handleErrorAndExit(
          result.error || new Error(result.message),
          'upcycle command'
        );
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'upcycle command');
    }
  });

program.parse();
