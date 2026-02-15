import { generateCacheKey, shouldCacheResponse } from '../src/services/cacheService';

describe('cacheService helpers', () => {
  it('generates stable cache keys for equivalent bodies', () => {
    const endpoint = '/v1/chat/completions';
    const bodyA = { model: 'gpt-3.5-turbo', temperature: 0.2 };
    const bodyB = { temperature: 0.2, model: 'gpt-3.5-turbo' };

    const keyA = generateCacheKey(endpoint, bodyA);
    const keyB = generateCacheKey(endpoint, bodyB);

    expect(keyA).toBe(keyB);
  });

  it('does not cache error responses', () => {
    const result = shouldCacheResponse(500, { error: 'bad' });
    expect(result).toBe(false);
  });

  it('does not cache large responses', () => {
    const result = shouldCacheResponse(200, { data: 'x' }, 1);
    expect(result).toBe(false);
  });

  it('does not cache streaming responses', () => {
    const result = shouldCacheResponse(200, { stream: true });
    expect(result).toBe(false);
  });

  it('caches standard successful responses', () => {
    const result = shouldCacheResponse(200, { ok: true });
    expect(result).toBe(true);
  });
});
