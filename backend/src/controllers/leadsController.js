const { z } = require('zod');
const { prisma } = require('../config/database');
const { success, created, list, error: sendError } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { agentFilter } = require('../middleware/auth');

const ensureAgentProfile    = require('../utils/ensureAgentProfile');
const leadService           = require('../services/leadService');
const taskAutomation        = require('../services/taskAutomation');
const notificationSvc       = require('../services/notificationService');
const auditSvc              = require('../services/auditService');
const validationSvc         = require('../services/validationService');
const leadConversionService = require('../services/leadConversionService');

const createSchema = z.object({
  name:        z.string().min(2),
  type:        z.string().min(1),
  email:       z.string().email(),
  phone:       z.string().min(7),
  source:      z.string().min(1),
  budget:      z.number().min(0),
  budgetMin:   z.number().min(0).optional().default(0),
  interest:    z.string().min(1),
  location:    z.string().min(1),
  timeline:    z.number().int().min(0).optional().default(30),
  stage:       z.enum(['freshLead', 'qualified', 'callBack', 'followUp', 'notInterested', 'lowBudget', 'reservation']).optional().default('freshLead'),
  score:       z.number().int().min(0).max(100).optional(),
  agentId:     z.string().optional(),
  tags:        z.array(z.string()).optional().default([]),
  notes:       z.string().optional(),
  project:     z.string().optional(),
  preApproved: z.boolean().optional().default(false),
});

const interactionSchema = z.object({
  action: z.string().min(1),
  type:   z.enum(['view', 'call', 'email', 'meeting', 'request', 'form', 'action']),
  date:   z.string().optional(),
  notes:  z.string().optional(),
});

const LEAD_INCLUDE = {
  agent:     { select: { id: true, name: true, avatar: true } },
  tags:      { select: { tag: true } },
  createdBy: { select: { id: true, email: true, agent: { select: { id: true, name: true } } } },
};

function mapLead(l) {
  return { ...l, tags: l.tags?.map(t => t.tag) || [] };
}

function buildFilter(q, agentF) {
  const where = { ...agentF, isDeleted: false };
  if (q.stage)    where.stage  = q.stage;
  if (q.source)   where.source = q.source;
  if (q.minScore) where.score  = { gte: parseInt(q.minScore) };
  if (q.search)   where.name   = { contains: q.search, mode: 'insensitive' };
  return where;
}

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where   = buildFilter(req.query, agentFilter(req));
  const orderBy = req.query.sort === 'score' ? { score: 'desc' } : { createdAt: 'desc' };

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, skip, take: perPage, orderBy, include: LEAD_INCLUDE }),
  ]);

  list(res, rows.map(mapLead), buildPaginationMeta(page, perPage, total));
});

exports.create = catchAsync(async (req, res) => {
  const body    = createSchema.parse(req.body);
  const agentId = await ensureAgentProfile(req, body.agentId);
  if (!agentId) throw AppError.badRequest('agentId is required');

  // ── Extended validation (email typo, uniqueness, budget, timeline) ────────
  const validation = await validationSvc.validateLeadBody(body);
  if (!validation.valid) {
    const firstError = validation.errors[0];
    throw AppError.badRequest(
      firstError?.duplicate
        ? `Duplicate ${firstError.field}: a lead already exists with this ${firstError.field}`
        : `Validation failed: ${firstError?.error ?? firstError?.field}`
    );
  }

  // ── Duplicate detection ────────────────────────────────────────────────────
  const duplicate = await leadService.findDuplicate(body.email, body.phone);
  if (duplicate) {
    return sendError(res, 409, 'DUPLICATE_LEAD', 'A lead with this email or phone already exists', {
      existingLeadId: duplicate.id,
      existingName:   duplicate.name,
      mergeUrl:       `/api/leads/${duplicate.id}/merge`,
    });
  }

  // ── Create lead ────────────────────────────────────────────────────────────
  const { tags, ...data } = body;
  const avatar = data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  // Calculate initial score
  const { score, breakdown } = leadService.calculateScore(data, 0);

  const lead = await prisma.lead.create({
    data: {
      ...data,
      avatar,
      agentId,
      score,
      scoreBreakdown: breakdown,
      createdById: req.user?.id || null,
      tags: { create: tags.map(tag => ({ tag })) },
    },
    include: LEAD_INCLUDE,
  });

  // ── Auto-assignment based on score ────────────────────────────────────────
  const assignment = await leadService.autoAssignLead(lead.id);

  // ── Auto-qualification check ──────────────────────────────────────────────
  await leadService.checkAutoQualification(lead.id);

  // ── Create follow-up task sequence ────────────────────────────────────────
  const effectiveAgentId = assignment.assignedAgentId || agentId;
  await taskAutomation.createLeadAssignedTasks(lead.id, effectiveAgentId);

  // ── Notifications ────────────────────────────────────────────────────────
  const updatedLead = await prisma.lead.findFirst({ where: { id: lead.id, isDeleted: false }, include: LEAD_INCLUDE });
  const assignedAgent = assignment.assignedAgentId || agentId;
  if (assignedAgent && assignedAgent !== req.agentId) {
    notificationSvc.notifyLeadAssigned(updatedLead, assignedAgent).catch(() => {});
  }
  if (assignment.score >= 80 && assignment.assignedAgentId) {
    notificationSvc.notifyHotLead(updatedLead, assignment.assignedAgentId).catch(() => {});
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  auditSvc.log('LEAD_CREATE', 'leads', {
    ...auditSvc.fromRequest(req),
    resourceId: lead.id,
    changes:    { after: { name: updatedLead.name, score: updatedLead.score, agentId: updatedLead.agentId } },
  }).catch(() => {});

  created(res, {
    ...mapLead(updatedLead),
    assignment,
    validationWarnings: validation.warnings,
    isHighPriority:     validation.isHighPriority,
  });
});

exports.getById = catchAsync(async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where:   { id: req.params.id, isDeleted: false, ...agentFilter(req) },
    include: { ...LEAD_INCLUDE, interactions: { orderBy: { date: 'desc' } } },
  });
  if (!lead) throw AppError.notFound('Lead');
  success(res, mapLead(lead));
});

exports.update = catchAsync(async (req, res) => {
  const { version, tags, ...data } = req.body;

  const existing = await prisma.lead.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!existing) throw AppError.notFound('Lead');
  if (typeof version !== 'number') throw AppError.badRequest('version is required');
  if (existing.version !== version) throw AppError.versionConflict();

  const previousStage = existing.stage;

  const lead = await prisma.$transaction(async (tx) => {
    if (tags !== undefined) {
      await tx.leadTag.deleteMany({ where: { leadId: req.params.id } });
      await tx.leadTag.createMany({ data: tags.map(tag => ({ leadId: req.params.id, tag })) });
    }
    // Track agent reassignment history
    const agentChanging = data.agentId && existing.agentId && data.agentId !== existing.agentId;
    const extraData = agentChanging
      ? { previousAgentIds: { push: existing.agentId } }
      : {};
    return tx.lead.update({
      where:   { id: req.params.id },
      data:    { ...data, ...extraData, version: { increment: 1 } },
      include: LEAD_INCLUDE,
    });
  });

  // ── Post-update business logic ─────────────────────────────────────────────
  const [scoreResult, qualification] = await Promise.all([
    leadService.refreshScore(lead.id),
    leadService.checkAutoQualification(lead.id),
  ]);

  // If lead just became qualified (auto or manual), create showing task
  const justQualified =
    previousStage !== 'qualified' &&
    (lead.stage === 'qualified' || qualification?.newStage === 'qualified');
  if (justQualified && lead.agentId) {
    await taskAutomation.createLeadQualifiedTask(lead.id, lead.agentId);
  }

  // Notify agent when lead is assigned/reassigned
  const agentAssigned = data.agentId && data.agentId !== existing.agentId;
  if (agentAssigned && data.agentId !== req.agentId) {
    notificationSvc.notifyLeadAssigned(lead, data.agentId).catch(() => {});
  }

  success(res, { ...mapLead(lead), score: scoreResult?.score, qualification });
});

exports.archive = catchAsync(async (req, res) => {
  const existing = await prisma.lead.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!existing) throw AppError.notFound('Lead');
  await prisma.lead.update({ where: { id: req.params.id }, data: { isDeleted: true } });
  success(res, { message: 'Lead archived' });
});

exports.addInteraction = catchAsync(async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!lead) throw AppError.notFound('Lead');

  const body        = interactionSchema.parse(req.body);
  const interaction = await prisma.leadInteraction.create({
    data: {
      leadId: req.params.id,
      date:   body.date ? new Date(body.date) : new Date(),
      action: body.action,
      type:   body.type,
      notes:  body.notes,
    },
  });

  await prisma.lead.update({
    where: { id: req.params.id },
    data:  { lastContact: 0 },
  });

  // Engagement increases → refresh score
  const scoreResult = await leadService.refreshScore(req.params.id);

  // Check if engagement score pushed lead into qualification
  await leadService.checkAutoQualification(req.params.id);

  created(res, { interaction, score: scoreResult });
});

exports.getInteractions = catchAsync(async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, isDeleted: false, ...agentFilter(req) },
  });
  if (!lead) throw AppError.notFound('Lead');

  const { page, perPage, skip } = parsePagination(req.query);
  const [total, rows] = await Promise.all([
    prisma.leadInteraction.count({ where: { leadId: req.params.id } }),
    prisma.leadInteraction.findMany({
      where:   { leadId: req.params.id },
      orderBy: { date: 'desc' },
      skip,
      take:    perPage,
    }),
  ]);
  list(res, rows, buildPaginationMeta(page, perPage, total));
});

exports.updateInteraction = catchAsync(async (req, res) => {
  const { id, interactionId } = req.params;
  const lead = await prisma.lead.findFirst({ where: { id, isDeleted: false } });
  if (!lead) throw AppError.notFound('Lead');

  const interaction = await prisma.leadInteraction.findFirst({ where: { id: interactionId, leadId: id } });
  if (!interaction) throw AppError.notFound('Interaction');

  const { action, notes } = req.body;
  const updated = await prisma.leadInteraction.update({
    where: { id: interactionId },
    data: {
      ...(action !== undefined && { action }),
      ...(notes  !== undefined && { notes }),
    },
  });
  success(res, updated);
});

exports.deleteInteraction = catchAsync(async (req, res) => {
  const { id, interactionId } = req.params;
  const lead = await prisma.lead.findFirst({ where: { id, isDeleted: false } });
  if (!lead) throw AppError.notFound('Lead');

  const interaction = await prisma.leadInteraction.findFirst({ where: { id: interactionId, leadId: id } });
  if (!interaction) throw AppError.notFound('Interaction');

  await prisma.leadInteraction.delete({ where: { id: interactionId } });
  success(res, { message: 'Interaction deleted' });
});

// ── Merge duplicates ──────────────────────────────────────────────────────────
// POST /api/leads/:id/merge   body: { mergeId }
exports.merge = catchAsync(async (req, res) => {
  const { mergeId } = req.body;
  if (!mergeId) throw AppError.badRequest('mergeId is required');

  // Only admin/manager can merge (to prevent agents from hiding duplicate work)
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw AppError.forbidden('Only managers and admins can merge leads');
  }

  const result = await leadService.mergeLeads(req.params.id, mergeId);
  auditSvc.logLeadMerge(auditSvc.fromRequest(req), req.params.id, mergeId).catch(() => {});
  success(res, result);
});

// ── Score preview (read-only) ─────────────────────────────────────────────────
// GET /api/leads/:id/score
exports.getScore = catchAsync(async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where:   { id: req.params.id, isDeleted: false, ...agentFilter(req) },
    include: { interactions: { select: { id: true } } },
  });
  if (!lead) throw AppError.notFound('Lead');

  const { score, breakdown } = leadService.calculateScore(lead, lead.interactions.length);
  success(res, {
    currentScore: lead.score,
    calculatedScore: score,
    breakdown,
    tier: score >= 80 ? 'immediate' : score >= 60 ? 'standard' : 'pool',
    maxPossible: 100,
    components: leadService.SCORE,
  });
});

exports.getConversionAnalytics = catchAsync(async (req, res) => {
  const filter = agentFilter(req);
  const [prospect, qualified, negotiating, readyToBuy, closed] = await Promise.all([
    prisma.lead.count({ where: { ...filter, isDeleted: false, stage: 'prospect' } }),
    prisma.lead.count({ where: { ...filter, isDeleted: false, stage: 'qualified' } }),
    prisma.lead.count({ where: { ...filter, isDeleted: false, stage: 'negotiating' } }),
    prisma.lead.count({ where: { ...filter, isDeleted: false, stage: 'readyToBuy' } }),
    prisma.lead.count({ where: { ...filter, isDeleted: false, stage: 'closed' } }),
  ]);

  const total = prospect + qualified + negotiating + readyToBuy + closed;
  success(res, {
    funnel:         { prospect, qualified, negotiating, readyToBuy, closed, total },
    conversionRate: total > 0 ? ((closed / total) * 100).toFixed(1) : 0,
  });
});

// ── Lead → Deal conversion (atomic) ──────────────────────────────────────────
// POST /api/leads/:id/convert   body: { propertyId, agentId?, commissionRate?, notes? }
exports.convertToDeal = catchAsync(async (req, res) => {
  const { propertyId, agentId, commissionRate, notes } = req.body;
  if (!propertyId) throw AppError.badRequest('propertyId is required');

  const result = await leadConversionService.convertLeadToDeal(
    req.params.id,
    propertyId,
    { agentId, commissionRate, notes },
    auditSvc.fromRequest(req),
  );

  created(res, result);
});
