# CHANGELOG

## v0.1.0 - 2026-01-01 🎉 MAJOR RELEASE

### 🧙‍♂️ Wizard-Based CLI System - Revolutionary UX Enhancement

**Complete CLI Transformation**: Replaced complex nested workflows with intuitive wizard-based guided experiences

- **Progressive Disclosure**: Users see only relevant options at each step, reducing cognitive load
- **Step Indicators**: Clear `[1/9] Step Name` progress tracking throughout workflows
- **Conditional Logic**: Smart step skipping based on user choices and context
- **Declarative Configuration**: Simple step arrays instead of complex nested decision trees
- **State Management**: Maintains context across wizard steps for seamless experience

**Enhanced Rummage Command**: Complete redesign from 130+ line complex loop to clean wizard flow:

1. Select dumpster (conditional - only if not provided)
2. Choose action: Search, Browse, or Manage selection bin
3. Search query (conditional - only for search action)
4. Search scope (conditional - only if search query provided)
5. Case sensitivity (conditional - only if search query provided)
6. Chat limit (conditional - only for browse action)
7. Chat selection (dynamic choices based on previous steps)
8. Action on selected chats (conditional - only if chats selected)
9. Handle empty selection (conditional - only if no chats selected)

### 📊 Unified Output Management - Complete Console Consistency

**OutputManager Implementation**: Unified all console output patterns across entire CLI

- **Single Source of Truth**: Centralized output formatting eliminates 15+ inconsistent patterns
- **Standardized Emoji Usage**: Semantic emoji system with consistent visual language
- **Context-Aware Messaging**: All messages include operation context for better debugging
- **Enhanced Error Recovery**: Actionable suggestions with every error message
- **Professional Polish**: Structured reports, lists, and step indicators

**Message Type Standards**:

- ✅ **Success**: `✅ context: message` (Green)
- ❌ **Error**: `❌ Error: context: message` (Red)
- ⚠️ **Warning**: `⚠️ context: message` (Yellow)
- ℹ️ **Info**: `ℹ️ context: message` (Blue)
- 🏃 **Progress**: `⏳ context: message` (Blue)
- 📍 **Steps**: `📍 Step 1/3: description`
- 🧙‍♂️ **Wizard**: `🧙‍♂️ context: message`

### 🏗️ Service Layer Architecture - Complete Codebase Refactoring

**BaseCommandService Foundation**: Established inheritance hierarchy for all business logic

- **6 New Service Classes**: DumpService, HoardService, BurnService, UpcycleService, RummageService, BinService
- **Consistent Error Handling**: Standardized result objects and error patterns
- **Dependency Injection**: Clean manager separation and testing support
- **Result Standardization**: All services return `{ success, data, message, error, timestamp }` objects

**SchemaValidator Enhancement**: Comprehensive validation with safe patterns

- **Safe Validation Methods**: Non-throwing alternatives for all validation functions
- **Prompt Detection**: Smart detection of when user input is required vs. validation errors
- **Context-Aware Errors**: Validation errors include operational context
- **Type Safety**: Comprehensive parameter validation across all inputs

### 🎯 Selection Bin System - Persistent Chat Management

**New Workflow Integration**: Seamlessly connect rummage selection with upcycle export

- **Persistent Selection**: Selected chats remain available across multiple rummage sessions
- **Bin Management**: Create, rename, empty, and delete selection bins
- **Export Integration**: Upcycle command can export from selection bin or entire dumpster
- **Multi-Select Interface**: Checkbox-based chat selection with visual feedback

### 🔧 Code Quality & Maintainability Improvements

**DRY Violations Eliminated**: Major reduction in code duplication

- **Output Consistency**: Eliminated 15+ different console output patterns
- **Validation Consolidation**: Centralized validation logic across all services
- **Error Handling**: Unified error patterns with consistent recovery suggestions
- **Business Logic Separation**: Clear separation between CLI interface and business operations

**Enhanced Testing Infrastructure**:

- **New Test Suites**: `rummage-integration-test.sh`, `test-empty-bin.sh`, `test-output-consistency.sh`
- **Real CLI Testing**: Shell-based tests validate actual user workflows
- **Consistent Test Data**: Synthetic data generation for reproducible testing
- **Comprehensive Coverage**: Tests for wizard flows, service methods, and error scenarios

### 📦 Architecture Summary

**Before v0.1.0**:

- Complex nested command loops
- Inconsistent console output patterns
- Mixed error handling approaches
- Limited user guidance and recovery

**After v0.1.0**:

- Wizard-based guided workflows
- Unified OutputManager system
- Service layer with BaseCommandService
- Enhanced error recovery with suggestions
- Selection bin system for persistent workflow

### 🛡️ Security & Reliability

- **Input Validation**: Comprehensive parameter validation throughout CLI
- **Error Recovery**: Graceful failure handling with actionable suggestions
- **Path Safety**: Maintained robust path traversal protection
- **ZIP Security**: Preserved zip bomb and malicious file protection

### 📈 Impact Metrics

**User Experience**:

- ✅ **Cognitive Load Reduced**: Progressive disclosure eliminates option overwhelm
- ✅ **Consistency Achieved**: Unified visual language across entire CLI
- ✅ **Error Recovery Enhanced**: Actionable suggestions for every failure
- ✅ **Workflow Efficiency**: Persistent selection bins save time

**Developer Experience**:

- ✅ **Maintainability Improved**: Centralized output and validation logic
- ✅ **Testing Enhanced**: Shell-based tests validate real CLI behavior
- ✅ **Architecture Clean**: Clear separation between CLI and business logic
- ✅ **Consistency Enforced**: Service layer establishes coding patterns

**Code Quality**:

- ✅ **DRY Violations**: Eliminated major sources of duplication
- ✅ **Standards**: Established patterns for future development
- ✅ **Documentation**: Comprehensive JSDoc and inline documentation
- ✅ **Testing**: Realistic CLI testing scenarios

---

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
