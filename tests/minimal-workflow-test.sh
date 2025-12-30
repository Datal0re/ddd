#!/bin/bash

# Ultra-minimal workflow test runner for data-dumpster-diver CLI
# Tests complete workflows when test data is available

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TEST_ZIP="tests/test-basic-synthetic.zip"
TEST_DUMPSTER="workflow_test_dumpster"

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
    
    echo -n "Cleaning up test exports... "
    if [ -d "tests/upcycle-bin" ]; then
        rm -rf tests/upcycle-bin/*
        echo -e "${GREEN}✓${NC}"
    else
        echo "no exports found"
    fi
}

# Setup cleanup on exit
trap cleanup EXIT

echo -e "${BLUE}=== Workflow Tests (requires test data) ===${NC}\n"

# Check if test data exists
if [ ! -f "$TEST_ZIP" ]; then
    echo -e "${YELLOW}No test data found at $TEST_ZIP${NC}"
    echo "To run workflow tests: npm run test:setup"
    echo "Running basic command tests only...\n"
    
    # Just test basic commands
    test "CLI help" "node cli.js --help | grep -q 'Usage:'"
    test "hoard command" "node cli.js hoard"
    echo -e "\n${BLUE}=== Results ===${NC}"
    echo -e "Passed: ${GREEN}$PASSED${NC}"
    echo -e "Failed: ${RED}$FAILED${NC}"
    exit $FAILED
fi

echo -e "${BLUE}Found test data, running full workflow test...${NC}\n"

# Cleanup any existing test dumpster
cleanup

# Test 1: Create dumpster
test "create dumpster" "node cli.js dump --name $TEST_DUMPSTER $TEST_ZIP"

# Test 2: List dumpsters and check ours exists
echo -n "Testing dumpster appears in list... "
if node cli.js hoard | grep -q "$TEST_DUMPSTER"; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC}"
    FAILED=$((FAILED + 1))
fi

# Test 3: Rummage through dumpster (skipped - interactive command)
echo -n "Testing rummage dumpster... "
echo -e "${YELLOW}⚠ skipped (interactive)${NC}"

# Test 4: Export to different formats
mkdir -p tests/upcycle-bin
test "export to txt" "node cli.js upcycle txt --output ./tests/upcycle-bin $TEST_DUMPSTER"
test "export to md" "node cli.js upcycle md --output ./tests/upcycle-bin $TEST_DUMPSTER"
test "export to html" "node cli.js upcycle html --output ./tests/upcycle-bin $TEST_DUMPSTER"

# Test 5: Burn dumpster (cleanup will handle this)
test "burn dumpster" "node cli.js burn -f $TEST_DUMPSTER"

# Summary
echo -e "\n${BLUE}=== Results ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All workflow tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some workflow tests failed.${NC}"
    exit 1
fi