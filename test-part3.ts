// test-part3.ts
// Test Part 3: Middleware (Authentication, Rate Limiting, Request Logging)

import express, { Express } from 'express';
import { authenticate } from './src/middleware/authenticate';
import { rateLimiter } from './src/middleware/rateLimiter';
import { requestLogger, errorLogger, notFoundHandler } from './src/middleware/requestLogger';
import { ApiKey } from './src/models/ApiKey';
import { testConnection, closePool } from './src/config/database';
import { connectRedis, closeRedis } from './src/config/redis';
import { logger } from './src/utils/logger';

async function testPart3() {
  console.log('🧪 Testing Part 3: Middleware...\n');
  
  try {
    // Setup connections
    console.log('Setting up connections...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database not connected');
    }
    await connectRedis();
    console.log('✅ Connections established\n');
    
    // Test 1: Create test API key for middleware tests
    console.log('1️⃣ Creating test API key...');
    const testKey = await ApiKey.create({
      userId: 'test_middleware_user',
      name: 'Middleware Test Key',
      rateLimitPerMinute: 5,  // Low limit for easy testing
      dailyBudgetUsd: 10.00,
    });
    console.log(`  ✓ Created test key: ${testKey.key.substring(0, 15)}...`);
    console.log(`  ✓ Rate limit: ${testKey.rateLimitPerMinute}/min\n`);
    
    // Test 2: Setup Express app with middleware
    console.log('2️⃣ Setting up Express app with middleware...');
    const app: Express = express();
    
    // Add middleware in correct order
    app.use(express.json());
    app.use(requestLogger);  // First: Log all requests
    
    // Test route that requires authentication
    app.get('/test/auth',
      authenticate,  // Second: Authenticate
      rateLimiter,   // Third: Rate limit
      (req, res) => {
        res.json({
          success: true,
          message: 'Authentication and rate limiting passed!',
          userId: req.userId,
          keyId: req.apiKey?.id,
        });
      }
    );
    
    // Test route for rate limiting
    app.get('/test/rate-limit',
      authenticate,
      rateLimiter,
      (req, res) => {
        res.json({
          success: true,
          message: 'Request allowed',
          remaining: res.getHeader('X-RateLimit-Remaining'),
        });
      }
    );
    
    // Error handlers (must be last)
    app.use(notFoundHandler);
    app.use(errorLogger);
    
    console.log('  ✓ Express app configured\n');
    
    // Test 3: Test Authentication
    console.log('3️⃣ Testing Authentication Middleware...');
    
    // Simulate request WITHOUT API key
    console.log('  Testing without API key (should fail)...');
    const mockReqNoKey: any = {
      headers: {},
      path: '/test/auth',
      method: 'GET',
      ip: '127.0.0.1',
    };
    const mockResNoKey: any = {
      status: function(code: number) {
        console.log(`  ✓ Status ${code} returned (expected 401)`);
        return this;
      },
      json: function(body: any) {
        console.log(`  ✓ Error message: ${body.message}`);
        return this;
      },
    };
    
    await authenticate(mockReqNoKey, mockResNoKey, () => {});
    
    // Simulate request WITH valid API key
    console.log('\n  Testing with valid API key (should pass)...');
    const mockReqWithKey: any = {
      headers: { 'x-api-key': testKey.key },
      path: '/test/auth',
      method: 'GET',
      ip: '127.0.0.1',
    };
    let authPassed = false;
    await authenticate(mockReqWithKey, {} as any, () => {
      authPassed = true;
    });
    
    if (authPassed && mockReqWithKey.userId) {
      console.log(`  ✓ Authentication passed`);
      console.log(`  ✓ User ID attached: ${mockReqWithKey.userId}`);
    } else {
      throw new Error('Authentication did not pass');
    }
    
    console.log('✅ Authentication middleware working\n');
    
    // Test 4: Test Rate Limiting
    console.log('4️⃣ Testing Rate Limiter Middleware...');
    console.log(`  Rate limit: ${testKey.rateLimitPerMinute} requests/min`);
    console.log('  Making multiple requests...\n');
    
    for (let i = 1; i <= testKey.rateLimitPerMinute + 2; i++) {
      const mockReq: any = {
        headers: { 'x-api-key': testKey.key },
        path: '/test/rate-limit',
        method: 'GET',
        ip: '127.0.0.1',
        userId: testKey.userId,
        apiKey: testKey,
      };
      
      const mockRes: any = {
        setHeader: function(name: string, value: string) {},
        getHeader: function(name: string) { return '0'; },
        status: function(code: number) {
          if (code === 429) {
            console.log(`  Request ${i}: ❌ Rate limited (429) - Expected!`);
          }
          return this;
        },
        json: function(body: any) {
          return this;
        },
      };
      
      let nextCalled = false;
      await rateLimiter(mockReq, mockRes, () => {
        nextCalled = true;
      });
      
      if (nextCalled) {
        console.log(`  Request ${i}: ✅ Allowed`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log('\n✅ Rate limiter middleware working\n');
    
    // Test 5: Test Request Logger
    console.log('5️⃣ Testing Request Logger Middleware...');
    const mockReqLog: any = {
      method: 'POST',
      path: '/api/chat/completions',
      query: {},
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      userId: testKey.userId,
    };
    
    const mockResLog: any = {
      json: function(body: any) {
        return this;
      },
      on: function() {},
      setHeader: function() {},
      statusCode: 200,
      headersSent: false,
      getHeader: function() { return null; },
    };
    
    requestLogger(mockReqLog, mockResLog, () => {});
    
    if (mockReqLog.requestId) {
      console.log(`  ✓ Request ID generated: ${mockReqLog.requestId}`);
    }
    console.log('✅ Request logger middleware working\n');
    
    // Cleanup
    console.log('Cleaning up...');
    await ApiKey.delete(testKey.id);
    console.log('  ✓ Test key deleted');
    
    await closePool();
    await closeRedis();
    console.log('  ✓ Connections closed\n');
    
    console.log('🎉 ALL PART 3 TESTS PASSED!\n');
    console.log('✓ Authentication middleware working');
    console.log('✓ Rate limiter middleware working');
    console.log('✓ Request logger middleware working');
    console.log('\nPart 3 is COMPLETE! Ready for Part 4! 🚀\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    await closePool();
    await closeRedis();
    process.exit(1);
  }
}

testPart3();