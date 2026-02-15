import request from 'supertest';

const cacheStore = new Map<string, string>();
const counterStore = new Map<string, number>();

jest.mock('../src/config/redis', () => ({
  getCache: jest.fn(async (key: string) => cacheStore.get(key) ?? null),
  setCache: jest.fn(async (key: string, value: string) => {
    cacheStore.set(key, value);
    return true;
  }),
  deleteCache: jest.fn(async (key: string) => {
    cacheStore.delete(key);
    return true;
  }),
  incrementCounter: jest.fn(async (key: string) => {
    const next = (counterStore.get(key) ?? 0) + 1;
    counterStore.set(key, next);
    return next;
  }),
  setExpiration: jest.fn(async () => true),
  publishMessage: jest.fn(async () => undefined),
}));

jest.mock('../src/models/ApiKey', () => ({
  ApiKey: {
    findByKey: jest.fn(async () => ({
      id: 'key-1',
      key: 'gw_test_key',
      userId: 'test_user',
      name: 'Test Key',
      rateLimitPerMinute: 100,
      dailyBudgetUsd: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    })),
  },
}));

jest.mock('../src/services/metricsCollector', () => ({
  collectMetrics: jest.fn(async () => undefined),
}));

jest.mock('../src/services/budgetTracker', () => ({
  trackBudget: jest.fn(async () => ({
    currentSpending: 0,
    budgetLimit: 50,
    remainingBudget: 50,
    percentageUsed: 0,
    isOverBudget: false,
    isNearLimit: false,
  })),
}));

describe('proxy endpoint integration', () => {
  beforeEach(() => {
    cacheStore.clear();
    counterStore.clear();
  });

  it('returns mock response and caches on second request', async () => {
    process.env.MOCK_BACKEND = 'true';

    const { createApp } = await import('../src/server');
    const app = createApp();

    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const first = await request(app)
      .post('/api/v1/chat/completions')
      .set('X-API-Key', 'gw_test_key')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(payload);

    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.body.choices?.[0]?.message?.content).toBeTruthy();

    const second = await request(app)
      .post('/api/v1/chat/completions')
      .set('X-API-Key', 'gw_test_key')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('HIT');
  });
});
