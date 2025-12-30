#!/usr/bin/env node

/**
 * Manual test script for rummage functionality
 * Simulates the rummage workflow with predefined inputs
 */

const { DumpsterManager } = require('./utils/DumpsterManager');
const { SelectionManager } = require('./utils/SelectionManager');
const { CliPrompts } = require('./utils/CliPrompts');
const chalk = require('chalk');

async function testRummage() {
  console.log('🧪 Testing rummage functionality...\n');

  try {
    // Initialize managers
    const dm = new DumpsterManager(__dirname);
    await dm.initialize();
    const selectionManager = new SelectionManager(__dirname);

    // Test parameters
    const dumpsterName = 'buffalo';
    const searchQuery = 'machine'; // Search for "machine" which appears in chat titles
    const searchOptions = {
      scope: 'all',
      caseSensitive: false,
    };

    console.log(`📍 Dumpster: ${dumpsterName}`);
    console.log(`🔍 Search query: "${searchQuery}"`);
    console.log(`📋 Scope: ${searchOptions.scope}`);
    console.log(`🔤 Case sensitive: ${searchOptions.caseSensitive}\n`);

    // Perform search
    console.log('⏳ Searching...');
    const searchResponse = await dm.searchChats(
      dumpsterName,
      searchQuery,
      searchOptions
    );
    const searchResults = searchResponse.results || [];

    console.log(
      `✅ Found ${searchResults.length} chat${searchResults.length !== 1 ? 's' : ''} matching "${searchQuery}"\n`
    );

    if (searchResults.length === 0) {
      console.log(chalk.yellow('No chats found. Try a different search term.'));
      return;
    }

    // Display first few results
    console.log('📋 Search results (first 5):');
    searchResults.slice(0, 5).forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.chat.title || 'Untitled'} (${result.searchResult.matchCount} matches)`
      );
    });

    // Show sample chat titles to understand what's available
    console.log('\n📝 Sample chat titles available:');
    searchResults.slice(0, 10).forEach((result, index) => {
      console.log(`  - ${result.chat.title || 'Untitled'}`);
    });

    // Simulate selecting first 2 chats
    const selectedChats = searchResults.slice(0, 2);
    console.log(`\n✅ Selected ${selectedChats.length} chats for testing:`);
    selectedChats.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.chat.title || 'Untitled'}`);
    });

    // Add to selection bin
    console.log('\n📦 Adding to selection bin...');
    const chatData = selectedChats.map(result => ({
      chatId: result.chat.filename,
      filename: result.chat.filename,
      title: result.chat.title || 'Untitled',
      sourceDumpster: dumpsterName,
      addedAt: Date.now(),
      metadata: {
        messageCount: result.chat.messageCount || 0,
        createTime: result.chat.create_time,
        updateTime: result.chat.update_time,
        preview: result.chat.title || 'Untitled',
      },
    }));

    await selectionManager.addChats(chatData);
    console.log(chalk.green(`✅ Added ${selectedChats.length} chats to selection bin`));

    // Check selection bin status
    const selectionStats = await selectionManager.getSelectionStats();
    console.log(`\n📊 Selection bin status: ${selectionStats.totalCount} chats total`);

    console.log(chalk.green('\n🎉 Rummage test completed successfully!'));
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(error.stack);
  }
}

testRummage();
