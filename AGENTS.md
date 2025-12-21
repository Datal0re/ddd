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
- **utils/fsHelpers.js**: File operations and validation
- **utils/conversation-messages.js**: Chat message processing and asset handling
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
├── cli.js              # Main CLI entry point
├── utils/              # Core utilities
│   ├── DumpsterManager.js # Dumpster management
│   ├── fsHelpers.js     # File operations
│   └── conversation-messages.js # Chat message processing
├── data/               # Data processing
│   ├── dump.js         # Data dump
│   ├── extract-assets.js # Asset extraction
│   └── process-export.js # Dumpster processing
├── package.json        # Dependencies and scripts
├── README.md           # User documentation
└── LICENSE             # MIT License
```

## Testing

Currently no test suite. For hobby project, manual testing is acceptable:

```bash
# Test basic functionality
node cli.js --help
node cli.js inventory
node cli.js dump --help

# Test with real data (when available)
node cli.js dump path/to/chatgpt-export.zip --name "test"
node cli.js rummage test
```

## Dependency Management

- Keep dependencies minimal and focused
- Only add packages that solve specific problems
- Prefer built-in Node.js modules when possible
- Use npm audit regularly for security
