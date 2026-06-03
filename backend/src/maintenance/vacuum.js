/**
 * VACUUM — Dead Row Removal & Table Maintenance
 *
 * WHY VACUUM EXISTS
 * PostgreSQL uses MVCC (Multi-Version Concurrency Control): every UPDATE
 * creates a NEW row version and marks the old one "dead". Every DELETE also
 * marks rows dead instead of removing them immediately. Dead rows ("dead
 * tuples") accumulate until VACUUM reclaims their space.
 *
 * In this CRM, the highest-churn tables are:
 *   leads      → score, stage, lastContact updated constantly
 *   deals      → stage, closingProbability, daysUntilClose change daily
 *   tasks      → status, daysOverdue updated every morning
 *   properties → views counter incremented on every listing view
 *   agents     → KPI columns (revenueYTD, activeDeals) recalculated nightly
 *
 * Without VACUUM those tables bloat, index scans slow down, and sequential
 * scans read pages that are mostly dead rows.
 *
 * VACUUM MODES
 * ┌──────────────────────┬──────────────────────────────────────────────────┐
 * │ Command              │ What it does                                     │
 * ├──────────────────────┼──────────────────────────────────────────────────┤
 * │ VACUUM               │ Marks dead tuples as reusable. No lock.          │
 * │                      │ Space is NOT returned to OS — stays in the file. │
 * │ VACUUM ANALYZE       │ Vacuum + rebuild query-planner statistics.       │
 * │ VACUUM FULL          │ Rewrites the entire table. Reclaims disk space.  │
 * │                      │ Takes an exclusive lock — use in maintenance     │
 * │                      │ windows only (blocks all reads + writes).        │
 * │ VACUUM FREEZE        │ Prevents XID wraparound. Run annually.           │
 * └──────────────────────┴──────────────────────────────────────────────────┘
 *
 * AUTOVACUUM (always on)
 * PostgreSQL's autovacuum daemon runs VACUUM automatically when a table
 * accumulates enough dead tuples (default: 20% of rows + 50 rows).
 * For a high-write CRM we tune those thresholds per-table (see SQL below).
 */

const { prisma } = require('../config/database');

// ─── Tables ordered by expected churn rate ────────────────────────────────────

const HIGH_CHURN_TABLES = [
  'deals',
  'leads',
  'tasks',
  'properties',
  'agents',
];

const ALL_TABLES = [
  ...HIGH_CHURN_TABLES,
  'clients',
  'lead_interactions',
  'deal_milestones',
  'task_subtasks',
  'files',
];

const VALID_TABLE_NAMES = new Set(ALL_TABLES);

// All named indexes in the schema — allowlist for reindexConcurrently().
const VALID_INDEX_NAMES = new Set([
  'tasks_status_idx', 'tasks_priority_idx', 'tasks_assignee_id_idx',
  'tasks_due_date_idx', 'tasks_category_idx', 'tasks_is_deleted_idx',
  'leads_stage_idx', 'leads_agent_id_idx', 'leads_score_idx',
  'leads_source_idx', 'leads_is_deleted_idx',
  'deals_stage_idx', 'deals_agent_id_idx', 'deals_target_close_date_idx',
  'deals_is_deleted_idx',
  'properties_status_idx', 'properties_type_idx', 'properties_neighborhood_idx',
  'properties_agent_id_idx', 'properties_price_idx', 'properties_is_deleted_idx',
  'clients_tier_idx', 'clients_status_idx', 'clients_is_deleted_idx',
  'agents_tier_idx', 'agents_rank_idx',
]);

function assertValidTable(name) {
  if (!VALID_TABLE_NAMES.has(name))
    throw new Error(`Unrecognised table name: ${JSON.stringify(name)}`);
}

function assertValidIndex(name) {
  if (!VALID_INDEX_NAMES.has(name))
    throw new Error(`Unrecognised index name: ${JSON.stringify(name)}`);
}

// ─── Core VACUUM operations ──────────────────────────────────────────────────

/**
 * Standard VACUUM — reclaim dead rows for reuse (no lock, safe at any time).
 * Run after heavy batch operations, nightly ETL, or mass status updates.
 */
async function vacuumTable(tableName, analyze = true) {
  assertValidTable(tableName);
  const start = Date.now();
  const sql = analyze
    ? `VACUUM (ANALYZE, VERBOSE) "${tableName}"`
    : `VACUUM (VERBOSE) "${tableName}"`;

  await prisma.$executeRawUnsafe(sql);

  return {
    table:    tableName,
    mode:     analyze ? 'VACUUM ANALYZE' : 'VACUUM',
    durationMs: Date.now() - start,
  };
}

/**
 * VACUUM FULL — rewrites table to reclaim disk space.
 * ⚠  Takes an EXCLUSIVE LOCK. Run only during a maintenance window.
 * Use when pg_bloat_ratio > 50% (table is more than half dead rows).
 */
async function vacuumFull(tableName) {
  assertValidTable(tableName);
  const start = Date.now();
  await prisma.$executeRawUnsafe(`VACUUM (FULL, ANALYZE, VERBOSE) "${tableName}"`);
  return {
    table:    tableName,
    mode:     'VACUUM FULL',
    durationMs: Date.now() - start,
    warning:  'Exclusive lock was held during execution',
  };
}

/**
 * VACUUM FREEZE — mark rows with a special XID so they never age out.
 * Prevents transaction ID wraparound (a catastrophic database failure).
 * PostgreSQL triggers this automatically at age ~200M transactions, but
 * you can run it proactively during planned maintenance.
 */
async function vacuumFreeze(tableName) {
  assertValidTable(tableName);
  const start = Date.now();
  await prisma.$executeRawUnsafe(`VACUUM (FREEZE, ANALYZE, VERBOSE) "${tableName}"`);
  return {
    table:    tableName,
    mode:     'VACUUM FREEZE',
    durationMs: Date.now() - start,
  };
}

// ─── Standard nightly routine (safe, no locking) ─────────────────────────────

/**
 * Nightly VACUUM ANALYZE on all high-churn tables.
 * Takes 1–10 seconds per table. Safe to run while the API is live.
 * Recommended schedule: 02:00 AM daily.
 */
async function runNightlyVacuum() {
  const results = [];
  const errors  = [];

  for (const table of HIGH_CHURN_TABLES) {
    try {
      const result = await vacuumTable(table, true);
      results.push(result);
      console.log(`[VACUUM] ✓ ${table} (${result.durationMs}ms)`);
    } catch (err) {
      errors.push({ table, error: err.message });
      console.error(`[VACUUM] ✗ ${table}: ${err.message}`);
    }
  }

  return { results, errors, completedAt: new Date().toISOString() };
}

// ─── Bloat monitoring ─────────────────────────────────────────────────────────

/**
 * Inspect dead-tuple ratio for every table in our schema.
 * Returns tables that need attention (dead_ratio > threshold).
 *
 * PostgreSQL stores live/dead counts in pg_stat_user_tables which is
 * updated by autovacuum and ANALYZE — no extra overhead to read it.
 */
async function getBloatReport(deadRatioThreshold = 10) {
  const rows = await prisma.$queryRaw`
    SELECT
      relname                                           AS table_name,
      n_live_tup                                        AS live_rows,
      n_dead_tup                                        AS dead_rows,
      CASE
        WHEN (n_live_tup + n_dead_tup) = 0 THEN 0
        ELSE ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
      END                                               AS dead_ratio_pct,
      last_vacuum                                       AS last_vacuum,
      last_autovacuum                                   AS last_autovacuum,
      last_analyze                                      AS last_analyze,
      last_autoanalyze                                  AS last_autoanalyze,
      pg_size_pretty(pg_total_relation_size(relid))    AS total_size,
      pg_total_relation_size(relid)                     AS total_size_bytes
    FROM pg_stat_user_tables
    ORDER BY n_dead_tup DESC
  `;

  const report = rows.map(r => ({
    table:         r.table_name,
    liveRows:      Number(r.live_rows),
    deadRows:      Number(r.dead_rows),
    deadRatioPct:  Number(r.dead_ratio_pct),
    needsVacuum:   Number(r.dead_ratio_pct) >= deadRatioThreshold,
    lastVacuum:    r.last_vacuum,
    lastAutovacuum:r.last_autovacuum,
    lastAnalyze:   r.last_analyze,
    totalSize:     r.total_size,
    totalSizeBytes:Number(r.total_size_bytes),
  }));

  const needsAttention = report.filter(r => r.needsVacuum);
  const totalDeadRows  = report.reduce((s, r) => s + r.deadRows, 0);

  return { tables: report, needsAttention, totalDeadRows };
}

// ─── Index bloat ──────────────────────────────────────────────────────────────

/**
 * Identify bloated indexes (indexes where a large fraction of pages
 * are dead/wasted). Bloated indexes slow every query that uses them.
 * Fix: REINDEX CONCURRENTLY (no lock) or VACUUM FULL (rebuilds indexes too).
 */
async function getIndexBloat() {
  const rows = await prisma.$queryRaw`
    SELECT
      schemaname,
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
      idx_scan                                      AS scans,
      idx_tup_read                                  AS tuples_read,
      idx_tup_fetch                                 AS tuples_fetched
    FROM pg_stat_user_indexes
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 20
  `;
  return rows;
}

// ─── Transaction ID (XID) wraparound check ───────────────────────────────────

/**
 * XID wraparound: PostgreSQL uses 32-bit transaction IDs.
 * After ~2.1 billion transactions, the counter wraps — and WITHOUT freeze
 * protection, ALL existing rows become "invisible" (catastrophic data loss).
 *
 * Check age: tables with age > 1.5 billion need immediate VACUUM FREEZE.
 * PostgreSQL forces VACUUM FREEZE automatically at ~2 billion to prevent this.
 */
async function checkXidWraparoundRisk() {
  const rows = await prisma.$queryRaw`
    SELECT
      relname                                         AS table_name,
      age(relfrozenxid)                               AS xid_age,
      2147483647 - age(relfrozenxid)                  AS transactions_until_risk,
      pg_size_pretty(pg_total_relation_size(oid))    AS table_size
    FROM pg_class
    WHERE relkind = 'r'
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY age(relfrozenxid) DESC
    LIMIT 10
  `;

  return rows.map(r => ({
    table:                 r.table_name,
    xidAge:                Number(r.xid_age),
    transactionsUntilRisk: Number(r.transactions_until_risk),
    riskLevel: Number(r.xid_age) > 1_500_000_000 ? 'CRITICAL'
             : Number(r.xid_age) > 750_000_000  ? 'WARNING'
             : 'OK',
    tableSize: r.table_size,
  }));
}

// ─── Autovacuum tuning SQL ────────────────────────────────────────────────────

/**
 * Returns the SQL to configure per-table autovacuum for our CRM.
 *
 * Default autovacuum fires at: 20% dead rows + 50 rows threshold.
 * For large tables with 10,000+ rows, 20% = 2,000 dead rows before cleanup.
 * We tune high-churn tables to trigger at 5% (sooner = less bloat).
 *
 * These are the ALTER TABLE commands to run once during DB setup.
 */
function getAutovacuumTuningSQL() {
  return `
-- ─────────────────────────────────────────────────────────────────
-- PropCRM: Per-table autovacuum tuning
-- Run once during initial DB setup or when tables grow past 5,000 rows
-- ─────────────────────────────────────────────────────────────────

-- DEALS: Updated multiple times per day (stage, probability, daysUntilClose)
ALTER TABLE deals SET (
  autovacuum_vacuum_scale_factor     = 0.05,   -- trigger at 5% dead rows
  autovacuum_analyze_scale_factor    = 0.02,   -- update stats at 2% change
  autovacuum_vacuum_cost_delay       = 2,      -- ms between vacuum work units (lower = faster)
  autovacuum_vacuum_threshold        = 10      -- min dead rows before triggering
);

-- LEADS: Score + stage updated constantly (real-time scoring engine)
ALTER TABLE leads SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.02,
  autovacuum_vacuum_cost_delay       = 2,
  autovacuum_vacuum_threshold        = 10
);

-- TASKS: Status + daysOverdue refreshed every morning via cron
ALTER TABLE tasks SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.02,
  autovacuum_vacuum_cost_delay       = 5,
  autovacuum_vacuum_threshold        = 20
);

-- PROPERTIES: views counter hit on every listing page load
ALTER TABLE properties SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.05,
  autovacuum_vacuum_cost_delay       = 10,
  autovacuum_vacuum_threshold        = 50
);

-- AGENTS: KPI columns nightly-recalculated (revenueYTD, activeDeals, etc.)
ALTER TABLE agents SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.05,
  autovacuum_vacuum_cost_delay       = 5,
  autovacuum_vacuum_threshold        = 5        -- small table, low threshold
);

-- CLIENTS: daysSinceContact updated nightly for all rows
ALTER TABLE clients SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.05,
  autovacuum_vacuum_cost_delay       = 5,
  autovacuum_vacuum_threshold        = 20
);

-- Verify settings were applied:
SELECT relname, reloptions
FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND relkind = 'r'
  AND reloptions IS NOT NULL
ORDER BY relname;
`.trim();
}

// ─── REINDEX (for bloated indexes) ───────────────────────────────────────────

/**
 * Rebuild a single index without locking the table.
 * Use when an index's bloat ratio is high (many dead index entries).
 * REINDEX CONCURRENTLY builds a replacement index in the background,
 * then swaps it in — no downtime, no read/write blocks.
 */
async function reindexConcurrently(indexName) {
  assertValidIndex(indexName);
  const start = Date.now();
  // REINDEX CONCURRENTLY cannot run inside a transaction — use $executeRawUnsafe
  await prisma.$executeRawUnsafe(`REINDEX INDEX CONCURRENTLY "${indexName}"`);
  return {
    index:      indexName,
    durationMs: Date.now() - start,
  };
}

// ─── Full maintenance routine (for weekend windows) ──────────────────────────

/**
 * Weekend maintenance routine — more aggressive cleanup.
 * Includes VACUUM FULL on tables whose dead_ratio > 30%.
 * ⚠  Acquires exclusive locks. Run only during a planned maintenance window
 *    (typically Saturday 03:00–05:00 AM when traffic is lowest).
 */
async function runWeeklyMaintenance(options = {}) {
  const { dryRun = false } = options;
  const log = [];

  const bloat = await getBloatReport(30); // threshold: 30% dead rows for FULL
  log.push({ step: 'bloat_scan', tablesAboveThreshold: bloat.needsAttention.length });

  for (const table of bloat.needsAttention) {
    if (dryRun) {
      log.push({ step: 'skip_dry_run', table: table.table, deadRatio: table.deadRatioPct });
      continue;
    }
    try {
      const result = await vacuumFull(table.table);
      log.push({ step: 'vacuum_full', ...result });
    } catch (err) {
      log.push({ step: 'vacuum_full_error', table: table.table, error: err.message });
    }
  }

  // Standard VACUUM ANALYZE for tables below 30% threshold
  const healthyTables = ALL_TABLES.filter(t => !bloat.needsAttention.find(b => b.table === t));
  for (const table of healthyTables) {
    if (dryRun) { log.push({ step: 'skip_dry_run', table, mode: 'VACUUM ANALYZE' }); continue; }
    try {
      const result = await vacuumTable(table, true);
      log.push({ step: 'vacuum_analyze', ...result });
    } catch (err) {
      log.push({ step: 'vacuum_analyze_error', table, error: err.message });
    }
  }

  // XID wraparound check
  const xidRisks = await checkXidWraparoundRisk();
  const critical  = xidRisks.filter(r => r.riskLevel === 'CRITICAL');
  if (critical.length > 0) {
    log.push({ step: 'xid_wraparound_CRITICAL', tables: critical });
    // In production: page the on-call DBA immediately
  }

  return { dryRun, log, completedAt: new Date().toISOString() };
}

module.exports = {
  vacuumTable,
  vacuumFull,
  vacuumFreeze,
  runNightlyVacuum,
  runWeeklyMaintenance,
  getBloatReport,
  getIndexBloat,
  checkXidWraparoundRisk,
  getAutovacuumTuningSQL,
  reindexConcurrently,
  HIGH_CHURN_TABLES,
  ALL_TABLES,
};
