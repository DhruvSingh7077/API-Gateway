// test-part1.ts
import { validateConfig } from './src/config/environment';
import { testConnection, closePool } from './src/config/database';
import { connectRedis, testRedisConnection, closeRedis } from './src/config/redis';

async function test() {
  console.log('🧪 Testing Part 1 Setup...\n');
  
  try {
    // Test 1: Environment Configuration
    console.log('1️⃣ Testing environment configuration...');
    validateConfig();
    console.log('✅ Environment configuration valid\n');
    
    // Test 2: PostgreSQL Connection
    console.log('2️⃣ Testing PostgreSQL connection...');
    const dbSuccess = await testConnection();
    if (!dbSuccess) {
      throw new Error('Database connection failed');
    }
    console.log('✅ PostgreSQL connected\n');
    
    // Test 3: Redis Connection
    console.log('3️⃣ Testing Redis connection...');
    await connectRedis();
    const redisSuccess = await testRedisConnection();
    if (!redisSuccess) {
      throw new Error('Redis connection failed');
    }
    console.log('✅ Redis connected\n');
    
    // Cleanup
    await closePool();
    await closeRedis();
    
    console.log('🎉 ALL PART 1 TESTS PASSED!\n');
    console.log('✓ Environment configuration working');
    console.log('✓ PostgreSQL connected');
    console.log('✓ Redis connected');
    console.log('✓ Database tables created');
    console.log('\nYou are ready for Part 2! 🚀\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure Docker Desktop is running');
    console.error('  2. Run: docker-compose up -d postgres redis');
    console.error('  3. Check: docker-compose ps (both should be "Up")');
    console.error('  4. Verify your .env file has correct values\n');
    process.exit(1);
  }
}

test();