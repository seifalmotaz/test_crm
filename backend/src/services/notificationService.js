'use strict'

/**
 * Notification Service
 *
 * Queues notifications to the DB and delivers them via pluggable channel adapters.
 * All notifications are persisted regardless of delivery outcome so agents always
 * have an in-app inbox even if email/SMS/push delivery fails.
 *
 * TYPES:
 *  HOT_LEAD          — lead score > 80; assigned agent via SMS + email (immediate)
 *  LEAD_ASSIGNED     — any lead assigned to an agent; email (immediate)
 *  DEAL_STAGE        — deal advances to any new stage; email (immediate)
 *  DEAL_CLOSED       — deal reaches closed stage; SMS (immediate)
 *  DEAL_RISK         — closing probability drops below 75%; agent + manager (immediate)
 *  COMMISSION_RELEASE — held commission released to payroll; email (immediate)
 *  OVERDUE_TASK      — task 1+ days past due; push + email (daily)
 *  CLOSING_SOON      — deal < 7 days to close; agent + manager (daily)
 *  NEW_LISTING       — property matching buyer preferences; matching buyers via email
 *  MARKET_UPDATE     — weekly/monthly market summary; past clients via email
 *
 * DELIVERY:
 *  Adapters are injected at startup via setAdapters(). Missing adapters are skipped
 *  gracefully — the in-app notification is always persisted.
 */

const { prisma } = require('../config/database');

// ─── Channel adapters (injected at startup via server.js) ─────────────────────

const adapters = {
  email: null, // async (agentId, subject, htmlBody) => void
  sms:   null, // async (agentId, message) => void
  push:  null, // async (agentId, title, body) => void
};

function setAdapters(adapterMap) {
  Object.assign(adapters, adapterMap);
}

// ─── Core queue + delivery ────────────────────────────────────────────────────

async function queue(type, recipientId, title, message, channels = ['in_app'], opts = {}) {
  const { entityType, entityId, metadata = {} } = opts;
  return prisma.notification.create({
    data: { type, recipientId, title, message, channels, entityType, entityId, metadata },
  });
}

async function deliver(notification) {
  const { channels, title, message } = notification;
  const errors = [];

  for (const channel of channels) {
    try {
      if (channel === 'email' && adapters.email) {
        await adapters.email(notification.recipientId, title, message);
      } else if (channel === 'sms' && adapters.sms) {
        await adapters.sms(notification.recipientId, message);
      } else if (channel === 'push' && adapters.push) {
        await adapters.push(notification.recipientId, title, message);
      }
      // 'in_app' is always delivered (stored in DB above)
    } catch (err) {
      errors.push({ channel, error: err.message });
    }
  }

  const externalChannels = channels.filter(c => c !== 'in_app');
  const status = errors.length > 0 && errors.length === externalChannels.length && externalChannels.length > 0
    ? 'failed'
    : 'sent';

  await prisma.notification.update({
    where: { id: notification.id },
    data:  { status, sentAt: new Date(), metadata: { ...notification.metadata, deliveryErrors: errors } },
  });

  return { status, errors };
}

// Queue and attempt immediate delivery
async function send(type, recipientId, title, message, channels, opts = {}) {
  const notification = await queue(type, recipientId, title, message, channels, opts);
  return deliver(notification);
}

// ─── Type-specific helpers ────────────────────────────────────────────────────

// LEAD_ASSIGNED: any lead is assigned to an agent (email)
async function notifyLeadAssigned(lead, agentId) {
  const budget  = lead.budget ? ` · Budget: $${(lead.budget / 1_000).toFixed(0)}K` : ''
  const title   = `New lead assigned: ${lead.name}`
  const message = [
    `A lead has been assigned to you.`,
    `<br><br>`,
    `<strong>Name:</strong> ${lead.name}<br>`,
    `<strong>Source:</strong> ${lead.source || 'Unknown'}<br>`,
    `<strong>Timeline:</strong> ${lead.timeline || '—'} days${budget}<br>`,
    `<strong>Score:</strong> ${lead.score ?? '—'}/100`,
  ].join('')

  return send('LEAD_ASSIGNED', agentId, title, message, ['email', 'in_app'], {
    entityType: 'lead',
    entityId:   lead.id,
    metadata:   { score: lead.score, budget: lead.budget, timeline: lead.timeline },
  })
}

// HOT_LEAD: lead score > 80 — agent gets SMS + email (immediate high-priority)
async function notifyHotLead(lead, agentId) {
  const budget  = lead.budget ? `$${(lead.budget / 1_000).toFixed(0)}K budget` : ''
  const title   = `Hot Lead: ${lead.name}`
  const message = `Hot lead assigned: ${lead.name}${budget ? `, ${budget}` : ''}, ${lead.timeline} days timeline. Score: ${lead.score}/100`

  return send('HOT_LEAD', agentId, title, message, ['sms', 'email', 'in_app'], {
    entityType: 'lead',
    entityId:   lead.id,
    metadata:   { score: lead.score, budget: lead.budget, timeline: lead.timeline },
  })
}

// DEAL_STAGE: deal advances to any new stage (email)
async function notifyDealStageAdvanced(deal, previousStage, agentId) {
  const address = deal.property?.address ?? deal.id
  const title   = `Deal advanced to ${deal.stage}: ${address}`
  const message = [
    `A deal you are managing has advanced.`,
    `<br><br>`,
    `<strong>Property:</strong> ${address}<br>`,
    `<strong>Stage:</strong> ${previousStage} → <strong>${deal.stage}</strong><br>`,
    `<strong>Value:</strong> $${(deal.value ?? 0).toLocaleString()}<br>`,
    `<strong>Close probability:</strong> ${deal.closingProbability ?? '—'}%`,
  ].join('')

  return send('DEAL_STAGE', agentId, title, message, ['email', 'in_app'], {
    entityType: 'deal',
    entityId:   deal.id,
    metadata:   { previousStage, newStage: deal.stage, value: deal.value },
  })
}

// DEAL_CLOSED: deal reaches closed stage — SMS only (email already sent by notifyDealStageAdvanced)
async function notifyDealClosed(deal, agentId) {
  const address    = deal.property?.address ?? 'Property'
  const commission = deal.value && deal.commissionRate
    ? `Commission: $${((deal.value * deal.commissionRate) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}.`
    : ''
  const message = `Deal closed! ${address} — $${(deal.value ?? 0).toLocaleString()}. ${commission} Great work!`

  return send('DEAL_CLOSED', agentId, `Deal closed: ${address}`, message, ['sms', 'in_app'], {
    entityType: 'deal',
    entityId:   deal.id,
    metadata:   { value: deal.value, commissionRate: deal.commissionRate },
  })
}

// DEAL_RISK: closing probability drops below 75%
async function notifyDealRisk(deal, previousProbability) {
  const title   = `Deal at risk: ${deal.property?.address ?? deal.id}`
  const message = `Closing probability dropped from ${previousProbability}% to ${deal.closingProbability}% — review deal status`

  const notifications = []

  notifications.push(
    send('DEAL_RISK', deal.agentId, title, message, ['email', 'in_app'], {
      entityType: 'deal',
      entityId:   deal.id,
      metadata:   { previousProbability, currentProbability: deal.closingProbability },
    })
  )

  const managers = await prisma.user.findMany({
    where:   { role: { in: ['admin', 'manager'] }, isActive: true },
    include: { agent: { select: { id: true } } },
  })
  for (const mgr of managers.filter(m => m.agent)) {
    notifications.push(
      queue('DEAL_RISK', mgr.agent.id, title, message, ['email', 'in_app'], {
        entityType: 'deal',
        entityId:   deal.id,
        metadata:   { previousProbability, currentProbability: deal.closingProbability },
      })
    )
  }

  return Promise.all(notifications)
}

// COMMISSION_RELEASE: held commission has passed the 7-day window (email)
async function notifyCommissionReleased(agentId, amount, dealId) {
  const fmt   = v => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const title = `Commission released: ${fmt(amount)}`
  const message = [
    `Your commission of <strong>${fmt(amount)}</strong> has been released from hold`,
    ` and is now queued for the next payroll batch.`,
    `<br><br>Deal ID: ${dealId}`,
  ].join('')

  return send('COMMISSION_RELEASE', agentId, title, message, ['email', 'in_app'], {
    entityType: 'deal',
    entityId:   dealId,
    metadata:   { amount },
  })
}

// OVERDUE_TASK: task is 1+ days past due — push + email
async function notifyOverdueTask(task, agentId) {
  const title   = `Overdue task: ${task.title}`
  const message = `Task "${task.title}" is ${task.daysOverdue} day(s) overdue. Due: ${new Date(task.dueDate).toLocaleDateString()}`

  return send('OVERDUE_TASK', agentId, title, message, ['push', 'email', 'in_app'], {
    entityType: 'task',
    entityId:   task.id,
    metadata:   { daysOverdue: task.daysOverdue, dueDate: task.dueDate },
  })
}

// CLOSING_SOON: deal < 7 days to close
async function notifyClosingSoon(deal) {
  const address = deal.property?.address ?? 'property'
  const days    = deal.daysUntilClose
  const title   = `Closing in ${days} day${days === 1 ? '' : 's'}: ${address}`
  const message = `Deal for ${address} closes in ${days} day${days === 1 ? '' : 's'}. Value: $${deal.value?.toLocaleString()}. Ensure all documents are signed and wire is ready.`

  const notifications = [
    send('CLOSING_SOON', deal.agentId, title, message, ['email', 'in_app'], {
      entityType: 'deal',
      entityId:   deal.id,
      metadata:   { daysUntilClose: days, dealValue: deal.value },
    }),
  ]

  const managers = await prisma.user.findMany({
    where:   { role: { in: ['admin', 'manager'] }, isActive: true },
    include: { agent: { select: { id: true } } },
  })
  for (const mgr of managers.filter(m => m.agent && m.agent.id !== deal.agentId)) {
    notifications.push(
      queue('CLOSING_SOON', mgr.agent.id, title, message, ['in_app'], {
        entityType: 'deal',
        entityId:   deal.id,
        metadata:   { daysUntilClose: days, dealValue: deal.value },
      })
    )
  }

  return Promise.all(notifications)
}

// NEW_MESSAGE: a chat message was received
async function notifyNewMessage(recipientAgentId, senderName, messagePreview, convoId) {
  const preview = messagePreview?.length > 80 ? messagePreview.slice(0, 80) + '…' : (messagePreview || 'Sent a file')
  return send('NEW_MESSAGE', recipientAgentId, `New message from ${senderName}`, preview, ['in_app'], {
    entityType: 'conversation',
    entityId:   convoId,
    metadata:   { senderName, preview },
  })
}

// TASK_ASSIGNED: a task was created and assigned to an agent
async function notifyTaskAssigned(task, assigneeAgentId, creatorName) {
  const due   = new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const title = `New task assigned: ${task.title}`
  const message = [
    `<strong>${creatorName}</strong> assigned you a task.`,
    `<br><br>`,
    `<strong>Task:</strong> ${task.title}<br>`,
    `<strong>Priority:</strong> ${task.priority}<br>`,
    `<strong>Due:</strong> ${due}`,
  ].join('')
  return send('TASK_ASSIGNED', assigneeAgentId, title, message, ['in_app'], {
    entityType: 'task',
    entityId:   task.id,
    metadata:   { priority: task.priority, dueDate: task.dueDate, creatorName },
  })
}

// NEW_LISTING: notify leads whose preferences match a new property
async function notifyNewListing(property) {
  const matchingLeads = await prisma.lead.findMany({
    where: {
      isDeleted: false,
      stage:     { notIn: ['closed', 'lost'] },
      interest:  { contains: property.type,         mode: 'insensitive' },
      location:  { contains: property.neighborhood, mode: 'insensitive' },
    },
    include: { agent: { select: { id: true } } },
  })

  const title   = `New listing: ${property.address}`
  const message = `New ${property.type} listing in ${property.neighborhood}: ${property.address}. Price: $${property.price?.toLocaleString()}. ${property.beds} bed, ${property.baths} bath.`

  const notifications = matchingLeads.map(lead =>
    queue('NEW_LISTING', lead.agentId, title, message, ['email', 'in_app'], {
      entityType: 'property',
      entityId:   property.id,
      metadata:   { leadId: lead.id, propertyType: property.type, price: property.price },
    })
  )

  return Promise.all(notifications)
}

// ─── Agent inbox ──────────────────────────────────────────────────────────────

async function getAgentNotifications(agentId, opts = {}) {
  const { unreadOnly = false, limit = 50 } = opts
  const where = { recipientId: agentId }
  if (unreadOnly) where.readAt = null

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })
}

async function markAsRead(notificationId, agentId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, recipientId: agentId },
    data:  { readAt: new Date() },
  })
}

async function markAllRead(agentId) {
  return prisma.notification.updateMany({
    where: { recipientId: agentId, readAt: null },
    data:  { readAt: new Date() },
  })
}

// ─── Scheduled: closing-soon daily scan ──────────────────────────────────────

async function scanClosingSoonDeals() {
  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)

  const deals = await prisma.deal.findMany({
    where: {
      isDeleted:       false,
      stage:           { notIn: ['closed', 'lost'] },
      targetCloseDate: { lte: in7Days },
    },
    include: { property: { select: { address: true } } },
  })

  const results = await Promise.allSettled(deals.map(notifyClosingSoon))
  const sent    = results.filter(r => r.status === 'fulfilled').length
  return { scanned: deals.length, sent }
}

module.exports = {
  setAdapters,
  queue,
  deliver,
  send,
  notifyLeadAssigned,
  notifyHotLead,
  notifyDealStageAdvanced,
  notifyDealClosed,
  notifyDealRisk,
  notifyCommissionReleased,
  notifyOverdueTask,
  notifyClosingSoon,
  notifyNewListing,
  notifyNewMessage,
  notifyTaskAssigned,
  getAgentNotifications,
  markAsRead,
  markAllRead,
  scanClosingSoonDeals,
}
