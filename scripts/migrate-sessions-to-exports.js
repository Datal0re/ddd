#!/usr/bin/env node

/**
 * Session to Export Migration CLI Tool
 *
 * This script migrates existing session-based data to the new export-based architecture.
 * It provides a command-line interface for migrating individual sessions or all sessions at once.
 *
 * Usage:
 *   node scripts/migrate-sessions-to-exports.js --help
 *   node scripts/migrate-sessions-to-exports.js --list
 *   node scripts/migrate-sessions-to-exports.js --session <sessionId> --name "Export Name"
 *   node scripts/migrate-sessions-to-exports.js --all
 *   node scripts/migrate-sessions-to-exports.js --stats
 */

const path = require('path');
const { MigrationManager } = require('../utils/MigrationManager');

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    session: null,
    name: null,
    list: false,
    all: false,
    stats: false,
    help: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--session':
      case '-s':
        options.session = args[++i];
        break;
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--all':
      case '-a':
        options.all = true;
        break;
      case '--stats':
        options.stats = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
Session to Export Migration Tool

USAGE:
  node scripts/migrate-sessions-to-exports.js [OPTIONS]

OPTIONS:
  -s, --session <id>     Migrate specific session by ID
  -n, --name <name>      Export name for the migrated session
  -l, --list             List all migratable sessions
  -a, --all              Migrate all sessions (auto-generates names)
  --stats                 Show migration statistics
  -v, --verbose          Enable verbose logging
  -h, --help             Show this help message

EXAMPLES:
  # List all available sessions for migration
  node scripts/migrate-sessions-to-exports.js --list

  # Show migration statistics
  node scripts/migrate-sessions-to-exports.js --stats

  # Migrate a specific session with custom name
  node scripts/migrate-sessions-to-exports.js --session abc123 --name "My Chat History"

  # Migrate all sessions (auto-generates names)
  node scripts/migrate-sessions-to-exports.js --all

  # Verbose migration of specific session
  node scripts/migrate-sessions-to-exports.js --session abc123 --name "Work Chat" --verbose

NOTES:
  - If no name is provided, it will be auto-generated from session data
  - Migration preserves all conversation data, media files, and assets
  - Original sessions remain unchanged after successful migration
  - Use --stats to see what data is available before migrating
`);
}

/**
 * Format bytes for human readable output
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date for display
 */
function formatDate(date) {
  return new Date(date).toLocaleString();
}

/**
 * List migratable sessions
 */
async function listSessions(migrationManager) {
  try {
    console.log('\n📋 Available Sessions for Migration:\n');
    console.log(
      'ID'.padEnd(12) +
        'Name'.padEnd(30) +
        'Created'.padEnd(20) +
        'Conversations'.padEnd(14) +
        'Size'.padEnd(12) +
        'Status'
    );
    console.log('-'.repeat(100));

    const sessions = await migrationManager.getMigratableSessions();

    if (sessions.length === 0) {
      console.log('No sessions found for migration.');
      return;
    }

    for (const session of sessions) {
      const id = session.id.substring(0, 10) + '...';
      const name = session.name.substring(0, 28);
      const created = formatDate(session.uploadedAt).substring(0, 18);
      const conversations = session.stats.conversationCount.toString();
      const size = formatBytes(session.stats.totalSize);
      const status = session.canMigrate ? '✅ Ready' : '⚠️  Incomplete';

      console.log(
        id.padEnd(12) +
          name.padEnd(30) +
          created.padEnd(20) +
          conversations.padEnd(14) +
          size.padEnd(12) +
          status
      );
    }

    console.log(`\nFound ${sessions.length} session(s) for migration.`);
  } catch (error) {
    console.error('❌ Error listing sessions:', error.message);
    process.exit(1);
  }
}

/**
 * Show migration statistics
 */
async function showStats(migrationManager) {
  try {
    console.log('\n📊 Migration Statistics:\n');

    const stats = await migrationManager.getMigrationStats();
    const hasMigratable = await migrationManager.hasMigratableSessions();

    console.log(`Total Sessions: ${stats.totalSessions}`);
    console.log(`Migratable Sessions: ${stats.migratableSessions}`);
    console.log(`Total Conversations: ${stats.totalConversations.toLocaleString()}`);
    console.log(`Total Media Files: ${stats.totalMediaFiles.toLocaleString()}`);
    console.log(`Total Data Size: ${formatBytes(stats.totalSize)}`);
    console.log(`Migration Available: ${hasMigratable ? '✅ Yes' : '❌ No'}`);

    if (stats.totalSessions > 0) {
      const avgSize = stats.totalSize / stats.totalSessions;
      const avgConversations = stats.totalConversations / stats.totalSessions;

      console.log('\n📈 Averages:');
      console.log(`Average Session Size: ${formatBytes(avgSize)}`);
      console.log(`Average Conversations per Session: ${avgConversations.toFixed(1)}`);
    }

    console.log('\n💡 Tip: Use --list to see detailed session information.');
  } catch (error) {
    console.error('❌ Error getting statistics:', error.message);
    process.exit(1);
  }
}

/**
 * Migrate a single session
 */
async function migrateSession(migrationManager, sessionId, exportName) {
  try {
    console.log(`\n🚀 Starting migration for session: ${sessionId}`);
    if (exportName) {
      console.log(`📝 Export name: ${exportName}`);
    }

    // Progress tracking
    let lastProgress = 0;
    const onProgress = progress => {
      // Only log when progress changes significantly
      if (
        progress.progress - lastProgress >= 5 ||
        progress.stage === 'completed' ||
        progress.stage === 'error'
      ) {
        const bar =
          '█'.repeat(Math.floor(progress.progress / 5)) +
          '░'.repeat(20 - Math.floor(progress.progress / 5));
        console.log(`\r[${bar}] ${progress.progress}% - ${progress.message}`);
        lastProgress = progress.progress;
      }
    };

    const result = await migrationManager.migrateSession(
      sessionId,
      exportName,
      onProgress
    );

    if (result.success) {
      console.log('\n✅ Migration completed successfully!');
      console.log(`📁 Export created: ${result.exportName}`);
      console.log(
        `📄 Conversations migrated: ${result.stats.conversations.conversationCount}`
      );
      console.log(`🎨 Assets migrated: ${result.stats.assets.assetCount}`);
      console.log(`📎 Media files migrated: ${result.stats.media.fileCount}`);
      console.log(
        `💾 Total size: ${formatBytes(
          result.stats.conversations.totalSize +
            result.stats.assets.totalSize +
            result.stats.media.totalSize
        )}`
      );
      console.log(
        '\n💡 Tip: You can now delete the original session if everything looks correct.'
      );
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

/**
 * Migrate all sessions
 */
async function migrateAllSessions(migrationManager) {
  try {
    console.log('\n🚀 Starting migration for all sessions...\n');

    const sessions = await migrationManager.getMigratableSessions();
    const migratableSessions = sessions.filter(s => s.canMigrate);

    if (migratableSessions.length === 0) {
      console.log('❌ No migratable sessions found.');
      return;
    }

    console.log(`Found ${migratableSessions.length} session(s) to migrate.\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < migratableSessions.length; i++) {
      const session = migratableSessions[i];

      console.log(
        `\n[${i + 1}/${migratableSessions.length}] Migrating session: ${session.id}`
      );

      try {
        // Generate export name if not provided
        const exportName = session.name || `Migrated_Session_${i + 1}`;

        // Progress tracking for individual session
        const onProgress = progress => {
          console.log(`  ${progress.message} (${progress.progress}%)`);
        };

        const result = await migrationManager.migrateSession(
          session.id,
          exportName,
          onProgress
        );

        if (result.success) {
          console.log(`  ✅ Successfully migrated to: ${result.exportName}`);
          successCount++;
        } else {
          console.log(`  ❌ Migration failed`);
          failCount++;
        }
      } catch (error) {
        console.log(`  ❌ Migration failed: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n📋 Migration Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total: ${migratableSessions.length}`);

    if (failCount > 0) {
      console.log('\n⚠️  Some migrations failed. Check the logs above for details.');
    } else {
      console.log('\n🎉 All sessions migrated successfully!');
    }
  } catch (error) {
    console.error('\n❌ Bulk migration failed:', error.message);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  // Initialize migration manager
  const baseDir = path.resolve(__dirname, '..');
  const migrationManager = new MigrationManager(baseDir);

  await migrationManager.initialize();

  // Execute requested action
  if (options.list) {
    await listSessions(migrationManager);
  } else if (options.stats) {
    await showStats(migrationManager);
  } else if (options.session) {
    if (!options.name) {
      console.log('❌ Export name is required when migrating a specific session.');
      console.log('Use --name "Export Name" to specify the export name.');
      process.exit(1);
    }
    await migrateSession(migrationManager, options.session, options.name);
  } else if (options.all) {
    await migrateAllSessions(migrationManager);
  } else {
    console.log('❌ No action specified. Use --help for usage information.');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Unexpected error:', error.message);
    process.exit(1);
  });
}

module.exports = { main };
