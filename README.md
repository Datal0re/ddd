# Data Dumpster Diver

A Node.js CLI tool to process and explore exported ChatGPT conversation data. Transform ZIP exports into organized, searchable dumpsters with extracted media assets.

[![version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/Datal0re/ddd) [![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-14%2B-brightgreen.svg)](https://nodejs.org/)

## 🗑️ What It Does

- **🧙‍♂️ Wizard-Based CLI**: Progressive disclosure workflows guide users through complex operations step-by-step
- **📦 Service Layer Architecture**: Clean separation of business logic with consistent error handling
- **🎯 Dump**: Unpack and process ChatGPT export ZIP files into structured dumpsters (wizard-guided)
- **💎 Hoard**: View your collection of processed dumpsters with rich formatting
- **🔍 Rummage**: Search and select chats with intelligent wizard workflow and persistent selection bin
- **🔥 Burn**: Safely delete dumpsters with multi-step confirmation and text verification
- **♻️ Upcycle**: Export dumpsters or selection bin to various formats (wizard-guided format selection)
- **📊 Unified Output**: Consistent console formatting with contextual error recovery suggestions
- **🛡️ Secure**: Comprehensive validation against path traversal, zip bomb, and injection attacks
- **✨ Interactive**: Intuitive prompts when arguments omitted - every command works interactively

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Datal0re/ddd.git
cd ddd

# Install dependencies
npm install

# Make CLI globally available (optional)
npm link
```

### Basic Usage

All commands are interactive - if you omit arguments, you'll be prompted for them:

```bash
# Process a ChatGPT export (interactive prompts if args omitted)
ddd dump chatgpt-export.zip --name "my-chats"
ddd dump  # Will prompt for file path and name

# View all dumpsters
ddd hoard
ddd hoard --verbose  # Detailed view with creation dates

# Search and select chats with wizard-guided workflow
ddd rummage
# Progressive disclosure: dumpster → action → search → selection → export options

# Burn (delete) a dumpster safely (with confirmation and text verification)
ddd burn my-chats
ddd burn --dry-run  # Preview without deletion
ddd burn --force    # Skip confirmation

# Export dumpsters to various formats (interactive prompts)
ddd upcycle txt my-chats --output ./exports
ddd upcycle html my-chats --include-media --self-contained
ddd upcycle  # Will prompt for format and export source (dumpster vs selection bin)

# Get help
ddd --help
ddd dump --help  # Command-specific help
```

## 📋 Commands Overview

### `dump [file]`

Unpack and process a ChatGPT export ZIP file.

```bash
ddd dump <path-to-zip> [options]
ddd dump  # Interactive mode
```

**Options**: `-n, --name <name>`, `-v, --verbose`

### `hoard`

View your dumpster hoard - lists all processed dumpsters.

```bash
ddd hoard [options]
```

**Options**: `-v, --verbose` for detailed information

### `rummage [dumpster-name]`

Advanced wizard-guided search and selection workflow.

```bash
ddd rummage <dumpster-name> [options]
ddd rummage  # Full wizard experience
```

**Wizard Flow**:

1. 🗑️ Select dumpster (conditional)
2. 🎯 Choose action: 🔍 Search, 📋 Browse, 📦 Manage selection bin
3. 🔍 Search query (conditional for search action)
4. 🌐 Search scope (conditional for search action)
5. 🔄 Case sensitivity (conditional for search action)
6. 📊 Chat limit (conditional for browse action)
7. ☑️ Multi-select chat interface
8. 🎬 Action menu for selected chats

**Features**: Persistent selection bin, relevance scoring, context-aware options

### `burn [dumpster-name]`

Safely delete a dumpster with confirmation and text verification.

```bash
ddd burn <dumpster-name> [options]
ddd burn  # Interactive mode
```

**Options**: `-f, --force` (skip confirmation), `--dry-run` (preview)

### `upcycle [format] [dumpster-name]`

Export dumpsters or selection bin with wizard-guided format selection.

```bash
ddd upcycle <format> <dumpster-name> [options]
ddd upcycle  # Full wizard: format → source → options → export
```

**Export Sources**:

- 📦 Entire dumpster with all chats
- 📋 Selection bin (persistent chat selections from rummage)
- 🔍 Individual chat selections

**Formats**: `txt`, `md`, `html` with rich media support
**Options**: `-o, --output <path>`, `--include-media`, `--self-contained`, `-v, --verbose`

## 🗂️ Data Organization

Processed exports are organized as follows:

```text
data/
├── dumpsters/
│   └── {dumpster-name}/
│       ├── chats/                    # Processed chat data
│       └── media/                    # Extracted media assets
│           ├── file-attachments/
│           ├── dalle-generations/
│           └── audio/
├── temp/               # Temporary processing files (auto-cleanup)
├── upcycle-bin/        # Default export directory
└── dumpsters.json      # Dumpster registry with metadata
```

## 🛡️ Security Features

- **Path Traversal Protection**: Validates all file paths against directory traversal attacks
- **ZIP Bomb Protection**: Validates compression ratios and file counts
- **Size Limits**: Configurable limits for uploads and extracted content
- **Input Validation**: Comprehensive parameter validation throughout

## 🧪 Testing

The project includes a comprehensive shell-based test suite for realistic CLI testing:

```bash
# Run the main test suite
npm test

# Run specific test categories
npm run test:basic        # Basic functionality tests
npm run test:workflows    # End-to-end workflow tests
npm run test:with-logs    # Tests with detailed logging

# Test data management
npm run test:setup        # Generate synthetic test data and ZIP file
npm run test:cleanup      # Clean up test artifacts
```

### Test Structure

- **Shell Script Tests**: Real CLI command testing with actual scenarios
- **Synthetic Test Data**: Consistent, reproducible ChatGPT export structure
- **Workflow Testing**: End-to-end validation of complete user workflows
- **Quick Validation**: Fast tests for basic functionality verification

## 📦 Requirements

- **Node.js**: >=14.0.0
- **Key Dependencies**: @inquirer/prompts, commander, decompress, chalk, ora
- **Platform**: macOS, Linux, Windows (with WSL recommended)

## 🤝 Contributing

We welcome contributions! Please:

1. Follow the development guidelines in [AGENTS.md](AGENTS.md)
2. Maintain consistent code style (ESLint + Prettier)
3. Add comprehensive tests for new features
4. Ensure interactive prompts work correctly

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **[Development Guide](AGENTS.md)** - Architecture, development setup, and contributing
- **[Changelog](CHANGELOG.md)** - Version history and feature evolution
- **[Issues](https://github.com/Datal0re/ddd/issues)** - Report bugs and request features

---

**Version**: 0.1.0 | **Last Updated**: 2026-01-01 | **Major Release**: Wizard-Based CLI 🎉
