#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const logo = require('./logo');

const { ErrorHandler } = require('./utils/ErrorHandler');
const { SchemaValidator } = require('./utils/SchemaValidator');
const { createProgressManager } = require('./utils/ProgressManager');
const { CliPrompts } = require('./utils/CliPrompts');
const { SelectionManager } = require('./utils/SelectionManager');

const program = new Command();

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
  .description('Rummage through chats in a dumpster with search and selection')
  .argument(
    '[dumpster-name]',
    'name of dumpster to rummage through (optional - will prompt for selection)'
  )
  .option(
    '-l, --limit <number>',
    'number of chats to show (optional - will prompt if not provided)'
  )
  .option('-v, --verbose', 'Verbose output')
  .action(async (dumpsterName, options) => {
    const pm = createProgressManager(null, options.verbose);

    try {
      const { DumpsterManager } = require('./utils/DumpsterManager');
      const dm = new DumpsterManager(__dirname);
      await dm.initialize();

      // Initialize selection manager
      const selectionManager = new SelectionManager(__dirname);

      // Get available dumpsters
      const dumpsters = await dm.listDumpsters();

      if (dumpsters.length === 0) {
        ErrorHandler.logWarning(
          'No dumpsters found. Use "ddd dump" to process a ZIP file.'
        );
        return;
      }

      // Main rummage loop
      let currentDumpster = dumpsterName;
      let continueRummaging = true;

      while (continueRummaging) {
        // Prompt for dumpster selection if not provided or switching
        if (!currentDumpster) {
          currentDumpster = await CliPrompts.selectFromDumpsters(
            dumpsters,
            'Select a dumpster to rummage through:'
          );
          console.log(); // Add spacing
        } else {
          if (currentDumpster !== dumpsterName) {
            // User switched to a different dumpster
            dumpsterName = currentDumpster;
          }
        }

        // Validate dumpster name
        SchemaValidator.validateRequired(
          [{ name: 'dumpsterName', value: currentDumpster }],
          'rummage command'
        );
        SchemaValidator.validateNonEmptyString(
          currentDumpster,
          'dumpsterName',
          'rummage command'
        );

        // Enhanced rummage workflow
        await performRummageWorkflow(
          dm,
          selectionManager,
          currentDumpster,
          options,
          pm
        );

        // Ask user what to do next
        const action = await CliPrompts.promptRummageNextAction();

        switch (action) {
          case 'new_search':
            continueRummaging = true;
            currentDumpster = null; // Force dumpster selection prompt
            break;
          case 'switch_dumpster':
            continueRummaging = true;
            currentDumpster = null; // Force dumpster selection prompt
            break;
          case 'view_selection':
            await displaySelectionBinStatus(selectionManager);
            continueRummaging = true;
            break;
          case 'upcycle_selection':
            await promptUpcycleFromSelection();
            continueRummaging = false; // Exit after upcycle
            break;
          case 'quit':
            continueRummaging = false;
            console.log(chalk.blue('👋 Happy rummaging!'));
            break;
          default:
            continueRummaging = false;
        }
      }
    } catch (error) {
      pm.fail('Rummage failed');
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
        const shouldBurn = await CliPrompts.confirmAction(
          `Are you sure you want to permanently delete "${dumpsterName}"? \nThis will destroy ${chatCount} chats (${sizeInMB}MB) and cannot be undone.`
        );

        if (!shouldBurn) {
          console.log(
            chalk.yellow('🔥 Fire extinguished - dumpster lives to see another day')
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
      const selectionManager = new SelectionManager(__dirname);
      const selectionStats = await selectionManager.getSelectionStats();

      // Display selection bin status if it has content
      if (selectionStats.totalCount > 0 && !dumpsterName) {
        const totalMessages = Object.values(
          selectionStats.chatsByDumpster || {}
        ).reduce(
          (sum, chats) =>
            sum +
            chats.reduce(
              (msgSum, chat) => msgSum + (chat.metadata?.messageCount || 0),
              0
            ),
          0
        );
        const dumpsterCount = Object.keys(selectionStats.chatsByDumpster || {}).length;

        console.log(chalk.blue(`\n📋 Selection Bin Status:`));
        console.log(`   ${selectionStats.totalCount} chats selected`);
        if (totalMessages > 0) {
          console.log(`   ${totalMessages} total messages`);
        }
        if (dumpsterCount > 0) {
          console.log(
            `   From ${dumpsterCount} dumpster${dumpsterCount !== 1 ? 's' : ''}`
          );
          // Show dumpsters with chat counts
          Object.entries(selectionStats.chatsByDumpster).forEach(([name, chats]) => {
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
        exportSource = await CliPrompts.promptUpcycleSource(selectionStats);

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
      if (validatedOptions.verbose) {
        if (exportSource === 'selection') {
          console.log(
            chalk.blue(
              `🔄 Upcycling selection bin (${selectionStats.totalCount} chats)`
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
        // Selection bin export - disable entire media directory copy
        result = await upcycleManager.upcycleSelection(format, {
          ...validatedOptions,
          outputDir: validatedOptions.output,
          onProgress,
          copyEntireMediaDir: false, // Only copy referenced assets for selection
        });
      } else {
        // Dumpster export - validate dumpster exists
        const dumpster = dumpsters.find(d => d.name === dumpsterName);

        if (!dumpster) {
          pm.fail(`Dumpster "${dumpsterName}" not found`);
          ErrorHandler.logInfo('Available dumpsters:', 'upcycle');
          dumpsters.forEach(d => {
            console.log(`  ${chalk.green(d.name)} (${d.chatCount} chats)`);
          });
          process.exit(1);
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
          ? `selection bin (${result.processed} chats)`
          : `"${dumpsterName}"`;

      pm.succeed(
        `Upcycle of ${sourceDescription} to ${format.toUpperCase()} complete!`
      );
    } catch (error) {
      pm.fail(`Upcycle failed: ${error.message}`);
      ErrorHandler.handleAsyncError(error, 'upcycling dumpster', null, false);
      process.exit(1);
    }
  });

/**
 * Perform enhanced rummage workflow with search and selection
 * @param {DumpsterManager} dm - DumpsterManager instance
 * @param {SelectionManager} selectionManager - SelectionManager instance
 * @param {string} dumpsterName - Name of dumpster to rummage
 * @param {Object} options - Command options
 * @param {ProgressManager} pm - Progress manager
 */
async function performRummageWorkflow(dm, selectionManager, dumpsterName, options, pm) {
  try {
    // Get search query and options
    const searchQuery = await CliPrompts.promptSearchQuery();
    const searchOptions = await CliPrompts.promptSearchOptions();

    pm.start('searching', `Searching chats in "${dumpsterName}"...`);

    // Perform search
    let searchResults;
    if (searchQuery.trim() === '') {
      // No query - show recent chats
      const limit = options.limit || (await CliPrompts.promptForChatLimit());
      searchResults = await dm.getChats(dumpsterName, limit);
      pm.succeed(
        `Found ${searchResults.length} recent chat${searchResults.length !== 1 ? 's' : ''}`
      );
    } else {
      // Perform actual search
      let searchResponse;
      let searchResults = [];

      try {
        searchResponse = await dm.searchChats(dumpsterName, searchQuery, searchOptions);
        searchResults = searchResponse.results || [];

        if (options.verbose) {
          console.log(
            chalk.dim(`🔍 Search response: ${JSON.stringify(searchResponse, null, 2)}`)
          );
        }

        pm.succeed(
          `Found ${searchResults.length} chat${searchResults.length !== 1 ? 's' : ''} matching "${searchQuery}"`
        );
      } catch (searchError) {
        console.error(chalk.red(`🔍 Search error: ${searchError.message}`));
        if (options.verbose) {
          console.error(chalk.dim(`Stack trace: ${searchError.stack}`));
        }
        pm.fail('Search operation failed');
        console.log(
          chalk.yellow(
            '💡 This may be due to corrupted chat files or search term issues.'
          )
        );
        return;
      }
    }

    // Defensive programming: Ensure searchResults is always an array
    if (!Array.isArray(searchResults)) {
      console.error(chalk.red('❌ Critical: searchResults is not an array'));
      console.error(
        chalk.dim(`Type: ${typeof searchResults}, Value: ${searchResults}`)
      );
      return;
    }

    if (searchResults.length === 0) {
      console.log(
        chalk.yellow('No chats found. Try a different search term or options.')
      );
      return;
    }

    // Display search results and allow selection
    const selectedChats = await CliPrompts.selectMultipleChats(searchResults, {
      showPreviews: searchQuery.trim() !== '',
      searchQuery,
    });

    if (selectedChats.length === 0) {
      console.log(chalk.yellow('No chats selected.'));
      return;
    }

    // Prompt for action on selected chats
    const action = await CliPrompts.promptSelectionActions(selectedChats.length);

    switch (action) {
      case 'add_to_selection':
        await addChatsToSelection(selectionManager, selectedChats);
        console.log(
          chalk.green(
            `✅ Added ${selectedChats.length} chat${selectedChats.length !== 1 ? 's' : ''} to selection bin`
          )
        );
        break;
      case 'upcycle_selected':
        await upcycleSelectedChats(selectedChats);
        break;
      case 'view_details':
        await viewChatDetails(selectedChats);
        break;
      default:
        console.log(chalk.yellow('Action cancelled.'));
    }
  } catch (error) {
    pm.fail('Rummage workflow failed');
    throw error;
  }
}

/**
 * Add selected chats to selection bin
 * @param {SelectionManager} selectionManager - SelectionManager instance
 * @param {Array} selectedChats - Array of selected chat objects
 */
async function addChatsToSelection(selectionManager, selectedChats) {
  const chatData = selectedChats.map(chat => ({
    chatId: chat.filename,
    filename: chat.filename,
    title: chat.title || 'Untitled',
    sourceDumpster: chat.dumpsterName,
    addedAt: Date.now(),
    metadata: {
      messageCount: chat.messageCount || 0,
      createTime: chat.create_time,
      updateTime: chat.update_time,
      preview: chat.title || 'Untitled',
    },
  }));

  await selectionManager.addChats(chatData);
}

/**
 * Upcycle selected chats directly
 * @param {Array} selectedChats - Array of selected chat objects
 */
async function upcycleSelectedChats(selectedChats) {
  const { DumpsterManager } = require('./utils/DumpsterManager');
  const dm = new DumpsterManager(__dirname);
  await dm.initialize();

  const selectionManager = new SelectionManager(__dirname);

  // Temporarily add selected chats to selection bin
  await addChatsToSelection(selectionManager, selectedChats);

  // Trigger upcycle command with selection bin
  console.log(chalk.blue('🔄 Starting upcycle with selected chats...'));

  // Execute upcycle with selection bin
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
}

/**
 * View detailed information about selected chats
 * @param {Array} selectedChats - Array of selected chat objects
 */
async function viewChatDetails(selectedChats) {
  console.log(chalk.blue('\n📋 Selected Chat Details:'));

  for (const chat of selectedChats) {
    console.log(`\n${chalk.green('📝 ' + (chat.title || 'Untitled'))}`);
    console.log(
      `   📅 Created: ${chat.create_time ? new Date(chat.create_time * 1000).toLocaleDateString() : 'Unknown'}`
    );
    console.log(`   💬 Messages: ${chat.messageCount || 'Unknown'}`);
    console.log(`   📁 File: ${chat.filename}`);

    if (chat.preview) {
      console.log(
        `   👁️  Preview: ${chat.preview.substring(0, 100)}${chat.preview.length > 100 ? '...' : ''}`
      );
    }
  }
}

/**
 * Display current selection bin status
 * @param {SelectionManager} selectionManager - SelectionManager instance
 */
async function displaySelectionBinStatus(selectionManager) {
  try {
    const selectionStats = await selectionManager.getSelectionStats();

    // Validate selectionStats structure
    if (!selectionStats || typeof selectionStats !== 'object') {
      console.log(chalk.yellow('\n📋 Selection bin status unavailable.'));
      return;
    }

    if (selectionStats.totalCount === 0) {
      console.log(chalk.yellow('\n📋 Selection bin is currently empty.'));
      return;
    }

    console.log(chalk.blue('\n📋 Current Selection Bin:'));
    console.log(
      `   ${selectionStats.totalCount} chat${selectionStats.totalCount !== 1 ? 's' : ''} selected`
    );

    const totalMessages = Object.values(selectionStats.chatsByDumpster || {}).reduce(
      (sum, chats) =>
        sum +
        chats.reduce((msgSum, chat) => msgSum + (chat.metadata?.messageCount || 0), 0),
      0
    );

    if (totalMessages > 0) {
      console.log(`   ${totalMessages} total messages`);
    }

    const dumpsterCount = Object.keys(selectionStats.chatsByDumpster || {}).length;
    if (dumpsterCount > 0) {
      console.log(`   From ${dumpsterCount} dumpster${dumpsterCount !== 1 ? 's' : ''}`);
    }

    // Show recent selections
    console.log(chalk.dim('\n📜 Recent selections:'));
    Object.entries(selectionStats.chatsByDumpster).forEach(([name, chats]) => {
      console.log(`   • ${name}: ${chats.length} chat${chats.length !== 1 ? 's' : ''}`);
    });
  } catch (error) {
    console.log(chalk.red(`❌ Failed to load selection bin status: ${error.message}`));
    // Don't re-throw error to avoid breaking the rummage loop
  }
}

/**
 * Prompt user to upcycle from current selection bin
 */
async function promptUpcycleFromSelection() {
  const { DumpsterManager } = require('./utils/DumpsterManager');
  const dm = new DumpsterManager(__dirname);
  await dm.initialize();

  const UpcycleManager = require('./utils/UpcycleManager');
  const upcycleManager = new UpcycleManager(dm);

  const format = await CliPrompts.selectExportFormat();
  const result = await upcycleManager.upcycleSelection(format, {
    includeMedia: true,
    verbose: true,
  });

  const { generateExportReport } = require('./utils/upcycleHelpers');
  const report = generateExportReport(result, true);
  console.log(report);
}

program.parse();
