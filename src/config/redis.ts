// src/config/redis.ts
// Purpose: Redis client for caching, rate limiting, and pub/sub

import { createClient, RedisClientType } from 'redis';
import { config } from './environment';

// Create Redis client
export const redisClient: RedisClientType = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
  password: config.redis.password || undefined,
});

// Create separate Redis client for pub/sub (recommended by Redis)
export const redisPubClient: RedisClientType = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
  password: config.redis.password || undefined,
});

export const redisSubClient: RedisClientType = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
  password: config.redis.password || undefined,
});

// Connection event handlers
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✓ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✓ Redis client ready');
});

redisPubClient.on('error', (err) => {
  console.error('Redis Pub Client Error:', err);
});

redisSubClient.on('error', (err) => {
  console.error('Redis Sub Client Error:', err);
});

// Connect to Redis
export async function connectRedis(): Promise<void> {
  try {
    await Promise.all([
      redisClient.connect(),
      redisPubClient.connect(),
      redisSubClient.connect(),
    ]);
    console.log('✓ All Redis clients connected successfully');
  } catch (error) {
    console.error('✗ Failed to connect to Redis:', error);
    throw error;
  }
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    const pingResult = await redisClient.ping();
    console.log('✓ Redis connection test successful:', pingResult);
    return true;
  } catch (error) {
    console.error('✗ Redis connection test failed:', error);
    return false;
  }
}

// Close all Redis connections (for graceful shutdown)
export async function closeRedis(): Promise<void> {
  try {
    await Promise.all([
      redisClient.quit(),
      redisPubClient.quit(),
      redisSubClient.quit(),
    ]);
    console.log('✓ All Redis connections closed');
  } catch (error) {
    console.error('Error closing Redis connections:', error);
  }
}

// Helper functions for common Redis operations

/**
 * Get value from Redis
 */
export async function getCache(key: string): Promise<string | null> {
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error(`Error getting cache key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in Redis with optional TTL
 */
export async function setCache(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  try {
    if (ttlSeconds) {
      await redisClient.setEx(key, ttlSeconds, value);
    } else {
      await redisClient.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`Error setting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Delete key from Redis
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`Error deleting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Increment counter (for rate limiting)
 */
export async function incrementCounter(key: string): Promise<number> {
  try {
    return await redisClient.incr(key);
  } catch (error) {
    console.error(`Error incrementing counter ${key}:`, error);
    throw error;
  }
}

/**
 * Set expiration on key
 */
export async function setExpiration(key: string, seconds: number): Promise<boolean> {
  try {
    await redisClient.expire(key, seconds);
    return true;
  } catch (error) {
    console.error(`Error setting expiration on ${key}:`, error);
    return false;
  }
}

/**
 * Get multiple keys matching pattern
 */
export async function getKeysByPattern(pattern: string): Promise<string[]> {
  try {
    return await redisClient.keys(pattern);
  } catch (error) {
    console.error(`Error getting keys by pattern ${pattern}:`, error);
    return [];
  }
}

/**
 * Publish message to channel
 */
export async function publishMessage(channel: string, message: string): Promise<void> {
  try {
    await redisPubClient.publish(channel, message);
  } catch (error) {
    console.error(`Error publishing to channel ${channel}:`, error);
  }
}

/**
 * Subscribe to channel
 */
export async function subscribeToChannel(
  channel: string,
  callback: (message: string) => void
): Promise<void> {
  try {
    await redisSubClient.subscribe(channel, callback);
    console.log(`✓ Subscribed to channel: ${channel}`);
  } catch (error) {
    console.error(`Error subscribing to channel ${channel}:`, error);
  }
}

/**
 * Get Redis info
 */
export async function getRedisInfo(): Promise<any> {
  try {
    const info = await redisClient.info();
    return info;
  } catch (error) {
    console.error('Error getting Redis info:', error);
    return null;
  }
}