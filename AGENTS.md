# Development Guidelines

## Project Architecture

### CLI Tool for ChatGPT Data Processing

This is a focused CLI tool for processing ChatGPT conversation data with an interactive, user-friendly interface:

```text
┌─────────────┐    ZIP    ┌──────────────┐      ┌─────────────┐
│  CLI User   │ ◄───────► │  Processing  │ ◄──► │  Dumpsters  │
│  Interface  │           │  Engine      │      │   Storage   │
└─────────────┘           └──────────────┘      └─────────────┘
       │                          │
       ▼                          ▼
┌─────────────┐           ┌──────────────┐
│ Interactive │           │  Export      │
│   Prompts   │           │  Formats     │
└─────────────┘           └──────────────┘
```

### Detailed Architecture

The codebase follows a clean, modular architecture with clear separation of concerns:

```text
CLI Layer (cli.js)
├── Commands: dump, hoard, rummage, burn, upcycle
├── Interactive Prompts (@inquirer/prompts)
├── Progress Display (ProgressManager.js)
└── Error Handling & Validation (ErrorHandler.js, SchemaValidator.js)

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

## Core Components

- **cli.js**: Command-line interface with Commander.js and @inquirer/prompts
- **utils/DumpsterManager.js**: Core dumpster lifecycle management
- **utils/DumpsterProcessor.js**: Main processing orchestration for ZIP files
- **utils/AssetExtractor.js**: Asset extraction and organization
- **utils/FileUtils.js**: File operations and validation
- **utils/ChatUpcycler.js**: Chat message processing and export functionality
- **utils/UpcycleManager.js**: Export format management and coordination
- **utils/ProgressManager.js**: Progress tracking and user feedback
- **utils/ErrorHandler.js**: Centralized error handling and logging
- **utils/SchemaValidator.js**: Input validation and data integrity
- **utils/CliPrompts.js**: Interactive command-line prompts
- **utils/formatters/**: Export format implementations (HTML, MD, TXT)

## Development Commands

### Development Workflow

```bash
# Development
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Testing (Shell-based CLI testing)
npm test                 # Run main test suite
npm run test:basic       # Basic functionality tests
npm run test:workflows   # End-to-end workflow tests
npm run test:with-logs   # Tests with detailed logging
npm run test:setup       # Generate synthetic test data
npm run test:cleanup     # Clean up test artifacts
```

### CLI Commands (using ddd binary)

```bash
ddd dump                 # Process ChatGPT export ZIP (interactive)
ddd hoard                # List all dumpsters
ddd rummage              # Explore chats in a dumpster (interactive)
ddd burn                 # Delete a dumpster (interactive with safety)
ddd upcycle              # Export dumpsters to various formats (interactive)
```

## Code Style

- **CommonJS modules** (project uses "type": "commonjs")
- **ES6+ features** (async/await, destructuring, arrow functions)
- **Consistent naming**: camelCase for functions, PascalCase for classes
- **Error handling**: Try-catch with meaningful error messages
- **JSDoc**: Comprehensive documentation for all functions
- **Interactive Design**: All commands use @inquirer/prompts for better UX

## Adding New Commands

1. Add command to `cli.js` using Commander.js:

   ```javascript
   program
     .command('mycommand')
     .description('Description of command')
     .argument('[arg]', 'Optional argument')
     .option('-v, --verbose', 'Verbose output')
     .action(async (arg, options) => {
       // Command implementation
     });
   ```

2. Add corresponding method to `utils/DumpsterManager.js` if needed
3. Add tests for the new command in the `tests/` directory
4. Update documentation (README.md and this file)
5. Test CLI functionality manually

## File Structure

```text
data-dumpster-diver/
├── cli.js                    # Main CLI entry point (binary: ddd)
├── package.json              # Dependencies and scripts (v0.0.5)
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
├── tests/                  # Shell-based test suite
│   ├── README.md            # Test documentation
│   ├── generate-test-data.js # Synthetic test data generator
│   ├── minimal-test.sh      # Basic functionality tests
│   ├── minimal-workflow-test.sh # End-to-end workflow tests
│   ├── simple-test.sh       # Quick validation tests
│   └── test-basic-synthetic/ # Synthetic test data
│       ├── conversations.json
│       ├── user.json
│       ├── message_feedback.json
│       └── chat.html
├── AGENTS.md               # Development guidelines (this file)
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # User-facing documentation
```

## CLI Commands Overview (Developer Reference)

All commands use interactive prompts when arguments are omitted, making the CLI user-friendly:

### `dump [file]`

- **Purpose**: Process ChatGPT export ZIP files
- **Options**: `-n/--name <name>`, `-v/--verbose`
- **Interactive**: Prompts for file path and dumpster name if not provided
- **Backend**: Uses `DumpsterProcessor.js` for main processing

### `hoard`

- **Purpose**: List all processed dumpsters
- **Options**: `-v/--verbose` for detailed information
- **Backend**: Uses `DumpsterManager.js.listDumpsters()`

### `rummage`

- **Purpose**: Search and select chats from dumpsters for export
- **Options**: `-v/--verbose` for verbose output
- **Interactive Workflow**:
  1. Select dumpster to search
  2. Enter search query (optional - shows all if empty)
  3. Configure search options (scope, case sensitivity)
  4. View search results with multi-select checkboxes
  5. Action menu for selected chats (add to selection bin, upcycle, new search, etc.)
- **Backend**: Uses `SearchManager.js`, `SelectionManager.js`, and enhanced `DumpsterManager.js.searchChats()`

### `burn [dumpster-name]`

- **Purpose**: Safely delete dumpsters
- **Options**: `-f/--force`, `--dry-run`
- **Safety**: Requires confirmation and text verification unless forced
- **Backend**: Uses `DumpsterManager.js.deleteDumpster()`

### `upcycle [format] [dumpster-name]`

- **Purpose**: Export dumpsters or selection bin to various formats
- **Options**: `-o/--output <path>`, `--include-media`, `--self-contained`, `-v/--verbose`
- **Interactive**: Prompts for format selection and export source (entire dumpster vs selection bin)
- **Backend**: Uses `UpcycleManager.js`, `SelectionManager.js`, and formatter system
- **New in v0.0.5**: Selection bin support - can export selected chats from `rummage` command
- **Note**: Fixed in v0.0.5 - `--output` parameter now properly maps to output directory

## Export Formatters

The project uses a modular formatter system with a base class and format-specific implementations:

### BaseFormatter

Abstract base class that defines the interface for all formatters:

- `formatChat(processedChat, options)` - Format individual chat
- `combineChats(results)` - Combine multiple chats for single-file export
- `getFileExtension()` - Get file extension for the format
- `getMimeType()` - Get MIME type for the format

### HTMLFormatter

- **Features**: Full HTML export with CSS styling
- **Media Support**: Embedded or linked assets
- **Self-contained**: Option to include all assets inline
- **Rich Content**: Preserves formatting, links, and structure

### MDFormatter

- **Format**: Clean Markdown with proper headers
- **Code Blocks**: Preserves code formatting with syntax highlighting hints
- **Links**: Maintains clickable links and references
- **Compatibility**: Works with all Markdown viewers

### TXTFormatter

- **Simplicity**: Plain text with minimal formatting
- **Readability**: Clean, accessible format
- **Compatibility**: Works with any text editor
- **Size**: Most compact export option

## Configuration

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

## Testing

The project includes comprehensive test coverage using shell-based CLI testing:

### Automated Testing

```bash
# Run main test suite
npm test

# Run specific test suites
npm run test:basic        # Basic functionality tests
npm run test:workflows    # End-to-end workflow tests
npm run test:with-logs    # Tests with detailed logging
npm run test:setup        # Generate synthetic test data and ZIP file
npm run test:cleanup      # Clean up test artifacts
```

### Manual Testing

```bash
ddd --help                # Test CLI help
ddd dump --help           # Test command help
ddd hoard                 # Test dumpster listing
ddd upcycle --help        # Test export functionality

# Test with real data (when available)
ddd dump path/to/chatgpt-export.zip --name "test"
ddd rummage test
ddd upcycle txt test --output ./tests/upcycle-bin
```

### Test Structure

- **Shell Script Tests**: Real CLI command testing with actual scenarios
- **Synthetic Test Data**: Consistent, reproducible ChatGPT export structure in `test-basic-synthetic/`
- **Workflow Testing**: End-to-end validation of complete user workflows
- **Quick Validation**: Fast tests for basic functionality verification
- **Test Data Management**: Automated setup and cleanup of test artifacts

## Dependency Management

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

### Dependency Guidelines

- Keep dependencies minimal and focused
- Only add packages that solve specific problems
- Prefer built-in Node.js modules when possible
- Use `npm audit` regularly for security
- Core dependencies include @inquirer/prompts for interactive UX

## Code Quality

- **ESLint**: Configured for consistent code style with modern JavaScript support
- **Prettier**: Automatic code formatting for consistent style
- **CommonJS**: Module system for maximum compatibility
- **JSDoc**: Comprehensive documentation for all functions
- **Interactive Design**: All commands use @inquirer/prompts for better UX

## Future Enhancements

**Completed in v0.0.5**:

- ✅ **Enhanced Rummage Command**: Complete redesign with search, selection, and integration
- ✅ **Search Functionality**: Full-text search within chat titles and content with relevance scoring
- ✅ **Selection Bin System**: Persistent chat selection for export via `upcycle` command
- ✅ **Interactive Multi-Select**: Checkbox interface for selecting multiple chats
- ✅ **Selection-Based Upcycling**: Export selected chats instead of entire dumpsters

Planned improvements include:

- **Additional CLI Commands**: `inspect` for detailed analysis, `stats` for statistics
- **Enhanced Search**: Full-text search across all dumpsters simultaneously
- **Service Layer**: Better abstraction for business logic
- **User Configuration**: Configurable settings and preferences
- **Additional Export Formats**: PDF, JSON, CSV export options
- **Enhanced Burn Command**: Batch deletion and recycling bin functionality
- **Performance Improvements**: Optimized processing for large chat histories
- **Integration Features**: Import from other chat export formats

## Security Considerations

- **Path Traversal Protection**: Comprehensive validation against directory traversal attacks
- **ZIP Bomb Protection**: Robust validation against malicious ZIP files
- **Input Validation**: Schema-based validation for all user inputs
- **Safety Features**: Text verification required for destructive operations
