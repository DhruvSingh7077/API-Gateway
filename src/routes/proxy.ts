// src/routes/proxy.ts
// Purpose: Handle proxy requests with full pipeline (auth, rate limit, cache, forward, track)

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import { forwardRequest, detectBackend, normalizeEndpoint } from '../services/proxyService';
import { getCachedResponse, setCachedResponse, shouldCacheResponse } from '../services/cacheService';
import { detectAIResponse } from '../services/costCalculator';
import { trackBudget } from '../services/budgetTracker';
import { collectMetrics } from '../services/metricsCollector';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Main proxy handler - handles all AI API requests
 * Pipeline: Auth → Rate Limit → Cache Check → Forward → Track → Cache Store → Return
 */
router.all('/*', authenticate, rateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Get authenticated user info
    const userId = req.userId!;
    const apiKey = req.apiKey!;
    const endpoint = req.path;
    const method = req.method;
    
    logger.info('Proxy request received', {
      userId,
      endpoint,
      method,
    });
    
    // Step 1: Detect which backend to use
    const backend = detectBackend(endpoint);
    
    if (!backend) {
      logger.warn('Could not detect backend for endpoint', { endpoint });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Could not determine backend API for this endpoint',
      });
      return;
    }
    
    // Step 2: Check cache (if enabled)
    const cacheResult = await getCachedResponse(endpoint, req.body);
    
    if (cacheResult.hit) {
      const responseTime = Date.now() - startTime;
      
      logger.info('Cache hit - returning cached response', {
        userId,
        endpoint,
        responseTime,
      });
      
      // Track metrics for cached response
      await collectMetrics({
        userId,
        apiKeyId: apiKey.id,
        endpoint,
        method,
        statusCode: 200,
        responseTimeMs: responseTime,
        costUsd: 0, // Cache hits are free!
        tokensUsed: 0,
        model: cacheResult.data.model || null,
        cached: true,
      });
      
      // Add custom headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Request-Cost', '$0.00000');
      
      res.json(cacheResult.data);
      return;
    }
    
    // Step 3: Normalize endpoint for backend
    const normalizedEndpoint = normalizeEndpoint(endpoint, backend);
    
    // Step 4: Forward request to backend
    const proxyResponse = await forwardRequest({
      backend,
      endpoint: normalizedEndpoint,
      method,
      headers: req.headers as Record<string, string>,
      body: req.body,
    });
    
    const responseTime = Date.now() - startTime;
    
    // Step 5: Detect AI response and calculate cost
    const costInfo = detectAIResponse(proxyResponse.body);
    
    // Step 6: Track budget (if this is an AI request with cost)
    if (costInfo.isAIResponse && costInfo.costUsd > 0) {
      await trackBudget(userId, costInfo.costUsd, apiKey.dailyBudgetUsd);
    }
    
    // Step 7: Store metrics
    await collectMetrics({
      userId,
      apiKeyId: apiKey.id,
      endpoint,
      method,
      statusCode: proxyResponse.statusCode,
      responseTimeMs: responseTime,
      costUsd: costInfo.costUsd,
      tokensUsed: costInfo.usage?.totalTokens || 0,
      model: costInfo.model,
      cached: false,
    });
    
    // Step 8: Cache response (if appropriate)
    if (shouldCacheResponse(proxyResponse.statusCode, proxyResponse.body)) {
      await setCachedResponse(endpoint, req.body, proxyResponse.body);
    }
    
    // Step 9: Add custom headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Request-Cost', `$${costInfo.costUsd.toFixed(6)}`);
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    if (costInfo.usage) {
      res.setHeader('X-Tokens-Used', costInfo.usage.totalTokens.toString());
    }
    
    logger.info('Proxy request completed', {
      userId,
      endpoint,
      statusCode: proxyResponse.statusCode,
      responseTime,
      cost: costInfo.costUsd,
      cached: false,
    });
    
    // Step 10: Return response to client
    res.status(proxyResponse.statusCode).json(proxyResponse.body);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Proxy request failed', error as Error, {
      userId: req.userId,
      endpoint: req.path,
      responseTime,
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process proxy request',
    });
  }
});

export default router;