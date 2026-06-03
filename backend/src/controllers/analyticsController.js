const { prisma } = require('../config/database');
const { success } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const cache = require('../utils/cache');
const { agentFilter } = require('../middleware/auth');

const analyticsSvc = require('../services/analyticsService');

// ─── Portfolio summary ────────────────────────────────────────────────────────
// GET /api/analytics/portfolio   (manager/admin scoped; agent sees own)

exports.getPortfolio = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : (req.query.agentId ?? null);
  const key     = `analytics:portfolio:${agentId || 'all'}`;
  const cached  = cache.get(key);
  if (cached) return success(res, cached);

  const data = await analyticsSvc.getPortfolioSummary(agentId);
  cache.set(key, data, cache.TTL.ANALYTICS);
  success(res, data);
});

// ─── Revenue trend ────────────────────────────────────────────────────────────
// GET /api/analytics/revenue   ?months=12&agentId=

exports.getRevenue = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : (req.query.agentId ?? null);
  const months  = Math.min(parseInt(req.query.months) || 12, 36);
  const key     = `analytics:revenue:${agentId || 'all'}:${months}`;
  const cached  = cache.get(key);
  if (cached) return success(res, cached);

  const trend = await analyticsSvc.getRevenueTrend(agentId, months);
  cache.set(key, { trend }, cache.TTL.ANALYTICS);
  success(res, { trend });
});

// ─── Agent performance ────────────────────────────────────────────────────────
// GET /api/analytics/agents

exports.getAgentPerformance = catchAsync(async (req, res) => {
  const cached = cache.get('analytics:agents');
  if (cached) return success(res, cached);

  // Read from pre-computed agent metrics (refreshed nightly by scheduler)
  const agents = await prisma.agent.findMany({
    orderBy: { revenueYTD: 'desc' },
    select: {
      id: true, name: true, avatar: true, color: true, tier: true, rank: true,
      revenueYTD: true, revenuePrev: true, dealsClosedYTD: true,
      conversionRate: true, npsScore: true, avgDaysToClose: true,
      responseTimeAvg: true, repeatClientRate: true, retentionRisk: true,
      region: true, specialization: true,
    },
  });

  const data = {
    agents,
    cohorts: {
      elite:      agents.filter(a => a.tier === 'elite').length,
      core:       agents.filter(a => a.tier === 'core').length,
      developing: agents.filter(a => a.tier === 'developing').length,
    },
    topRevenue: agents[0] || null,
  };

  cache.set('analytics:agents', data, cache.TTL.ANALYTICS);
  success(res, data);
});

// ─── Agent leaderboard (full, with window functions) ─────────────────────────
// GET /api/analytics/agents/leaderboard   ?limit=50

exports.getAgentLeaderboard = catchAsync(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
  const key    = `analytics:leaderboard:${limit}`;
  const cached = cache.get(key);
  if (cached) return success(res, cached);

  const agents = await analyticsSvc.getAgentLeaderboard(limit);
  cache.set(key, agents, cache.TTL.LEADERBOARD);
  success(res, agents);
});

// ─── Agent underperformers ────────────────────────────────────────────────────
// GET /api/analytics/agents/underperformers

exports.getAgentUnderperformers = catchAsync(async (req, res) => {
  const cached = cache.get('analytics:underperformers');
  if (cached) return success(res, cached);

  const agents = await analyticsSvc.getAgentUnderperformers();
  cache.set('analytics:underperformers', agents, cache.TTL.ANALYTICS);
  success(res, agents);
});

// ─── Market overview ──────────────────────────────────────────────────────────
// GET /api/analytics/market

exports.getMarket = catchAsync(async (req, res) => {
  const cached = cache.get('analytics:market');
  if (cached) return success(res, cached);

  const [totalInventory, activeListings, pendingSales, soldThisMonth, avgAgg] = await Promise.all([
    prisma.property.count({ where: { isDeleted: false } }),
    prisma.property.count({ where: { isDeleted: false, status: 'Active' } }),
    prisma.property.count({ where: { isDeleted: false, status: 'Pending' } }),
    prisma.property.count({
      where: {
        isDeleted: false,
        status: 'Sold',
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.property.aggregate({
      where: { isDeleted: false, status: 'Active' },
      _avg: { price: true, daysOnMarket: true },
    }),
  ]);

  const byNeighborhood = await prisma.property.groupBy({
    by: ['neighborhood'],
    where: { isDeleted: false, status: 'Active' },
    _count: { id: true },
    _avg:   { price: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const data = {
    summary: {
      totalInventory, activeListings, pendingSales, soldThisMonth,
      avgListingPrice:   Math.round(avgAgg._avg.price || 0),
      avgDaysOnMarket:   Math.round(avgAgg._avg.daysOnMarket || 0),
    },
    byNeighborhood: byNeighborhood.map(n => ({
      neighborhood: n.neighborhood,
      listings:     n._count.id,
      avgPrice:     Math.round(n._avg.price || 0),
    })),
  };

  cache.set('analytics:market', data, cache.TTL.ANALYTICS);
  success(res, data);
});

// ─── Lead analytics ───────────────────────────────────────────────────────────
// GET /api/analytics/leads   ?days=90

exports.getLeadAnalytics = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const days    = Math.min(parseInt(req.query.days) || 90, 365);
  const key     = `analytics:leads:${agentId || 'all'}:${days}`;
  const cached  = cache.get(key);
  if (cached) return success(res, cached);

  const [funnel, bySource] = await Promise.all([
    analyticsSvc.getLeadFunnel(agentId, days),
    analyticsSvc.getLeadSourcePerformance(agentId),
  ]);

  const total  = funnel.reduce((s, r) => s + r.count, 0);
  const closed = funnel.find(r => r.stage === 'closed')?.count || 0;

  const data = {
    funnel,
    conversionRate: total > 0 ? ((closed / total) * 100).toFixed(1) : 0,
    bySource,
  };

  cache.set(key, data, cache.TTL.ANALYTICS);
  success(res, data);
});

// ─── Hot unassigned leads ─────────────────────────────────────────────────────
// GET /api/analytics/leads/hot   ?limit=10

exports.getHotLeads = catchAsync(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
  const leads  = await analyticsSvc.getHotUnassignedLeads(limit);
  success(res, leads);
});

// ─── Property comparables ─────────────────────────────────────────────────────
// GET /api/analytics/properties/comps/:propertyId

exports.getPropertyComps = catchAsync(async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.propertyId, isDeleted: false },
    select: { id: true, type: true, neighborhood: true, beds: true, baths: true, price: true },
  });
  if (!property) {
    return success(res, []);
  }

  const comps = await analyticsSvc.getPropertyComps({
    excludeId:   property.id,
    type:        property.type,
    neighborhood: property.neighborhood,
    beds:        property.beds,
    baths:       property.baths,
    targetPrice: property.price,
    limit:       parseInt(req.query.limit) || 5,
    monthsBack:  parseInt(req.query.months) || 6,
  });

  success(res, comps);
});

// ─── Deals at risk ────────────────────────────────────────────────────────────
// GET /api/analytics/deals/risk

exports.getDealsAtRisk = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const key     = `analytics:risk:${agentId || 'all'}`;
  const cached  = cache.get(key);
  if (cached) return success(res, cached);

  const deals = await analyticsSvc.getDealsAtRisk(agentId);
  cache.set(key, deals, 60); // 1-minute TTL — risk is time-sensitive
  success(res, deals);
});

// ─── Deal pipeline by stage ───────────────────────────────────────────────────
// GET /api/analytics/deals/pipeline

exports.getDealPipeline = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const key     = `analytics:pipeline:${agentId || 'all'}`;
  const cached  = cache.get(key);
  if (cached) return success(res, cached);

  const stages = await analyticsSvc.getDealPipeline(agentId);
  cache.set(key, stages, cache.TTL.ANALYTICS);
  success(res, stages);
});

// ─── Commission pipeline ──────────────────────────────────────────────────────
// GET /api/analytics/commissions/pending

exports.getCommissionPipeline = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : (req.query.agentId ?? null);

  const records = await analyticsSvc.getCommissionPipeline(agentId);

  const summary = {
    inHold:    records.filter(r => r.status === 'hold').length,
    released:  records.filter(r => r.status === 'released').length,
    holdAmount:     records.filter(r => r.status === 'hold')    .reduce((s, r) => s + Number(r.amount), 0),
    releasedAmount: records.filter(r => r.status === 'released').reduce((s, r) => s + Number(r.amount), 0),
  };

  success(res, { summary, records });
});

// ─── 90-day revenue forecast ──────────────────────────────────────────────────
// GET /api/analytics/forecast

exports.getForecast = catchAsync(async (req, res) => {
  const now     = new Date();
  const in30    = new Date(); in30.setDate(in30.getDate() + 30);
  const in90    = new Date(); in90.setDate(in90.getDate() + 90);

  const filter = agentFilter(req);
  const deals  = await prisma.deal.findMany({
    where: {
      ...filter,
      isDeleted: false,
      stage:     { notIn: ['closed', 'lost'] },
      targetCloseDate: { lte: in90 },
    },
    select: {
      id: true, value: true, closingProbability: true,
      targetCloseDate: true, stage: true,
      property: { select: { address: true } },
    },
    orderBy: { targetCloseDate: 'asc' },
  });

  const expectedRevenue = deals.reduce((s, d) => s + d.value * d.closingProbability / 100, 0);
  const bestCase        = deals.reduce((s, d) => s + d.value, 0);

  const next30 = deals.filter(d => new Date(d.targetCloseDate) <= in30);

  const makeBreakdown = list => list.slice(0, 5).map(d => ({
    deal:        d.property?.address || `Deal #${d.id.slice(-4)}`,
    value:       d.value,
    probability: d.closingProbability,
    daysToClose: Math.max(0, Math.round((new Date(d.targetCloseDate) - now) / 86400000)),
  }));

  success(res, {
    days90: {
      expectedRevenue: Math.round(expectedRevenue),
      bestCase:        Math.round(bestCase),
      dealCount:       deals.length,
      avgConfidence:   Math.round(deals.reduce((s, d) => s + d.closingProbability, 0) / (deals.length || 1)),
    },
    days30: {
      expectedRevenue: Math.round(next30.reduce((s, d) => s + d.value * d.closingProbability / 100, 0)),
      bestCase:        Math.round(next30.reduce((s, d) => s + d.value, 0)),
      dealCount:       next30.length,
      confidence:      Math.round(next30.reduce((s, d) => s + d.closingProbability, 0) / (next30.length || 1)),
      breakdown:       makeBreakdown(next30),
    },
  });
});

// ─── Marketing channel ROI (lead source performance) ─────────────────────────
// GET /api/analytics/channel-roi
// Note: spend is not tracked in this system. `roi` is a lead-quality score
// (avgLeadScore / 10) used as a relative efficiency proxy for ranking channels.

exports.getChannelROI = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const key     = `analytics:channel-roi:${agentId || 'all'}`;
  const cached  = cache.get(key);
  if (cached) return success(res, cached);

  const sources = await analyticsSvc.getLeadSourcePerformance(agentId);

  const data = sources.map(s => {
    const leads      = Number(s.totalLeads);
    const closed     = Number(s.closedLeads);
    const conversion = Number(s.conversionRate);
    const avgScore   = Number(s.avgScore);
    const revenue    = Math.round(Number(s.avgBudget) * closed);

    const roi = Math.round((avgScore / 10) * 10) / 10;

    const recommended = avgScore >= 85 ? 'increase'
      : avgScore >= 70 ? 'maintain'
      : avgScore >= 50 ? 'decrease'
      : 'eliminate';

    return { channel: s.source, spend: 0, leads, conversion, revenue, roi, recommended };
  });

  cache.set(key, data, cache.TTL.ANALYTICS);
  success(res, data);
});

// ─── Agent revenue cohort distribution ────────────────────────────────────────
// GET /api/analytics/agent-cohort

exports.getAgentCohort = catchAsync(async (req, res) => {
  const cached = cache.get('analytics:agent-cohort');
  if (cached) return success(res, cached);

  const agents = await prisma.agent.findMany({
    where:  { user: { isActive: true } },
    select: { tier: true, revenueYTD: true },
  });

  const total = agents.reduce((s, a) => s + a.revenueYTD, 0);

  const cohorts = ['elite', 'core', 'developing'].map(tier => {
    const group   = agents.filter(a => a.tier === tier);
    const revenue = group.reduce((s, a) => s + a.revenueYTD, 0);
    return {
      tier,
      agentCount:   group.length,
      totalRevenue: Math.round(revenue),
      revenuePct:   total > 0 ? Math.round((revenue / total) * 100) : 0,
      avgRevenue:   group.length > 0 ? Math.round(revenue / group.length) : 0,
    };
  });

  const data = { cohorts, totalAgents: agents.length, totalRevenue: Math.round(total) };
  cache.set('analytics:agent-cohort', data, cache.TTL.ANALYTICS);
  success(res, data);
});

// ─── Custom report (manager/admin only) ──────────────────────────────────────
// POST /api/analytics/custom-report

exports.generateReport = catchAsync(async (req, res) => {
  const { type, startDate, endDate, agentIds } = req.body;
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const end   = endDate   ? new Date(endDate)   : new Date();

  const dealFilter = {
    isDeleted: false,
    updatedAt: { gte: start, lte: end },
    ...(agentIds?.length && { agentId: { in: agentIds } }),
  };

  const [deals, leads] = await Promise.all([
    prisma.deal.findMany({
      where: dealFilter,
      select: { value: true, commissionRate: true, stage: true, agentId: true, type: true },
    }),
    prisma.lead.findMany({
      where: { ...dealFilter, stage: { in: ['closed', 'lost'] } },
      select: { stage: true, source: true, score: true },
    }),
  ]);

  const closed = deals.filter(d => d.stage === 'closed');
  success(res, {
    reportType: type || 'general',
    period:     { start, end },
    summary: {
      totalDeals:   deals.length,
      closedDeals:  closed.length,
      revenue:      closed.reduce((s, d) => s + d.value, 0),
      commission:   closed.reduce((s, d) => s + d.value * d.commissionRate / 100, 0),
      totalLeads:   leads.length,
      closedLeads:  leads.filter(l => l.stage === 'closed').length,
    },
    generatedAt: new Date().toISOString(),
  });
});

// ─── Legacy dashboard endpoint (kept for backwards compat) ────────────────────
// GET /api/analytics/dashboard

exports.getDashboard = catchAsync(async (req, res) => {
  const agentId = req.user.role === 'agent' ? req.agentId : null;
  const filter  = agentFilter(req);

  const [summary, overdueTasks, closedDealsYTD, closedMonth] = await Promise.all([
    analyticsSvc.getPortfolioSummary(agentId),
    prisma.task.count({
      where: { ...(agentId ? { assigneeId: agentId } : {}), isDeleted: false, status: 'overdue' },
    }),
    prisma.deal.count({ where: { ...filter, isDeleted: false, stage: 'closed', updatedAt: { gte: new Date(new Date().getFullYear(), 0, 1) } } }),
    prisma.deal.count({ where: { ...filter, isDeleted: false, stage: 'closed', updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
  ]);

  success(res, {
    kpis: {
      revenueYTD:       Number(summary.revenueYTD),
      pipelineValue:    Number(summary.pipelineValue),
      totalLeads:       summary.totalLeads,
      activeDeals:      summary.activeDeals,
      closedDealsYTD,
      closedDealsMonth: closedMonth,
      totalAgents:      await prisma.agent.count(),
      overdueTasks,
    },
  });
});
