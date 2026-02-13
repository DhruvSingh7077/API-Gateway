// src/services/proxyService.ts
// Purpose: Forward requests to backend AI APIs (OpenAI, Anthropic)

import fetch from 'node-fetch';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { getMockResponse } from './mockBackend';

export interface ProxyRequest {
  backend: 'openai' | 'anthropic';
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, any>;
  body: any;
  responseTimeMs: number;
}

/**
 * Get backend base URL
 */
function getBackendUrl(backend: 'openai' | 'anthropic'): string {
  if (backend === 'openai') {
    return 'https://api.openai.com';
  } else if (backend === 'anthropic') {
    return 'https://api.anthropic.com';
  }
  
  throw new Error(`Unknown backend: ${backend}`);
}

/**
 * Get API key for backend
 */
function getBackendApiKey(backend: 'openai' | 'anthropic'): string {
  if (backend === 'openai') {
    return config.backends.openai;
  } else if (backend === 'anthropic') {
    return config.backends.anthropic;
  }
  
  throw new Error(`Unknown backend: ${backend}`);
}

/**
 * Prepare headers for backend request
 */
function prepareHeaders(
  backend: 'openai' | 'anthropic',
  originalHeaders: Record<string, string>
): Record<string, string> {
  const apiKey = getBackendApiKey(backend);
  
  if (!apiKey) {
    throw new Error(`API key not configured for ${backend}`);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add backend-specific authentication
  if (backend === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (backend === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01'; // Required by Anthropic
  }
  
  // Forward specific headers if needed
  const forwardHeaders = ['user-agent', 'accept', 'accept-encoding'];
  forwardHeaders.forEach(header => {
    if (originalHeaders[header]) {
      headers[header] = originalHeaders[header];
    }
  });
  
  return headers;
}

/**
 * Forward request to backend API
 */
export async function forwardRequest(request: ProxyRequest): Promise<ProxyResponse> {
  const startTime = Date.now();
  
  try {
    // Check if mock backend is enabled
    if (config.mockBackend) {
      logger.info('Using mock backend response', {
        backend: request.backend,
        endpoint: request.endpoint,
      });
      
      const mockResult = getMockResponse(
        request.backend,
        request.endpoint,
        request.method,
        request.body
      );
      
      const responseTimeMs = Date.now() - startTime;
      
      return {
        statusCode: mockResult.statusCode,
        headers: mockResult.headers,
        body: mockResult.body,
        responseTimeMs,
      };
    }
    
    // Real backend request
    const baseUrl = getBackendUrl(request.backend);
    const url = `${baseUrl}${request.endpoint}`;
    const headers = prepareHeaders(request.backend, request.headers);
    
    logger.debug('Forwarding request to backend', {
      backend: request.backend,
      endpoint: request.endpoint,
      method: request.method,
    });
    
    // Make request to backend API
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    });
    
    const responseTimeMs = Date.now() - startTime;
    
    // Parse response
    let responseBody: any;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }
    
    // Extract response headers
    const responseHeaders: Record<string, any> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    logger.debug('Backend response received', {
      backend: request.backend,
      endpoint: request.endpoint,
      statusCode: response.status,
      responseTimeMs,
    });
    
    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    
    logger.error('Error forwarding request to backend', error as Error, {
      backend: request.backend,
      endpoint: request.endpoint,
      responseTimeMs,
    });
    
    // Return error response
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: {
        error: 'Bad Gateway',
        message: `Failed to reach ${request.backend} API`,
        details: (error as Error).message,
      },
      responseTimeMs,
    };
  }
}

/**
 * Detect which backend to use based on endpoint
 */
export function detectBackend(endpoint: string): 'openai' | 'anthropic' | null {
  // OpenAI endpoints
  if (endpoint.startsWith('/v1/') || endpoint.startsWith('/openai/')) {
    return 'openai';
  }
  
  // Anthropic endpoints
  if (endpoint.startsWith('/v1/messages') || endpoint.startsWith('/anthropic/')) {
    return 'anthropic';
  }
  
  // Default to OpenAI for common endpoints
  if (endpoint.includes('/chat/completions') || endpoint.includes('/completions')) {
    return 'openai';
  }
  
  return null;
}

/**
 * Normalize endpoint path for backend
 * Removes gateway-specific prefixes
 */
export function normalizeEndpoint(endpoint: string, backend: 'openai' | 'anthropic'): string {
  // Remove gateway prefixes
  let normalized = endpoint
    .replace(/^\/api/, '')
    .replace(/^\/openai/, '')
    .replace(/^\/anthropic/, '');
  
  // Ensure it starts with /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Add /v1 prefix if missing (required by OpenAI)
  if (backend === 'openai' && !normalized.startsWith('/v1/')) {
    normalized = '/v1' + normalized;
  }
  
  return normalized;
}