 
import request from 'supertest';
import { createApp } from '../src/server';

describe('health endpoint', () => {
  it('returns healthy status', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(typeof response.body.uptime).toBe('number');
  });
});
