const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { success, list } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const cache = require('../utils/cache');

const commissionRecordSvc = require('../services/commissionRecordService');

const createSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8),
  name:           z.string().min(1),
  phone:          z.string().default(''),
  region:         z.string().default(''),
  specialization: z.string().default('Residential'),
  tier:           z.enum(['elite', 'core', 'developing']).default('developing'),
  avatar:         z.string().optional(),
  color:          z.string().optional(),
});

const updateSchema = z.object({
  phone:          z.string().optional(),
  region:         z.string().optional(),
  specialization: z.string().optional(),
  tier:           z.enum(['elite', 'core', 'developing']).optional(),
  rank:           z.number().int().min(1).optional(),
}).partial();

const AGENT_SELECT = {
  id: true, name: true, avatar: true, color: true, tier: true, rank: true,
  region: true, specialization: true, revenueYTD: true, dealsClosedMonth: true,
  conversionRate: true, npsScore: true, activeDeals: true, leadsAssigned: true,
  retentionRisk: true, dealVelocity: true, email: true, phone: true, tenure: true,
  monthlyRevenue: true,
};

const monthlyRevenueSchema = z.array(z.number()).max(12);

// Validates the Json blob on every read and returns a safe number[] fallback,
// so corrupt or missing data never reaches frontend code that calls .map/.slice.
function parseMonthlyRevenue(raw) {
  return monthlyRevenueSchema.catch([]).parse(Array.isArray(raw) ? raw : []);
}

exports.create = catchAsync(async (req, res) => {
  const body = createSchema.parse(req.body);
  const avatar = body.avatar || body.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const agent = await prisma.$transaction(async (tx) => {
    const hashed = await bcrypt.hash(body.password, 10);
    const user = await tx.user.create({
      data: { email: body.email, password: hashed, role: 'agent' },
    });
    return tx.agent.create({
      data: {
        userId:         user.id,
        name:           body.name,
        email:          body.email,
        phone:          body.phone,
        region:         body.region,
        specialization: body.specialization,
        tier:           body.tier,
        avatar,
        color:          body.color || '#3b82f6',
      },
      select: AGENT_SELECT,
    });
  });

  cache.del('agents:leaderboard');
  success(res, agent, 201);
});

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = {};
  if (req.query.tier)   where.tier   = req.query.tier;
  if (req.query.region) where.region = { contains: req.query.region, mode: 'insensitive' };

  const [total, rows] = await Promise.all([
    prisma.agent.count({ where }),
    prisma.agent.findMany({
      where, skip, take: perPage,
      orderBy: { rank: 'asc' },
      select: AGENT_SELECT,
    }),
  ]);
  list(res, rows, buildPaginationMeta(page, perPage, total));
});

exports.getById = catchAsync(async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { email: true, role: true, createdAt: true } },
    },
  });
  if (!agent) throw AppError.notFound('Agent');
  success(res, { ...agent, monthlyRevenue: parseMonthlyRevenue(agent.monthlyRevenue) });
});

exports.getPerformance = catchAsync(async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) throw AppError.notFound('Agent');

  const [activeDeals, closedDeals, leads] = await Promise.all([
    prisma.deal.count({ where: { agentId: req.params.id, isDeleted: false, stage: { not: 'closed' } } }),
    prisma.deal.findMany({
      where: { agentId: req.params.id, isDeleted: false, stage: 'closed' },
      select: { value: true, updatedAt: true },
    }),
    prisma.lead.count({ where: { agentId: req.params.id, isDeleted: false } }),
  ]);

  const revenueYTD = closedDeals
    .filter(d => d.updatedAt.getFullYear() === new Date().getFullYear())
    .reduce((s, d) => s + d.value, 0);

  success(res, {
    agent: {
      id: agent.id, name: agent.name, tier: agent.tier, rank: agent.rank,
      revenueYTD: agent.revenueYTD, revenuePrev: agent.revenuePrev,
      dealsClosedYTD: agent.dealsClosedYTD, conversionRate: agent.conversionRate,
      avgDaysToClose: agent.avgDaysToClose, npsScore: agent.npsScore,
      responseTimeAvg: agent.responseTimeAvg, repeatClientRate: agent.repeatClientRate,
      monthlyRevenue: parseMonthlyRevenue(agent.monthlyRevenue),
      strengths: agent.strengths,
      developmentAreas: agent.developmentAreas,
      recommendation: agent.recommendation,
      retentionRisk: agent.retentionRisk,
    },
    live: { activeDeals, leadsAssigned: leads, revenueYTD },
  });
});

exports.getDeals = catchAsync(async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) throw AppError.notFound('Agent');

  const { page, perPage, skip } = parsePagination(req.query);
  const where = { agentId: req.params.id, isDeleted: false };
  if (req.query.stage) where.stage = req.query.stage;

  const [total, rows] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
      where, skip, take: perPage,
      orderBy: { updatedAt: 'desc' },
      include: {
        property: { select: { address: true } },
        client:   { select: { name: true } },
      },
    }),
  ]);
  list(res, rows, buildPaginationMeta(page, perPage, total));
});

exports.getLeads = catchAsync(async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) throw AppError.notFound('Agent');

  const { page, perPage, skip } = parsePagination(req.query);
  const where = { agentId: req.params.id, isDeleted: false };
  if (req.query.stage) where.stage = req.query.stage;

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where, skip, take: perPage,
      orderBy: { score: 'desc' },
      include: { tags: { select: { tag: true } } },
    }),
  ]);
  list(res, rows.map(l => ({ ...l, tags: l.tags.map(t => t.tag) })), buildPaginationMeta(page, perPage, total));
});

exports.update = catchAsync(async (req, res) => {
  const body = updateSchema.parse(req.body);
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) throw AppError.notFound('Agent');

  const updated = await prisma.agent.update({ where: { id: req.params.id }, data: body });
  cache.del('agents:leaderboard');
  success(res, updated);
});

exports.getLeaderboard = catchAsync(async (req, res) => {
  const cached = cache.get('agents:leaderboard');
  if (cached) return success(res, cached);

  const agents = await prisma.agent.findMany({
    orderBy: { revenueYTD: 'desc' },
    select: {
      id: true, name: true, avatar: true, color: true, tier: true, rank: true,
      region: true, revenueYTD: true, dealsClosedYTD: true, conversionRate: true,
      npsScore: true, avgDaysToClose: true, responseTimeAvg: true,
    },
  });

  const ranked = agents.map((a, i) => ({ ...a, leaderboardRank: i + 1 }));
  cache.set('agents:leaderboard', ranked, cache.TTL.LEADERBOARD);
  success(res, ranked);
});

// GET /api/agents/:id/commission — summary (from CommissionRecord for accuracy)
exports.getCommission = catchAsync(async (req, res) => {
  const agentId = req.params.id;

  // Agents can only view their own
  if (req.user.role === 'agent' && req.agentId !== agentId) {
    throw AppError.forbidden('You can only view your own commissions');
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });
  if (!agent) throw AppError.notFound('Agent');

  const summary = await commissionRecordSvc.getCommissionSummary(agentId);
  success(res, { agent, summary });
});

// GET /api/agents/:id/commissions — full record list (from CommissionRecord)
exports.getCommissions = catchAsync(async (req, res) => {
  const agentId = req.params.id;

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
