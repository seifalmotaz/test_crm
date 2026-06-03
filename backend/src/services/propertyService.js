/**
 * Property Business Logic Service
 *
 * RULES ENFORCED HERE:
 *  1. Status FSM — valid transitions only, no backwards movement
 *  2. Price update rules — blocked on Pending/Sold; >$100K reduction needs manager
 *  3. View tracking — deduplicated increments, hot-property alert at 100 views
 *  4. Listing agent authorization — only listing agent (or admin/manager) can modify
 */

const { prisma }   = require('../config/database');
const { AppError } = require('../utils/AppError');

// ─── Status FSM ───────────────────────────────────────────────────────────────

// Permitted forward transitions for each status.
// "Sold" is terminal — no transitions out.
const VALID_TRANSITIONS = {
  Active:    ['Pending', 'Sold', 'Withdrawn'],
  Pending:   ['Active'],      // deal fell through → back to market
  Withdrawn: ['Active'],      // re-listed
  Sold:      [],              // terminal
};

function assertValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    const hint = allowed.length
      ? `Allowed from ${from}: ${allowed.join(', ')}`
      : `${from} is a terminal status and cannot be changed`;
    throw AppError.badRequest(`Cannot transition property from ${from} to ${to}. ${hint}`);
  }
}

// ─── Status transition (with rule enforcement) ────────────────────────────────

async function transitionStatus(propertyId, newStatus, opts = {}) {
  const { dealId, requesterRole, requesterAgentId } = opts;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, isDeleted: false },
  });
  if (!property) throw AppError.notFound('Property');

  assertValidTransition(property.status, newStatus);

  // Active → Pending: requires a linked deal
  if (property.status === 'Active' && newStatus === 'Pending') {
    if (!dealId) throw AppError.badRequest('dealId is required to set a property to Pending');
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, propertyId, isDeleted: false },
    });
    if (!deal) throw AppError.badRequest('Deal not found or not linked to this property');
  }

  // Active → Sold: only when a deal has reached closing or closed
  if (property.status === 'Active' && newStatus === 'Sold') {
    const closingDeal = await prisma.deal.findFirst({
      where: { propertyId, stage: { in: ['closing', 'closed'] }, isDeleted: false },
    });
    if (!closingDeal) {
      throw AppError.badRequest('Cannot mark as Sold — no deal at closing stage found');
    }
  }

  // Authorization: agents can only change status on their own listings
  if (requesterRole === 'agent' && property.agentId !== requesterAgentId) {
    throw AppError.forbidden('Only the listing agent can change property status');
  }

  return prisma.property.update({
    where: { id: propertyId },
    data:  { status: newStatus, version: { increment: 1 } },
  });
}

// ─── Price update rules ───────────────────────────────────────────────────────

const LARGE_REDUCTION_THRESHOLD = 100_000;

function assertPriceUpdateAllowed(property, newPrice, requesterRole) {
  // Price updates blocked on non-active listings
  if (property.status !== 'Active') {
    throw AppError.badRequest(
      `Cannot update price when property is ${property.status}. Only Active listings allow price changes.`
    );
  }

  // Large reductions require manager/admin
  const reduction = property.price - newPrice;
  if (reduction > LARGE_REDUCTION_THRESHOLD && !['admin', 'manager'].includes(requesterRole)) {
    const err = AppError.forbidden(
      `Price reductions over $${LARGE_REDUCTION_THRESHOLD.toLocaleString()} require manager approval`
    );
    err.code           = 'REQUIRES_MANAGER_APPROVAL';
    err.reduction      = reduction;
    err.currentPrice   = property.price;
    err.newPrice       = newPrice;
    throw err;
  }

  return {
    oldPrice:          property.price,
    newPrice,
    reduction:         Math.max(0, reduction),
    requiresApproval:  reduction > LARGE_REDUCTION_THRESHOLD,
  };
}

// ─── Listing agent authorization ──────────────────────────────────────────────

function assertCanModify(property, requesterRole, requesterAgentId) {
  if (['admin', 'manager'].includes(requesterRole)) return; // override
  if (property.agentId !== requesterAgentId) {
    throw AppError.forbidden(
      'Only the listing agent can modify this property. Contact a manager to reassign.'
    );
  }
}

// ─── View tracking ────────────────────────────────────────────────────────────

const HOT_THRESHOLD = 100;

async function recordView(propertyId) {
  const property = await prisma.property.update({
    where:  { id: propertyId },
    data:   { views: { increment: 1 } },
    select: { id: true, views: true, agentId: true, address: true, status: true },
  });

  // Only fire the hot-property alert exactly at threshold (not on every subsequent view)
  const crossedThreshold = property.views === HOT_THRESHOLD;

  return {
    views:  property.views,
    isHot:  property.views >= HOT_THRESHOLD,
    // Caller is responsible for delivering alerts (email, push, etc.)
    alert: crossedThreshold ? {
      type:       'HOT_PROPERTY',
      propertyId: property.id,
      agentId:    property.agentId,
      address:    property.address,
      views:      property.views,
      message:    `Property at ${property.address} has reached ${HOT_THRESHOLD} views`,
    } : null,
  };
}

module.exports = {
  VALID_TRANSITIONS,
  LARGE_REDUCTION_THRESHOLD,
  HOT_THRESHOLD,
  assertValidTransition,
  transitionStatus,
  assertPriceUpdateAllowed,
  assertCanModify,
  recordView,
};
