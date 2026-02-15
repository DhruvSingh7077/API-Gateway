import { detectAIResponse } from '../src/services/costCalculator';

describe('detectAIResponse', () => {
  it('detects OpenAI responses and calculates cost', () => {
    const response = {
      model: 'gpt-3.5-turbo',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };

    const result = detectAIResponse(response);

    expect(result.isAIResponse).toBe(true);
    expect(result.model).toBe('gpt-3.5-turbo');
    expect(result.usage?.totalTokens).toBe(150);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('detects Anthropic responses and calculates cost', () => {
    const response = {
      type: 'message',
      model: 'claude-3-sonnet-20240229',
      usage: {
        input_tokens: 120,
        output_tokens: 80,
      },
    };

    const result = detectAIResponse(response);

    expect(result.isAIResponse).toBe(true);
    expect(result.model).toBe('claude-3-sonnet-20240229');
    expect(result.usage?.totalTokens).toBe(200);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('returns not AI for non-object responses', () => {
    const result = detectAIResponse('not an object');

    expect(result.isAIResponse).toBe(false);
    expect(result.costUsd).toBe(0);
  });
});
