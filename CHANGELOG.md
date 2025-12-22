# CHANGELOG

## v0.0.1 - Current

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
