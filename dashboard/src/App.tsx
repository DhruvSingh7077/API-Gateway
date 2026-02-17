import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

interface UserMetrics {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  avgResponseTime: number;
  cacheHitRate: number;
}

interface EndpointStat {
  endpoint: string;
  requestCount: number;
  totalCost: number;
  avgResponseTime: number;
}

interface ModelStat {
  model: string;
  requestCount: number;
  totalCost: number;
  totalTokens: number;
}

interface SpendingPoint {
  date: string;
  requests: number;
  cost: number;
  tokens: number;
}

interface MetricsResponse {
  success: boolean;
  userId: string;
  period: string;
  metrics: UserMetrics;
  endpointStats: EndpointStat[];
  modelStats: ModelStat[];
  spendingTrend: SpendingPoint[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'admin_dev_key_12345';
const DASHBOARD_USER_ID = import.meta.env.VITE_DASHBOARD_USER_ID || 'test_user';
const DASHBOARD_USERS_ENV = import.meta.env.VITE_DASHBOARD_USERS || DASHBOARD_USER_ID;

const DASHBOARD_USERS: string[] = DASHBOARD_USERS_ENV.split(',')
  .map((item: string) => item.trim())
  .filter(Boolean);

export default function App() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(DASHBOARD_USER_ID);

  async function loadMetrics(userId: string, showLoading: boolean): Promise<void> {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userId}/metrics?days=7`,
        {
          headers: {
            'X-Admin-Key': ADMIN_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load metrics (${response.status})`);
      }

      const payload = (await response.json()) as MetricsResponse;
      setData(payload);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError((loadError as Error).message || 'Failed to load metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadMetrics(selectedUserId, true);
    const timer = setInterval(() => {
      loadMetrics(selectedUserId, false);
    }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, [selectedUserId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    socket.on('dashboard:update', (event: { userId?: string }) => {
      if (event.userId && event.userId === selectedUserId) {
        loadMetrics(selectedUserId, false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedUserId]);

  function handleRefresh(): void {
    loadMetrics(selectedUserId, false);
  }

  async function handleGenerateDemoTraffic(): Promise<void> {
    try {
      setIsGenerating(true);
      setError(null);
      setStatusMessage(null);

      const createKeyResponse = await fetch(`${API_BASE_URL}/admin/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_API_KEY,
        },
        body: JSON.stringify({
          userId: selectedUserId,
          name: `Dashboard Demo ${new Date().toISOString()}`,
          rateLimitPerMinute: 100,
          dailyBudgetUsd: 50,
        }),
      });

      if (!createKeyResponse.ok) {
        throw new Error(`Failed to create demo key (${createKeyResponse.status})`);
      }

      const createKeyPayload = await createKeyResponse.json();
      const userApiKey = createKeyPayload?.apiKey?.key as string | undefined;

      if (!userApiKey) {
        throw new Error('Demo key was not returned by admin endpoint');
      }

      const requests = [
        'What is 2+2?',
        'What is 2+2?',
        'Give me one sentence about API gateways.',
        'Give me one sentence about API gateways.',
        'Why is caching useful?',
        'Why is caching useful?',
      ];

      for (const prompt of requests) {
        await fetch(`${API_BASE_URL}/api/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': userApiKey,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      }

      await loadMetrics(selectedUserId, false);
      setStatusMessage('Demo traffic generated successfully. Metrics refreshed.');
    } catch (generateError) {
      const message = (generateError as Error).message || 'Failed to generate demo traffic';
      setError(message);
      setStatusMessage(`Demo traffic failed: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  const fallbackMetrics: UserMetrics = {
    totalRequests: 0,
    totalCost: 0,
    totalTokens: 0,
    avgResponseTime: 0,
    cacheHitRate: 0,
  };

  const metrics = data?.metrics || fallbackMetrics;
  const endpointStats = data?.endpointStats || [];
  const modelStats = data?.modelStats || [];
  const latestSpending = useMemo(() => {
    if (!data?.spendingTrend?.length) {
      return { cost: 0, tokens: 0 };
    }
    return data.spendingTrend[0];
  }, [data]);

  const maxModelCost = useMemo(() => {
    if (!modelStats.length) {
      return 1;
    }
    return Math.max(...modelStats.map((item) => item.totalCost), 1);
  }, [modelStats]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">API Gateway Observatory</p>
          <h1>Live system pulse, cost control, and cache efficiency.</h1>
          <p className="subhead">
            A compact operations view of latency, spend, and rate limits across
            AI providers.
          </p>
          <div className="controls-row">
            <label className="user-picker">
              <span>User</span>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {DASHBOARD_USERS.map((userId: string) => (
                  <option key={userId} value={userId}>
                    {userId}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ghost"
              onClick={handleGenerateDemoTraffic}
              disabled={isGenerating || isLoading}
            >
              {isGenerating ? 'Generating...' : 'Generate demo traffic'}
            </button>
            <button className="ghost" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
              {isRefreshing ? 'Refreshing...' : 'Refresh now'}
            </button>
          </div>
          <div className="meta-row">
            <span className="meta">
              Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
            </span>
          </div>
          <div className="chip-row">
            <span className="chip">User: {selectedUserId}</span>
            <span className="chip">Redis cache</span>
            <span className="chip">Postgres metrics</span>
            <span className="chip">Live: {isSocketConnected ? 'connected' : 'disconnected'}</span>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-title">Today</div>
          <div className="panel-value">${latestSpending.cost.toFixed(2)}</div>
          <div className="panel-caption">Total spend</div>
          <div className="panel-grid">
            <div>
              <span>Tokens</span>
              <strong>{latestSpending.tokens.toLocaleString()}</strong>
            </div>
            <div>
              <span>Cache hit</span>
              <strong>{(metrics.cacheHitRate * 100).toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? <p className="status">Loading metrics...</p> : null}
      {error ? <p className="status error">{error}</p> : null}
      {statusMessage ? <p className={`status ${statusMessage.includes('failed') ? 'error' : 'success'}`}>{statusMessage}</p> : null}

      <section className="stats">
        <div className="stat-card">
          <p>Total requests</p>
          <h2>{metrics.totalRequests.toLocaleString()}</h2>
          <span className="delta">Last 7 days</span>
        </div>
        <div className="stat-card">
          <p>Avg latency</p>
          <h2>{metrics.avgResponseTime.toFixed(0)} ms</h2>
          <span className="delta">Across all requests</span>
        </div>
        <div className="stat-card">
          <p>Cache hit rate</p>
          <h2>{(metrics.cacheHitRate * 100).toFixed(1)}%</h2>
          <span className="delta">From stored metrics</span>
        </div>
        <div className="stat-card">
          <p>Total cost</p>
          <h2>${metrics.totalCost.toFixed(2)}</h2>
          <span className="delta">Tracked spend</span>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <div className="card-header">
            <h3>Cost by model</h3>
            <button className="ghost">Last 7 days</button>
          </div>
          <div className="bars">
            {modelStats.map((row) => (
              <div key={row.model} className="bar">
                <span>{row.model}</span>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${(row.totalCost / maxModelCost) * 100}%` }}
                  />
                </div>
                <strong>${row.totalCost.toFixed(2)}</strong>
              </div>
            ))}
            {!modelStats.length ? <p className="empty">No model usage data yet.</p> : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top endpoints</h3>
            <button className="ghost">Live</button>
          </div>
          <div className="table">
            <div className="row header">
              <span>Endpoint</span>
              <span>Requests</span>
              <span>Latency</span>
            </div>
            {endpointStats.map((row) => (
              <div key={row.endpoint} className="row">
                <span className="mono">{row.endpoint}</span>
                <span>{row.requestCount.toLocaleString()}</span>
                <span>{row.avgResponseTime.toFixed(0)} ms</span>
              </div>
            ))}
            {!endpointStats.length ? <p className="empty">No endpoint data yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="card wide">
        <div className="card-header">
          <h3>System overview</h3>
          <div className="chip-row">
            <span className="chip">Healthy</span>
            <span className="chip">No alerts</span>
          </div>
        </div>
        <div className="overview">
          <div>
            <p>Queue depth</p>
            <strong>0</strong>
          </div>
          <div>
            <p>Total tokens</p>
            <strong>{metrics.totalTokens.toLocaleString()}</strong>
          </div>
          <div>
            <p>Models used</p>
            <strong>{modelStats.length}</strong>
          </div>
          <div>
            <p>Period</p>
            <strong>{data?.period || 'Last 7 days'}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
