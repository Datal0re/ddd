# DDD API Documentation

Complete API reference for the Data Dumpster Diver (DDD) application. All endpoints use the `/api/` prefix and run on port 3001 by default.

## Base Configuration

- **Base URL**: `http://localhost:3001/api`
- **Port**: Configurable via `API_PORT` environment variable (default: 3001)
- **Content-Type**: `application/json` for most endpoints
- **CORS**: Enabled for Electron communication

## Authentication

Currently, DDD does not require authentication for local development. All endpoints are accessible locally.

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "error": null
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "message": "Error occurred",
  "error": "Detailed error message"
}
```

## Endpoints

### System Health

#### `GET /health`

Check if the API server is running and healthy.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-08T12:00:00.000Z",
  "uptime": 3600
}
```

---

### File Upload & Processing

#### `POST /upload`

Upload and process a ChatGPT export ZIP file.

**Request:** `multipart/form-data`

- `file` (required): ZIP file containing ChatGPT export data

**Response:**

```json
{
  "success": true,
  "data": {
    "uploadId": "uuid-string",
    "sessionId": "session-uuid",
    "message": "Upload started successfully"
  }
}
```

**Security Limits:**

- Max file size: 500MB
- Max extracted size: 2GB
- Max compression ratio: 100:1
- Max files in ZIP: 10,000

#### `GET /upload/progress/:uploadId`

Get real-time upload progress status.

**Parameters:**

- `uploadId` (path): Upload identifier returned from `/upload`

**Response:**

```json
{
  "success": true,
  "data": {
    "uploadId": "uuid-string",
    "status": "processing|completed|error",
    "progress": 75,
    "stage": "Extracting conversations",
    "totalFiles": 150,
    "processedFiles": 112,
    "error": null
  }
}
```

#### `DELETE /upload/progress/:uploadId`

Cancel an active upload and clean up temporary files.

**Parameters:**

- `uploadId` (path): Upload identifier to cancel

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Upload cancelled and cleaned up"
  }
}
```

---

### Session Management

#### `GET /sessions`

List all available sessions.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "sessionId": "session-uuid",
      "createdAt": "2025-01-08T10:00:00.000Z",
      "conversationCount": 42,
      "status": "active",
      "size": "125.3 MB"
    }
  ]
}
```

#### `GET /sessions/:sessionId/conversations`

List all conversations for a specific session.

**Parameters:**

- `sessionId` (path): Session identifier

**Query Parameters:**

- `search` (optional): Filter conversations by title or content
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conversation-uuid",
        "title": "Conversation about AI",
        "createdAt": "2025-01-07T15:30:00.000Z",
        "messageCount": 15,
        "hasMedia": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    }
  }
}
```

#### `GET /sessions/:sessionId/conversations/:conversationId`

Get detailed conversation data including all messages.

**Parameters:**

- `sessionId` (path): Session identifier
- `conversationId` (path): Conversation identifier

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "conversation-uuid",
    "title": "Conversation about AI",
    "createdAt": "2025-01-07T15:30:00.000Z",
    "updatedAt": "2025-01-07T16:45:00.000Z",
    "messages": [
      {
        "id": "message-uuid",
        "role": "user|assistant",
        "content": "Message content with markdown",
        "timestamp": "2025-01-07T15:30:00.000Z",
        "hasMedia": false,
        "mediaFiles": []
      }
    ]
  }
}
```

#### `DELETE /sessions/:sessionId`

Delete a specific session and all associated data.

**Parameters:**

- `sessionId` (path): Session identifier to delete

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Session deleted successfully"
  }
}
```

#### `POST /sessions/cleanup`

Clean up old sessions based on age criteria.

**Request Body:**

```json
{
  "olderThan": "24h", // Options: "1h", "24h", "7d", "30d"
  "dryRun": false // Set to true to preview without deleting
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deletedSessions": 3,
    "freedSpace": "256.7 MB",
    "sessions": ["session-uuid-1", "session-uuid-2", "session-uuid-3"]
  }
}
```

---

## Error Codes

| Status Code | Description           | Common Causes                              |
| ----------- | --------------------- | ------------------------------------------ |
| 200         | Success               | Request completed successfully             |
| 400         | Bad Request           | Invalid parameters, malformed data         |
| 404         | Not Found             | Session, conversation, or upload not found |
| 413         | Payload Too Large     | File exceeds size limits                   |
| 422         | Unprocessable Entity  | Invalid file format or corrupted ZIP       |
| 500         | Internal Server Error | Server-side processing error               |

## Rate Limiting

Currently, no rate limiting is implemented for local development. In production deployments, consider implementing rate limiting for upload endpoints.

## WebSocket Events

DDD uses Server-Sent Events (SSE) for real-time progress updates during file upload.

### Connecting to Progress Stream

```javascript
const eventSource = new EventSource(
  'http://localhost:3001/api/upload/progress/:uploadId/stream'
);

eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log('Progress update:', data);
};
```

### Event Types

- `progress`: General progress updates
- `stage`: Stage changes during processing
- `error`: Error occurrences
- `complete`: Upload completion

## Development Usage

### Testing Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# List sessions
curl http://localhost:3001/api/sessions

# Upload file (requires multipart form data)
curl -X POST -F "file=@export.zip" http://localhost:3001/api/upload
```

### Environment Variables

```bash
# API server port
API_PORT=3001

# File upload limits (in bytes)
MAX_UPLOAD_SIZE=524288000  # 500MB
MAX_EXTRACTED_SIZE=2147483648  # 2GB
```

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class DDDClient {
  constructor(baseURL = 'http://localhost:3001/api') {
    this.client = axios.create({ baseURL });
  }

  async getSessions() {
    const response = await this.client.get('/sessions');
    return response.data;
  }

  async getConversation(sessionId, conversationId) {
    const response = await this.client.get(
      `/sessions/${sessionId}/conversations/${conversationId}`
    );
    return response.data;
  }

  async uploadFile(filePath) {
    const FormData = require('form-data');
    const fs = require('fs');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await this.client.post('/upload', form, {
      headers: form.getHeaders(),
    });
    return response.data;
  }
}
```

### Python

```python
import requests

class DDDClient:
    def __init__(self, base_url="http://localhost:3001/api"):
        self.base_url = base_url

    def get_sessions(self):
        response = requests.get(f"{self.base_url}/sessions")
        return response.json()

    def get_conversation(self, session_id, conversation_id):
        response = requests.get(f"{self.base_url}/sessions/{session_id}/conversations/{conversation_id}")
        return response.json()

    def upload_file(self, file_path):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(f"{self.base_url}/upload", files=files)
        return response.json()
```

For more technical details about the architecture and implementation, see [ARCHITECTURE.md](./ARCHITECTURE.md).
