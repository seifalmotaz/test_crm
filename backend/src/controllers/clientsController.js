const { z } = require('zod');
const { prisma } = require('../config/database');
const { success, created, list } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const createSchema = z.object({
  name:      z.string().min(2),
  avatar:    z.string().optional().default('??'),
  color:     z.string().optional().default('#3b82f6'),
  type:      z.array(z.string()).optional().default(['buyer']),
  tier:      z.enum(['vip', 'high-value', 'regular']).optional().default('regular'),
  agentName: z.string().optional(),
  email:     z.string().email(),
  phone:     z.string().min(7),
  location:  z.string().min(1),
  tags:      z.array(z.string()).optional().default([]),
  notes:     z.string().optional(),
  preferredPropertyType: z.string().optional(),
  preferredLocation:     z.string().optional(),
  budgetMin: z.number().min(0).optional().default(0),
  budgetMax: z.number().min(0).optional().default(0),
});

const CLIENT_INCLUDE = {
  tags:         { select: { tag: true } },
  transactions: { orderBy: { date: 'desc' } },
};

function mapClient(c) {
  return { ...c, tags: c.tags?.map(t => t.tag) || [] };
}

function buildFilter(q) {
  const where = { isDeleted: false };
  if (q.tier)    where.tier   = q.tier;
  if (q.status)  where.status = q.status;
  if (q.search)  where.name   = { contains: q.search, mode: 'insensitive' };
  return where;
}

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const where = buildFilter(req.query);
  const orderBy = req.query.sort === 'ltv' ? { lifetimeValue: 'desc' } : { updatedAt: 'desc' };

  const [total, rows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where, skip, take: perPage, orderBy,
      include: { tags: { select: { tag: true } } },
    }),
  ]);
  list(res, rows.map(mapClient), buildPaginationMeta(page, perPage, total));
});

exports.create = catchAsync(async (req, res) => {
  const body = createSchema.parse(req.body);
  const { tags, ...data } = body;
  const client = await prisma.client.create({
    data: { ...data, tags: { create: tags.map(tag => ({ tag })) } },
    include: CLIENT_INCLUDE,
  });
  created(res, mapClient(client));
});

exports.getById = catchAsync(async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, isDeleted: false },
    include: CLIENT_INCLUDE,
  });
  if (!client) throw AppError.notFound('Client');
  success(res, mapClient(client));
});

exports.update = catchAsync(async (req, res) => {
  const { version, tags, ...data } = req.body;
  const existing = await prisma.client.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!existing) throw AppError.notFound('Client');
  if (typeof version !== 'number') throw AppError.badRequest('version is required');
  if (existing.version !== version) throw AppError.versionConflict();

  const client = await prisma.$transaction(async (tx) => {
    if (tags !== undefined) {
      await tx.clientTag.deleteMany({ where: { clientId: req.params.id } });
      await tx.clientTag.createMany({ data: tags.map(tag => ({ clientId: req.params.id, tag })) });
    }
    return tx.client.update({
      where: { id: req.params.id },
      data: { ...data, version: { increment: 1 } },
      include: CLIENT_INCLUDE,
    });
  });
  success(res, mapClient(client));
});

exports.getLifetimeValue = catchAsync(async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, isDeleted: false },
    include: { transactions: true },
  });
  if (!client) throw AppError.notFound('Client');

  const totalBought = client.transactions
    .filter(t => t.type === 'bought')
    .reduce((s, t) => s + t.value, 0);
  const totalProfit = client.transactions
    .filter(t => t.type === 'sold' && t.profit)
    .reduce((s, t) => s + (t.profit || 0), 0);

  success(res, {
    clientId: client.id,
    name:     client.name,
    lifetimeValue:      client.lifetimeValue,
    totalTransacted:    totalBought,
    totalProfitGenerated: totalProfit,
    transactionCount:   client.transactionCount,
    referralValue:      client.referralValue,
    referralCount:      client.referralCount,
    tier:               client.tier,
    nextTransactionLikelihood: client.nextTransactionLikelihood,
    nextTransactionValue:      client.nextTransactionValue,
  });
});

exports.addReferral = catchAsync(async (req, res) => {
  const { referredName, referredEmail, estimatedValue } = req.body;
  if (!referredName) throw AppError.badRequest('referredName is required');

  const client = await prisma.client.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!client) throw AppError.notFound('Client');

  const updated = await prisma.client.update({
    where: { id: req.params.id },
    data: {
      referralCount: { increment: 1 },
      referralValue: { increment: estimatedValue || 0 },
      version: { increment: 1 },
    },
  });

  success(res, {
    message: 'Referral tracked',
    referredName,
    referredEmail,
    estimatedValue: estimatedValue || 0,
    totalReferrals: updated.referralCount,
    totalReferralValue: updated.referralValue,
  });
});

exports.getVip = catchAsync(async (req, res) => {
  const clients = await prisma.client.findMany({
    where: { isDeleted: false, tier: 'vip' },
    orderBy: { lifetimeValue: 'desc' },
    include: { tags: { select: { tag: true } } },
  });
  success(res, clients.map(mapClient));
});
