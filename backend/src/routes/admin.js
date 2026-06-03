const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const maint     = require('../controllers/maintenanceController');
const comm      = require('../controllers/commissionsController');
const audit     = require('../controllers/auditController');
const retention = require('../controllers/retentionController');

const r = Router();

// All admin routes require authentication + admin role
r.use(authenticate);
r.use(requireRole('admin'));

// ── Vacuum monitoring ─────────────────────────────────────────────────────────
r.get('/maintenance/bloat',             maint.getBloatReport);       // ?threshold=10
r.get('/maintenance/table-stats',       maint.getTableStats);
r.get('/maintenance/autovacuum-status', maint.getAutovacuumStatus);
r.get('/maintenance/autovacuum-sql',    maint.getAutovacuumSQL);
r.get('/maintenance/xid-risk',          maint.getXidRisk);

// ── Index monitoring ──────────────────────────────────────────────────────────
r.get('/maintenance/indexes',                          maint.getIndexReport);        // ?min_bloat=0
r.get('/maintenance/indexes/:indexName/detail',        maint.getDetailedBloat);
r.get('/maintenance/unused-indexes',                   maint.getUnusedIndexes);
r.get('/maintenance/duplicate-indexes',                maint.getDuplicateIndexes);
r.get('/maintenance/fill-factors',                     maint.getFillFactorReport);

// ── Query monitoring ──────────────────────────────────────────────────────────
r.get('/maintenance/locks',             maint.getLockMonitor);
r.get('/maintenance/slow-queries',      maint.getSlowQueries);        // ?min_ms=1000

// ── Vacuum operations ─────────────────────────────────────────────────────────
r.post('/maintenance/vacuum',                   maint.runVacuum);           // { table?, mode? }

// ── Reindex operations ────────────────────────────────────────────────────────
r.post('/maintenance/reindex',                  maint.reindex);             // { indexName|tableName, mode? }
r.post('/maintenance/reindex/smart',            maint.runSmartReindex);
r.post('/maintenance/reindex/post-migration',   maint.postMigrationReindex);// { tables: string[] }
r.post('/maintenance/fill-factors/apply',       maint.applyFillFactors);

// ── Cluster operations ────────────────────────────────────────────────────────
r.get('/maintenance/cluster/status',    maint.getClusterStatus);
r.post('/maintenance/cluster',          maint.runCluster);            // { table, index? }
r.post('/maintenance/cluster/monthly',  maint.runMonthlyCluster);     // { dryRun? }

// ── Statistics / ANALYZE operations ──────────────────────────────────────────
r.get('/maintenance/stats/stale',                    maint.getStaleStats);           // ?threshold=10
r.get('/maintenance/stats/column/:table/:column',    maint.getColumnStats);
r.get('/maintenance/stats/targets',                  maint.getStatisticsTargets);
r.get('/maintenance/stats/extended',                 maint.getExtendedStats);
r.post('/maintenance/stats/analyze',                 maint.runAnalyze);             // { table?, columns? }
r.post('/maintenance/stats/targets/apply',           maint.applyStatisticsTargets); // { dryRun? }
r.post('/maintenance/stats/extended/create',         maint.createExtendedStats);    // { dryRun? }

// ── Scheduler triggers ────────────────────────────────────────────────────────
r.post('/maintenance/run-job',          maint.runJob);                // { job }

// ── Commission admin ──────────────────────────────────────────────────────────
r.get('/commissions',                              comm.list);               // ?status=&agentId=&batchId=&since=
r.get('/commissions/agent/:agentId/summary',       comm.getAgentSummary);    // ?status=
r.get('/commissions/payroll/:batchId/export',      comm.exportPayrollCSV);
r.get('/commissions/:id',                          comm.getById);
r.post('/commissions/:id/adjust',                  comm.adjust);             // { amount, reason }
r.post('/commissions/void',                        comm.void);               // { dealId, reason }
r.post('/commissions/payroll',                     comm.createPayrollBatch); // { weekStart, weekEnd }

// ── Audit log ─────────────────────────────────────────────────────────────────
r.get('/audit',                              audit.list);                  // ?action=&resource=&userId=&since=&until=
r.get('/audit/export',                       audit.exportCSV);             // CSV download (same filters)
r.get('/audit/sensitive',                    audit.getSensitiveAccessLog); // ?since=
r.get('/audit/commissions',                  audit.getCommissionAuditLog); // ?since=
r.get('/audit/resource/:resource/:resourceId', audit.getResourceHistory);  // ?limit=
r.get('/audit/user/:userId',                 audit.getUserActivity);       // ?limit=
r.get('/audit/action/:action',               audit.getActionHistory);      // ?since=

// ── Data retention & GDPR ─────────────────────────────────────────────────────
r.get('/retention/stats',           retention.getStats);
r.post('/retention/purge-audit-logs', retention.purgeAuditLogs);   // { years?, dryRun? }
r.post('/retention/archive',          retention.archiveData);       // { years?, dryRun? }
r.post('/gdpr/erase',               retention.gdprErase);           // { subjectType, subjectId, reason? }
r.get('/gdpr/requests',             retention.getErasureRequests);  // ?limit=

module.exports = r;
