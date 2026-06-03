/**
 * One-time script: apply per-table autovacuum tuning.
 * Run AFTER initial migration: node scripts/tune-autovacuum.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Applying autovacuum tuning...\n');

  const configs = [
    // [table, vacuum_scale, analyze_scale, cost_delay, threshold]
    ['deals',      0.05, 0.02,  2,  10],
    ['leads',      0.05, 0.02,  2,  10],
    ['tasks',      0.05, 0.02,  5,  20],
    ['properties', 0.05, 0.05, 10,  50],
    ['agents',     0.05, 0.05,  5,   5],
    ['clients',    0.05, 0.05,  5,  20],
  ];

  for (const [table, vacScale, anScale, costDelay, threshold] of configs) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "${table}" SET (
        autovacuum_vacuum_scale_factor  = ${vacScale},
        autovacuum_analyze_scale_factor = ${anScale},
        autovacuum_vacuum_cost_delay    = ${costDelay},
        autovacuum_vacuum_threshold     = ${threshold}
      )
    `);
    console.log(`  ✓ ${table} tuned (vacuum at ${vacScale * 100}% dead rows)`);
  }

  // Enable pg_stat_statements for slow-query monitoring (if not already enabled)
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
    console.log('  ✓ pg_stat_statements extension enabled');
  } catch {
    console.log('  ~ pg_stat_statements: requires superuser or already enabled');
  }

  console.log('\n✅ Autovacuum tuning applied.\n');
  console.log('Verify with:');
  console.log('  SELECT relname, reloptions FROM pg_class WHERE reloptions IS NOT NULL ORDER BY relname;');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
