// src/services/mockBackend.ts
// Purpose: Generate realistic mock API responses for testing without real API keys

import { logger } from '../utils/logger';

export interface MockResponse {
  statusCode: number;
  headers: Record<string, any>;
  body: any;
}

/**
 * Generate a mock OpenAI chat completion response
 */
export function generateMockOpenAIResponse(messages: any[], model: string = 'gpt-3.5-turbo'): MockResponse {
  try {
    // Generate random tokens for realistic simulation
    const promptTokens = Math.floor(Math.random() * 500) + 50; // 50-550 tokens
    const completionTokens = Math.floor(Math.random() * 200) + 50; // 50-250 tokens
    
    // Mock response content
    const content = 'This is a mock response from the AI gateway. The system is working correctly! All features including caching, rate limiting, budget tracking, and metrics collection are functioning as expected.';
    
    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
    
    logger.debug('Mock OpenAI response generated', {
      model,
      promptTokens,
      completionTokens,
    });
    
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: response,
    };
  } catch (error) {
    logger.error('Error generating mock OpenAI response', error as Error);
    
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: {
        error: {
          message: 'Mock response generation failed',
          type: 'internal_error',
          code: 'mock_error',
        },
      },
    };
  }
}

/**
 * Generate a mock Anthropic message response
 */
export function generateMockAnthropicResponse(messages: any[], model: string = 'claude-3-sonnet-20240229'): MockResponse {
  try {
    // Generate random tokens
    const inputTokens = Math.floor(Math.random() * 500) + 50;
    const outputTokens = Math.floor(Math.random() * 200) + 50;
    
    const content = 'This is a mock response from the Anthropic API via the AI gateway. All caching, rate limiting, and cost tracking features are operational.';
    
    const response = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
      model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    };
    
    logger.debug('Mock Anthropic response generated', {
      model,
      inputTokens,
      outputTokens,
    });
    
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: response,
    };
  } catch (error) {
    logger.error('Error generating mock Anthropic response', error as Error);
    
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: {
        error: {
          message: 'Mock response generation failed',
          type: 'internal_error',
          code: 'mock_error',
        },
      },
    };
  }
}

/**
 * Get mock response based on backend and endpoint
 */
export function getMockResponse(
  backend: 'openai' | 'anthropic',
  endpoint: string,
  method: string,
  body: any
): MockResponse {
  // For non-chat endpoints, return a generic error
  if (!endpoint.includes('/chat/completions') && !endpoint.includes('/messages')) {
    return {
      statusCode: 501,
      headers: { 'content-type': 'application/json' },
      body: {
        error: {
          message: 'Mock backend only supports /chat/completions (OpenAI) and /messages (Anthropic)',
          type: 'not_supported',
        },
      },
    };
  }
  
  // Extract model from request body if available
  const model = body?.model || (backend === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-sonnet-20240229');
  const messages = body?.messages || [];
  
  if (backend === 'openai') {
    return generateMockOpenAIResponse(messages, model);
  } else if (backend === 'anthropic') {
    return generateMockAnthropicResponse(messages, model);
  }
  
  return {
    statusCode: 400,
    headers: { 'content-type': 'application/json' },
    body: { error: 'Unknown backend' },
  };
}
