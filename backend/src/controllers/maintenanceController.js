/**
 * Admin-only maintenance endpoints.
 * All routes require role: admin.
 */

const {
  getBloatReport,
  checkXidWraparoundRisk,
  getAutovacuumTuningSQL,
  vacuumTable,
  vacuumFull,
  vacuumFreeze,
  runNightlyVacuum,
  runWeeklyMaintenance,
} = require('../maintenance/vacuum');

const {
  getIndexHealth,
  getDetailedBloat,
  getUnusedIndexes,
  getDuplicateIndexes,
  getFillFactorReport,
  applyFillFactors,
  reindexOne,
  reindexTable,
  reindexLocking,
  runSmartReindex,
  postMigrationReindex,
} = require('../maintenance/reindex');

const {
  clusterTable,
  reclusterTable,
  runMonthlyCluster,
  getClusterStatus,
} = require('../maintenance/cluster');

const {
  analyzeTable,
  analyzeColumns,
  runFullAnalyze,
  getStaleStats,
  getColumnStats,
  getStatisticsTargets,
  setStatisticsTarget,
  applyStatisticsTargets,
  getExtendedStats,
  createExtendedStats,
} = require('../maintenance/analyze');

const { runNow } = require('../maintenance/scheduler');
const { prisma }  = require('../config/database');
const { success } = require('../utils/response');
const { AppError }= require('../utils/AppError');
const catchAsync  = require('../utils/catchAsync');
const cache       = require('../utils/cache');

// ─── GET /api/admin/maintenance/bloat ────────────────────────────────────────
exports.getBloatReport = catchAsync(async (req, res) => {
  const threshold = parseFloat(req.query.threshold) || 10;
  const report    = await getBloatReport(threshold);
  success(res, {
    summary: {
      totalTables:          report.tables.length,
      tablesNeedingVacuum:  report.needsAttention.length,
      totalDeadRows:        report.totalDeadRows,
      threshold:            `${threshold}%`,
    },
    tables:       report.tables,
    needsAttention: report.needsAttention,
  });
});

// ─── GET /api/admin/maintenance/indexes ──────────────────────────────────────
exports.getIndexReport = catchAsync(async (req, res) => {
  const minBloat = parseFloat(req.query.min_bloat) || 0;
  const indexes  = await getIndexHealth(minBloat);
  const needsWork = indexes.filter(i => i.needsReindex);
  success(res, {
    summary: {
      total:       indexes.length,
      needsReindex: needsWork.length,
      minBloatFilter: `${minBloat}%`,
    },
    indexes,
    needsReindex: needsWork,
  });
});

// ─── GET /api/admin/maintenance/xid-risk ─────────────────────────────────────
exports.getXidRisk = catchAsync(async (_req, res) => {
  const risks = await checkXidWraparoundRisk();
  const hasCritical = risks.some(r => r.riskLevel === 'CRITICAL');
  success(res, {
    status:    hasCritical ? 'CRITICAL' : risks.some(r => r.riskLevel === 'WARNING') ? 'WARNING' : 'OK',
    tables:    risks,
    note:      'Run VACUUM FREEZE on any table with riskLevel CRITICAL immediately.',
  });
});

// ─── GET /api/admin/maintenance/autovacuum-sql ───────────────────────────────
exports.getAutovacuumSQL = catchAsync(async (_req, res) => {
  const sql = getAutovacuumTuningSQL();
  success(res, { sql });
});

// ─── GET /api/admin/maintenance/table-stats ───────────────────────────────────
exports.getTableStats = catchAsync(async (_req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT
      relname                                         AS table_name,
      n_live_tup                                      AS live_rows,
      n_dead_tup                                      AS dead_rows,
      n_mod_since_analyze                             AS changes_since_analyze,
      seq_scan                                        AS sequential_scans,
      idx_scan                                        AS index_scans,
      pg_size_pretty(pg_total_relation_size(relid))  AS total_size,
      pg_size_pretty(pg_relation_size(relid))        AS table_size,
      pg_size_pretty(
        pg_total_relation_size(relid)
        - pg_relation_size(relid)
      )                                              AS index_size,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
  `;
  success(res, rows);
});

// ─── GET /api/admin/maintenance/autovacuum-status ────────────────────────────
exports.getAutovacuumStatus = catchAsync(async (_req, res) => {
  // Show tables with their custom autovacuum settings (if any)
  const settings = await prisma.$queryRaw`
    SELECT relname, reloptions
    FROM pg_class
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND relkind = 'r'
      AND reloptions IS NOT NULL
    ORDER BY relname
  `;

  // Show currently running autovacuum workers
  const running = await prisma.$queryRaw`
    SELECT pid, query, state, query_start, wait_event_type, wait_event
    FROM pg_stat_activity
    WHERE query ILIKE '%autovacuum%'
      OR query ILIKE '%vacuum%'
    ORDER BY query_start
  `;

  // Global autovacuum settings
  const globals = await prisma.$queryRaw`
    SELECT name, setting, unit, short_desc
    FROM pg_settings
    WHERE name IN (
      'autovacuum',
      'autovacuum_max_workers',
      'autovacuum_naptime',
      'autovacuum_vacuum_threshold',
      'autovacuum_vacuum_scale_factor',
      'autovacuum_analyze_threshold',
      'autovacuum_analyze_scale_factor',
      'autovacuum_vacuum_cost_delay',
      'maintenance_work_mem'
    )
    ORDER BY name
  `;

  success(res, { globalSettings: globals, perTableSettings: settings, runningWorkers: running });
});

// ─── POST /api/admin/maintenance/vacuum ──────────────────────────────────────
exports.runVacuum = catchAsync(async (req, res) => {
  const { table, mode = 'analyze' } = req.body;

  const validModes = ['analyze', 'full', 'freeze'];
  if (!validModes.includes(mode)) {
    throw AppError.badRequest(`mode must be one of: ${validModes.join(', ')}`);
  }

  let result;

  if (!table || table === 'all') {
    // Vacuum all high-churn tables
    if (mode === 'full') {
      throw AppError.badRequest('VACUUM FULL on all tables is too dangerous via API. Specify a single table or use the scheduler.');
    }
    result = await runNightlyVacuum();
  } else {
    // Validate table name (prevent SQL injection)
    if (!/^[a-z_]+$/.test(table)) throw AppError.badRequest('Invalid table name');

    if (mode === 'full')    result = await vacuumFull(table);
    else if (mode === 'freeze') result = await vacuumFreeze(table);
    else                    result = await vacuumTable(table, true);
  }

  // Invalidate relevant caches after manual vacuum
  cache.invalidatePattern('dashboard:');
  cache.invalidatePattern('analytics:');

  success(res, result);
});

// ─── POST /api/admin/maintenance/reindex ─────────────────────────────────────
// body: { indexName?, tableName?, mode?: 'concurrent'|'locking' }
// Exactly one of indexName or tableName must be provided.
exports.reindex = catchAsync(async (req, res) => {
  const { indexName, tableName, mode = 'concurrent' } = req.body;

  if (!indexName && !tableName) throw AppError.badRequest('indexName or tableName is required');
  if (indexName && tableName)   throw AppError.badRequest('Provide indexName OR tableName, not both');

  const name = (indexName || tableName).replace(/"/g, '');
  if (!/^[a-z_]+$/.test(name)) throw AppError.badRequest('Invalid name — only lowercase letters and underscores allowed');

  if (mode === 'locking' && !indexName) {
    throw AppError.badRequest('locking mode only supported for individual indexes, not tables');
  }

  let result;
  if (indexName) {
    result = mode === 'locking'
      ? await reindexLocking(indexName)
      : await reindexOne(indexName);
  } else {
    result = await reindexTable(tableName);
  }

  success(res, result);
});

// ─── POST /api/admin/maintenance/reindex/smart ────────────────────────────────
// body: { bloatThreshold?, efficiencyFloor?, dryRun? }
exports.runSmartReindex = catchAsync(async (req, res) => {
  const { bloatThreshold = 30, efficiencyFloor = 50, dryRun = false } = req.body;
  const result = await runSmartReindex({ bloatThreshold, efficiencyFloor, dryRun });
  success(res, result);
});

// ─── POST /api/admin/maintenance/reindex/post-migration ──────────────────────
// body: { tables: string[] }
exports.postMigrationReindex = catchAsync(async (req, res) => {
  const { tables } = req.body;
  if (!Array.isArray(tables) || tables.length === 0) {
    throw AppError.badRequest('tables must be a non-empty array of table names');
  }
  for (const t of tables) {
    if (!/^[a-z_]+$/.test(t)) throw AppError.badRequest(`Invalid table name: ${t}`);
  }
  const result = await postMigrationReindex(tables);
  success(res, result);
});

// ─── GET /api/admin/maintenance/index-health/:indexName/detail ───────────────
exports.getDetailedBloat = catchAsync(async (req, res) => {
  const { indexName } = req.params;
  if (!/^[a-z_]+$/.test(indexName)) throw AppError.badRequest('Invalid index name');
  const detail = await getDetailedBloat(indexName);
  success(res, detail);
});

// ─── GET /api/admin/maintenance/unused-indexes ───────────────────────────────
exports.getUnusedIndexes = catchAsync(async (_req, res) => {
  const indexes = await getUnusedIndexes();
  success(res, {
    count: indexes.length,
    note: 'These indexes have never been used since last statistics reset. Verify before dropping.',
    indexes,
  });
});

// ─── GET /api/admin/maintenance/duplicate-indexes ────────────────────────────
exports.getDuplicateIndexes = catchAsync(async (_req, res) => {
  const groups = await getDuplicateIndexes();
  success(res, {
    count: groups.length,
    note: 'Each group covers the same columns on the same table. Keep the one used by queries.',
    groups,
  });
});

// ─── GET /api/admin/maintenance/fill-factors ─────────────────────────────────
exports.getFillFactorReport = catchAsync(async (_req, res) => {
  const report = await getFillFactorReport();
  success(res, report);
});

// ─── POST /api/admin/maintenance/fill-factors/apply ──────────────────────────
exports.applyFillFactors = catchAsync(async (_req, res) => {
  const result = await applyFillFactors();
  success(res, result);
});

// ─── POST /api/admin/maintenance/run-job ─────────────────────────────────────
exports.runJob = catchAsync(async (req, res) => {
  const { job } = req.body;
  if (!job) throw AppError.badRequest('job name is required');

  const result = await runNow(job);
  success(res, { job, result: result || 'completed', triggeredAt: new Date().toISOString() });
});

// ─── GET /api/admin/maintenance/lock-monitor ─────────────────────────────────
exports.getLockMonitor = catchAsync(async (_req, res) => {
  // Show any queries waiting on locks (helps identify if vacuum is blocking)
  const locks = await prisma.$queryRaw`
    SELECT
      blocked.pid                               AS blocked_pid,
      blocked.query                             AS blocked_query,
      blocking.pid                              AS blocking_pid,
      blocking.query                            AS blocking_query,
      blocking.query_start                      AS blocking_started,
      EXTRACT(EPOCH FROM (now() - blocking.query_start))::int AS blocking_seconds
    FROM pg_catalog.pg_locks         AS bl
    JOIN pg_catalog.pg_stat_activity AS blocked  ON bl.pid = blocked.pid
    JOIN pg_catalog.pg_locks         AS kl
      ON kl.transactionid = bl.transactionid AND kl.pid != bl.pid
    JOIN pg_catalog.pg_stat_activity AS blocking ON kl.pid = blocking.pid
    WHERE NOT bl.granted
    ORDER BY blocking_seconds DESC
  `;
  success(res, { locks, capturedAt: new Date().toISOString() });
});

// ─── GET /api/admin/maintenance/slow-queries ──────────────────────────────────
exports.getSlowQueries = catchAsync(async (req, res) => {
  const minMs = parseInt(req.query.min_ms) || 1000;

  const rows = await prisma.$queryRaw`
    SELECT
      query,
      calls,
      ROUND((total_exec_time / calls)::numeric, 2) AS avg_ms,
      ROUND(total_exec_time::numeric, 2)            AS total_ms,
      rows,
      ROUND((100.0 * shared_blks_hit
        / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 1) AS cache_hit_pct
    FROM pg_stat_statements
    WHERE (total_exec_time / calls) >= ${minMs}
    ORDER BY avg_ms DESC
    LIMIT 20
  `;
  // pg_stat_statements extension must be enabled: CREATE EXTENSION pg_stat_statements;
  success(res, rows);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLUSTER endpoints
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/admin/maintenance/cluster/status ───────────────────────────────
exports.getClusterStatus = catchAsync(async (_req, res) => {
  const status = await getClusterStatus();
  success(res, status);
});

// ─── POST /api/admin/maintenance/cluster ─────────────────────────────────────
// body: { table, index? } — omit index to re-cluster using the remembered index
exports.runCluster = catchAsync(async (req, res) => {
  const { table, index } = req.body;
  if (!table) throw AppError.badRequest('table is required');
  if (!/^[a-z_]+$/.test(table)) throw AppError.badRequest('Invalid table name');
  if (index && !/^[a-z_]+$/.test(index)) throw AppError.badRequest('Invalid index name');

  const result = index
    ? await clusterTable(table, index)
    : await reclusterTable(table);

  success(res, result);
});

// ─── POST /api/admin/maintenance/cluster/monthly ─────────────────────────────
// body: { dryRun? }
exports.runMonthlyCluster = catchAsync(async (req, res) => {
  const { dryRun = false } = req.body;
  const result = await runMonthlyCluster({ dryRun });
  success(res, result);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYZE / Statistics endpoints
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/admin/maintenance/stats/stale ──────────────────────────────────
exports.getStaleStats = catchAsync(async (req, res) => {
  const threshold = parseFloat(req.query.threshold) || 10;
  const report    = await getStaleStats(threshold);
  success(res, report);
});

// ─── GET /api/admin/maintenance/stats/column/:table/:column ─────────────────
exports.getColumnStats = catchAsync(async (req, res) => {
  const { table, column } = req.params;
  if (!/^[a-z_]+$/.test(table)) throw AppError.badRequest('Invalid table name');
  const stats = await getColumnStats(table, column);
  if (!stats) throw AppError.notFound(`Statistics for ${table}.${column}`);
  success(res, stats);
});

// ─── GET /api/admin/maintenance/stats/targets ────────────────────────────────
exports.getStatisticsTargets = catchAsync(async (_req, res) => {
  const targets = await getStatisticsTargets();
  success(res, { targets, recommended: require('../maintenance/analyze').STATISTICS_TARGETS });
});

// ─── GET /api/admin/maintenance/stats/extended ───────────────────────────────
exports.getExtendedStats = catchAsync(async (_req, res) => {
  const stats = await getExtendedStats();
  success(res, {
    existing: stats,
    recommended: require('../maintenance/analyze').EXTENDED_STATS,
  });
});

// ─── POST /api/admin/maintenance/stats/analyze ───────────────────────────────
// body: { table? } — omit for full analyze of all CRM tables
exports.runAnalyze = catchAsync(async (req, res) => {
  const { table, columns } = req.body;

  if (table) {
    if (!/^[a-z_]+$/.test(table)) throw AppError.badRequest('Invalid table name');
    const result = columns?.length
      ? await analyzeColumns(table, columns)
      : await analyzeTable(table);
    return success(res, result);
  }

  const result = await runFullAnalyze();
  success(res, result);
});

// ─── POST /api/admin/maintenance/stats/targets/apply ─────────────────────────
// body: { dryRun? }
exports.applyStatisticsTargets = catchAsync(async (req, res) => {
  const { dryRun = false } = req.body;
  const result = await applyStatisticsTargets(dryRun);
  success(res, result);
});

// ─── POST /api/admin/maintenance/stats/extended/create ───────────────────────
// body: { dryRun? }
exports.createExtendedStats = catchAsync(async (req, res) => {
  const { dryRun = false } = req.body;
  const result = await createExtendedStats(dryRun);
  success(res, result);
});
