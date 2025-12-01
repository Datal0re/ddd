const { serializeSessions, deserializeSessions } = require('./utils/sessionUtils');

// Example usage:
(async () => {
  // Deserialize existing sessions
  const sessions = await deserializeSessions();
  
  // Add new session
  sessions.set('session123', { user: 'test', timestamp: Date.now() });
  
  // Serialize back to file
  await serializeSessions(sessions);
})();