# Development Guidelines

## 🏗️ Architecture Overview

### Wizard-Based CLI Tool for ChatGPT Data Processing

This is a modern CLI tool with wizard-guided workflows and a clean service layer architecture:

```text
┌─────────────┐    ZIP    ┌──────────────┐      ┌─────────────┐
│  CLI User   │ ◄───────► │  Processing  │ ◄──► │  Dumpsters  │
│  Interface  │           │  Engine      │      │   Storage   │
└─────────────┘           └──────────────┘      └─────────────┘
        │                          │
        ▼                          ▼
┌─────────────┐           ┌──────────────┐
│   Wizard    │           │   Unified    │
│  Workflows  │           │  OutputMgr   │
└─────────────┘           └──────────────┘
```

### Modern Architecture Layers

The codebase follows a clean, modular architecture with clear separation of concerns:

```text
CLI Layer (cli.js)
├── Commands: dump, hoard, rummage, burn, upcycle
├── Wizard Utils (@inquirer/prompts + WizardUtils.js)
├── Progress Display (ProgressManager.js)
└── Error Handling & Validation (ErrorHandler.js, SchemaValidator.js)

🏗️ Service Layer (utils/services/)
├── BaseCommandService.js - Common service foundation
├── DumpService.js - Business logic for dump operations
├── HoardService.js - Business logic for hoard operations
├── RummageService.js - Business logic for rummage operations
├── BurnService.js - Business logic for burn operations
├── UpcycleService.js - Business logic for upcycle operations
├── BinService.js - Business logic for selection bin operations
└── CommandInitService.js - Service initialization and dependency injection

Business Logic Layer (utils/)
├── DumpsterManager.js - Core dumpster lifecycle management
├── DumpsterProcessor.js - Main processing orchestration
├── BinManager.js - Selection bin lifecycle and operations
├── SearchManager.js - Advanced search functionality
├── StatisticsUtils.js - Centralized statistics calculations
├── AssetExtractor.js - Asset extraction and organization
├── OutputManager.js - Unified console output management
└── FileUtils.js - File operations and validation

Export Layer
├── UpcycleManager.js - Export format management and coordination
├── ChatUpcycler.js - Chat message processing for export
└── Formatter System (utils/formatters/)
    ├── BaseFormatter.js - Abstract base class
    ├── HTMLFormatter.js - HTML export with media support
    ├── MDFormatter.js - Markdown export formatting
    └── TXTFormatter.js - Plain text export

Wizard & UX Layer (utils/)
├── WizardUtils.js - Progressive disclosure workflow engine
├── CliPrompts.js - Interactive command-line prompts
└── ProgressManager.js - Progress tracking and user feedback

Configuration Layer
└── config/constants.js - Configuration constants and limits
```

## 🎯 Core Components

### Service Layer Architecture

- **BaseCommandService**: Foundation class providing common patterns for all services
- **DumpService**: Business logic for ChatGPT export processing
- **HoardService**: Business logic for dumpster listing and management
- **RummageService**: Business logic for search, selection, and wizard workflows
- **BurnService**: Business logic for safe dumpster deletion with confirmations
- **UpcycleService**: Business logic for export format handling and options
- **BinService**: Business logic for persistent selection bin management
- **CommandInitService**: Service initialization with dependency injection

### Wizard System

- **WizardUtils.js**: Progressive disclosure workflow engine
- **Step Indicators**: `[1/9] Step Name` progress tracking
- **Conditional Logic**: Smart step skipping based on user choices
- **State Management**: Maintains context across wizard steps
- **Declarative Configuration**: Simple step arrays instead of complex nested logic

### Unified Output Management

- **OutputManager.js**: Centralized console formatting and messaging
- **Consistent Formatting**: Standardized emoji usage and color schemes
- **Context-Aware Messages**: All messages include operational context
- **Error Recovery**: Actionable suggestions with every error
- **Specialized Loggers**: Context-specific loggers for different operations

### Enhanced Validation System

- **SchemaValidator.js**: Comprehensive input validation with safe patterns
- **Safe Validation Methods**: Non-throwing alternatives for all validation functions
- **Prompt Detection**: Smart detection of user input requirements vs. validation errors
- **Type Safety**: Comprehensive parameter validation across all inputs

## 🚀 Development Commands

### Development Workflow

```bash
# Code Quality
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
ddd dump                 # Process ChatGPT export ZIP (wizard-guided)
ddd hoard                # List all dumpsters with unified formatting
ddd rummage              # Advanced wizard-guided search and selection
ddd burn                 # Delete dumpster safely (wizard-guided confirmation)
ddd upcycle              # Export with wizard-guided format selection
```

## 🎨 Code Style & Patterns

### Modern JavaScript Standards

- **CommonJS modules** (project uses "type": "commonjs")
- **ES6+ features** (async/await, destructuring, arrow functions)
- **Consistent naming**: camelCase for functions, PascalCase for classes
- **Error handling**: Try-catch with meaningful error messages and recovery suggestions
- **JSDoc**: Comprehensive documentation for all functions
- **Wizard Design**: All complex workflows use progressive disclosure

### Service Layer Patterns

- **Inheritance**: All services extend BaseCommandService
- **Dependency Injection**: Services receive managers through CommandInitService
- **Result Objects**: Standardized `{ success, data, message, error, timestamp }` returns
- **Error Handling**: Consistent error patterns with OutputManager integration
- **Logging**: Specialized loggers via `OutputManager.createLogger(context)`

### OutputManager Usage

```javascript
// Create specialized logger for consistent context
this.output = OutputManager.createLogger('operation context');

// Standard message types
this.output.success(message, suggestion);
this.output.error(message, suggestion);
this.output.warning(message);
this.output.info(message);
this.output.progress(message);

// Specialized formatting
this.output.action('burn', 'Starting operation...');
this.output.report(data, 'Statistics');
this.output.list(items, 'Available Items');
this.output.step('Processing...', 1, 3);
```

## 🔧 Adding New Commands

### 1. Create Service Class

Create service class in `utils/services/` extending BaseCommandService:

```javascript
class MyCommandService extends BaseCommandService {
  constructor(baseDir) {
    super(baseDir);
    this.output = OutputManager.createLogger('mycommand operation');
  }

  async executeMyCommand(param, options, managers) {
    try {
      // Business logic implementation
      return this.createResult(true, data, 'Success message');
    } catch (error) {
      const errorMessage = `Failed to execute: ${error.message}`;
      this.output.error(errorMessage, 'recovery suggestion');
      return this.createResult(false, null, errorMessage, error);
    }
  }
}
```

### 2. Add Command to CLI

Add command to `cli.js` using Commander.js:

```javascript
const { MyCommandService } = require('./utils/services/MyCommandService');

program
  .command('mycommand')
  .description('Description of command')
  .argument('[arg]', 'Optional argument')
  .option('-v, --verbose', 'Verbose output')
  .action(async (arg, options, command) => {
    const initService = new CommandInitService();
    const managers = await initService.initializeManagers(options.verbose);
    const service = new MyCommandService(process.cwd());

    await service.executeMyCommand(arg, options, managers);
  });
```

### 3. Add Wizard Steps (for complex workflows)

```javascript
const steps = [
  {
    name: 'selectItem',
    type: 'select',
    message: 'Select an item:',
    choices: async ctx => generateChoices(ctx),
    when: ctx => ctx.needsSelection,
  },
  {
    name: 'confirmAction',
    type: 'confirm',
    message: ctx => `Confirm action on ${ctx.selectedItem}?`,
    default: false,
  },
];

const result = await WizardUtils.executeWizard(steps, initialContext);
```

### 4. Add Tests

Add tests for new command in `tests/` directory using shell scripts for realistic CLI testing.

### 5. Update Documentation

Update README.md and this AGENTS.md file with new command information.

## 📂 File Structure

```text
data-dumpster-diver/
├── cli.js                    # Main CLI entry point (binary: ddd)
├── package.json              # Dependencies and scripts
├── eslint.config.js         # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── .prettierignore          # Prettier ignore rules
├── config/
│   └── constants.js          # Configuration constants and limits
├── utils/
│   ├── services/            # Service Layer
│   │   ├── BaseCommandService.js  # Foundation for all services
│   │   ├── BinService.js          # Selection bin operations
│   │   ├── BurnService.js         # Dumpster deletion logic
│   │   ├── CommandInitService.js  # Service initialization
│   │   ├── DumpService.js         # Export processing logic
│   │   ├── HoardService.js        # Dumpster listing logic
│   │   ├── RummageService.js      # Search/selection logic
│   │   └── UpcycleService.js      # Export format logic
│   ├── WizardUtils.js       # Wizard workflow engine (NEW)
│   ├── OutputManager.js     # Unified output system (NEW)
│   ├── BinManager.js        # Selection bin management (NEW)
│   ├── SearchManager.js     # Advanced search functionality (NEW)
│   ├── StatisticsUtils.js   # Centralized statistics (NEW)
│   ├── SchemaValidator.js   # Enhanced validation system
│   ├── ErrorHandler.js      # Centralized error handling
│   ├── CliPrompts.js        # Interactive prompts
│   ├── CommonUtils.js       # Shared utility functions
│   ├── AssetExtractor.js    # Asset extraction and organization
│   ├── ChatDumper.js        # Chat data processing
│   ├── ChatUpcycler.js      # Chat message processing & export
│   ├── DumpsterManager.js   # Core dumpster management
│   ├── DumpsterProcessor.js # Main processing orchestration
│   ├── FileUtils.js         # File operations and validation
│   ├── ProgressManager.js   # Progress tracking
│   ├── UpcycleManager.js    # Export format coordination
│   ├── assetUtils.js        # Asset handling utilities
│   ├── upcycleHelpers.js    # Export helper functions
│   ├── zipProcessor.js      # ZIP processing and security
│   └── formatters/          # Export formatters
│       ├── BaseFormatter.js  # Abstract base class
│       ├── HTMLFormatter.js  # HTML export formatter
│       ├── MDFormatter.js    # Markdown export formatter
│       └── TXTFormatter.js   # Plain text export formatter
├── tests/                  # Test suite
│   ├── minimal-test.sh      # Basic functionality tests
│   ├── minimal-workflow-test.sh # End-to-end workflow tests
│   ├── rummage-integration-test.sh # Wizard workflow tests
│   ├── test-empty-bin.sh   # Selection bin tests
│   ├── test-output-consistency.sh # Output formatting tests
│   ├── simple-test.sh       # Quick validation tests
│   └── generate-test-data.js # Synthetic test data generator
├── AGENTS.md               # Development guidelines (this file)
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # User-facing documentation
```

## 🎯 CLI Commands Overview (Developer Reference)

All commands use wizard-guided workflows when arguments are omitted, providing step-by-step guidance:

### `dump [file]`

- **Purpose**: Process ChatGPT export ZIP files with wizard guidance
- **Options**: `-n/--name <name>`, `-v/--verbose`
- **Wizard Flow**: File selection → name confirmation → processing options
- **Backend**: Uses `DumpService.js` for business logic

### `hoard`

- **Purpose**: List all processed dumpsters with rich formatting
- **Options**: `-v/--verbose` for detailed information
- **Backend**: Uses `HoardService.js` for business logic

### `rummage [dumpster-name]`

- **Purpose**: Advanced wizard-guided search, selection, and management
- **Options**: `-v/--verbose` for verbose output
- **Wizard Flow**: 8-step progressive disclosure workflow
- **Backend**: Uses `RummageService.js`, `WizardUtils.js`, `SearchManager.js`, `BinManager.js`
- **Features**: Relevance scoring, persistent selection bins, multi-select interface

### `burn [dumpster-name]`

- **Purpose**: Safely delete dumpsters with multi-step confirmation
- **Options**: `-f/--force` (skip confirmation), `--dry-run` (preview)
- **Wizard Flow**: Dumpster selection → statistics review → confirmation → text verification
- **Backend**: Uses `BurnService.js` for business logic

### `upcycle [format] [dumpster-name]`

- **Purpose**: Export dumpsters or selection bin with wizard guidance
- **Options**: `-o/--output <path>`, `--include-media`, `--self-contained`, `-v/--verbose`
- **Wizard Flow**: Format selection → export source → options → export execution
- **Backend**: Uses `UpcycleService.js`, `BinManager.js`, and formatter system
- **Features**: Selection bin export, format preview, rich media handling

### `bin [subcommand] [name]`

- **Purpose**: Manage persistent selection bins for chat organization
- **Subcommands**: `create`, `list`, `rename`, `empty`, `burn` (delete)
- **Wizard Flow**: Conditional prompting based on subcommand
- **Backend**: Uses `BinService.js` for business logic
- **Features**: Persistent chat selections, bin management, integration with rummage

## 📋 Export Formatters (Enhanced)

The project uses a modular formatter system with a base class and format-specific implementations:

### BaseFormatter

Abstract base class that defines the interface for all formatters:

- `formatChat(processedChat, options)` - Format individual chat
- `combineChats(results)` - Combine multiple chats for single-file export
- `getFileExtension()` - Get file extension for the format
- `getMimeType()` - Get MIME type for the format

### Enhanced Formatters

- **HTMLFormatter**: Full HTML export with CSS styling, media support, self-contained option
- **MDFormatter**: Clean Markdown with proper headers, code blocks with syntax hints
- **TXTFormatter**: Plain text with minimal formatting for maximum compatibility

## ⚙️ Configuration

Configuration is handled through `config/constants.js`:

```javascript
{
  VERSION: '0.1.0',  // Centralized version management
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

## 🧪 Testing

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

### Test Structure

- **Shell Script Tests**: Real CLI command testing with actual scenarios
- **Wizard Workflow Tests**: Tests for multi-step wizard flows
- **Service Layer Tests**: Tests for business logic separation
- **Output Consistency Tests**: Tests for unified console formatting
- **Selection Bin Tests**: Tests for persistent selection functionality
- **Synthetic Test Data**: Consistent, reproducible ChatGPT export structure
- **Workflow Testing**: End-to-end validation of complete user workflows

## 📦 Dependency Management

### Core Dependencies

- **@inquirer/prompts**: Interactive command-line prompts for wizard workflows
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

## 🎨 Code Quality Standards

- **ESLint**: Configured for consistent code style with modern JavaScript support
- **Prettier**: Automatic code formatting for consistent style
- **CommonJS**: Module system for maximum compatibility
- **JSDoc**: Comprehensive documentation for all functions
- **Wizard Design**: All complex workflows use progressive disclosure
- **Service Layer**: Business logic separated from CLI concerns
- **OutputManager**: Unified console formatting across all operations

## 🚀 Future Development Guidelines

### Pattern Consistency

- **Service Layer**: Always extend BaseCommandService and return standardized result objects
- **OutputManager**: Use OutputManager.createLogger() for consistent formatting
- **Wizard Workflows**: Use WizardUtils.executeWizard() for complex multi-step flows
- **Validation**: Use SchemaValidator.safeValidate\* methods for input validation
- **Error Handling**: Provide actionable suggestions with every error message

### Adding New Features

1. **Create Service**: Business logic in appropriate service class
2. **Add Wizard Steps**: For complex workflows, add to WizardUtils.executeWizard()
3. **Use OutputManager**: Consistent messaging and formatting
4. **Add Tests**: Shell-based tests for realistic CLI validation
5. **Update Documentation**: README.md and AGENTS.md

## 🛡️ Security Considerations

- **Path Traversal Protection**: Comprehensive validation against directory traversal attacks
- **ZIP Bomb Protection**: Robust validation against malicious ZIP files
- **Input Validation**: Schema-based validation for all user inputs
- **Safety Features**: Text verification required for destructive operations
- **Output Sanitization**: Proper handling of user input in console output

## Architecture Benefits

### User Experience

- **Progressive Disclosure**: Users see only relevant options at each step
- **Wizard Guidance**: Step-by-step workflows eliminate confusion
- **Consistent Interface**: Unified visual language and behavior
- **Error Recovery**: Actionable suggestions for every failure

### Developer Experience

- **Service Layer**: Clean separation of concerns and business logic
- **Wizard Framework**: Reusable patterns for complex workflows
- **OutputManager**: Centralized formatting and error handling
- **Test Infrastructure**: Realistic shell-based CLI testing

### Code Quality

- **DRY Elimination**: Removed major sources of code duplication
- **Standardization**: Consistent patterns across entire codebase
- **Maintainability**: Clear architecture and documentation
- **Extensibility**: Easy to add new commands and features
