'use strict'

jest.mock('../src/config/database', () => ({
  prisma: {
    task: {
      create:     jest.fn(),
      createMany: jest.fn(),
      findMany:   jest.fn(),
      update:     jest.fn(),
    },
  },
}))

jest.mock('../src/services/notificationService', () => ({
  notifyOverdueTask: jest.fn().mockResolvedValue(undefined),
}))

const { prisma }     = require('../src/config/database')
const notifySvc      = require('../src/services/notificationService')
const taskAutomation = require('../src/services/taskAutomation')

beforeEach(() => jest.clearAllMocks())

// ─── createDealTasks ──────────────────────────────────────────────────────────

describe('createDealTasks', () => {
  it('creates 3 tasks with correct workflow templates', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 3 })

    await taskAutomation.createDealTasks('deal-1', 'agent-1')

    expect(prisma.task.createMany).toHaveBeenCalledTimes(1)
    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data).toHaveLength(3)
    expect(data.map(t => t.workflowTemplate)).toEqual([
      'deal_created_d1',
      'deal_created_d2',
      'deal_created_d3',
    ])
  })

  it('assigns all tasks to the specified dealId and agentId', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 3 })

    await taskAutomation.createDealTasks('deal-42', 'agent-7')

    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data.every(t => t.dealId === 'deal-42')).toBe(true)
    expect(data.every(t => t.assigneeId === 'agent-7')).toBe(true)
  })

  it('sets due dates as day 1, 2, 3 from now (in order)', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 3 })

    const before = Date.now()
    await taskAutomation.createDealTasks('d-1', 'a-1')
    const after = Date.now()

    const { data } = prisma.task.createMany.mock.calls[0][0]
    const [d1, d2, d3] = data.map(t => new Date(t.dueDate).getTime())

    expect(d1).toBeGreaterThan(before + 0.5 * 86400000)  // at least half a day out
    expect(d2).toBeGreaterThan(d1)
    expect(d3).toBeGreaterThan(d2)
    expect(d3).toBeLessThan(after + 4 * 86400000)
  })
})

// ─── createInspectionTasks ────────────────────────────────────────────────────

describe('createInspectionTasks', () => {
  it('creates 1 task when no inspection issues', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 1 })

    await taskAutomation.createInspectionTasks('d-1', 'a-1', { hasIssues: false })

    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data).toHaveLength(1)
    expect(data[0].workflowTemplate).toBe('inspection_review')
    expect(data[0].priority).toBe('high')
  })

  it('creates 2 tasks and uses critical priority when issues exist', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 2 })

    await taskAutomation.createInspectionTasks('d-1', 'a-1', { hasIssues: true })

    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data).toHaveLength(2)
    expect(data[0].priority).toBe('critical')
    expect(data[1].workflowTemplate).toBe('inspection_negotiate')
  })
})

// ─── createAppraisalTasks ─────────────────────────────────────────────────────

describe('createAppraisalTasks', () => {
  it('creates 1 review task when gap is ≤ 5%', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 1 })

    await taskAutomation.createAppraisalTasks('d-1', 'a-1', { appraisalGapPct: 5 })

    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data).toHaveLength(1)
    expect(data[0].workflowTemplate).toBe('appraisal_review')
  })

  it('creates 2 tasks and critical gap task when gap > 5%', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 2 })

    await taskAutomation.createAppraisalTasks('d-1', 'a-1', { appraisalGapPct: 8 })

    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data).toHaveLength(2)
    expect(data[1].workflowTemplate).toBe('appraisal_gap')
    expect(data[1].priority).toBe('critical')
    expect(data[1].impact).toContain('8.0%')
  })
})

// ─── createLeadAssignedTasks ──────────────────────────────────────────────────

describe('createLeadAssignedTasks', () => {
  it('creates 4 follow-up tasks with correct templates', async () => {
    prisma.task.createMany.mockResolvedValue({ count: 4 })

    await taskAutomation.createLeadAssignedTasks('lead-1', 'agent-1')

    const { data } = prisma.task.createMany.mock.calls[0][0]
    expect(data).toHaveLength(4)
    expect(data.map(t => t.workflowTemplate)).toEqual([
      'lead_assigned_d1',
      'lead_assigned_d3',
      'lead_assigned_d7',
      'lead_assigned_d14',
    ])
  })
})

// ─── createLeadQualifiedTask ──────────────────────────────────────────────────

describe('createLeadQualifiedTask', () => {
  it('creates a single showing task due in ~2 days', async () => {
    const mockTask = { id: 't-1', workflowTemplate: 'lead_qualified' }
    prisma.task.create.mockResolvedValue(mockTask)

    const result = await taskAutomation.createLeadQualifiedTask('lead-1', 'agent-1')

    expect(prisma.task.create).toHaveBeenCalledTimes(1)
    const { data } = prisma.task.create.mock.calls[0][0]
    expect(data.workflowTemplate).toBe('lead_qualified')
    expect(data.priority).toBe('high')
    expect(result).toBe(mockTask)

    const dueInMs = new Date(data.dueDate) - Date.now()
    expect(dueInMs).toBeGreaterThan(0)
    expect(dueInMs).toBeLessThan(3 * 86400000) // less than 3 days
  })
})

// ─── processOverdueTasks ──────────────────────────────────────────────────────

describe('processOverdueTasks', () => {
  it('returns zero stats when no overdue tasks', async () => {
    prisma.task.findMany.mockResolvedValue([])

    const result = await taskAutomation.processOverdueTasks()

    expect(result.processed).toBe(0)
    expect(result.reminded).toBe(0)
    expect(prisma.task.update).not.toHaveBeenCalled()
  })

  it('marks tasks as overdue and counts reminded at day 1', async () => {
    const dueDate = new Date(Date.now() - 1.5 * 86400000)
    prisma.task.findMany.mockResolvedValue([
      { id: 't-1', title: 'Call client', dueDate, daysOverdue: 0, escalated: false, assigneeId: 'a-1' },
    ])
    prisma.task.update.mockResolvedValue({})

    const result = await taskAutomation.processOverdueTasks()

    expect(result.processed).toBe(1)
    expect(result.reminded).toBe(1)
    expect(result.escalatedManager).toBe(0)
    expect(result.escalatedDirector).toBe(0)

    const updateCall = prisma.task.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('overdue')
  })

  it('escalates to manager at 3 days overdue', async () => {
    const dueDate = new Date(Date.now() - 3.5 * 86400000)
    prisma.task.findMany.mockResolvedValue([
      { id: 't-2', title: 'File docs', dueDate, daysOverdue: 0, escalated: false, assigneeId: 'a-1' },
    ])
    prisma.task.update.mockResolvedValue({})

    const result = await taskAutomation.processOverdueTasks()

    expect(result.escalatedManager).toBe(1)
    const updateCall = prisma.task.update.mock.calls[0][0]
    expect(updateCall.data.escalateTo).toBe('manager')
  })

  it('escalates to director and marks as risk at 5 days overdue', async () => {
    const dueDate = new Date(Date.now() - 5.5 * 86400000)
    prisma.task.findMany.mockResolvedValue([
      { id: 't-3', title: 'Closing docs', dueDate, daysOverdue: 0, escalated: false, assigneeId: 'a-1' },
    ])
    prisma.task.update.mockResolvedValue({})

    const result = await taskAutomation.processOverdueTasks()

    expect(result.escalatedDirector).toBe(1)
    const updateCall = prisma.task.update.mock.calls[0][0]
    expect(updateCall.data.escalated).toBe(true)
    expect(updateCall.data.escalateTo).toBe('director')
    expect(updateCall.data.impact).toMatch(/RISK/)
  })

  it('sends push+email notification only on day 1 of overdue', async () => {
    const dueDate = new Date(Date.now() - 0.8 * 86400000)
    prisma.task.findMany.mockResolvedValue([
      { id: 't-4', title: 'Call', dueDate, daysOverdue: 0, escalated: false, assigneeId: 'a-1' },
    ])
    prisma.task.update.mockResolvedValue({})

    await taskAutomation.processOverdueTasks()
    await Promise.resolve() // flush fire-and-forget

    expect(notifySvc.notifyOverdueTask).toHaveBeenCalledTimes(1)
    const [task, agentId] = notifySvc.notifyOverdueTask.mock.calls[0]
    expect(agentId).toBe('a-1')
    expect(task.daysOverdue).toBe(1)
  })

  it('does not notify on subsequent overdue days', async () => {
    const dueDate = new Date(Date.now() - 3.5 * 86400000)
    prisma.task.findMany.mockResolvedValue([
      { id: 't-5', title: 'Old task', dueDate, daysOverdue: 2, escalated: false, assigneeId: 'a-1' },
    ])
    prisma.task.update.mockResolvedValue({})

    await taskAutomation.processOverdueTasks()
    await Promise.resolve()

    expect(notifySvc.notifyOverdueTask).not.toHaveBeenCalled()
  })
})
