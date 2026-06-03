/**
 * CLUSTER — Physical Table Reorganization (Monthly)
 *
 * WHY CLUSTER?
 * PostgreSQL heap files store rows in insertion order, not any meaningful sort
 * order. Over time, as rows are updated and deleted, the physical ordering
 * diverges from the logical ordering used by the most common queries. The result:
 *
 *   1. RANDOM I/O — an index range scan must fetch heap pages scattered across
 *      the file. Each page read is a separate I/O. Sequential heap access reads
 *      pages in order, which allows OS read-ahead to prefetch the next page while
 *      the current one is being processed.
 *
 *   2. POOR CACHE UTILISATION — scattered rows mean multiple heap pages must be
 *      loaded to retrieve a small result set. Clustered rows fit more results per
 *      page → fewer page reads → better shared_buffers hit rate.
 *
 *   3. TABLE BLOAT — the same dead rows that cause index bloat also bloat the
 *      heap. CLUSTER physically rewrites the table (like VACUUM FULL) AND
 *      reorders rows by the chosen index in one pass. Two maintenance tasks, one
 *      lock.
 *
 * CLUSTER vs VACUUM FULL
 * ┌─────────────────────┬──────────────────────────────────────────────────────┐
 * │                     │ VACUUM FULL      │ CLUSTER                           │
 * ├─────────────────────┼──────────────────┼───────────────────────────────────┤
 * │ Reclaims disk space │ Yes              │ Yes                               │
 * │ Rewrites table      │ Yes              │ Yes                               │
 * │ Reorders rows       │ No (heap order)  │ Yes (by chosen index)             │
 * │ Lock held           │ Exclusive        │ Exclusive                         │
 * │ Frequency           │ Weekly (if >30%) │ Monthly (always)                  │
 * │ Maintains ordering  │ No               │ Yes (until next update)           │
 * └─────────────────────┴──────────────────┴───────────────────────────────────┘
 *
 * IMPORTANT: CLUSTER holds an exclusive lock for the full duration. Run only
 * during the maintenance window (01:00 AM first Sunday of month). On tables with
 * millions of rows this can take minutes; plan the window accordingly.
 *
 * After CLUSTER, rows remain physically ordered until UPDATE/INSERT operations
 * gradually disorder them again — hence the monthly cadence.
 *
 * CLUSTER TARGETS FOR THIS CRM
 * ┌──────────────┬────────────────────────────┬───────────────────────────────┐
 * │ Table        │ Cluster Index              │ Why                           │
 * ├──────────────┼────────────────────────────┼───────────────────────────────┤
 * │ tasks        │ tasks_due_date_idx         │ Dashboard: "tasks due this    │
 * │              │                            │ week" — date range scan       │
 * │ leads        │ leads_score_idx            │ Top prospects view: sorted    │
 * │              │                            │ by score DESC                 │
 * │ deals        │ deals_target_close_date_idx│ Pipeline forecast: close date │
 * │              │                            │ range queries                 │
 * │ properties   │ properties_status_idx      │ Listing search: status filter │
 * │              │                            │ is always first               │
 * │ clients      │ clients_tier_idx           │ Client list: grouped by tier  │
 * │ agents       │ agents_rank_idx            │ Leaderboard: ordered by rank  │
 * └──────────────┴────────────────────────────┴───────────────────────────────┘
 */

const { prisma } = require('../config/database');

// ─── Cluster targets ──────────────────────────────────────────────────────────

const CLUSTER_TARGETS = [
  {
    table:  'tasks',
    index:  'tasks_due_date_idx',
    reason: 'Dashboard range scans by due date — date ordering minimises random I/O',
  },
  {
    table:  'leads',
    index:  'leads_score_idx',
    reason: 'Top prospects view fetches by score DESC — physical ordering matches query order',
  },
  {
    table:  'deals',
    index:  'deals_target_close_date_idx',
    reason: 'Pipeline forecast queries scan close date ranges — sequential reads after cluster',
  },
  {
    table:  'properties',
    index:  'properties_status_idx',
    reason: 'Listing search always filters status first — groups active listings on fewer pages',
  },
  {
    table:  'clients',
    index:  'clients_tier_idx',
    reason: 'Client list groups by tier — tier-filtered scans read contiguous pages',
  },
  {
    table:  'agents',
    index:  'agents_rank_idx',
    reason: 'Leaderboard ordered by rank — physical order matches query order',
  },
];

// Allowlists derived from CLUSTER_TARGETS — only cluster known table/index pairs.
const VALID_TABLE_NAMES = new Set(CLUSTER_TARGETS.map(t => t.table));
const VALID_INDEX_NAMES = new Set(CLUSTER_TARGETS.map(t => t.index));

function assertValidTable(name) {
  if (!VALID_TABLE_NAMES.has(name))
    throw new Error(`Unrecognised table name: ${JSON.stringify(name)}`);
}

function assertValidIndex(name) {
  if (!VALID_INDEX_NAMES.has(name))
    throw new Error(`Unrecognised index name: ${JSON.stringify(name)}`);
}

// ─── Core operations ──────────────────────────────────────────────────────────

async function clusterTable(tableName, indexName) {
  assertValidTable(tableName);
  assertValidIndex(indexName);

  const start = Date.now();

  // CLUSTER tableName USING indexName:
  //   1. Marks indexName as the cluster index for future `CLUSTER tableName` calls (no index arg)
  //   2. Rewrites the table heap in index order
  //   3. Rebuilds all indexes on the table
  await prisma.$executeRawUnsafe(`CLUSTER "${tableName}" USING "${indexName}"`);

  // ANALYZE immediately after — the planner needs fresh stats on the rewritten heap
  await prisma.$executeRawUnsafe(`ANALYZE "${tableName}"`);

  return {
    table:      tableName,
    index:      indexName,
    status:     'clustered',
    durationMs: Date.now() - start,
  };
}

// Re-cluster a table that was previously clustered (uses the remembered index — no arg needed)
async function reclusterTable(tableName) {
  assertValidTable(tableName);
  const start = Date.now();
  await prisma.$executeRawUnsafe(`CLUSTER "${tableName}"`);
  await prisma.$executeRawUnsafe(`ANALYZE "${tableName}"`);
  return { table: tableName, status: 'reclustered', durationMs: Date.now() - start };
}

// ─── Monthly run ──────────────────────────────────────────────────────────────

async function runMonthlyCluster(options = {}) {
  const { dryRun = false } = options;

  const results = [];
  const errors  = [];
  const startedAt = new Date().toISOString();

  // Get current bloat stats for context (not used to gate clustering — we cluster monthly always)
  const bloatRows = await prisma.$queryRaw`
    SELECT
      relname                                                                AS table_name,
      n_live_tup                                                             AS live_rows,
      n_dead_tup                                                             AS dead_rows,
      ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
      pg_size_pretty(pg_total_relation_size(relid))                         AS total_size,
      pg_total_relation_size(relid)                                         AS total_bytes
    FROM pg_stat_user_tables
    WHERE relname = ANY(${CLUSTER_TARGETS.map(t => t.table)})
    ORDER BY total_bytes DESC
  `;
  const statsMap = Object.fromEntries(bloatRows.map(r => [r.table_name, r]));

  for (const target of CLUSTER_TARGETS) {
    const stats = statsMap[target.table] || {};

    if (dryRun) {
      results.push({
        table:    target.table,
        index:    target.index,
        status:   'would-cluster',
        liveRows: stats.live_rows ?? null,
        deadPct:  stats.dead_pct  ?? null,
        totalSize: stats.total_size ?? null,
        reason:   target.reason,
      });
      continue;
    }

    try {
      const r = await clusterTable(target.table, target.index);
      results.push({
        ...r,
        liveRows:  stats.live_rows  ?? null,
        deadPct:   stats.dead_pct   ?? null,
        totalSize: stats.total_size ?? null,
        reason:    target.reason,
      });
    } catch (err) {
      errors.push({ table: target.table, error: err.message });
    }
  }

  return {
    dryRun,
    startedAt,
    completedAt: new Date().toISOString(),
    results,
    errors,
  };
}

// ─── Status & reporting ───────────────────────────────────────────────────────

// Which tables have a remembered cluster index (set by a prior CLUSTER ... USING ...)
async function getClusterStatus() {
  const rows = await prisma.$queryRaw`
    SELECT
      c.relname                                                              AS table_name,
      i.relname                                                              AS cluster_index,
      ix.indisclustered                                                      AS is_clustered,
      pg_size_pretty(pg_total_relation_size(c.oid))                         AS total_size,
      s.n_live_tup                                                           AS live_rows,
      s.n_dead_tup                                                           AS dead_rows,
      ROUND(s.n_dead_tup::numeric / NULLIF(s.n_live_tup + s.n_dead_tup, 0) * 100, 1) AS dead_pct,
      GREATEST(s.last_vacuum, s.last_autovacuum)                            AS last_vacuum_at,
      s.last_analyze                                                         AS last_analyze_at
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_index ix    ON ix.indrelid = c.oid AND ix.indisclustered = true
    JOIN pg_class i     ON i.oid = ix.indexrelid
    LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname
    WHERE c.relkind = 'r'
    ORDER BY c.relname
  `;
  return {
    clusteredTables: rows,
    targets: CLUSTER_TARGETS,
    note: 'Tables not in clusteredTables have never been CLUSTERed. Run monthly CLUSTER to register the target index.',
  };
}

// ─── Schedule helper ──────────────────────────────────────────────────────────

// True on the first Sunday of each calendar month (day-of-week 0, date 1–7)
function isFirstSundayOfMonth() {
  const d = new Date();
  return d.getDay() === 0 && d.getDate() <= 7;
}

module.exports = {
  CLUSTER_TARGETS,
  clusterTable,
  reclusterTable,
  runMonthlyCluster,
  getClusterStatus,
  isFirstSundayOfMonth,
};
