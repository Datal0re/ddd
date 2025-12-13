#!/usr/bin/env node

const ExportBackupManager = require('../utils/ExportBackupManager');
const ExportManager = require('../utils/ExportManager');

const backupManager = new ExportBackupManager();
const exportManager = new ExportManager();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    await backupManager.initialize();
    await exportManager.initialize();

    switch (command) {
      case 'create':
        await createBackup(args);
        break;
      case 'list':
        await listBackups(args);
        break;
      case 'restore':
        await restoreBackup(args);
        break;
      case 'delete':
        await deleteBackup(args);
        break;
      case 'stats':
        await showStats();
        break;
      case 'cleanup':
        await cleanupBackups(args);
        break;
      default:
        showHelp();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function createBackup(args) {
  const exportName = args[1];
  const incremental = args.includes('--incremental');
  const cloudSync = args.includes('--cloud');

  if (!exportName) {
    console.error(
      'Usage: manage-export-backups.js create <export-name> [--incremental] [--cloud]'
    );
    process.exit(1);
  }

  console.log(
    `Creating ${incremental ? 'incremental' : 'full'} backup for export: ${exportName}`
  );

  const backupInfo = await backupManager.createBackup(exportName, {
    incremental,
    cloudSync,
  });

  console.log('\nBackup created successfully:');
  console.log(`  Backup ID: ${backupInfo.id}`);
  console.log(`  Type: ${backupInfo.type}`);
  console.log(`  Size: ${formatBytes(backupInfo.size)}`);
  console.log(`  Compressed: ${formatBytes(backupInfo.compressedSize)}`);
  console.log(`  Files: ${backupInfo.fileCount}`);
  console.log(`  Created: ${backupInfo.created}`);
}

async function listBackups(args) {
  const exportName = args[1];

  if (!exportName) {
    const exports = await exportManager.listExports();
    console.log('\nAvailable exports:');
    exports.forEach(exp => {
      console.log(`  - ${exp.name}`);
    });
    console.log('\nUsage: manage-export-backups.js list <export-name>');
    return;
  }

  const backups = await backupManager.listBackups(exportName);

  if (backups.length === 0) {
    console.log(`No backups found for export: ${exportName}`);
    return;
  }

  console.log(`\nBackups for export: ${exportName}`);
  console.log('─'.repeat(80));

  backups.forEach(backup => {
    console.log(`\nBackup ID: ${backup.id}`);
    console.log(`  Type: ${backup.type}`);
    console.log(`  Created: ${backup.created}`);
    console.log(
      `  Size: ${formatBytes(backup.size)} → ${formatBytes(backup.compressedSize)}`
    );
    console.log(`  Files: ${backup.fileCount}`);
    console.log(`  Checksum: ${backup.checksum.substring(0, 16)}...`);
  });
}

async function restoreBackup(args) {
  const exportName = args[1];
  const backupId = args[2];

  if (!exportName || !backupId) {
    console.error('Usage: manage-export-backups.js restore <export-name> <backup-id>');
    process.exit(1);
  }

  console.log(`Restoring backup ${backupId} for export: ${exportName}`);

  const result = await backupManager.restoreBackup(exportName, backupId);

  console.log('\nBackup restored successfully:');
  console.log(`  Export: ${result.exportName}`);
  console.log(`  Backup ID: ${result.backupId}`);
  console.log(`  Restored at: ${result.restoredAt}`);
}

async function deleteBackup(args) {
  const exportName = args[1];
  const backupId = args[2];

  if (!exportName || !backupId) {
    console.error('Usage: manage-export-backups.js delete <export-name> <backup-id>');
    process.exit(1);
  }

  console.log(`Deleting backup ${backupId} for export: ${exportName}`);

  await backupManager.deleteBackup(exportName, backupId);

  console.log('Backup deleted successfully');
}

async function showStats() {
  const stats = await backupManager.getBackupStats();

  console.log('\nBackup Statistics');
  console.log('═'.repeat(80));
  console.log(`Total Exports: ${stats.totalExports}`);
  console.log(`Total Backups: ${stats.totalBackups}`);
  console.log(`Total Size: ${formatBytes(stats.totalSize)}`);
  console.log(`Compressed Size: ${formatBytes(stats.totalCompressedSize)}`);
  console.log(
    `Compression Ratio: ${((stats.totalCompressedSize / stats.totalSize) * 100).toFixed(1)}%`
  );

  if (stats.oldestBackup) {
    console.log(`Oldest Backup: ${stats.oldestBackup}`);
  }
  if (stats.newestBackup) {
    console.log(`Newest Backup: ${stats.newestBackup}`);
  }

  console.log('\nPer-Export Statistics:');
  console.log('─'.repeat(80));

  for (const [exportName, exportStats] of Object.entries(stats.exports)) {
    console.log(`\n${exportName}:`);
    console.log(`  Backups: ${exportStats.backupCount}`);
    console.log(`  Total Size: ${formatBytes(exportStats.totalSize)}`);
    console.log(`  Compressed: ${formatBytes(exportStats.totalCompressedSize)}`);
    console.log(`  Last Backup: ${exportStats.lastBackup || 'Never'}`);
  }
}

async function cleanupBackups(args) {
  const exportName = args[1];

  if (!exportName) {
    console.error('Usage: manage-export-backups.js cleanup <export-name>');
    process.exit(1);
  }

  console.log(`Cleaning up old backups for export: ${exportName}`);

  await backupManager.cleanupOldBackups(exportName);

  console.log('Cleanup completed');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showHelp() {
  console.log(`
Data Dumpster Diver - Export Backup Manager

Usage: node scripts/manage-export-backups.js <command> [options]

Commands:
  create <export-name> [--incremental] [--cloud]
    Create a backup of an export
    Options:
      --incremental  Create incremental backup (only changed files)
      --cloud        Sync backup to cloud storage

  list [export-name]
    List all backups for an export (or list all exports if no name provided)

  restore <export-name> <backup-id>
    Restore an export from a backup

  delete <export-name> <backup-id>
    Delete a specific backup

  stats
    Show backup statistics for all exports

  cleanup <export-name>
    Clean up old backups (keeps most recent ${backupManager.maxBackups} backups)

Examples:
  node scripts/manage-export-backups.js create "My Export"
  node scripts/manage-export-backups.js create "My Export" --incremental
  node scripts/manage-export-backups.js list "My Export"
  node scripts/manage-export-backups.js restore "My Export" backup-2025-12-13-abc123
  node scripts/manage-export-backups.js stats
  node scripts/manage-export-backups.js cleanup "My Export"
`);
}

main();
