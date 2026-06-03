const { prisma }  = require('../config/database');
const { success, list } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync   = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const auditSvc = require('../services/auditService');

// ─── List recent audit logs ───────────────────────────────────────────────────
// GET /api/admin/audit   ?action=&resource=&userId=&since=&until=

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = {};
  if (req.query.action)   where.action   = req.query.action;
  if (req.query.resource) where.resource = req.query.resource;
  if (req.query.userId)   where.userId   = req.query.userId;
  if (req.query.since || req.query.until) {
    where.createdAt = {};
    if (req.query.since) where.createdAt.gte = new Date(req.query.since);
    if (req.query.until) where.createdAt.lte = new Date(req.query.until);
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  list(res, rows, buildPaginationMeta(page, perPage, total));
});

// ─── Resource history ─────────────────────────────────────────────────────────
// GET /api/admin/audit/resource/:resource/:resourceId   ?limit=50

exports.getResourceHistory = catchAsync(async (req, res) => {
  const { resource, resourceId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const logs = await auditSvc.getResourceHistory(resource, resourceId, limit);
  success(res, { resource, resourceId, count: logs.length, logs });
});

// ─── User activity ────────────────────────────────────────────────────────────
// GET /api/admin/audit/user/:userId   ?limit=100

exports.getUserActivity = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const logs  = await auditSvc.getUserActivity(req.params.userId, limit);
  success(res, { userId: req.params.userId, count: logs.length, logs });
});

// ─── Action-type history ──────────────────────────────────────────────────────
// GET /api/admin/audit/action/:action   ?since=2024-01-01

exports.getActionHistory = catchAsync(async (req, res) => {
  const logs = await auditSvc.getActionHistory(req.params.action, req.query.since);
  success(res, { action: req.params.action, count: logs.length, logs });
});

// ─── Sensitive access log ─────────────────────────────────────────────────────
// GET /api/admin/audit/sensitive   ?since=

exports.getSensitiveAccessLog = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = { action: 'SENSITIVE_DATA_ACCESS' };
  if (req.query.since) where.createdAt = { gte: new Date(req.query.since) };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
  ]);

  list(res, rows, buildPaginationMeta(page, perPage, total));
});

// ─── Commission change log ────────────────────────────────────────────────────
// GET /api/admin/audit/commissions   ?since=

exports.getCommissionAuditLog = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = {
    action:   { in: ['COMMISSION_ADJUST', 'COMMISSION_VOID', 'COMMISSION_RELEASE'] },
  };
  if (req.query.since) where.createdAt = { gte: new Date(req.query.since) };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
  ]);

  list(res, rows, buildPaginationMeta(page, perPage, total));
});

// ─── Export audit log as CSV ──────────────────────────────────────────────────
// GET /api/admin/audit/export   ?since=&until=&action=&resource=

exports.exportCSV = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.action)   where.action   = req.query.action;
  if (req.query.resource) where.resource = req.query.resource;
  if (req.query.since || req.query.until) {
    where.createdAt = {};
    if (req.query.since) where.createdAt.gte = new Date(req.query.since);
    if (req.query.until) where.createdAt.lte = new Date(req.query.until);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000, // Safety cap
  });

  const header = 'ID,Timestamp,User ID,User Email,User Role,Action,Resource,Resource ID,Changes,IP,Endpoint';
  const rows = logs.map(log => [
    log.id,
    log.createdAt.toISOString(),
    log.userId,
    `"${log.userEmail}"`,
    log.userRole,
    log.action,
    log.resource,
    log.resourceId ?? '',
    log.changes ? `"${JSON.stringify(log.changes).replace(/"/g, '""')}"` : '',
    log.metadata?.ip ?? '',
    `"${log.metadata?.endpoint ?? ''}"`,
  ].join(','));

  const csv = [header, ...rows].join('\n');
  const filename = `audit_export_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
