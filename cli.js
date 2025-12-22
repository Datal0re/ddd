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
      const FileSystemHelper = require('./utils/fsHelpers');
      if (!(await FileSystemHelper.fileExists(file))) {
        throw new Error(`File not found: ${file}`);
      }

      const { createProgressTracker } = require('./utils/progressTracker');
      const progressTracker = createProgressTracker(null, options.verbose);
      const onProgress = progress => {
        progressTracker.update(progress.stage, progress.progress, progress.message);
      };
      await dumpsterManager.createDumpster(file, options.name, false, onProgress);

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

program.parse();
