'use strict'

/**
 * Agent retention risk scoring — integration tests against a real database (no mocks).
 *
 * Tests two complementary functions:
 *
 *  scanPerformanceAlerts()  — reads stored agent metrics and returns typed alerts.
 *    Metrics are set directly via prisma to isolate the alert logic from the
 *    metric computation.
 *
 *  refreshAgentMetrics()    — computes live metrics from real deals and leads, then
 *    persists them. Verified by seeding deals/leads via prisma and asserting the
 *    returned values match expected calculations.
 *
 * Alert thresholds (from ALERT_THRESHOLDS):
 *   REVENUE_DROP:   (revenuePrev - revenueYTD) / revenuePrev * 100 > 20%
 *   LOW_CONVERSION: conversionRate < 20%  AND  totalLeads >= 5
 *   SLOW_RESPONSE:  responseTimeAvg > 24 hrs
 */

const request      = require('supertest')
const app          = require('../src/app')
const { prisma }   = require('../src/config/database')
const agentService = require('../src/services/agentService')

const TS          = Date.now()
const ADMIN_EMAIL = `retention-admin-${TS}@example.com`
const PASSWORD    = 'Password123!'

let adminToken
let agentId  // the primary test agent

beforeAll(async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ email: ADMIN_EMAIL, password: PASSWORD, role: 'admin' })

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: PASSWORD })
  adminToken = loginRes.body.data.accessToken

  const agentRes = await request(app)
    .post('/api/agents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email:    `retention-agent-${TS}@example.com`,
      password: 'AgentPass123!',
      name:     'Retention Agent',
      region:   'Downtown',
      tier:     'developing',
    })
  agentId = agentRes.body.data.id
})

// ── Helper: set stored metrics on our test agent ────────────────────────────────

async function setMetrics(data) {
  await prisma.agent.update({ where: { id: agentId }, data })
}

// ── Helper: filter alerts to only those for our test agent ──────────────────────

async function getOurAlerts() {
  const all = await agentService.scanPerformanceAlerts()
  return all.filter(a => a.agentId === agentId)
}

// ─── scanPerformanceAlerts ────────────────────────────────────────────────────

describe('scanPerformanceAlerts — REVENUE_DROP', () => {
  afterEach(() => setMetrics({ revenuePrev: 0, revenueYTD: 0 }))

  it('fires REVENUE_DROP when revenue fell more than 20% vs prior period', async () => {
    // (10000 - 5000) / 10000 * 100 = 50% drop → above threshold
    await setMetrics({ revenuePrev: 10_000, revenueYTD: 5_000 })

    const alerts = await getOurAlerts()
    expect(alerts).toContainEqual(expect.objectContaining({ agentId, type: 'REVENUE_DROP' }))
  })

  it('does not fire REVENUE_DROP for a ≤ 20% revenue decline', async () => {
    // (10000 - 8500) / 10000 * 100 = 15% drop → below threshold
    await setMetrics({ revenuePrev: 10_000, revenueYTD: 8_500 })

    const alerts = await getOurAlerts()
    expect(alerts.find(a => a.type === 'REVENUE_DROP')).toBeUndefined()
  })

  it('does not fire REVENUE_DROP when revenuePrev is 0 (new agent — no prior baseline)', async () => {
    await setMetrics({ revenuePrev: 0, revenueYTD: 0 })

    const alerts = await getOurAlerts()
    expect(alerts.find(a => a.type === 'REVENUE_DROP')).toBeUndefined()
  })
})

describe('scanPerformanceAlerts — LOW_CONVERSION', () => {
  afterEach(() => setMetrics({ conversionRate: 50 }))

  it('fires LOW_CONVERSION when conversion rate is below 20%', async () => {
    await setMetrics({ conversionRate: 15 })

    const alerts = await getOurAlerts()
    expect(alerts).toContainEqual(expect.objectContaining({ agentId, type: 'LOW_CONVERSION' }))
  })

  it('does not fire LOW_CONVERSION when conversion rate is exactly 20%', async () => {
    await setMetrics({ conversionRate: 20 })

    const alerts = await getOurAlerts()
    expect(alerts.find(a => a.type === 'LOW_CONVERSION')).toBeUndefined()
  })

  it('does not fire LOW_CONVERSION when rate is above threshold', async () => {
    await setMetrics({ conversionRate: 35 })

    const alerts = await getOurAlerts()
    expect(alerts.find(a => a.type === 'LOW_CONVERSION')).toBeUndefined()
  })
})

describe('scanPerformanceAlerts — SLOW_RESPONSE', () => {
  afterEach(() => setMetrics({ responseTimeAvg: 0 }))

  it('fires SLOW_RESPONSE when average response time exceeds 24 hours', async () => {
    await setMetrics({ responseTimeAvg: 30 })

    const alerts = await getOurAlerts()
    expect(alerts).toContainEqual(expect.objectContaining({ agentId, type: 'SLOW_RESPONSE' }))
  })

  it('does not fire SLOW_RESPONSE when response time is exactly 24 hours', async () => {
    await setMetrics({ responseTimeAvg: 24 })

    const alerts = await getOurAlerts()
    expect(alerts.find(a => a.type === 'SLOW_RESPONSE')).toBeUndefined()
  })

  it('does not fire SLOW_RESPONSE when response time is below threshold', async () => {
    await setMetrics({ responseTimeAvg: 12 })

    const alerts = await getOurAlerts()
    expect(alerts.find(a => a.type === 'SLOW_RESPONSE')).toBeUndefined()
  })
})

describe('scanPerformanceAlerts — clean agent returns no alerts', () => {
  it('returns no alerts for an agent with healthy metrics', async () => {
    await setMetrics({
      revenuePrev:     10_000,
      revenueYTD:      12_000, // revenue GREW — no drop
      conversionRate:  30,     // above 20% threshold
      responseTimeAvg: 8,      // below 24 hour threshold
    })

    const alerts = await getOurAlerts()
    expect(alerts).toHaveLength(0)
  })
})

// ─── refreshAgentMetrics ──────────────────────────────────────────────────────

describe('refreshAgentMetrics — live computation from real deals', () => {
  let dealIds = []

  beforeAll(async () => {
    // Seed 2 closed deals for this year directly via prisma.
    // Both with value=100_000 and commissionRate=5 → each generates 5_000 in revenue.
    // revenueYTD = 2 * 100_000 * (5/100) = 10_000
    for (let i = 0; i < 2; i++) {
      const deal = await prisma.deal.create({
        data: {
          agentId,
          type:            'buy',
          value:           100_000,
          commissionRate:  5,
          stage:           'closed',
          offerDate:       new Date('2026-01-15'),
          targetCloseDate: new Date('2026-03-15'),
        },
      })
      dealIds.push(deal.id)
    }
  })

  afterAll(async () => {
    // Clean up so these deals don't pollute other test groups
    if (dealIds.length > 0) {
      await prisma.deal.deleteMany({ where: { id: { in: dealIds } } })
    }
  })

  it('computes revenueYTD as sum of value * commissionRate/100 for closed deals', async () => {
    const result = await agentService.refreshAgentMetrics(agentId)

    expect(result.agentId).toBe(agentId)
    expect(result.revenueYTD).toBe(10_000)   // 2 × 100_000 × 0.05
    expect(result.dealsClosedYTD).toBe(2)
  })

  it('persists computed metrics to the agent record', async () => {
    await agentService.refreshAgentMetrics(agentId)

    const agent = await prisma.agent.findUnique({
      where:  { id: agentId },
      select: { revenueYTD: true, dealsClosedYTD: true },
    })

    expect(agent.revenueYTD).toBe(10_000)
    expect(agent.dealsClosedYTD).toBe(2)
  })
})

describe('refreshAgentMetrics — conversion rate and LOW_CONVERSION alert', () => {
  let leadIds = []

  beforeAll(async () => {
    // Seed 5 leads with no closed deals to get conversionRate = 0 < 20%
    // totalLeads >= 5 is required for the alert to fire in refreshAgentMetrics
    for (let i = 0; i < 5; i++) {
      const lead = await prisma.lead.create({
        data: {
          name:     `Retention Lead ${i}`,
          type:     'buyer',
          avatar:   'RL',
          email:    `ret-lead-${TS}-${i}@example.com`,
          phone:    String(TS + 100 + i),
          source:   'web',
          budget:   100_000,
          interest: 'Residential',
          location: 'Downtown',
          agentId,
        },
      })
      leadIds.push(lead.id)
    }
  })

  afterAll(async () => {
    if (leadIds.length > 0) {
      await prisma.lead.deleteMany({ where: { id: { in: leadIds } } })
    }
  })

  it('fires LOW_CONVERSION alert when totalLeads >= 5 and conversionRate < 20%', async () => {
    // Ensure no closed deals exist for this agent in the current year by resetting stored values
    // (the 2 closed deals from the previous group were cleaned up by that group's afterAll)
    const result = await agentService.refreshAgentMetrics(agentId)

    // 5 leads, 0 closed deals → conversionRate = 0
    expect(result.conversionRate).toBe(0)

    const lowConversionAlert = result.alerts.find(a => a.type === 'LOW_CONVERSION')
    expect(lowConversionAlert).toBeDefined()
    expect(lowConversionAlert.severity).toBe('warning')
  })

  it('computes leadsAssigned from active (non-closed, non-lost) leads only', async () => {
    const result = await agentService.refreshAgentMetrics(agentId)

    // All 5 seeded leads are in 'prospect' stage (default), which is active
    expect(result.leadsAssigned).toBeGreaterThanOrEqual(5)
  })
})
