#!/bin/bash

# Ultra-minimal test runner for data-dumpster-diver CLI
# Simple, direct testing with clear output

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Optional logging (set LOG_TESTS=true to enable)
LOG_TESTS=${LOG_TESTS:-false}
LOG_DIR="tests/logs"
LOG_FILE="$LOG_DIR/minimal-test-$(date +%Y%m%d_%H%M%S).log"

# Counter
PASSED=0
FAILED=0

# Setup logging if enabled
if [ "$LOG_TESTS" = "true" ]; then
    mkdir -p "$LOG_DIR"
    echo "Minimal test log - $(date)" > "$LOG_FILE"
fi

# Log function (only writes if logging enabled)
log() {
    if [ "$LOG_TESTS" = "true" ]; then
        echo "$1" >> "$LOG_FILE"
    fi
}

# Test function
test() {
    local name="$1"
    local command="$2"
    
    echo -n "Testing $name... "
    log "Testing $name: $command"
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        log "Result: PASSED"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        log "Result: FAILED"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Test with expected output
test_output() {
    local name="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Testing $name... "
    
    if eval "$command" 2>/dev/null | grep -q "$expected"; then
        echo -e "${GREEN}✓${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}=== data-dumpster-diver CLI Tests ===${NC}\n"

# Basic CLI tests
test_output "CLI help" "node cli.js --help" "Usage:"
test_output "CLI help command" "node cli.js help" "Usage:"

# Individual command help
test_output "dump help" "node cli.js help dump" "Usage:"
test_output "hoard help" "node cli.js help hoard" "Usage:"
test_output "rummage help" "node cli.js help rummage" "Usage:"
test_output "upcycle help" "node cli.js help upcycle" "Usage:"
test_output "burn help" "node cli.js help burn" "Usage:"

# Command execution tests (should not crash)
test "hoard command" "node cli.js hoard"
test "invalid command fails" "! node cli.js invalid-command"

# Summary
echo -e "\n${BLUE}=== Results ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"

log "=== FINAL RESULTS ==="
log "Passed: $PASSED"
log "Failed: $FAILED"
log "Total: $((PASSED + FAILED))"

if [ "$LOG_TESTS" = "true" ]; then
    echo -e "${BLUE}Log: $LOG_FILE${NC}"
fi

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed.${NC}"
    exit 1
fi