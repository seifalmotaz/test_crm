const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

// Soft-delete guard — automatically injects `isDeleted: false` into every read
// operation on models that support soft deletion, unless the caller has already
// set `isDeleted` explicitly (e.g. a retention job querying { isDeleted: true }).
//
// findUnique is converted to findFirst so the extra filter can be appended;
// the semantics are identical when the where clause includes a unique field (id).
//
// NOTE: $use is deprecated in Prisma 5 in favour of prisma.$extends. Migrate
// when upgrading beyond 5.x.

const SOFT_DELETE_MODELS = new Set(['Property', 'Lead', 'Deal', 'Client', 'Task']);
const GUARDED_READS      = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count']);

prisma.$use(async (params, next) => {
  if (!params.model || !SOFT_DELETE_MODELS.has(params.model) || !GUARDED_READS.has(params.action)) {
    return next(params);
  }

  params.args       = params.args       || {};
  params.args.where = params.args.where || {};

  if (!('isDeleted' in params.args.where)) {
    params.args.where.isDeleted = false;
  }

  if (params.action === 'findUnique')        params.action = 'findFirst';
  if (params.action === 'findUniqueOrThrow') params.action = 'findFirstOrThrow';

  return next(params);
});

module.exports = { prisma };
