# DDD Architecture Documentation

Technical architecture and implementation details for the Data Dumpster Diver (DDD) application.

## Overview

DDD is a hybrid desktop application that combines Electron for the frontend with Express.js for the backend API. This architecture provides the security of a desktop application with the flexibility of a web-based API server.

## Architecture Pattern

```text
┌──────────────┐   IPC   ┌────────────────┐   HTTP  ┌──────────────┐
│  Electron    │ ◄─────► │  Electron      │ ◄─────► │  Express     │
│  Renderer    │         │  Main Process  │         │  API Server  │
│  (UI Layer)  │         │  (IPC Bridge)  │         │  (Business)  │
└──────────────┘         └────────────────┘         └──────────────┘
```

### Data Flow

1. **User Interaction** → HTML/CSS/JS frontend captures user input
2. **IPC Communication** → Frontend uses `window.electronAPI` for secure calls
3. **Process Bridge** → Electron main process forwards requests to Express API
4. **API Processing** → Express API processes data via SessionManager and utilities
5. **Response Flow** → Data flows back through the same chain to the UI

## Core Components

### Main Process (`main.js`)

The Electron main process serves as the secure bridge between the UI and the API server.

**Key Responsibilities:**

- Creates secure BrowserWindow with hardened security settings
- Manages file system operations via IPC handlers
- Waits for API server health check before creating window
- Handles application lifecycle events

**Security Configuration:**

```javascript
const windowConfig = {
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    preload: path.join(__dirname, 'renderer.js'),
  },
};
```

### Content Security Policy (CSP)

All HTML files include comprehensive CSP meta tags for security:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: blob:; 
               font-src 'self' data:; 
               connect-src 'self' http://localhost:3001; 
               media-src 'self' blob: data:; 
               object-src 'none'; 
               frame-src 'none'; 
               child-src 'none'; 
               worker-src 'none'; 
               form-action 'self';"
/>
```

**CSP Features:**

- Allows inline scripts and styles for current functionality
- Restricts external resources to localhost API server
- Prevents dangerous content types (objects, frames, workers)
- Supports data: and blob: URLs for media assets

### API Server (`app.js`)

Independent Express server that handles all business logic and data processing.

**Key Features:**

- Runs on configurable port (default: 3001)
- CORS-enabled for Electron communication
- Multer middleware for file uploads
- Comprehensive error handling and logging
- Health check endpoint for monitoring

**Middleware Stack:**

```javascript
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRouter);
```

## Session Management

### SessionManager (`utils/SessionManager.js`)

Centralized session lifecycle management with disk-based persistence.

**Core Functions:**

- Session creation and isolation
- Data migration and processing
- Backup and restoration
- Automatic cleanup of expired sessions

**Session Structure:**

```text
data/
├── sessions.json              # Session registry and metadata
└── sessions/{sessionId}/
    ├── conversations.json     # Original uploaded file
    ├── conversations/         # Migrated individual files
    └── assets.json            # Extracted assets from chat.html
```

**Session Lifecycle:**

1. **Creation**: Generated automatically on file upload
2. **Processing**: Data extraction and migration
3. **Active**: Available for user interaction
4. **Expiration**: Automatic cleanup after 24 hours

### ProgressManager (`utils/ProgressManager.js`)

Real-time upload progress tracking with persistence across restarts.

**Features:**

- Multi-stage progress visualization
- Persistent progress storage
- Cancellation and cleanup support
- Server-Sent Events for real-time updates

**Progress Stages:**

1. File validation and upload
2. ZIP extraction and validation
3. Conversation parsing and migration
4. Asset extraction and organization
5. Index generation and finalization

## Security Implementation

### Multi-Layer Security (`utils/fileUtils.js`)

Comprehensive security validation for all file operations.

**Security Constants:**

```javascript
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_COMPRESSION_RATIO = 100; // 100:1 ratio limit
const MAX_FILES_IN_ZIP = 10000; // Max files per zip
```

**Validation Layers:**

1. **File Size Limits**: Prevents resource exhaustion
2. **File Type Validation**: ZIP signature verification
3. **Path Traversal Protection**: `validatePath()` function
4. **ZIP Bomb Protection**: Compression ratio and file count limits
5. **Content Sanitization**: HTML sanitization for rendered content

### Secure File Handling

**Path Validation:**

```javascript
function validatePath(filePath) {
  const normalizedPath = path.normalize(filePath);
  return (
    !normalizedPath.includes('..') &&
    !normalizedPath.startsWith('/') &&
    !normalizedPath.includes('\\')
  );
}
```

**Temporary Directory Management:**

- Isolated temp directories per session
- Automatic cleanup on completion/error
- Secure permissions and access controls

## Data Organization

### File System Structure

```text
ddd/
├── data/                          # Data storage
│   ├── sessions.json              # Session registry
│   ├── upload-progress.json       # Active uploads
│   ├── sessions/                  # Session data
│   │   └── {sessionId}/
│   │       ├── conversations.json
│   │       ├── conversations/
│   │       └── assets.json
│   ├── migration.js               # Data migration
│   └── extract-assets-json.js     # Asset extraction
├── public/media/sessions/         # Extracted media
│   └── {sessionId}/
│       ├── audio/                 # Voice recordings
│       ├── dalle-generations/     # AI-generated images
│       └── file-*.jpeg            # Other media files
└── backups/                       # Session backups
    └── {sessionId}_{timestamp}.json
```

### Data Migration

**Legacy to Modern Migration:**

- Single `conversations.json` → Individual conversation files
- Inline media → Separate media files with references
- Flat structure → Organized session-based hierarchy

**Migration Process:**

1. Parse original conversations.json
2. Extract individual conversations to separate files
3. Process and extract media assets
4. Generate conversation index
5. Update session metadata

## CSS Architecture

### Static CSS Approach

DDD uses a performance-first static CSS architecture for optimal caching and execution.

**CSS Files Structure:**

```text
public/
├── styles.css              # Main design system (2500+ lines)
├── enhanced-design.css     # Visual effects and glassmorphism
└── fonts/                 # FiraCode Nerd Font files

views/
└── index.html             # Critical CSS inlined
```

**Design System Features:**

- **CSS Custom Properties**: Comprehensive theming system
- **Component Library**: Reusable classes for UI elements
- **Dark Theme**: Eye-friendly dark mode design
- **Responsive Design**: Mobile-first progressive enhancement
- **Performance Optimization**: Critical CSS inlining, GPU acceleration

**Migration Benefits:**

- Eliminated browser module loading errors
- Improved caching and performance
- Reduced JavaScript bundle size
- Better developer experience with standard CSS tooling

## Logging System

### Structured Logging (`utils/logger.js`)

Pino-based logging system for better debugging and monitoring.

**Features:**

- Module-specific log instances
- Performance-optimized logging
- Configurable log levels and output formats
- Structured JSON output for parsing

**Log Levels:**

- `fatal`: Critical application errors
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug information
- `trace`: Detailed tracing

**Usage Example:**

```javascript
const logger = require('./utils/logger');

logger.info('Session created', { sessionId, conversationCount });
logger.error('File processing failed', { error, filename });
```

## Configuration

### Environment Variables

```bash
# API Server Configuration
API_PORT=3001                    # Express server port

# File Upload Limits
MAX_UPLOAD_SIZE=524288000        # 500MB in bytes
MAX_EXTRACTED_SIZE=2147483648    # 2GB in bytes
MAX_COMPRESSION_RATIO=100        # Compression ratio limit
MAX_FILES_IN_ZIP=10000          # Max files per zip

# Session Management
SESSION_TIMEOUT=86400000        # 24 hours in milliseconds
CLEANUP_INTERVAL=3600000        # 1 hour in milliseconds

# Logging
LOG_LEVEL=info                  # Log level (fatal, error, warn, info, debug, trace)
```

### Customization Options

**Session Management:**

- Adjust cleanup timing in SessionManager
- Configure backup frequency and retention
- Modify session isolation settings

**Security:**

- Configure file size limits in fileUtils.js
- Adjust compression ratio thresholds
- Customize path validation rules

**Styling:**

- Modify CSS custom properties in color-palette.css
- Adjust theme colors and typography
- Configure responsive breakpoints

## Performance Optimizations

### Frontend Optimizations

- **Critical CSS Inlining**: Above-the-fold rendering optimization
- **CSS Containment**: Reduce layout recalculations
- **GPU Acceleration**: `will-change` and `transform3d` properties
- **Lazy Loading**: Non-critical resources loaded on demand
- **Virtual Scrolling**: Efficient handling of large conversation lists

### Backend Optimizations

- **Streaming File Processing**: Memory-efficient file handling
- **Progressive JSON Parsing**: Handle large files without loading entirely
- **Connection Pooling**: Efficient database/file system access
- **Caching Strategy**: Session data and metadata caching
- **Compression**: Gzip compression for API responses

## Development Workflow

### Development Modes

**Full Development (Recommended):**

```bash
npm run dev-full  # Starts API server + Electron app
```

**Web-Only Development:**

```bash
npm run web       # Starts Express server only
```

**Electron-Only:**

```bash
npm start         # Launches Electron app (requires API server)
```

### Build and Deployment

**Development Build:**

```bash
npm run dev       # Development mode with hot reload
```

**Production Build:**

```bash
npm run build     # Optimized production build (if configured)
```

**Code Quality:**

```bash
npm run lint      # ESLint checking
npm run lint:fix  # Auto-fix ESLint issues
npm run format    # Prettier formatting
npm run lint-and-fix  # Combined linting and formatting
```

## Monitoring and Debugging

### Health Checks

**API Health Endpoint:**

```bash
GET /api/health
```

Returns server status, uptime, and timestamp.

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev-full
```

### Common Issues

**Port Conflicts:**

- Change API_PORT environment variable
- Check for existing processes on port 3001

**Memory Issues:**

- Monitor file upload sizes
- Check for memory leaks in long-running processes

**File Permission Errors:**

- Ensure proper directory permissions
- Check temp directory access rights

## Future Architecture Considerations

### Scalability

**Potential Enhancements:**

- Database integration for large-scale deployments
- Microservices architecture for component separation
- Load balancing for multi-user scenarios
- Caching layer with Redis or similar

### Security Enhancements

**Future Improvements:**

- User authentication and authorization
- API rate limiting
- Input validation middleware
- Security audit logging

### Performance

**Optimization Opportunities:**

- Background processing for large files
- IndexedDB for client-side caching
- Web Workers for heavy computations
- Service worker for offline functionality

For complete API documentation, see [API.md](./API.md). For development guidelines, see [../AGENTS.md](../AGENTS.md).
