#!/usr/bin/env node

/**
 * Full suite tests for data-dumpster-diver CLI
 * Tests the complete workflow from creation to cleanup
 */

const path = require('path');
const { TestUtils } = require('./test-utils');

/**
 * Main full suite test function
 */
async function runFullSuiteTests() {
  const outputPath = path.join(__dirname, 'logs', 'full_suite_test_output.txt');
  const zipPath = path.join(__dirname, 'test.zip');
  const dumpsterName = 'test_dumpster';

  const logger = await TestUtils.setupTestEnvironment(outputPath);

  const upcycleFormats = ['md', 'txt', 'html'];
  let allTestsPassed = true;
  let testDumpsterExists = false;

  try {
    await logger.separator('FULL SUITE TESTS');

    // Step 1: Validate test ZIP file
    console.log('\n=== Step 1: Validating test ZIP file ===');
    try {
      await TestUtils.validateTestZip(zipPath);
      await logger.log('✓ Test ZIP file validation passed');
    } catch (error) {
      await logger.log(`✗ Test ZIP file validation failed: ${error.message}`);
      console.error(`✗ Test ZIP file validation failed: ${error.message}`);
      process.exit(1); // Exit if ZIP validation fails
    }

    // Step 2: Run help tests first
    console.log('\n=== Step 2: Running help tests ===');
    try {
      console.log('Running help tests...');

      // Run help tests with custom output path to avoid conflicts
      const helpOutputPath = path.join(__dirname, 'logs', 'help_in_suite_output.txt');
      const helpLogger = TestUtils.createTestLogger(helpOutputPath);

      await helpLogger.log('Help tests run as part of full suite');

      // Test each help command
      const dddCommands = ['dump', 'hoard', 'rummage', 'upcycle', 'burn'];
      let helpTestsPassed = true;

      for (const command of dddCommands) {
        const result = await TestUtils.runCLICommand(['help', command], {
          captureOutput: true,
          showRealTime: false,
        });

        await helpLogger.logCommandResult(`help ${command}`, result);

        if (!result.success) {
          helpTestsPassed = false;
        }
      }

      await logger.log(
        `Help tests completed: ${helpTestsPassed ? 'PASSED' : 'FAILED'}`
      );
      console.log(`Help tests completed: ${helpTestsPassed ? 'PASSED' : 'FAILED'}`);

      if (!helpTestsPassed) {
        allTestsPassed = false;
      }
    } catch (error) {
      await logger.log(`✗ Error running help tests: ${error.message}`);
      console.log(`✗ Error running help tests: ${error.message}`);
      allTestsPassed = false;
    }

    // Step 3: Test creating a new dumpster
    console.log('\n=== Step 3: Testing dumpster creation ===');
    try {
      console.log(`Creating dumpster '${dumpsterName}'...`);

      const dumpResult = await TestUtils.runCLICommand(
        ['dump', '-n', dumpsterName, '--overwrite', zipPath],
        {
          captureOutput: true,
          showRealTime: true,
        }
      );

      await logger.logCommandResult(
        `dump -n ${dumpsterName} --overwrite ${zipPath}`,
        dumpResult
      );

      if (dumpResult.success) {
        testDumpsterExists = true;
        await logger.log('✓ Dumpster creation test passed');
        console.log('✓ Dumpster creation test passed');
      } else {
        await logger.log(
          `✗ Dumpster creation test failed with exit code ${dumpResult.exitCode}`
        );
        console.log(
          `✗ Dumpster creation test failed with exit code ${dumpResult.exitCode}`
        );
        allTestsPassed = false;

        // If we can't create a dumpster, we can't continue with tests that depend on it
        console.log('⚠️  Cannot continue with tests that require a dumpster');
      }
    } catch (error) {
      await logger.log(`✗ Error creating dumpster: ${error.message}`);
      console.log(`✗ Error creating dumpster: ${error.message}`);
      allTestsPassed = false;
      testDumpsterExists = false;
    }

    // Step 4: Test listing all dumpsters (only if dumpster exists)
    if (testDumpsterExists) {
      console.log('\n=== Step 4: Testing dumpster listing ===');
      try {
        console.log('Testing dumpster hoard command...');

        const hoardResult = await TestUtils.runCLICommand(['hoard'], {
          captureOutput: true,
          showRealTime: true,
        });

        await logger.logCommandResult('hoard', hoardResult);

        if (hoardResult.success) {
          // Check if our test dumpster is listed
          if (hoardResult.stdout.includes(dumpsterName)) {
            await logger.log('✓ Dumpster listing test passed');
            console.log('✓ Dumpster listing test passed');
          } else {
            await logger.log(
              '✗ Dumpster listing test failed - created dumpster not found in list'
            );
            console.log(
              '✗ Dumpster listing test failed - created dumpster not found in list'
            );
            allTestsPassed = false;
          }
        } else {
          await logger.log(
            `✗ Dumpster listing test failed with exit code ${hoardResult.exitCode}`
          );
          console.log(
            `✗ Dumpster listing test failed with exit code ${hoardResult.exitCode}`
          );
          allTestsPassed = false;
        }
      } catch (error) {
        await logger.log(`✗ Error testing dumpster listing: ${error.message}`);
        console.log(`✗ Error testing dumpster listing: ${error.message}`);
        allTestsPassed = false;
      }

      // Step 5: Test rummaging through the dumpster
      console.log('\n=== Step 5: Testing dumpster rummaging ===');
      try {
        console.log(`Rummaging through dumpster '${dumpsterName}'...`);

        const rummageResult = await TestUtils.runCLICommand(
          ['rummage', '-l', '10', dumpsterName],
          {
            captureOutput: true,
            showRealTime: true,
          }
        );

        await logger.logCommandResult(`rummage -l 10 ${dumpsterName}`, rummageResult);

        if (rummageResult.success) {
          await logger.log('✓ Dumpster rummaging test passed');
          console.log('✓ Dumpster rummaging test passed');
        } else {
          await logger.log(
            `✗ Dumpster rummaging test failed with exit code ${rummageResult.exitCode}`
          );
          console.log(
            `✗ Dumpster rummaging test failed with exit code ${rummageResult.exitCode}`
          );
          allTestsPassed = false;
        }
      } catch (error) {
        await logger.log(`✗ Error testing dumpster rummaging: ${error.message}`);
        console.log(`✗ Error testing dumpster rummaging: ${error.message}`);
        allTestsPassed = false;
      }

      // Step 6: Test upcycling the dumpster content
      console.log('\n=== Step 6: Testing dumpster upcycling ===');
      for (const format of upcycleFormats) {
        try {
          console.log(`Upcycling dumpster to ${format} format...`);

          const upcycleArgs = ['upcycle', format];

          if (format === 'html') {
            upcycleArgs.push('--self-contained');
          } else {
            upcycleArgs.push('--include-media');
          }

          upcycleArgs.push(dumpsterName);

          const upcycleResult = await TestUtils.runCLICommand(upcycleArgs, {
            captureOutput: true,
            showRealTime: true,
          });

          await logger.logCommandResult(
            `upcycle ${format} ${dumpsterName}`,
            upcycleResult
          );

          if (upcycleResult.success) {
            await logger.log(`✓ Upcycling to ${format} passed`);
            console.log(`✓ Upcycling to ${format} passed`);
          } else {
            await logger.log(
              `✗ Upcycling to ${format} failed with exit code ${upcycleResult.exitCode}`
            );
            console.log(
              `✗ Upcycling to ${format} failed with exit code ${upcycleResult.exitCode}`
            );
            allTestsPassed = false;
          }
        } catch (error) {
          await logger.log(`✗ Error upcycling to ${format}: ${error.message}`);
          console.log(`✗ Error upcycling to ${format}: ${error.message}`);
          allTestsPassed = false;
        }
      }
    } else {
      console.log('\n=== Skipping tests that require a dumpster ===');
      await logger.log('Skipping rummaging, upcycling tests due to missing dumpster');
    }

    // Step 7: Test burning the dumpster (cleanup)
    console.log('\n=== Step 7: Testing dumpster cleanup ===');
    if (testDumpsterExists) {
      try {
        console.log('Testing burn command with dry-run...');

        // First test with dry-run
        const burnDryRunResult = await TestUtils.runCLICommand(
          ['burn', '--dry-run', dumpsterName],
          {
            captureOutput: true,
            showRealTime: true,
          }
        );

        await logger.logCommandResult(
          `burn --dry-run ${dumpsterName}`,
          burnDryRunResult
        );

        if (burnDryRunResult.success) {
          await logger.log('✓ Burn dry-run test passed');
          console.log('✓ Burn dry-run test passed');

          // Now actually burn the dumpster
          console.log('Actually burning the dumpster...');
          const burnResult = await TestUtils.runCLICommand(
            ['burn', '-f', dumpsterName],
            {
              captureOutput: true,
              showRealTime: true,
            }
          );

          await logger.logCommandResult(`burn -f ${dumpsterName}`, burnResult);

          if (burnResult.success) {
            testDumpsterExists = false;
            await logger.log('✓ Burn test passed');
            console.log('✓ Burn test passed');
          } else {
            await logger.log(
              `✗ Burn test failed with exit code ${burnResult.exitCode}`
            );
            console.log(`✗ Burn test failed with exit code ${burnResult.exitCode}`);
            allTestsPassed = false;
          }
        } else {
          await logger.log(
            `✗ Burn dry-run test failed with exit code ${burnDryRunResult.exitCode}`
          );
          console.log(
            `✗ Burn dry-run test failed with exit code ${burnDryRunResult.exitCode}`
          );
          allTestsPassed = false;
        }
      } catch (error) {
        await logger.log(`✗ Error testing burn command: ${error.message}`);
        console.log(`✗ Error testing burn command: ${error.message}`);
        allTestsPassed = false;
      }
    }

    // Step 8: Final verification
    console.log('\n=== Step 8: Final verification ===');
    try {
      console.log('Testing final dumpster list...');

      const finalHoardResult = await TestUtils.runCLICommand(['hoard'], {
        captureOutput: true,
        showRealTime: true,
      });

      await logger.logCommandResult('hoard (final check)', finalHoardResult);

      if (finalHoardResult.success) {
        // Check that test dumpster is no longer listed
        if (!finalHoardResult.stdout.includes(dumpsterName)) {
          await logger.log('✓ Final verification passed - test dumpster cleaned up');
          console.log('✓ Final verification passed - test dumpster cleaned up');
        } else {
          await logger.log('✗ Final verification failed - test dumpster still exists');
          console.log('✗ Final verification failed - test dumpster still exists');
          allTestsPassed = false;
        }
      } else {
        await logger.log(
          `✗ Final verification failed with exit code ${finalHoardResult.exitCode}`
        );
        console.log(
          `✗ Final verification failed with exit code ${finalHoardResult.exitCode}`
        );
        allTestsPassed = false;
      }
    } catch (error) {
      await logger.log(`✗ Error in final verification: ${error.message}`);
      console.log(`✗ Error in final verification: ${error.message}`);
      allTestsPassed = false;
    }

    // Cleanup if anything went wrong
    if (testDumpsterExists) {
      console.log('\n=== Emergency cleanup ===');
      await TestUtils.cleanupTestEnvironment(dumpsterName, logger);
    }

    // Final summary
    await logger.separator('FULL SUITE TEST SUMMARY');
    await logger.log(`All tests completed: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
    await logger.log(`Results saved to: ${outputPath}`);

    console.log('\n================ TEST RESULTS ================');
    console.log(`Full suite tests completed: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
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
    await logger.log(`Fatal error in full suite tests: ${error.message}`);
    console.error(`Fatal error in full suite tests: ${error.message}`);

    // Emergency cleanup
    if (testDumpsterExists) {
      await TestUtils.cleanupTestEnvironment(dumpsterName, logger);
    }

    allTestsPassed = false;
  }

  process.exit(allTestsPassed ? 0 : 1);
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runFullSuiteTests().catch(error => {
    console.error('Full suite tests failed with fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runFullSuiteTests };
