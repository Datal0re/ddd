#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const program = new Command();

program
  .name('ddd')
  .description('CLI tool to process and explore exported ChatGPT conversation data')
  .version('2.0.0-alpha');

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
      const fs = require('fs');
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      const onProgress = progress => {
        console.log(`${progress.stage}: ${progress.progress}% - ${progress.message}`);
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
  .command('inventory')
  .description('List all processed dumpsters')
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
  .argument('<export-name>', 'name of the export to view')
  .option('-l, --limit <number>', 'number of conversations to show', '10')
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

program.parse();
