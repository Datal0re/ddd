# Data Dumpster Diver

A sophisticated desktop application for exploring and visualizing exported ChatGPT conversation data. Built with Electron and Express for secure, local data processing.

![Data Dumpster Diver](https://img.shields.io/badge/version-1.0.4-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)

## ✨ Features

### 🚀 Core Functionality

- **Desktop Application**: Secure Electron wrapper with Express backend
- **Session Management**: Isolated processing sessions with automatic cleanup
- **Automatic Data Processing**: Extract conversations, media assets, and metadata from exports
- **Real-time Search**: Instant filtering of conversation titles and content
- **Rich Message Display**: Markdown rendering, code highlighting, and media embedding

### 🎨 User Experience

- **Modern Dark Mode**: Eye-friendly interface with comprehensive color palette
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Smooth Animations**: Polished transitions and micro-interactions
- **Progress Tracking**: Real-time feedback during file processing
- **Accessibility**: WCAG-compliant design with proper contrast ratios

### 🔧 Technical Features

- **Hybrid Architecture**: Electron frontend + Express API backend
- **Secure File Handling**: Multi-layer validation and ZIP bomb protection
- **Backup System**: Automated session backups and restoration
- **Session Persistence**: Data survives application restarts
- **Media Asset Management**: Automatic extraction and organization of images, audio, and files
- **Markdown Support**: Full markdown rendering with safe HTML output

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **ChatGPT Data Export** - Export your data from [ChatGPT Settings](https://chat.openai.com/settings/data-controls)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd data-dumpster-diver
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the application**

   ```bash
   npm start
   # or for development
   npm run dev
   ```

   The desktop application will launch automatically.

### Development Modes

**Full Development (Recommended):**

```bash
npm run dev-full  # Starts API server + Electron app
```

**Web-Only Development:**

```bash
npm run web       # Starts Express server only (API_PORT=3001)
```

### Usage

1. **Export your ChatGPT data**
   - Go to ChatGPT Settings → Data controls → Export
   - Wait for the email notification and download the zip file

2. **Upload to Data Dumpster Diver**
   - Launch the desktop application
   - Drag the zip file onto the upload area or click to select
   - Wait for processing to complete

3. **Explore your conversations**
   - Browse the conversation list with real-time search
   - Click any conversation to view detailed messages
   - Use keyboard shortcuts for efficient navigation

## 🏗️ Architecture

Data Dumpster Diver uses a hybrid architecture combining:

- **Electron Frontend**: Secure desktop wrapper with IPC communication
- **Express Backend**: Full REST API server for business logic
- **Session Management**: Centralized data processing and storage

### Data Flow

```text
User Interface → IPC → Main Process → HTTP → Express API → SessionManager
```

## 📁 Project Structure

```text
data-dumpster-diver/
├── main.js                    # Electron main process
├── app.js                     # Express API server
├── renderer.js                # Electron preload script
├── getConversationMessages.js # Message processing utilities
├── package.json               # Dependencies and scripts
├── utils/                     # Core utilities
│   ├── SessionManager.js      # Session lifecycle management
│   ├── BackupManager.js       # Backup system
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
└── color-palette.css          # CSS custom properties
```

## 🔧 Development

### Available Scripts

```bash
# Start the desktop application
npm start

# Development mode (same as start)
npm run dev

# Start web server only
npm run web

# Full development (server + desktop)
npm run dev-full

# Run migration script manually
npm run migrate [path/to/conversations.json]

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run lint-and-fix
```

### Environment Variables

```bash
# API server port (default: 3001)
API_PORT=3001
```

### API Endpoints

All endpoints use `/api/` prefix and run on port 3001.

| Method | Endpoint                                                 | Description                      |
| ------ | -------------------------------------------------------- | -------------------------------- |
| GET    | `/api/health`                                            | Health check                     |
| POST   | `/api/upload`                                            | Process ChatGPT export zip file  |
| GET    | `/api/sessions`                                          | List all sessions                |
| GET    | `/api/sessions/:sessionId/conversations`                 | List conversations for a session |
| GET    | `/api/sessions/:sessionId/conversations/:conversationId` | View specific conversation       |
| DELETE | `/api/sessions/:sessionId`                               | Clean up specific session        |
| POST   | `/api/sessions/cleanup`                                  | Clean up all old sessions        |
| POST   | `/api/sessions/:sessionId/backup`                        | Create session backup            |
| GET    | `/api/sessions/:sessionId/backups`                       | List session backups             |
| POST   | `/api/sessions/:sessionId/restore`                       | Restore from backup              |

### Session Management

- **Session Creation**: Generated automatically on file upload
- **Data Isolation**: Each session has isolated data and media folders
- **Automatic Cleanup**: Sessions expire after 24 hours by default
- **Manual Cleanup**: Use the cleanup API endpoints
- **Backup System**: Automated backups with restoration capabilities

## 🎨 Design System

The application uses a comprehensive dark mode color palette documented in [`docs/COLOR_PALETTE.md`](./docs/COLOR_PALETTE.md). Key features:

- **Accessibility**: WCAG AA compliant contrast ratios
- **Consistency**: CSS custom properties for maintainable theming
- **Responsive**: Mobile-first design with fluid layouts
- **Performance**: Optimized CSS with minimal reflows

### Typography

The application features **FiraCode Nerd Font** integration for enhanced Unicode character support and code readability:

- **Font Files**: Self-hosted WOFF2 format with ~50% compression
- **UI Elements**: Standard FiraCode Nerd Font for all interface text
- **Code Blocks**: FiraCode Nerd Font Mono for technical content
- **Performance**: `font-display: swap` for optimal loading with graceful fallbacks
- **Unicode Support**: Extensive character and icon support for conversation data
- **Offline Capability**: Self-hosted fonts work without internet connection

Font variants included:

- Regular and Bold weights for standard UI
- Monospace variants for code and technical content
- System font fallbacks for reliability

## 🔒 Security & Privacy

- **Local Processing**: All data processing happens locally on your machine
- **No External APIs**: No data is sent to external services
- **Session Isolation**: Each upload session is completely isolated
- **Multi-layer Validation**: File size, type, and ZIP bomb protection
- **Path Traversal Prevention**: Secure file handling with validation
- **Content Sanitization**: All rendered content is sanitized for safety
- **Automatic Cleanup**: Temporary files are automatically removed

## 🛠️ Configuration

### Customization

- **Port**: Modify the `API_PORT` environment variable
- **Session Duration**: Adjust cleanup timing in SessionManager
- **File Limits**: Configure security constants in fileUtils.js
- **Styling**: Modify CSS custom properties in color-palette.css

## 🐛 Troubleshooting

### Common Issues

#### Application fails to start

- Ensure Node.js 18+ is installed
- Check that all dependencies are installed with `npm install`
- Verify API server can start with `npm run web`

#### Upload fails with "conversations.json not found"

- Ensure you're uploading the complete ChatGPT export zip file
- Check that the export was generated successfully from ChatGPT settings

#### Media files not displaying

- Verify the export contains media files in the expected format
- Check browser console for any asset loading errors

#### Session data disappears

- Sessions automatically expire after 24 hours for privacy
- Use backup system to preserve important sessions
- Check data/sessions.json for session metadata

#### Performance issues with large exports

- Large exports (>1GB) may take several minutes to process
- Consider breaking up very large exports into smaller chunks
- Monitor memory usage during processing

### Getting Help

1. Check the [Issues](../../issues) page for known problems
2. Review the [CHANGELOG](./docs/CHANGELOG.md) for recent updates
3. Create a new issue with details about your problem

## 🤝 Contributing

Contributions are welcome! Please see [`AGENTS.md`](./AGENTS.md) for development guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly with various ChatGPT export formats
5. Submit a pull request

### Code Style

- Use ES6+ features and modern JavaScript patterns
- Follow the existing code formatting and naming conventions
- Add comments for complex logic
- Ensure all new features include error handling
- Run `npm run lint-and-fix` before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/) and [Express.js](https://expressjs.com/)
- UI powered by modern HTML/CSS/JavaScript
- Styling with comprehensive CSS custom properties
- Icons and emojis from native browser support

---

**Data Dumpster Diver** - Dive deep into your ChatGPT conversations with security and style.
