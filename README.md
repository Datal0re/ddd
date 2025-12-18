# Data Dumpster Diver (CLI)

A bare-bones CLI tool to process and explore exported ChatGPT conversation data.

## Installation

```bash
# Clone repository
git clone <repository-url>
cd data-dumpster-diver

# Install dependencies
npm install

# Make CLI globally available
npm link
```

## Usage

```bash
# Upload and process a ChatGPT export ZIP
ddd upload path/to/chatgpt-export.zip --name "my-conversations"

# List all processed exports
ddd list

# View conversations in an export
ddd view my-conversations --limit 5

# Migrate old conversations.json format
ddd migrate data/conversations.json
```

## Commands

### `ddd upload <file>`

Process a ChatGPT export ZIP file.

**Options:**

- `-n, --name <name>` - Custom name for export (default: "default")
- `-v, --verbose` - Verbose output

### `ddd list`

List all processed exports.

**Options:**

- `-v, --verbose` - Show detailed information

### `ddd view <export-name>`

View conversations in an export.

**Options:**

- `-l, --limit <number>` - Number of conversations to show (default: 10)

### `ddd migrate [file]`

Migrate old conversations.json format to new export format.

**Arguments:**

- `file` - Path to conversations.json file (default: "data/conversations.json")

## Development

```bash
# Start CLI in development mode
npm run dev

# Run linter
npm run lint

# Format code
npm run format
```

## Core Functionality

- **ZIP Processing**: Extracts and processes ChatGPT export ZIP files
- **Conversation Parsing**: Splits giant conversations.json into individual conversations
- **Asset Extraction**: Extracts media and images from chat.html
- **Simple Viewing**: List and browse conversation metadata via CLI

## Project Structure

```
├── cli.js              # Main CLI entry point
├── utils/              # Core processing logic
│   ├── ExportManager.js # Export lifecycle management
│   ├── fileUtils.js     # File operations and validation
│   └── logger.js       # Logging utilities
├── data/               # Data processing scripts
└── scripts/            # Maintenance scripts
```

## License

MIT
