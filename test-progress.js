#!/usr/bin/env node

const cliProgress = require('cli-progress');

async function directProgressTest() {
  console.log('Direct cli-progress test:');

  // Test 1: Basic SingleBar
  console.log('\n1. Basic SingleBar:');
  const bar1 = new cliProgress.SingleBar({
    format: 'Processing |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '=',
    barIncompleteChar: '-',
    hideCursor: false,
    noTTYOutput: true,
    clearOnComplete: true,
  });

  bar1.start(10, 0);
  for (let i = 0; i <= 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    bar1.update(i);
  }

  // Test 2: With payload
  console.log('\n2. With payload:');
  const bar2 = new cliProgress.SingleBar({
    format: 'Files |{bar}| {percentage}% | {value}/{total} | Speed: {speed}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: false,
  });

  bar2.start(5, 0);
  for (let i = 1; i <= 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    bar2.update(i, { speed: `${(Math.random() * 10).toFixed(1)} files/s` });
  }

  console.log('\nDone!');
}

directProgressTest().catch(console.error);
