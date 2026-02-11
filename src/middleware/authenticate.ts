// src/middleware/authenticate.ts
// Purpose: Validate API keys on incoming requests

import { Request, Response, NextFunction } from 'express';
import { ApiKey, ApiKeyData } from '../models/ApiKey';
import { logger } from '../utils/logger';

// Extend Express Request to include authenticated user data
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyData;
      userId?: string;
    }
  }
}

/**
 * Authentication middleware
 * Validates X-API-Key header and attaches user info to request
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from header
    const apiKeyHeader = req.headers['x-api-key'] as string;
    
    if (!apiKeyHeader) {
      logger.warn('Authentication failed: Missing API key', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing X-API-Key header',
      });
      return;
    }
    
    // Validate API key against database
    const apiKeyData = await ApiKey.findByKey(apiKeyHeader);
    
    if (!apiKeyData) {
      logger.warn('Authentication failed: Invalid API key', {
        path: req.path,
        method: req.method,
        keyPrefix: apiKeyHeader.substring(0, 10),
        ip: req.ip,
      });
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }
    
    // Check if key is active
    if (!apiKeyData.isActive) {
      logger.warn('Authentication failed: Inactive API key', {
        path: req.path,
        method: req.method,
        userId: apiKeyData.userId,
        keyId: apiKeyData.id,
      });
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has been deactivated',
      });
      return;
    }
    
    // Attach API key data to request for use in subsequent middleware/routes
    req.apiKey = apiKeyData;
    req.userId = apiKeyData.userId;
    
    logger.debug('Authentication successful', {
      userId: apiKeyData.userId,
      keyId: apiKeyData.id,
      path: req.path,
    });
    
    // Continue to next middleware
    next();
  } catch (error) {
    logger.error('Authentication error', error as Error, {
      path: req.path,
      method: req.method,
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware (doesn't fail if no key provided)
 * Useful for endpoints that work both with and without authentication
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  
  if (!apiKeyHeader) {
    // No API key provided, continue without authentication
    next();
    return;
  }
  
  // If key is provided, validate it
  await authenticate(req, res, next);
}