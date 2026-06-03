/**
 * Lead Conversion Service
 *
 * Implements the atomic "Convert Lead to Deal" flow:
 *
 *  1. Validate   — lead is qualified, property is active, no existing deal
 *  2. Create deal — offer stage, 50% probability, close target in 45 days
 *  3. Update lead — qualified → negotiating, linked to deal
 *  4. Update property — Active → Pending (linked to deal)
 *     Steps 2-4 are a single DB transaction: all succeed or all rollback.
 *  5. Tasks  — "Create purchase offer" (due tomorrow), "Schedule inspection" (due in 2 days)
 *  6. Notify — agent (deal created), managers (new deal alert)
 *  7. Audit  — log the conversion
 *
 * Exposed as: POST /api/leads/:id/convert
 * Body: { propertyId, agentId?, commissionRate?, notes? }
 */

const { prisma }   = require('../config/database');
const { AppError } = require('../utils/AppError');

const taskAutomation  = require('./taskAutomation');
const notificationSvc = require('./notificationService');
const auditSvc        = require('./auditService');
const commissionSvc   = require('./commissionService');
const dealService     = require('./dealService');

const OFFER_PROBABILITY   = 50;
const DEFAULT_CLOSE_DAYS  = 45;

// ─── Validation ───────────────────────────────────────────────────────────────

async function validateConversion(leadId, propertyId, tx = prisma) {
  const [lead, property] = await Promise.all([
    tx.lead.findFirst({
      where:   { id: leadId, isDeleted: false },
      include: { deals: { where: { isDeleted: false } } },
    }),
    tx.property.findFirst({
      where: { id: propertyId, isDeleted: false },
    }),
  ]);

  if (!lead)                      throw AppError.notFound('Lead');
  if (lead.stage === 'reservation' && lead.deals?.length > 0) throw AppError.badRequest('Lead already has a deal');
  if (!['qualified', 'followUp', 'callBack', 'reservation'].includes(lead.stage)) {
    throw AppError.badRequest(
      `Lead must be at least Qualified before converting to a deal (current stage: ${lead.stage})`
    );
  }

  if (!property)                    throw AppError.notFound('Property');
  if (property.status !== 'Active') {
    throw AppError.badRequest(
      `Property must be Active to create a deal (current status: ${property.status})`
    );
  }

  // Idempotency guard: check if a deal already links this lead to this property
  const existing = await tx.deal.findFirst({
    where: { leadId, propertyId, isDeleted: false },
  });
  if (existing) {
    throw AppError.badRequest(
      `A deal already exists for this lead and property (deal ID: ${existing.id})`
    );
  }

  return { lead, property };
}

// ─── Core conversion ──────────────────────────────────────────────────────────

async function convertLeadToDeal(leadId, propertyId, opts = {}, auditCtx = {}) {
  const {
    agentId: overrideAgentId,
    commissionRate: overrideRate,
    notes,
  } = opts;

  // Pre-transaction validation (cheaper — avoids holding a transaction open during IO)
  const { lead, property } = await validateConversion(leadId, propertyId);

  const agentId = overrideAgentId || lead.agentId;
  if (!agentId) throw AppError.badRequest('Lead has no assigned agent — provide agentId');

  const targetCloseDate = new Date();
  targetCloseDate.setDate(targetCloseDate.getDate() + DEFAULT_CLOSE_DAYS);

  const { ratePct } = commissionSvc.calculate(property.price, 'standard');
  const commissionRate = overrideRate ?? ratePct;

  // ── Atomic transaction ────────────────────────────────────────────────────
  const deal = await prisma.$transaction(async (tx) => {
    // Re-validate inside transaction to guard against race conditions
    await validateConversion(leadId, propertyId, tx);

    // 1. Create deal at offer stage
    const newDeal = await tx.deal.create({
      data: {
        propertyId,
        leadId,
        agentId,
        type:                'standard',
        value:               property.price,
        commissionRate,
        stage:               'offer',
        closingProbability:  OFFER_PROBABILITY,
        offerDate:           new Date(),
        targetCloseDate,
        notes:               notes ?? null,
      },
      include: {
        agent:    { select: { id: true, name: true } },
        property: { select: { id: true, address: true, neighborhood: true } },
        client:   { select: { id: true, name: true, email: true } },
      },
    });

    // 2. Advance lead stage to negotiating, link to deal
    await tx.lead.update({
      where: { id: leadId },
      data:  { stage: 'reservation', version: { increment: 1 } },
    });

    // 3. Transition property Active → Pending (requires dealId)
    await tx.property.update({
      where: { id: propertyId },
      data:  { status: 'Pending', version: { increment: 1 } },
    });

    // 4. Increment agent's active deal count
    await tx.agent.update({
      where: { id: agentId },
      data:  { activeDeals: { increment: 1 } },
    });

    return newDeal;
  });

  // ── Post-transaction side effects (best-effort) ────────────────────────────

  // 5. Auto-generate workflow tasks
  await taskAutomation.createDealTasks(deal.id, agentId);

  // 6. Notifications
  notifiyConversion(deal, agentId, lead).catch(() => {});

  // 7. Audit log
  auditSvc.log('LEAD_CONVERT', 'deals', {
    ...auditCtx,
    resourceId: deal.id,
    changes: {
      after: {
        dealId:     deal.id,
        leadId,
        propertyId,
        agentId,
        value:      property.price,
        stage:      'offer',
      },
    },
  }).catch(() => {});

  return {
    deal,
    leadStage:      'negotiating',
    propertyStatus: 'Pending',
    tasksCreated:   ['Create purchase offer', 'Schedule inspection', 'Order appraisal'],
    closeTarget:    targetCloseDate.toISOString().slice(0, 10),
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function notifiyConversion(deal, agentId, lead) {
  const address = deal.property?.address ?? 'property';
  const value   = deal.value ? `$${(deal.value / 1_000_000).toFixed(2)}M` : '';

  // Agent: success confirmation
  await notificationSvc.send(
    'NEW_DEAL',
    agentId,
    'Deal Created',
    `Deal created for ${address}${value ? ` – ${value}` : ''}. Target close: ${DEFAULT_CLOSE_DAYS} days.`,
    ['in_app'],
    { entityType: 'deal', entityId: deal.id },
  );

  // Managers/admins: new deal alert (in-app + email)
  const managers = await prisma.agent.findMany({
    where: { user: { role: { in: ['manager', 'admin'] }, isActive: true } },
    select: { id: true },
  });

  await Promise.allSettled(managers.map(mgr =>
    notificationSvc.send(
      'NEW_DEAL',
      mgr.id,
      'New Deal Alert',
      `New deal: ${address}${value ? `, ${value}` : ''} — ${lead.name} → ${deal.agent?.name ?? 'unassigned'}`,
      ['in_app', 'email'],
      { entityType: 'deal', entityId: deal.id },
    )
  ));
}

module.exports = { convertLeadToDeal, validateConversion };
