import fetch from 'node-fetch';

interface TimedResult {
  durationMs: number;
  responseTimeHeaderMs: number | null;
  cacheHeader: string | null;
  requestCostUsd: number | null;
  status: number;
}

interface PhaseSummary {
  count: number;
  successCount: number;
  cacheHitRatePct: number;
  medianMs: number;
  p95Ms: number;
  avgMs: number;
  totalCostUsd: number;
}

const BASE_URL = process.env.BENCH_BASE_URL || 'http://localhost:3000';
const ADMIN_KEY = process.env.BENCH_ADMIN_KEY || process.env.ADMIN_API_KEY || 'admin_dev_key_12345';
const USER_ID = process.env.BENCH_USER_ID || 'benchmark_user';
const REQUEST_COUNT = Number(process.env.BENCH_REQUEST_COUNT || 30);

function percentile(values: number[], p: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseResponseTime(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }
  const numeric = Number(headerValue.replace('ms', '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCost(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }
  const numeric = Number(headerValue.replace('$', '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

async function createBenchmarkApiKey(): Promise<string> {
  const response = await fetch(`${BASE_URL}/admin/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
    },
    body: JSON.stringify({
      userId: USER_ID,
      name: `Benchmark Key ${new Date().toISOString()}`,
      rateLimitPerMinute: 1000,
      dailyBudgetUsd: 100,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create benchmark API key (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as any;
  const key = payload?.apiKey?.key as string | undefined;

  if (!key) {
    throw new Error('Admin key creation succeeded but API key was missing in response.');
  }

  return key;
}

async function executeRequest(apiKey: string, prompt: string, nonce: string): Promise<TimedResult> {
  const startedAt = Date.now();

  const response = await fetch(`${BASE_URL}/api/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      benchmarkNonce: nonce,
    }),
  });

  const endedAt = Date.now();
  const durationMs = endedAt - startedAt;

  // Consume body to avoid connection reuse issues in some runtimes.
  await response.text();

  return {
    durationMs,
    responseTimeHeaderMs: parseResponseTime(response.headers.get('x-response-time')),
    cacheHeader: response.headers.get('x-cache'),
    requestCostUsd: parseCost(response.headers.get('x-request-cost')),
    status: response.status,
  };
}

function summarizePhase(results: TimedResult[]): PhaseSummary {
  const successful = results.filter((r) => r.status >= 200 && r.status < 300);
  const latencies = successful.map((r) => r.responseTimeHeaderMs ?? r.durationMs);
  const costs = successful
    .map((r) => r.requestCostUsd)
    .filter((v): v is number => typeof v === 'number');
  const hits = successful.filter((r) => r.cacheHeader === 'HIT').length;

  return {
    count: results.length,
    successCount: successful.length,
    cacheHitRatePct: successful.length ? (hits / successful.length) * 100 : 0,
    medianMs: median(latencies),
    p95Ms: percentile(latencies, 95),
    avgMs: average(latencies),
    totalCostUsd: costs.reduce((sum, value) => sum + value, 0),
  };
}

function pctChange(before: number, after: number): number {
  if (before === 0) {
    return 0;
  }
  return ((before - after) / before) * 100;
}

async function run(): Promise<void> {
  console.log('Benchmark start');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Request count per phase: ${REQUEST_COUNT}`);

  const apiKey = await createBenchmarkApiKey();
  console.log('Created benchmark API key');

  const prompts: Array<{ prompt: string; nonce: string }> = [];
  for (let i = 1; i <= REQUEST_COUNT; i++) {
    prompts.push({
      prompt: `benchmark prompt #${i} - explain api gateway in one sentence`,
      nonce: `nonce-${Date.now()}-${i}`,
    });
  }

  console.log('Phase A: cache MISS baseline');
  const missResults: TimedResult[] = [];
  for (const item of prompts) {
    missResults.push(await executeRequest(apiKey, item.prompt, item.nonce));
  }

  console.log('Phase B: cache HIT run (same prompts)');
  const hitResults: TimedResult[] = [];
  for (const item of prompts) {
    hitResults.push(await executeRequest(apiKey, item.prompt, item.nonce));
  }

  const miss = summarizePhase(missResults);
  const hit = summarizePhase(hitResults);

  const medianImprovement = pctChange(miss.medianMs, hit.medianMs);
  const p95Improvement = pctChange(miss.p95Ms, hit.p95Ms);
  const avgImprovement = pctChange(miss.avgMs, hit.avgMs);
  const costReduction = pctChange(miss.totalCostUsd, hit.totalCostUsd);

  console.log('');
  console.log('========== BENCHMARK RESULTS ==========');
  console.log(`Baseline (MISS): success ${miss.successCount}/${miss.count}`);
  console.log(`  cache hit rate: ${miss.cacheHitRatePct.toFixed(1)}%`);
  console.log(`  median latency: ${miss.medianMs.toFixed(1)} ms`);
  console.log(`  p95 latency: ${miss.p95Ms.toFixed(1)} ms`);
  console.log(`  average latency: ${miss.avgMs.toFixed(1)} ms`);
  console.log(`  total request cost: $${miss.totalCostUsd.toFixed(6)}`);

  console.log(`Cached (HIT): success ${hit.successCount}/${hit.count}`);
  console.log(`  cache hit rate: ${hit.cacheHitRatePct.toFixed(1)}%`);
  console.log(`  median latency: ${hit.medianMs.toFixed(1)} ms`);
  console.log(`  p95 latency: ${hit.p95Ms.toFixed(1)} ms`);
  console.log(`  average latency: ${hit.avgMs.toFixed(1)} ms`);
  console.log(`  total request cost: $${hit.totalCostUsd.toFixed(6)}`);

  console.log('Impact');
  console.log(`  median latency improvement: ${medianImprovement.toFixed(1)}%`);
  console.log(`  p95 latency improvement: ${p95Improvement.toFixed(1)}%`);
  console.log(`  average latency improvement: ${avgImprovement.toFixed(1)}%`);
  console.log(`  cost reduction on cached repeat traffic: ${costReduction.toFixed(1)}%`);

  console.log('Resume bullets (auto-generated)');
  console.log(
    `- Reduced median latency by ${medianImprovement.toFixed(1)}% and p95 latency by ${p95Improvement.toFixed(1)}% for repeated prompts via Redis caching (${REQUEST_COUNT} baseline + ${REQUEST_COUNT} cached requests).`
  );
  console.log(
    `- Increased cache-hit rate from ${miss.cacheHitRatePct.toFixed(1)}% to ${hit.cacheHitRatePct.toFixed(1)}%, cutting repeat-request cost by ${costReduction.toFixed(1)}% in benchmark traffic.`
  );
  console.log('=======================================');
}

run().catch((error) => {
  console.error('Benchmark failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
