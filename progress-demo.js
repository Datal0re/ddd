#!/usr/bin/env node

/**
 * Demo script showing the new progress bar functionality
 */

const {
  createProgressManager,
  createProgressBarManager,
} = require('./utils/ProgressManager');

async function demoProgressBars() {
  console.log('\n🚀 Progress Bar Demo\n');

  // Demo 1: Original spinner-style progress
  console.log('1. Original Spinner Style:');
  const spinnerPm = createProgressManager();
  spinnerPm.start('processing', 'Starting work...', 0);

  for (let i = 0; i <= 100; i += 10) {
    await new Promise(resolve => setTimeout(resolve, 200));
    spinnerPm.update('processing', i, `Working... ${i}%`);
  }
  spinnerPm.succeed('Spinner work completed!');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Demo 2: New progress bar style
  console.log('\n2. New Progress Bar Style:');
  const barPm = createProgressBarManager();

  const fileProgressBar = barPm.createFileProgressBar(15, 'Processing files');

  for (let i = 1; i <= 15; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    fileProgressBar(i, {
      file: `file_${i}.txt`,
      speed: `${(Math.random() * 10).toFixed(1)} files/s`,
    });
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Demo 3: Multi-progress bars
  console.log('\n3. Multi-Progress Bars:');
  const multiPm = createProgressBarManager();
  const multi = multiPm.createMultiProgressBar();

  const bar1 = multi.createBar(10, 'Downloading files');
  const bar2 = multi.createBar(8, 'Processing images');
  const bar3 = multi.createBar(6, 'Generating reports');

  // Simulate concurrent operations
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));

    bar1.update(i + 1, { speed: '2.3 MB/s' });
    if (i < 8) {
      bar2.update(i + 1, { current: `img_${i + 1}.jpg` });
    }
    if (i < 6) {
      bar3.update(i + 1, { report: `Report_${i + 1}.pdf` });
    }
  }

  multi.stop();

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Demo 4: Hybrid approach (spinner for indeterminate, bar for determinate)
  console.log('\n4. Hybrid Approach:');
  const hybridPm = createProgressManager();

  // Use spinner for validation (indeterminate)
  hybridPm.start('validating', 'Validating data...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  hybridPm.succeed('Data validated successfully!');

  // Use progress bar for processing (determinate)
  const processingBar = hybridPm.createFileProgressBar(25, 'Processing records');
  for (let i = 1; i <= 25; i++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    processingBar(i, { record: `Record_${i}` });
  }

  console.log('\n✨ Demo completed!');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demoProgressBars().catch(console.error);
}

module.exports = { demoProgressBars };
