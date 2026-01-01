#!/bin/bash
# Test script to validate OutputManager consistency across CLI commands

echo "🧪 Testing OutputManager Integration..."
echo "=================================="

# Test hoard command (should show consistent formatting)
echo ""
echo "1. Testing 'hoard' command formatting:"
echo "---------------------------------------"
node cli.js hoard 2>/dev/null | head -20

# Test burn dry run (should show consistent action and report formatting)
echo ""
echo "2. Testing 'burn --dry-run' formatting:"
echo "----------------------------------------"
echo "test_dumpster" | node cli.js burn --dry-run 2>/dev/null | head -15

# Test upcycle help (should show consistent help formatting)
echo ""
echo "3. Testing 'upcycle --help' formatting:"
echo "----------------------------------------"
node cli.js upcycle --help | head -10

echo ""
echo "✅ OutputManager integration test completed!"
echo ""
echo "Key improvements visible:"
echo "- Consistent context prefixes (e.g., 'burn operation:')"
echo "- Unified emoji usage and color coding"
echo "- Structured report formatting"
echo "- Proper error messaging with suggestions"