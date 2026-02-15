// src/metrics/prometheus.ts
// Purpose: Expose Prometheus metrics and request instrumentation

import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'cached'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'cached'],
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = httpRequestDuration.startTimer({
    method: req.method,
    route: req.path,
  });

  res.on('finish', () => {
    const statusCode = res.statusCode.toString();
    const cachedHeader = res.getHeader('X-Cache');
    const cached = cachedHeader ? String(cachedHeader) : 'none';

    httpRequestTotal.inc({
      method: req.method,
      route: req.path,
      status_code: statusCode,
      cached,
    });

    start({
      status_code: statusCode,
      cached,
    });
  });

  next();
}

export async function metricsHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}
