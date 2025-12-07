# Extract Assets JSON Script

This script extracts `assetsJson` variables from chat.html files and saves them as `assets.json` in the session root directory.

## Usage

### Process all sessions

```bash
npm run extract-assets
# or
node extract-assets-json.js
```

### Process a specific session

```bash
node extract-assets-json.js <session-id>
```

## What it does

1. Scans all sessions in `data/sessions/`
2. Looks for `chat.html` files in `Test-Chat-Combine/` subdirectories
3. Extracts the `assetsJson` variable using regex pattern matching
4. Parses and validates the JSON content
5. Saves it as `assets.json` in the session root directory

## File Structure

The script expects this structure:

```text
data/sessions/{sessionId}/
├── Test-Chat-Combine/
│   └── chat.html          # Contains: var assetsJson = {...};
├── conversations/
└── assets.json            # Output file created by this script
```

## Features

- **Robust regex matching**: Handles both `var assetsJson = {...}` and `var assetsJson={...}` formats
- **Multi-line support**: Can extract very large JSON objects that span multiple lines
- **Error handling**: Gracefully handles missing files, invalid JSON, and other errors
- **Logging**: Provides detailed logging for debugging and monitoring
- **Session validation**: Only processes valid session IDs from sessions.json

## Output

The script creates an `assets.json` file in each session directory containing the extracted asset mapping. This mapping helps associate asset pointers (like `file-service://file-abc123`) with actual filenames.

## Example assets.json

```json
{
  "file-service://file-abc123": "file-abc123-image.jpg",
  "file-service://file-def456": "file-def456-audio.wav",
  "sediment://file_789": "user-123/file_789-sanitized.png"
}
```

## Error Handling

- Missing `chat.html` files are logged and skipped
- Invalid JSON is logged with error details
- File permission errors are caught and reported
- Script continues processing other sessions if one fails
