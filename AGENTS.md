# Development Guidelines

## Project Architecture

### Simple CLI Tool

This is a focused CLI tool for processing ChatGPT conversation data:

```text
┌─────────────┐    ZIP    ┌──────────────┐
│  CLI User   │ ◄───────► │  Processing  │
│  Interface  │           │  Engine      │
└─────────────┘           └──────────────┘
```

## Core Components

- **cli.js**: Command-line interface with Commander.js
- **utils/DumpsterManager.js**: Core dumpster lifecycle management
- **utils/FileSystemHelper.js**: File operations and validation
- **utils/ChatUpcycler.js**: Chat message processing and export functionality
- **utils/UpcycleManager.js**: Export format management and coordination
- **data/**: Processing scripts for dumping and extraction

## Development Commands

```bash
# Development
npm run dev           # Start CLI with nodemon
npm run lint          # Run ESLint
npm run format        # Format code with Prettier

# Core functionality
npm run dump           # Dump old conversation format
npm run extract-assets # Extract assets using data/extract-assets.js

# CLI Commands
node cli.js dump       # Process ChatGPT export ZIP
node cli.js hoard      # List all dumpsters
node cli.js rummage    # Explore chats in a dumpster
node cli.js burn       # Delete a dumpster
node cli.js upcycle    # Export dumpsters to various formats
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
├── data/
│   ├── dumpster-processor.js # Main processing orchestration
│   ├── chat-dumper.js        # Chat data processing
│   └── extract-assets.js     # Asset extraction from HTML
├── utils/
│   ├── ChatUpcycler.js       # Chat message processing & export
│   ├── CommonUtils.js        # Common utility functions
│   ├── DumpsterManager.js    # Core dumpster management
│   ├── ErrorHandler.js       # Centralized error handling
│   ├── FileSystemHelper.js   # File system operations
│   ├── ProgressManager.js    # Progress tracking system
│   ├── SchemaValidator.js    # Data validation schemas
│   ├── UpcycleManager.js     # Export format management
│   ├── AssetUtils.js         # Asset handling utilities
│   ├── PathUtils.js          # Path operations & searching
│   ├── upcycleHelpers.js     # Export helper functions
│   ├── Validators.js         # Input validation
│   ├── ZipProcessor.js       # ZIP processing & security
│   └── formatters/          # Export formatters
│       ├── BaseFormatter.js  # Base formatter class
│       ├── HTMLFormatter.js  # HTML export formatter
│       ├── MDFormatter.js    # Markdown export formatter
│       └── TXTFormatter.js   # Plain text export formatter
├── AGENTS.md               # This file
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # README
```

## Testing

Currently no test suite. For hobby project, manual testing is acceptable:

```bash
# Test basic functionality
node cli.js --help
node cli.js dump --help
node cli.js hoard
node cli.js upcycle --help

# Test with real data (when available)
node cli.js dump path/to/chatgpt-export.zip --name "test"
node cli.js rummage test
node cli.js upcycle txt test --output ./test-exports
```

## Dependency Management

- Keep dependencies minimal and focused
- Only add packages that solve specific problems
- Prefer built-in Node.js modules when possible
- Use npm audit regularly for security
