#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { ErrorHandler } = require('./utils/ErrorHandler');
const { SchemaValidator } = require('./utils/SchemaValidator');
const { createProgressManager } = require('./utils/ProgressManager');

const program = new Command();

program
  .name('ddd')
  .description('CLI tool to process and explore exported ChatGPT conversation data')
  .version('0.0.1');

program
  .command('dump')
  .description('Unpack and process a ChatGPT export ZIP file')
  .argument('<file>', 'path to the ZIP file')
  .option('-n, --name <name>', 'custom name for the dumpster', 'default')
  .option('-v, --verbose', 'verbose output')
  .action(async (file, options) => {
    const progressManager = createProgressManager(null, options.verbose);

    try {
      // Validate inputs
      SchemaValidator.validateRequired([{ name: 'file', value: file }], 'dump command');

      SchemaValidator.validateNonEmptyString(file, 'file', 'dump command');
      SchemaValidator.validateDumpsterName(options.name, { context: 'dump command' });

      await SchemaValidator.validatePath(file, {
        mustExist: true,
        context: 'dump command',
      });

      // Create progress spinner
      progressManager.start('initializing', 'Initializing dumpster creation...');

      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      const onProgress = progress => {
        progressManager.update(progress.stage, progress.progress, progress.message);
      };

      await dm.createDumpster(file, options.name, false, onProgress, {
        zipPath: file,
      });

      progressManager.succeed(`Dumpster "${options.name}" created successfully!`);
      ErrorHandler.logInfo(`Dumpster name: ${options.name}`, 'dump complete');
    } catch (error) {
      progressManager.fail(`Dumpster creation failed: ${error.message}`);

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
  .argument('<dumpster-name>', 'name of dumpster to view')
  .option('-l, --limit <number>', 'number of chats to show', '10')
  .action(async (dumpsterName, options) => {
    try {
      // Validate inputs
      SchemaValidator.validateRequired(
        [{ name: 'dumpsterName', value: dumpsterName }],
        'rummage command'
      );

      SchemaValidator.validateNonEmptyString(
        dumpsterName,
        'dumpsterName',
        'rummage command'
      );
      const limit = SchemaValidator.validateNumber(options.limit, 'limit', {
        min: 1,
        max: 100,
        context: 'rummage command',
      });

      const progressManager = createProgressManager(null, options.verbose);
      progressManager.start('initializing', `Loading chats from "${dumpsterName}"...`);

      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      const chats = await dm.getChats(dumpsterName, limit);

      if (chats.length === 0) {
        progressManager.warn(`No chats found in "${dumpsterName}"`);
        return;
      }

      progressManager.succeed(
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
  .argument('<dumpster-name>', 'name of dumpster to burn')
  .option('-f, --force', 'skip confirmation prompt')
  .option('--dry-run', 'show what would be burned without actually burning')
  .action(async (dumpsterName, options) => {
    const progressManager = createProgressManager(null, false); // No spinner for burn

    try {
      // Validate inputs
      SchemaValidator.validateRequired(
        [{ name: 'dumpsterName', value: dumpsterName }],
        'burn command'
      );

      SchemaValidator.validateNonEmptyString(
        dumpsterName,
        'dumpsterName',
        'burn command'
      );

      const force = SchemaValidator.validateBoolean(
        options.force,
        'force',
        'burn command'
      );
      const dryRun = SchemaValidator.validateBoolean(
        options.dryRun,
        'dryRun',
        'burn command'
      );

      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      // Check if dumpster exists
      const dumpster = dm.getDumpster(dumpsterName);
      if (!dumpster) {
        ErrorHandler.logError(
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
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise(resolve => {
          rl.question(
            chalk.red('Are you sure you want to watch this dumpster burn? (y/N): '),
            resolve
          );
        });
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(
            chalk.yellow('🔥 Fire extinguished - dumpster lives to see another day')
          );
          return;
        }
      }

      // Perform the burning
      console.log(chalk.red('🔥 Lighting the match...'));
      const success = await dm.deleteDumpster(dumpsterName);

      if (success) {
        progressManager.succeed(
          `Dumpster "${dumpsterName}" burned to ashes successfully!`
        );
        console.log(
          chalk.dim(
            `All ${chatCount} chats and ${sizeInMB}MB of data reduced to cinders`
          )
        );
      } else {
        progressManager.fail(
          `Failed to ignite dumpster "${dumpsterName}" - flames died out`
        );
        process.exit(1);
      }
    } catch (error) {
      progressManager.fail(`Failed to start dumpster fire: ${error.message}`);
      ErrorHandler.handleAsyncError(error, 'burning dumpster', null, false);
      process.exit(1);
    }
  });

program
  .command('upcycle')
  .description('Upcycle dumpsters to various formats')
  .argument('<format>', 'Export format: txt, md, html')
  .argument('<dumpster-name>', 'Name of dumpster to upcycle')
  .option('-o, --output <path>', 'Output directory', './upcycles')
  .option('-s, --single-file', 'Combine all chats into single file')
  .option('--per-chat', 'Create separate file per chat (default)')
  .option('--include-media', 'Copy media assets to export directory')
  .option('--self-contained', 'Embed assets in output (HTML only)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (format, dumpsterName, options) => {
    const progressManager = createProgressManager(null, options.verbose);

    try {
      // Validate required parameters
      SchemaValidator.validateRequired(
        [
          { name: 'format', value: format },
          { name: 'dumpsterName', value: dumpsterName },
        ],
        'upcycle command'
      );

      const normalizedFormat = SchemaValidator.validateExportFormat(
        format,
        ['txt', 'md', 'html'],
        'upcycle command'
      );
      SchemaValidator.validateNonEmptyString(
        dumpsterName,
        'dumpsterName',
        'upcycle command'
      );

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

      progressManager.start(
        'initializing',
        `Preparing to upcycle "${dumpsterName}" to ${normalizedFormat.toUpperCase()}...`
      );
      console.log(chalk.blue(`🔄 Upcycling dumpster: ${dumpsterName}`));
      console.log(chalk.dim(`Format: ${normalizedFormat.toUpperCase()}`));

      if (validatedOptions.verbose) {
        ErrorHandler.logInfo(
          `Options: ${JSON.stringify(validatedOptions, null, 2)}`,
          'upcycle'
        );
      }

      // Initialize UpcycleManager
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const UpcycleManager = require('./utils/UpcycleManager');

      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      const upcycleManager = new UpcycleManager(dm);

      // Check if dumpster exists
      const dumpsters = await dm.listDumpsters();
      const dumpster = dumpsters.find(d => d.name === dumpsterName);

      if (!dumpster) {
        progressManager.fail(`Dumpster "${dumpsterName}" not found`);
        ErrorHandler.logInfo('Available dumpsters:', 'upcycle');
        dumpsters.forEach(d => {
          console.log(`  ${chalk.green(d.name)} (${d.chatCount} chats)`);
        });
        process.exit(1);
      }

      // Perform upcycle with progress tracking
      const onProgress = progress => {
        progressManager.update(progress.stage, progress.progress, progress.message);
      };

      const result = await upcycleManager.upcycleDumpster(
        dumpsterName,
        normalizedFormat,
        { ...validatedOptions, onProgress }
      );

      // Display results
      const { generateExportReport } = require('./utils/upcycleHelpers');
      const report = generateExportReport(result);
      console.log(report);

      progressManager.succeed(
        `Upcycle of "${dumpsterName}" to ${normalizedFormat.toUpperCase()} complete!`
      );
    } catch (error) {
      progressManager.fail(`Upcycle failed: ${error.message}`);
      ErrorHandler.handleAsyncError(error, 'upcycling dumpster', null, false);
      process.exit(1);
    }
  });

program.parse();
