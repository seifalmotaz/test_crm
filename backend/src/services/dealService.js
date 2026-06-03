'use strict'

/**
 * Deal Business Logic Service
 *
 * RULES ENFORCED HERE:
 *  1. Stage FSM — strict forward-only, no skipping, closing locks the deal
 *  2. Probability calculation — base by stage + situational adjustments
 *  3. Commission calculation — standard/luxury/investment rates, optional split
 *  4. Deal locking — closing stage requires manager approval to modify
 *  5. Side effects on stage change — property status, lead stage, agent metrics
 *  6. Notifications — email on every stage advance; SMS on deal close
 */

const { prisma }   = require('../config/database')
const { AppError } = require('../utils/AppError')
const notificationSvc = require('./notificationService')

// ─── Stage FSM ────────────────────────────────────────────────────────────────

const STAGE_ORDER = ['offer', 'negotiation', 'inspection', 'appraisal', 'closing', 'closed']
const TERMINAL    = new Set(['closed', 'lost'])

// Base probability at each stage
const STAGE_PROBABILITY = {
  offer:       50,
  negotiation: 65,
  inspection:  80,
  appraisal:   90,
  closing:     98,
  closed:      100,
  lost:        0,
}

function assertValidStageTransition(currentStage, newStage) {
  if (newStage === 'lost') return // always allowed to mark as lost

  const curr = STAGE_ORDER.indexOf(currentStage)
  const next = STAGE_ORDER.indexOf(newStage)

  if (curr === -1 || next === -1) {
    throw AppError.badRequest(`Invalid stage: ${newStage}`)
  }
  if (next < curr) {
    throw AppError.badRequest(
      `Cannot move deal backward (${currentStage} → ${newStage}). ` +
      'Deal stages can only progress forward.'
    )
  }
  if (next > curr + 1) {
    const required = STAGE_ORDER[curr + 1]
    throw AppError.badRequest(
      `Cannot skip stages. Must advance to "${required}" before "${newStage}".`
    )
  }
}

// ─── Deal locking ─────────────────────────────────────────────────────────────

function assertNotLocked(deal, requesterRole) {
  if (deal.stage === 'closing' && !['admin', 'manager'].includes(requesterRole)) {
    throw AppError.forbidden(
      'This deal is locked at closing stage. Manager approval is required to make changes.'
    )
  }
}

// ─── Probability calculation ──────────────────────────────────────────────────

function calculateProbability(stage, deal) {
  if (stage === 'lost')   return 0
  if (stage === 'closed') return 100

  let prob   = STAGE_PROBABILITY[stage] ?? 50
  const prog = deal.progress ?? {}
  const days = deal.daysUntilClose ?? 0

  // Situational deductions
  if (parseFloat(prog.appraisalGapPct ?? 0) > 10) prob -= 20 // appraisal gap > 10%
  if (prog.hasInspectionIssues)                    prob -= 15 // inspection issues
  if (prog.missingDocuments)                       prob -=  5 // missing docs

  // Timeline pressure
  if (days >= 0 && days <= 7)     prob -=  5 // closing pressure
  else if (days < 0 || days > 45) prob -= 10 // overdue or dragging

  return Math.max(0, Math.min(100, Math.round(prob)))
}

// ─── Commission calculation ───────────────────────────────────────────────────

const LUXURY_THRESHOLD = 5_000_000

const INFERRED_RATE = {
  standard:   5.0,
  luxury:     4.5,
  investment: 3.0,
}

const SPLIT_RATE = 2.5

function classifyDeal(value, dealType) {
  const t = (dealType ?? '').toLowerCase()
  if (t.includes('investment')) return 'investment'
  if (value > LUXURY_THRESHOLD) return 'luxury'
  return 'standard'
}

function calculateCommission(value, dealType, storedRate, splitCommission = false) {
  const category        = classifyDeal(value, dealType)
  const inferredRatePct = INFERRED_RATE[category]
  const ratePct         = storedRate != null && storedRate > 0 ? storedRate : inferredRatePct
  const totalCommission = value * (ratePct / 100)

  const result = {
    dealValue:    value,
    category,
    ratePct,
    rateDisplay:  `${ratePct.toFixed(1)}%`,
    total:        totalCommission,
    totalDisplay: `$${totalCommission.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
  }

  if (splitCommission) {
    const splitTotal = value * (SPLIT_RATE / 100)
    result.split = {
      listingAgent: splitTotal,
      sellingAgent: splitTotal,
      display:      `$${splitTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })} each`,
    }
  }

  return result
}

// ─── Stage advance (with all side effects) ────────────────────────────────────

async function advanceStage(dealId, newStage, requesterRole, requesterAgentId) {
  const deal = await prisma.deal.findFirst({
    where:   { id: dealId, isDeleted: false },
    include: {
      property: { select: { id: true, status: true } },
      lead:     { select: { id: true, stage: true } },
    },
  })
  if (!deal) throw AppError.notFound('Deal')

  if (deal.stage === 'closing' && !['admin', 'manager'].includes(requesterRole)) {
    throw AppError.forbidden('Advancing a deal from closing stage requires manager approval')
  }

  assertValidStageTransition(deal.stage, newStage)

  const previousStage  = deal.stage
  const now            = new Date()
  const daysUntilClose = Math.ceil(
    (new Date(deal.targetCloseDate) - now) / (1000 * 60 * 60 * 24)
  )
  const probability = calculateProbability(newStage, { ...deal, daysUntilClose })

  // ── Side effects ───────────────────────────────────────────────────────────

  const sideEffects = []

  // offer → negotiation: mark property as Pending
  if (deal.stage === 'offer' && newStage === 'negotiation' && deal.propertyId && deal.property?.status === 'Active') {
    await prisma.property.update({
      where: { id: deal.propertyId },
      data:  { status: 'Pending', version: { increment: 1 } },
    })
    sideEffects.push('property.status → Pending')
  }

  // → closed: property Sold, lead closed, agent revenue credited
  if (newStage === 'closed') {
    if (deal.propertyId) {
      await prisma.property.update({
        where: { id: deal.propertyId },
        data:  { status: 'Sold', version: { increment: 1 } },
      })
      sideEffects.push('property.status → Sold')
    }
    if (deal.leadId && deal.lead?.stage !== 'closed') {
      await prisma.lead.update({
        where: { id: deal.leadId },
        data:  { stage: 'closed', version: { increment: 1 } },
      })
      sideEffects.push('lead.stage → closed')
    }

    const { total: commission, ratePct } = calculateCommission(deal.value, deal.type, deal.commissionRate)
    await prisma.agent.update({
      where: { id: deal.agentId },
      data: {
        revenueYTD:       { increment: commission },
        dealsClosedYTD:   { increment: 1 },
        dealsClosedMonth: { increment: 1 },
        activeDeals:      { decrement: 1 },
      },
    })
    sideEffects.push(`commission $${commission.toFixed(0)} credited (${ratePct.toFixed(1)}%)`)
  }

  // → lost: property back to Active if it was Pending
  if (newStage === 'lost') {
    if (deal.propertyId && deal.property?.status === 'Pending') {
      await prisma.property.update({
        where: { id: deal.propertyId },
        data:  { status: 'Active', version: { increment: 1 } },
      })
      sideEffects.push('property.status → Active (deal fell through)')
    }
    await prisma.agent.update({
      where: { id: deal.agentId },
      data:  { activeDeals: { decrement: 1 } },
    })
    sideEffects.push('agent.activeDeals decremented')
  }

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage:              newStage,
      closingProbability: probability,
      daysUntilClose:     Math.max(0, daysUntilClose),
      version:            { increment: 1 },
    },
    include: {
      agent:      { select: { id: true, name: true, avatar: true } },
      property:   { select: { id: true, address: true, neighborhood: true } },
      client:     { select: { id: true, name: true, email: true } },
      milestones: { orderBy: { due: 'asc' } },
    },
  })

  // ── Notifications (fire-and-forget — never block the stage advance response) ─

  // Email on every stage advance
  notificationSvc.notifyDealStageAdvanced(updated, previousStage, deal.agentId)
    .catch(err => console.error('[notify] deal stage email failed:', err.message))

  // SMS specifically when the deal closes
  if (newStage === 'closed') {
    notificationSvc.notifyDealClosed(updated, deal.agentId)
      .catch(err => console.error('[notify] deal closed SMS failed:', err.message))
  }

  return { deal: updated, sideEffects }
}

module.exports = {
  STAGE_ORDER,
  STAGE_PROBABILITY,
  LUXURY_THRESHOLD,
  INFERRED_RATE,
  assertValidStageTransition,
  assertNotLocked,
  calculateProbability,
  calculateCommission,
  classifyDeal,
  advanceStage,
}
