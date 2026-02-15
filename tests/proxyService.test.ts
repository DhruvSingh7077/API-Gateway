import { detectBackend, normalizeEndpoint } from '../src/services/proxyService';

describe('proxyService helpers', () => {
  it('detects OpenAI endpoints', () => {
    expect(detectBackend('/v1/chat/completions')).toBe('openai');
    expect(detectBackend('/openai/v1/chat/completions')).toBe('openai');
  });

  it('detects Anthropic endpoints', () => {
    expect(detectBackend('/v1/messages')).toBe('anthropic');
    expect(detectBackend('/anthropic/v1/messages')).toBe('anthropic');
  });

  it('normalizes endpoints for OpenAI', () => {
    const normalized = normalizeEndpoint('/api/chat/completions', 'openai');
    expect(normalized).toBe('/v1/chat/completions');
  });

  it('normalizes endpoints for Anthropic', () => {
    const normalized = normalizeEndpoint('/api/v1/messages', 'anthropic');
    expect(normalized).toBe('/v1/messages');
  });
});
