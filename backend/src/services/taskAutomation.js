'use strict'

/**
 * Task Automation Service
 *
 * Auto-generates tasks at key workflow events and escalates overdue tasks.
 *
 * EVENTS → TASKS:
 *  Deal created          → 3 tasks (day 1: offer, day 2: inspection, day 3: appraisal)
 *  Inspection reached    → review task + conditional negotiate-repairs task
 *  Appraisal reached     → review task + conditional appraisal-gap task
 *  Lead assigned         → 4 follow-up tasks (day 1, 3, 7, 14)
 *  Lead qualified        → showing task (due in 2 days)
 *
 * ESCALATION:
 *  1 day overdue  → status = overdue, push + email notification sent
 *  3 days overdue → escalate to manager
 *  5 days overdue → escalate to director + mark as risk
 */

const { prisma }      = require('../config/database')
const notificationSvc = require('./notificationService')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(17, 0, 0, 0) // due at 5 PM
  return d
}

function today() {
  const d = new Date()
  d.setHours(17, 0, 0, 0)
  return d
}

// ─── Deal workflow ────────────────────────────────────────────────────────────

async function createDealTasks(dealId, agentId) {
  return prisma.task.createMany({
    data: [
      {
        title:            'Create purchase offer',
        category:         'Deal',
        priority:         'high',
        dueDate:          daysFromNow(1),
        dealId,
        assigneeId:       agentId,
        workflowTemplate: 'deal_created_d1',
        proofLabel:       'Upload signed offer document',
      },
      {
        title:            'Schedule property inspection',
        category:         'Deal',
        priority:         'high',
        dueDate:          daysFromNow(2),
        dealId,
        assigneeId:       agentId,
        workflowTemplate: 'deal_created_d2',
        proofLabel:       'Confirm inspection appointment date/time',
      },
      {
        title:            'Order home appraisal',
        category:         'Deal',
        priority:         'medium',
        dueDate:          daysFromNow(3),
        dealId,
        assigneeId:       agentId,
        workflowTemplate: 'deal_created_d3',
        proofLabel:       'Upload appraisal order confirmation',
      },
    ],
  })
}

// Call when deal reaches inspection stage
async function createInspectionTasks(dealId, agentId, opts = {}) {
  const { inspectionDate, hasIssues = false } = opts
  const base      = inspectionDate ? new Date(inspectionDate) : new Date()
  const reviewDue = new Date(base)
  reviewDue.setDate(reviewDue.getDate() + 4)
  reviewDue.setHours(17, 0, 0, 0)

  const tasks = [
    {
      title:            'Review inspection report',
      category:         'Deal',
      priority:         hasIssues ? 'critical' : 'high',
      dueDate:          reviewDue,
      dealId,
      assigneeId:       agentId,
      workflowTemplate: 'inspection_review',
      proofLabel:       'Upload inspection review notes',
    },
  ]

  if (hasIssues) {
    tasks.push({
      title:            'Negotiate repairs with seller',
      category:         'Deal',
      priority:         'critical',
      dueDate:          reviewDue,
      dealId,
      assigneeId:       agentId,
      workflowTemplate: 'inspection_negotiate',
      impact:           'Unresolved inspection issues may derail the deal',
      proofLabel:       'Upload repair negotiation outcome',
    })
  }

  return prisma.task.createMany({ data: tasks })
}

// Call when deal reaches appraisal stage
async function createAppraisalTasks(dealId, agentId, opts = {}) {
  const { appraisalGapPct = 0 } = opts
  const dueDate = daysFromNow(7)

  const tasks = [
    {
      title:            'Review appraisal report',
      category:         'Deal',
      priority:         'high',
      dueDate,
      dealId,
      assigneeId:       agentId,
      workflowTemplate: 'appraisal_review',
      proofLabel:       'Upload appraisal review summary',
    },
  ]

  if (appraisalGapPct > 5) {
    tasks.push({
      title:            'Mediate appraisal gap',
      category:         'Deal',
      priority:         'critical',
      dueDate,
      dealId,
      assigneeId:       agentId,
      workflowTemplate: 'appraisal_gap',
      impact:           `Appraisal gap of ${appraisalGapPct.toFixed(1)}% requires resolution before closing`,
      proofLabel:       'Upload gap resolution documentation',
    })
  }

  return prisma.task.createMany({ data: tasks })
}

// ─── Lead workflow ────────────────────────────────────────────────────────────

async function createLeadAssignedTasks(leadId, agentId) {
  return prisma.task.createMany({
    data: [
      {
        title:            'Initial contact call',
        category:         'Lead',
        priority:         'high',
        dueDate:          today(),
        leadId,
        assigneeId:       agentId,
        workflowTemplate: 'lead_assigned_d1',
        proofLabel:       'Log call notes in CRM',
      },
      {
        title:            'Send property recommendations',
        category:         'Lead',
        priority:         'medium',
        dueDate:          daysFromNow(3),
        leadId,
        assigneeId:       agentId,
        workflowTemplate: 'lead_assigned_d3',
        description:      'Send if initial contact has not been made',
        proofLabel:       'Confirm email sent with property recommendations',
      },
      {
        title:            'Follow-up call',
        category:         'Lead',
        priority:         'medium',
        dueDate:          daysFromNow(7),
        leadId,
        assigneeId:       agentId,
        workflowTemplate: 'lead_assigned_d7',
        description:      'Follow up if no property has been shown',
        proofLabel:       'Log call summary (required for calls over 15 minutes)',
      },
      {
        title:            'Send CMA or market update',
        category:         'Lead',
        priority:         'low',
        dueDate:          daysFromNow(14),
        leadId,
        assigneeId:       agentId,
        workflowTemplate: 'lead_assigned_d14',
        description:      'Re-engagement: send comparative market analysis',
        proofLabel:       'Upload CMA document or link',
      },
    ],
  })
}

async function createLeadQualifiedTask(leadId, agentId) {
  return prisma.task.create({
    data: {
      title:            'Schedule property showing',
      category:         'Lead',
      priority:         'high',
      dueDate:          daysFromNow(2),
      leadId,
      assigneeId:       agentId,
      workflowTemplate: 'lead_qualified',
      proofLabel:       'Confirm showing appointment with photo/timestamp',
    },
  })
}

// ─── Overdue escalation ───────────────────────────────────────────────────────

async function processOverdueTasks() {
  const now = new Date()

  const overdue = await prisma.task.findMany({
    where: {
      isDeleted: false,
      status:    { not: 'completed' },
      dueDate:   { lt: now },
    },
    select: {
      id:          true,
      title:       true,
      dueDate:     true,
      daysOverdue: true,
      escalated:   true,
      assigneeId:  true,
    },
  })

  const stats = { reminded: 0, escalatedManager: 0, escalatedDirector: 0 }

  for (const task of overdue) {
    const days = Math.ceil(
      (now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    let updateData = { daysOverdue: days, status: 'overdue' }

    if (days >= 5 && !task.escalated) {
      updateData = {
        ...updateData,
        escalated:  true,
        escalateTo: 'director',
        impact:     `RISK: ${days} days overdue — escalated to director`,
      }
      stats.escalatedDirector++
    } else if (days >= 3 && !task.escalated) {
      updateData = { ...updateData, escalateTo: 'manager' }
      stats.escalatedManager++
    } else {
      stats.reminded++
    }

    await prisma.task.update({ where: { id: task.id }, data: updateData })

    // Push + email on the first day a task becomes overdue.
    // Subsequent escalations are handled above — we do not re-notify daily.
    if (days === 1 && task.assigneeId) {
      const overdueTask = { ...task, daysOverdue: days }
      notificationSvc.notifyOverdueTask(overdueTask, task.assigneeId)
        .catch(err => console.error('[notify] overdue task push/email failed:', err.message))
    }
  }

  return { processed: overdue.length, ...stats }
}

module.exports = {
  createDealTasks,
  createInspectionTasks,
  createAppraisalTasks,
  createLeadAssignedTasks,
  createLeadQualifiedTask,
  processOverdueTasks,
}
