const { z } = require('zod');
const { prisma } = require('../config/database');
const { success, created, list } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { agentFilter } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const notifSvc = require('../services/notificationService');

const createSchema = z.object({
  title:           z.string().min(3),
  category:        z.enum(['Deal', 'Lead', 'Property', 'Client', 'Admin']),
  priority:        z.enum(['critical', 'high', 'medium', 'low']),
  dueDate:         z.string(),
  assigneeId:      z.string().optional(),
  dealId:          z.string().optional(),
  leadId:          z.string().optional(),
  clientId:        z.string().optional(),
  propertyId:      z.string().optional(),
  description:     z.string().optional(),
  completionProof: z.string().optional(),
  proofLabel:      z.string().optional(),
  escalated:       z.boolean().optional().default(false),
  escalateTo:      z.string().optional(),
  impact:          z.string().optional(),
  workflowTemplate: z.string().optional(),
  tags:            z.array(z.string()).optional().default([]),
  subtasks:        z.array(z.object({ label: z.string(), done: z.boolean().default(false) })).optional().default([]),
});

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, avatar: true, color: true } },
  subtasks: true,
  tags:     { select: { tag: true } },
};

function mapTask(t) {
  return { ...t, tags: t.tags?.map(x => x.tag) || [] };
}

function buildFilter(q, agentF) {
  const where = { ...agentF, isDeleted: false };
  if (q.status)   where.status   = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.category) where.category = q.category;
  if (q.assigneeId && !agentF.agentId) where.assigneeId = q.assigneeId;
  return where;
}

// Map agentId filter to assigneeId for tasks
function taskAgentFilter(req) {
  const f = agentFilter(req);
  if (f.agentId) return { assigneeId: f.agentId };
  return {};
}

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = buildFilter(req.query, taskAgentFilter(req));
  const validSorts = { due: 'dueDate', priority: 'priority', created: 'createdAt' };
  const orderBy = { [validSorts[req.query.sort] || 'dueDate']: 'asc' };

  const [total, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({ where, skip, take: perPage, orderBy, include: TASK_INCLUDE }),
  ]);
  list(res, rows.map(mapTask), buildPaginationMeta(page, perPage, total));
});

exports.create = catchAsync(async (req, res) => {
  const body = createSchema.parse(req.body);
  const { tags, subtasks, ...data } = body;
  const assigneeId = data.assigneeId || req.agentId;

  const task = await prisma.task.create({
    data: {
      ...data,
      assigneeId,
      dueDate: new Date(data.dueDate),
      tags:     { create: tags.map(tag => ({ tag })) },
      subtasks: { create: subtasks },
    },
    include: TASK_INCLUDE,
  });

  // Notify assignee if different from creator (fire-and-forget)
  if (assigneeId && assigneeId !== req.agentId) {
    const creator = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } }).catch(() => null)
    const creatorName = creator?.email?.split('@')[0] || 'Admin'
    notifSvc.notifyTaskAssigned(task, assigneeId, creatorName).catch(() => {})
  }

  created(res, mapTask(task));
});

exports.getById = catchAsync(async (req, res) => {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, isDeleted: false },
    include: TASK_INCLUDE,
  });
  if (!task) throw AppError.notFound('Task');
  success(res, mapTask(task));
});

exports.update = catchAsync(async (req, res) => {
  const { subtasks, tags, ...data } = req.body;
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!existing) throw AppError.notFound('Task');

  const task = await prisma.$transaction(async (tx) => {
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (tags !== undefined) {
      await tx.taskTag.deleteMany({ where: { taskId: req.params.id } });
      await tx.taskTag.createMany({ data: tags.map(tag => ({ taskId: req.params.id, tag })) });
    }
    if (subtasks !== undefined) {
      // Upsert subtasks: update existing (by id), create new ones
      for (const s of subtasks) {
        if (s.id) {
          await tx.taskSubtask.update({ where: { id: s.id }, data: { done: s.done } });
        } else {
          await tx.taskSubtask.create({ data: { taskId: req.params.id, label: s.label, done: s.done || false } });
        }
      }
    }
    return tx.task.update({ where: { id: req.params.id }, data, include: TASK_INCLUDE });
  });
  success(res, mapTask(task));
});

exports.complete = catchAsync(async (req, res) => {
  const { proof } = req.body;
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, isDeleted: false },
    include: { assignee: { select: { name: true } } },
  });
  if (!existing) throw AppError.notFound('Task');

  const task = await prisma.$transaction(async (tx) => {
    await tx.taskSubtask.updateMany({ where: { taskId: req.params.id }, data: { done: true } });
    return tx.task.update({
      where: { id: req.params.id },
      data: { status: 'completed', daysOverdue: 0 },
      include: TASK_INCLUDE,
    });
  });

  // Notify all active admins by email
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { email: true },
  });

  if (admins.length) {
    const assigneeName = existing.assignee?.name || 'A user';
    const dueStr = existing.dueDate ? new Date(existing.dueDate).toLocaleDateString() : 'N/A';
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#10b981;margin-bottom:8px">✅ Task Completed</h2>
        <p style="color:#374151"><strong>${assigneeName}</strong> has completed the following task:</p>
        <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:12px 16px;margin:16px 0;border-radius:4px">
          <strong style="font-size:16px">${existing.title}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;color:#374151">
          <tr><td style="padding:6px 0;color:#6b7280;width:120px">Priority</td><td style="padding:6px 0"><strong>${existing.priority}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Category</td><td style="padding:6px 0"><strong>${existing.category}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Due Date</td><td style="padding:6px 0"><strong>${dueStr}</strong></td></tr>
          ${proof ? `<tr><td style="padding:6px 0;color:#6b7280">Notes</td><td style="padding:6px 0">${proof}</td></tr>` : ''}
        </table>
      </div>`;

    await Promise.all(
      admins.map(a => sendMail(a.email, `Task Completed: ${existing.title}`, html).catch(console.error))
    );
  }

  success(res, { ...mapTask(task), proof: proof || null });
});

exports.archive = catchAsync(async (req, res) => {
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, isDeleted: false } });
  if (!existing) throw AppError.notFound('Task');
  await prisma.task.update({ where: { id: req.params.id }, data: { isDeleted: true } });
  success(res, { message: 'Task archived' });
});

exports.getOverdue = catchAsync(async (req, res) => {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      ...taskAgentFilter(req),
      isDeleted: false,
      status: { in: ['not_started', 'in_progress'] },
      dueDate: { lt: now },
    },
    orderBy: { dueDate: 'asc' },
    include: TASK_INCLUDE,
  });
  success(res, tasks.map(mapTask));
});

exports.autoGenerate = catchAsync(async (req, res) => {
  const { dealId, leadId, template } = req.body;

  const templates = {
    deal_offer_to_close: [
      { title: 'Schedule inspection', priority: 'high', daysFromNow: 3 },
      { title: 'Order appraisal',     priority: 'high', daysFromNow: 7 },
      { title: 'Confirm financing',   priority: 'high', daysFromNow: 14 },
      { title: 'Prepare closing docs', priority: 'critical', daysFromNow: 21 },
    ],
    lead_qualification: [
      { title: 'Day 1 contact call',   priority: 'high',   daysFromNow: 1 },
      { title: 'Day 3 follow-up',      priority: 'medium', daysFromNow: 3 },
      { title: 'Send property recs',   priority: 'medium', daysFromNow: 7 },
      { title: 'Schedule showing',     priority: 'high',   daysFromNow: 14 },
    ],
  };

  const steps = templates[template];
  if (!steps) throw AppError.badRequest(`Unknown template: ${template}`);

  const tasks = await Promise.all(steps.map(step => {
    const due = new Date();
    due.setDate(due.getDate() + step.daysFromNow);
    return prisma.task.create({
      data: {
        title:      step.title,
        category:   dealId ? 'Deal' : 'Lead',
        priority:   step.priority,
        status:     'not_started',
        dueDate:    due,
        dealId:     dealId || null,
        leadId:     leadId || null,
        assigneeId: req.agentId,
        workflowTemplate: template,
      },
    });
  }));

  success(res, { generated: tasks.length, tasks });
});
