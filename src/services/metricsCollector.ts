// src/services/metricsCollector.ts
// Purpose: Collect and store request metrics in PostgreSQL

import { query } from '../config/database';
import { publishMessage } from '../config/redis';
import { logger } from '../utils/logger';

export interface RequestMetrics {
  userId: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  costUsd: number;
  tokensUsed: number;
  model: string | null;
  cached: boolean;
}

/**
 * Store request metrics in PostgreSQL
 */
export async function storeRequestMetrics(metrics: RequestMetrics): Promise<boolean> {
  try {
    await query(
      `INSERT INTO requests (
        user_id,
        api_key_id,
        endpoint,
        method,
        status_code,
        response_time_ms,
        cost_usd,
        tokens_used,
        model,
        cached,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        metrics.userId,
        metrics.apiKeyId,
        metrics.endpoint,
        metrics.method,
        metrics.statusCode,
        metrics.responseTimeMs,
        metrics.costUsd,
        metrics.tokensUsed,
        metrics.model,
        metrics.cached,
      ]
    );

    logger.debug('Request metrics stored', {
      userId: metrics.userId,
      endpoint: metrics.endpoint,
      cost: metrics.costUsd,
      cached: metrics.cached,
    });

    return true;
  } catch (error) {
    logger.error('Error storing request metrics', error as Error, {
      userId: metrics.userId,
      endpoint: metrics.endpoint,
    });
    return false;
  }
}

/**
 * Publish real-time metrics update to dashboard
 */
export async function publishMetricsUpdate(metrics: RequestMetrics): Promise<void> {
  try {
    const update = {
      type: 'request',
      timestamp: new Date().toISOString(),
      userId: metrics.userId,
      endpoint: metrics.endpoint,
      method: metrics.method,
      statusCode: metrics.statusCode,
      responseTime: metrics.responseTimeMs,
      cost: metrics.costUsd,
      tokens: metrics.tokensUsed,
      model: metrics.model,
      cached: metrics.cached,
    };

    await publishMessage('dashboard:updates', JSON.stringify(update));

    logger.debug('Metrics update published', {
      userId: metrics.userId,
      endpoint: metrics.endpoint,
    });
  } catch (error) {
    logger.error('Error publishing metrics update', error as Error, {
      userId: metrics.userId,
    });
  }
}

/**
 * Collect and store all metrics (convenience function)
 */
export async function collectMetrics(metrics: RequestMetrics): Promise<void> {
  // Store in database
  await storeRequestMetrics(metrics);
  
  // Publish to dashboard
  await publishMetricsUpdate(metrics);
}

/**
 * Get aggregated metrics for a user
 */
export async function getUserMetrics(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  avgResponseTime: number;
  cacheHitRate: number;
}> {
  try {
    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(AVG(response_time_ms), 0) as avg_response_time,
        COALESCE(SUM(CASE WHEN cached THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0), 0) as cache_hit_rate
       FROM requests
       ${whereClause}`,
      params
    );

    const row = result.rows[0];

    return {
      totalRequests: parseInt(row.total_requests, 10),
      totalCost: parseFloat(row.total_cost),
      totalTokens: parseInt(row.total_tokens, 10),
      avgResponseTime: parseFloat(row.avg_response_time),
      cacheHitRate: parseFloat(row.cache_hit_rate),
    };
  } catch (error) {
    logger.error('Error getting user metrics', error as Error, {
      userId,
    });

    return {
      totalRequests: 0,
      totalCost: 0,
      totalTokens: 0,
      avgResponseTime: 0,
      cacheHitRate: 0,
    };
  }
}

/**
 * Get endpoint statistics
 */
export async function getEndpointStats(
  userId: string,
  days: number = 7
): Promise<Array<{
  endpoint: string;
  requestCount: number;
  totalCost: number;
  avgResponseTime: number;
}>> {
  try {
    const result = await query(
      `SELECT 
        endpoint,
        COUNT(*) as request_count,
        SUM(cost_usd) as total_cost,
        AVG(response_time_ms) as avg_response_time
       FROM requests
       WHERE user_id = $1 
         AND timestamp > NOW() - INTERVAL '${days} days'
       GROUP BY endpoint
       ORDER BY total_cost DESC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      requestCount: parseInt(row.request_count, 10),
      totalCost: parseFloat(row.total_cost),
      avgResponseTime: parseFloat(row.avg_response_time),
    }));
  } catch (error) {
    logger.error('Error getting endpoint stats', error as Error, {
      userId,
      days,
    });
    return [];
  }
}

/**
 * Get model usage statistics
 */
export async function getModelStats(
  userId: string,
  days: number = 7
): Promise<Array<{
  model: string;
  requestCount: number;
  totalCost: number;
  totalTokens: number;
}>> {
  try {
    const result = await query(
      `SELECT 
        model,
        COUNT(*) as request_count,
        SUM(cost_usd) as total_cost,
        SUM(tokens_used) as total_tokens
       FROM requests
       WHERE user_id = $1 
         AND timestamp > NOW() - INTERVAL '${days} days'
         AND model IS NOT NULL
       GROUP BY model
       ORDER BY total_cost DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      model: row.model,
      requestCount: parseInt(row.request_count, 10),
      totalCost: parseFloat(row.total_cost),
      totalTokens: parseInt(row.total_tokens, 10),
    }));
  } catch (error) {
    logger.error('Error getting model stats', error as Error, {
      userId,
      days,
    });
    return [];
  }
}

/**
 * Get daily spending trend
 */
export async function getDailySpendingTrend(
  userId: string,
  days: number = 30
): Promise<Array<{
  date: string;
  requests: number;
  cost: number;
  tokens: number;
}>> {
  try {
    const result = await query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as requests,
        SUM(cost_usd) as cost,
        SUM(tokens_used) as tokens
       FROM requests
       WHERE user_id = $1 
         AND timestamp > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      date: row.date,
      requests: parseInt(row.requests, 10),
      cost: parseFloat(row.cost),
      tokens: parseInt(row.tokens, 10),
    }));
  } catch (error) {
    logger.error('Error getting daily spending trend', error as Error, {
      userId,
      days,
    });
    return [];
  }
}