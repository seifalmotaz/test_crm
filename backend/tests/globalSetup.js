const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  // Load .env so DATABASE_URL_TEST (and DATABASE_URL fallback) are available
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

  const url = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set');

  process.env.DATABASE_URL = url;

  // Sync schema to test DB using db push (project uses db push, not migrate)
  execSync('npx prisma db push --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: url },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });
};
