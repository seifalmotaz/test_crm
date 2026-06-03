/**
 * Agent Business Logic Service
 *
 * RULES ENFORCED HERE:
 *  1. Performance metrics — revenueYTD, dealsClosedYTD, conversionRate, avgDaysToClose
 *  2. Tier assignment — Elite (top 10%), Core (top 40%), Developing (rest)
 *  3. Ranking — by revenue → deals → conversion
 *  4. Lead assignment candidates — fairness + specialization matching
 *  5. Performance alerts — revenue drop, low conversion, high response time
 */

const { prisma } = require('../config/database');

// ─── Tier thresholds ──────────────────────────────────────────────────────────

// Percentile cutoffs (top-N%)
const TIER_CUTOFFS = {
  elite: 0.10, // top 10%
  core:  0.40, // top 40%
  // developing: remainder
};

const ALERT_THRESHOLDS = {
  revenueDropPct:      20,  // alert if month-over-month revenue drops > 20%
  minConversionRate:   20,  // alert if conversion rate < 20%
  maxResponseTimeHrs:  24,  // alert if average response time > 24 hours
};

// ─── Single-agent metrics refresh ────────────────────────────────────────────

async function refreshAgentMetrics(agentId) {
  const now       = new Date();
  const yearStart  = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Deals closed this calendar year (updatedAt used as proxy for close date)
  const closedYTD = await prisma.deal.findMany({
    where: {
      agentId,
      stage:     'closed',
      isDeleted: false,
      updatedAt: { gte: yearStart },
    },
    select: {
      value:          true,
      commissionRate: true,
      createdAt:      true,
      updatedAt:      true,
    },
  });

  const dealsClosedYTD   = closedYTD.length;
  const dealsClosedMonth = closedYTD.filter(d => d.updatedAt >= monthStart).length;

  // Revenue YTD: commissionRate is stored as a percentage (e.g. 5 = 5%)
  const revenueYTD = closedYTD.reduce(
    (sum, d) => sum + d.value * (d.commissionRate / 100), 0
  );

  // Previous month revenue (for drop alert)
  const closedPrevMonth = await prisma.deal.findMany({
    where: {
      agentId,
      stage:     'closed',
      isDeleted: false,
      updatedAt: { gte: prevMonth, lte: prevEnd },
    },
    select: { value: true, commissionRate: true },
  });
  const revenuePrev = closedPrevMonth.reduce(
    (sum, d) => sum + d.value * (d.commissionRate / 100), 0
  );

  // Average deal value
  const totalDealValue = closedYTD.reduce((sum, d) => sum + d.value, 0);
  const avgDealValue   = dealsClosedYTD > 0 ? totalDealValue / dealsClosedYTD : 0;

  // Conversion rate: deals closed YTD / total leads assigned
  const totalLeads = await prisma.lead.count({ where: { agentId, isDeleted: false } });
  const conversionRate = totalLeads > 0
    ? parseFloat(((dealsClosedYTD / totalLeads) * 100).toFixed(2))
    : 0;

  // Active leads & deals
  const [leadsAssigned, activeDeals] = await Promise.all([
    prisma.lead.count({
      where: { agentId, isDeleted: false, stage: { notIn: ['closed', 'lost'] } },
    }),
    prisma.deal.count({
      where: { agentId, isDeleted: false, stage: { notIn: ['closed', 'lost'] } },
    }),
  ]);

  // Average days to close (createdAt → updatedAt for closed deals, rough proxy)
  const daysList = closedYTD.map(d =>
    (d.updatedAt.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const avgDaysToClose = daysList.length > 0
    ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length)
    : 0;

  // Performance alerts
  const alerts = [];
  const currentMonthRevenue = closedYTD
    .filter(d => d.updatedAt >= monthStart)
    .reduce((sum, d) => sum + d.value * (d.commissionRate / 100), 0);

  if (revenuePrev > 0) {
    const drop = ((revenuePrev - currentMonthRevenue) / revenuePrev) * 100;
    if (drop > ALERT_THRESHOLDS.revenueDropPct) {
      alerts.push({
        type:    'REVENUE_DROP',
        message: `Revenue down ${drop.toFixed(0)}% vs previous month`,
        severity: 'warning',
      });
    }
  }
  if (conversionRate < ALERT_THRESHOLDS.minConversionRate && totalLeads >= 5) {
    alerts.push({
      type:     'LOW_CONVERSION',
      message:  `Conversion rate ${conversionRate.toFixed(1)}% is below 20% threshold — coaching needed`,
      severity: 'warning',
    });
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      revenueYTD,
      revenuePrev,
      dealsClosedYTD,
      dealsClosedMonth,
      avgDealValue,
      conversionRate,
      leadsAssigned,
      activeDeals,
      avgDaysToClose,
    },
  });

  return { agentId, revenueYTD, dealsClosedYTD, leadsAssigned, activeDeals, conversionRate, avgDaysToClose, alerts };
}

// ─── Tier & rank recalculation ────────────────────────────────────────────────
// Primary sort: revenueYTD DESC
// Secondary sort: dealsClosedYTD DESC
// Tertiary sort: conversionRate DESC

async function recalculateTiersAndRanks() {
  const agents = await prisma.agent.findMany({
    where:   { user: { isActive: true } },
    orderBy: [
      { revenueYTD:       'desc' },
      { dealsClosedYTD:   'desc' },
      { conversionRate:   'desc' },
    ],
    select: { id: true, revenueYTD: true, dealsClosedYTD: true, conversionRate: true },
  });

  const total = agents.length;
  if (total === 0) return { updated: 0 };

  const updates = agents.map((agent, idx) => {
    const pct  = (idx + 1) / total;
    const tier = pct <= TIER_CUTOFFS.elite ? 'elite'
               : pct <= TIER_CUTOFFS.core  ? 'core'
               : 'developing';
    return prisma.agent.update({
      where: { id: agent.id },
      data:  { tier, rank: idx + 1 },
    });
  });

  await prisma.$transaction(updates);
  return { updated: total };
}

// ─── Lead assignment candidates ───────────────────────────────────────────────

const MAX_ACTIVE_LEADS = 15;

// Returns ranked list of agents who can receive a new lead.
// Scoring: specialization match (+10), region match (+5), fewer leads = higher score
async function getAssignmentCandidates(leadType, leadLocation) {
  const agents = await prisma.agent.findMany({
    where: {
      user:          { role: 'agent', isActive: true },
      leadsAssigned: { lt: MAX_ACTIVE_LEADS },
    },
    orderBy: { leadsAssigned: 'asc' },
  });

  return agents
    .map(agent => {
      let priority = 0;
      const type = (leadType ?? '').toLowerCase();
      const loc  = (leadLocation ?? '').toLowerCase();

      if (agent.specialization && type && agent.specialization.toLowerCase().includes(type)) priority += 10;
      if (agent.region && loc && agent.region.toLowerCase().includes(loc))                   priority +=  5;
      priority -= agent.leadsAssigned; // prefer agents with lighter workload

      return {
        id:             agent.id,
        name:           agent.name,
        leadsAssigned:  agent.leadsAssigned,
        specialization: agent.specialization,
        region:         agent.region,
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

// ─── Performance alert scan (used by scheduler) ───────────────────────────────

async function scanPerformanceAlerts() {
  const agents  = await prisma.agent.findMany({
    where:  { user: { role: 'agent', isActive: true } },
    select: { id: true, name: true, revenueYTD: true, revenuePrev: true, conversionRate: true, responseTimeAvg: true },
  });

  const alerts = [];
  for (const agent of agents) {
    if (agent.revenuePrev > 0) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      // Compare current month vs prev (metrics updated nightly so revenueYTD isn't ideal,
      // but revenuePrev is stored from last refresh for exactly this comparison)
      const drop = ((agent.revenuePrev - agent.revenueYTD) / agent.revenuePrev) * 100;
      if (drop > ALERT_THRESHOLDS.revenueDropPct) {
        alerts.push({ agentId: agent.id, name: agent.name, type: 'REVENUE_DROP', detail: `${drop.toFixed(0)}% drop` });
      }
    }
    if (agent.conversionRate < ALERT_THRESHOLDS.minConversionRate) {
      alerts.push({ agentId: agent.id, name: agent.name, type: 'LOW_CONVERSION', detail: `${agent.conversionRate.toFixed(1)}%` });
    }
    if (agent.responseTimeAvg > ALERT_THRESHOLDS.maxResponseTimeHrs) {
      alerts.push({ agentId: agent.id, name: agent.name, type: 'SLOW_RESPONSE', detail: `${agent.responseTimeAvg.toFixed(1)}h avg` });
    }
  }

  return alerts;
}

module.exports = {
  TIER_CUTOFFS,
  ALERT_THRESHOLDS,
  MAX_ACTIVE_LEADS,
  refreshAgentMetrics,
  recalculateTiersAndRanks,
  getAssignmentCandidates,
  scanPerformanceAlerts,
};
