'use strict'

/**
 * Commission lifecycle — integration tests against a real database (no mocks).
 *
 * Exercises the full hold → released → paid state machine through the HTTP API
 * and service layer directly, asserting on actual DB state after each transition.
 */

const request       = require('supertest')
const app           = require('../src/app')
const { prisma }    = require('../src/config/database')
const commissionSvc = require('../src/services/commissionRecordService')

const TS          = Date.now()
const ADMIN_EMAIL = `comm-int-admin-${TS}@example.com`
const PASSWORD    = 'Password123!'

let adminToken
let agentId
let dealId
let commissionId

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
      email:    `comm-int-agent-${TS}@example.com`,
      password: 'AgentPass123!',
      name:     'Commission Agent',
      region:   'Downtown',
      tier:     'developing',
    })
  agentId = agentRes.body.data.id

  const propRes = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      address:      `${TS} Commission Blvd`,
      neighborhood: 'Downtown',
      type:         'Apartment',
      price:        500_000,
      agentId,
    })
  const propertyId = propRes.body.data.id

  const dealRes = await request(app)
    .post('/api/deals')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      propertyId,
      agentId,
      type:            'buy',
      value:           500_000,
      commissionRate:  5,
      offerDate:       '2026-05-01',
      targetCloseDate: '2026-07-01',
    })
  dealId = dealRes.body.data.id

  // Commission records are created when a deal closes; seed directly via service
  // (real DB call — no mocks) to isolate the lifecycle tests from stage advancement.
  const record = await commissionSvc.createRecord(dealId, agentId, 25_000, 5.0)
  commissionId = record.id
})

// ─── Hold status ──────────────────────────────────────────────────────────────

describe('Commission hold status', () => {
  it('starts as hold with a release date exactly 7 days after close', async () => {
    const res = await request(app)
      .get(`/api/admin/commissions/${commissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('hold')
    expect(res.body.data.amount).toBe(25_000)
    expect(res.body.data.ratePct).toBe(5)

    const diffDays = Math.round(
      (new Date(res.body.data.releaseDate) - new Date(res.body.data.closeDate)) / 86_400_000
    )
    expect(diffDays).toBe(7)
  })

  it('returns 404 for a non-existent commission id', async () => {
    const res = await request(app)
      .get('/api/admin/commissions/does-not-exist-12345')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
  })

  it('requires auth — 401 with no token', async () => {
    const res = await request(app).get(`/api/admin/commissions/${commissionId}`)
    expect(res.status).toBe(401)
  })
})

// ─── Hold → released ──────────────────────────────────────────────────────────

describe('Commission release', () => {
  it('transitions hold → released when releaseDate is in the past', async () => {
    // Back-date so the record is immediately eligible for release
    await prisma.commissionRecord.update({
      where: { id: commissionId },
      data:  { releaseDate: new Date('2020-01-01') },
    })

    const { released } = await commissionSvc.releaseEligibleCommissions()
    expect(released).toBeGreaterThanOrEqual(1)

    const record = await prisma.commissionRecord.findUnique({ where: { id: commissionId } })
    expect(record.status).toBe('released')
    expect(record.releasedAt).not.toBeNull()
  })

  it('does not re-process records that are already released', async () => {
    // Second call — our record is now 'released', not 'hold', so it won't be picked up again
    await commissionSvc.releaseEligibleCommissions()

    const after = await prisma.commissionRecord.findUnique({ where: { id: commissionId } })
    expect(after.status).toBe('released') // unchanged, not double-processed
  })
})

// ─── Released → paid ──────────────────────────────────────────────────────────

describe('Commission payroll batch', () => {
  it('transitions released → paid and stamps paidAt + payrollBatchId', async () => {
    const res = await request(app)
      .post('/api/admin/commissions/payroll')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekStart: '2020-01-01', weekEnd: '2030-12-31' })

    expect(res.status).toBe(201)
    expect(res.body.data.recordCount).toBeGreaterThanOrEqual(1)
    expect(res.body.data.totalAmount).toBeGreaterThan(0)

    const record = await prisma.commissionRecord.findUnique({ where: { id: commissionId } })
    expect(record.status).toBe('paid')
    expect(record.paidAt).not.toBeNull()
    expect(record.payrollBatchId).toMatch(/^payroll_/)
  })

  it('returns an empty batch for a date range with no released records', async () => {
    const res = await request(app)
      .post('/api/admin/commissions/payroll')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekStart: '2000-01-01', weekEnd: '2000-01-07' })

    expect(res.status).toBe(201)
    expect(res.body.data.recordCount).toBe(0)
    expect(res.body.data.totalAmount).toBe(0)
  })

  it('returns 400 when weekStart/weekEnd are missing', async () => {
    const res = await request(app)
      .post('/api/admin/commissions/payroll')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})

    expect(res.status).toBe(400)
  })
})

// ─── State machine guards ─────────────────────────────────────────────────────

describe('Commission state machine guards', () => {
  it('rejects adjusting a paid commission → 400', async () => {
    const res = await request(app)
      .post(`/api/admin/commissions/${commissionId}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 20_000, reason: 'correction' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.message).toMatch(/paid/i)
  })

  it('rejects voiding a paid commission → 400', async () => {
    const res = await request(app)
      .post('/api/admin/commissions/void')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dealId, reason: 'deal fell through' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.message).toMatch(/paid/i)
  })

  it('rejects adjust with blank reason before any DB lookup → 400', async () => {
    // The service checks reason before querying the DB, so any record id works here
    const res = await request(app)
      .post('/api/admin/commissions/any-record-id/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 10_000, reason: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/reason/i)
  })

  it('rejects void when dealId is missing → 400', async () => {
    const res = await request(app)
      .post('/api/admin/commissions/void')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'deal fell through' }) // no dealId

    expect(res.status).toBe(400)
  })
})
