const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const VALID_ROLES = ['admin', 'manager', 'agent', 'staff', 'sales_manager', 'team_leader', 'marketing', 'marketing_manager', 'sales_admin', 'quality_control'];

function validatePassword(password) {
  const failures = [];
  if (password.length < 8)             failures.push('at least 8 characters');
  if (!/[A-Z]/.test(password))        failures.push('one uppercase letter');
  if (!/[0-9]/.test(password))        failures.push('one digit');
  if (!/[!@#$%^&*()]/.test(password)) failures.push('one special character (!@#$%^&*())');
  return failures;
}

const SELECT = {
  id: true, email: true, role: true, isActive: true, createdAt: true, features: true, userQuota: true, createdById: true,
};

const ROLE_DEFAULTS = {
  admin:             ['leads','deals','properties','clients','messages','tasks','calendar','analytics','reports','market','documents','team','commissions','settings','security','audit'],
  manager:           ['leads','properties','deals','clients','messages','tasks','analytics','reports','calendar','documents','team','commissions','market'],
  agent:             ['leads','properties','deals','clients','messages','tasks','calendar'],
  staff:             ['leads','properties','clients','tasks'],
  sales_manager:     ['leads','properties','deals','clients','messages','tasks','calendar','analytics','team'],
  team_leader:       ['leads','properties','deals','clients','messages','tasks','calendar','analytics'],
  marketing:         ['leads','properties','clients','messages','tasks','calendar','market'],
  marketing_manager: ['leads','properties','clients','messages','tasks','calendar','analytics','reports','market'],
  sales_admin:       ['leads','properties','deals','clients','tasks','documents'],
  quality_control:   ['leads','deals','clients','tasks','analytics','reports'],
};

exports.list = catchAsync(async (req, res) => {
  // managers only see agents they created; admins see everyone
  const where = req.user.role === 'manager' ? { createdById: req.user.id } : {};
  const users = await prisma.user.findMany({
    where,
    select: SELECT,
    orderBy: { createdAt: 'asc' },
  });
  success(res, users);
});

exports.create = catchAsync(async (req, res) => {
  const isManager = req.user.role === 'manager';

  // managers can only create agents
  const role = isManager ? 'agent' : (req.body.role ?? 'agent');

  if (!req.body.email || !req.body.password) throw AppError.badRequest('Email and password are required');
  if (!VALID_ROLES.includes(role)) throw AppError.badRequest('Invalid role');

  // enforce quota for managers
  if (isManager) {
    const quota = req.user.userQuota;
    if (quota !== null && quota !== undefined) {
      const created = await prisma.user.count({ where: { createdById: req.user.id } });
      if (created >= quota) throw AppError.forbidden(`Agent creation limit of ${quota} reached`);
    }
  }

  const failures = validatePassword(req.body.password);
  if (failures.length) throw AppError.badRequest(`Password must contain: ${failures.join(', ')}.`);

  const exists = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (exists) throw AppError.conflict('A user with this email already exists');

  const hashed = await bcrypt.hash(req.body.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: req.body.email, password: hashed, role, createdById: isManager ? req.user.id : null },
      select: SELECT,
    });

    if (role === 'agent') {
      const namePart = req.body.email.split('@')[0].replace(/[._\-]/g, ' ');
      const name     = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const avatar   = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AG';
      await tx.agent.create({
        data: {
          userId:         created.id,
          name,
          avatar,
          email:          req.body.email,
          phone:          '',
          region:         '',
          specialization: 'Residential',
        },
      });
    }

    return created;
  });

  success(res, user, 201);
});

exports.updateRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!VALID_ROLES.includes(role)) throw AppError.badRequest('Invalid role');

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: SELECT,
  });
  success(res, user);
});

exports.toggleStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('User');

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: SELECT,
  });
  success(res, user);
});

exports.deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id }, include: { agent: true } });
  if (!existing) throw AppError.notFound('User');

  await prisma.$transaction(async (tx) => {
    // Remove commission adjustments approved by this user
    await tx.commissionAdjustment.deleteMany({ where: { approvedById: id } });

    if (existing.agent) {
      const agentId = existing.agent.id;

      // Collect IDs of all resources owned by this agent
      const [deals, leads, properties] = await Promise.all([
        tx.deal.findMany({ where: { agentId }, select: { id: true } }),
        tx.lead.findMany({ where: { agentId }, select: { id: true } }),
        tx.property.findMany({ where: { agentId }, select: { id: true } }),
      ]);
      const dealIds     = deals.map(d => d.id);
      const leadIds     = leads.map(l => l.id);
      const propertyIds = properties.map(p => p.id);

      // Null out FK refs from OTHER agents' deals pointing to this agent's leads/properties
      if (leadIds.length)
        await tx.deal.updateMany({ where: { leadId: { in: leadIds }, agentId: { not: agentId } }, data: { leadId: null } });
      if (propertyIds.length)
        await tx.deal.updateMany({ where: { propertyId: { in: propertyIds }, agentId: { not: agentId } }, data: { propertyId: null } });

      // Delete all tasks referencing this agent's resources
      await tx.task.deleteMany({
        where: {
          OR: [
            { assigneeId: agentId },
            ...(dealIds.length     ? [{ dealId:     { in: dealIds } }]     : []),
            ...(leadIds.length     ? [{ leadId:     { in: leadIds } }]     : []),
            ...(propertyIds.length ? [{ propertyId: { in: propertyIds } }] : []),
          ],
        },
      });

      // Delete commission records (and their adjustments) for this agent
      const commRecordIds = (await tx.commissionRecord.findMany({ where: { agentId }, select: { id: true } })).map(r => r.id);
      if (commRecordIds.length) {
        await tx.commissionAdjustment.deleteMany({ where: { commissionRecordId: { in: commRecordIds } } });
        await tx.commissionRecord.deleteMany({ where: { agentId } });
      }

      // Delete deals, leads, properties (child records cascade automatically)
      await tx.deal.deleteMany({ where: { agentId } });
      await tx.lead.deleteMany({ where: { agentId } });
      await tx.property.deleteMany({ where: { agentId } });

      await tx.agent.delete({ where: { id: agentId } });
    }

    await tx.user.delete({ where: { id } });
  });

  success(res, { id });
});

exports.updateQuota = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { quota } = req.body;

  if (quota !== null && (typeof quota !== 'number' || !Number.isInteger(quota) || quota < 1)) {
    throw AppError.badRequest('Quota must be a positive integer or null for unlimited');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { userQuota: quota },
    select: SELECT,
  });
  success(res, user);
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;
  const data = {};

  if (email) {
    const exists = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (exists) throw AppError.conflict('A user with this email already exists');
    data.email = email;
  }

  if (password) {
    const failures = validatePassword(password);
    if (failures.length) throw AppError.badRequest(`Password must contain: ${failures.join(', ')}.`);
    data.password = await bcrypt.hash(password, 12);
  }

  if (!Object.keys(data).length) throw AppError.badRequest('No fields to update');

  const user = await prisma.user.update({ where: { id }, data, select: SELECT });
  success(res, user);
});

exports.updateFeatures = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { features } = req.body;
  if (!Array.isArray(features)) throw AppError.badRequest('features must be an array');

  const user = await prisma.user.update({
    where: { id },
    data: { features },
    select: SELECT,
  });
  success(res, user);
});
