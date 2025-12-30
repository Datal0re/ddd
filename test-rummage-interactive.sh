#!/bin/bash

echo "Testing rummage command with simulated input..."

# Test the rummage command with predefined inputs
# Note: This simulates the expected interactive workflow
printf "javascript\n1\nno\n1 2\n1\n5\n" | node cli.js rummage buffalo

echo "Rummage test completed."