#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const program = new Command();

program
  .name('ddd')
  .description('CLI tool to process and explore exported ChatGPT conversation data')
  .version('2.0.0-alpha');

program
  .command('dump')
  .description('Upload and process a ChatGPT export ZIP file')
  .argument('<file>', 'path to the ZIP file')
  .option('-n, --name <name>', 'custom name for the export', 'default')
  .option('-v, --verbose', 'verbose output')
  .action(async (file, options) => {
    try {
      console.log(`Processing ChatGPT export: ${chalk.blue(file)}`);

      const { ExportManager } = require('./utils/ExportManager');
      const exportManager = new ExportManager(__dirname);
      await exportManager.initialize();

      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      await exportManager.createExport(file, options.name);

      console.log(chalk.green('✅ Export processed successfully!'));
      console.log(chalk.dim(`Export name: ${options.name}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all processed exports')
  .option('-v, --verbose', 'show detailed information')
  .action(async options => {
    try {
      const { ExportManager } = require('./utils/ExportManager');
      const exportManager = new ExportManager(__dirname);
      await exportManager.initialize();

      const exports = await exportManager.listExports();

      if (exports.length === 0) {
        console.log(
          chalk.yellow('No exports found. Use "ddd upload" to process a ZIP file.')
        );
        return;
      }

      console.log(chalk.blue('📁 Available exports:'));
      exports.forEach(exp => {
        const details = options.verbose
          ? ` (${new Date(exp.createdAt).toLocaleDateString()}, ${exp.conversationCount} conversations)`
          : '';
        console.log(`  ${chalk.green(exp.name)}${details}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error listing exports:'), error.message);
      process.exit(1);
    }
  });

program
  .command('view')
  .description('View conversations in an export')
  .argument('<export-name>', 'name of the export to view')
  .option('-l, --limit <number>', 'number of conversations to show', '10')
  .action(async (exportName, options) => {
    try {
      const { ExportManager } = require('./utils/ExportManager');
      const exportManager = new ExportManager(__dirname);
      await exportManager.initialize();

      const conversations = await exportManager.getConversations(
        exportName,
        parseInt(options.limit)
      );

      if (conversations.length === 0) {
        console.log(chalk.yellow('No conversations found in this export.'));
        return;
      }

      console.log(chalk.blue(`💬 Conversations in ${exportName}:`));
      conversations.forEach((conv, index) => {
        const title = conv.title || `Conversation ${index + 1}`;
        console.log(`  ${index + 1}. ${chalk.green(title)}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error viewing export:'), error.message);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Migrate old conversations.json format to new export format')
  .argument('[file]', 'path to conversations.json file', 'data/conversations.json')
  .action(async file => {
    try {
      console.log(chalk.blue('🔄 Migrating conversations...'));

      // This will call the migration script
      const { spawn } = require('child_process');
      const migration = spawn(
        'node',
        [path.join(__dirname, 'data', 'migration.js'), file],
        {
          stdio: 'inherit',
        }
      );

      migration.on('close', code => {
        if (code === 0) {
          console.log(chalk.green('✅ Migration completed successfully!'));
        } else {
          console.error(chalk.red('❌ Migration failed'));
          process.exit(code);
        }
      });
    } catch (error) {
      console.error(chalk.red('❌ Migration error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
