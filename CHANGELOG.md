# Changelog

All notable changes to Data Dumpster Diver will be documented in this file.

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
Initial release of Data Dumpster Diver - a web application for exploring and visualizing exported ChatGPT conversation data.

### ✨ Features Added

#### Core Web Application
- **Express.js Server**: Full-featured web server with EJS templating
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
- `app.js`: Main Express server with routing and middleware
- `main.js`: Conversation message processing and markdown rendering
- `data/migration.js`: Data migration script for processing exports

#### Frontend Components
- `views/upload.ejs`: File upload interface
- `views/conversations.ejs`: Conversation listing with search
- `views/conversation.ejs`: Individual conversation viewer
- `public/styles.css`: Comprehensive dark mode CSS with custom properties

#### Data Structure
- Session-based data organization
- Per-conversation JSON files with timestamp-based naming
- Media asset extraction and serving
- In-memory session storage with cleanup

### 🔧 Technical Implementation

#### Dependencies
- **Express 5.1.0**: Web framework and routing
- **EJS 3.1.10**: Template engine for server-side rendering
- **Multer 2.0.2**: File upload handling
- **Decompress 4.2.1**: Zip file extraction
- **Marked 17.0.0**: Markdown parsing and rendering
- **Sanitize-html 2.17.0**: HTML content sanitization
- **UUID 13.0.0**: Session identifier generation

#### API Endpoints
- `GET /`: Upload page
- `POST /upload`: File upload and processing
- `GET /conversations`: Conversation listing
- `GET /conversation/:id`: Individual conversation view
- `DELETE /sessions/:id`: Session cleanup
- `POST /cleanup`: Bulk session cleanup

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
```
data-dumpster-diver/
├── app.js                 # Main Express server
├── main.js               # Message processing utilities
├── package.json          # Dependencies and scripts
├── data/
│   ├── migration.js      # Data migration script
│   ├── conversations/    # Processed conversation files
│   ├── sessions/         # Session-specific data
│   └── assets.json       # Asset metadata
├── views/
│   ├── upload.ejs        # Upload interface
│   ├── conversations.ejs # Conversation list
│   └── conversation.ejs  # Conversation viewer
├── public/
│   ├── styles.css        # Dark mode styles
│   └── media/           # Extracted media files
├── COLOR_PALETTE.md     # Design system documentation
├── AGENTS.md           # Development guidelines
└── README.md           # Project documentation
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