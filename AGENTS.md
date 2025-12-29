# Development Guidelines

## Project Architecture

### CLI Tool for ChatGPT Data Processing

This is a focused CLI tool for processing ChatGPT conversation data with an interactive, user-friendly interface:

```text
┌─────────────┐    ZIP    ┌──────────────┐      ┌─────────────┐
│  CLI User   │ ◄───────► │  Processing  │ ◄──► │  Dumpsters  │
│  Interface  │           │  Engine      │      │   Storage   │
└─────────────┘           └──────────────┘      └─────────────┘
       │                           │
       ▼                           ▼
┌─────────────┐           ┌──────────────┐
│ Interactive │           │  Export      │
│   Prompts   │           │  Formats     │
└─────────────┘           └──────────────┘
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

```bash
# Development
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Testing
npm test                 # Run full test suite
npm run test:help        # Test CLI help functionality
npm run test:validate    # Test validation utilities

# CLI Commands (using ddd binary)
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
3. Test CLI functionality manually

## File Structure

```text
data-dumpster-diver/
├── cli.js                  # Main CLI entry point
├── package.json            # Dependencies and scripts
├── eslint.config.js        # ESLint configuration
├── .prettierrc.json        # Prettier configuration
├── .prettierignore         # Prettier ignore rules
├── config/
│   └── constants.js          # Configuration constants
├── utils/
│   ├── AssetExtractor.js     # Asset extraction and organization
│   ├── ChatDumper.js         # Chat data processing and dumping
│   ├── ChatUpcycler.js       # Chat message processing & export
│   ├── CliPrompts.js         # Interactive command-line prompts
│   ├── CommonUtils.js        # Common utility functions
│   ├── DumpsterManager.js    # Core dumpster management
│   ├── DumpsterProcessor.js  # Main processing orchestration
│   ├── ErrorHandler.js       # Centralized error handling
│   ├── FileUtils.js          # File operations and validation
│   ├── ProgressManager.js    # Progress tracking and user feedback
│   ├── SchemaValidator.js    # Input validation and data integrity
│   ├── UpcycleManager.js     # Export format management
│   ├── assetUtils.js         # Asset handling utilities
│   ├── upcycleHelpers.js     # Export helper functions
│   ├── zipProcessor.js       # ZIP processing and security
│   └── formatters/          # Export formatters
│       ├── BaseFormatter.js  # Base formatter class
│       ├── HTMLFormatter.js  # HTML export formatter
│       ├── MDFormatter.js    # Markdown export formatter
│       └── TXTFormatter.js   # Plain text export formatter
├── tests/                  # Test files
│   ├── full-suite-test.js   # Full test suite
│   ├── help-test.js         # Help functionality tests
│   ├── test-progress.js     # Progress manager tests
│   ├── test-spinner.js      # Spinner functionality tests
│   ├── test-utils.js        # Utility tests
│   ├── progress-demo.js     # Progress demonstration
│   ├── full_suite.test.zsh  # Shell test suite
│   └── help.test.zsh        # Shell help tests
├── AGENTS.md               # Development guidelines
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # README
```

## CLI Commands Overview

All commands use interactive prompts when arguments are omitted, making the CLI user-friendly:

### `dump [file]`

- **Purpose**: Process ChatGPT export ZIP files
- **Options**: `-n/--name <name>`, `-v/--verbose`
- **Interactive**: Prompts for file path and dumpster name if not provided

### `hoard`

- **Purpose**: List all processed dumpsters
- **Options**: `-v/--verbose` for detailed information

### `rummage [dumpster-name]`

- **Purpose**: Explore chats within a dumpster
- **Options**: `-l/--limit <number>` for chat count
- **Interactive**: Prompts for dumpster selection and limit

### `burn [dumpster-name]`

- **Purpose**: Safely delete dumpsters
- **Options**: `-f/--force`, `--dry-run`
- **Safety**: Requires confirmation and text verification unless forced

### `upcycle [format] [dumpster-name]`

- **Purpose**: Export dumpsters to various formats
- **Options**: `-o/--output <path>`, `--include-media`, `--self-contained`, `-v/--verbose`
- **Interactive**: Prompts for format selection and dumpster choice

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:help        # Test CLI help functionality
npm run test:validate    # Test validation utilities

# Manual testing commands
ddd --help                # Test CLI help
ddd dump --help           # Test dump command help
ddd hoard                 # Test dumpster listing
ddd upcycle --help        # Test export functionality

# Test with real data (when available)
ddd dump path/to/chatgpt-export.zip --name "test"
ddd rummage test
ddd upcycle txt test --output ./tests/upcycle-bin
```

## Dependency Management

- Keep dependencies minimal and focused
- Only add packages that solve specific problems
- Prefer built-in Node.js modules when possible
- Use npm audit regularly for security
- Core dependencies include @inquirer/prompts for interactive UX
