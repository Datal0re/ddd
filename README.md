# Data Dumpster Diver

A Node.js CLI tool to process and explore exported ChatGPT conversation data. Transform ZIP exports into organized, searchable dumpsters with extracted media assets.

## 🗑️ What It Does

- **Dump**: Unpack and process ChatGPT export ZIP files into structured dumpsters
- **Hoard**: View your collection of processed dumpsters
- **Rummage**: Explore conversations within specific dumpsters
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

# Explore conversations in a dumpster
ddd rummage my-chats --limit 10

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

- `-l, --limit <number>`: Number of conversations to show (default: 10)

**Example:**

```bash
ddd rummage 2024-chats --limit 5
```

## 🏗️ Architecture

The codebase follows a clean, modular architecture with clear separation of concerns:

```text
CLI Layer (cli.js)
├── Commands: dump, hoard, rummage
├── User Interface & Error Handling
└── Progress Display

Business Logic Layer (DumpsterManager.js)
├── Dumpster Lifecycle Management
├── Metadata Persistence
└── High-Level Operations

Processing Layer (data/)
├── dumpster-processor.js - Main orchestration
├── conversation-dumper.js - Conversation processing
└── extract-assets.js - Asset extraction

Utility Layer (utils/)
├── fsHelpers.js - File system operations
├── pathUtils.js - Path manipulation & searching
├── assetUtils.js - Asset handling
├── zipProcessor.js - ZIP processing & security
├── validators.js - Input validation
├── progressTracker.js - Progress tracking
└── cliFramework.js - CLI utilities
```

## 🗂️ Data Organization

Processed exports are organized as follows:

```text
data/
├── dumpsters/
│   └── {dumpster-name}/
│       ├── conversations/
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

# Format code
npm run format

# Run specific data processing
npm run extract-assets
```

### Project Structure

```text
data-dumpster-diver/
├── cli.js                    # Main CLI entry point
├── package.json              # Dependencies and scripts
├── config/
│   └── constants.js          # Configuration constants
├── data/
│   ├── dumpster-processor.js  # Main processing orchestration
│   ├── conversation-dumper.js  # Conversation data processing
│   └── extract-assets.js     # Asset extraction from HTML
├── utils/
│   ├── DumpsterManager.js     # Core dumpster management
│   ├── fsHelpers.js         # File system operations
│   ├── pathUtils.js          # Path operations & searching
│   ├── assetUtils.js         # Asset handling utilities
│   ├── zipProcessor.js       # ZIP processing & security
│   ├── validators.js         # Input validation
│   ├── progressTracker.js    # Progress tracking
│   └── cliFramework.js       # CLI utilities
└── AGENTS.md               # Development guidelines
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

## 🔄 Recent Improvements (v2.0.0-alpha)

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

- **Additional CLI Commands**: `delete`, `inspect`, `stats`, `search`
- **Service Layer**: Better abstraction for business logic
- **Error Handling**: Standardized error framework
- **Configuration**: User-configurable settings
- **Export Formats**: Support for different output formats
- **Search Functionality**: Full-text search across conversations

## 📞 Support

For issues, questions, or contributions, please refer to the project repository or development guidelines in `AGENTS.md`.
