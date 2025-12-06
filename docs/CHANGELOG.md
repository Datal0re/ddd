# Changelog

All notable changes to Data Dumpster Diver will be documented in this file.

## [1.0.2] - 2025-12-06

### 🔒 Critical Security Fixes

#### Path Traversal Vulnerability (FIXED ✅)
- **Issue**: `moveFilesToFinalLocations()` function didn't validate file paths, allowing malicious zip files to write files outside intended directories using `../` sequences
- **Fix**: Added `validatePath()` function with path normalization and validation for all file operations
- **Files Modified**: `utils/fileUtils.js`

#### Zip Bomb Protection (FIXED ✅)
- **Issue**: Only basic ZIP signature validation was performed, with no protection against compression ratio attacks
- **Fix**: Added `validateZipStructure()` function with compression ratio checks (max 100:1 ratio) and file count limits (max 10,000 files)
- **Files Modified**: `utils/fileUtils.js`

#### API Endpoint Validation (FIXED ✅)
- **Issue**: Backup API endpoints didn't validate session existence before processing requests
- **Fix**: Added session existence checks using `sessionManager.hasSession()` and proper HTTP status codes
- **Files Modified**: `app.js`

#### Backup Restore Cleanup (FIXED ✅)
- **Issue**: Failed backup restores didn't clean up partial changes, potentially leaving data in inconsistent state
- **Fix**: Implemented rollback mechanism with automatic file restoration on backup failure
- **Files Modified**: `utils/BackupManager.js`

#### Race Condition Protection (FIXED ✅)
- **Issue**: Multiple simultaneous backup calls could create conflicting files
- **Fix**: Implemented locking mechanism using `backupLocks` Map with timestamp collision detection
- **Files Modified**: `utils/BackupManager.js`

### 🏗️ Architecture Improvements

#### Hybrid Electron + Express Architecture
- **Change**: Transformed from web application to sophisticated desktop application
- **Implementation**: 
  - Electron frontend with secure IPC communication
  - Express backend API server on port 3001
  - Main process acts as API client to its own Express server
- **Files Added**: `renderer.js` (preload script), updated `main.js` (Electron main process)

#### Enhanced Session Management
- **Improvement**: Centralized session lifecycle management with disk-based persistence
- **Features**: Session rehydration on startup, integration with backup system
- **Files Modified**: `utils/SessionManager.js`, added `data/sessions.json` metadata storage

### 💾 Backup System Implementation

#### Automated Backup Creation
- **Feature**: `BackupManager` class for session backups with timestamps
- **Capabilities**: JSON-based backups, automatic cleanup (max 10), pre-restore backup creation
- **API Endpoints**: 
  - `POST /api/sessions/:sessionId/backup`
  - `GET /api/sessions/:sessionId/backups`
  - `POST /api/sessions/:sessionId/restore`

### 📈 Performance & UX Enhancements

#### Progress Tracking
- **Feature**: Real-time progress callbacks during upload processing
- **Benefit**: Better UX for large files with processing feedback

#### Enhanced Error Handling
- **Improvement**: More specific error messages, better logging, graceful error recovery
- **Benefit**: Improved debugging and user experience

#### Resource Management
- **Optimization**: Streaming processing for large files, memory-efficient operations
- **Benefit**: Better performance with large exports

### 🔧 Security Constants Added
```javascript
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_COMPRESSION_RATIO = 100; // 100:1 ratio limit
const MAX_FILES_IN_ZIP = 10000; // Max files per zip
```

## [1.0.1] - 2025-11-30

### 🛠️ Session Persistence Fix

- Problem: Sessions were lost on server restart
- Solution: Implemented disk-based session storage with startup rehydration
- Implementation:
  - Sessions now saved to `data/sessions.json` using disk storage
  - On server startup, sessions are automatically rehydrated from disk
- Validation:
  - Restart server and verify session data persistence
  - Test with `npm test` suite (includes session serialization tests)

## [1.0.0] - 2025-11-16

### 🎉 MVP Release

Initial release of Data Dumpster Diver - a web application for exploring and visualizing exported ChatGPT conversation data. (Later evolved to hybrid Electron + Express desktop application)

### ✨ Features Added

#### Core Web Application

- **Express.js Server**: Full-featured web server with HTML views
- **File Upload System**: Secure zip file upload with multer middleware
- **Session Management**: In-memory session handling with automatic cleanup
- **Data Migration**: Automated processing of ChatGPT export files

#### User Interface

- **Dark Mode Design**: Modern, accessible dark theme with comprehensive color palette
- **Responsive Design**: Mobile-friendly interface with CSS Grid and Flexbox
- **Upload Page**: Intuitive file upload interface with error handling and progress feedback
- **Conversations List**: Searchable, filterable conversation browser with real-time search
- **Conversation Viewer**: Rich message display with markdown rendering and media support

#### Data Processing

- **Zip Extraction**: Automatic extraction of ChatGPT export zip files
- **Media Asset Handling**: Extraction and organization of images, audio, and other media files
- **Conversation Migration**: Processing of conversations.json into individual files
- **Content Sanitization**: Safe HTML rendering with sanitize-html
- **Markdown Support**: Full markdown rendering with marked.js

#### Technical Features

- **ES Module Architecture**: Modern JavaScript module system
- **Asset Management**: Organized media file serving with session-scoped paths
- **Error Handling**: Comprehensive error handling throughout the application
- **File System Operations**: Robust file and directory management
- **Automatic Cleanup**: Session cleanup with configurable retention periods

### 🏗️ Architecture

#### Backend Components

- `app.js`: Express API server with routing and middleware
- `main.js`: Electron main process with IPC communication
- `utils/SessionManager.js`: Session lifecycle management
- `utils/BackupManager.js`: Backup system implementation
- `utils/fileUtils.js`: Secure file operations
- `data/migration.js`: Data migration script for processing exports

#### Frontend Components

- `views/upload.html`: File upload interface
- `views/conversations.html`: Conversation listing with search
- `views/conversation.html`: Individual conversation viewer
- `public/styles.css`: Comprehensive dark mode CSS with custom properties
- `renderer.js`: Electron preload script for IPC communication

#### Data Structure

- Session-based data organization
- Per-conversation JSON files with timestamp-based naming
- Media asset extraction and serving
- In-memory session storage with cleanup

### 🔧 Technical Implementation

#### Dependencies

- **Electron 35.7.5**: Desktop application framework
- **Express 5.1.0**: Web framework and routing
- **Multer 2.0.2**: File upload handling
- **Marked 17.0.0**: Markdown parsing and rendering
- **Sanitize-html 2.17.0**: HTML content sanitization
- **UUID 13.0.0**: Session identifier generation
- **Axios 1.6.0**: HTTP client for API communication
- **Pino 10.1.0**: Logging utility
- **Electron-log 5.4.3**: Electron-specific logging

#### API Endpoints

- `GET /api/health`: Health check
- `POST /api/upload`: File upload and processing
- `GET /api/sessions`: Session listing
- `GET /api/sessions/:sessionId/conversations`: Conversation listing for session
- `GET /api/sessions/:sessionId/conversations/:conversationId`: Individual conversation view
- `DELETE /api/sessions/:sessionId`: Session cleanup
- `POST /api/sessions/cleanup`: Bulk session cleanup

#### Security Features

- File type validation (zip files only)
- HTML sanitization for rendered content
- Session-based data isolation
- Automatic cleanup of temporary files

### 🎨 User Experience

#### Interface Design

- **Color Palette**: Comprehensive dark mode color system with accessibility focus
- **Typography**: System font stack with optimized readability
- **Animations**: Smooth transitions and micro-interactions
- **Responsive Design**: Mobile-first approach with breakpoints

#### Interactive Features

- Real-time search with result counting
- Keyboard navigation shortcuts
- Scroll-to-top functionality
- Double-click to copy message content
- Hover effects and visual feedback

### 📱 Browser Support

- Modern browsers with ES6 module support
- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

### 🚀 Performance

- Efficient file processing with streaming
- Lazy loading of conversation data
- Optimized CSS with custom properties
- Minimal JavaScript bundle size

### 🔒 Privacy & Security

- Local-only processing (no external API calls)
- Session data isolation
- Automatic cleanup of uploaded files
- No tracking or analytics

### 📁 File Structure

```text
data-dumpster-diver/
├── main.js                    # Electron main process
├── app.js                     # Express API server
├── renderer.js                # Electron preload script
├── getConversationMessages.js # Message processing utilities
├── package.json               # Dependencies and scripts
├── utils/                     # Core utilities
│   ├── SessionManager.js      # Session lifecycle management
│   ├── BackupManager.js      # Backup system
│   ├── fileUtils.js           # Secure file operations
│   └── logger.js              # Logging utilities
├── views/                     # Frontend HTML files
│   ├── index.html             # Main dashboard
│   ├── upload.html            # File upload interface
│   ├── conversations.html     # Conversation list
│   └── conversation.html      # Conversation viewer
├── public/                    # Static assets
│   ├── styles.css             # Application styles
│   └── media/                 # Extracted media files
├── data/                      # Data storage
│   ├── sessions.json          # Session metadata
│   ├── sessions/              # Session data directories
│   └── migration.js           # Data migration script
├── backups/                   # Session backups
├── docs/                      # Documentation
│   ├── CHANGELOG.md           # Version history
│   └── COLOR_PALETTE.md       # Design system
├── color-palette.css          # CSS custom properties
├── AGENTS.md                  # Development guidelines
└── README.md                  # Project documentation
```

### 🎯 MVP Scope

This initial release focuses on core functionality:

- Upload and process ChatGPT export files
- Browse and search conversations
- View individual conversations with rich formatting
- Basic session management and cleanup

### 🔮 Future Enhancements (Planned)

- User authentication and persistent sessions
- Advanced search and filtering options
- Data visualization and analytics
- Export functionality
- Theme customization
- API for external integrations

---

## Version History

### Pre-1.0 Development

- Initial project setup and architecture design
- Core file processing implementation
- UI/UX development and testing
- Integration testing with various ChatGPT export formats

---

**Note**: This changelog covers the initial MVP release. Future releases will follow semantic versioning and include detailed change logs for each version.
