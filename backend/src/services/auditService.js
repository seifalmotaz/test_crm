/**
 * Audit Service
 *
 * Records all critical actions to the AuditLog table.
 *
 * LOGGED ACTIONS:
 *  USER_LOGIN / USER_LOGOUT
 *  LEAD_CREATE / LEAD_UPDATE / LEAD_ARCHIVE / LEAD_MERGE
 *  DEAL_CREATE / DEAL_UPDATE / DEAL_STAGE_ADVANCE / DEAL_UNLOCK
 *  PROPERTY_CREATE / PROPERTY_UPDATE / PROPERTY_STATUS_CHANGE / PROPERTY_PRICE_CHANGE
 *  COMMISSION_ADJUST / COMMISSION_VOID / COMMISSION_RELEASE
 *  AGENT_ASSIGN / AGENT_REASSIGN
 *  SENSITIVE_DATA_ACCESS
 *
 * AUDIT TRAIL FORMAT:
 * {
 *   id:         "cuid",
 *   timestamp:  "2024-01-15T10:30:00Z",
 *   userId:     "user_123",
 *   userEmail:  "john@agency.com",
 *   userRole:   "agent",
 *   action:     "DEAL_STAGE_ADVANCE",
 *   resource:   "deals",
 *   resourceId: "deal_456",
 *   changes:    { before: { stage: "inspection" }, after: { stage: "appraisal" } },
 *   metadata:   { ip: "192.168.1.1", userAgent: "...", endpoint: "/api/deals/deal_456/stage", method: "POST" }
 * }
 */

const { prisma } = require('../config/database');

// ─── Core log writer ──────────────────────────────────────────────────────────

async function log(action, resource, opts = {}) {
  const { userId, userEmail, userRole, resourceId, changes, metadata } = opts;

  try {
    await prisma.auditLog.create({
      data: {
        userId:     userId    ?? 'system',
        userEmail:  userEmail ?? 'system',
        userRole:   userRole  ?? 'system',
        action,
        resource,
        resourceId: resourceId ?? null,
        changes:    changes    ?? null,
        metadata:   metadata   ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never crash the main request
    console.error('[Audit] Failed to write log entry:', err.message, { action, resource, resourceId });
  }
}

// ─── Context builder (call inside controllers) ────────────────────────────────

function fromRequest(req) {
  return {
    userId:    req.user?.id,
    userEmail: req.user?.email,
    userRole:  req.user?.role,
    metadata:  {
      ip:       req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
      endpoint: req.originalUrl,
      method:   req.method,
    },
  };
}

// ─── Action-specific helpers ──────────────────────────────────────────────────

async function logLogin(userId, userEmail, userRole, metadata = {}) {
  return log('USER_LOGIN', 'auth', { userId, userEmail, userRole, metadata });
}

async function logLogout(userId, userEmail, userRole, metadata = {}) {
  return log('USER_LOGOUT', 'auth', { userId, userEmail, userRole, metadata });
}

async function logDealStageChange(ctx, dealId, fromStage, toStage) {
  return log('DEAL_STAGE_ADVANCE', 'deals', {
    ...ctx,
    resourceId: dealId,
    changes:    { before: { stage: fromStage }, after: { stage: toStage } },
  });
}

async function logDealCreate(ctx, dealId, dealData) {
  return log('DEAL_CREATE', 'deals', {
    ...ctx,
    resourceId: dealId,
    changes:    { after: dealData },
  });
}

async function logDealUnlock(ctx, dealId) {
  return log('DEAL_UNLOCK', 'deals', { ...ctx, resourceId: dealId });
}

async function logPriceChange(ctx, propertyId, oldPrice, newPrice) {
  return log('PROPERTY_PRICE_CHANGE', 'properties', {
    ...ctx,
    resourceId: propertyId,
    changes:    { before: { price: oldPrice }, after: { price: newPrice } },
  });
}

async function logPropertyStatusChange(ctx, propertyId, fromStatus, toStatus) {
  return log('PROPERTY_STATUS_CHANGE', 'properties', {
    ...ctx,
    resourceId: propertyId,
    changes:    { before: { status: fromStatus }, after: { status: toStatus } },
  });
}

async function logCommissionAdjust(ctx, recordId, oldAmount, newAmount, reason) {
  return log('COMMISSION_ADJUST', 'commissions', {
    ...ctx,
    resourceId: recordId,
    changes:    { before: { amount: oldAmount }, after: { amount: newAmount }, reason },
  });
}

async function logCommissionVoid(ctx, dealId, amount, reason) {
  return log('COMMISSION_VOID', 'commissions', {
    ...ctx,
    resourceId: dealId,
    changes:    { before: { amount }, after: { amount: 0 }, reason },
  });
}

async function logAgentAssign(ctx, leadId, fromAgentId, toAgentId) {
  return log('AGENT_ASSIGN', 'leads', {
    ...ctx,
    resourceId: leadId,
    changes:    { before: { agentId: fromAgentId }, after: { agentId: toAgentId } },
  });
}

async function logLeadMerge(ctx, keepId, mergeId) {
  return log('LEAD_MERGE', 'leads', {
    ...ctx,
    resourceId: keepId,
    changes:    { merged: mergeId, kept: keepId },
  });
}

async function logSensitiveAccess(ctx, resource, resourceId, fieldAccessed) {
  return log('SENSITIVE_DATA_ACCESS', resource, {
    ...ctx,
    resourceId,
    metadata: { ...ctx.metadata, fieldAccessed },
  });
}

// ─── Query helpers ────────────────────────────────────────────────────────────

async function getResourceHistory(resource, resourceId, limit = 50) {
  return prisma.auditLog.findMany({
    where:   { resource, resourceId },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  });
}

async function getUserActivity(userId, limit = 100) {
  return prisma.auditLog.findMany({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  });
}

async function getActionHistory(action, since) {
  const where = { action };
  if (since) where.createdAt = { gte: new Date(since) };
  return prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' } });
}

module.exports = {
  log,
  fromRequest,
  logLogin,
  logLogout,
  logDealStageChange,
  logDealCreate,
  logDealUnlock,
  logPriceChange,
  logPropertyStatusChange,
  logCommissionAdjust,
  logCommissionVoid,
  logAgentAssign,
  logLeadMerge,
  logSensitiveAccess,
  getResourceHistory,
  getUserActivity,
  getActionHistory,
};
