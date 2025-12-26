#!/usr/bin/env node

/**
 * Help command tests for data-dumpster-diver CLI
 * Tests all help command outputs with proper validation and logging
 */

const path = require('path');
const { TestUtils } = require('./test-utils');

/**
 * Main help test function
 */
async function runHelpTests() {
  const outputPath = path.join(__dirname, 'logs', 'help_test_output.txt');
  const logger = await TestUtils.setupTestEnvironment(outputPath);

  const dddCommands = ['dump', 'hoard', 'rummage', 'upcycle', 'burn'];
  let allTestsPassed = true;

  try {
    await logger.separator('HELP COMMAND TESTS');

    // Test help commands for each ddd command
    for (const command of dddCommands) {
      console.log(`\nTesting help for command: ${command}`);

      try {
        const result = await TestUtils.runCLICommand(['help', command], {
          captureOutput: true,
          showRealTime: true,
        });

        // Log the result
        await logger.logCommandResult(`help ${command}`, result);

        // Validate the help output
        if (result.success) {
          // Check if help output contains expected content
          const hasUsage =
            result.stdout.toLowerCase().includes('usage') ||
            result.stdout.toLowerCase().includes('command');
          const hasDescription = result.stdout.length > 50; // Reasonable length for help text

          if (hasUsage && hasDescription) {
            await logger.log(`✓ Help command '${command}' passed validation`);
            console.log(`✓ Help command '${command}' passed validation`);
          } else {
            await logger.log(
              `✗ Help command '${command}' failed validation - insufficient content`
            );
            console.log(
              `✗ Help command '${command}' failed validation - insufficient content`
            );
            allTestsPassed = false;
          }
        } else {
          await logger.log(
            `✗ Help command '${command}' failed with exit code ${result.exitCode}`
          );
          console.log(
            `✗ Help command '${command}' failed with exit code ${result.exitCode}`
          );
          allTestsPassed = false;
        }
      } catch (error) {
        await logger.log(`✗ Error testing help command '${command}': ${error.message}`);
        console.log(`✗ Error testing help command '${command}': ${error.message}`);
        allTestsPassed = false;
      }
    }

    // Test main help command
    console.log('\nTesting main help command...');
    try {
      const mainHelpResult = await TestUtils.runCLICommand(['help'], {
        captureOutput: true,
        showRealTime: true,
      });

      await logger.logCommandResult('help', mainHelpResult);

      if (mainHelpResult.success) {
        const hasCommandList = dddCommands.some(cmd =>
          mainHelpResult.stdout.toLowerCase().includes(cmd)
        );

        if (hasCommandList) {
          await logger.log('✓ Main help command passed validation');
          console.log('✓ Main help command passed validation');
        } else {
          await logger.log(
            '✗ Main help command failed validation - missing command list'
          );
          console.log('✗ Main help command failed validation - missing command list');
          allTestsPassed = false;
        }
      } else {
        await logger.log(
          `✗ Main help command failed with exit code ${mainHelpResult.exitCode}`
        );
        console.log(
          `✗ Main help command failed with exit code ${mainHelpResult.exitCode}`
        );
        allTestsPassed = false;
      }
    } catch (error) {
      await logger.log(`✗ Error testing main help command: ${error.message}`);
      console.log(`✗ Error testing main help command: ${error.message}`);
      allTestsPassed = false;
    }

    // Final summary
    await logger.separator('HELP TEST SUMMARY');
    await logger.log(
      `All help tests completed: ${allTestsPassed ? 'PASSED' : 'FAILED'}`
    );
    await logger.log(`Results saved to: ${outputPath}`);

    console.log('\n================ TEST RESULTS ================');
    console.log(`Help tests completed: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`Full results saved to: ${outputPath}`);

    // Display the full log content
    try {
      const logContent = await require('fs').promises.readFile(outputPath, 'utf8');
      console.log('\n--- Full Test Output ---');
      console.log(logContent);
    } catch (error) {
      console.log(`Could not read log file: ${error.message}`);
    }
  } catch (error) {
    await logger.log(`Fatal error in help tests: ${error.message}`);
    console.error(`Fatal error in help tests: ${error.message}`);
    allTestsPassed = false;
  }

  process.exit(allTestsPassed ? 0 : 1);
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runHelpTests().catch(error => {
    console.error('Help tests failed with fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runHelpTests };
