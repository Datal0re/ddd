#!/bin/bash

# Simple test runner for data-dumpster-diver CLI
# Runs both basic and workflow tests

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== data-dumpster-diver Test Runner ===${NC}\n"

# Run basic tests
echo "Running basic CLI tests..."
bash tests/minimal-test.sh
BASIC_RESULT=$?

echo ""

# Run workflow tests
echo "Running workflow tests..."
bash tests/minimal-workflow-test.sh
WORKFLOW_RESULT=$?

# Overall result
echo -e "\n${BLUE}=== Overall Results ===${NC}"
if [ $BASIC_RESULT -eq 0 ] && [ $WORKFLOW_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${BLUE}Test environment clean${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi