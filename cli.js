#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const logo = require('./logo');

const { ErrorHandler, FileNotFoundError } = require('./utils/ErrorHandler');
const { SchemaValidator } = require('./utils/SchemaValidator');
const { createProgressManager } = require('./utils/ProgressManager');
const { CliPrompts } = require('./utils/CliPrompts');
const { BinManager } = require('./utils/BinManager');
const { WizardUtils } = require('./utils/WizardUtils');

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

// Process-level error handling
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
  .version('0.0.5');

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
    const pm = createProgressManager(null, options.verbose);

    try {
      // Prompt for file path if not provided
      if (!file) {
        file = await CliPrompts.promptForFilePath();
      } else {
        SchemaValidator.validateRequired(
          [{ name: 'file', value: file }],
          'dump command'
        );
      }

      // Generate suggested name from file path if no name provided
      const path = require('path');
      const suggestedName = path.basename(file, '.zip');

      // Prompt for name if not provided
      if (!options.name || options.name === 'default') {
        options.name = await CliPrompts.promptForDumpsterName(suggestedName);
      } else {
        SchemaValidator.validateDumpsterName(options.name, { context: 'dump command' });
      }

      await SchemaValidator.validatePath(file, {
        mustExist: true,
        context: 'dump command',
      });

      // Create progress spinner
      pm.start('initializing', 'Initializing dumpster creation...');

      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      const onProgress = progress => {
        pm.update(progress.stage, progress.progress, progress.message);
      };

      const result = await dm.createDumpster(file, options.name, false, onProgress, {
        zipPath: file,
      });

      const stats = result.stats || {};
      const chatCount = stats.chats || 0;
      const assetCount = stats.assets || 0;

      pm.succeed(
        `Dumpster "${options.name}" created successfully!\n${chatCount} conversations processed, ${assetCount} assets extracted`
      );
    } catch (error) {
      pm.fail(`Dumpster creation failed: ${error.message}`);

      if (options.verbose) {
        console.error(error.stack);
      }

      ErrorHandler.handleErrorAndExit(error, 'dump command');
    }
  });

program
  .command('hoard')
  .description('View your dumpster hoard')
  .option('-v, --verbose', 'show detailed information')
  .action(async options => {
    try {
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      const dumpsters = await dm.listDumpsters();

      if (dumpsters.length === 0) {
        ErrorHandler.logWarning(
          'No dumpsters found. Use "ddd dump" to process a ZIP file.'
        );
        return;
      }

      // Show dumpsters first
      console.log(chalk.blue('🗑️ Available dumpsters:'));

      if (options.verbose) {
        // Show detailed table
        const tableData = dumpsters.map(dumpster => ({
          name: dumpster.name,
          created: new Date(dumpster.createdAt).toLocaleDateString(),
          chats: dumpster.chatCount || 'unknown',
        }));

        console.log(
          '\n' +
            require('./utils/CommonUtils').FormatUtils.formatTable(
              tableData,
              ['name', 'created', 'chats'],
              { padding: 2 }
            )
        );
      } else {
        // Show simple list
        dumpsters.forEach(dumpster => {
          console.log(`  ${chalk.green(dumpster.name)}`);
        });
      }

      ErrorHandler.logSuccess(
        `Found ${dumpsters.length} dumpster${dumpsters.length !== 1 ? 's' : ''}`,
        'hoard'
      );

      // Now show bins
      const bm = new BinManager(__dirname);
      await bm.initialize();
      const bins = bm.listBins();

      if (bins.length > 0) {
        console.log(chalk.blue('\n📋 Available bins:'));

        if (options.verbose) {
          const binTableData = bins.map(bin => ({
            name: bin.name,
            created: new Date(bin.createdAt).toLocaleDateString(),
            chats: bin.chatCount,
            status: bin.isActive ? chalk.green('Active') : chalk.dim('Inactive'),
          }));

          console.log(
            '\n' +
              require('./utils/CommonUtils').FormatUtils.formatTable(
                binTableData,
                ['name', 'created', 'chats', 'status'],
                { padding: 2 }
              )
          );
        } else {
          bins.forEach(bin => {
            const status = bin.isActive ? chalk.green('(active)') : '';
            console.log(
              `  🗑️ ${chalk.cyan(bin.name)} (${bin.chatCount} chats) ${status}`
            );
          });
        }

        ErrorHandler.logSuccess(
          `Found ${bins.length} bin${bins.length !== 1 ? 's' : ''}`,
          'hoard'
        );
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'listing dumpsters');
    }
  });

// Bin management commands
const binCommands = {
  /**
   * Create a new selection bin
   */
  async create(bm, name) {
    try {
      const binName = name || (await CliPrompts.promptForBinName());

      await bm.createBin(binName);
      console.log(chalk.green(`✅ Created bin "${binName}"`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create bin: ${error.message}`));
    }
  },

  /**
   * Delete (burn) a selection bin
   */
  async burn(bm, name) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins to burn.'));
        return;
      }

      const binName =
        name || (await CliPrompts.selectFromBins(bins, 'Select a bin to burn:'));

      const confirmed = await CliPrompts.confirmAction(
        `Burn bin "${binName}"? This will permanently delete all selected chats.`
      );

      if (confirmed) {
        await bm.deleteBin(binName);
        console.log(chalk.green(`🔥 Burned bin "${binName}" to ashes`));
      } else {
        console.log(chalk.yellow('💨 Bin burning cancelled.'));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to burn bin: ${error.message}`));
    }
  },

  /**
   * List all selection bins
   */
  async list(bm) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins found.'));
        console.log(
          chalk.dim('   💡 Tip: Use "ddd bin create <name>" to create your first bin.')
        );
        return;
      }

      console.log(chalk.blue('📋 Available bins:'));

      bins.forEach(bin => {
        const status = bin.isActive ? chalk.green('(active)') : '';
        console.log(`  🗑️ ${chalk.cyan(bin.name)} (${bin.chatCount} chats) ${status}`);
      });

      // Show current bin info
      const currentSummary = bm.getActiveBinSummary();
      console.log(`\n${chalk.dim(currentSummary)}`);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to list bins: ${error.message}`));
    }
  },

  /**
   * Rename a selection bin
   */
  async rename(bm, name) {
    try {
      const bins = bm.listBins();

      if (bins.length === 0) {
        console.log(chalk.yellow('📋 No bins to rename.'));
        return;
      }

      const oldName =
        name || (await CliPrompts.selectFromBins(bins, 'Select a bin to rename:'));
      const newName = await CliPrompts.promptForBinName('new');

      if (oldName === newName) {
        console.log(chalk.yellow('📋 Bin name is the same.'));
        return;
      }

      await bm.renameBin(oldName, newName);
      console.log(chalk.green(`✅ Renamed bin "${oldName}" to "${newName}"`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to rename bin: ${error.message}`));
    }
  },
};

program
  .command('bin')
  .description('Manage selection bins for organizing chat selections')
  .argument('[subcommand]', 'Subcommand: create, burn, list, rename')
  .argument('[name]', 'Bin name for create/rename operations (optional)')
  .action(async (subcommand, name) => {
    const { BinManager } = require('./utils/BinManager');
    const { DumpsterManager } = require('./utils/DumpsterManager');
    // const { CliPrompts } = require('./utils/CliPrompts');

    try {
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      const bm = new BinManager(__dirname);
      await bm.initialize();

      if (!subcommand) {
        // Default to list if no subcommand
        await binCommands.list(bm);
        return;
      }

      switch (subcommand.toLowerCase()) {
        case 'create':
          await binCommands.create(bm, name);
          break;
        case 'burn':
          await binCommands.burn(bm, name);
          break;
        case 'list':
          await binCommands.list(bm);
          break;
        case 'rename':
          await binCommands.rename(bm, name);
          break;
        default:
          console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
          console.log('Available subcommands: create, burn, list, rename');
          throw new Error(`Unknown bin subcommand: ${subcommand}`);
      }
    } catch (error) {
      ErrorHandler.handleErrorAndExit(error, 'bin operation');
    }
  });

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
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      // Initialize bin manager
      const bm = new BinManager(__dirname);
      await bm.initialize();

      // Get available dumpsters
      const dumpsters = await dm.listDumpsters();

      if (dumpsters.length === 0) {
        ErrorHandler.logWarning(
          'No dumpsters found. Use "ddd dump" to process a ZIP file.'
        );
        return;
      }

      console.log(chalk.blue('\n🧙‍♂️ Welcome to the Rummage Wizard!'));
      console.log(
        chalk.dim('This wizard will guide you through searching and selecting chats.')
      );

      // Start wizard-based rummaging
      await performWizardRummage(dm, bm, dumpsters, dumpsterName, options);
    } catch (error) {
      console.log(chalk.red('❌ Rummage wizard failed'));
      ErrorHandler.handleErrorAndExit(error, 'rummaging dumpster');
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
    const pm = createProgressManager(null, false); // No spinner for burn

    try {
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      // Get available dumpsters
      const dumpsters = await dm.listDumpsters();

      if (dumpsters.length === 0) {
        ErrorHandler.logWarning(
          'No dumpsters found. Use "ddd dump" to process a ZIP file.'
        );
        return;
      }

      // Prompt for dumpster selection if not provided
      if (!dumpsterName) {
        dumpsterName = await CliPrompts.selectFromDumpsters(
          dumpsters,
          'Select a dumpster to burn:'
        );
      } else {
        // Validate provided dumpster name
        SchemaValidator.validateRequired(
          [{ name: 'dumpsterName', value: dumpsterName }],
          'burn command'
        );
        SchemaValidator.validateNonEmptyString(
          dumpsterName,
          'dumpsterName',
          'burn command'
        );
      }

      // Handle optional boolean flags
      const force =
        options.force !== undefined
          ? SchemaValidator.validateBoolean(options.force, 'force', 'burn command')
          : false;
      const dryRun =
        options.dryRun !== undefined
          ? SchemaValidator.validateBoolean(options.dryRun, 'dryRun', 'burn command')
          : false;

      // Check if dumpster exists
      const dumpster = dm.getDumpster(dumpsterName);
      if (!dumpster) {
        throw new FileNotFoundError(dumpsterName, 'burn command');
      }

      // Get dumpster stats for confirmation
      const stats = await dm.getDumpsterStats(dumpsterName);
      const chatCount = stats?.chatCount || 'unknown';
      const sizeInMB = stats?.totalSize
        ? Math.round(stats.totalSize / (1024 * 1024))
        : 'unknown';

      console.log(chalk.yellow('🔥 Preparing to light a fire...'));
      console.log(chalk.dim(`Dumpster: ${dumpsterName}`));
      console.log(chalk.dim(`Chats to burn: ${chatCount}`));
      console.log(chalk.dim(`Data to destroy: ${sizeInMB}MB`));

      // Handle dry-run
      if (dryRun) {
        console.log(chalk.blue('🔥 Dry run: Would have burned this dumpster to ashes'));
        return;
      }

      // Confirm deletion unless force flag is used
      if (!force) {
        const shouldBurn = await CliPrompts.confirmAction(
          `Are you sure you want to permanently delete "${dumpsterName}"? \nThis will destroy ${chatCount} chats (${sizeInMB}MB) and cannot be undone.`
        );

        if (!shouldBurn) {
          console.log(
            chalk.yellow('💨 Fire extinguished - dumpster lives to see another day')
          );
          return;
        }

        // Additional safety challenge for destructive action
        await CliPrompts.promptForText(
          `Type "${dumpsterName}" to confirm deletion:`,
          input => {
            if (input !== dumpsterName) {
              return `Please type "${dumpsterName}" exactly to confirm`;
            }
            return true;
          }
        );
      }

      // Perform the burning
      console.log(chalk.red('🔥 Lighting the match...'));
      const success = await dm.deleteDumpster(dumpsterName);

      if (success) {
        pm.succeed(`Dumpster "${dumpsterName}" burned to ashes successfully!`);
        console.log(
          chalk.dim(
            `All ${chatCount} chats and ${sizeInMB}MB of data reduced to cinders`
          )
        );
      } else {
        const error = new Error(`Failed to burn dumpster "${dumpsterName}"`);
        pm.fail(`Failed to ignite dumpster "${dumpsterName}" - flames died out`);
        throw error;
      }
    } catch (error) {
      pm.fail(`Failed to start dumpster fire: ${error.message}`);
      ErrorHandler.handleErrorAndExit(error, 'burning dumpster');
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
    const pm = createProgressManager(null, options.verbose);

    try {
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      // Get available dumpsters
      const dumpsters = await dm.listDumpsters();

      if (dumpsters.length === 0) {
        ErrorHandler.logWarning(
          'No dumpsters found. Use "ddd dump" to process a ZIP file.'
        );
        return;
      }

      // Check selection bin status first to provide context
      const bm = new BinManager(__dirname);
      await bm.initialize();
      const chatsByDumpster = bm.getActiveBinChatsByDumpster();

      // Calculate totals from detailed chat data
      const allChats = Object.values(chatsByDumpster).flat();
      const totalCount = allChats.length;

      // Display selection bin status if it has content
      if (totalCount > 0 && !dumpsterName) {
        const totalMessages = allChats.reduce(
          (sum, chat) => sum + (chat.metadata?.messageCount || 0),
          0
        );
        const dumpsterCount = Object.keys(chatsByDumpster).length;

        console.log(chalk.blue(`\n📋 Selection Bin Status:`));
        console.log(`   ${totalCount} chats selected`);
        if (totalMessages > 0) {
          console.log(`   ${totalMessages} total messages`);
        }
        if (dumpsterCount > 0) {
          console.log(
            `   From ${dumpsterCount} dumpster${dumpsterCount !== 1 ? 's' : ''}`
          );
          // Show dumpsters with chat counts
          Object.entries(chatsByDumpster).forEach(([name, chats]) => {
            console.log(
              `   • ${name}: ${chats.length} chat${chats.length !== 1 ? 's' : ''}`
            );
          });
        }
        console.log();
      }

      // Prompt for format selection if not provided
      if (!format) {
        format = await CliPrompts.selectExportFormat();
      } else {
        // Validate provided format
        SchemaValidator.validateRequired(
          [{ name: 'format', value: format }],
          'upcycle command'
        );
        format = SchemaValidator.validateExportFormat(
          format,
          ['txt', 'md', 'html'],
          'upcycle command'
        );
      }

      // If no dumpster name provided, determine if we should use selection bin
      let exportSource = 'dumpster'; // Default
      if (!dumpsterName) {
        exportSource = await CliPrompts.promptUpcycleSource();

        if (exportSource === 'dumpster') {
          // Only prompt for dumpster if user chose dumpster export
          dumpsterName = await CliPrompts.selectFromDumpsters(
            dumpsters,
            'Select a dumpster to upcycle:'
          );
        }
      } else {
        // Validate provided dumpster name
        SchemaValidator.validateNonEmptyString(
          dumpsterName,
          'dumpsterName',
          'upcycle command'
        );
        exportSource = 'dumpster'; // Explicit dumpster name means dumpster export
      }

      // Validate options
      const validatedOptions = SchemaValidator.validateSchema(
        options,
        {
          output: { type: 'string', required: false },
          includeMedia: { type: 'boolean', required: false },
          selfContained: { type: 'boolean', required: false },
          verbose: { type: 'boolean', required: false },
        },
        'upcycle command'
      );

      pm.start(
        'initializing',
        `Preparing to upcycle "${dumpsterName}" to ${format.toUpperCase()}...`
      );

      // Log export source
      let selectedBinName = null;

      // Handle selection export
      if (exportSource === 'selection') {
        // Get bins with content for selection
        const bins = bm.listBins();
        const binsWithContent = bins.filter(bin => bin.chatCount > 0);

        if (binsWithContent.length === 0) {
          const error = new Error('No bins contain any chats to upcycle');
          pm.fail(error.message);
          throw error;
        }

        // If multiple bins have content, prompt for selection
        if (binsWithContent.length > 1) {
          selectedBinName = await CliPrompts.selectBinForUpcycle(binsWithContent);
        } else {
          selectedBinName = binsWithContent[0].name;
        }
      }

      if (validatedOptions.verbose) {
        if (exportSource === 'selection') {
          const selectedBin = bm.listBins().find(bin => bin.name === selectedBinName);
          console.log(
            chalk.blue(
              `🔄 Upcycling bin "${selectedBinName}" (${selectedBin.chatCount} chats)`
            )
          );
        } else {
          console.log(chalk.blue(`🔄 Upcycling dumpster: ${dumpsterName}`));
        }
        console.log(chalk.dim(`Format: ${format.toUpperCase()}`));
        ErrorHandler.logInfo(
          `Options: ${JSON.stringify(validatedOptions, null, 2)}`,
          'upcycle'
        );
      }

      // Initialize UpcycleManager
      const UpcycleManager = require('./utils/UpcycleManager');

      const upcycleManager = new UpcycleManager(dm, pm);

      // Perform upcycle with progress tracking
      const onProgress = progress => {
        pm.update(progress.stage, progress.progress, progress.message);
      };

      let result;
      if (exportSource === 'selection') {
        // Bin export - disable entire media directory copy
        result = await upcycleManager.upcycleBin(format, selectedBinName, {
          ...validatedOptions,
          outputDir: validatedOptions.output,
          onProgress,
          copyEntireMediaDir: false, // Only copy referenced assets for selection
        });
      } else {
        // Dumpster export - validate dumpster exists
        const dumpster = dumpsters.find(d => d.name === dumpsterName);

        if (!dumpster) {
          const error = new FileNotFoundError(dumpsterName, 'upcycle command');
          pm.fail(error.message);
          ErrorHandler.logInfo('Available dumpsters:');
          dumpsters.forEach(d => {
            console.log(`  ${chalk.green(d.name)} (${d.chatCount} chats)`);
          });
          throw error;
        }

        result = await upcycleManager.upcycleDumpster(dumpsterName, format, {
          ...validatedOptions,
          outputDir: validatedOptions.output,
          onProgress,
        });
      }

      // Display results
      const { generateExportReport } = require('./utils/upcycleHelpers');
      const report = generateExportReport(result, validatedOptions.verbose);

      if (validatedOptions.verbose) {
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

      const sourceDescription =
        exportSource === 'selection'
          ? `bin "${selectedBinName}" (${result.processed} chats)`
          : `"${dumpsterName}"`;

      pm.succeed(
        `Upcycle of ${sourceDescription} to ${format.toUpperCase()} complete!`
      );
    } catch (error) {
      pm.fail(`Upcycle failed: ${error.message}`);
      ErrorHandler.handleErrorAndExit(error, 'upcycling dumpster');
    }
  });

/**
 * Perform wizard-based rummaging through dumpsters
 * @param {DumpsterManager} dm - DumpsterManager instance
 * @param {BinManager} bm - BinManager instance
 * @param {Array} dumpsters - Available dumpsters
 * @param {string} initialDumpsterName - Initial dumpster name (optional)
 * @param {Object} options - Command options
 */
async function performWizardRummage(dm, bm, dumpsters, initialDumpsterName, options) {
  let continueRummaging = true;

  while (continueRummaging) {
    try {
      // Create wizard context with all required variables
      const initialContext = {
        dumpsterName: initialDumpsterName,
        verbose: options.verbose,
        actionType: null,
        selectedChats: [],
        selectedAction: null,
        emptySelectionAction: null,
      };

      // Execute wizard
      const wizardResult = await WizardUtils.executeWizard(
        WizardUtils.createRummageWizard(dm, bm, dumpsters),
        initialContext
      );

      // Process wizard results
      await handleWizardResults(wizardResult, dm, bm, options);

      // Determine if user wants to continue
      const action = wizardResult.selectedAction || wizardResult.emptySelectionAction;

      if (action === 'quit') {
        continueRummaging = false;
      } else if (action === 'upcycle') {
        continueRummaging = false;
      } else if (action === 'new-search' || action === 'switch-dumpster') {
        initialDumpsterName = null; // Reset for new selection
      }
    } catch (error) {
      console.log(chalk.red('❌ Wizard step failed'));
      ErrorHandler.handleErrorAndExit(error, 'wizard rummaging');
    }
  }

  console.log(chalk.blue('\n👋 Happy rummaging!'));
}

/**
 * Handle results from wizard
 * @param {Object} wizardResult - Results from wizard execution
 * @param {DumpsterManager} dm - DumpsterManager instance
 * @param {BinManager} bm - BinManager instance
 * @param {Object} _options - Command options (unused)
 */
async function handleWizardResults(wizardResult, dm, bm, _options) {
  const { dumpsterName, selectedChats, selectedAction, emptySelectionAction } =
    wizardResult;
  const action = selectedAction || emptySelectionAction;

  // Handle empty selection
  if (!selectedChats || selectedChats.length === 0) {
    // Handle navigation actions even with empty selection
    if (action === 'new-search') {
      console.log(chalk.blue('↻ Preparing new search...'));
      return;
    }
    if (action === 'switch-dumpster') {
      console.log(chalk.blue('🗑️ Switching dumpster...'));
      return;
    }
    if (action === 'quit') {
      console.log(chalk.blue('👋 Exiting rummage wizard...'));
      return;
    }
    return;
  }

  // Process selected action
  switch (action) {
    case 'add-to-bin':
      await handleAddToBin(bm, selectedChats, dumpsterName);
      break;
    case 'upcycle':
      await handleUpcycleSelected(selectedChats, dumpsterName, dm, bm);
      break;
    case 'new-search':
      console.log(chalk.blue('↻ Preparing new search...'));
      break;
    case 'switch-dumpster':
      console.log(chalk.blue('🗑️ Switching dumpster...'));
      break;
    case 'quit':
      console.log(chalk.blue('👋 Exiting rummage wizard...'));
      break;
    default:
      console.log(chalk.yellow(`⚠️ Unknown or unhandled action: ${action}`));
  }
}

/**
 * Handle adding chats to selection bin
 * @param {BinManager} bm - BinManager instance
 * @param {Array} chatObjects - Array of chat objects
 * @param {string} dumpsterName - Source dumpster name
 */
async function handleAddToBin(bm, chatObjects, dumpsterName) {
  try {
    const targetBin = await addChatsToSelection(bm, chatObjects, dumpsterName);
    console.log(
      chalk.green(
        `✅ Added ${chatObjects.length} chat${chatObjects.length !== 1 ? 's' : ''} to "${targetBin}" bin`
      )
    );
  } catch (error) {
    console.error(chalk.red(`❌ Failed to add chats to bin: ${error.message}`));
  }
}

/**
 * Handle upcycling selected chats
 * @param {Array} chatObjects - Array of chat objects
 * @param {string} dumpsterName - Source dumpster name
 * @param {DumpsterManager} dm - DumpsterManager instance
 * @param {BinManager} bm - BinManager instance
 */
async function handleUpcycleSelected(chatObjects, dumpsterName, dm, bm) {
  try {
    // Temporarily add selected chats to selection bin
    await addChatsToSelection(bm, chatObjects, dumpsterName);

    // Trigger upcycle command with selection bin
    console.log(chalk.blue('🔄 Starting upcycle with selected chats...'));

    const UpcycleManager = require('./utils/UpcycleManager');
    const upcycleManager = new UpcycleManager(dm);

    const format = await CliPrompts.selectExportFormat();
    const result = await upcycleManager.upcycleSelection(format, {
      includeMedia: true,
      verbose: true,
    });

    // Display results
    const { generateExportReport } = require('./utils/upcycleHelpers');
    const report = generateExportReport(result, true);
    console.log(report);
  } catch (error) {
    console.error(chalk.red(`❌ Failed to upcycle selected chats: ${error.message}`));
  }
}

/**
 * Legacy rummage workflow (kept for compatibility but should be unused)
 * @param {DumpsterManager} _dm - DumpsterManager instance (unused)
 * @param {BinManager} _bm - BinManager instance (unused)
 * @param {string} _dumpsterName - Name of dumpster to rummage (unused)
 * @param {Object} _options - Command options (unused)
 */
// eslint-disable-next-line no-unused-vars
async function performRummageWorkflow(_dm, _bm, _dumpsterName, _options) {
  console.log(
    chalk.yellow('⚠️  Legacy rummage workflow called - this should not happen')
  );
  return { noSelection: true };
}

/**
 * Add selected chats to selection bin
 * @param {BinManager} bm - BinManager instance
 * @param {Array} selectedChats - Array of selected chat objects
 * @param {string} dumpsterName - Source dumpster name
 */
async function addChatsToSelection(bm, selectedChats, dumpsterName) {
  // Get available bins for selection
  const availableBins = bm.listBins();

  // If only one bin (default), use it directly
  if (availableBins.length === 1) {
    const chatData = selectedChats.map(chat => ({
      chatId: chat.filename,
      filename: chat.filename,
      title: chat.title || 'Untitled',
      sourceDumpster: dumpsterName,
      addedAt: Date.now(),
      metadata: {
        messageCount: chat.messageCount || 0,
        createTime: chat.create_time,
        updateTime: chat.update_time,
        preview: chat.title || 'Untitled',
      },
    }));

    await bm.addChatsToActiveBin(chatData, dumpsterName);
    return availableBins[0].name;
  }

  // Prompt user to select which bin to add to
  const selectedBinName = await CliPrompts.selectBinForSelection(
    availableBins,
    selectedChats.length
  );

  let targetBinName = selectedBinName;

  // If user wants to create a new bin
  if (selectedBinName === 'create-new') {
    const newBinName = await CliPrompts.promptNewBinName();
    await bm.createBin(newBinName, `Created during rummage from ${dumpsterName}`);
    targetBinName = newBinName;
  }

  // Prepare chat data
  const chatData = selectedChats.map(chat => ({
    chatId: chat.filename,
    filename: chat.filename,
    title: chat.title || 'Untitled',
    sourceDumpster: dumpsterName,
    addedAt: Date.now(),
    metadata: {
      messageCount: chat.messageCount || 0,
      createTime: chat.create_time,
      updateTime: chat.update_time,
      preview: chat.title || 'Untitled',
    },
  }));

  // Add to the selected bin
  if (targetBinName === bm.getActiveBinName()) {
    await bm.addChatsToActiveBin(chatData, dumpsterName);
  } else {
    await bm.addChatsToBin(chatData, targetBinName, dumpsterName);
  }

  return targetBinName;
}

/**
 * Upcycle selected chats directly (legacy - unused)
 * @param {Array} _selectedChats - Array of selected chat objects (unused)
 * @param {string} _dumpsterName - Source dumpster name (unused)
 */
// eslint-disable-next-line no-unused-vars
async function upcycleSelectedChats(_selectedChats, _dumpsterName) {
  console.log(
    chalk.yellow('⚠️  Legacy upcycleSelectedChats called - this should not happen')
  );
}

/**
 * Display current selection bin status (legacy - unused)
 * @param {BinManager} _bm - BinManager instance (unused)
 */
// eslint-disable-next-line no-unused-vars
async function displaySelectionBinStatus(_bm) {
  console.log(
    chalk.yellow('⚠️  Legacy displaySelectionBinStatus called - this should not happen')
  );
}

/**
 * Prompt user to upcycle from current selection bin (legacy - unused)
 */
// eslint-disable-next-line no-unused-vars
async function promptUpcycleFromSelection() {
  console.log(
    chalk.yellow(
      '⚠️  Legacy promptUpcycleFromSelection called - this should not happen'
    )
  );
}

program.parse();
