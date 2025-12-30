# CHANGELOG

## v0.0.5 - 2024-12-29

### Bug Fixes and Critical Improvements

- **Fixed Output Directory Bug**: Resolved critical issue where `--output` parameter wasn't being mapped to `outputDir` in upcycle commands
- **Version Bump**: Updated package.json to version 0.0.5
- **Enhanced Reliability**: Improved CLI parameter handling for export functionality

### Testing Infrastructure Overhaul

- **Replaced Node.js Test Suite**: Removed outdated Node.js tests (`full-suite-test.js`, `help-test.js`, `progress-demo.js`, etc.)
- **Added Shell-Based Testing**: Implemented comprehensive shell script test suite for more realistic CLI testing
  - `minimal-test.sh`: Basic functionality testing
  - `minimal-workflow-test.sh`: End-to-end workflow testing
  - `simple-test.sh`: Quick validation tests
- **Synthetic Test Data Generator**: Added `generate-test-data.js` for consistent, reproducible test data
- **Synthetic Test Data**: Created `tests/test-basic-synthetic/` with sample ChatGPT export structure
- **New Test Commands**: Updated package.json with comprehensive test scripts:
  - `npm test`: Run main test suite
  - `npm run test:basic`: Run basic functionality tests
  - `npm run test:workflows`: Run workflow integration tests
  - `npm run test:setup`: Generate test data and ZIP file
  - `npm run test:cleanup`: Clean up test artifacts

### Development Workflow Improvements

- **Simplified Testing**: Shell scripts provide more accurate CLI behavior testing
- **Better Test Coverage**: New test suite covers real-world usage scenarios
- **Easier Maintenance**: Shell-based tests are easier to understand and modify
- **Consistent Test Data**: Synthetic data ensures reliable, repeatable tests

## v0.0.4 - 2024-12-29

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

## v0.0.3

### Documentation and Configuration Updates

- **Updated**: CHANGELOG.md to reflect v0.0.3 as current version (synchronized with package.json)
- **Enhanced**: README.md with comprehensive dependency documentation including missing "cli-progress"
- **Added**: Complete test scripts documentation for all npm test commands
- **Verified**: File structure documentation accuracy against actual codebase
- **Synchronized**: Version numbers across all documentation files

#### Progress Management System

- **Added**: New `ProgressManager.js` utility to replace deprecated `progressTracker.js`
- **Updated**: `UpcycleManager.js` to use new progress management system
- **Enhanced**: More consistent progress tracking across export operations

#### Enhanced CLI and User Experience

- **Added**: `@inquirer/prompts` dependency for better interactive prompts
- **Refactored**: CLI commands and enhanced export functionality
- **Removed**: Legacy `CLIFramework` and streamlined command structure
- **Improved**: Error handling and user feedback throughout the application

#### Advanced Export Formatters

- **Added**: Comprehensive formatter system with `BaseFormatter.js` base class
- **Implemented**: `HTMLFormatter.js`, `MDFormatter.js`, and `TXTFormatter.js`
- **Enhanced**: Export capabilities with multiple format support and consistent APIs

#### Media and Asset Processing

- **Refactored**: Media file moving logic with improved audio type detection
- **Enhanced**: Asset filtering to include `user.json` and `message_feedback.json`
- **Improved**: ZIP directory detection and asset extraction workflows
- **Removed**: Legacy `copyEssentialFiles` function for cleaner architecture

#### Code Quality and Architecture

- **Standardized**: Utility module naming (e.g., `fsHelpers.js` → `FileSystemHelper.js`)
- **Added**: `CommonUtils.js` and `ErrorHandler.js` for better code organization
- **Enhanced**: `ChatUpcycler` with static export helper functions
- **Improved**: Console warning formatting and error messaging

#### Data Structure Updates

- **Refactored**: Replaced 'conversations' terminology with 'chats' throughout codebase
- **Updated**: All related functions, documentation, and data structures
- **Cleaned**: Git tracking to exclude runtime data (`data/dumpsters.json`)

#### Configuration and Validation

- **Added**: Configuration validation system
- **Enhanced**: Input validation with comprehensive parameter checking
- **Improved**: Schema validation for data integrity

## v0.0.1

### Recent Documentation Updates

- Added missing `burn` command documentation for dumpster deletion
- Corrected version information from v2.0.0-alpha to v0.0.1 to match actual release
- Updated file structure documentation to match actual codebase
- Added missing npm scripts documentation (`lint:fix`, `format:check`)
- Corrected CLI command descriptions to match actual implementation

### Feature Additions

- Added `burn` command with confirmation prompts, dry-run support, and force option
- Enhanced CLI with chalk colors and improved error handling
- Added comprehensive configuration system in `config/constants.js`

### Architecture Updates

- Consolidated utility functions into focused modules
- Enhanced security with path validation and zip bomb protection
- Improved progress tracking and error handling throughout the codebase

## Previous Updates

- Reverted version to v0.0.1
- Corrected file paths in File Structure section to match actual data/ and utils/ contents
- Updated Core Components references to accurate file paths (fsHelpers.js, conversation-messages.js)
- Clarified extract-assets command purpose in Development Commands
