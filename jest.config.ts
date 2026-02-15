import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
  verbose: true,
  moduleNameMapper: {
    '^node-fetch$': '<rootDir>/tests/mocks/node-fetch.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};

export default config;
