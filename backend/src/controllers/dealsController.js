const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const { prisma } = require('../config/database');
const { success, created, list } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { agentFilter } = require('../middleware/auth');
const cache = require('../utils/cache');

const ensureAgentProfile    = require('../utils/ensureAgentProfile');
const dealService           = require('../services/dealService');
const commissionService     = require('../services/commissionService');
const commissionRecordSvc   = require('../services/commissionRecordService');
const taskAutomation        = require('../services/taskAutomation');
const notificationSvc       = require('../services/notificationService');
const auditSvc              = require('../services/auditService');

const upload = multer({
  dest:   path.join(__dirname, '../../uploads'),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024 },
});

const createSchema = z.object({
  propertyId:        z.string().optional(),
  leadId:            z.string().optional(),
  clientId:          z.string().optional(),
  agentId:           z.string().optional(),
  type:              z.string().min(1),
  value:             z.number().min(0),
  commissionRate:    z.number().min(0).max(20).optional(),
  stage:             z.enum(dealService.STAGE_ORDER).optional().default('offer'),
  offerDate:         z.string(),
  targetCloseDate:   z.string(),
  notes:             z.string().optional(),
});

const DEAL_INCLUDE = {
  agent:      { select: { id: true, name: true, avatar: true } },
  property:   { select: { id: true, address: true, neighborhood: true } },
  client:     { select: { id: true, name: true, email: true } },
  milestones: { orderBy: { due: 'asc' } },
};

function buildFilter(q, agentF) {
  const where = { ...agentF, isDeleted: false };
  if (q.stage)   where.stage = q.stage;
  if (q.agentId && ['admin', 'manager'].includes(q._role)) where.agentId = q.agentId;
  if (q.minValue || q.maxValue) {
    where.value = {};
    if (q.minValue) where.value.gte = parseFloat(q.minValue);
    if (q.maxValue) where.value.lte = parseFloat(q.maxValue);
  }
  if (q.closeBefore) where.targetCloseDate = { lte: new Date(q.closeBefore) };
  return where;
}

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = buildFilter({ ...req.query, _role: req.user.role }, agentFilter(req));
  const validSorts = { value: 'value', close_date: 'targetCloseDate', stage: 'stage' };
  const orderBy = { [validSorts[req.query.sort] || 'updatedAt']: 'desc' };

  const [total, rows] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({ where, skip, take: perPage, orderBy, include: DEAL_INCLUDE }),
  ]);

  list(res, rows, buildPaginationMeta(page, perPage, total));
});

exports.create = catchAsync(async (req, res) => {
  const body    = createSchema.parse(req.body);
  const agentId = await ensureAgentProfile(req, body.agentId);
  if (!agentId) throw AppError.badRequest('agentId is required');
  if (!body.propertyId) throw AppError.badRequest('propertyId is required');

  // ── Referential integrity: validate referenced records exist ─────────────
  const [property, agent] = await Promise.all([
    prisma.property.findFirst({ where: { id: body.propertyId, isDeleted: false } }),
    prisma.agent.findUnique({ where: { id: agentId } }),
  ]);
  if (!property) throw AppError.badRequest('Property not found or has been deleted');
  if (!agent)    throw AppError.badRequest('Agent not found');

  // ── Auto-calculate commission rate from deal type + value ────────────────
  const { ratePct } = commissionService.calculate(body.value, body.type);
  const commissionRate = body.commissionRate ?? ratePct;

  // ── Calculate initial probability ────────────────────────────────────────
  const closingProbability = dealService.STAGE_PROBABILITY['offer'];

  // ── Atomic: create deal + increment agent counter ────────────────────────
  const deal = await prisma.$transaction(async (tx) => {
    const newDeal = await tx.deal.create({
      data: {
        ...body,
        agentId,
        commissionRate,
        closingProbability,
        offerDate:       new Date(body.offerDate),
        targetCloseDate: new Date(body.targetCloseDate),
      },
      include: DEAL_INCLUDE,
    });
    await tx.agent.update({ where: { id: agentId }, data: { activeDeals: { increment: 1 } } });
    return newDeal;
  });

  // ── Auto-generate workflow tasks ─────────────────────────────────────────
  await taskAutomation.createDealTasks(deal.id, agentId);

  cache.invalidatePattern('dashboard:');
  created(res, deal);
});

exports.getById = catchAsync(async (req, res) => {
  const deal = await prisma.deal.findFirst({
    where:   { id: req.params.id, isDeleted: false, ...agentFilter(req) },
    include: { ...DEAL_INCLUDE, documents: { orderBy: { uploadedAt: 'desc' } } },
  });
  if (!deal) throw AppError.notFound('Deal');
  success(res, deal);
});

exports.update = catchAsync(async (req, res) => {
  const { version, ...data } = req.body;

  const existing = await prisma.deal.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!existing) throw AppError.notFound('Deal');
  if (typeof version !== 'number') throw AppError.badRequest('version is required');
  if (existing.version !== version) throw AppError.versionConflict();

  // ── Closing lock — modifications require manager approval ────────────────
  dealService.assertNotLocked(existing, req.user.role);

  if (data.offerDate)       data.offerDate       = new Date(data.offerDate);
  if (data.targetCloseDate) data.targetCloseDate = new Date(data.targetCloseDate);

  const deal = await prisma.deal.update({
    where:   { id: req.params.id },
    data:    { ...data, version: { increment: 1 } },
    include: DEAL_INCLUDE,
  });

  cache.invalidatePattern('dashboard:');
  success(res, deal);
});

// ── Stage advancement (replaces generic update for stage changes) ─────────────
// POST /api/deals/:id/stage   body: { stage, version, inspectionDate?, hasIssues?, appraisalGapPct? }
exports.updateStage = catchAsync(async (req, res) => {
  const { stage, version, ...stageOpts } = req.body;
  if (!stage) throw AppError.badRequest('stage is required');

  const existing = await prisma.deal.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!existing) throw AppError.notFound('Deal');
  if (typeof version !== 'number') throw AppError.badRequest('version is required');
  if (existing.version !== version) throw AppError.versionConflict();

  const { deal, sideEffects } = await dealService.advanceStage(
    req.params.id,
    stage,
    req.user.role,
    req.agentId
  );

  // ── Stage-specific task automation ────────────────────────────────────────
  if (stage === 'inspection') {
    await taskAutomation.createInspectionTasks(deal.id, deal.agent.id, {
      inspectionDate: stageOpts.inspectionDate,
      hasIssues:      stageOpts.hasIssues ?? false,
    });
  }
  if (stage === 'appraisal') {
    await taskAutomation.createAppraisalTasks(deal.id, deal.agent.id, {
      appraisalGapPct: stageOpts.appraisalGapPct ?? 0,
    });
  }

  // ── Commission record on close ────────────────────────────────────────────
  if (stage === 'closed') {
    const { total: commission, ratePct } = commissionService.calculate(deal.value, deal.type, {
      overrideRate: deal.commissionRate > 0 ? deal.commissionRate : null,
    });
    await commissionRecordSvc.createRecord(deal.id, deal.agent.id, commission, ratePct);
    sideEffects.push(`commission record created: $${commission.toFixed(0)} on ${ratePct.toFixed(1)}% hold`);
  }

  // ── Risk notification (probability dropped below 75%) ─────────────────────
  const previousProbability = existing.closingProbability;
  if (deal.closingProbability < 75 && previousProbability >= 75) {
    notificationSvc.notifyDealRisk(deal, previousProbability).catch(() => {});
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  auditSvc.logDealStageChange(auditSvc.fromRequest(req), deal.id, existing.stage, stage).catch(() => {});

  cache.invalidatePattern('dashboard:');
  success(res, { deal, sideEffects });
});

exports.updateProbability = catchAsync(async (req, res) => {
  const { probability } = req.body;
  if (typeof probability !== 'number' || probability < 0 || probability > 100) {
    throw AppError.badRequest('probability must be 0–100');
  }

  const existing = await prisma.deal.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!existing) throw AppError.notFound('Deal');

  const deal = await prisma.deal.update({
    where: { id: req.params.id },
    data:  { closingProbability: Math.round(probability), version: { increment: 1 } },
  });

  success(res, { id: deal.id, closingProbability: deal.closingProbability });
});

// ── Commission preview (read-only) ────────────────────────────────────────────
// GET /api/deals/:id/commission
exports.getCommission = catchAsync(async (req, res) => {
  const deal = await prisma.deal.findFirst({
    where:  { id: req.params.id, isDeleted: false, ...agentFilter(req) },
    select: { id: true, value: true, type: true, commissionRate: true, stage: true },
  });
  if (!deal) throw AppError.notFound('Deal');

  const commission = commissionService.calculate(deal.value, deal.type, {
    overrideRate: deal.commissionRate > 0 ? deal.commissionRate : null,
    split:        req.query.split === 'true',
  });

  success(res, {
    deal: { id: deal.id, value: deal.value, stage: deal.stage },
    commission,
    preview: commissionService.preview(deal.value, deal.type),
  });
});

exports.uploadDocument = [
  upload.single('document'),
  catchAsync(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
    });
    if (!deal) throw AppError.notFound('Deal');

    const doc = await prisma.dealDocument.create({
      data: {
        dealId: req.params.id,
        name:   req.body.name || req.file.originalname,
        type:   req.body.type || 'document',
        url:    `/uploads/${req.file.filename}`,
      },
    });

    await prisma.file.create({
      data: {
        filename:     req.file.filename,
        originalName: req.file.originalname,
        mimeType:     req.file.mimetype,
        size:         req.file.size,
        url:          `/uploads/${req.file.filename}`,
        entityType:   'deal',
        entityId:     req.params.id,
        uploadedById: req.user.id,
      },
    });

    // Document upload may trigger qualification check on linked lead
    if (deal.leadId) {
      const { checkAutoQualification } = require('../services/leadService');
      await checkAutoQualification(deal.leadId);
    }

    created(res, doc);
  }),
];

exports.listDocuments = catchAsync(async (req, res) => {
  const deal = await prisma.deal.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!deal) throw AppError.notFound('Deal');

  const docs = await prisma.dealDocument.findMany({
    where:   { dealId: req.params.id },
    orderBy: { uploadedAt: 'desc' },
  });
  success(res, docs);
});

exports.getClosingSoon = catchAsync(async (req, res) => {
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const deals = await prisma.deal.findMany({
    where: {
      ...agentFilter(req),
      isDeleted: false,
      stage:     { notIn: ['closed', 'lost'] },
      targetCloseDate: { lte: in30Days },
    },
    orderBy: { targetCloseDate: 'asc' },
    include: DEAL_INCLUDE,
  });
  success(res, deals);
});
