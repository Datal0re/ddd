# Data Dumpster Diver

A Node.js CLI tool to process and explore exported ChatGPT conversation data. Transform ZIP exports into organized, searchable dumpsters with extracted media assets.

**Version**: 0.0.4 | **License**: MIT | **Node.js**: >=14.0.0

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
git clone <repository-url>
cd data-dumpster-diver

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

## 📋 Commands

### `dump [file]`

Unpack and process a ChatGPT export ZIP file. Interactive prompts when arguments omitted.

```bash
ddd dump <path-to-zip> [options]
ddd dump  # Interactive mode
```

**Options:**

- `-n, --name <name>`: Custom name for the dumpster (will prompt if not provided)
- `-v, --verbose`: Enable verbose output

**Examples:**

```bash
ddd dump ./exports/chatgpt-2024.zip --name "2024-chats" --verbose
ddd dump  # Will prompt for file path and dumpster name
```

### `hoard`

View your dumpster hoard - lists all processed dumpsters.

```bash
ddd hoard [options]
```

**Options:**

- `-v, --verbose`: Show detailed information (creation date, chat count)

**Examples:**

```bash
ddd hoard --verbose
ddd hoard  # Simple list
```

### `rummage [dumpster-name]`

Rummage through chats in a specific dumpster. Interactive selection when no argument.

```bash
ddd rummage <dumpster-name> [options]
ddd rummage  # Interactive mode
```

**Options:**

- `-l, --limit <number>`: Number of chats to show (will prompt if not provided)

**Examples:**

```bash
ddd rummage 2024-chats --limit 5
ddd rummage  # Will prompt for dumpster and limit
```

### `burn [dumpster-name]`

Set a dumpster on fire - permanently delete it with confirmation and text verification.

```bash
ddd burn <dumpster-name> [options]
ddd burn  # Interactive mode
```

**Options:**

- `-f, --force`: Skip confirmation prompt
- `--dry-run`: Show what would be burned without actually burning

**Examples:**

```bash
ddd burn old-chats --dry-run
ddd burn old-chats --force
ddd burn  # Interactive mode with selection and verification
```

### `upcycle [format] [dumpster-name]`

Upcycle dumpsters to various export formats. Interactive prompts when arguments omitted.

```bash
ddd upcycle <format> <dumpster-name> [options]
ddd upcycle  # Fully interactive mode
```

**Formats:**

- `txt`: Plain text format
- `md`: Markdown format
- `html`: HTML format

**Options:**

- `-o, --output <path>`: Output directory (default: `./data/upcycle-bin`)
- `--include-media`: Copy media assets to export directory (default: true)
- `--self-contained`: Embed assets in output (HTML only)
- `-v, --verbose`: Verbose output

**Examples:**

```bash
ddd upcycle txt my-chats --output ./text-exports
ddd upcycle html my-chats --self-contained --verbose
ddd upcycle  # Will prompt for format and dumpster
```

### 📝 Export Formatters

The project uses a modular formatter system with a base class and format-specific implementations:

#### BaseFormatter

Abstract base class that defines the interface for all formatters:

- `formatChat(processedChat, options)` - Format individual chat
- `combineChats(results)` - Combine multiple chats for single-file export
- `getFileExtension()` - Get file extension for the format
- `getMimeType()` - Get MIME type for the format

#### HTMLFormatter

- **Features**: Full HTML export with CSS styling
- **Media Support**: Embedded or linked assets
- **Self-contained**: Option to include all assets inline
- **Rich Content**: Preserves formatting, links, and structure

#### MDFormatter

- **Format**: Clean Markdown with proper headers
- **Code Blocks**: Preserves code formatting with syntax highlighting hints
- **Links**: Maintains clickable links and references
- **Compatibility**: Works with all Markdown viewers

#### TXTFormatter

- **Simplicity**: Plain text with minimal formatting
- **Readability**: Clean, accessible format
- **Compatibility**: Works with any text editor
- **Size**: Most compact export option

## 🏗️ Architecture

The codebase follows a clean, modular architecture with clear separation of concerns:

```text
CLI Layer (cli.js)
├── Commands: dump, hoard, rummage, burn, upcycle
├── Interactive Prompts (@inquirer/prompts)
├── Progress Display (ProgressManager.js)
└── Error Handling & Validation

Business Logic Layer
├── DumpsterManager.js - Core dumpster lifecycle management
├── DumpsterProcessor.js - Main processing orchestration
├── AssetExtractor.js - Asset extraction and organization
└── FileUtils.js - File operations and validation

Export Layer
├── UpcycleManager.js - Export format management and coordination
├── ChatUpcycler.js - Chat message processing for export
└── Formatter System (utils/formatters/)
    ├── BaseFormatter.js - Abstract base class
    ├── HTMLFormatter.js - HTML export with media support
    ├── MDFormatter.js - Markdown export formatting
    └── TXTFormatter.js - Plain text export

Utility Layer (utils/)
├── ProgressManager.js - Progress tracking and user feedback
├── ErrorHandler.js - Centralized error handling and logging
├── SchemaValidator.js - Input validation and data integrity
├── CliPrompts.js - Interactive command-line prompts
├── CommonUtils.js - Shared utility functions
├── assetUtils.js - Asset handling utilities
├── upcycleHelpers.js - Export helper functions
├── zipProcessor.js - ZIP processing and security
└── ChatDumper.js - Chat data processing and dumping

Configuration Layer
└── config/constants.js - Configuration constants and limits
```

## 🗂️ Data Organization

Processed exports are organized as follows:

```text
data/
├── dumpsters/
│   └── {dumpster-name}/
│       ├── chats/
│       │   ├── YYY.MM.DD_conversation-1.json
│       │   ├── YYY.MM.DD_conversation-2.json
│       │   └── ...                   # Processed chat data
│       └── media/
│           ├── file-attachments/     # Uploaded files
│           ├── dalle-generations/    # DALL-E images
│           └── audio/                # Voice recordings
├── temp/               # Temporary processing files (auto-cleanup)
├── upcycle-bin/        # Default export directory for upcycled content
└── dumpsters.json      # Dumpster registry with metadata
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

# Direct CLI testing
ddd --help                # Test CLI help
ddd dump --help           # Test command help

# Code quality
npm run lint              # Check code style
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code with Prettier
npm run format:check      # Check formatting without changes

# Testing
npm test                  # Run full test suite
npm run test:help         # Test CLI help functionality
npm run test:validate     # Test validation utilities
```

### Project Structure

```text
data-dumpster-diver/
├── cli.js                    # Main CLI entry point (binary: ddd)
├── package.json              # Dependencies and scripts (v0.0.4)
├── eslint.config.js         # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── .prettierignore          # Prettier ignore rules
├── config/
│   └── constants.js          # Configuration constants and limits
├── utils/
│   ├── AssetExtractor.js     # Asset extraction and organization
│   ├── ChatDumper.js         # Chat data processing and dumping
│   ├── ChatUpcycler.js       # Chat message processing & export
│   ├── CliPrompts.js         # Interactive command-line prompts
│   ├── CommonUtils.js        # Common utility functions
│   ├── DumpsterManager.js    # Core dumpster management
│   ├── DumpsterProcessor.js  # Main processing orchestration
│   ├── ErrorHandler.js       # Centralized error handling and logging
│   ├── FileUtils.js          # File operations and validation
│   ├── ProgressManager.js    # Progress tracking and user feedback
│   ├── SchemaValidator.js    # Input validation and data integrity
│   ├── UpcycleManager.js     # Export format management and coordination
│   ├── assetUtils.js         # Asset handling utilities
│   ├── upcycleHelpers.js     # Export helper functions
│   ├── zipProcessor.js       # ZIP processing and security
│   └── formatters/          # Export formatters
│       ├── BaseFormatter.js  # Base formatter class
│       ├── HTMLFormatter.js  # HTML export formatter
│       ├── MDFormatter.js    # Markdown export formatter
│       └── TXTFormatter.js   # Plain text export formatter
├── tests/                  # Comprehensive test suite
│   ├── full-suite-test.js   # Full test suite
│   ├── help-test.js         # Help functionality tests
│   ├── test-progress.js     # Progress manager tests
│   ├── test-spinner.js      # Spinner functionality tests
│   ├── test-utils.js        # Utility tests
│   ├── progress-demo.js     # Progress demonstration
│   ├── full_suite.test.zsh  # Shell test suite
│   └── help.test.zsh        # Shell help tests
├── AGENTS.md               # Development guidelines (this file)
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # This file
```

### Code Quality

- **ESLint**: Configured for consistent code style with modern JavaScript support
- **Prettier**: Automatic code formatting for consistent style
- **CommonJS**: Module system for maximum compatibility
- **JSDoc**: Comprehensive documentation for all functions
- **Interactive Design**: All commands use @inquirer/prompts for better UX

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

## 🔄 Recent Improvements (v0.0.4)

### Enhanced Interactive CLI Experience

- **@inquirer/prompts**: Modern interactive prompts throughout all commands
- **Smart Argument Handling**: All commands work with or without arguments
- **Better Error Messages**: Clear, actionable error messages with context
- **Progress Tracking**: Consistent progress bars and spinners for long operations

### Security and Validation Improvements

- **Enhanced Path Validation**: Comprehensive protection against path traversal attacks
- **ZIP Bomb Protection**: Robust validation against malicious ZIP files
- **Input Validation**: Schema-based validation for all user inputs
- **Safety Features**: Text verification required for destructive operations

### Export System Enhancements

- **Modular Formatters**: Clean separation of export formats (HTML, MD, TXT)
- **Media Handling**: Flexible media inclusion options (embedded, linked, or excluded)
- **Self-contained HTML**: Complete HTML exports with embedded assets
- **Verbose Output**: Detailed progress reporting during export operations

### Testing and Quality Assurance

- **Comprehensive Test Suite**: Full test coverage for core functionality
- **Shell Script Tests**: Integration tests using real CLI commands
- **Progress System Tests**: Dedicated tests for progress tracking
- **Validation Tests**: Input validation and error handling tests

### Code Quality Improvements

- **Centralized Error Handling**: Consistent error patterns across all modules
- **Enhanced Documentation**: Comprehensive JSDoc and inline documentation
- **Code Formatting**: Prettier + ESLint for consistent code style
- **Modular Architecture**: Clear separation of concerns with focused utilities

### Performance Optimizations

- **Efficient File Operations**: Optimized file handling and processing
- **Better Resource Management**: Proper cleanup of temporary files
- **Streamlined Processing**: Reduced redundant operations and improved data flow

## 📦 Dependencies

### Core Dependencies

- **@inquirer/prompts**: Interactive command-line prompts for better user experience
- **chalk**: Terminal string styling for colorful output
- **cli-progress**: Flexible progress bars for command-line applications
- **commander**: Complete solution for Node.js command-line interfaces
- **decompress**: Decompress ZIP files with security validation
- **marked**: Markdown parser for HTML exports
- **ora**: Elegant terminal spinners for progress indication
- **sanitize-html**: HTML sanitizer for secure content processing
- **uuid**: Generate RFC-compliant UUIDs for unique identifiers

### Development Dependencies

- **eslint**: JavaScript linting for code quality with modern support
- **eslint-config-prettier**: ESLint configuration for Prettier compatibility
- **nodemon**: CLI auto-restart utility (for development convenience)
- **prettier**: Opinionated code formatter for consistent style

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:help        # Test CLI help functionality
npm run test:validate    # Test validation utilities

# Manual testing
ddd --help               # Test main CLI
ddd dump --help          # Test command help
ddd hoard                # Test dumpster listing
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Follow the development guidelines in [AGENTS.md](AGENTS.md)
2. Maintain consistent code style (ESLint + Prettier)
3. Add comprehensive JSDoc for new functions
4. Test all changes thoroughly with the test suite
5. Keep security best practices in mind
6. Ensure interactive prompts work correctly for new commands

## 🔍 Future Enhancements

Planned improvements include:

- **Additional CLI Commands**: `inspect` for detailed analysis, `stats` for statistics, `search` for full-text search
- **Enhanced Search Functionality**: Full-text search across all dumpsters
- **Service Layer**: Better abstraction for business logic
- **User Configuration**: Configurable settings and preferences
- **Additional Export Formats**: PDF, JSON, CSV export options
- **Enhanced Burn Command**: Batch deletion and recycling bin functionality
- **Performance Improvements**: Optimized processing for large chat histories
- **Integration Features**: Import from other chat export formats

## 📞 Support

For issues, questions, or contributions, please refer to the project repository or development guidelines in `AGENTS.md`.

**Version**: 0.0.4 | **Last Updated**: 2024-12-29
