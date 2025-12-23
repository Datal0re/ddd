#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

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
    try {
      console.log(`Dumping ChatGPT export: ${chalk.blue(file)}`);

      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dumpsterManager = new DumpsterManager(__dirname);
      await dumpsterManager.initialize();

      // Check if file exists
      const FileSystemHelper = require('./utils/FileSystemHelper');
      if (!(await FileSystemHelper.fileExists(file))) {
        throw new Error(`File not found: ${file}`);
      }

      const { createProgressTracker } = require('./utils/ProgressTracker');
      const progressTracker = createProgressTracker(null, options.verbose);
      const onProgress = progress => {
        progressTracker.update(progress.stage, progress.progress, progress.message);
      };
      await dumpsterManager.createDumpster(file, options.name, false, onProgress, {
        zipPath: file,
      });

      console.log(chalk.green('✅ Dumpster created successfully!'));
      console.log(chalk.dim(`Dumpster name: ${options.name}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
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
      const dumpsterManager = new DumpsterManager(__dirname);
      await dumpsterManager.initialize();

      const dumpsters = await dumpsterManager.listDumpsters();

      if (dumpsters.length === 0) {
        console.log(
          chalk.yellow('No dumpsters found. Use "ddd dump" to process a ZIP file.')
        );
        return;
      }

      console.log(chalk.blue('🗑️ Available dumpsters:'));
      dumpsters.forEach(dumpster => {
        const details = options.verbose
          ? ` (${new Date(dumpster.createdAt).toLocaleDateString()}, ${dumpster.chatCount} chats)`
          : '';
        console.log(`  ${chalk.green(dumpster.name)}${details}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error listing exports:'), error.message);
      process.exit(1);
    }
  });

program
  .command('rummage')
  .description('Rummage through chats in a dumpster')
  .argument('<dumpster-name>', 'name of the dumpster to view')
  .option('-l, --limit <number>', 'number of chats to show', '10')
  .action(async (dumpsterName, options) => {
    try {
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dumpsterManager = new DumpsterManager(__dirname);
      await dumpsterManager.initialize();

      const chats = await dumpsterManager.getChats(
        dumpsterName,
        parseInt(options.limit)
      );

      if (chats.length === 0) {
        console.log(chalk.yellow('No chats found in this dumpster.'));
        return;
      }

      console.log(chalk.blue(`💬 Chats in ${dumpsterName}:`));
      chats.forEach((chat, index) => {
        const title = chat.title || `Chat ${index + 1}`;
        console.log(`  ${index + 1}. ${chalk.green(title)}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error rummaging dumpster:'), error.message);
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
    try {
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dumpsterManager = new DumpsterManager(__dirname);
      await dumpsterManager.initialize();

      // Check if dumpster exists
      const dumpster = dumpsterManager.getDumpster(dumpsterName);
      if (!dumpster) {
        console.error(chalk.red('🚨 Dumpster not found - nothing to burn'));
        process.exit(1);
      }

      // Get dumpster stats for confirmation
      const stats = await dumpsterManager.getDumpsterStats(dumpsterName);
      const chatCount = stats?.chatCount || 'unknown';
      const sizeInMB = stats?.totalSize
        ? Math.round(stats.totalSize / 1024 / 1024)
        : 'unknown';

      console.log(chalk.yellow('🔥 Preparing to light a fire...'));
      console.log(chalk.dim(`Dumpster: ${dumpsterName}`));
      console.log(chalk.dim(`Chats to burn: ${chatCount}`));
      console.log(chalk.dim(`Data to destroy: ${sizeInMB}MB`));

      // Handle dry-run
      if (options.dryRun) {
        console.log(chalk.blue('🔥 Dry run: Would have burned this dumpster to ashes'));
        return;
      }

      // Confirm deletion unless force flag is used
      if (!options.force) {
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
      const success = await dumpsterManager.deleteDumpster(dumpsterName);

      if (success) {
        console.log(chalk.green('🔥 Dumpster burned to ashes successfully!'));
        console.log(
          chalk.dim(
            `All ${chatCount} chats and ${sizeInMB}MB of data reduced to cinders`
          )
        );
      } else {
        console.error(chalk.red('🚨 Failed to ignite dumpster - flames died out'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('🚨 Failed to start dumpster fire:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
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
    try {
      // Validate required parameters
      if (!format || !dumpsterName) {
        console.error(chalk.red('❌ Both format and dumpster-name are required'));
        console.log(
          chalk.yellow('Usage: node cli.js upcycle <format> <dumpster-name>')
        );
        process.exit(1);
      }

      console.log(chalk.blue(`🔄 Upcycling dumpster: ${dumpsterName}`));
      console.log(chalk.dim(`Format: ${format.toUpperCase()}`));

      if (options.verbose) {
        console.log(chalk.dim('Options:'), options);
      }

      // Validate format
      const validFormats = ['txt', 'md', 'html'];
      if (!validFormats.includes(format.toLowerCase())) {
        console.error(chalk.red(`❌ Invalid format: ${format}`));
        console.error(chalk.yellow(`Available formats: ${validFormats.join(', ')}`));
        process.exit(1);
      }

      // Initialize UpcycleManager
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const UpcycleManager = require('./utils/UpcycleManager');

      const dumpsterManager = new DumpsterManager(__dirname);
      await dumpsterManager.initialize();

      const upcycleManager = new UpcycleManager(dumpsterManager);

      // Check if dumpster exists
      const dumpsters = await dumpsterManager.listDumpsters();
      const dumpster = dumpsters.find(d => d.name === dumpsterName);

      if (!dumpster) {
        console.error(chalk.red(`🚨 Dumpster "${dumpsterName}" not found`));
        console.log(chalk.yellow('Available dumpsters:'));
        dumpsters.forEach(d => {
          console.log(`  ${chalk.green(d.name)} (${d.chatCount} chats)`);
        });
        process.exit(1);
      }

      // Perform upcycle
      const result = await upcycleManager.upcycleDumpster(
        dumpsterName,
        format.toLowerCase(),
        options
      );

      // Display results
      const { generateExportReport } = require('./utils/upcycleHelpers');
      const report = generateExportReport(result);
      console.log(report);

      console.log(chalk.green('✅ Upcycle complete!'));
    } catch (error) {
      console.error(chalk.red('❌ Error upcycling dumpster:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
