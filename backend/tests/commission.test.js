'use strict'

jest.mock('../src/config/database', () => ({
  prisma: {
    commissionRecord:    {
      create:       jest.fn(),
      findMany:     jest.fn(),
      findUnique:   jest.fn(),
      update:       jest.fn(),
      updateMany:   jest.fn(),
    },
    commissionAdjustment: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../src/services/notificationService', () => ({
  notifyCommissionReleased: jest.fn().mockResolvedValue(undefined),
}))

const { prisma }    = require('../src/config/database')
const commissionSvc = require('../src/services/commissionRecordService')
const notifySvc     = require('../src/services/notificationService')

beforeEach(() => jest.clearAllMocks())

// ─── createRecord ─────────────────────────────────────────────────────────────

describe('createRecord', () => {
  it('creates a hold record with a release date 7 days out', async () => {
    const mockRecord = { id: 'rec-1', status: 'hold', dealId: 'd-1', agentId: 'a-1', amount: 5000, ratePct: 5 }
    prisma.commissionRecord.create.mockResolvedValue(mockRecord)

    const result = await commissionSvc.createRecord('d-1', 'a-1', 5000, 5)

    expect(prisma.commissionRecord.create).toHaveBeenCalledTimes(1)
    const { data } = prisma.commissionRecord.create.mock.calls[0][0]
    expect(data.status).toBe('hold')
    expect(data.amount).toBe(5000)
    expect(data.ratePct).toBe(5)

    // Release date should be ~7 days after close date
    const diff = Math.round((data.releaseDate - data.closeDate) / (1000 * 60 * 60 * 24))
    expect(diff).toBe(7)
    expect(result).toBe(mockRecord)
  })
})

// ─── releaseEligibleCommissions ───────────────────────────────────────────────

describe('releaseEligibleCommissions', () => {
  it('returns { released: 0 } when nothing is eligible', async () => {
    prisma.commissionRecord.findMany.mockResolvedValue([])

    const result = await commissionSvc.releaseEligibleCommissions()

    expect(result).toEqual({ released: 0 })
    expect(prisma.commissionRecord.updateMany).not.toHaveBeenCalled()
  })

  it('updates eligible records and notifies each agent', async () => {
    const records = [
      { id: 'r1', agentId: 'a-1', amount: 3000, dealId: 'd-1' },
      { id: 'r2', agentId: 'a-2', amount: 4000, dealId: 'd-2' },
    ]
    prisma.commissionRecord.findMany.mockResolvedValue(records)
    prisma.commissionRecord.updateMany.mockResolvedValue({ count: 2 })

    const result = await commissionSvc.releaseEligibleCommissions()

    expect(prisma.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2'] } },
      data:  expect.objectContaining({ status: 'released' }),
    })
    expect(result).toEqual({ released: 2 })
    // Fire-and-forget: notifier called once per record
    await Promise.resolve() // flush microtasks
    expect(notifySvc.notifyCommissionReleased).toHaveBeenCalledTimes(2)
  })
})

// ─── adjustCommission ─────────────────────────────────────────────────────────

describe('adjustCommission', () => {
  const baseRecord = { id: 'rec-1', amount: 5000, status: 'released' }

  it('rejects non-manager roles', async () => {
    await expect(
      commissionSvc.adjustCommission('rec-1', 4000, 'oops', 'u-1', 'agent')
    ).rejects.toThrow('Only managers')
  })

  it('rejects blank reason', async () => {
    await expect(
      commissionSvc.adjustCommission('rec-1', 4000, '   ', 'u-1', 'manager')
    ).rejects.toThrow('Reason is required')
  })

  it('rejects adjusting a paid commission', async () => {
    prisma.commissionRecord.findUnique.mockResolvedValue({ ...baseRecord, status: 'paid' })

    await expect(
      commissionSvc.adjustCommission('rec-1', 4000, 'error fix', 'u-1', 'manager')
    ).rejects.toThrow('already been paid')
  })

  it('rejects adjusting a voided commission', async () => {
    prisma.commissionRecord.findUnique.mockResolvedValue({ ...baseRecord, status: 'voided' })

    await expect(
      commissionSvc.adjustCommission('rec-1', 4000, 'error fix', 'u-1', 'manager')
    ).rejects.toThrow('voided')
  })

  it('updates the record and creates an adjustment audit entry', async () => {
    prisma.commissionRecord.findUnique.mockResolvedValue(baseRecord)
    const updated    = { ...baseRecord, amount: 4000, status: 'adjusted' }
    const adjustment = { id: 'adj-1' }
    prisma.$transaction.mockImplementation(ops => Promise.all(ops))
    prisma.commissionRecord.update.mockResolvedValue(updated)
    prisma.commissionAdjustment.create.mockResolvedValue(adjustment)

    const result = await commissionSvc.adjustCommission('rec-1', 4000, 'fix', 'mgr-1', 'manager')

    expect(result.record.status).toBe('adjusted')
    expect(result.record.amount).toBe(4000)
    expect(result.adjustment).toBe(adjustment)
    const adjustCall = prisma.commissionAdjustment.create.mock.calls[0][0].data
    expect(adjustCall.originalAmount).toBe(5000)
    expect(adjustCall.adjustedAmount).toBe(4000)
    expect(adjustCall.reason).toBe('fix')
  })
})

// ─── voidCommission ───────────────────────────────────────────────────────────

describe('voidCommission', () => {
  it('returns null when no record exists for the deal', async () => {
    prisma.commissionRecord.findUnique.mockResolvedValue(null)

    const result = await commissionSvc.voidCommission('d-99', 'deal fell through', 'mgr-1', 'manager')

    expect(result).toBeNull()
  })

  it('rejects voiding a paid commission', async () => {
    prisma.commissionRecord.findUnique.mockResolvedValue({ id: 'r1', amount: 5000, status: 'paid' })

    await expect(
      commissionSvc.voidCommission('d-1', 'deal fell through', 'mgr-1', 'manager')
    ).rejects.toThrow('Paid commissions')
  })

  it('voids a hold commission and records the adjustment', async () => {
    prisma.commissionRecord.findUnique.mockResolvedValue({ id: 'r1', amount: 5000, status: 'hold' })
    prisma.$transaction.mockImplementation(ops => Promise.all(ops))
    prisma.commissionRecord.update.mockResolvedValue({ id: 'r1', status: 'voided' })
    prisma.commissionAdjustment.create.mockResolvedValue({ id: 'adj-void' })

    const result = await commissionSvc.voidCommission('d-1', 'deal fell through', 'mgr-1', 'manager')

    expect(result.record.status).toBe('voided')
    const adj = prisma.commissionAdjustment.create.mock.calls[0][0].data
    expect(adj.adjustedAmount).toBe(0)
    expect(adj.reason).toMatch(/VOIDED/)
  })
})

// ─── getCommissionSummary ─────────────────────────────────────────────────────

describe('getCommissionSummary', () => {
  it('sums amounts by status correctly', async () => {
    prisma.commissionRecord.findMany.mockResolvedValue([
      { amount: 1000, status: 'paid',     createdAt: new Date() },
      { amount: 2000, status: 'released', createdAt: new Date() },
      { amount:  500, status: 'hold',     createdAt: new Date() },
      { amount:  300, status: 'voided',   createdAt: new Date() },
    ])

    const summary = await commissionSvc.getCommissionSummary('a-1')

    expect(summary.paid).toBe(1000)
    expect(summary.released).toBe(2000)
    expect(summary.hold).toBe(500)
    expect(summary.voided).toBe(300)
    expect(summary.totalEarned).toBe(1000 + 2000 + 500 + 0) // voided not counted
    expect(summary.recordCount).toBe(4)
  })
})
