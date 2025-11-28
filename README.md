# Data Dumpster Diver

A modern web application for exploring and visualizing exported ChatGPT conversation data. Built with Node.js, Express, and a sleek dark mode interface.

![Data Dumpster Diver](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![License](https://img.shields.io/badge/license-ISC-purple.svg)

## ✨ Features

### 🚀 Core Functionality

- **Web-based Upload Interface**: Drag-and-drop or click-to-upload ChatGPT export zip files
- **Automatic Data Processing**: Extract conversations, media assets, and metadata from exports
- **Session Management**: Isolated processing sessions with automatic cleanup
- **Real-time Search**: Instant filtering of conversation titles and content
- **Rich Message Display**: Markdown rendering, code highlighting, and media embedding

### 🎨 User Experience

- **Modern Dark Mode**: Eye-friendly interface with comprehensive color palette
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Smooth Animations**: Polished transitions and micro-interactions
- **Keyboard Navigation**: Efficient shortcuts for power users
- **Accessibility**: WCAG-compliant design with proper contrast ratios

### 🔧 Technical Features

- **Secure File Handling**: Type validation and sanitization
- **Efficient Processing**: Streaming file extraction and memory management
- **Error Handling**: Comprehensive error reporting and recovery
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

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Usage

1. **Export your ChatGPT data**
   - Go to ChatGPT Settings → Data controls → Export
   - Wait for the email notification and download the zip file

2. **Upload to Data Dumpster Diver**
   - Drag the zip file onto the upload area or click to select
   - Wait for processing to complete

3. **Explore your conversations**
   - Browse the conversation list with real-time search
   - Click any conversation to view detailed messages
   - Use keyboard shortcuts for efficient navigation

## 📁 Project Structure

```
data-dumpster-diver/
├── app.js                 # Main Express server and routing
├── main.js               # Message processing and markdown rendering
├── package.json          # Dependencies and npm scripts
├── data/
│   ├── migration.js      # Data migration and processing script
│   ├── conversations/    # Processed conversation files (auto-generated)
│   ├── sessions/         # Session-specific data (auto-generated)
│   └── assets.json       # Asset metadata (auto-generated)
├── views/
│   ├── upload.ejs        # File upload interface
│   ├── conversations.ejs # Conversation listing with search
│   └── conversation.ejs  # Individual conversation viewer
├── public/
│   ├── styles.css        # Dark mode CSS with custom properties
│   └── media/           # Extracted media files (auto-generated)
├── CHANGELOG.md         # Version history and changes
├── COLOR_PALETTE.md     # Design system documentation
├── AGENTS.md           # Development guidelines
└── README.md           # This file
```

## 🔧 Development

### Available Scripts

```bash
# Start the application
npm start

# Development mode (same as start)
npm run dev

# Run migration script manually
npm run migrate [path/to/conversations.json]

# Linting (not configured yet)
npm run lint

# Testing (not configured yet)
npm test
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Upload page |
| POST | `/upload` | Process ChatGPT export zip file |
| GET | `/conversations` | List conversations for a session |
| GET | `/conversation/:id` | View specific conversation |
| DELETE | `/sessions/:id` | Clean up specific session |
| POST | `/cleanup` | Clean up all old sessions |

### Session Management

- **Session Creation**: Generated automatically on file upload
- **Data Isolation**: Each session has isolated data and media folders
- **Automatic Cleanup**: Sessions expire after 24 hours by default
- **Manual Cleanup**: Use the "Clear All Sessions" button or API endpoints

## 🎨 Design System

The application uses a comprehensive dark mode color palette documented in [`COLOR_PALETTE.md`](./COLOR_PALETTE.md). Key features:

- **Accessibility**: WCAG AA compliant contrast ratios
- **Consistency**: CSS custom properties for maintainable theming
- **Responsive**: Mobile-first design with fluid layouts
- **Performance**: Optimized CSS with minimal reflows

## 🔒 Security & Privacy

- **Local Processing**: All data processing happens locally on your machine
- **No External APIs**: No data is sent to external services
- **Session Isolation**: Each upload session is completely isolated
- **Automatic Cleanup**: Temporary files are automatically removed
- **Content Sanitization**: All rendered content is sanitized for safety

## 🛠️ Configuration

### Environment Variables

```bash
# Server port (default: 3000)
PORT=3000

# Session cleanup interval in milliseconds (default: 24 hours)
SESSION_CLEANUP_INTERVAL=86400000
```

### Customization

- **Port**: Modify the `PORT` environment variable
- **Session Duration**: Adjust cleanup timing in `app.js`
- **File Limits**: Configure multer settings for upload limits
- **Styling**: Modify CSS custom properties in `public/styles.css`

## 🐛 Troubleshooting

### Common Issues

**Upload fails with "conversations.json not found"**

- Ensure you're uploading the complete ChatGPT export zip file
- Check that the export was generated successfully from ChatGPT settings

**Media files not displaying**

- Verify the export contains media files in the expected format
- Check browser console for any asset loading errors

**Session data disappears**

- Sessions automatically expire after 24 hours for privacy
- Use the "Clear All Sessions" button to manually clean up

**Performance issues with large exports**

- Large exports (>1GB) may take several minutes to process
- Consider breaking up very large exports into smaller chunks

### Getting Help

1. Check the [Issues](../../issues) page for known problems
2. Review the [CHANGELOG.md](./CHANGELOG.md) for recent updates
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

- Use ES6+ modules and modern JavaScript features
- Follow the existing code formatting and naming conventions
- Add comments for complex logic
- Ensure all new features include error handling

## 📈 Roadmap

### Version 1.1 (Planned)

- [ ] User authentication and persistent sessions
- [ ] Advanced search and filtering options
- [ ] Data visualization and analytics dashboard
- [ ] Export functionality (PDF, JSON, CSV)

### Version 1.2 (Future)

- [ ] Theme customization (light mode, custom colors)
- [ ] API for external integrations
- [ ] Real-time collaboration features
- [ ] Mobile app companion

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- UI powered by [EJS](https://ejs.co/) templating
- Styling with modern CSS and custom properties
- Icons and emojis from native browser support

---

**Data Dumpster Diver** - Dive deep into your ChatGPT conversations with style and ease.
