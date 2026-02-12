// src/services/cacheService.ts
// Purpose: Cache API responses in Redis to reduce costs

import { createHash } from 'crypto';
import { getCache, setCache, deleteCache } from '../config/redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface CacheResult {
  hit: boolean;
  data: any;
  key?: string;
}

/**
 * Generate cache key from request data
 */
export function generateCacheKey(endpoint: string, requestBody: any): string {
  // Create hash of request body for consistent cache keys
  const bodyHash = hashObject(requestBody);
  const sanitizedEndpoint = endpoint.replace(/\//g, '_');
  
  return `cache:${sanitizedEndpoint}:${bodyHash}`;
}

/**
 * Hash an object to create consistent cache keys
 */
function hashObject(obj: any): string {
  // Stringify and hash the object
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('md5').update(str).digest('hex').substring(0, 16);
}

/**
 * Get cached response
 */
export async function getCachedResponse(
  endpoint: string,
  requestBody: any
): Promise<CacheResult> {
  // Skip if caching is disabled
  if (!config.features.caching) {
    return { hit: false, data: null };
  }

  try {
    const cacheKey = generateCacheKey(endpoint, requestBody);
    const cached = await getCache(cacheKey);

    if (cached) {
      logger.debug('Cache hit', { endpoint, cacheKey });
      
      return {
        hit: true,
        data: JSON.parse(cached),
        key: cacheKey,
      };
    }

    logger.debug('Cache miss', { endpoint, cacheKey });
    
    return {
      hit: false,
      data: null,
      key: cacheKey,
    };
  } catch (error) {
    logger.error('Error getting cached response', error as Error, {
      endpoint,
    });
    
    return { hit: false, data: null };
  }
}

/**
 * Store response in cache
 */
export async function setCachedResponse(
  endpoint: string,
  requestBody: any,
  responseData: any,
  ttlSeconds?: number
): Promise<boolean> {
  // Skip if caching is disabled
  if (!config.features.caching) {
    return false;
  }

  try {
    const cacheKey = generateCacheKey(endpoint, requestBody);
    const ttl = ttlSeconds || config.features.cacheTTL;
    
    const serialized = JSON.stringify(responseData);
    const success = await setCache(cacheKey, serialized, ttl);

    if (success) {
      logger.debug('Response cached', {
        endpoint,
        cacheKey,
        ttl,
        size: serialized.length,
      });
    }

    return success;
  } catch (error) {
    logger.error('Error caching response', error as Error, {
      endpoint,
    });
    
    return false;
  }
}

/**
 * Invalidate cache for specific endpoint
 */
export async function invalidateCache(
  endpoint: string,
  requestBody?: any
): Promise<boolean> {
  try {
    if (requestBody) {
      // Invalidate specific cache entry
      const cacheKey = generateCacheKey(endpoint, requestBody);
      return await deleteCache(cacheKey);
    } else {
      // Would need to implement pattern-based deletion
      logger.warn('Pattern-based cache invalidation not implemented', {
        endpoint,
      });
      return false;
    }
  } catch (error) {
    logger.error('Error invalidating cache', error as Error, {
      endpoint,
    });
    
    return false;
  }
}

/**
 * Check if response should be cached
 * Some responses (errors, large payloads) should not be cached
 */
export function shouldCacheResponse(
  statusCode: number,
  responseBody: any,
  maxSizeBytes: number = 1024 * 100 // 100KB default
): boolean {
  // Don't cache errors
  if (statusCode >= 400) {
    return false;
  }

  // Don't cache if response is too large
  const size = JSON.stringify(responseBody).length;
  if (size > maxSizeBytes) {
    logger.debug('Response too large to cache', { size, maxSizeBytes });
    return false;
  }

  // Don't cache streaming responses
  if (responseBody.stream === true) {
    return false;
  }

  return true;
}

/**
 * Get cache statistics (for monitoring)
 */
export interface CacheStats {
  enabled: boolean;
  ttl: number;
  // Add more stats as needed (hit rate, etc.)
}

export function getCacheStats(): CacheStats {
  return {
    enabled: config.features.caching,
    ttl: config.features.cacheTTL,
  };
}