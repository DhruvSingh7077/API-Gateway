// src/config/database.ts
// Purpose: PostgreSQL connection pool and query interface

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from './environment';

// Create connection pool
export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection not available
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Generic query function with proper typing
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (>1000ms)
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text);
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', {
      query: text,
      params,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✓ Database connection successful');
    console.log(`  - Connected at: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

// Close all connections (for graceful shutdown)
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.log('✓ Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

// Helper: Execute query in a transaction
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Helper: Check if table exists
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

// Helper: Get table row count
export async function getTableCount(tableName: string): Promise<number> {
  const result = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return parseInt(result.rows[0].count, 10);
}