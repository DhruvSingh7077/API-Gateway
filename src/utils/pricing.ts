// src/utils/pricing.ts
// Purpose: AI model pricing tables and cost calculation

export interface ModelPricing {
  promptPricePerToken: number;  // Price per token for input
  completionPricePerToken: number;  // Price per token for output
}

// Pricing table (prices per token, not per 1K tokens)
// Updated as of February 2025
export const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4': {
    promptPricePerToken: 0.03 / 1000,
    completionPricePerToken: 0.06 / 1000,
  },
  'gpt-4-turbo': {
    promptPricePerToken: 0.01 / 1000,
    completionPricePerToken: 0.03 / 1000,
  },
  'gpt-4-turbo-preview': {
    promptPricePerToken: 0.01 / 1000,
    completionPricePerToken: 0.03 / 1000,
  },
  'gpt-4-0125-preview': {
    promptPricePerToken: 0.01 / 1000,
    completionPricePerToken: 0.03 / 1000,
  },
  'gpt-3.5-turbo': {
    promptPricePerToken: 0.0015 / 1000,
    completionPricePerToken: 0.002 / 1000,
  },
  'gpt-3.5-turbo-16k': {
    promptPricePerToken: 0.003 / 1000,
    completionPricePerToken: 0.004 / 1000,
  },
  
  // Anthropic Claude Models
  'claude-3-opus-20240229': {
    promptPricePerToken: 0.015 / 1000,
    completionPricePerToken: 0.075 / 1000,
  },
  'claude-3-sonnet-20240229': {
    promptPricePerToken: 0.003 / 1000,
    completionPricePerToken: 0.015 / 1000,
  },
  'claude-3-haiku-20240307': {
    promptPricePerToken: 0.00025 / 1000,
    completionPricePerToken: 0.00125 / 1000,
  },
  'claude-2.1': {
    promptPricePerToken: 0.008 / 1000,
    completionPricePerToken: 0.024 / 1000,
  },
  'claude-2': {
    promptPricePerToken: 0.008 / 1000,
    completionPricePerToken: 0.024 / 1000,
  },
  
  // Aliases for convenience
  'gpt-4-1106-preview': {
    promptPricePerToken: 0.01 / 1000,
    completionPricePerToken: 0.03 / 1000,
  },
  'claude-opus': {
    promptPricePerToken: 0.015 / 1000,
    completionPricePerToken: 0.075 / 1000,
  },
  'claude-sonnet': {
    promptPricePerToken: 0.003 / 1000,
    completionPricePerToken: 0.015 / 1000,
  },
  'claude-haiku': {
    promptPricePerToken: 0.00025 / 1000,
    completionPricePerToken: 0.00125 / 1000,
  },
};

/**
 * Get pricing for a specific model
 */
export function getModelPricing(model: string): ModelPricing | null {
  // Try exact match first
  if (PRICING_TABLE[model]) {
    return PRICING_TABLE[model];
  }
  
  // Try partial match (for versioned models)
  const modelLower = model.toLowerCase();
  
  for (const [key, pricing] of Object.entries(PRICING_TABLE)) {
    if (modelLower.includes(key.toLowerCase())) {
      return pricing;
    }
  }
  
  return null;
}

/**
 * Calculate cost for a given model and token usage
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(model);
  
  if (!pricing) {
    console.warn(`Unknown model: ${model}. Cannot calculate cost.`);
    return 0;
  }
  
  const promptCost = promptTokens * pricing.promptPricePerToken;
  const completionCost = completionTokens * pricing.completionPricePerToken;
  
  return promptCost + completionCost;
}

/**
 * Calculate cost from total tokens (estimate 50/50 split if breakdown not available)
 */
export function calculateCostFromTotal(model: string, totalTokens: number): number {
  // Assume 50% prompt, 50% completion if breakdown not available
  const estimatedPrompt = Math.floor(totalTokens * 0.5);
  const estimatedCompletion = totalTokens - estimatedPrompt;
  
  return calculateCost(model, estimatedPrompt, estimatedCompletion);
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Get all supported models
 */
export function getSupportedModels(): string[] {
  return Object.keys(PRICING_TABLE);
}

/**
 * Check if model is supported
 */
export function isModelSupported(model: string): boolean {
  return getModelPricing(model) !== null;
}

/**
 * Get pricing comparison between models
 */
export function comparePricing(tokenCount: number): Array<{ model: string; cost: number }> {
  const results: Array<{ model: string; cost: number }> = [];
  
  for (const model of Object.keys(PRICING_TABLE)) {
    const cost = calculateCostFromTotal(model, tokenCount);
    results.push({ model, cost });
  }
  
  // Sort by cost (ascending)
  results.sort((a, b) => a.cost - b.cost);
  
  return results;
}