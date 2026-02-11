// test-part2.ts
// Test Part 2: Logger, Pricing, and ApiKey model

import { logger } from './src/utils/logger';
import { calculateCost, getModelPricing, formatCost, getSupportedModels } from './src/utils/pricing';
import { ApiKey } from './src/models/ApiKey';
import { testConnection, closePool } from './src/config/database';

async function testPart2() {
  console.log('🧪 Testing Part 2: Utilities & Models...\n');
  
  try {
    // Test 1: Logger
    console.log('1️⃣ Testing Logger...');
    logger.info('Logger test', { testData: 'Hello' });
    logger.debug('Debug message (might not show if LOG_LEVEL=info)');
    logger.warn('Warning message', { warning: 'Test warning' });
    console.log('✅ Logger working\n');
    
    // Test 2: Pricing Calculator
    console.log('2️⃣ Testing Pricing Calculator...');
    
    const gpt4Pricing = getModelPricing('gpt-4');
    console.log('  GPT-4 pricing:', gpt4Pricing);
    
    const cost1 = calculateCost('gpt-4', 20, 50);
    console.log(`  Cost for 20 prompt + 50 completion tokens (GPT-4): ${formatCost(cost1)}`);
    
    const cost2 = calculateCost('gpt-3.5-turbo', 100, 100);
    console.log(`  Cost for 100 + 100 tokens (GPT-3.5): ${formatCost(cost2)}`);
    
    const models = getSupportedModels();
    console.log(`  Supported models: ${models.length} models`);
    console.log('✅ Pricing calculator working\n');
    
    // Test 3: Database Connection (needed for ApiKey tests)
    console.log('3️⃣ Testing Database Connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database not connected');
    }
    console.log('✅ Database connected\n');
    
    // Test 4: ApiKey Model
    console.log('4️⃣ Testing ApiKey Model...');
    
    // Create a test API key
    console.log('  Creating test API key...');
    const newKey = await ApiKey.create({
      userId: 'test_user_123',
      name: 'Test Key for Part 2',
      rateLimitPerMinute: 50,
      dailyBudgetUsd: 25.00,
    });
    console.log(`  ✓ Created key: ${newKey.key.substring(0, 10)}...`);
    console.log(`  ✓ User ID: ${newKey.userId}`);
    console.log(`  ✓ Rate limit: ${newKey.rateLimitPerMinute}/min`);
    console.log(`  ✓ Daily budget: $${newKey.dailyBudgetUsd}`);
    
    // Find the key we just created
    console.log('\n  Finding key by key string...');
    const foundKey = await ApiKey.findByKey(newKey.key);
    if (!foundKey) {
      throw new Error('Could not find key that was just created');
    }
    console.log(`  ✓ Found key: ${foundKey.name}`);
    
    // Update the key
    console.log('\n  Updating key...');
    const updatedKey = await ApiKey.update(newKey.id, {
      rateLimitPerMinute: 100,
      dailyBudgetUsd: 50.00,
    });
    console.log(`  ✓ Updated rate limit: ${updatedKey?.rateLimitPerMinute}/min`);
    console.log(`  ✓ Updated budget: $${updatedKey?.dailyBudgetUsd}`);
    
    // Get usage stats (will be empty since no requests yet)
    console.log('\n  Getting usage stats...');
    const stats = await ApiKey.getUsageStats(newKey.id, 7);
    console.log(`  ✓ Usage stats retrieved (${stats.length} days with data)`);
    
    // Clean up - delete the test key
    console.log('\n  Cleaning up test key...');
    await ApiKey.delete(newKey.id);
    console.log('  ✓ Test key deleted');
    
    console.log('\n✅ ApiKey model working\n');
    
    // Cleanup
    await closePool();
    
    console.log('🎉 ALL PART 2 TESTS PASSED!\n');
    console.log('✓ Logger utility working');
    console.log('✓ Pricing calculator working');
    console.log('✓ ApiKey model working');
    console.log('✓ Database operations successful');
    console.log('\nPart 2 is COMPLETE! Ready for Part 3! 🚀\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

testPart2();