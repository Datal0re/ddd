#!/usr/bin/env node

/**
 * Spinner test to verify ora animation works
 */

const ora = require('ora').default;
const { createProgressManager } = require('../utils/ProgressManager');

async function testSpinner() {
  console.log('🌀 Testing ora spinner directly...\n');

  // Test 1: Basic ora spinner
  console.log('1. Direct ora spinner:');
  const spinner1 = ora('Loading...').start();

  for (let i = 0; i <= 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    spinner1.text = `Loading... ${i}/5`;
  }

  spinner1.succeed('Direct ora complete!');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: ProgressManager spinner
  console.log('\n2. ProgressManager spinner:');
  const pm = createProgressManager();

  pm.start('loading', 'Initializing process', 0);

  for (let i = 0; i <= 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    pm.update('loading', i * 10, `Processing step ${i}/10`);
  }

  pm.succeed('ProgressManager spinner complete!');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Multiple stages
  console.log('\n3. Multiple stages with spinner:');
  const pm2 = createProgressManager();

  pm2.start('validating', 'Validating data...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  pm2.succeed('Data validated!');

  pm2.start('processing', 'Processing records...');
  for (let i = 0; i <= 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 400));
    pm2.update('processing', i * 20, `Record ${i + 1}/5`);
  }
  pm2.succeed('Records processed!');

  console.log('\n✨ All spinner tests completed!');
}

testSpinner().catch(console.error);
