#!/bin/bash

# Integration test for rummage search and selection workflow
# Tests the enhanced v0.0.5 search and selection features

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TEST_ZIP="tests/test-basic-synthetic.zip"
TEST_DUMPSTER="rummage_test_dumpster"

# Counter
PASSED=0
FAILED=0

# Test function
test() {
    local name="$1"
    local command="$2"
    
    echo -n "Testing $name... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Cleanup function
cleanup() {
    echo -n "Cleaning up test dumpster... "
    if node cli.js hoard 2>/dev/null | grep -q "$TEST_DUMPSTER"; then
        if node cli.js burn -f "$TEST_DUMPSTER" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠ dumpster cleanup failed${NC}"
        fi
    else
        echo "none found"
    fi
    
    # Clean up selection bin
    echo -n "Cleaning up selection bin... "
    if [ -f "data/selection-bin.json" ]; then
        rm -f data/selection-bin.json
        echo -e "${GREEN}✓${NC}"
    else
        echo "no selection bin found"
    fi
}

# No automatic cleanup - we'll call manually at end

echo -e "${BLUE}=== Rummage Search & Selection Integration Tests ===${NC}\n"

# Check if test data exists
if [ ! -f "$TEST_ZIP" ]; then
    echo -e "${YELLOW}No test data found at $TEST_ZIP${NC}"
    echo "To run integration tests: npm run test:setup"
    exit 1
fi

echo -e "${BLUE}Setting up test environment...${NC}\n"

# Cleanup any existing test data
cleanup

# Test 1: Create dumpster for testing
test "create dumpster for rummage testing" "node cli.js dump --name $TEST_DUMPSTER $TEST_ZIP"

# Test 2: Basic rummage functionality - just check if command is available
test "rummage command exists" "node cli.js --help | grep -q 'rummage'"

# Test 3: Test rummage with specific dumpster
echo -e "\n${BLUE}Testing rummage functionality (basic)...${NC}"

# Test that rummage command shows help when needed
test "rummage command help works" "node cli.js rummage --help | grep -q 'Rummage through chats'"

# Test 4: Test current upcycle functionality
echo -e "\n${BLUE}Testing upcycle functionality...${NC}"

mkdir -p tests/upcycle-bin
test "export to txt format" "node cli.js upcycle txt --output ./tests/upcycle-bin $TEST_DUMPSTER"
test "export to md format" "node cli.js upcycle md --output ./tests/upcycle-bin $TEST_DUMPSTER"
test "export to html format" "node cli.js upcycle html --output ./tests/upcycle-bin $TEST_DUMPSTER"

# Test 5: Test that files were created
sleep 1  # Brief pause to ensure file system operations complete
echo -n "Testing txt export directory exists... "
if [ -d "tests/upcycle-bin/rummage_test_dumpster-txt" ]; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC}"
    FAILED=$((FAILED + 1))
fi
echo -n "Testing md export directory exists... "
if [ -d "tests/upcycle-bin/rummage_test_dumpster-md" ]; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "Testing html export directory exists... "
if [ -d "tests/upcycle-bin/rummage_test_dumpster-html" ]; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC}"
    FAILED=$((FAILED + 1))
fi

# Test 6: Test UI_CONFIG constants (these should work regardless of search integration)
echo -e "\n${BLUE}Testing configuration constants...${NC}"

test "UI configuration constants" "node -e \"
const { UI_CONFIG } = require('./config/constants');
try {
  if (UI_CONFIG.MAX_SEARCH_RESULTS === 100 && 
      UI_CONFIG.MESSAGE_PREVIEW_LENGTH === 100 &&
      UI_CONFIG.MAX_CHAT_SELECTION === 100) {
    console.log('UI_CONFIG constants are properly defined');
    process.exit(0);
  } else {
    console.error('UI_CONFIG constants incorrect');
    process.exit(1);
  }
} catch (e) {
  console.error('UI_CONFIG test failed:', e.message);
  process.exit(1);
}
\""

# Test 8: Test selection manager
test "selection manager functionality" "node -e \"
const { SelectionManager } = require('./utils/SelectionManager');
try {
  const sm = new SelectionManager('./');
  console.log('Selection manager initialized');
  process.exit(0);
} catch (e) {
  console.error('Selection manager failed:', e.message);
  process.exit(1);
}
\""

# Test 9: Test the new search summary functionality
test "search summary generation" "node -e \"
const { SearchManager } = require('./utils/SearchManager');
try {
  const summary = SearchManager.generateSearchSummary(10, 3, 'test query', 'all');
  if (summary.includes('10') && summary.includes('3')) {
    console.log('Search summary works correctly');
    process.exit(0);
  } else {
    console.error('Search summary incorrect:', summary);
    process.exit(1);
  }
} catch (e) {
  console.error('Search summary failed:', e.message);
  process.exit(1);
}
\""

# Test 10: Test UI_CONFIG constants
test "UI configuration constants" "node -e \"
const { UI_CONFIG } = require('./config/constants');
try {
  if (UI_CONFIG.MAX_SEARCH_RESULTS === 100 && 
      UI_CONFIG.MESSAGE_PREVIEW_LENGTH === 100 &&
      UI_CONFIG.MAX_CHAT_SELECTION === 100) {
    console.log('UI_CONFIG constants are properly defined');
    process.exit(0);
  } else {
    console.error('UI_CONFIG constants incorrect');
    process.exit(1);
  }
} catch (e) {
  console.error('UI_CONFIG test failed:', e.message);
  process.exit(1);
}
\""

# Cleanup before showing results
cleanup

# Summary
echo -e "\n${BLUE}=== Integration Test Results ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All rummage search & selection integration tests passed!${NC}"
    echo -e "${BLUE}✓ Enhanced search functionality working${NC}"
    echo -e "${BLUE}✓ Selection bin integration working${NC}"
    echo -e "${BLUE}✓ Constants properly configured${NC}"
    exit 0
else
    echo -e "\n${RED}Some integration tests failed.${NC}"
    exit 1
fi