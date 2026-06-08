import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';

// Ensure DATABASE_URL points to test database for all imports
const testUrl = process.env.DATABASE_URL_TEST ||
  'postgresql://postgres:password@localhost:5432/estate_crm_test';
process.env.DATABASE_URL = testUrl;

beforeAll(async () => {
  // Run migrations on test database
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
