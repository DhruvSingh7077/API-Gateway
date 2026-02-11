// src/middleware/rateLimiter.ts
// Purpose: Rate limiting using Redis sliding window algorithm

import { Request, Response, NextFunction } from 'express';
import { incrementCounter, setExpiration } from '../config/redis';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Rate limiter middleware
 * Uses Redis to track requests per user per minute
 */
export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip rate limiting if disabled in config
  if (!config.features.rateLimiting) {
    next();
    return;
  }
  
  try {
    // Get user info from authentication middleware
    const userId = req.userId || 'anonymous';
    const apiKey = req.apiKey;
    
    // Get rate limit for this user (from their API key, or use default)
    const rateLimit = apiKey?.rateLimitPerMinute || config.defaults.rateLimitPerMinute;
    
    // Generate Redis key for this user and current minute
    const currentMinute = new Date().toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
    const endpoint = req.path;
    const rateLimitKey = `rate_limit:${userId}:${endpoint}:${currentMinute}`;
    
    // Increment counter in Redis
    const requestCount = await incrementCounter(rateLimitKey);
    
    // Set expiration on first request (key will auto-delete after 60 seconds)
    if (requestCount === 1) {
      await setExpiration(rateLimitKey, 60);
    }
    
    // Calculate remaining requests
    const remaining = Math.max(0, rateLimit - requestCount);
    
    // Add rate limit headers to response
    res.setHeader('X-RateLimit-Limit', rateLimit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
    
    // Check if rate limit exceeded
    if (requestCount > rateLimit) {
      logger.warn('Rate limit exceeded', {
        userId,
        endpoint,
        requestCount,
        limit: rateLimit,
        keyId: apiKey?.id,
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${rateLimit} requests per minute.`,
        retryAfter: 60,
        limit: rateLimit,
        remaining: 0,
      });
      return;
    }
    
    logger.debug('Rate limit check passed', {
      userId,
      endpoint,
      requestCount,
      limit: rateLimit,
      remaining,
    });
    
    // Continue to next middleware
    next();
  } catch (error) {
    logger.error('Rate limiter error', error as Error, {
      path: req.path,
      userId: req.userId,
    });
    
    // On error, allow request but log the issue
    // This ensures rate limiter doesn't break the gateway
    next();
  }
}

/**
 * Burst rate limiter for expensive operations
 * Example: Limit to 10 requests per hour for specific endpoints
 */
export function burstRateLimiter(maxRequests: number, windowMinutes: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.features.rateLimiting) {
      next();
      return;
    }
    
    try {
      const userId = req.userId || 'anonymous';
      const endpoint = req.path;
      
      // Generate key for this window (e.g., YYYY-MM-DD:HH for hourly)
      const now = new Date();
      const windowStart = new Date(now.getTime() - (now.getTime() % (windowMinutes * 60 * 1000)));
      const windowKey = windowStart.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      
      const burstKey = `burst_limit:${userId}:${endpoint}:${windowKey}`;
      
      const requestCount = await incrementCounter(burstKey);
      
      if (requestCount === 1) {
        await setExpiration(burstKey, windowMinutes * 60);
      }
      
      if (requestCount > maxRequests) {
        logger.warn('Burst rate limit exceeded', {
          userId,
          endpoint,
          requestCount,
          limit: maxRequests,
          windowMinutes,
        });
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Burst limit exceeded. Maximum ${maxRequests} requests per ${windowMinutes} minutes.`,
          retryAfter: windowMinutes * 60,
        });
        return;
      }
      
      next();
    } catch (error) {
      logger.error('Burst rate limiter error', error as Error);
      next();
    }
  };
}