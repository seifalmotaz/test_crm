'use strict'

/**
 * Lead Business Logic Service
 *
 * RULES ENFORCED HERE:
 *  1. Scoring — Base(50) + Budget(15) + Timeline(20) + Engagement(10) + PropertyMatch(5)
 *  2. Auto-assignment — score-based routing to available agents (max 15 active leads)
 *  3. Auto-qualification — automatic stage progression when conditions are met
 *  4. Duplicate detection & merge — email/phone dedup, keep oldest ID
 *  5. Notifications — email on lead assignment (hot leads also get SMS)
 */

const { prisma }         = require('../config/database')
const { AppError }       = require('../utils/AppError')
const notificationSvc    = require('./notificationService')

// ─── Scoring ──────────────────────────────────────────────────────────────────

const SCORE = {
  base:            50,
  budgetConfirmed: 15, // budgetMin > 0 or preApproved
  timeline:        20, // <= 90 days full; 91–180 half; > 180 none
  engagement:      10, // capped at 3 interactions for full points
  propertyMatch:    5, // location + interest both provided
}

function calculateScore(lead, interactionCount = 0) {
  const breakdown = { base: SCORE.base }
  let score = SCORE.base

  // Budget confirmed: has a specific min budget or is pre-approved
  const budgetConfirmed       = lead.budgetMin > 0 || lead.preApproved
  breakdown.budgetConfirmed   = budgetConfirmed ? SCORE.budgetConfirmed : 0
  score += breakdown.budgetConfirmed

  // Timeline urgency
  if (lead.timeline <= 90) {
    breakdown.timeline = SCORE.timeline
  } else if (lead.timeline <= 180) {
    breakdown.timeline = Math.round(SCORE.timeline / 2)
  } else {
    breakdown.timeline = 0
  }
  score += breakdown.timeline

  // Engagement: proportional up to 3 interactions
  const engagementRatio    = Math.min(interactionCount, 3) / 3
  breakdown.engagement     = Math.round(engagementRatio * SCORE.engagement)
  score += breakdown.engagement

  // Property match: both location preference and interest type provided
  const hasPreferences     = !!(lead.location && lead.interest)
  breakdown.propertyMatch  = hasPreferences ? SCORE.propertyMatch : 0
  score += breakdown.propertyMatch

  return { score: Math.min(100, score), breakdown }
}

// ─── Assignment ───────────────────────────────────────────────────────────────

const MAX_ACTIVE_LEADS = 15

async function findBestAgent(score, lead) {
  if (score < 60) return null // general pool — no auto-assignment

  const agents = await prisma.agent.findMany({
    where: {
      leadsAssigned: { lt: MAX_ACTIVE_LEADS },
      user:          { role: 'agent', isActive: true },
    },
    orderBy: { leadsAssigned: 'asc' },
  })

  if (agents.length === 0) return null

  if (score >= 80) {
    // High-priority: prefer specialization match, then fewest leads
    const specialized = agents.find(a =>
      (a.specialization && lead.interest && a.specialization.toLowerCase().includes(lead.interest.toLowerCase())) ||
      (a.region && lead.location && a.region.toLowerCase().includes(lead.location.toLowerCase()))
    )
    return specialized || agents[0]
  }

  return agents[0] // 60–79: next available (fewest leads)
}

async function autoAssignLead(leadId) {
  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: { interactions: { select: { id: true } } },
  })
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const { score, breakdown } = calculateScore(lead, lead.interactions.length)
  const agent = await findBestAgent(score, lead)

  const updateData = { score, scoreBreakdown: breakdown }
  if (agent) updateData.agentId = agent.id

  // Atomic: update lead + agent workload counter together to prevent drift
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: updateData })
    if (agent) {
      await tx.agent.update({ where: { id: agent.id }, data: { leadsAssigned: { increment: 1 } } })
    }
  })

  // ── Notifications (fire-and-forget) ────────────────────────────────────────
  if (agent) {
    const scoredLead = { ...lead, score }
    if (score >= 80) {
      // Hot lead: SMS + email
      notificationSvc.notifyHotLead(scoredLead, agent.id)
        .catch(err => console.error('[notify] hot lead failed:', err.message))
    } else {
      // Standard assignment: email only
      notificationSvc.notifyLeadAssigned(scoredLead, agent.id)
        .catch(err => console.error('[notify] lead assigned failed:', err.message))
    }
  }

  return {
    score,
    tier:            score >= 80 ? 'immediate' : score >= 60 ? 'standard' : 'pool',
    assignedAgentId: agent?.id   ?? null,
    agentName:       agent?.name ?? null,
    breakdown,
  }
}

// Recompute score after new interactions
async function refreshScore(leadId) {
  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: { interactions: { select: { id: true } } },
  })
  if (!lead) return null

  const { score, breakdown } = calculateScore(lead, lead.interactions.length)
  await prisma.lead.update({
    where: { id: leadId },
    data:  { score, scoreBreakdown: breakdown },
  })
  return { score, breakdown }
}

// ─── Auto-qualification ───────────────────────────────────────────────────────

async function checkAutoQualification(leadId) {
  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: {
      interactions: { select: { id: true } },
      deals: {
        where:   { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take:    1,
        include: { documents: { select: { id: true } } },
      },
    },
  })
  if (!lead || lead.isDeleted) return null

  let newStage = null
  let reason   = null

  if (lead.stage === 'freshLead') {
    const budgetOk   = lead.budgetMin > 0 || lead.preApproved
    const timelineOk = lead.timeline < 90
    const prefsOk    = !!(lead.location && lead.interest)

    if (budgetOk && timelineOk && prefsOk) {
      newStage = 'qualified'
      reason   = 'Budget confirmed, timeline < 90 days, property preferences set'
    }

  } else if (lead.stage === 'qualified') {
    const viewed    = lead.propertiesViewed > 0
    const offerMade = lead.deals.length > 0

    if (viewed && offerMade) {
      newStage = 'followUp'
      reason   = 'Property viewed and deal offer created'
    }

  } else if (lead.stage === 'followUp') {
    const deal       = lead.deals[0]
    const atClosing  = deal && (deal.stage === 'closing' || deal.stage === 'closed')
    const docsSigned = deal && deal.documents.length > 0

    if (atClosing && docsSigned) {
      newStage = 'reservation'
      reason   = 'Deal at closing stage with signed documents'
    }
  }

  if (!newStage) return null

  await prisma.lead.update({
    where: { id: leadId },
    data:  { stage: newStage, version: { increment: 1 } },
  })

  return { leadId, previousStage: lead.stage, newStage, reason }
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

async function findDuplicate(email, phone) {
  return prisma.lead.findFirst({
    where: {
      isDeleted: false,
      OR: [
        { email: { equals: email.trim(), mode: 'insensitive' } },
        ...(phone ? [{ phone: phone.trim() }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
  })
}

// Merge: keep oldest lead, move all interactions + tags, soft-delete the newer one
async function mergeLeads(keepId, mergeId) {
  if (keepId === mergeId) throw AppError.badRequest('Cannot merge a lead with itself')

  return prisma.$transaction(async (tx) => {
    const [keep, merge] = await Promise.all([
      tx.lead.findUnique({ where: { id: keepId },  include: { tags: true } }),
      tx.lead.findUnique({ where: { id: mergeId }, include: { tags: true, interactions: true } }),
    ])
    if (!keep)  throw AppError.notFound('Lead to keep')
    if (!merge) throw AppError.notFound('Lead to merge')

    if (merge.interactions.length > 0) {
      await tx.leadInteraction.updateMany({
        where: { leadId: mergeId },
        data:  { leadId: keepId },
      })
    }

    const existingTags = new Set(keep.tags.map(t => t.tag))
    const newTags      = merge.tags.filter(t => !existingTags.has(t.tag))
    if (newTags.length > 0) {
      await tx.leadTag.createMany({
        data: newTags.map(t => ({ leadId: keepId, tag: t.tag })),
      })
    }

    await tx.lead.update({
      where: { id: mergeId },
      data:  { isDeleted: true, notes: `Merged into lead ${keepId} on ${new Date().toISOString()}` },
    })

    const totalInteractions = await tx.leadInteraction.count({ where: { leadId: keepId } })
    const { score, breakdown } = calculateScore(keep, totalInteractions)
    await tx.lead.update({
      where: { id: keepId },
      data:  { score, scoreBreakdown: breakdown },
    })

    return {
      keptId:            keepId,
      mergedId:          mergeId,
      interactionsMoved: merge.interactions.length,
      tagsMerged:        newTags.length,
      newScore:          score,
    }
  })
}

module.exports = {
  SCORE,
  MAX_ACTIVE_LEADS,
  calculateScore,
  autoAssignLead,
  refreshScore,
  checkAutoQualification,
  findDuplicate,
  mergeLeads,
}
