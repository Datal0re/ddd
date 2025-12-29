# Data Dumpster Diver

A Node.js CLI tool to process and explore exported ChatGPT conversation data. Transform ZIP exports into organized, searchable dumpsters with extracted media assets.

[![version](https://img.shields.io/badge/version-0.0.4-blue.svg)](https://github.com/Datal0re/ddd) [![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-14%2B-brightgreen.svg)](https://nodejs.org/)

## 🗑️ What It Does

- **Dump**: Unpack and process ChatGPT export ZIP files into structured dumpsters (interactive)
- **Hoard**: View your collection of processed dumpsters
- **Rummage**: Explore chats within specific dumpsters (interactive)
- **Burn**: Safely delete dumpsters with confirmation prompts and text verification
- **Upcycle**: Export dumpsters to various formats (HTML, Markdown, Text)
- **Organize**: Automatically extract and organize media assets (images, files, audio)
- **Secure**: Validate ZIP files against path traversal and zip bomb attacks
- **Interactive**: User-friendly prompts when arguments are omitted

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

# Explore chats in a dumpster (interactive selection)
ddd rummage my-chats --limit 10
ddd rummage  # Will prompt for dumpster and limit

# Burn (delete) a dumpster safely (with confirmation and text verification)
ddd burn my-chats
ddd burn --dry-run  # Preview without deletion
ddd burn --force    # Skip confirmation

# Export dumpsters to various formats (interactive prompts)
ddd upcycle txt my-chats --output ./exports
ddd upcycle html my-chats --include-media --self-contained
ddd upcycle  # Will prompt for format and dumpster

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

Rummage through chats in a specific dumpster.

```bash
ddd rummage <dumpster-name> [options]
ddd rummage  # Interactive mode
```

**Options**: `-l, --limit <number>` for chat count

### `burn [dumpster-name]`

Safely delete a dumpster with confirmation and text verification.

```bash
ddd burn <dumpster-name> [options]
ddd burn  # Interactive mode
```

**Options**: `-f, --force` (skip confirmation), `--dry-run` (preview)

### `upcycle [format] [dumpster-name]`

Export dumpsters to various formats.

```bash
ddd upcycle <format> <dumpster-name> [options]
ddd upcycle  # Fully interactive mode
```

**Formats**: `txt`, `md`, `html`
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

**Version**: 0.0.4 | **Last Updated**: 2024-12-29
