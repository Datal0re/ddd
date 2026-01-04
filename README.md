<h1 align="center">Data Dumpster Diver</h1>
<p align="center">
  <a href="https://github.com/Datal0re/ddd">
  <picture>
    <img src="./ddd-logo.png" alt="ddd logo">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/Datal0re/ddd"><img src="https://img.shields.io/badge/version-0.1.6-blue.svg" alt="version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="license"></a>
  <a href="https://www.npmjs.com/package/@datal0re/ddd"><img src="https://img.shields.io/badge/npm-v0.1.6-brightgreen.svg" alt="npm"></a>
</p>

---

Data Dumpster Diver (ddd) is your raccoon-powered[^1] solution for ChatGPT data exports—whether you want to dive deep or get it done fast.

Need a quick fix? Run `ddd dump` and `ddd upcycle` to transform your messy ZIP into a clean export in seconds.

Want to explore? Let the raccoons sort your data with `ddd dump`, then `rummage` through chats, drop finds into bins, and `upcycle` what you need. It’s a full dumpster-diving rabbit hole if you want it to be.

No more UID nightmares, 50MB headers, or guessing which file is which. ddd handles the mess so you can focus on what matters—your data, your way. 🦝

[^1]: _Actually powered by Nodejs. The raccoons are still taking typing lessons._

---

## Why Use Data Dumpster Diver?

- **Account Migration:** Seamlessly export conversations from one OpenAI account and import them into another while preserving context.
- **Knowledge Management:** Create personal knowledge bases by upcycling your ChatGPT data into Markdown that integrates directly with tools like Obsidian (complete with YAML metadata).
- **Content Creation:** Export your conversations as HTML or Markdown for blog posts, documentation, and sharing—with all assets correctly embedded.
- **Data Backup:** Preserve your conversation history in an organized, searchable format outside the ephemeral ChatGPT ecosystem.
- **Research Processing:** Easily extract and organize chat data for model training, analysis, or research purposes.

---

## Getting Started

Before diving in, ensure you have your ChatGPT export on hand. If it isn’t already a ZIP file, grab one from [OpenAI’s help page](https://help.openai.com/en/articles/72-60999).

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Datal0re/ddd.git && cd ddd
npm install
npm link  # Optional: Make the CLI globally available
```

For alternative package managers:

```bash
npm install -g @datal0re/ddd         # via npm
brew install datal0re/ddd            # via Homebrew (Mac/Linux)
```

## Quick Start

There are two ways to launch ddd:

1. **Interactive Mode (Wizard):**
   Simply run the command without arguments and follow the prompts:

   ```bash
   ddd dump  # Launches the wizard: feed in your ZIP export file and follow steps.
   ```

2. **Non-Interactive Mode:**
   Pass your ZIP file and options directly:

   ```bash
   ddd dump /path/to/chatgpt-export.zip --name "my-chats"
   ```

**Speedy One-Liner (For the Impatient):**  
If you want to be super speedy, run something like this in one go:

```bash
ddd dump /path/to/chatgpt-export.zip -n "old-chats" && ddd upcycle md old-chats -o /path/to/obsidian-vault
```

This command:

- Unpacks and organizes your ZIP export (`ddd dump`).
- Immediately exports the sorted data as Markdown to an Obsidian vault (`ddd upcycle`).

## Command Overview

### 1. `ddd dump`

- **What it does:**
  Hand over your messy trash bag (the ZIP export) and let the raccoons do their magic. They decompress, parse, and sort your data into a neatly organized dumpster—a directory where each chat file is given a clear name, timestamp, and media mappings.
- **Usage:**

  ```bash
  ddd dump <path-to-zip> [options]
  # or launch interactive mode:
  ddd dump
  ```

- **Options:**
  `-n, --name <name>`: Assign a custom name for the dumpster.
  `-v, --verbose`: Display detailed processing information.

### 2. `ddd hoard`

- **What it does:**
  Peek at your collection of dumpsters (organized chats). This command lists all processed dungeons and any bins you have along with helpful statistics.
- **Usage:**

  ```bash
  ddd hoard [options]
  ```

- **Options:**
  `-v, --verbose`: Show detailed statistics.

### 3. `ddd rummage`

- **What it does:**
  Once your dumpster is sorted, use this command to search through the data. Think of it as rummaging through a well-organized trash bag—filter by content or title and select conversations (which are then added to a temporary bin).
- **Usage:**

  ```bash
  ddd rummage [dumpster-name] [options]
  # or for the full wizard experience:
  ddd rummage
  ```

- **Features:**
  - Persistent selection bins for later export.
  - Multi-select interface to build your “basket” of chats.

### 4. `ddd upcycle`

- **What it does:**
  Transform your messy input into a clean export. Choose from formats like `txt`, `md`, or `html`. Whether you want to archive an entire dumpster or just the contents of a bin, upcycle gives you flexibility.
- **Usage:**

  ```bash
  ddd upcycle <format> <dumpster-name> [options]
  # or launch interactive mode:
  ddd upcycle
  ```

- **Options:**
  `-o, --output <path>`: Specify the output location.
  `--include-media`: Copy over corresponding media assets.
  `--self-contained`: Generate a standalone export file.

### 5. `ddd bin`

- **What it does:**
  Manage your selection bins—temporary baskets where you can store chats that caught your eye during a rummage. Use bins to keep track of selected conversations for later export or further processing.
- **Usage:**

  ```bash
  ddd bin create <name>       # Create a new bin.
  ddd bin list                 # List all bins.
  ddd bin rename <old> <new>   # Rename a bin.
  ddd bin empty <name>         # Clear the contents of a bin.
  ddd bin burn <name>          # Permanently delete a bin.
  ```

### 6. `ddd burn`

- **What it does:**
  When you’re finished with a dumpster (or just want to reclaim space), burn it to safely delete your data. Note that burning a bin only clears the temporary selection—destroying an entire dumpster permanently deletes all its contents.
- **Usage:**

  ```bash
  ddd burn <dumpster-name> [options]
  # or launch interactive mode:
  ddd burn
  ```

- **Options:**
  `-f, --force`: Skip confirmation steps.
  `--dry-run`: Preview what will be deleted.

---

## Data Organization

After processing, your data is stored in a clear, logical structure:

```plaintext
data/
├── dumpsters/          # Each dumpster is an organized collection
│   └── {name}/
│       ├── chats/      # Individual conversation files with human-friendly names and timestamps
│       └── media/      # Extracted assets (images, videos, audio) mapped from the original ZIP
├── bins.json          # Metadata for your temporary selection bins
├── dumpsters.json     # Registry of all processed dumpsters
└── temp/              # Temporary files (auto-cleaned after processing)
```

## Security

Data Dumpster Diver implements several security measures:

- **Private:** Your data never leaves your local machine.
- **Backup Protection:** The original ZIP file is not harmed during this process. As long as you keep your ZIP as a backup somewhere, you can use it to generate dumpsters forever!
- **Path Traversal Protection:** Prevents malicious file paths from being processed.
- **ZIP Bomb Protection:** Validates compression ratios and enforces size limits (500MB import, 2GB extracted).
- **Multistep Confirmations:** Requires explicit confirmation for destructive operations.
- **Input Validation:** Checks and sanitizes all user inputs.

## Testing

`ddd` uses a shell-based test suite to validate CLI behavior via synthetic ChatGPT export data:

```bash
npm test                # Main test suite.
npm run test:basic      # Basic functionality checks.
npm run test:workflows   # End-to-end workflow tests.
npm run test:integration # Wizard workflow testing.
npm run test:with-logs   # Tests with detailed output for debugging.

# Additional test utilities:
npm run test:setup       # Generate synthetic test data.
npm run test:cleanup     # Remove test artifacts after runs.
```

## Requirements

- **Node.js:** Version 14.0.0 or higher.
- **Key Dependencies:** @inquirer/prompts, commander, decompress, chalk, ora.
- **Supported Platforms:** macOS, Linux, and Windows (with WSL recommended).

## Contributing

Contributions are welcome! Please follow these steps:

1. Read the [Development Guide](AGENTS.md) for architecture, setup, and contribution guidelines.
2. Use ESLint and Prettier to maintain a consistent code style.
3. Add comprehensive tests for any new features or changes.
4. Ensure that all interactive prompts and CLI behaviors work as expected.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Links

- **[Development Guide]** - Architecture, setup, and how to contribute: [AGENTS.md](AGENTS.md)
- **[Changelog]** - Version history and feature evolution: [CHANGELOG.md](CHANGELOG.md)
- **[Issues]** - Report bugs or request features: [https://github.com/Datal0re/ddd/issues](https://github.com/Datal0re/ddd/issues)
