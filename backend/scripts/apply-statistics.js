/**
 * One-time script: apply custom statistics targets and create extended statistics.
 *
 * Run ONCE after the initial migration, or any time you add a new high-churn
 * column that the planner routinely mis-estimates.
 *
 * Usage:
 *   node scripts/apply-statistics.js           # apply targets + create extended stats
 *   node scripts/apply-statistics.js --dry-run # preview SQL without applying
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { applyStatisticsTargets, createExtendedStats, getStaleStats } = require('../src/maintenance/analyze');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`Statistics setup${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

  // 1. Custom statistics targets (higher sample counts for high-cardinality columns)
  console.log('── Statistics targets ─────────────────────────────');
  const targetResult = await applyStatisticsTargets(DRY_RUN);
  for (const t of targetResult.targets) {
    const mark = t.status === 'applied' ? '✓' : t.status === 'dry-run' ? '~' : '✗';
    const detail = t.status === 'dry-run' ? `\n    ${t.sql}` : '';
    console.log(`  ${mark} ${t.table}.${t.column}: target=${t.target}  — ${t.reason}${detail}`);
  }

  // 2. Extended statistics (multi-column correlations)
  console.log('\n── Extended statistics ────────────────────────────');
  const extResult = await createExtendedStats(DRY_RUN);
  for (const s of extResult.results) {
    const mark = s.status === 'created' ? '✓' : s.status === 'dry-run' ? '~' : '✗';
    const detail = s.status === 'dry-run' ? `\n    ${s.sql}` : '';
    console.log(`  ${mark} ${s.name} (${s.table})${detail}`);
    if (s.reason) console.log(`      ${s.reason}`);
  }

  if (!DRY_RUN) {
    // 3. Show staleness after applying
    console.log('\n── Statistics freshness ────────────────────────────');
    const stale = await getStaleStats(0);
    for (const t of stale.tables) {
      console.log(`  ${t.table_name}: ${t.stale_pct ?? 0}% stale (last analyzed: ${t.last_analyzed_at ?? 'never'})`);
    }
  }

  console.log(`\n${DRY_RUN ? '~ Dry run complete — no changes made.' : '✅ Statistics setup complete.'}`);

  if (!DRY_RUN) {
    console.log('\nVerify extended statistics with:');
    console.log('  SELECT stxname, stxrelid::regclass, stxkind FROM pg_statistic_ext;');
    console.log('\nVerify statistics targets with:');
    console.log('  SELECT relname, attname, attstattarget FROM pg_attribute a');
    console.log('  JOIN pg_class c ON c.oid = a.attrelid WHERE attstattarget != -1;');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
