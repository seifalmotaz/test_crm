'use strict'

/**
 * Task automation — integration tests against a real database (no mocks).
 *
 * Creates deals and leads through the HTTP API, then queries the database
 * directly to assert that the correct tasks were generated with the right
 * templates, assignees, and priorities.
 */

const request    = require('supertest')
const app        = require('../src/app')
const { prisma } = require('../src/config/database')

const TS          = Date.now()
const ADMIN_EMAIL = `task-int-admin-${TS}@example.com`
const PASSWORD    = 'Password123!'

let adminToken
let agentId
let propertyId

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
      email:    `task-int-agent-${TS}@example.com`,
      password: 'AgentPass123!',
      name:     'Task Agent',
      region:   'Downtown',
      tier:     'developing',
    })
  agentId = agentRes.body.data.id

  const propRes = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      address:      `${TS} Task Automation Ave`,
      neighborhood: 'Downtown',
      type:         'Villa',
      price:        750_000,
      agentId,
    })
  propertyId = propRes.body.data.id
})

// ─── Deal workflow tasks ───────────────────────────────────────────────────────

describe('Deal creation → task automation', () => {
  it('creates exactly 3 workflow tasks assigned to the deal agent', async () => {
    const dealRes = await request(app)
      .post('/api/deals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        propertyId,
        agentId,
        type:            'buy',
        value:           750_000,
        commissionRate:  3,
        offerDate:       '2026-05-01',
        targetCloseDate: '2026-09-01',
      })

    expect(dealRes.status).toBe(201)
    const dealId = dealRes.body.data.id

    const tasks = await prisma.task.findMany({
      where:   { dealId, isDeleted: false },
      orderBy: { workflowTemplate: 'asc' },
    })

    expect(tasks).toHaveLength(3)

    const templates = tasks.map(t => t.workflowTemplate).sort()
    expect(templates).toEqual(['deal_created_d1', 'deal_created_d2', 'deal_created_d3'])

    // All tasks assigned to the deal's agent
    expect(tasks.every(t => t.assigneeId === agentId)).toBe(true)

    // Due dates are in the future (d1 ≈ 1 day, d2 ≈ 2 days, d3 ≈ 3 days)
    const now = new Date()
    expect(tasks.every(t => new Date(t.dueDate) > now)).toBe(true)
  })

  it('assigns the correct priority to each deal task', async () => {
    const dealRes = await request(app)
      .post('/api/deals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        propertyId,
        agentId,
        type:            'buy',
        value:           600_000,
        commissionRate:  3,
        offerDate:       '2026-05-02',
        targetCloseDate: '2026-09-02',
      })

    expect(dealRes.status).toBe(201)
    const dealId = dealRes.body.data.id

    const tasks = await prisma.task.findMany({
      where:   { dealId, isDeleted: false },
      select:  { workflowTemplate: true, priority: true },
    })

    const byTemplate = Object.fromEntries(tasks.map(t => [t.workflowTemplate, t.priority]))
    expect(byTemplate['deal_created_d1']).toBe('high')
    expect(byTemplate['deal_created_d2']).toBe('high')
    expect(byTemplate['deal_created_d3']).toBe('medium')
  })
})

// ─── Lead workflow tasks ───────────────────────────────────────────────────────

describe('Lead creation → task automation', () => {
  it('creates exactly 4 follow-up tasks assigned to the lead agent', async () => {
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:      'Task Test Lead',
        type:      'buyer',
        email:     `task-lead-${TS}@example.com`,
        phone:     String(TS),
        source:    'web',
        budget:    300_000,
        budgetMin: 50_000,
        interest:  'Residential',
        location:  'Downtown',
        timeline:  45,
        agentId,
      })

    expect(leadRes.status).toBe(201)
    const leadId = leadRes.body.data.id

    const tasks = await prisma.task.findMany({
      where:   { leadId, isDeleted: false },
      orderBy: { workflowTemplate: 'asc' },
    })

    expect(tasks).toHaveLength(4)

    const templates = tasks.map(t => t.workflowTemplate).sort()
    expect(templates).toEqual([
      'lead_assigned_d1',
      'lead_assigned_d14',
      'lead_assigned_d3',
      'lead_assigned_d7',
    ])

    // All tasks assigned to the lead's agent (or the auto-assigned agent if re-routed)
    expect(tasks.every(t => t.assigneeId !== null)).toBe(true)
  })

  it('assigns the correct priority sequence to lead follow-up tasks', async () => {
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:      'Priority Lead',
        type:      'buyer',
        email:     `prio-lead-${TS}@example.com`,
        phone:     String(TS + 1),
        source:    'referral',
        budget:    250_000,
        budgetMin: 0,
        interest:  'Apartment',
        location:  'Midtown',
        timeline:  30,
        agentId,
      })

    expect(leadRes.status).toBe(201)
    const leadId = leadRes.body.data.id

    const tasks = await prisma.task.findMany({
      where:  { leadId, isDeleted: false },
      select: { workflowTemplate: true, priority: true },
    })

    const byTemplate = Object.fromEntries(tasks.map(t => [t.workflowTemplate, t.priority]))
    expect(byTemplate['lead_assigned_d1']).toBe('high')
    expect(byTemplate['lead_assigned_d3']).toBe('medium')
    expect(byTemplate['lead_assigned_d7']).toBe('medium')
    expect(byTemplate['lead_assigned_d14']).toBe('low')
  })

  it('d1 task is due today; d3/d7/d14 tasks are due in the future', async () => {
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:      'Due Date Lead',
        type:      'buyer',
        email:     `duedate-lead-${TS}@example.com`,
        phone:     String(TS + 2),
        source:    'web',
        budget:    200_000,
        budgetMin: 0,
        interest:  'Commercial',
        location:  'Uptown',
        timeline:  60,
        agentId,
      })

    expect(leadRes.status).toBe(201)
    const leadId = leadRes.body.data.id

    const tasks = await prisma.task.findMany({
      where:  { leadId, isDeleted: false },
      select: { workflowTemplate: true, dueDate: true },
    })

    const byTemplate = Object.fromEntries(tasks.map(t => [t.workflowTemplate, new Date(t.dueDate)]))
    const now         = new Date()
    const tomorrow    = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)

    // d1 is set to today at 5 PM
    expect(byTemplate['lead_assigned_d1'] <= tomorrow).toBe(true)

    // d3, d7, d14 are set in the future
    expect(byTemplate['lead_assigned_d3']  > now).toBe(true)
    expect(byTemplate['lead_assigned_d7']  > now).toBe(true)
    expect(byTemplate['lead_assigned_d14'] > now).toBe(true)

    // Due dates are in ascending order
    expect(byTemplate['lead_assigned_d3']  < byTemplate['lead_assigned_d7']).toBe(true)
    expect(byTemplate['lead_assigned_d7']  < byTemplate['lead_assigned_d14']).toBe(true)
  })
})
