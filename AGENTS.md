# AGENTS.md

## **Project Architecture**

### **Hybrid Electron + Express Application**

This is a sophisticated desktop application that combines:

- **Electron Frontend**: Secure desktop wrapper with IPC communication
- **Express Backend**: Full REST API server for business logic
- **Session Management**: Centralized data processing and storage

### **Architecture Pattern**

```text
┌──────────────┐   IPC   ┌────────────────┐   HTTP  ┌──────────────┐
│  Electron    │ ◄─────► │  Electron      │ ◄─────► │  Express     │
│  Renderer    │         │  Main Process  │         │  API Server  │
│  (UI Layer)  │         │  (IPC Bridge)  │         │  (Business)  │
└──────────────┘         └────────────────┘         └──────────────┘
```

**Data Flow:**

1. User interacts with HTML/CSS/JS frontend
2. Frontend uses `window.electronAPI` for secure IPC calls
3. Electron main process forwards requests to Express API
4. Express API processes data via SessionManager and utilities
5. Response flows back through the same chain

### **Key Components**

**Main Process (`main.js`):**

- Creates secure BrowserWindow (nodeIntegration: false, contextIsolation: true)
- Manages file system operations via IPC
- Waits for API server health before creating window
- Handles application lifecycle

**Content Security Policy (CSP):**

- All HTML files include comprehensive CSP meta tags
- Policy: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:3001; media-src 'self' blob: data:; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'self';`
- Allows inline scripts and styles for current functionality
- Restricts external resources to localhost API server
- Prevents dangerous content types (objects, frames, workers)
- Supports data: and blob: URLs for media assets

**API Server (`app.js`):**

- Independent Express server on port 3001
- CORS-enabled for Electron communication
- All business logic and data processing
- Can run standalone as web server

**Session Management (`utils/SessionManager.js`):**

- Centralized session lifecycle management
- Disk-based session persistence
- Integration with backup system
- File processing orchestration
- Progress tracking integration

**Progress Management (`utils/ProgressManager.js`):**

- Real-time upload progress tracking
- Persistent progress storage across restarts
- Multi-stage progress visualization
- Cancellation and cleanup support

**Security Layer (`utils/fileUtils.js`):**

- Multi-layer file validation
- ZIP bomb protection
- Path traversal prevention
- Secure temporary directory handling
- Enhanced asset extraction capabilities

**Logging System (`utils/logger.js`):**

- Structured logging with Pino framework
- Module-specific log instances
- Performance-optimized logging
- Configurable log levels and output formats

## **Build/Lint/Test**

- Install deps: `npm ci`
- Lint: `npm run lint` (ESLint v9+ with flat config)
- Lint & Fix: `npm run lint:fix` (auto-fixable ESLint issues)
- Format: `npm run format` (Prettier with 88 char line length)
- Format Check: `npm run format:check` (check formatting without changes)
- Full Cleanup: `npm run lint-and-fix` (runs lint:fix + format)
- Test: `npm test` (currently not configured)
- Single test:
  - Jest: `npx jest path/to/file.test.js -t 'test name'`
  - Vitest: `npx vitest path/to/file.test.js -t 'test name'`
- Build: `npm run build` if script exists

## **Development Workflow**

### **Development Modes**

**Full Development (Recommended):**

```bash
npm run dev-full  # Starts API server + Electron app
```

**Web-Only Development:**

```bash
npm run web       # Starts Express server only (API_PORT=3001)
```

**Electron-Only (requires API server):**

```bash
npm start         # Launches Electron app
```

### **Environment Variables**

```bash
API_PORT=3001     # Express server port (default: 3001)
```

### **Development Notes**

- API server must be running before Electron app starts
- Electron app waits for API health check before creating window
- Use `npm run dev-full` for seamless development experience
- Web mode allows testing API endpoints directly

## **Code Style**

- Imports: standard order (builtin, third-party, local), explicit, no wildcards
- Formatting: Prettier (88 char line length), trailing commas, consistent multi-line formatting
- Types/Naming: Prefer TypeScript; JS uses JSDoc. snake_case for data, camelCase for functions, PascalCase for classes
- Error handling: Precise errors, avoid bare `catch`, validate inputs early
- Docs: Public APIs with docstrings/comments; keep README/docs synced
- Testing: Core utilities and edge cases, fast/deterministic tests

## **CSS Architecture**

### **Static CSS Approach**

- **Performance-first**: All styles defined in static CSS files for optimal caching
- **Design System**: Comprehensive CSS custom properties in `styles.css`
- **Component-based**: Reusable classes for toast notifications, loading states, skeletons
- **Responsive**: Mobile-first design with progressive enhancement
- **Accessibility**: Proper focus states, reduced motion support, semantic markup

### **CSS Files Structure**

- `public/styles.css` - Main design system with color palette, typography, components
- `enhanced-design.css` - Advanced visual effects and glassmorphism
- `views/index.html` - Critical CSS inlined for above-the-fold rendering
- **No CSS-in-JS**: Eliminated for better performance and maintainability

### **Key Features**

- **Dark Theme**: Comprehensive dark mode design system
- **Toast System**: Static classes for notifications (info, success, warning, error)
- **Loading States**: Overlay, spinner, and skeleton screen components
- **Glassmorphism**: Modern blur effects with backdrop-filter
- **Performance Optimized**: CSS containment, will-change properties, GPU acceleration

## **API Endpoints**

All endpoints use `/api/` prefix and run on port 3001.

### **Session Management**

- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:sessionId/conversations` - Get session conversations
- `GET /api/sessions/:sessionId/conversations/:conversationId` - Get specific conversation
- `DELETE /api/sessions/:sessionId` - Delete session
- `POST /api/sessions/cleanup` - Clean old sessions

### **File Operations**

- `POST /api/upload` - Upload and process ZIP file (multer memory storage)
- `GET /api/upload/progress/:uploadId` - Get upload progress status
- `DELETE /api/upload/progress/:uploadId` - Cancel upload and cleanup

### **Backup Management**

- `POST /api/sessions/:sessionId/backup` - Create backup
- `GET /api/sessions/:sessionId/backups` - List backups
- `POST /api/sessions/:sessionId/restore` - Restore from backup

### **System**

- `GET /api/health` - Health check endpoint

### **AI Integration (Placeholders)**

- `POST /api/ai/analyze-conversation` - AI analysis
- `POST /api/ai/search-conversations` - Semantic search
- `POST /api/ai/summarize-session` - Session summarization

## **Project Structure**

```text
data-dumpster-diver/
├── main.js                    # Electron main process
├── app.js                     # Express API server
├── renderer.js                # Electron preload script
├── package.json               # Dependencies and scripts
├── utils/                     # Core utilities
│   ├── SessionManager.js      # Session lifecycle management
│   ├── BackupManager.js      # Backup system
│   ├── ProgressManager.js     # Upload progress tracking
│   ├── fileUtils.js           # Secure file operations
│   ├── getConversationMessages.js # Message processing utilities
│   └── logger.js              # Logging utilities
├── views/                     # Frontend HTML files
│   ├── index.html             # Main dashboard
│   ├── upload.html            # File upload interface
│   ├── conversations.html     # Conversation list
│   └── conversation.html      # Conversation viewer
├── public/                    # Static assets
│   ├── styles.css             # Application styles
│   ├── fonts/                 # FiraCode Nerd Font files
│   ├── loading-system.js      # Loading state management
│   ├── navigation.js         # Navigation functionality
│   ├── pagination.js         # Client-side pagination
│   └── media/                 # Extracted media files
├── data/                      # Data storage
│   ├── sessions.json          # Session metadata
│   ├── sessions/              # Session data directories
│   ├── upload-progress.json   # Progress tracking data
│   ├── migration.js           # Data migration script
│   └── extract-assets-json.js # Asset extraction script
├── scripts/                   # Maintenance scripts
│   ├── fix-media-files.js     # Media file repair utility
│   └── migrate-logging.sh     # Logging migration script
├── backups/                   # Session backups
├── docs/                      # Documentation
│   ├── CHANGELOG.md           # Version history
│   ├── COLOR_PALETTE.md       # Design system
│   └── archive/               # Archived documentation
├── color-palette.css          # CSS custom properties
├── LICENSE                    # MIT License
└── AGENTS.md                  # Development guidelines
```

## **Data Organization**

### **Session Structure**

```text
data/
├── sessions.json              # Session registry and metadata
├── upload-progress.json       # Active upload progress tracking
└── sessions/{sessionId}/
    ├── conversations.json     # Original uploaded file
    ├── conversations/        # Migrated individual files
    └── assets.json           # Extracted assets from chat.html

public/media/sessions/{sessionId}/
├── audio/                    # Voice recordings
├── dalle-generations/        # AI-generated images
└── file-*.jpeg              # Other media files

backups/
└── {sessionId}_{timestamp}.json  # Session backups
```

## **Security Implementation**

### **Multi-Layer Validation**

1. **File Size Limits**: MAX_UPLOAD_SIZE (500MB default)
2. **File Type Validation**: ZIP signature verification
3. **Path Traversal Protection**: validatePath() function
4. **ZIP Bomb Protection**: Compression ratio and file count limits
5. **Content Sanitization**: HTML sanitization for rendered content

### **Security Constants**

```javascript
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_COMPRESSION_RATIO = 100; // 100:1 ratio limit
const MAX_FILES_IN_ZIP = 10000; // Max files per zip
```

## **Rules Visibility**

- Cursor Rules: None detected (check `.cursor/rules/` or `.cursorrules`)
- Copilot Rules: None detected (check `.github/copilot-instructions.md`)
- ESLint Config: `eslint.config.mjs` (flat config format)
- Prettier Config: `.prettierrc.json`
- Markdown Linting: Use `davidanson.vscode-markdownlint` extension in VS Code for markdown documentation

## **Project-Specific Scripts**

- Start Electron app: `npm start` or `npm run dev`
- Start web server: `npm run web` (API_PORT=3001)
- Full development: `npm run dev-full` (web server + Electron)
- Data migration: `npm run migrate` (migrates conversation data)
- Asset extraction: `node data/extract-assets-json.js` (extract assets from chat.html)
- Media file repair: `node scripts/fix-media-files.js` (fix broken media file references)

## **Notes**

- Workspace is a git repo; commit via usual workflow.
- Project uses CommonJS modules (`"type": "commonjs"` in package.json)
- ESLint config uses `.mjs` extension due to CommonJS project type
- Both `.js` and `.mjs` files are linted
- API server runs on port 3001, Electron app communicates via HTTP
- All file operations go through security validation in fileUtils.js
- Sessions persist across server restarts via disk storage
