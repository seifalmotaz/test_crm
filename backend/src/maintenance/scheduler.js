/**
 * Maintenance Scheduler
 *
 * Runs database maintenance jobs on a time-based schedule.
 * Uses setInterval (zero dependencies). For production, replace with
 * pg_cron (runs inside PostgreSQL) or a proper job queue (BullMQ, etc.)
 *
 * Schedule:
 *   01:00 AM 1st Sunday → Monthly CLUSTER (physical row reorder, space reclaim)
 *   02:00 AM daily      → Nightly VACUUM ANALYZE on high-churn tables
 *   02:15 AM daily      → ANALYZE all CRM tables (nightly statistics refresh)
 *   02:30 AM daily      → Bloat health check (warns if vacuum didn't help)
 *   03:00 AM daily      → Audit log purge (Jan 1 only — logs > 7 years, legal limit)
 *   03:00 AM Sunday     → Weekly full maintenance (VACUUM FULL if bloated)
 *   03:30 AM daily      → Data archival (Jan 1 only — soft-deleted records > 3 years)
 *   04:00 AM Sunday     → Weekly smart REINDEX (only bloated / low-efficiency indexes)
 *   04:30 AM Sunday     → Post-reindex ANALYZE (planner stats for freshly rebuilt indexes)
 *   05:00 AM daily      → Refresh computed columns (daysOverdue, daysUntilClose, etc.)
 *   05:30 AM daily      → Task escalation (overdue task promotion)
 *   06:00 AM daily      → Commission release (hold → released after 7 days)
 *   06:30 AM daily      → Agent performance alert scan
 *   07:00 AM Sunday     → Agent tier + rank recalculation
 *   08:00 AM daily      → Closing-soon deal alerts (< 7 days)
 *   Hourly              → XID wraparound health check
 *
 * Note: ANALYZE also runs as part of VACUUM ANALYZE at 02:00 AM on high-churn
 * tables. The dedicated 02:15 AM pass covers all tables (including lower-churn
 * ones) so the planner always has fresh statistics by the time traffic picks up.
 */

const {
  runNightlyVacuum,
  runWeeklyMaintenance,
  getBloatReport,
  checkXidWraparoundRisk,
} = require('./vacuum');

const { runWeeklyReindex }  = require('./reindex');
const { runFullAnalyze }    = require('./analyze');
const { runMonthlyCluster, isFirstSundayOfMonth } = require('./cluster');
const { processOverdueTasks }         = require('../services/taskAutomation');
const { releaseEligibleCommissions }  = require('../services/commissionRecordService');
const { scanClosingSoonDeals }        = require('../services/notificationService');
const { recalculateTiersAndRanks, scanPerformanceAlerts } = require('../services/agentService');
const retentionSvc = require('../services/retentionService');

const { prisma } = require('../config/database');
const cache = require('../utils/cache');

let jobs = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msUntil(hour, minute = 0) {
  const now    = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // next occurrence
  return target - now;
}

function scheduleDaily(hour, minute, name, fn) {
  function schedule() {
    const delay = msUntil(hour, minute);
    console.log(`[Scheduler] "${name}" scheduled in ${Math.round(delay / 60000)} min`);
    const t = setTimeout(async () => {
      console.log(`[Scheduler] Running "${name}"...`);
      try {
        await fn();
        console.log(`[Scheduler] "${name}" complete`);
      } catch (err) {
        console.error(`[Scheduler] "${name}" failed:`, err.message);
      }
      schedule(); // reschedule for next day
    }, delay);
    jobs.push(t);
  }
  schedule();
}

// ─── Maintenance jobs ─────────────────────────────────────────────────────────

// 02:00 AM — VACUUM ANALYZE on high-churn tables (2–30 seconds, no locking)
async function nightlyVacuum() {
  const result = await runNightlyVacuum();
  console.log(`[VACUUM] Nightly complete: ${result.results.length} tables, ${result.errors.length} errors`);

  // Also invalidate all caches after vacuum (stats may have changed)
  cache.invalidatePattern('dashboard:');
  cache.invalidatePattern('analytics:');
  cache.invalidatePattern('agents:');
}

// 03:00 AM Sunday — Weekly full maintenance (VACUUM FULL if bloated)
async function weeklyMaintenance() {
  if (new Date().getDay() !== 0) return; // Sunday only
  console.log('[Maintenance] Starting weekly vacuum window...');
  const result = await runWeeklyMaintenance({ dryRun: false });
  console.log(`[Maintenance] Weekly vacuum complete: ${result.log.length} steps`);
}

// 01:00 AM first Sunday of month — CLUSTER (physical row reordering + space reclaim)
// Holds exclusive locks; must run before the 02:00 vacuum window to minimise overlap.
async function monthlyCluster() {
  if (!isFirstSundayOfMonth()) return;
  console.log('[Cluster] Starting monthly CLUSTER...');
  const result = await runMonthlyCluster({ dryRun: false });
  const ok  = result.results.filter(r => r.status === 'clustered').length;
  const err = result.errors.length;
  console.log(`[Cluster] Monthly complete: ${ok} clustered, ${err} errors`);
}

// 04:00 AM Sunday — Smart REINDEX (rebuild only degraded indexes, CONCURRENTLY)
async function weeklyReindex() {
  if (new Date().getDay() !== 0) return; // Sunday only
  console.log('[Reindex] Starting weekly smart reindex...');
  const result = await runWeeklyReindex();
  const rebuilt = result.results?.filter(r => r.status === 'reindexed').length ?? 0;
  const skipped = result.results?.filter(r => r.status === 'skipped').length ?? 0;
  console.log(`[Reindex] Weekly complete: ${rebuilt} rebuilt, ${skipped} skipped`);
}

// 02:15 AM daily — ANALYZE all CRM tables
// Runs after the 02:00 VACUUM ANALYZE (which only covers high-churn tables) to
// ensure ALL tables have fresh planner statistics before business hours.
async function nightlyAnalyze() {
  const result = await runFullAnalyze();
  console.log(`[Analyze] Nightly complete: ${result.results.length} tables, ${result.errors.length} errors`);
}

// 04:30 AM Sunday — Re-run ANALYZE after REINDEX
// Rebuilt indexes change the cost model; fresh stats ensure the planner sees them.
async function postReindexAnalyze() {
  if (new Date().getDay() !== 0) return; // Sunday only
  console.log('[Analyze] Post-reindex ANALYZE...');
  const result = await runFullAnalyze();
  console.log(`[Analyze] Post-reindex complete: ${result.results.length} tables, ${result.errors.length} errors`);
}

// 05:30 AM — Task escalation + commission release + closing-soon alerts
async function runTaskEscalation() {
  const result = await processOverdueTasks();
  console.log(`[Tasks] Escalation: ${result.processed} overdue, ${result.escalatedDirector} → director, ${result.escalatedManager} → manager`);
}

async function runCommissionRelease() {
  const result = await releaseEligibleCommissions();
  console.log(`[Commission] Released ${result.released} held commissions`);
}

async function runClosingSoonAlerts() {
  const result = await scanClosingSoonDeals();
  console.log(`[Notify] Closing-soon: ${result.scanned} deals scanned, ${result.sent} notifications sent`);
}

// 07:00 AM Sunday — Recalculate agent tiers and leaderboard ranks
async function runTierRecalculation() {
  if (new Date().getDay() !== 0) return; // Sunday only
  const result = await recalculateTiersAndRanks();
  console.log(`[Agents] Tier recalculation complete: ${result.updated} agents updated`);
}

// 06:30 AM daily — Scan for agent performance alerts (revenue drop, low conversion)
async function runPerformanceAlertScan() {
  const alerts = await scanPerformanceAlerts();
  if (alerts.length > 0) {
    console.warn(`[Agents] Performance alerts: ${alerts.length} issue(s) detected`, alerts.map(a => `${a.name}: ${a.type}`));
    // Production: fire notifications to directors/managers here
  }
}

// 03:00 AM January 1st — Purge audit logs older than 7 years (legal retention limit)
// Uses isFirstDayOfYear guard; scheduler calls this daily but it no-ops until the date matches.
async function runAuditLogPurge() {
  const now = new Date();
  if (now.getMonth() !== 0 || now.getDate() !== 1) return; // January 1st only
  const result = await retentionSvc.purgeExpiredAuditLogs(7, { dryRun: false });
  console.log(`[Retention] Audit log purge: ${result.deleted} logs older than 7 years removed`);
}

// 03:30 AM January 1st — Archive soft-deleted records older than 3 years
async function runDataArchival() {
  const now = new Date();
  if (now.getMonth() !== 0 || now.getDate() !== 1) return; // January 1st only
  const result = await retentionSvc.archiveOldSoftDeletedData(3, { dryRun: false });
  const total  = result.results.reduce((s, r) => s + r.archived, 0);
  console.log(`[Retention] Data archival: ${total} records archived across ${result.results.length} tables`);
}

// 05:00 AM — Refresh computed columns that denormalize DB state
async function refreshComputedColumns() {
  const now = new Date();

  // Recalculate daysOverdue for tasks (status not yet 'completed')
  await prisma.$executeRaw`
    UPDATE tasks
    SET
      "daysOverdue" = GREATEST(0, EXTRACT(DAY FROM (${now}::timestamp - "dueDate"))::int),
      "status" = CASE
        WHEN status = 'not_started' AND "dueDate" < ${now} THEN 'overdue'::"TaskStatus"
        WHEN status = 'overdue'     AND "dueDate" >= ${now} THEN 'not_started'::"TaskStatus"
        ELSE status
      END
    WHERE status NOT IN ('completed')
      AND "isDeleted" = false
  `;

  // Recalculate daysUntilClose for active deals
  await prisma.$executeRaw`
    UPDATE deals
    SET
      "daysUntilClose" = GREATEST(0, EXTRACT(DAY FROM ("targetCloseDate" - ${now}::timestamp))::int),
      "daysElapsed"    = EXTRACT(DAY FROM (${now}::timestamp - "offerDate"))::int
    WHERE stage NOT IN ('closed', 'lost')
      AND "isDeleted" = false
  `;

  // Recalculate daysSinceContact for clients
  await prisma.$executeRaw`
    UPDATE clients
    SET "daysSinceContact" = EXTRACT(DAY FROM (${now}::timestamp - "lastContactDate"))::int
    WHERE "lastContactDate" IS NOT NULL
      AND "isDeleted" = false
  `;

  // Recalculate leadsAssigned and activeDeals on agent rows
  await prisma.$executeRaw`
    UPDATE agents a
    SET
      "leadsAssigned" = (
        SELECT COUNT(*) FROM leads l
        WHERE l."agentId" = a.id AND l."isDeleted" = false
      ),
      "activeDeals" = (
        SELECT COUNT(*) FROM deals d
        WHERE d."agentId" = a.id
          AND d."isDeleted" = false
          AND d.stage NOT IN ('closed', 'lost')
      ),
      "dealsClosedMonth" = (
        SELECT COUNT(*) FROM deals d
        WHERE d."agentId" = a.id
          AND d."isDeleted" = false
          AND d.stage = 'closed'
          AND d."updatedAt" >= date_trunc('month', ${now}::timestamp)
      )
  `;

  cache.invalidatePattern('dashboard:');
  cache.invalidatePattern('analytics:');
  console.log('[Refresh] Computed columns updated');
}

// ─── XID wraparound monitor (hourly health check) ─────────────────────────────

async function xidHealthCheck() {
  const risks = await checkXidWraparoundRisk();
  const critical = risks.filter(r => r.riskLevel === 'CRITICAL');
  const warnings = risks.filter(r => r.riskLevel === 'WARNING');

  if (critical.length > 0) {
    console.error('[XID] CRITICAL: XID wraparound risk on tables:', critical.map(r => r.table));
    // Production: fire PagerDuty / send email alert here
  } else if (warnings.length > 0) {
    console.warn('[XID] WARNING: XID age elevated on:', warnings.map(r => r.table));
  }
}

// ─── Bloat monitor (runs after nightly vacuum to verify effectiveness) ─────────

async function bloatHealthCheck() {
  const report = await getBloatReport(20); // warn at 20%
  if (report.needsAttention.length > 0) {
    console.warn('[BLOAT] Tables above 20% dead ratio:', report.needsAttention.map(t => ({
      table:    t.table,
      deadPct:  t.deadRatioPct,
      deadRows: t.deadRows,
    })));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function start() {
  scheduleDaily(1,  0,  'monthly-cluster',      monthlyCluster);      // first Sunday only
  scheduleDaily(2,  0,  'nightly-vacuum',       nightlyVacuum);
  scheduleDaily(2, 15,  'nightly-analyze',      nightlyAnalyze);      // every night
  scheduleDaily(2, 30,  'bloat-health-check',   bloatHealthCheck);
  scheduleDaily(3,  0,  'weekly-maintenance',   weeklyMaintenance);   // Sunday only
  scheduleDaily(4,  0,  'weekly-reindex',       weeklyReindex);       // Sunday only
  scheduleDaily(4, 30,  'post-reindex-analyze', postReindexAnalyze);  // Sunday only
  scheduleDaily(5,  0,  'refresh-computed',     refreshComputedColumns);
  scheduleDaily(5, 30,  'task-escalation',         runTaskEscalation);
  scheduleDaily(6,  0,  'commission-release',      runCommissionRelease);
  scheduleDaily(6, 30,  'performance-alert-scan',  runPerformanceAlertScan);
  scheduleDaily(7,  0,  'tier-recalculation',      runTierRecalculation);    // Sunday only
  scheduleDaily(8,  0,  'closing-soon-alerts',     runClosingSoonAlerts);
  scheduleDaily(3,  0,  'audit-log-purge',         runAuditLogPurge);        // January 1st only
  scheduleDaily(3, 30,  'data-archival',            runDataArchival);         // January 1st only

  // Hourly XID wraparound check
  const xidInterval = setInterval(() => xidHealthCheck().catch(console.error), 60 * 60 * 1000);
  jobs.push(xidInterval);

  console.log('[Scheduler] Maintenance scheduler started');
}

function stop() {
  jobs.forEach(j => (typeof j === 'object' ? clearInterval(j) : clearTimeout(j)));
  jobs = [];
  console.log('[Scheduler] Maintenance scheduler stopped');
}

// Run a job immediately (for manual triggers via admin API)
async function runNow(jobName) {
  const map = {
    'nightly-vacuum':     nightlyVacuum,
    'weekly-maintenance': weeklyMaintenance,
    'weekly-reindex':     weeklyReindex,
    'nightly-analyze':       nightlyAnalyze,
    'post-reindex-analyze':  postReindexAnalyze,
    'monthly-cluster':    monthlyCluster,
    'refresh-computed':   refreshComputedColumns,
    'task-escalation':    runTaskEscalation,
    'commission-release':     runCommissionRelease,
    'performance-alert-scan': runPerformanceAlertScan,
    'tier-recalculation':     runTierRecalculation,
    'closing-soon-alerts':    runClosingSoonAlerts,
    'audit-log-purge':        runAuditLogPurge,
    'data-archival':          runDataArchival,
    'xid-check':              xidHealthCheck,
    'bloat-check':            bloatHealthCheck,
  };
  const fn = map[jobName];
  if (!fn) throw new Error(`Unknown job: ${jobName}. Valid: ${Object.keys(map).join(', ')}`);
  return fn();
}

module.exports = { start, stop, runNow };
