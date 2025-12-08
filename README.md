# DDD - Data Dumpster Diver

A desktop application for exploring and visualizing your ChatGPT conversation data locally and securely.

![Version](https://img.shields.io/badge/version-1.0.5-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)

## ✨ Features

- **🔒 Privacy-First**: All data processing happens locally on your machine
- **📁 Smart Organization**: Automatically extracts and organizes conversations, media, and assets
- **🔍 Instant Search**: Real-time filtering of conversation titles and content
- **📱 Beautiful Interface**: Modern dark mode with smooth animations and responsive design
- **⚡ Fast Performance**: Optimized for handling large conversation datasets
- **🎨 Rich Display**: Markdown rendering, code highlighting, and media embedding
- **💾 Backup & Restore**: Automatic session backups with easy restoration
- **⌨️ Keyboard Friendly**: Full keyboard navigation and shortcuts
- **📊 Progress Tracking**: Real-time upload progress with detailed status updates

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **ChatGPT Data Export** - Export your data from [ChatGPT Settings](https://chat.openai.com/settings/data-controls)

### Installation

```bash
# Clone the repository
git clone https://github.com/Datal0re/ddd.git
cd ddd

# Install dependencies
npm install

# Start the application
npm start
```

The desktop application will launch automatically.

### Usage

1. **Export your ChatGPT data**
   - Go to ChatGPT Settings → Data controls → Export
   - Wait for the email notification and download the zip file

2. **Upload to DDD**
   - Launch the desktop application
   - Drag the zip file onto the upload area or click to select
   - Wait for processing to complete

3. **Explore your conversations**
   - Browse the conversation list with real-time search
   - Click any conversation to view detailed messages
   - Use keyboard shortcuts for efficient navigation

## 📸 Screenshots

<!-- TODO: Add screenshots of the application -->

_Main dashboard with conversation list_
_Conversation viewer with rich message display_
_Upload interface with progress tracking_

## 🔒 Privacy & Security

- **🏠 Local Processing**: All data processing happens locally on your machine
- **🚫 No External APIs**: No data is sent to external services
- **🔐 Session Isolation**: Each upload session is completely isolated
- **🛡️ Multi-layer Validation**: File size, type, and ZIP bomb protection
- **🔒 Secure File Handling**: Path traversal prevention and content sanitization
- **🧹 Automatic Cleanup**: Temporary files are automatically removed

## 🛠️ For Developers

DDD is built with modern web technologies and follows best practices for security and performance.

**Tech Stack:**

- **Frontend**: Electron + HTML/CSS/JavaScript
- **Backend**: Express.js + Node.js
- **Architecture**: Hybrid desktop application with local API server

**Development:**

```bash
# Full development (recommended)
npm run dev-full  # Starts API server + Electron app

# Web-only development
npm run web       # Starts Express server only

# Code quality
npm run lint      # ESLint checking
npm run format    # Prettier formatting
```

**Documentation:**

- 📖 **[API Documentation](./docs/API.md)** - Complete API reference
- 🏗️ **[Architecture Guide](./docs/ARCHITECTURE.md)** - Technical architecture
- 👨‍💻 **[Development Guidelines](./AGENTS.md)** - Contributing and development practices
- 📋 **[Changelog](./docs/CHANGELOG.md)** - Version history and updates

## 📁 Project Structure

```text
ddd/
├── main.js                    # Electron main process
├── app.js                     # Express API server
├── renderer.js                # Electron preload script
├── package.json               # Dependencies and scripts
├── utils/                     # Core utilities
├── views/                     # Frontend HTML files
├── public/                    # Static assets (styles, fonts, scripts)
├── data/                      # Data storage and sessions
├── scripts/                   # Maintenance and utility scripts
├── backups/                   # Session backups
├── docs/                      # Documentation
├── LICENSE                    # MIT License
└── AGENTS.md                  # Development guidelines
```

## 📈 Roadmap

### Version 1.1 (Planned)

- [ ] Advanced search and filtering options
- [ ] Data visualization and analytics dashboard
- [ ] Export functionality (PDF, JSON, CSV, MD)

### Version 1.2 (Future)

- [ ] Theme customization (light mode, custom colors)
- [ ] API for external integrations
- [ ] Mobile app companion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/) and [Express.js](https://expressjs.com/)
- Fonts powered by [FiraCode](https://firacode.org)
- Icons and emojis from native browser support

---

<div align="center">

**⭐ Star this repo if it helped you explore your ChatGPT data!**

Made with ❤️ for data privacy and exploration

</div>
