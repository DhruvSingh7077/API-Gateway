-- Database initialization script for API Gateway

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: api_keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    rate_limit_per_minute INTEGER DEFAULT 100,
    daily_budget_usd DECIMAL(10,2) DEFAULT 50.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Table: requests
CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    model VARCHAR(100),
    cached BOOLEAN DEFAULT false,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for requests
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_user_timestamp ON requests(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_endpoint ON requests(endpoint);
CREATE INDEX IF NOT EXISTS idx_requests_api_key_id ON requests(api_key_id);

-- Table: backend_configs
CREATE TABLE IF NOT EXISTS backend_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    api_key_env_var VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default backend configurations
INSERT INTO backend_configs (name, base_url, api_key_env_var) 
VALUES 
    ('openai', 'https://api.openai.com', 'OPENAI_API_KEY'),
    ('anthropic', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY')
ON CONFLICT (name) DO NOTHING;

-- View: daily_usage_stats
CREATE OR REPLACE VIEW daily_usage_stats AS
SELECT 
    user_id,
    DATE(timestamp) as date,
    COUNT(*) as request_count,
    SUM(cost_usd) as total_cost_usd,
    SUM(tokens_used) as total_tokens,
    AVG(response_time_ms) as avg_response_time_ms,
    SUM(CASE WHEN cached THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate
FROM requests
GROUP BY user_id, DATE(timestamp);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gateway_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gateway_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
END $$;
