# Database Infrastructure

This directory contains the database infrastructure for user authentication in the Data Dumpster Diver application.

## Structure

```
database/
├── init.js              # Database connection class
├── index.js             # Main database interface
├── setup.js             # Database initialization script
├── test-models.js       # Database model tests
├── models/
│   ├── user.js          # User model with CRUD operations
│   └── session.js       # Session model for user sessions
└── migrations/
    ├── migration.js     # Migration manager
    └── 001_initial_schema.js  # Initial schema migration
```

## Setup

1. **Initialize the database:**

   ```bash
   npm run db:init
   ```

2. **Run migrations (if needed):**

   ```bash
   npm run db:migrate
   ```

3. **Test the models:**

   ```bash
   node database/test-models.js
   ```

## Database Schema

### Users Table

- `id` - Primary key (auto-increment)
- `username` - Unique username (max 50 chars)
- `email` - Unique email address
- `password_hash` - Hashed password
- `created_at` - Account creation timestamp
- `last_login` - Last login timestamp

### User Sessions Table

- `id` - Primary key (auto-increment)
- `user_id` - Foreign key to users table
- `session_id` - Unique session identifier
- `created_at` - Session creation timestamp
- `expires_at` - Session expiration timestamp

### Migrations Table

- `id` - Primary key (auto-increment)
- `filename` - Migration filename
- `executed_at` - Migration execution timestamp

## Usage

### Database Connection

```javascript
import { getDatabase } from './database/index.js';

const db = await getDatabase();
// Use db for queries
await db.close();
```

### User Model

```javascript
import User from './database/models/user.js';

const user = new User();
const newUser = await user.create({
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashedpassword'
});
```

### Session Model

```javascript
import Session from './database/models/session.js';

const session = new Session();
const newSession = await session.create({
  userId: user.id,
  sessionId: 'session-123',
  expiresAt: '2024-12-31T23:59:59Z'
});
```

## Migration System

To add a new migration:

1. Create a new file in `database/migrations/` with format `XXX_description.js`
2. Export an `up` function that takes a database instance:

```javascript
export async function up(db) {
  const sql = `CREATE TABLE new_table (...)`;
  await db.run(sql);
}
```

3. Run `npm run db:migrate` to apply the migration

## Error Handling

All database operations throw descriptive errors:

- Unique constraint violations for duplicate usernames/emails
- Connection errors for database issues
- Validation errors for missing required fields

## Security Notes

- Passwords are never stored in plain text
- Use bcrypt or similar for password hashing
- Sessions have expiration times
- Database uses foreign key constraints for data integrity
