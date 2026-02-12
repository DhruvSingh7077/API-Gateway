// src/routes/admin.ts
// Purpose: Admin API routes for managing API keys and viewing analytics

import { Router, Request, Response } from 'express';
import { ApiKey } from '../models/ApiKey';
import { getUserMetrics, getEndpointStats, getModelStats, getDailySpendingTrend } from '../services/metricsCollector';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Admin authentication middleware
 */
function adminAuth(req: Request, res: Response, next: Function): void {
  const adminKey = req.headers['x-admin-key'] as string;
  
  if (!adminKey || adminKey !== config.adminApiKey) {
    logger.warn('Unauthorized admin access attempt', {
      ip: req.ip,
      path: req.path,
    });
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin API key',
    });
    return;
  }
  
  next();
}

// Apply admin auth to all routes
router.use(adminAuth);

/**
 * Create new API key
 * POST /admin/keys
 */
router.post('/keys', async (req: Request, res: Response) => {
  try {
    const { userId, name, rateLimitPerMinute, dailyBudgetUsd } = req.body;
    
    if (!userId || !name) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'userId and name are required',
      });
      return;
    }
    
    const apiKey = await ApiKey.create({
      userId,
      name,
      rateLimitPerMinute,
      dailyBudgetUsd,
    });
    
    logger.info('API key created', {
      keyId: apiKey.id,
      userId: apiKey.userId,
      name: apiKey.name,
    });
    
    res.status(201).json({
      success: true,
      apiKey: {
        id: apiKey.id,
        key: apiKey.key,
        userId: apiKey.userId,
        name: apiKey.name,
        rateLimitPerMinute: apiKey.rateLimitPerMinute,
        dailyBudgetUsd: apiKey.dailyBudgetUsd,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error creating API key', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create API key',
    });
  }
});

/**
 * List all API keys
 * GET /admin/keys
 */
router.get('/keys', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const keys = await ApiKey.list(limit, offset);
    const total = await ApiKey.count();
    
    res.json({
      success: true,
      data: keys,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    logger.error('Error listing API keys', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list API keys',
    });
  }
});

/**
 * Get API key by ID
 * GET /admin/keys/:id
 */
router.get('/keys/:id', async (req: Request, res: Response) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);
    
    if (!apiKey) {
      res.status(404).json({
        error: 'Not Found',
        message: 'API key not found',
      });
      return;
    }
    
    res.json({
      success: true,
      apiKey,
    });
  } catch (error) {
    logger.error('Error getting API key', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get API key',
    });
  }
});

/**
 * Update API key
 * PATCH /admin/keys/:id
 */
router.patch('/keys/:id', async (req: Request, res: Response) => {
  try {
    const { name, rateLimitPerMinute, dailyBudgetUsd, isActive } = req.body;
    
    const apiKey = await ApiKey.update(req.params.id, {
      name,
      rateLimitPerMinute,
      dailyBudgetUsd,
      isActive,
    });
    
    if (!apiKey) {
      res.status(404).json({
        error: 'Not Found',
        message: 'API key not found',
      });
      return;
    }
    
    logger.info('API key updated', {
      keyId: apiKey.id,
      userId: apiKey.userId,
    });
    
    res.json({
      success: true,
      apiKey,
    });
  } catch (error) {
    logger.error('Error updating API key', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update API key',
    });
  }
});

/**
 * Delete API key (soft delete)
 * DELETE /admin/keys/:id
 */
router.delete('/keys/:id', async (req: Request, res: Response) => {
  try {
    const success = await ApiKey.delete(req.params.id);
    
    if (!success) {
      res.status(404).json({
        error: 'Not Found',
        message: 'API key not found',
      });
      return;
    }
    
    logger.info('API key deleted', { keyId: req.params.id });
    
    res.json({
      success: true,
      message: 'API key deleted',
    });
  } catch (error) {
    logger.error('Error deleting API key', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete API key',
    });
  }
});

/**
 * Get user metrics
 * GET /admin/users/:userId/metrics
 */
router.get('/users/:userId/metrics', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    
    const metrics = await getUserMetrics(userId);
    const endpointStats = await getEndpointStats(userId, days);
    const modelStats = await getModelStats(userId, days);
    const spendingTrend = await getDailySpendingTrend(userId, days);
    
    res.json({
      success: true,
      userId,
      period: `Last ${days} days`,
      metrics,
      endpointStats,
      modelStats,
      spendingTrend,
    });
  } catch (error) {
    logger.error('Error getting user metrics', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user metrics',
    });
  }
});

/**
 * Get API key usage statistics
 * GET /admin/keys/:id/usage
 */
router.get('/keys/:id/usage', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await ApiKey.getUsageStats(req.params.id, days);
    
    res.json({
      success: true,
      keyId: req.params.id,
      period: `Last ${days} days`,
      stats,
    });
  } catch (error) {
    logger.error('Error getting API key usage', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get usage statistics',
    });
  }
});

export default router;