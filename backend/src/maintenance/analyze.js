/**
 * ANALYZE — Query Planner Statistics
 *
 * WHY STATISTICS MATTER
 * PostgreSQL's query planner estimates the cost of every possible execution plan
 * before choosing which one to run. Those cost estimates are only as good as the
 * underlying statistics: row counts, value distributions, most-common values,
 * and histograms. Stale or missing statistics produce wrong estimates, which lead
 * to wrong plan choices:
 *
 *   • Seq scan chosen instead of index scan (planner thinks fewer rows exist)
 *   • Wrong join order (outer table should be inner, or vice versa)
 *   • Hash join chosen when nested loop would be faster
 *   • Over/under-estimated memory grants for sort and hash operations
 *
 * AUTOVACUUM runs ANALYZE automatically, but only when ≥20% of live rows have
 * changed. After a bulk seed, migration, or large import that touches every row,
 * statistics are immediately stale and a manual ANALYZE is needed.
 *
 * EXTENDED STATISTICS (PostgreSQL 10+)
 * The planner assumes columns are statistically independent by default. When
 * two columns are correlated (e.g., high-score leads cluster in the
 * qualified/negotiating stages), the planner's combined selectivity estimate is
 * too optimistic — it multiplies two individual selectivities, underestimating
 * the result set. Extended statistics capture these column correlations and give
 * the planner accurate combined estimates.
 *
 *   CREATE STATISTICS leads_stage_score_stats ON stage, score FROM leads;
 *   ANALYZE leads;   ← must re-analyze after creating the statistics object
 *
 * CUSTOM STATISTICS TARGETS
 * The planner samples `default_statistics_target` rows (default: 100) when
 * computing histograms. For high-cardinality columns (score 0–100, wide price
 * ranges, date ranges spanning years), more samples = more histogram buckets =
 * more accurate range selectivity estimates.
 *
 *   ALTER TABLE leads ALTER COLUMN score SET STATISTICS 200;
 *
 * Trade-off: higher targets mean slower ANALYZE and larger pg_statistic rows.
 * 200 is the sweet spot for the high-cardinality columns in this CRM.
 *
 * STATISTICS STALENESS
 * pg_stat_user_tables.n_mod_since_analyze tracks how many rows have changed
 * since the last ANALYZE. A stale_pct above 10–15% means the planner's view of
 * the table's data distribution is significantly outdated.
 */

const { prisma } = require('../config/database');

// ─── Table list ───────────────────────────────────────────────────────────────

const CRM_TABLES = ['deals', 'leads', 'tasks', 'properties', 'agents', 'clients'];

const VALID_TABLE_NAMES = new Set(CRM_TABLES);

function assertValidTable(name) {
  if (!VALID_TABLE_NAMES.has(name))
    throw new Error(`Unrecognised table name: ${JSON.stringify(name)}`);
}

// ─── Extended statistics definitions ─────────────────────────────────────────
// Each entry describes a multi-column statistics object that helps the planner
// estimate combined selectivity when WHERE clauses reference both columns.

const EXTENDED_STATS = [
  {
    name:    'tasks_status_priority_stats',
    table:   'tasks',
    columns: ['status', 'priority'],
    reason:  'Dashboard filters always combine status + priority; correlated (overdue tasks are often high-priority)',
  },
  {
    name:    'leads_stage_score_stats',
    table:   'leads',
    columns: ['stage', 'score'],
    reason:  'High-score leads cluster in qualified/negotiating stages — correlated; planner underestimates combined selectivity',
  },
  {
    name:    'deals_stage_agent_stats',
    table:   'deals',
    columns: ['stage', '"agentId"'],
    reason:  'Agent pipeline views filter both; top agents handle disproportionate share of active stages',
  },
  {
    name:    'properties_type_status_stats',
    table:   'properties',
    columns: ['type', 'status'],
    reason:  'Listing search always combines property type + status — correlated (commercial listings rarely show as active)',
  },
  {
    name:    'tasks_assignee_status_stats',
    table:   'tasks',
    columns: ['"assigneeId"', 'status'],
    reason:  'Agent task views filter by both assignee + status; workload is unevenly distributed',
  },
];

// ─── Custom statistics targets ────────────────────────────────────────────────
// Columns where the default 100-row sample produces poor histogram coverage.

const STATISTICS_TARGETS = [
  {
    table:  'leads',
    column: 'score',
    target: 200,
    reason: 'Integer 0–100 with uneven distribution — more buckets improve range estimate accuracy',
  },
  {
    table:  'deals',
    column: 'price',
    target: 200,
    reason: 'Price spans several orders of magnitude ($50k–$5M+) — fine-grained histogram reduces over/under-estimates',
  },
  {
    table:  'properties',
    column: 'price',
    target: 200,
    reason: 'Same wide price range as deals; listing search relies heavily on price range filters',
  },
  {
    table:  'tasks',
    column: '"dueDate"',
    target: 150,
    reason: 'Date range queries ("due this week") need good histogram coverage across the year',
  },
  {
    table:  'deals',
    column: '"targetCloseDate"',
    target: 150,
    reason: 'Pipeline forecast queries scan date ranges — better histogram reduces bad join estimates',
  },
];

// ─── Core ANALYZE operations ──────────────────────────────────────────────────

async function analyzeTable(tableName) {
  assertValidTable(tableName);
  const start = Date.now();
  await prisma.$executeRawUnsafe(`ANALYZE "${tableName}"`);
  return { table: tableName, status: 'analyzed', durationMs: Date.now() - start };
}

// ANALYZE a specific subset of columns (faster; useful when only certain columns changed)
async function analyzeColumns(tableName, columns) {
  assertValidTable(tableName);
  if (!Array.isArray(columns) || columns.some(c => !/^[a-zA-Z_"]+$/.test(c)))
    throw new Error('Invalid column name(s) — only letters, underscores, and quotes allowed');
  const colList = columns.map(c => `"${c.replace(/"/g, '')}"`).join(', ');
  const start = Date.now();
  await prisma.$executeRawUnsafe(`ANALYZE "${tableName}" (${colList})`);
  return { table: tableName, columns, status: 'analyzed', durationMs: Date.now() - start };
}

async function runFullAnalyze() {
  const results = [];
  const errors  = [];

  for (const table of CRM_TABLES) {
    try {
      results.push(await analyzeTable(table));
    } catch (err) {
      errors.push({ table, error: err.message });
    }
  }

  return {
    analyzedAt: new Date().toISOString(),
    results,
    errors,
  };
}

// ─── Staleness check ──────────────────────────────────────────────────────────

async function getStaleStats(threshold = 10) {
  const rows = await prisma.$queryRaw`
    SELECT
      relname                                                                     AS table_name,
      n_live_tup                                                                  AS live_rows,
      n_mod_since_analyze                                                         AS changes_since_analyze,
      ROUND(
        n_mod_since_analyze::numeric / NULLIF(n_live_tup, 0) * 100, 1
      )                                                                           AS stale_pct,
      last_analyze,
      last_autoanalyze,
      GREATEST(last_analyze, last_autoanalyze)                                    AS last_analyzed_at
    FROM pg_stat_user_tables
    WHERE relname = ANY(${CRM_TABLES})
    ORDER BY stale_pct DESC NULLS LAST
  `;

  const stale = rows.filter(r => parseFloat(r.stale_pct ?? 0) >= threshold);

  return {
    tables:    rows,
    stale,
    threshold: `${threshold}%`,
    note:      stale.length > 0
      ? `${stale.length} table(s) above ${threshold}% stale — run ANALYZE`
      : 'All statistics are fresh',
  };
}

// ─── Column-level statistics inspection ───────────────────────────────────────

async function getColumnStats(tableName, columnName) {
  if (!/^[a-z_]+$/.test(tableName)) throw new Error(`Invalid table name: ${tableName}`);

  const rows = await prisma.$queryRaw`
    SELECT
      tablename,
      attname                        AS column_name,
      null_frac,
      avg_width,
      n_distinct,
      most_common_vals::text         AS most_common_vals,
      most_common_freqs,
      histogram_bounds::text         AS histogram_bounds,
      correlation,
      most_common_elems::text        AS most_common_elems,
      most_common_elem_freqs
    FROM pg_stats
    WHERE tablename = ${tableName}
      AND attname   = ${columnName}
  `;
  return rows[0] ?? null;
}

// All columns with non-default statistics targets in the CRM schema
async function getStatisticsTargets() {
  const rows = await prisma.$queryRaw`
    SELECT
      c.relname  AS table_name,
      a.attname  AS column_name,
      a.attstattarget AS target,
      CASE WHEN a.attstattarget = -1 THEN 'default (100)' ELSE a.attstattarget::text END AS display_target
    FROM pg_attribute a
    JOIN pg_class c     ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind        = 'r'
      AND a.attnum         > 0
      AND NOT a.attisdropped
      AND a.attstattarget != -1
    ORDER BY c.relname, a.attname
  `;
  return rows;
}

// Set a custom statistics target for one column (call ANALYZE after to apply)
async function setStatisticsTarget(tableName, columnName, target) {
  assertValidTable(tableName);
  if (target < 1 || target > 10000)  throw new Error('target must be 1–10000');

  // Column names may be camelCase — only allow safe characters
  if (!/^[a-zA-Z_"]+$/.test(columnName)) throw new Error(`Invalid column name: ${columnName}`);
  const quotedCol = columnName.startsWith('"') ? columnName : `"${columnName}"`;

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${tableName}" ALTER COLUMN ${quotedCol} SET STATISTICS ${target}`
  );
  return { table: tableName, column: columnName, target, status: 'set' };
}

// Apply all recommended statistics targets (then run ANALYZE)
async function applyStatisticsTargets(dryRun = false) {
  const results = [];

  for (const spec of STATISTICS_TARGETS) {
    if (dryRun) {
      const quotedCol = spec.column.startsWith('"') ? spec.column : `"${spec.column}"`;
      results.push({
        ...spec,
        sql:    `ALTER TABLE "${spec.table}" ALTER COLUMN ${quotedCol} SET STATISTICS ${spec.target};`,
        status: 'dry-run',
      });
      continue;
    }
    try {
      await setStatisticsTarget(spec.table, spec.column, spec.target);
      results.push({ ...spec, status: 'applied' });
    } catch (err) {
      results.push({ ...spec, status: 'error', error: err.message });
    }
  }

  // Re-run ANALYZE so new targets take effect immediately
  const analyzeResult = dryRun ? null : await runFullAnalyze();

  return {
    dryRun,
    targets:       results,
    analyzeResult,
    note: dryRun
      ? 'Dry run — run without dryRun:true to apply'
      : 'Targets set and ANALYZE completed',
  };
}

// ─── Extended statistics ──────────────────────────────────────────────────────

async function getExtendedStats() {
  const rows = await prisma.$queryRaw`
    SELECT
      stxname                         AS name,
      stxrelid::regclass::text        AS table_name,
      stxkind                         AS stat_kinds,
      stxstattarget                   AS target
    FROM pg_statistic_ext
    WHERE stxrelid::regclass::text = ANY(${CRM_TABLES})
    ORDER BY table_name, name
  `;
  return rows;
}

async function createExtendedStats(dryRun = false) {
  const results = [];

  for (const stat of EXTENDED_STATS) {
    const cols = stat.columns.map(c =>
      c.startsWith('"') ? c : `"${c}"`
    ).join(', ');
    const sql = `CREATE STATISTICS IF NOT EXISTS "${stat.name}" ON ${cols} FROM "${stat.table}"`;

    if (dryRun) {
      results.push({ name: stat.name, table: stat.table, sql, status: 'dry-run', reason: stat.reason });
      continue;
    }

    try {
      assertValidTable(stat.table);
      await prisma.$executeRawUnsafe(sql);
      // ANALYZE must run after creating the stats object so PostgreSQL computes it
      await prisma.$executeRawUnsafe(`ANALYZE "${stat.table}"`);
      results.push({ name: stat.name, table: stat.table, status: 'created', reason: stat.reason });
    } catch (err) {
      results.push({ name: stat.name, table: stat.table, status: 'error', error: err.message });
    }
  }

  return {
    dryRun,
    results,
    note: dryRun
      ? 'Dry run — run without dryRun:true to create'
      : 'Extended statistics created. ANALYZE ran on each affected table.',
  };
}

module.exports = {
  CRM_TABLES,
  EXTENDED_STATS,
  STATISTICS_TARGETS,

  // ANALYZE
  analyzeTable,
  analyzeColumns,
  runFullAnalyze,

  // Staleness
  getStaleStats,

  // Column stats inspection
  getColumnStats,
  getStatisticsTargets,
  setStatisticsTarget,
  applyStatisticsTargets,

  // Extended statistics
  getExtendedStats,
  createExtendedStats,
};
