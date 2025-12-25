#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { input, select, confirm } = require('@inquirer/prompts');
const { ErrorHandler } = require('./utils/ErrorHandler');
const { SchemaValidator } = require('./utils/SchemaValidator');
const { createProgressManager } = require('./utils/ProgressManager');

const program = new Command();

program
  .name('ddd')
  .description('CLI tool to process and explore exported ChatGPT conversation data')
  .version('0.0.2');

// Helper functions for common prompt patterns
async function promptForFilePath() {
  return await input({
    message: 'Enter the path to your ChatGPT export ZIP file:',
    validate: async input => {
      if (!input.trim()) return 'Please enter a file path';
      if (!input.endsWith('.zip')) return 'Please provide a ZIP file';
      try {
        const fs = require('fs').promises;
        await fs.access(input);
        return true;
      } catch {
        return 'File not found. Please check the path and try again.';
      }
    },
  });
}

async function promptForDumpsterName(defaultName) {
  return await input({
    message: 'Enter a name for this dumpster:',
    default: defaultName,
    validate: input => {
      if (!input.trim()) return 'Please enter a name';
      SchemaValidator.validateDumpsterName(input, { context: 'dump command' });
      return true;
    },
  });
}

async function selectFromDumpsters(dumpsters, message) {
  return await select({
    message,
    choices: dumpsters.map(d => ({
      name: `${d.name} (${d.chatCount || '?'} chats)`,
      value: d.name,
    })),
  });
}

async function selectExportFormat() {
  return await select({
    message: 'Choose export format:',
    choices: [
      {
        name: '📄 Plain Text (.txt) - Simple, universal format',
        value: 'txt',
      },
      {
        name: '📝 Markdown (.md) - Great for documentation and GitHub',
        value: 'md',
      },
      {
        name: '🌐 HTML (.html) - Rich formatting with styling',
        value: 'html',
      },
    ],
  });
}

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
        file = await promptForFilePath();
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
        options.name = await promptForDumpsterName(suggestedName);
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

      ErrorHandler.handleFileError(error, 'dump command', false);
      process.exit(1);
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
    } catch (error) {
      ErrorHandler.handleAsyncError(error, 'listing dumpsters', null, false);
      process.exit(1);
    }
  });

program
  .command('rummage')
  .description('Rummage through chats in a dumpster')
  .argument(
    '[dumpster-name]',
    'name of dumpster to view (optional - will prompt for selection)'
  )
  .option(
    '-l, --limit <number>',
    'number of chats to show (optional - will prompt if not provided)'
  )
  .action(async (dumpsterName, options) => {
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
        dumpsterName = await selectFromDumpsters(
          dumpsters,
          'Select a dumpster to rummage through:'
        );
      } else {
        // Validate provided dumpster name
        SchemaValidator.validateRequired(
          [{ name: 'dumpsterName', value: dumpsterName }],
          'rummage command'
        );
        SchemaValidator.validateNonEmptyString(
          dumpsterName,
          'dumpsterName',
          'rummage command'
        );
      }

      // Prompt for limit if not provided
      let limit;
      if (!options.limit) {
        limit = parseInt(
          await input({
            message: 'How many chats would you like to see?',
            default: '10',
            validate: input => {
              const num = parseInt(input);
              if (isNaN(num)) return 'Please enter a number';
              if (num < 1) return 'Must show at least 1 chat';
              if (num > 100) return 'Maximum 100 chats at once';
              return true;
            },
          })
        );
      } else {
        limit = SchemaValidator.validateNumber(options.limit, 'limit', {
          min: 1,
          max: 100,
          context: 'rummage command',
        });
      }

      const pm = createProgressManager(progress => {
        // Allow both spinner updates and progress tracking
        if (options.verbose) {
          console.log(
            `[${progress.stage}] ${progress.message} (${Math.round(progress.progress)}%)`
          );
        }
      }, options.verbose);
      pm.start('initializing', `Loading chats from "${dumpsterName}"...`);

      const chats = await dm.getChats(dumpsterName, limit);

      if (chats.length === 0) {
        pm.warn(`No chats found in "${dumpsterName}"`);
        return;
      }

      pm.succeed(
        `Found ${chats.length} chat${chats.length !== 1 ? 's' : ''} in "${dumpsterName}"`
      );
      console.log(chalk.blue(`💬 Chats in ${dumpsterName}:`));

      chats.forEach((chat, index) => {
        const title = chat.title || `Chat ${index + 1}`;
        const timestamp =
          require('./utils/CommonUtils').TimestampUtils.extractTimestamp(chat);
        const dateStr = timestamp
          ? ` (${require('./utils/CommonUtils').TimestampUtils.formatTimestamp(timestamp, 'date')})`
          : '';

        console.log(`  ${index + 1}. ${chalk.green(title)}${chalk.dim(dateStr)}`);
      });
    } catch (error) {
      ErrorHandler.handleAsyncError(error, 'rummaging dumpster', null, false);
      process.exit(1);
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
        dumpsterName = await selectFromDumpsters(
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
        ErrorHandler.handleFileError(
          `Dumpster "${dumpsterName}" not found - nothing to burn`,
          'burn command'
        );
        process.exit(1);
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
        const shouldBurn = await confirm({
          message: `Are you sure you want to permanently delete "${dumpsterName}"? This will destroy ${chatCount} chats (${sizeInMB}MB) and cannot be undone.`,
          default: false,
        });

        if (!shouldBurn) {
          console.log(
            chalk.yellow('🔥 Fire extinguished - dumpster lives to see another day')
          );
          return;
        }

        // Additional safety challenge for destructive action
        await input({
          message: `Type "${dumpsterName}" to confirm deletion:`,
          validate: input => {
            if (input !== dumpsterName) {
              return `Please type "${dumpsterName}" exactly to confirm`;
            }
            return true;
          },
        });
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
        pm.fail(`Failed to ignite dumpster "${dumpsterName}" - flames died out`);
        process.exit(1);
      }
    } catch (error) {
      pm.fail(`Failed to start dumpster fire: ${error.message}`);
      ErrorHandler.handleAsyncError(error, 'burning dumpster', null, false);
      process.exit(1);
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
  .option('-o, --output <path>', 'Output directory', './upcycles')
  .option('-s, --single-file', 'Combine all chats into single file')
  .option('--per-chat', 'Create separate file per chat (default)')
  .option('--include-media', 'Copy media assets to export directory')
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

      // Prompt for format selection if not provided
      if (!format) {
        format = await selectExportFormat();
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

      // Prompt for dumpster selection if not provided
      if (!dumpsterName) {
        dumpsterName = await selectFromDumpsters(
          dumpsters,
          'Select a dumpster to upcycle:'
        );
      } else {
        // Validate provided dumpster name
        SchemaValidator.validateNonEmptyString(
          dumpsterName,
          'dumpsterName',
          'upcycle command'
        );
      }

      // Validate options
      const validatedOptions = SchemaValidator.validateSchema(
        options,
        {
          output: { type: 'string', required: false },
          singleFile: { type: 'boolean', required: false },
          perChat: { type: 'boolean', required: false },
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
      console.log(chalk.blue(`🔄 Upcycling dumpster: ${dumpsterName}`));
      console.log(chalk.dim(`Format: ${format.toUpperCase()}`));

      if (validatedOptions.verbose) {
        ErrorHandler.logInfo(
          `Options: ${JSON.stringify(validatedOptions, null, 2)}`,
          'upcycle'
        );
      }

      // Initialize UpcycleManager
      const UpcycleManager = require('./utils/UpcycleManager');

      const upcycleManager = new UpcycleManager(dm);

      // Check if dumpster exists
      const dumpster = dumpsters.find(d => d.name === dumpsterName);

      if (!dumpster) {
        pm.fail(`Dumpster "${dumpsterName}" not found`);
        ErrorHandler.logInfo('Available dumpsters:', 'upcycle');
        dumpsters.forEach(d => {
          console.log(`  ${chalk.green(d.name)} (${d.chatCount} chats)`);
        });
        process.exit(1);
      }

      // Perform upcycle with progress tracking
      const onProgress = progress => {
        pm.update(progress.stage, progress.progress, progress.message);
      };

      const result = await upcycleManager.upcycleDumpster(dumpsterName, format, {
        ...validatedOptions,
        onProgress,
      });

      // Display results
      const { generateExportReport } = require('./utils/upcycleHelpers');
      const report = generateExportReport(result);
      console.log(report);

      pm.succeed(`Upcycle of "${dumpsterName}" to ${format.toUpperCase()} complete!`);
    } catch (error) {
      pm.fail(`Upcycle failed: ${error.message}`);
      ErrorHandler.handleAsyncError(error, 'upcycling dumpster', null, false);
      process.exit(1);
    }
  });

program.parse();
