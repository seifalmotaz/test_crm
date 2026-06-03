'use strict'

/**
 * Lead scoring — integration tests against a real database (no mocks).
 *
 * Seeds leads with known attributes via the HTTP API and asserts that the
 * GET /api/leads/:id/score response matches the formula at each stage.
 *
 * Score formula:
 *   base(50) + budgetConfirmed(15) + timeline(20) + engagement(10) + propertyMatch(5)
 *
 *   budgetConfirmed: budgetMin > 0 OR preApproved === true
 *   timeline:        ≤90 days → 20 | 91–180 days → 10 | >180 days → 0
 *   engagement:      Math.round(Math.min(interactions, 3) / 3 * 10)
 *   propertyMatch:   location AND interest both provided (non-empty)
 */

const request = require('supertest')
const app     = require('../src/app')

const TS          = Date.now()
const ADMIN_EMAIL = `score-int-admin-${TS}@example.com`
const PASSWORD    = 'Password123!'

let adminToken
let agentId
let primaryLeadId  // used for the sequential interaction tests

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
      email:    `score-int-agent-${TS}@example.com`,
      password: 'AgentPass123!',
      name:     'Scoring Agent',
      region:   'Downtown',
      tier:     'developing',
    })
  agentId = agentRes.body.data.id

  // Primary test lead — fully scored at creation:
  //   base(50) + budget(15) + timeline(20) + engagement(0) + propertyMatch(5) = 90
  const leadRes = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name:      'Score Test Lead',
      type:      'buyer',
      email:     `score-lead-${TS}@example.com`,
      phone:     String(TS),
      source:    'web',
      budget:    200_000,
      budgetMin: 100_000,
      interest:  'Residential',
      location:  'Downtown',
      timeline:  60,
      agentId,
    })
  primaryLeadId = leadRes.body.data.id
})

// Helper to create a throwaway lead without caring about the returned id
async function createLead(overrides) {
  const res = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name:      'Throwaway Lead',
      type:      'buyer',
      source:    'referral',
      budget:    150_000,
      budgetMin: 0,
      interest:  'Apartment',
      location:  'Midtown',
      timeline:  90,
      agentId,
      ...overrides,
    })
  return res
}

// ─── Score at creation ────────────────────────────────────────────────────────

describe('Lead score on creation', () => {
  it('returns a score of 90 for a fully-specified lead with no interactions', async () => {
    const res = await request(app)
      .get(`/api/leads/${primaryLeadId}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.calculatedScore).toBe(90)
    expect(res.body.data.currentScore).toBe(90)
    expect(res.body.data.breakdown).toMatchObject({
      base:            50,
      budgetConfirmed: 15,
      timeline:        20,
      engagement:      0,
      propertyMatch:   5,
    })
  })

  it('awards budget points when preApproved=true and budgetMin=0', async () => {
    const res = await createLead({
      email:       `preapproved-${TS}@example.com`,
      phone:       String(TS + 1),
      preApproved: true,
      budgetMin:   0,
      timeline:    91,  // half timeline → 10
      interest:    'Villa',
      location:    'Suburbs',
    })
    expect(res.status).toBe(201)

    const scoreRes = await request(app)
      .get(`/api/leads/${res.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    // base(50) + budget(15, preApproved) + timeline(10) + engagement(0) + propertyMatch(5) = 80
    expect(scoreRes.body.data.breakdown.budgetConfirmed).toBe(15)
    expect(scoreRes.body.data.calculatedScore).toBe(80)
  })

  it('awards 0 budget points when budgetMin=0 and preApproved=false', async () => {
    const res = await createLead({
      email:       `no-budget-${TS}@example.com`,
      phone:       String(TS + 2),
      budgetMin:   0,
      preApproved: false,
      timeline:    60,
      interest:    'Commercial',
      location:    'Downtown',
    })
    expect(res.status).toBe(201)

    const scoreRes = await request(app)
      .get(`/api/leads/${res.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    // base(50) + budget(0) + timeline(20) + engagement(0) + propertyMatch(5) = 75
    expect(scoreRes.body.data.breakdown.budgetConfirmed).toBe(0)
    expect(scoreRes.body.data.calculatedScore).toBe(75)
  })
})

// ─── Timeline edge cases ──────────────────────────────────────────────────────

describe('Lead score — timeline boundaries', () => {
  it('assigns full timeline points (20) for exactly 90 days', async () => {
    const res = await createLead({
      email:     `tl-90-${TS}@example.com`,
      phone:     String(TS + 10),
      timeline:  90,
      budgetMin: 0,
    })
    expect(res.status).toBe(201)

    const scoreRes = await request(app)
      .get(`/api/leads/${res.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(scoreRes.body.data.breakdown.timeline).toBe(20)
  })

  it('assigns half timeline points (10) for 91 days', async () => {
    const res = await createLead({
      email:     `tl-91-${TS}@example.com`,
      phone:     String(TS + 11),
      timeline:  91,
      budgetMin: 0,
    })
    expect(res.status).toBe(201)

    const scoreRes = await request(app)
      .get(`/api/leads/${res.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(scoreRes.body.data.breakdown.timeline).toBe(10)
  })

  it('assigns half timeline points (10) for 180 days', async () => {
    const res = await createLead({
      email:     `tl-180-${TS}@example.com`,
      phone:     String(TS + 12),
      timeline:  180,
      budgetMin: 0,
    })
    expect(res.status).toBe(201)

    const scoreRes = await request(app)
      .get(`/api/leads/${res.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(scoreRes.body.data.breakdown.timeline).toBe(10)
  })

  it('assigns 0 timeline points for 181 days', async () => {
    const res = await createLead({
      email:     `tl-181-${TS}@example.com`,
      phone:     String(TS + 13),
      timeline:  181,
      budgetMin: 0,
    })
    expect(res.status).toBe(201)

    const scoreRes = await request(app)
      .get(`/api/leads/${res.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(scoreRes.body.data.breakdown.timeline).toBe(0)
  })
})

// ─── Engagement component ─────────────────────────────────────────────────────

describe('Lead score — engagement via interactions', () => {
  it('increases score with interactions, capped at 3', async () => {
    // 1 interaction: Math.round(1/3 * 10) = 3  →  total = 90 + 3 = 93
    await request(app)
      .post(`/api/leads/${primaryLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'Initial contact call', type: 'call' })

    const res1 = await request(app)
      .get(`/api/leads/${primaryLeadId}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res1.body.data.breakdown.engagement).toBe(3)
    expect(res1.body.data.calculatedScore).toBe(93)
    expect(res1.body.data.currentScore).toBe(93) // refreshScore persists to DB

    // 3 interactions total: Math.round(3/3 * 10) = 10  →  total = 90 + 10 = 100
    await request(app)
      .post(`/api/leads/${primaryLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'Follow-up email', type: 'email' })
    await request(app)
      .post(`/api/leads/${primaryLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'Property showing', type: 'meeting' })

    const res3 = await request(app)
      .get(`/api/leads/${primaryLeadId}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res3.body.data.breakdown.engagement).toBe(10)
    expect(res3.body.data.calculatedScore).toBe(100)

    // 4th interaction — engagement is capped, score cannot exceed 100
    await request(app)
      .post(`/api/leads/${primaryLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'Contract review meeting', type: 'meeting' })

    const res4 = await request(app)
      .get(`/api/leads/${primaryLeadId}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res4.body.data.calculatedScore).toBe(100)
  })
})

// ─── Score tier classification ────────────────────────────────────────────────

describe('Lead score — tier classification', () => {
  it('classifies score ≥ 80 as "immediate"', async () => {
    const res = await request(app)
      .get(`/api/leads/${primaryLeadId}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    // primaryLeadId has 4 interactions → score = 100
    expect(res.body.data.tier).toBe('immediate')
  })

  it('classifies score 60–79 as "standard"', async () => {
    // no budget, timeline=90 (full), propertyMatch → 50+0+20+0+5 = 75
    const leadRes = await createLead({
      email:     `standard-tier-${TS}@example.com`,
      phone:     String(TS + 20),
      budgetMin: 0,
      timeline:  90,
    })
    expect(leadRes.status).toBe(201)

    const res = await request(app)
      .get(`/api/leads/${leadRes.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.body.data.tier).toBe('standard')
  })

  it('classifies score < 60 as "pool"', async () => {
    // no budget, no propertyMatch, timeline=181 → 50+0+0+0+5 = 55
    const leadRes = await createLead({
      email:     `pool-tier-${TS}@example.com`,
      phone:     String(TS + 21),
      budgetMin: 0,
      timeline:  181,
    })
    expect(leadRes.status).toBe(201)

    const res = await request(app)
      .get(`/api/leads/${leadRes.body.data.id}/score`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.body.data.tier).toBe('pool')
  })
})
