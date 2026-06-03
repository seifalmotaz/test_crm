const { prisma } = require('../config/database');
const { success } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const cache = require('../utils/cache');
const { agentFilter } = require('../middleware/auth');

const analyticsSvc = require('../services/analyticsService');

// ─── Full summary (cached per role/agent) ─────────────────────────────────────
// GET /api/dashboard

exports.getSummary = catchAsync(async (req, res) => {
  const key = `dashboard:summary:${req.user.role}:${req.agentId || 'all'}`;
  const cached = cache.get(key);
  if (cached) return success(res, cached);

  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const filter  = agentFilter(req);

  const [summary, atRiskCount, overdueCount] = await Promise.all([
    analyticsSvc.getPortfolioSummary(agentId),
    prisma.deal.count({
      where: { ...filter, isDeleted: false, risk: 'high' },
    }),
    prisma.task.count({
      where: {
        ...(agentId ? { assigneeId: agentId } : {}),
        isDeleted: false,
        status: 'overdue',
      },
    }),
  ]);

  const data = {
    kpis: {
      totalProperties:  summary.totalProperties,
      activeListings:   summary.activeListings,
      portfolioValue:   Number(summary.portfolioValue),
      activeDeals:      summary.activeDeals,
      pipelineValue:    Number(summary.pipelineValue),
      revenueYTD:       Number(summary.revenueYTD),
      totalLeads:       summary.totalLeads,
      hotLeads:         summary.hotLeads,
      overdueTasks:     summary.overdueTasks,
      closedDealsMonth: 0, // populated from pipeline below if needed
    },
    alerts: [
      atRiskCount   > 0 && { priority: 'high',   message: `${atRiskCount} deal(s) at risk`,           action: 'Review deal pipeline' },
      summary.hotLeads > 0 && { priority: 'medium', message: `${summary.hotLeads} hot lead(s) at capacity agents`, action: 'Review and reassign' },
      overdueCount  > 0 && { priority: 'low',    message: `${overdueCount} overdue task(s)`,           action: 'Check task board' },
    ].filter(Boolean),
  };

  cache.set(key, data, cache.TTL.DASHBOARD);
  success(res, data);
});

// ─── Revenue trend (monthly) ──────────────────────────────────────────────────
// GET /api/dashboard/revenue   ?months=12

exports.getRevenueTrend = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const months  = Math.min(parseInt(req.query.months) || 12, 36);
  const key     = `dashboard:revenue:${req.user.role}:${req.agentId || 'all'}:${months}`;

  const cached = cache.get(key);
  if (cached) return success(res, cached);

  const trend = await analyticsSvc.getRevenueTrend(agentId, months);
  cache.set(key, trend, cache.TTL.DASHBOARD);
  success(res, trend);
});

// ─── Pipeline by stage ────────────────────────────────────────────────────────
// GET /api/dashboard/pipeline

exports.getPipeline = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const key     = `dashboard:pipeline:${req.user.role}:${req.agentId || 'all'}`;

  const cached = cache.get(key);
  if (cached) return success(res, cached);

  const stages = await analyticsSvc.getDealPipeline(agentId);
  cache.set(key, stages, cache.TTL.DASHBOARD);
  success(res, stages);
});

// ─── Top agents ───────────────────────────────────────────────────────────────
// GET /api/dashboard/top-agents

exports.getTopAgents = catchAsync(async (req, res) => {
  const cached = cache.get('dashboard:top-agents');
  if (cached) return success(res, cached);

  const agents = await analyticsSvc.getAgentLeaderboard(10);
  cache.set('dashboard:top-agents', agents, cache.TTL.LEADERBOARD);
  success(res, agents);
});

// ─── Deals closing soon ───────────────────────────────────────────────────────
// GET /api/dashboard/closing-soon   ?days=30

exports.getClosingSoon = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const days    = Math.min(parseInt(req.query.days) || 30, 90);
  const key     = `dashboard:closing:${req.user.role}:${req.agentId || 'all'}:${days}`;

  const cached = cache.get(key);
  if (cached) return success(res, cached);

  const deals = await analyticsSvc.getClosingSoon(days, agentId);
  cache.set(key, deals, cache.TTL.DASHBOARD);
  success(res, deals);
});
