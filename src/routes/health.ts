// src/routes/health.ts
// Purpose: Health check endpoint for monitoring

import { Router, Request, Response } from 'express';
import { testConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { config } from '../config/environment';

const router = Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '1.0.0',
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
});

/**
 * Detailed health check (includes dependencies)
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // Check database
    const dbHealthy = await testConnection();
    
    // Check Redis
    const redisHealthy = await testRedisConnection();
    
    // Check backend API keys configured
    const openAIConfigured = !!config.backends.openai;
    const anthropicConfigured = !!config.backends.anthropic;
    
    const allHealthy = dbHealthy && redisHealthy;
    
    const health = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '1.0.0',
      checks: {
        database: {
          status: dbHealthy ? 'up' : 'down',
          healthy: dbHealthy,
        },
        redis: {
          status: redisHealthy ? 'up' : 'down',
          healthy: redisHealthy,
        },
        backends: {
          openai: {
            configured: openAIConfigured,
            status: openAIConfigured ? 'configured' : 'not configured',
          },
          anthropic: {
            configured: anthropicConfigured,
            status: anthropicConfigured ? 'configured' : 'not configured',
          },
        },
      },
      features: {
        caching: config.features.caching,
        rateLimiting: config.features.rateLimiting,
        budgetAlerts: config.features.budgetAlerts,
        costTracking: config.features.costTracking,
      },
    };
    
    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
});

/**
 * Readiness check (for Kubernetes/Docker)
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await testConnection();
    const redisHealthy = await testRedisConnection();
    
    if (dbHealthy && redisHealthy) {
      res.json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Liveness check (for Kubernetes/Docker)
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple check - if the server can respond, it's alive
  res.json({ alive: true });
});

export default router;