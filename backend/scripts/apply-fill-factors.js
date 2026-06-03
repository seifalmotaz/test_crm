/**
 * One-time script: apply per-table fill factors to reduce index bloat.
 *
 * Lower fill factors leave free space on heap pages so PostgreSQL can perform
 * HOT updates (Heap Only Tuple) without touching the index. This cuts index
 * bloat significantly on high-churn tables.
 *
 * Run ONCE after the initial migration (or after any REINDEX TABLE to reclaim
 * space with the new setting):
 *
 *   node scripts/apply-fill-factors.js
 *
 * After applying, run REINDEX TABLE on each table so the new fill factor takes
 * effect on existing index pages:
 *
 *   node scripts/apply-fill-factors.js --reindex
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { applyFillFactors, reindexTable } = require('../src/maintenance/reindex');

const REINDEX = process.argv.includes('--reindex');

async function main() {
  console.log('Applying fill factors...\n');
  const result = await applyFillFactors();

  for (const row of result.applied) {
    console.log(`  ✓ ${row.table}: fillfactor=${row.fillFactor} (${row.note})`);
  }

  if (REINDEX) {
    console.log('\nRunning REINDEX TABLE CONCURRENTLY on each table...\n');
    for (const row of result.applied) {
      console.log(`  → REINDEX TABLE CONCURRENTLY "${row.table}"...`);
      const r = await reindexTable(row.table);
      console.log(`    ✓ done (${r.durationMs}ms)`);
    }
    console.log('');
  } else {
    console.log('\nRun with --reindex to also rebuild existing indexes with the new fill factor.\n');
  }

  console.log('✅ Fill factors applied.');
  console.log('\nVerify with:');
  console.log('  SELECT relname, reloptions FROM pg_class WHERE reloptions IS NOT NULL ORDER BY relname;');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
