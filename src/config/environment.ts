// src/config/environment.ts
// Purpose: Load and validate environment variables

import dotenv from 'dotenv';

// Load .env file
dotenv.config();

interface Config {
  // Server
  port: number;
  nodeEnv: string;
  
  // Database
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  
  // Redis
  redis: {
    host: string;
    port: number;
    password: string;
  };
  
  // Backend APIs
  backends: {
    openai: string;
    anthropic: string;
  };
  
  // Dashboard
  dashboard: {
    port: number;
    websocketPort: number;
  };
  
  // Security
  adminApiKey: string;
  jwtSecret: string;
  
  // Features
  features: {
    caching: boolean;
    cacheTTL: number;
    rateLimiting: boolean;
    budgetAlerts: boolean;
    costTracking: boolean;
  };
  
  // Defaults
  defaults: {
    rateLimitPerMinute: number;
    dailyBudgetUSD: number;
  };
  
  // Logging
  logLevel: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Export configuration object
export const config: Config = {
  port: getEnvNumber('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  
  postgres: {
    host: getEnvVar('POSTGRES_HOST', 'localhost'),
    port: getEnvNumber('POSTGRES_PORT', 5432),
    database: getEnvVar('POSTGRES_DB', 'api_gateway'),
    user: getEnvVar('POSTGRES_USER', 'gateway_user'),
    password: getEnvVar('POSTGRES_PASSWORD', 'gateway_password'),
  },
  
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: getEnvVar('REDIS_PASSWORD', ''),
  },
  
  backends: {
    openai: getEnvVar('OPENAI_API_KEY', ''),
    anthropic: getEnvVar('ANTHROPIC_API_KEY', ''),
  },
  
  dashboard: {
    port: getEnvNumber('DASHBOARD_PORT', 3001),
    websocketPort: getEnvNumber('DASHBOARD_WEBSOCKET_PORT', 3002),
  },
  
  adminApiKey: getEnvVar('ADMIN_API_KEY', 'admin_default_key_change_this'),
  jwtSecret: getEnvVar('JWT_SECRET', 'default_jwt_secret_min_32_characters_long'),
  
  features: {
    caching: getEnvBoolean('ENABLE_CACHING', true),
    cacheTTL: getEnvNumber('CACHE_TTL_SECONDS', 3600),
    rateLimiting: getEnvBoolean('ENABLE_RATE_LIMITING', true),
    budgetAlerts: getEnvBoolean('ENABLE_BUDGET_ALERTS', true),
    costTracking: getEnvBoolean('ENABLE_COST_TRACKING', true),
  },
  
  defaults: {
    rateLimitPerMinute: getEnvNumber('DEFAULT_RATE_LIMIT_PER_MINUTE', 100),
    dailyBudgetUSD: parseFloat(getEnvVar('DEFAULT_DAILY_BUDGET_USD', '50.00')),
  },
  
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
};

// Validate critical configuration on startup
export function validateConfig(): void {
  console.log('Validating configuration...');
  
  // Check database config
  if (!config.postgres.host || !config.postgres.database) {
    throw new Error('Database configuration is incomplete');
  }
  
  // Check Redis config
  if (!config.redis.host) {
    throw new Error('Redis configuration is incomplete');
  }
  
  // Warn if API keys are missing
  if (!config.backends.openai && !config.backends.anthropic) {
    console.warn('WARNING: No backend API keys configured. Gateway will not be able to proxy requests.');
  }
  
  console.log('✓ Configuration validated successfully');
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Port: ${config.port}`);
  console.log(`  - Database: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);
  console.log(`  - Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`  - Features: Caching=${config.features.caching}, RateLimit=${config.features.rateLimiting}, CostTracking=${config.features.costTracking}`);
}