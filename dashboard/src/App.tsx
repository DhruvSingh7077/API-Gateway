const mockStats = {
  totalRequests: 12493,
  avgLatencyMs: 182,
  cacheHitRate: 42.7,
  totalCostUsd: 12.48,
  tokensToday: 38210,
  throttled: 19,
};

const costBreakdown = [
  { model: 'gpt-3.5-turbo', cost: 7.62 },
  { model: 'gpt-4-turbo', cost: 3.12 },
  { model: 'claude-3-sonnet', cost: 1.74 },
];

const topEndpoints = [
  { name: '/v1/chat/completions', count: 8430, latency: 176 },
  { name: '/v1/messages', count: 2190, latency: 212 },
  { name: '/v1/completions', count: 1180, latency: 241 },
];

export default function App() {
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
          <div className="chip-row">
            <span className="chip">Mock backend enabled</span>
            <span className="chip">Redis cache</span>
            <span className="chip">Postgres metrics</span>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-title">Today</div>
          <div className="panel-value">${mockStats.totalCostUsd.toFixed(2)}</div>
          <div className="panel-caption">Total spend</div>
          <div className="panel-grid">
            <div>
              <span>Tokens</span>
              <strong>{mockStats.tokensToday.toLocaleString()}</strong>
            </div>
            <div>
              <span>Cache hit</span>
              <strong>{mockStats.cacheHitRate.toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="stats">
        <div className="stat-card">
          <p>Total requests</p>
          <h2>{mockStats.totalRequests.toLocaleString()}</h2>
          <span className="delta up">+12% week</span>
        </div>
        <div className="stat-card">
          <p>Avg latency</p>
          <h2>{mockStats.avgLatencyMs} ms</h2>
          <span className="delta down">-6% week</span>
        </div>
        <div className="stat-card">
          <p>Cache hit rate</p>
          <h2>{mockStats.cacheHitRate.toFixed(1)}%</h2>
          <span className="delta up">+9% week</span>
        </div>
        <div className="stat-card">
          <p>Rate limits</p>
          <h2>{mockStats.throttled}</h2>
          <span className="delta">Events</span>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <div className="card-header">
            <h3>Cost by model</h3>
            <button className="ghost">Last 7 days</button>
          </div>
          <div className="bars">
            {costBreakdown.map((row) => (
              <div key={row.model} className="bar">
                <span>{row.model}</span>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${(row.cost / 8) * 100}%` }}
                  />
                </div>
                <strong>${row.cost.toFixed(2)}</strong>
              </div>
            ))}
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
            {topEndpoints.map((row) => (
              <div key={row.name} className="row">
                <span className="mono">{row.name}</span>
                <span>{row.count.toLocaleString()}</span>
                <span>{row.latency} ms</span>
              </div>
            ))}
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
            <p>Redis latency</p>
            <strong>1.2 ms</strong>
          </div>
          <div>
            <p>DB latency</p>
            <strong>6.8 ms</strong>
          </div>
          <div>
            <p>Error rate</p>
            <strong>0.3%</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
