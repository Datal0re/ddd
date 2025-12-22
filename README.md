# Data Dumpster Diver

A Node.js CLI tool to process and explore exported ChatGPT conversation data. Transform ZIP exports into organized, searchable dumpsters with extracted media assets.

## 🗑️ What It Does

- **Dump**: Unpack and process ChatGPT export ZIP files into structured dumpsters
- **Hoard**: View your collection of processed dumpsters
- **Rummage**: Explore chats within specific dumpsters
- **Burn**: Safely delete dumpsters with confirmation prompts
- **Organize**: Automatically extract and organize media assets (images, files, audio)
- **Secure**: Validate ZIP files against path traversal and zip bomb attacks

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd data-dumpster-diver

# Install dependencies
npm install

# Make CLI globally available (optional)
npm link
```

### Basic Usage

```bash
# Process a ChatGPT export
ddd dump chatgpt-export.zip --name "my-chats"

# View all dumpsters
ddd hoard

# Explore chats in a dumpster
ddd rummage my-chats --limit 10

# Burn (delete) a dumpster
ddd burn my-chats

# Export dumpsters to various formats
ddd upcycle txt my-chats --output ./exports
ddd upcycle html my-chats --include-media --self-contained
ddd upcycle md my-chats --single-file

# Get help
ddd --help
```

## 📋 Commands

### `dump <file>`

Unpack and process a ChatGPT export ZIP file.

```bash
ddd dump <path-to-zip> [options]
```

**Options:**

- `-n, --name <name>`: Custom name for the dumpster (default: "default")
- `-v, --verbose`: Enable verbose output

**Example:**

```bash
ddd dump ./exports/chatgpt-2024.zip --name "2024-chats" --verbose
```

### `hoard`

View your dumpster hoard - lists all processed dumpsters.

```bash
ddd hoard [options]
```

**Options:**

- `-v, --verbose`: Show detailed information (creation date, chat count)

**Example:**

```bash
ddd hoard --verbose
```

### `rummage <dumpster-name>`

Rummage through chats in a specific dumpster.

```bash
ddd rummage <dumpster-name> [options]
```

**Options:**

- `-l, --limit <number>`: Number of chats to show (default: 10)

**Example:**

```bash
ddd rummage 2024-chats --limit 5
```

### `burn <dumpster-name>`

Set a dumpster on fire - permanently delete it with confirmation.

```bash
ddd burn <dumpster-name> [options]
```

**Options:**

- `-f, --force`: Skip confirmation prompt
- `--dry-run`: Show what would be burned without actually burning

**Example:**

```bash
ddd burn old-chats --dry-run
ddd burn old-chats --force
```

### `upcycle <format> <dumpster-name>`

Upcycle dumpsters to various export formats.

```bash
ddd upcycle <format> <dumpster-name> [options]
```

**Formats:**

- `txt`: Plain text format
- `md`: Markdown format
- `html`: HTML format

**Options:**

- `-o, --output <path>`: Output directory (default: `./upcycles`)
- `-s, --single-file`: Combine all chats into single file
- `--per-chat`: Create separate file per chat (default)
- `--include-media`: Copy media assets to export directory
- `--self-contained`: Embed assets in output (HTML only)
- `-v, --verbose`: Verbose output

**Examples:**

```bash
# Export to text with separate files
ddd upcycle txt my-chats --output ./text-exports

# Export to HTML with embedded assets
ddd upcycle html my-chats --self-contained --single-file

# Export to Markdown with media included
ddd upcycle md my-chats --include-media --verbose
```

## 🏗️ Architecture

The codebase follows a clean, modular architecture with clear separation of concerns:

```text
CLI Layer (cli.js)
├── Commands: dump, hoard, rummage, burn, upcycle
├── User Interface & Error Handling
└── Progress Display

Business Logic Layer (DumpsterManager.js)
├── Dumpster Lifecycle Management
├── Metadata Persistence
└── High-Level Operations

Export Layer (UpcycleManager.js)
├── Export Format Management
├── Asset Processing & Copying
└── Output Generation

Processing Layer (data/)
├── dumpster-processor.js - Main orchestration
├── chat-dumper.js - Conversation processing
└── extract-assets.js - Asset extraction

Utility Layer (utils/)
├── fsHelpers.js - File system operations
├── pathUtils.js - Path manipulation & searching
├── assetUtils.js - Asset handling
├── ChatUpcycler.js - Chat processing for export
├── upcycleHelpers.js - Export helper functions
├── zipProcessor.js - ZIP processing & security
├── validators.js - Input validation
├── progressTracker.js - Progress tracking
└── formatters/ - Export format handlers
```

## 🗂️ Data Organization

Processed exports are organized as follows:

```text
data/
├── dumpsters/
│   └── {dumpster-name}/
│       ├── chats/
│       │   ├── conversation-1.json
│       │   ├── conversation-2.json
│       │   └── ...
│       ├── media/
│       │   ├── file-attachments/
│       │   ├── dalle-generations/
│       │   └── audio/
│       └── chat.html
├── temp/           # Temporary processing files
└── dumpsters.json   # Dumpster registry
```

## 🛡️ Security Features

- **Path Traversal Protection**: Validates all file paths against directory traversal attacks
- **ZIP Bomb Protection**: Validates compression ratios and file counts
- **Size Limits**: Configurable limits for uploads and extracted content
- **Input Validation**: Comprehensive parameter validation throughout

## 🔧 Development

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Run specific data processing
npm run extract-assets
```

### Project Structure

```text
data-dumpster-diver/
├── cli.js                    # Main CLI entry point
├── package.json              # Dependencies and scripts
├── eslint.config.js         # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── .prettierignore          # Prettier ignore rules
├── config/
│   └── constants.js          # Configuration constants
├── data/
│   ├── dumpster-processor.js  # Main processing orchestration
│   ├── chat-dumper.js      # Chat data processing
│   └── extract-assets.js     # Asset extraction from HTML
├── utils/
│   ├── DumpsterManager.js    # Core dumpster management
│   ├── fsHelpers.js         # File system operations
│   ├── pathUtils.js          # Path operations & searching
│   ├── assetUtils.js         # Asset handling utilities
│   ├── ChatUpcycler.js      # Chat message processing & export
│   ├── UpcycleManager.js    # Export format management
│   ├── zipProcessor.js       # ZIP processing & security
│   ├── validators.js         # Input validation
│   ├── progressTracker.js    # Progress tracking
│   ├── upcycleHelpers.js    # Export helper functions
│   └── formatters/          # Export formatters
│       ├── BaseFormatter.js
│       ├── HTMLFormatter.js
│       ├── MDFormatter.js
│       └── TXTFormatter.js
├── AGENTS.md               # Development guidelines
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # This file
```

### Code Quality

- **ESLint**: Configured for consistent code style
- **Prettier**: Automatic code formatting
- **CommonJS**: Module system for maximum compatibility
- **JSDoc**: Comprehensive documentation for all functions

## 📝 Configuration

Configuration is handled through `config/constants.js`:

```javascript
{
  LIMITS: {
    MAX_UPLOAD_SIZE: 500 * 1024 * 1024,      // 500MB
    MAX_EXTRACTED_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
    MAX_FILES_IN_ZIP: 10000,
    MAX_COMPRESSION_RATIO: 100
  },
  FILE_EXTENSIONS: {
    // Supported file extensions for various asset types
  },
  ASSET_PREFIXES: {
    // Asset path prefixes for different types
  }
}
```

## 🔄 Recent Improvements (v0.0.1)

### Codebase Refactoring

- **Duplicate Elimination**: Removed 106 lines of duplicate code
- **Consolidated Functions**: Single source of truth for core operations
  - `moveMediaFiles()` → `AssetUtils.moveMediaFiles()`
  - `validatePath()` → `PathUtils.validatePath()`
  - `copyDirectory()` → `PathUtils.copyDirectory()`
- **Standardized Temp Directory Logic**:
  - `createSystemTempDir()` for OS temp directories
  - `createProjectTempDir()` for project temp directories
- **Enhanced Documentation**: Comprehensive JSDoc explaining consolidation rationale

### Architecture Improvements

- **Clear Separation of Concerns**: Utility modules have focused responsibilities
- **Better Error Handling**: Consistent patterns across all modules
- **Improved Performance**: Better APIs and reduced redundancy
- **Enhanced Security**: Centralized path validation with comprehensive checks

## 🧪 Testing

The codebase includes comprehensive testing for core functionality:

```bash
# Run individual tests
node -e "require('./utils/AssetUtils').test()"
node -e "require('./utils/PathUtils').test()"
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Follow the development guidelines in [AGENTS.md](AGENTS.md)
2. Maintain consistent code style (ESLint + Prettier)
3. Add comprehensive JSDoc for new functions
4. Test all changes thoroughly
5. Keep security best practices in mind

## 🔍 Future Enhancements

Planned improvements include:

- **Additional CLI Commands**: `inspect`, `stats`, `search`
- **Service Layer**: Better abstraction for business logic
- **Error Handling**: Standardized error framework
- **Configuration**: User-configurable settings
- **Export Formats**: Support for different output formats
- **Search Functionality**: Full-text search across chats
- **Enhanced Burn Command**: Batch deletion and recycling bin functionality

## 📞 Support

For issues, questions, or contributions, please refer to the project repository or development guidelines in `AGENTS.md`.
