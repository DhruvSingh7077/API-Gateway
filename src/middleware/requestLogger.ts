// src/middleware/requestLogger.ts
// Purpose: Log all HTTP requests for monitoring and debugging

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Request logger middleware
 * Logs incoming requests and their responses
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Record start time
  const startTime = Date.now();
  
  // Generate unique request ID
  const requestId = generateRequestId();
  
  // Attach request ID to request object for tracing
  (req as any).requestId = requestId;
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.userId || 'anonymous',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // Capture original res.json to intercept response
  const originalJson = res.json.bind(res);
  
  // Override res.json to log response
  res.json = function (body: any): Response {
    // Calculate request duration
    const duration = Date.now() - startTime;
    
    // Log response
    logger.http(
      req.method,
      req.path,
      res.statusCode,
      duration,
      {
        requestId,
        userId: req.userId,
        responseSize: JSON.stringify(body).length,
      }
    );
    
    // Add custom headers
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Call original json method
    return originalJson(body);
  };
  
  // Handle response finish event for non-JSON responses
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Only log if not already logged by res.json override
    if (!res.headersSent || res.getHeader('X-Request-Id') !== requestId) {
      logger.http(
        req.method,
        req.path,
        res.statusCode,
        duration,
        {
          requestId,
          userId: req.userId,
        }
      );
    }
  });
  
  // Handle errors
  res.on('error', (error: Error) => {
    const duration = Date.now() - startTime;
    
    logger.error('Request error', error, {
      requestId,
      method: req.method,
      path: req.path,
      userId: req.userId,
      duration,
    });
  });
  
  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Error logging middleware
 * Should be placed AFTER all routes to catch errors
 */
export function errorLogger(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.error('Unhandled error in request', error, {
    requestId,
    method: req.method,
    path: req.path,
    userId: req.userId,
    query: req.query,
    body: req.body,
  });
  
  // Send error response
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      requestId,
    });
  }
}

/**
 * 404 Not Found handler
 * Should be placed AFTER all routes
 */
export function notFoundHandler(
  req: Request,
  res: Response
): void {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.warn('Route not found', {
    requestId,
    method: req.method,
    path: req.path,
    userId: req.userId,
  });
  
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId,
  });
}