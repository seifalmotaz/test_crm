/**
 * REINDEX — Index Rebuilding & Health Management
 *
 * WHY INDEXES DEGRADE
 * PostgreSQL B-tree indexes mirror the heap's MVCC model: every UPDATE on an
 * indexed column creates a new index entry pointing to the new row version and
 * leaves the old entry as dead. VACUUM eventually marks those dead index entries
 * as reusable, but it does NOT compact the index pages. Over time:
 *
 *   1. FRAGMENTATION — index pages become half-empty after many deletes.
 *      Each page read returns fewer useful entries → more I/O per query.
 *
 *   2. BLOAT — the index file grows larger than the actual data warrants.
 *      A bloated 50 MB index might hold only 20 MB of live entries.
 *
 *   3. UNBALANCED B-TREE — repeated page splits push the tree deeper.
 *      More levels = more page reads per lookup (each level is one I/O).
 *
 * HIGH-CHURN INDEXES IN THIS CRM
 * ┌─────────────────────────────────────┬────────────────────────────────────┐
 * │ Index                               │ Why it degrades fast               │
 * ├─────────────────────────────────────┼────────────────────────────────────┤
 * │ tasks_status_idx                    │ status flips: not_started →        │
 * │                                     │ in_progress → completed → overdue  │
 * │ tasks_due_date_idx                  │ queried constantly, daysOverdue     │
 * │                                     │ recomputed nightly                  │
 * │ leads_score_idx                     │ score updated on every interaction  │
 * │ leads_stage_idx                     │ stage progresses through 6 values   │
 * │ deals_stage_idx                     │ stage changes 5–6 times per deal   │
 * │ deals_agent_id_idx                  │ re-assignments create new entries  │
 * │ properties_status_idx               │ Active → Pending → Sold changes    │
 * └─────────────────────────────────────┴────────────────────────────────────┘
 *
 * REINDEX MODES
 * ┌────────────────────────────────────┬──────────┬───────────────────────────┐
 * │ Command                            │ Lock     │ Use case                  │
 * ├────────────────────────────────────┼──────────┼───────────────────────────┤
 * │ REINDEX INDEX name                 │ Exclusive│ Small tables, maint window│
 * │ REINDEX INDEX CONCURRENTLY name    │ None     │ Production — no downtime  │
 * │ REINDEX TABLE CONCURRENTLY name    │ None     │ Rebuild all table indexes │
 * │ REINDEX DATABASE CONCURRENTLY name │ None     │ Full DB rebuild (rare)    │
 * └────────────────────────────────────┴──────────┴───────────────────────────┘
 *
 * REINDEX CONCURRENTLY (PostgreSQL 12+) builds a brand-new index alongside
 * the existing one, then atomically swaps it in. During the build, reads
 * and writes continue uninterrupted. The cost is ~2× the disk I/O and
 * ~2× the time vs. a locking REINDEX.
 *
 * HOT UPDATES — Why indexed columns matter
 * Heap Only Tuple (HOT) is PostgreSQL's fast-path for updates: if the updated
 * column is NOT indexed and the new row fits on the same heap page, PostgreSQL
 * updates only the heap — no index write at all. This eliminates index churn.
 *
 * Consequence for schema design:
 *   • tasks.status   IS indexed  → every status change = full index write  (bloat)
 *   • tasks.dueDate  IS indexed  → date recalcs = full index write          (bloat)
 *   • deals.closingProbability NOT indexed → updates are HOT              (no bloat)
 *   • leads.notes    NOT indexed → updates are HOT                        (no bloat)
 *
 * FILL FACTOR — pre-reserve space for HOT updates on the same page
 * Default fill factor = 100% (pages packed completely).
 * At 100%, any update must write to a new page → HOT impossible → index write.
 * At 70%, 30% of each page stays empty → updates land on same page → HOT possible.
 * Trade-off: 70% fill = ~43% larger table file, but far less index churn.
 */

const { prisma } = require('../config/database');

// ─── Index inventory: every named index in our schema ────────────────────────

const CRM_INDEXES = {
  // deals (stage changes 5–6× per deal life cycle)
  deals: [
    'deals_stage_idx',
    'deals_agent_id_idx',
    'deals_target_close_date_idx',
    'deals_is_deleted_idx',
  ],
  // leads (score updated on every interaction)
  leads: [
    'leads_stage_idx',
    'leads_agent_id_idx',
    'leads_score_idx',
    'leads_source_idx',
    'leads_is_deleted_idx',
  ],
  // tasks (status flips constantly — highest churn index in the system)
  tasks: [
    'tasks_status_idx',
    'tasks_priority_idx',
    'tasks_assignee_id_idx',
    'tasks_due_date_idx',
    'tasks_category_idx',
    'tasks_is_deleted_idx',
  ],
  // properties
  properties: [
    'properties_status_idx',
    'properties_type_idx',
    'properties_neighborhood_idx',
    'properties_agent_id_idx',
    'properties_price_idx',
    'properties_is_deleted_idx',
  ],
  // lower-churn tables
  clients: ['clients_tier_idx', 'clients_status_idx', 'clients_is_deleted_idx'],
  agents:  ['agents_tier_idx',  'agents_rank_idx'],
};

// Flat list ordered by expected bloat rate
const HIGH_CHURN_INDEXES = [
  'tasks_status_idx',
  'tasks_due_date_idx',
  'leads_score_idx',
  'leads_stage_idx',
  'deals_stage_idx',
  'properties_status_idx',
  'tasks_assignee_id_idx',
  'deals_agent_id_idx',
];

// Allowlists derived from CRM_INDEXES — validate all external name inputs
// before interpolating them into DDL statements.
const VALID_INDEX_NAMES = new Set(Object.values(CRM_INDEXES).flat());
const VALID_TABLE_NAMES = new Set(Object.keys(CRM_INDEXES));

function assertValidIndex(name) {
  if (!VALID_INDEX_NAMES.has(name))
    throw new Error(`Unrecognised index name: ${JSON.stringify(name)}`);
}

function assertValidTable(name) {
  if (!VALID_TABLE_NAMES.has(name))
    throw new Error(`Unrecognised table name: ${JSON.stringify(name)}`);
}

// ─── Index health analysis ────────────────────────────────────────────────────

/**
 * Full index health report from pg_stat_user_indexes.
 *
 * Metrics:
 *   idx_scan          how many times the planner has used this index
 *   idx_tup_read      tuples returned by index scans (live + dead)
 *   idx_tup_fetch     tuples actually fetched from heap after index scan
 *   index_size_bytes  physical size of the index file
 *   bloat_ratio_pct   estimated bloat (index size / expected size)
 *   efficiency_pct    idx_tup_fetch / idx_tup_read — how many reads turn
 *                     into actual heap fetches (low = many dead entries)
 */
async function getIndexHealth(minBloatPct = 0) {
  const rows = await prisma.$queryRaw`
    SELECT
      s.indexrelname                                      AS index_name,
      s.relname                                           AS table_name,
      s.idx_scan                                          AS total_scans,
      s.idx_tup_read                                      AS tuples_read,
      s.idx_tup_fetch                                     AS tuples_fetched,
      pg_size_pretty(pg_relation_size(s.indexrelid))     AS index_size,
      pg_relation_size(s.indexrelid)                      AS index_size_bytes,
      pg_size_pretty(pg_relation_size(s.relid))          AS table_size,
      pg_relation_size(s.relid)                           AS table_size_bytes,
      CASE
        WHEN pg_relation_size(s.relid) = 0 THEN 0
        ELSE ROUND(
          100.0 * pg_relation_size(s.indexrelid)
                / NULLIF(pg_relation_size(s.relid), 0),
          1
        )
      END                                                 AS size_vs_table_pct,
      CASE
        WHEN s.idx_tup_read = 0 THEN NULL
        ELSE ROUND(100.0 * s.idx_tup_fetch / s.idx_tup_read, 1)
      END                                                 AS efficiency_pct,
      t.n_live_tup                                        AS table_live_rows,
      t.n_dead_tup                                        AS table_dead_rows
    FROM pg_stat_user_indexes s
    JOIN pg_stat_user_tables  t ON t.relid = s.relid
    ORDER BY pg_relation_size(s.indexrelid) DESC
  `;

  return rows
    .map(r => {
      const sizeBytes   = Number(r.index_size_bytes);
      const tableBytes  = Number(r.table_size_bytes);
      const liveRows    = Number(r.table_live_rows);
      const deadRows    = Number(r.table_dead_rows);
      const totalScans  = Number(r.total_scans);
      const efficiency  = r.efficiency_pct ? Number(r.efficiency_pct) : null;

      // Estimate bloat: compare index size to a healthy estimate
      // Healthy: index size ≈ 30–60% of table size for a B-tree on one column
      const sizeVsTable = Number(r.size_vs_table_pct);

      // Bloat signal: index is > 2× what we'd expect for the live row count
      const estimatedCleanSizeBytes = liveRows > 0
        ? Math.round(liveRows * (sizeBytes / Math.max(liveRows + deadRows, 1)))
        : sizeBytes;
      const bloatRatioPct = sizeBytes > 0
        ? Math.round(100 * (1 - estimatedCleanSizeBytes / sizeBytes))
        : 0;

      // Decision: needs reindex?
      const needsReindex = (
        bloatRatioPct >= 30         // significantly bloated
        || (efficiency !== null && efficiency < 50 && totalScans > 100)  // many dead reads
        || (totalScans === 0 && sizeBytes > 50_000)  // unused index wasting space
      );

      return {
        indexName:          r.index_name,
        tableName:          r.table_name,
        totalScans,
        tuplesRead:         Number(r.tuples_read),
        tuplesFetched:      Number(r.tuples_fetched),
        indexSize:          r.index_size,
        indexSizeBytes:     sizeBytes,
        sizeVsTablePct:     sizeVsTable,
        efficiencyPct:      efficiency,
        estimatedBloatPct:  bloatRatioPct,
        liveRows,
        deadRows,
        needsReindex,
        unused:             totalScans === 0,
        recommendation:     totalScans === 0
          ? 'CONSIDER DROPPING — zero scans since last stats reset'
          : bloatRatioPct >= 50
          ? 'REINDEX CONCURRENTLY — severely bloated'
          : bloatRatioPct >= 30
          ? 'REINDEX CONCURRENTLY — moderately bloated'
          : efficiency !== null && efficiency < 50
          ? 'REINDEX CONCURRENTLY — low read efficiency'
          : 'OK',
      };
    })
    .filter(r => r.estimatedBloatPct >= minBloatPct || r.unused || r.needsReindex);
}

// ─── pgstattuple detail (needs pgstattuple extension + superuser) ─────────────

/**
 * Precise per-index bloat using pgstattuple extension.
 * Returns exact live/dead leaf page counts and avg_leaf_density.
 *
 * avg_leaf_density < 50%  → pages are half-empty → REINDEX will halve index size
 * leaf_fragmentation > 40% → pages are scattered  → REINDEX will speed up scans
 *
 * Requires: CREATE EXTENSION pgstattuple;  (superuser)
 */
async function getDetailedBloat(indexName) {
  try {
    assertValidIndex(indexName);
    // pgstatindex() takes the index name as a TEXT value, not a SQL identifier,
    // so the tagged-template form of $queryRaw can parameterize it safely.
    const [row] = await prisma.$queryRaw`SELECT * FROM pgstatindex(${indexName})`;
    return {
      indexName,
      version:          row.version,
      treeLevel:        row.tree_level,
      indexSizeBytes:   Number(row.index_size),
      rootBlockNo:      row.root_block_no,
      internalPages:    row.internal_pages,
      leafPages:        row.leaf_pages,
      emptyPages:       row.empty_pages,
      deletedPages:     row.deleted_pages,
      avgLeafDensity:   Number(row.avg_leaf_density),
      leafFragmentation:Number(row.leaf_fragmentation),
      needsReindex:     Number(row.avg_leaf_density) < 50
                     || Number(row.leaf_fragmentation) > 40,
    };
  } catch {
    return { indexName, error: 'pgstattuple extension not available — install with: CREATE EXTENSION pgstattuple' };
  }
}

// ─── REINDEX operations ───────────────────────────────────────────────────────

/**
 * REINDEX INDEX CONCURRENTLY — rebuilds one index without any locking.
 * Safe to run against a live production database.
 *
 * What happens internally:
 *   1. New index is built alongside the old one (both maintained during build)
 *   2. Once complete, a brief metadata swap makes the new index live
 *   3. Old index is dropped
 *
 * Limitations:
 *   • Cannot run inside a transaction block
 *   • Takes ~2× the time of a locking REINDEX
 *   • Temporarily uses 2× the disk space during the build
 */
async function reindexOne(indexName) {
  assertValidIndex(indexName);
  const start = Date.now();
  // Must be outside a transaction; Prisma's $executeRawUnsafe runs outside
  await prisma.$executeRawUnsafe(`REINDEX INDEX CONCURRENTLY "${indexName}"`);
  return {
    indexName,
    mode:       'REINDEX INDEX CONCURRENTLY',
    durationMs: Date.now() - start,
  };
}

/**
 * REINDEX TABLE CONCURRENTLY — rebuilds every index on the table, one by one.
 * No lock held; the table remains readable and writable throughout.
 */
async function reindexTable(tableName) {
  assertValidTable(tableName);
  const start = Date.now();
  await prisma.$executeRawUnsafe(`REINDEX TABLE CONCURRENTLY "${tableName}"`);
  return {
    tableName,
    mode:       'REINDEX TABLE CONCURRENTLY',
    durationMs: Date.now() - start,
  };
}

/**
 * Locking REINDEX — for use inside a maintenance window only.
 * Faster than CONCURRENTLY but blocks all reads/writes on the index.
 */
async function reindexLocking(indexName) {
  assertValidIndex(indexName);
  const start = Date.now();
  await prisma.$executeRawUnsafe(`REINDEX INDEX "${indexName}"`);
  return {
    indexName,
    mode:       'REINDEX INDEX (blocking)',
    durationMs: Date.now() - start,
    warning:    'Exclusive lock was held — run only during maintenance windows',
  };
}

// ─── Automated: reindex only what needs it ───────────────────────────────────

/**
 * Inspect all CRM indexes; reindex only those whose bloat estimate
 * exceeds the threshold or whose read efficiency is poor.
 * Uses CONCURRENTLY throughout — safe at any time.
 *
 * Typical runtime: 30 seconds – 5 minutes depending on table sizes.
 * Schedule: weekly, after nightly VACUUM.
 */
async function runSmartReindex(options = {}) {
  const {
    bloatThreshold   = 30,   // % — reindex if estimated bloat exceeds this
    efficiencyFloor  = 50,   // % — reindex if efficiency (fetch/read) drops below
    minScansForCheck = 50,   // don't reindex unused indexes by default
    dryRun           = false,
  } = options;

  const health  = await getIndexHealth();
  const targets = health.filter(idx => {
    if (idx.unused) return false; // don't reindex unused (might want to DROP instead)
    if (idx.estimatedBloatPct >= bloatThreshold) return true;
    if (idx.efficiencyPct !== null
        && idx.efficiencyPct < efficiencyFloor
        && idx.totalScans >= minScansForCheck) return true;
    return false;
  });

  const results = [];
  const errors  = [];

  for (const idx of targets) {
    if (dryRun) {
      results.push({
        indexName:   idx.indexName,
        action:      'DRY RUN — would reindex',
        bloatPct:    idx.estimatedBloatPct,
        efficiencyPct: idx.efficiencyPct,
      });
      continue;
    }

    try {
      const r = await reindexOne(idx.indexName);
      results.push({ ...r, bloatBefore: idx.estimatedBloatPct, efficiencyBefore: idx.efficiencyPct });
      console.log(`[REINDEX] ✓ ${idx.indexName} (${r.durationMs}ms)`);
    } catch (err) {
      errors.push({ indexName: idx.indexName, error: err.message });
      console.error(`[REINDEX] ✗ ${idx.indexName}: ${err.message}`);
    }
  }

  return {
    scanned:   health.length,
    targeted:  targets.length,
    completed: results.length,
    errors,
    results,
    dryRun,
    completedAt: new Date().toISOString(),
  };
}

// ─── Unused index detection ───────────────────────────────────────────────────

/**
 * Indexes that have never been used since the last stats reset.
 * These waste disk space and slow down every write (the index must be
 * maintained even though queries never use it).
 *
 * Note: pg_stat_user_indexes resets on server restart or pg_stat_reset().
 * An index showing 0 scans in the first week of a new server is not
 * necessarily unused — wait for representative traffic before dropping.
 */
async function getUnusedIndexes() {
  const rows = await prisma.$queryRaw`
    SELECT
      s.indexrelname                                   AS index_name,
      s.relname                                        AS table_name,
      s.idx_scan                                       AS total_scans,
      pg_size_pretty(pg_relation_size(s.indexrelid))  AS index_size,
      pg_relation_size(s.indexrelid)                   AS index_size_bytes,
      ix.indexdef                                      AS index_definition
    FROM pg_stat_user_indexes   s
    JOIN pg_indexes              ix
      ON ix.indexname = s.indexrelname
     AND ix.schemaname = 'public'
    WHERE s.idx_scan = 0
      AND NOT ix.indexdef ILIKE '%UNIQUE%'   -- never drop unique constraints
      AND NOT ix.indexdef ILIKE '%PRIMARY%'
    ORDER BY pg_relation_size(s.indexrelid) DESC
  `;

  return rows.map(r => ({
    indexName:      r.index_name,
    tableName:      r.table_name,
    totalScans:     Number(r.total_scans),
    indexSize:      r.index_size,
    indexSizeBytes: Number(r.index_size_bytes),
    definition:     r.index_definition,
    dropStatement:  `DROP INDEX CONCURRENTLY IF EXISTS "${r.index_name}";`,
    note:           'Verify no usage before dropping — stats reset on server restart',
  }));
}

// ─── Duplicate index detection ────────────────────────────────────────────────

/**
 * Duplicate indexes: two indexes on the same table covering the same
 * leading column(s). PostgreSQL keeps both but the query planner only
 * ever uses one. The duplicate wastes disk and slows writes.
 */
async function getDuplicateIndexes() {
  const rows = await prisma.$queryRaw`
    SELECT
      a.indexname AS index_a,
      b.indexname AS index_b,
      a.tablename,
      a.indexdef  AS def_a,
      b.indexdef  AS def_b,
      pg_size_pretty(pg_relation_size(a.indexname::regclass)) AS size_a,
      pg_size_pretty(pg_relation_size(b.indexname::regclass)) AS size_b
    FROM pg_indexes a
    JOIN pg_indexes b
      ON  a.tablename  = b.tablename
      AND a.schemaname = b.schemaname
      AND a.indexname  < b.indexname
      AND (
        a.indexdef = b.indexdef
        OR replace(a.indexdef, a.indexname, '') = replace(b.indexdef, b.indexname, '')
      )
    WHERE a.schemaname = 'public'
    ORDER BY a.tablename
  `;
  return rows;
}

// ─── Fill factor analysis and recommendations ─────────────────────────────────

/**
 * Fill factor controls how full PostgreSQL packs each heap/index page.
 * Default = 100 (completely full). No room for updates on the same page
 * → every update writes to a new page → HOT impossible → index write required.
 *
 * For tables where we UPDATE indexed columns frequently, lowering fill factor
 * to 70–80 keeps space on each page for in-place updates (HOT eligible).
 * Trade-off: table and index files are 20–30% larger.
 *
 * Returns current fill factors and recommendations.
 */
async function getFillFactorReport() {
  const rows = await prisma.$queryRaw`
    SELECT
      c.relname                          AS table_name,
      COALESCE(c.reloptions::text, '{}') AS options,
      t.n_live_tup                        AS live_rows,
      t.n_dead_tup                        AS dead_rows,
      seq_scan,
      idx_scan
    FROM pg_class             c
    JOIN pg_stat_user_tables  t ON t.relname = c.relname
    WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND c.relkind = 'r'
    ORDER BY t.n_dead_tup DESC
  `;

  // Tables where fill factor tuning would help most
  const recommendations = {
    // Very high-churn: indexed column updated constantly
    tasks:      { recommended: 70,  reason: 'status + dueDate indexed and updated on every row daily' },
    leads:      { recommended: 75,  reason: 'score + stage indexed and updated on every interaction' },
    deals:      { recommended: 75,  reason: 'stage indexed and progresses through 6 values per deal' },
    properties: { recommended: 80,  reason: 'status + price occasionally updated' },
    agents:     { recommended: 80,  reason: 'KPI columns updated nightly' },
    clients:    { recommended: 85,  reason: 'daysSinceContact updated nightly' },
  };

  return rows.map(r => {
    const currentFf = r.options.match(/fillfactor=(\d+)/)
      ? parseInt(r.options.match(/fillfactor=(\d+)/)[1])
      : 100;
    const rec = recommendations[r.table_name];
    return {
      tableName:       r.table_name,
      currentFillFactor: currentFf,
      recommendedFillFactor: rec?.recommended ?? currentFf,
      reason:          rec?.reason ?? 'No tuning needed',
      liveRows:        Number(r.live_rows),
      deadRows:        Number(r.dead_rows),
      alterSQL:        rec && currentFf !== rec.recommended
        ? `ALTER TABLE "${r.table_name}" SET (fillfactor = ${rec.recommended});`
        : null,
    };
  });
}

// ─── Apply fill factor settings ───────────────────────────────────────────────

/**
 * Apply fill factor changes to all high-churn tables.
 * After applying, run VACUUM FULL (or CLUSTER) to rewrite the table with
 * the new fill factor applied. Plain VACUUM does NOT change existing pages.
 */
async function applyFillFactors() {
  const settings = [
    ['tasks',      70],
    ['leads',      75],
    ['deals',      75],
    ['properties', 80],
    ['agents',     80],
    ['clients',    85],
  ];
  const results = [];

  for (const [table, fillfactor] of settings) {
    assertValidTable(table);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" SET (fillfactor = ${fillfactor})`
    );
    results.push({
      table,
      fillfactor,
      note: 'Run VACUUM FULL to rewrite table pages with the new fill factor',
    });
    console.log(`[FillFactor] ✓ ${table} → fillfactor=${fillfactor}`);
  }
  return results;
}

// ─── Index rebuild after schema migrations ────────────────────────────────────

/**
 * After a large migration (e.g., backfilling a new column, mass status update)
 * all indexes on affected tables should be rebuilt because:
 *   • The write storm creates massive dead index entries
 *   • The index scan statistics are now stale (ANALYZE needed)
 *   • Some index entries may point to heap rows that moved due to a VACUUM FULL
 *
 * Call this after any migration that touches > 10% of a table's rows.
 */
async function postMigrationReindex(tableNames) {
  const results = [];
  for (const table of tableNames) {
    if (!VALID_TABLE_NAMES.has(table)) {
      results.push({ table, error: 'Skipped — unrecognised table name' });
      continue;
    }
    try {
      const r = await reindexTable(table);
      results.push(r);
      console.log(`[PostMigration REINDEX] ✓ ${table} (${r.durationMs}ms)`);
    } catch (err) {
      results.push({ table, error: err.message });
    }
  }
  // Run ANALYZE to update query planner statistics
  for (const table of tableNames) {
    if (VALID_TABLE_NAMES.has(table)) {
      await prisma.$executeRawUnsafe(`ANALYZE "${table}"`);
    }
  }
  return results;
}

// ─── Weekly REINDEX schedule ──────────────────────────────────────────────────

/**
 * Weekly smart reindex — called by the scheduler every Sunday at 04:00 AM,
 * after the weekly VACUUM FULL maintenance window.
 */
async function runWeeklyReindex() {
  console.log('[REINDEX] Starting weekly smart reindex...');
  const result = await runSmartReindex({ bloatThreshold: 25, efficiencyFloor: 55 });
  console.log(`[REINDEX] Complete: ${result.completed}/${result.targeted} indexes rebuilt`);
  return result;
}

module.exports = {
  // Health monitoring
  getIndexHealth,
  getDetailedBloat,
  getUnusedIndexes,
  getDuplicateIndexes,
  getFillFactorReport,

  // REINDEX operations
  reindexOne,
  reindexTable,
  reindexLocking,
  runSmartReindex,
  runWeeklyReindex,
  postMigrationReindex,

  // Fill factor
  applyFillFactors,

  // Constants
  CRM_INDEXES,
  HIGH_CHURN_INDEXES,
};
