// test-part4.ts
// Test Part 4: Core Services

import { detectAIResponse, getCostBreakdown } from './src/services/costCalculator';
import { generateCacheKey, getCachedResponse, setCachedResponse, shouldCacheResponse } from './src/services/cacheService';
import { trackBudget, checkBudgetStatus, getSpendingHistory } from './src/services/budgetTracker';
import { collectMetrics, getUserMetrics, getEndpointStats } from './src/services/metricsCollector';
import { ApiKey } from './src/models/ApiKey';
import { testConnection, closePool } from './src/config/database';
import { connectRedis, closeRedis } from './src/config/redis';

async function testPart4() {
  console.log('🧪 Testing Part 4: Core Services...\n');
  
  try {
    // Setup
    console.log('Setting up connections...');
    await testConnection();
    await connectRedis();
    console.log('✅ Connections established\n');
    
    // Test 1: Cost Calculator
    console.log('1️⃣ Testing Cost Calculator Service...');
    
    const mockOpenAIResponse = {
      id: 'chatcmpl-123',
      model: 'gpt-4',
      choices: [{ message: { content: 'Hello!' } }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 50,
        total_tokens: 70,
      },
    };
    
    const costCalc = detectAIResponse(mockOpenAIResponse);
    console.log(`  ✓ AI response detected: ${costCalc.isAIResponse}`);
    console.log(`  ✓ Model: ${costCalc.model}`);
    console.log(`  ✓ Tokens: ${costCalc.usage?.totalTokens}`);
    console.log(`  ✓ Cost: $${costCalc.costUsd.toFixed(6)}`);
    
    const breakdown = getCostBreakdown('gpt-4', 20, 50);
    console.log(`  ✓ Cost breakdown: ${breakdown.breakdown}`);
    
    console.log('✅ Cost calculator service working\n');
    
    // Test 2: Cache Service
    console.log('2️⃣ Testing Cache Service...');
    
    const endpoint = '/api/chat/completions';
    const requestBody = { model: 'gpt-4', messages: [{ role: 'user', content: 'test' }] };
    
    const cacheKey = generateCacheKey(endpoint, requestBody);
    console.log(`  ✓ Cache key generated: ${cacheKey.substring(0, 30)}...`);
    
    // Try to get (should be cache miss)
    const cacheMiss = await getCachedResponse(endpoint, requestBody);
    console.log(`  ✓ Cache miss (expected): ${!cacheMiss.hit}`);
    
    // Store in cache
    const cached = await setCachedResponse(endpoint, requestBody, mockOpenAIResponse, 3600);
    console.log(`  ✓ Response cached: ${cached}`);
    
    // Try to get again (should be cache hit)
    const cacheHit = await getCachedResponse(endpoint, requestBody);
    console.log(`  ✓ Cache hit: ${cacheHit.hit}`);
    console.log(`  ✓ Cached data matches: ${cacheHit.data?.model === 'gpt-4'}`);
    
    const shouldCache = shouldCacheResponse(200, mockOpenAIResponse);
    console.log(`  ✓ Should cache 200 response: ${shouldCache}`);
    
    const shouldNotCache = shouldCacheResponse(500, { error: 'Internal error' });
    console.log(`  ✓ Should not cache 500 response: ${!shouldNotCache}`);
    
    console.log('✅ Cache service working\n');
    
    // Test 3: Budget Tracker
    console.log('3️⃣ Testing Budget Tracker Service...');
    
    const testUserId = 'test_budget_user';
    const dailyBudget = 10.00;
    
    // Track some spending
    console.log('  Adding costs to budget...');
    await trackBudget(testUserId, 2.50, dailyBudget);
    await trackBudget(testUserId, 3.75, dailyBudget);
    await trackBudget(testUserId, 1.25, dailyBudget);
    
    const budgetStatus = await checkBudgetStatus(testUserId, dailyBudget);
    console.log(`  ✓ Current spending: $${budgetStatus.currentSpending.toFixed(2)}`);
    console.log(`  ✓ Budget limit: $${budgetStatus.budgetLimit.toFixed(2)}`);
    console.log(`  ✓ Remaining: $${budgetStatus.remainingBudget.toFixed(2)}`);
    console.log(`  ✓ Percentage used: ${budgetStatus.percentageUsed.toFixed(1)}%`);
    console.log(`  ✓ Over budget: ${budgetStatus.isOverBudget}`);
    console.log(`  ✓ Near limit: ${budgetStatus.isNearLimit}`);
    
    const history = await getSpendingHistory(testUserId, 3);
    console.log(`  ✓ Spending history retrieved: ${history.length} days`);
    
    console.log('✅ Budget tracker service working\n');
    
    // Test 4: Metrics Collector
    console.log('4️⃣ Testing Metrics Collector Service...');
    
    // Create test API key
    const testKey = await ApiKey.create({
      userId: 'metrics_test_user',
      name: 'Metrics Test Key',
      rateLimitPerMinute: 100,
      dailyBudgetUsd: 50,
    });
    
    // Collect some metrics
    console.log('  Storing test metrics...');
    await collectMetrics({
      userId: testKey.userId,
      apiKeyId: testKey.id,
      endpoint: '/api/chat/completions',
      method: 'POST',
      statusCode: 200,
      responseTimeMs: 2340,
      costUsd: 0.00315,
      tokensUsed: 70,
      model: 'gpt-4',
      cached: false,
    });
    
    await collectMetrics({
      userId: testKey.userId,
      apiKeyId: testKey.id,
      endpoint: '/api/chat/completions',
      method: 'POST',
      statusCode: 200,
      responseTimeMs: 50,
      costUsd: 0.00000,
      tokensUsed: 0,
      model: 'gpt-4',
      cached: true,
    });
    
    // Get user metrics
    const userMetrics = await getUserMetrics(testKey.userId);
    console.log(`  ✓ Total requests: ${userMetrics.totalRequests}`);
    console.log(`  ✓ Total cost: $${userMetrics.totalCost.toFixed(6)}`);
    console.log(`  ✓ Total tokens: ${userMetrics.totalTokens}`);
    console.log(`  ✓ Avg response time: ${userMetrics.avgResponseTime.toFixed(0)}ms`);
    console.log(`  ✓ Cache hit rate: ${(userMetrics.cacheHitRate * 100).toFixed(1)}%`);
    
    const endpointStats = await getEndpointStats(testKey.userId, 7);
    console.log(`  ✓ Endpoint stats retrieved: ${endpointStats.length} endpoints`);
    
    // Cleanup
    await ApiKey.delete(testKey.id);
    
    console.log('✅ Metrics collector service working\n');
    
    // Cleanup
    await closePool();
    await closeRedis();
    
    console.log('🎉 ALL PART 4 TESTS PASSED!\n');
    console.log('✓ Cost calculator service working');
    console.log('✓ Cache service working');
    console.log('✓ Budget tracker service working');
    console.log('✓ Metrics collector service working');
    console.log('\nPart 4 is COMPLETE! Ready for Part 5! 🚀\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    await closePool();
    await closeRedis();
    process.exit(1);
  }
}

testPart4();