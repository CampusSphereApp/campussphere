import { defineConfig } from 'vitest/config';

// Unit tests never need a developer's database or signing credentials.
export default defineConfig({ test: { env: {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unit_test:unit_test@127.0.0.1:1/campussphere_unit_test',
  JWT_SECRET: 'unit-test-access-secret-0000000000000000',
  JWT_REFRESH_SECRET: 'unit-test-refresh-secret-000000000000000',
  FRONTEND_URL: 'http://127.0.0.1:5500',
  GOOGLE_CLIENT_ID: 'unit-test-client-id'
} } });
