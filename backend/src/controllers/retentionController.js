const { success, created } = require('../utils/response');
const { AppError }   = require('../utils/AppError');
const catchAsync     = require('../utils/catchAsync');

const retentionSvc = require('../services/retentionService');
const auditSvc     = require('../services/auditService');

// ─── Stats ────────────────────────────────────────────────────────────────────
// GET /api/admin/retention/stats

exports.getStats = catchAsync(async (req, res) => {
  const stats = await retentionSvc.getRetentionStats();
  success(res, stats);
});

// ─── Audit log purge ──────────────────────────────────────────────────────────
// POST /api/admin/retention/purge-audit-logs   body: { years?, dryRun? }

exports.purgeAuditLogs = catchAsync(async (req, res) => {
  const years  = parseInt(req.body.years) || 7;
  const dryRun = req.body.dryRun !== false;

  if (years < 1 || years > 20) throw AppError.badRequest('years must be between 1 and 20');

  const result = await retentionSvc.purgeExpiredAuditLogs(years, { dryRun });

  if (!dryRun && result.deleted > 0) {
    auditSvc.log('AUDIT_LOG_PURGE', 'audit', {
      ...auditSvc.fromRequest(req),
      changes: { after: { deleted: result.deleted, cutoff: result.cutoff, retentionYears: years } },
    }).catch(() => {});
  }

  success(res, result);
});

// ─── Data archival ────────────────────────────────────────────────────────────
// POST /api/admin/retention/archive   body: { years?, dryRun? }

exports.archiveData = catchAsync(async (req, res) => {
  const years  = parseInt(req.body.years) || 3;
  const dryRun = req.body.dryRun !== false;

  if (years < 1 || years > 10) throw AppError.badRequest('years must be between 1 and 10');

  const result = await retentionSvc.archiveOldSoftDeletedData(years, { dryRun });

  if (!dryRun) {
    const totalArchived = result.results.reduce((s, r) => s + r.archived, 0);
    if (totalArchived > 0) {
      auditSvc.log('DATA_ARCHIVE', 'system', {
        ...auditSvc.fromRequest(req),
        changes: { after: { archived: totalArchived, cutoff: result.cutoff, archivalYears: years } },
      }).catch(() => {});
    }
  }

  success(res, result);
});

// ─── GDPR erasure request ─────────────────────────────────────────────────────
// POST /api/admin/gdpr/erase   body: { subjectType, subjectId, reason? }

exports.gdprErase = catchAsync(async (req, res) => {
  const { subjectType, subjectId, reason } = req.body;
  if (!subjectType) throw AppError.badRequest('subjectType is required (lead, client, or user)');
  if (!subjectId)   throw AppError.badRequest('subjectId is required');

  const result = await retentionSvc.gdprErase(subjectType, subjectId, {
    requestedBy: req.user.id,
    reason,
  });

  created(res, result);
});

// ─── GDPR erasure request history ────────────────────────────────────────────
// GET /api/admin/gdpr/requests   ?limit=100

exports.getErasureRequests = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const requests = await retentionSvc.getErasureRequests(limit);
  success(res, { count: requests.length, requests });
});
