const { prisma }   = require('../config/database');
const { success, list, created } = require('../utils/response');
const { AppError }  = require('../utils/AppError');
const catchAsync    = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const commissionRecordSvc = require('../services/commissionRecordService');
const auditSvc            = require('../services/auditService');

// ─── Admin: list all commission records ───────────────────────────────────────

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = {};
  if (req.query.status)  where.status  = req.query.status;
  if (req.query.agentId) where.agentId = req.query.agentId;
  if (req.query.batchId) where.payrollBatchId = req.query.batchId;
  if (req.query.since)   where.createdAt = { gte: new Date(req.query.since) };

  const [total, rows] = await Promise.all([
    prisma.commissionRecord.count({ where }),
    prisma.commissionRecord.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        deal:  { select: { id: true, value: true, type: true } },
        agent: { select: { id: true, name: true, email: true } },
        adjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
  ]);

  list(res, rows, buildPaginationMeta(page, perPage, total));
});

// ─── Admin: single record ─────────────────────────────────────────────────────

exports.getById = catchAsync(async (req, res) => {
  const record = await prisma.commissionRecord.findUnique({
    where: { id: req.params.id },
    include: {
      deal:  { select: { id: true, value: true, type: true, stage: true } },
      agent: { select: { id: true, name: true, email: true } },
      adjustments: {
        orderBy: { createdAt: 'desc' },
        include: { approvedBy: { select: { id: true, email: true, role: true } } },
      },
    },
  });
  if (!record) throw AppError.notFound('Commission record');
  success(res, record);
});

// ─── Admin: adjust amount ─────────────────────────────────────────────────────
// POST /api/admin/commissions/:id/adjust   body: { amount, reason }

exports.adjust = catchAsync(async (req, res) => {
  const { amount, reason } = req.body;
  if (typeof amount !== 'number' || amount < 0) {
    throw AppError.badRequest('amount must be a non-negative number');
  }

  const result = await commissionRecordSvc.adjustCommission(
    req.params.id,
    amount,
    reason,
    req.user.id,
    req.user.role,
  );

  auditSvc.logCommissionAdjust(
    auditSvc.fromRequest(req),
    req.params.id,
    result.adjustment.originalAmount,
    amount,
    reason,
  ).catch(() => {});

  success(res, result);
});

// ─── Admin: void commission ───────────────────────────────────────────────────
// POST /api/admin/commissions/void   body: { dealId, reason }

exports.void = catchAsync(async (req, res) => {
  const { dealId, reason } = req.body;
  if (!dealId)  throw AppError.badRequest('dealId is required');
  if (!reason)  throw AppError.badRequest('reason is required');

  const result = await commissionRecordSvc.voidCommission(
    dealId,
    reason,
    req.user.id,
    req.user.role,
  );

  if (!result) {
    return success(res, { message: 'No commission record found for this deal — nothing to void' });
  }

  auditSvc.logCommissionVoid(
    auditSvc.fromRequest(req),
    dealId,
    result.adjustment.originalAmount,
    reason,
  ).catch(() => {});

  success(res, result);
});

// ─── Admin: create payroll batch ──────────────────────────────────────────────
// POST /api/admin/commissions/payroll   body: { weekStart, weekEnd }

exports.createPayrollBatch = catchAsync(async (req, res) => {
  const { weekStart, weekEnd } = req.body;
  if (!weekStart || !weekEnd) throw AppError.badRequest('weekStart and weekEnd are required (YYYY-MM-DD)');

  const batch = await commissionRecordSvc.createPayrollBatch(weekStart, weekEnd);

  auditSvc.log('COMMISSION_RELEASE', 'commissions', {
    ...auditSvc.fromRequest(req),
    changes: { after: { batchId: batch.batchId, recordCount: batch.recordCount, totalAmount: batch.totalAmount } },
  }).catch(() => {});

  created(res, batch);
});

// ─── Admin: export payroll CSV ────────────────────────────────────────────────
// GET /api/admin/commissions/payroll/:batchId/export

exports.exportPayrollCSV = catchAsync(async (req, res) => {
  const { batchId } = req.params;

  const records = await prisma.commissionRecord.findMany({
    where: { payrollBatchId: batchId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      deal:  { select: { id: true, value: true, type: true } },
      adjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { agentId: 'asc' },
  });

  if (records.length === 0) throw AppError.notFound(`Payroll batch ${batchId}`);

  // Group by agent for CSV export
  const byAgent = {};
  for (const rec of records) {
    if (!byAgent[rec.agentId]) byAgent[rec.agentId] = { agent: rec.agent, records: [] };
    byAgent[rec.agentId].records.push(rec);
  }

  const totalAmount = records.reduce((s, r) => s + r.amount, 0);
  const batch = {
    batchId,
    byAgent:     Object.values(byAgent),
    totalAmount,
  };

  const csv = commissionRecordSvc.exportPayrollCSV(batch);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="payroll_${batchId}.csv"`);
  res.send(csv);
});

// ─── Admin: agent commission summary ─────────────────────────────────────────
// GET /api/admin/commissions/agent/:agentId/summary

exports.getAgentSummary = catchAsync(async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.agentId },
    select: { id: true, name: true, email: true },
  });
  if (!agent) throw AppError.notFound('Agent');

  const [summary, records] = await Promise.all([
    commissionRecordSvc.getCommissionSummary(req.params.agentId),
    commissionRecordSvc.getAgentCommissions(req.params.agentId, req.query.status),
  ]);

  success(res, { agent, summary, records });
});

// ─── Agent self-service: own commissions ──────────────────────────────────────
// GET /api/agents/:id/commissions   (called from agentsController via agentId check)

exports.getAgentCommissions = catchAsync(async (req, res) => {
  const agentId = req.params.agentId || req.params.id;

  // Agents can only see their own; managers/admins can see any
  if (req.user.role === 'agent' && req.agentId !== agentId) {
    throw AppError.forbidden('You can only view your own commissions');
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });
  if (!agent) throw AppError.notFound('Agent');

  const [summary, records] = await Promise.all([
    commissionRecordSvc.getCommissionSummary(agentId),
    commissionRecordSvc.getAgentCommissions(agentId, req.query.status),
  ]);

  success(res, { agent, summary, records });
});
