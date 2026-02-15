// src/server.ts
// Purpose: Main Express server - ties everything together

import express, { Express } from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/environment';
import { testConnection } from './config/database';
import { connectRedis } from './config/redis';
import { requestLogger, errorLogger, notFoundHandler } from './middleware/requestLogger';
import { logger } from './utils/logger';
import { metricsHandler, metricsMiddleware } from './metrics/prometheus';

// Import routes
import proxyRouter from './routes/proxy';
import adminRouter from './routes/admin';
import healthRouter from './routes/health';

/**
 * Create and configure Express app
 */
export function createApp(): Express {
  const app = express();
  
  // Middleware - applied in order
  app.use(cors()); // Enable CORS
  app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
  app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
  app.use(requestLogger); // Log all requests
  app.use(metricsMiddleware); // Collect Prometheus metrics
  
  // Routes
  app.get('/metrics', metricsHandler); // Prometheus metrics
  app.use('/health', healthRouter); // Health checks (no auth required)
  app.use('/admin', adminRouter); // Admin API (admin auth required)
  app.use('/api', proxyRouter); // Proxy routes (user auth required)
  
  // Catch-all for undefined routes
  app.use(notFoundHandler);
  
  // Error handler (must be last)
  app.use(errorLogger);
  
  return app;
}

/**
 * Start the server
 */
export async function startServer(): Promise<void> {
  try {
    logger.info('Starting API Gateway...');
    
    // Step 1: Validate configuration
    logger.info('Validating configuration...');
    validateConfig();
    logger.info('✓ Configuration validated');
    
    // Step 2: Connect to PostgreSQL
    logger.info('Connecting to PostgreSQL...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to PostgreSQL');
    }
    logger.info('✓ PostgreSQL connected');
    
    // Step 3: Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis();
    const redisConnected = await testConnection();
    if (!redisConnected) {
      throw new Error('Failed to connect to Redis');
    }
    logger.info('✓ Redis connected');
    
    // Step 4: Create Express app
    logger.info('Creating Express app...');
    const app = createApp();
    logger.info('✓ Express app created');
    
    // Step 5: Start HTTP server
    const port = config.port;
    app.listen(port, () => {
      logger.info(`🚀 API Gateway started successfully!`);
      logger.info(`📡 Server listening on port ${port}`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
      logger.info(`💾 Database: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);
      logger.info(`🔴 Redis: ${config.redis.host}:${config.redis.port}`);
      logger.info(``);
      logger.info(`Available endpoints:`);
      logger.info(`  GET  /health              - Basic health check`);
      logger.info(`  GET  /health/detailed     - Detailed health check`);
      logger.info(`  POST /admin/keys          - Create API key (requires admin key)`);
      logger.info(`  GET  /admin/keys          - List API keys (requires admin key)`);
      logger.info(`  ALL  /api/*               - Proxy to AI APIs (requires user API key)`);
      logger.info(``);
      logger.info(`Features:`);
      logger.info(`  ✓ Caching: ${config.features.caching ? 'enabled' : 'disabled'}`);
      logger.info(`  ✓ Rate Limiting: ${config.features.rateLimiting ? 'enabled' : 'disabled'}`);
      logger.info(`  ✓ Budget Alerts: ${config.features.budgetAlerts ? 'enabled' : 'disabled'}`);
      logger.info(`  ✓ Cost Tracking: ${config.features.costTracking ? 'enabled' : 'disabled'}`);
      logger.info(``);
      logger.info(`Ready to accept requests! 🎉`);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});