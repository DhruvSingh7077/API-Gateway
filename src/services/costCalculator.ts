// src/services/costCalculator.ts
// Purpose: Detect AI API responses and calculate costs from token usage

import { calculateCost } from '../utils/pricing';
import { logger } from '../utils/logger';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostCalculation {
  isAIResponse: boolean;
  model: string | null;
  usage: TokenUsage | null;
  costUsd: number;
  error?: string;
}

/**
 * Detect if response is from an AI API and extract token usage
 */
export function detectAIResponse(responseBody: any): CostCalculation {
  try {
    // Check if response body exists
    if (!responseBody || typeof responseBody !== 'object') {
      return {
        isAIResponse: false,
        model: null,
        usage: null,
        costUsd: 0,
      };
    }

    // Anthropic Response Pattern
    if (responseBody.usage && responseBody.model && responseBody.type === 'message') {
      const usage: TokenUsage = {
        promptTokens: responseBody.usage.input_tokens || 0,
        completionTokens: responseBody.usage.output_tokens || 0,
        totalTokens: (responseBody.usage.input_tokens || 0) + (responseBody.usage.output_tokens || 0),
      };

      const cost = calculateCost(
        responseBody.model,
        usage.promptTokens,
        usage.completionTokens
      );

      logger.debug('Anthropic response detected', {
        model: responseBody.model,
        tokens: usage.totalTokens,
        cost,
      });

      return {
        isAIResponse: true,
        model: responseBody.model,
        usage,
        costUsd: cost,
      };
    }

    // OpenAI Response Pattern
    if (responseBody.usage && responseBody.model) {
      const usage: TokenUsage = {
        promptTokens: responseBody.usage.prompt_tokens || 0,
        completionTokens: responseBody.usage.completion_tokens || 0,
        totalTokens: responseBody.usage.total_tokens || 0,
      };

      const cost = calculateCost(
        responseBody.model,
        usage.promptTokens,
        usage.completionTokens
      );

      logger.debug('OpenAI response detected', {
        model: responseBody.model,
        tokens: usage.totalTokens,
        cost,
      });

      return {
        isAIResponse: true,
        model: responseBody.model,
        usage,
        costUsd: cost,
      };
    }

    // Not an AI response
    return {
      isAIResponse: false,
      model: null,
      usage: null,
      costUsd: 0,
    };
  } catch (error) {
    logger.error('Error detecting AI response', error as Error, {
      responseType: typeof responseBody,
    });

    return {
      isAIResponse: false,
      model: null,
      usage: null,
      costUsd: 0,
      error: 'Failed to parse AI response',
    };
  }
}

/**
 * Calculate cost from response data
 * Wrapper function for easier usage
 */
export function calculateResponseCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  return calculateCost(model, promptTokens, completionTokens);
}

/**
 * Estimate cost before making request (based on input)
 * Useful for budget pre-checks
 */
export function estimateRequestCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number = 100
): number {
  return calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
}

/**
 * Get cost breakdown for reporting
 */
export function getCostBreakdown(
  model: string,
  promptTokens: number,
  completionTokens: number
): {
  totalCost: number;
  promptCost: number;
  completionCost: number;
  breakdown: string;
} {
  const totalCost = calculateCost(model, promptTokens, completionTokens);
  const promptCost = calculateCost(model, promptTokens, 0);
  const completionCost = calculateCost(model, 0, completionTokens);

  return {
    totalCost,
    promptCost,
    completionCost,
    breakdown: `Prompt: $${promptCost.toFixed(6)} (${promptTokens} tokens) + Completion: $${completionCost.toFixed(6)} (${completionTokens} tokens) = Total: $${totalCost.toFixed(6)}`,
  };
}