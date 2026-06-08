import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Load .env file if it exists (vitest doesn't auto-load .env)
if (fs.existsSync(path.resolve(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx);
      const value = trimmed.slice(eqIdx + 1);
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export default defineConfig({
  test: {
    globals: true,
    root: './',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:password@localhost:5432/estate_crm_test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
