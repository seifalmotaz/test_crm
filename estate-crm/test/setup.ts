import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';

beforeAll(async () => {
  // Run migrations on test database
  const testUrl = process.env.DATABASE_URL_TEST ||
    'postgresql://estate_crm:estate_crm@localhost:5433/estate_crm_test';

  try {
    execSync(`DATABASE_URL="${testUrl}" bun run db:migrate`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to run test migrations:', error);
    throw error;
  }
});

afterAll(async () => {
  // Cleanup handled by test teardown
  // Tests use the test database and can be re-run
});
