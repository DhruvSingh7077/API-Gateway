// src/models/ApiKey.ts
// Purpose: API key data model and database operations

import { query } from '../config/database';
import { randomBytes } from 'crypto';

export interface ApiKeyData {
  id: string;
  key: string;
  userId: string;
  name: string;
  rateLimitPerMinute: number;
  dailyBudgetUsd: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export class ApiKey {
  /**
   * Generate a secure random API key
   */
  private static generateKey(): string {
    const prefix = 'gw'; // gateway prefix
    const randomPart = randomBytes(24).toString('hex'); // 48 characters
    return `${prefix}_${randomPart}`;
  }

  /**
   * Create a new API key
   */
  static async create(data: {
    userId: string;
    name: string;
    rateLimitPerMinute?: number;
    dailyBudgetUsd?: number;
  }): Promise<ApiKeyData> {
    const key = this.generateKey();
    
    const result = await query<ApiKeyData>(
      `INSERT INTO api_keys (key, user_id, name, rate_limit_per_minute, daily_budget_usd)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        key,
        data.userId,
        data.name,
        data.rateLimitPerMinute || 100,
        data.dailyBudgetUsd || 50.00,
      ]
    );
    
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find API key by key string
   */
  static async findByKey(key: string): Promise<ApiKeyData | null> {
    const result = await query<ApiKeyData>(
      'SELECT * FROM api_keys WHERE key = $1 AND is_active = true',
      [key]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find API key by ID
   */
  static async findById(id: string): Promise<ApiKeyData | null> {
    const result = await query<ApiKeyData>(
      'SELECT * FROM api_keys WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find all API keys for a user
   */
  static async findByUserId(userId: string): Promise<ApiKeyData[]> {
    const result = await query<ApiKeyData>(
      'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Update API key settings
   */
  static async update(
    id: string,
    data: {
      name?: string;
      rateLimitPerMinute?: number;
      dailyBudgetUsd?: number;
      isActive?: boolean;
    }
  ): Promise<ApiKeyData | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    
    if (data.rateLimitPerMinute !== undefined) {
      updates.push(`rate_limit_per_minute = $${paramIndex++}`);
      values.push(data.rateLimitPerMinute);
    }
    
    if (data.dailyBudgetUsd !== undefined) {
      updates.push(`daily_budget_usd = $${paramIndex++}`);
      values.push(data.dailyBudgetUsd);
    }
    
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await query<ApiKeyData>(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRow(result.rows[0]);
  }

  /**
   * Delete API key (soft delete by marking inactive)
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Hard delete API key (permanent)
   */
  static async hardDelete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM api_keys WHERE id = $1',
      [id]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get usage statistics for an API key
   */
  static async getUsageStats(keyId: string, days: number = 7): Promise<any> {
    const result = await query(
      `SELECT 
        COUNT(*) as total_requests,
        SUM(cost_usd) as total_cost,
        SUM(tokens_used) as total_tokens,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN cached THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate,
        DATE(timestamp) as date
       FROM requests
       WHERE api_key_id = $1 
         AND timestamp > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`,
      [keyId]
    );
    
    return result.rows;
  }

  /**
   * Get today's spending for an API key
   */
  static async getTodaySpending(keyId: string): Promise<number> {
    const result = await query(
      `SELECT COALESCE(SUM(cost_usd), 0) as today_spending
       FROM requests
       WHERE api_key_id = $1 
         AND DATE(timestamp) = CURRENT_DATE`,
      [keyId]
    );
    
    return parseFloat(result.rows[0].today_spending);
  }

  /**
   * Get request count for current minute (for rate limiting check)
   */
  static async getMinuteRequestCount(keyId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM requests
       WHERE api_key_id = $1 
         AND timestamp > NOW() - INTERVAL '1 minute'`,
      [keyId]
    );
    
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * List all API keys with pagination
   */
  static async list(limit: number = 50, offset: number = 0): Promise<ApiKeyData[]> {
    const result = await query<ApiKeyData>(
      'SELECT * FROM api_keys ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Count total API keys
   */
  static async count(): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM api_keys'
    );
    
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map database row to ApiKeyData
   */
  private static mapRow(row: any): ApiKeyData {
    return {
      id: row.id,
      key: row.key,
      userId: row.user_id,
      name: row.name,
      rateLimitPerMinute: row.rate_limit_per_minute,
      dailyBudgetUsd: parseFloat(row.daily_budget_usd),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
    };
  }
}