/**
 * Initial migration to create users and user_sessions tables
 */
export async function up(db) {
  // Create users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `;
  await db.run(createUsersTable);

  // Create user_sessions table
  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id VARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;
  await db.run(createSessionsTable);

  // Create indexes for better performance
  await db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)');
}