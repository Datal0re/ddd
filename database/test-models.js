import Database from './init.js';
import User from './models/user.js';
import Session from './models/session.js';

/**
 * Simple test script to verify database models work correctly
 */
async function testModels() {
  const db = new Database();
  
  try {
    await db.connect();
    console.log('✓ Database connected');
    
    const user = new User(db);
    const session = new Session(db);
    
    // Test user creation
    const testUser = await user.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    });
    console.log('✓ User created:', testUser.username);
    
    // Test user lookup
    const foundUser = await user.findByUsername('testuser');
    console.log('✓ User found by username:', foundUser.email);
    
    // Test session creation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const testSession = await session.create({
      userId: testUser.id,
      sessionId: 'test-session-123',
      expiresAt: expiresAt.toISOString()
    });
    console.log('✓ Session created for user:', testSession.username);
    
    // Test session lookup
    const foundSession = await session.findBySessionId('test-session-123');
    console.log('✓ Session found:', foundSession.username);
    
    // Cleanup
    await session.delete('test-session-123');
    await user.delete(testUser.id);
    console.log('✓ Cleanup completed');
    
    console.log('\n✅ All database model tests passed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    throw err;
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testModels();
}