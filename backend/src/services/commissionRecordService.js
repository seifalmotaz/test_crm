'use strict'

/**
 * Commission Record Service
 *
 * Manages the full commission lifecycle:
 *  1. Creation — when a deal closes, a CommissionRecord is created with status=hold
 *  2. Hold period — commission is held for 7 days after close_date (chargeback protection)
 *  3. Release — after 7 days, status moves to released (ready for payroll); agent is emailed
 *  4. Manager adjustments — tracked with full approval trail
 *  5. Payroll batching — weekly batch collects all released commissions
 *  6. Voiding — if a deal falls through after close, commission is voided
 */

const { prisma }      = require('../config/database')
const { AppError }    = require('../utils/AppError')
const notificationSvc = require('./notificationService')

const HOLD_DAYS = 7

// ─── Creation ─────────────────────────────────────────────────────────────────

async function createRecord(dealId, agentId, amount, ratePct) {
  const closeDate   = new Date()
  const releaseDate = new Date(closeDate)
  releaseDate.setDate(releaseDate.getDate() + HOLD_DAYS)

  return prisma.commissionRecord.create({
    data: {
      dealId,
      agentId,
      amount,
      ratePct,
      status:      'hold',
      closeDate,
      releaseDate,
    },
    include: {
      deal:  { select: { id: true, value: true, type: true } },
      agent: { select: { id: true, name: true, email: true } },
    },
  })
}

// ─── Hold release (called nightly by scheduler) ───────────────────────────────

async function releaseEligibleCommissions() {
  const now = new Date()

  // Select agentId and amount so we can notify each agent
  const eligible = await prisma.commissionRecord.findMany({
    where: {
      status:      'hold',
      releaseDate: { lte: now },
    },
    select: { id: true, agentId: true, amount: true, dealId: true },
  })

  if (eligible.length === 0) return { released: 0 }

  await prisma.commissionRecord.updateMany({
    where: { id: { in: eligible.map(r => r.id) } },
    data:  { status: 'released', releasedAt: now },
  })

  // Notify each agent (fire-and-forget — never stall the scheduler)
  for (const record of eligible) {
    notificationSvc.notifyCommissionReleased(record.agentId, record.amount, record.dealId)
      .catch(err => console.error('[notify] commission release email failed:', err.message))
  }

  return { released: eligible.length }
}

// ─── Manager adjustment ───────────────────────────────────────────────────────

async function adjustCommission(recordId, newAmount, reason, approverId, approverRole) {
  if (!['admin', 'manager'].includes(approverRole)) {
    throw AppError.forbidden('Only managers and admins can adjust commission')
  }
  if (!reason?.trim()) {
    throw AppError.badRequest('Reason is required for commission adjustments')
  }

  const record = await prisma.commissionRecord.findUnique({ where: { id: recordId } })
  if (!record) throw AppError.notFound('Commission record')
  if (record.status === 'paid') {
    throw AppError.badRequest('Cannot adjust a commission that has already been paid')
  }
  if (record.status === 'voided') {
    throw AppError.badRequest('Cannot adjust a voided commission')
  }

  const [updated, adjustment] = await prisma.$transaction([
    prisma.commissionRecord.update({
      where: { id: recordId },
      data:  { amount: newAmount, status: 'adjusted', updatedAt: new Date() },
    }),
    prisma.commissionAdjustment.create({
      data: {
        commissionRecordId: recordId,
        approvedById:       approverId,
        originalAmount:     record.amount,
        adjustedAmount:     newAmount,
        reason:             reason.trim(),
      },
    }),
  ])

  return { record: updated, adjustment }
}

// ─── Void (deal fell through) ─────────────────────────────────────────────────

async function voidCommission(dealId, reason, approverId, approverRole) {
  if (!['admin', 'manager'].includes(approverRole)) {
    throw AppError.forbidden('Only managers can void a commission')
  }

  const record = await prisma.commissionRecord.findUnique({ where: { dealId } })
  if (!record) return null // no record to void (deal may not have closed)
  if (record.status === 'paid') {
    throw AppError.badRequest('Paid commissions cannot be voided — process a manual adjustment')
  }

  const [updated, adjustment] = await prisma.$transaction([
    prisma.commissionRecord.update({
      where: { dealId },
      data:  { status: 'voided', updatedAt: new Date() },
    }),
    prisma.commissionAdjustment.create({
      data: {
        commissionRecordId: record.id,
        approvedById:       approverId,
        originalAmount:     record.amount,
        adjustedAmount:     0,
        reason:             `VOIDED: ${reason}`,
      },
    }),
  ])

  return { record: updated, adjustment }
}

// ─── Payroll batching ─────────────────────────────────────────────────────────

async function createPayrollBatch(weekStart, weekEnd) {
  const start = new Date(weekStart)
  const end   = new Date(weekEnd)
  end.setHours(23, 59, 59, 999)

  const batchId = `payroll_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`

  const records = await prisma.commissionRecord.findMany({
    where: {
      status:         'released',
      releasedAt:     { gte: start, lte: end },
      payrollBatchId: null,
    },
    include: {
      agent:       { select: { id: true, name: true, email: true } },
      deal:        { select: { id: true, value: true, type: true } },
      adjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (records.length === 0) return { batchId, records: [], totalAmount: 0, agentCount: 0 }

  const paidAt = new Date()
  await prisma.commissionRecord.updateMany({
    where: { id: { in: records.map(r => r.id) } },
    data:  { status: 'paid', paidAt, payrollBatchId: batchId },
  })

  const byAgent = {}
  for (const rec of records) {
    if (!byAgent[rec.agentId]) {
      byAgent[rec.agentId] = { agent: rec.agent, records: [], total: 0 }
    }
    byAgent[rec.agentId].records.push(rec)
    byAgent[rec.agentId].total += rec.amount
  }

  const totalAmount = records.reduce((s, r) => s + r.amount, 0)

  return {
    batchId,
    weekStart:   start.toISOString().slice(0, 10),
    weekEnd:     end.toISOString().slice(0, 10),
    agentCount:  Object.keys(byAgent).length,
    recordCount: records.length,
    totalAmount,
    byAgent:     Object.values(byAgent),
    createdAt:   paidAt.toISOString(),
  }
}

function exportPayrollCSV(batch) {
  const lines = [
    'Agent ID,Agent Name,Agent Email,Deal ID,Deal Value,Commission Rate,Commission Amount,Close Date,Release Date,Batch ID',
  ]

  for (const { agent, records } of batch.byAgent) {
    for (const rec of records) {
      lines.push([
        agent.id,
        `"${agent.name}"`,
        agent.email,
        rec.dealId,
        rec.deal?.value ?? '',
        `${rec.ratePct.toFixed(1)}%`,
        rec.amount.toFixed(2),
        rec.closeDate?.toISOString().slice(0, 10)   ?? '',
        rec.releaseDate?.toISOString().slice(0, 10) ?? '',
        batch.batchId,
      ].join(','))
    }
  }

  return lines.join('\n')
}

// ─── Agent commission views ───────────────────────────────────────────────────

async function getAgentCommissions(agentId, status) {
  const where = { agentId }
  if (status) where.status = status

  return prisma.commissionRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      deal:        { select: { id: true, value: true, type: true } },
      adjustments: { orderBy: { createdAt: 'desc' } },
    },
  })
}

async function getCommissionSummary(agentId) {
  const records = await prisma.commissionRecord.findMany({
    where:  { agentId },
    select: { amount: true, status: true, createdAt: true },
  })

  const summary = { hold: 0, released: 0, paid: 0, adjusted: 0, voided: 0 }
  for (const r of records) summary[r.status] = (summary[r.status] ?? 0) + r.amount

  return {
    agentId,
    totalEarned: summary.paid + summary.released + summary.hold + summary.adjusted,
    ...summary,
    recordCount: records.length,
  }
}

module.exports = {
  HOLD_DAYS,
  createRecord,
  releaseEligibleCommissions,
  adjustCommission,
  voidCommission,
  createPayrollBatch,
  exportPayrollCSV,
  getAgentCommissions,
  getCommissionSummary,
}
