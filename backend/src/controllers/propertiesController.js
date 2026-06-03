const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const { prisma } = require('../config/database');
const { success, created, list } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { agentFilter } = require('../middleware/auth');
const cache = require('../utils/cache');

const propertyService    = require('../services/propertyService');
const auditSvc           = require('../services/auditService');
const notificationSvc    = require('../services/notificationService');
const ensureAgentProfile = require('../utils/ensureAgentProfile');

const upload = multer({
  dest:       path.join(__dirname, '../../uploads'),
  limits:     { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new AppError(400, 'Only image files allowed'));
    cb(null, true);
  },
});

const createSchema = z.object({
  address:      z.string().min(5),
  neighborhood: z.string().min(1),
  type:         z.enum(['Apartment', 'Villa', 'Commercial', 'Townhouse', 'Land']),
  price:        z.number().min(0).max(999_000_000),
  beds:         z.number().int().min(0).optional().default(0),
  baths:        z.number().int().min(0).optional().default(0),
  sqft:         z.number().int().min(0).optional().default(0),
  yearBuilt:    z.number().int().min(1800).max(2030).optional(),
  description:  z.string().optional(),
  agentId:      z.string().optional(),
  tags:         z.array(z.string()).optional().default([]),
  concerns:     z.array(z.string()).optional().default([]),
});

const PROPERTY_INCLUDE = {
  agent:    { select: { id: true, name: true, avatar: true, color: true } },
  tags:     { select: { tag: true } },
  comps:    true,
  concerns: { select: { concern: true } },
};

function mapProperty(p) {
  return {
    ...p,
    tags:     p.tags?.map(t => t.tag)     || [],
    concerns: p.concerns?.map(c => c.concern) || [],
  };
}

function buildFilter(q, agentF) {
  const where = { ...agentF, isDeleted: false };
  if (q.status)        where.status       = q.status;
  if (q.type)          where.type         = q.type;
  if (q.neighborhood)  where.neighborhood = { contains: q.neighborhood, mode: 'insensitive' };
  if (q.location)      where.address      = { contains: q.location,     mode: 'insensitive' };
  if (q.minPrice || q.maxPrice) {
    where.price = {};
    if (q.minPrice) where.price.gte = parseFloat(q.minPrice);
    if (q.maxPrice) where.price.lte = parseFloat(q.maxPrice);
  }
  return where;
}

exports.list = catchAsync(async (req, res) => {
  const { page, perPage, skip } = parsePagination(req.query);
  const validSorts = { price: 'price', created_at: 'createdAt', views: 'views' };
  const orderBy = { [validSorts[req.query.sort] || 'createdAt']: req.query.order === 'asc' ? 'asc' : 'desc' };
  const where   = buildFilter(req.query, agentFilter(req));

  const [total, rows] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where, skip, take: perPage, orderBy,
      include: { agent: { select: { id: true, name: true } }, tags: { select: { tag: true } } },
    }),
  ]);

  const ids = rows.map(r => r.id);
  const coverFiles = ids.length ? await prisma.file.findMany({
    where:   { entityType: 'property', entityId: { in: ids } },
    orderBy: { createdAt: 'asc' },
    select:  { entityId: true, url: true },
  }) : [];
  const coverMap = {};
  for (const f of coverFiles) {
    if (!coverMap[f.entityId]) coverMap[f.entityId] = f.url;
  }

  list(res, rows.map(r => ({ ...mapProperty(r), coverUrl: coverMap[r.id] || null })), buildPaginationMeta(page, perPage, total));
});

exports.create = catchAsync(async (req, res) => {
  const body    = createSchema.parse(req.body);
  const agentId = await ensureAgentProfile(req, body.agentId);
  if (!agentId) throw AppError.badRequest('agentId is required');

  const { tags, concerns, ...data } = body;
  const property = await prisma.property.create({
    data: {
      ...data,
      agentId,
      tags:     { create: tags.map(tag => ({ tag })) },
      concerns: { create: concerns.map(concern => ({ concern })) },
    },
    include: PROPERTY_INCLUDE,
  });

  cache.invalidatePattern('properties:');
  created(res, mapProperty(property));
});

exports.getById = catchAsync(async (req, res) => {
  const property = await prisma.property.findFirst({
    where:   { id: req.params.id, isDeleted: false, ...agentFilter(req) },
    include: PROPERTY_INCLUDE,
  });
  if (!property) throw AppError.notFound('Property');
  success(res, mapProperty(property));
});

exports.update = catchAsync(async (req, res) => {
  const { version, tags, concerns, ...data } = req.body;

  const existing = await prisma.property.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!existing) throw AppError.notFound('Property');
  if (typeof version !== 'number') throw AppError.badRequest('version is required');
  if (existing.version !== version) throw AppError.versionConflict();

  // ── Authorization: only listing agent or manager/admin ───────────────────
  propertyService.assertCanModify(existing, req.user.role, req.agentId);

  // ── Price change rules + audit ───────────────────────────────────────────
  if (data.price !== undefined && data.price !== existing.price) {
    propertyService.assertPriceUpdateAllowed(existing, data.price, req.user.role);
    auditSvc.logPriceChange(auditSvc.fromRequest(req), req.params.id, existing.price, data.price).catch(() => {});
  }

  const property = await prisma.$transaction(async (tx) => {
    if (tags !== undefined) {
      await tx.propertyTag.deleteMany({ where: { propertyId: req.params.id } });
      await tx.propertyTag.createMany({ data: tags.map(tag => ({ propertyId: req.params.id, tag })) });
    }
    if (concerns !== undefined) {
      await tx.propertyConcern.deleteMany({ where: { propertyId: req.params.id } });
      await tx.propertyConcern.createMany({ data: concerns.map(concern => ({ propertyId: req.params.id, concern })) });
    }
    return tx.property.update({
      where:   { id: req.params.id },
      data:    { ...data, version: { increment: 1 } },
      include: PROPERTY_INCLUDE,
    });
  });

  cache.invalidatePattern('properties:');
  success(res, mapProperty(property));
});

// ── Status transition (FSM-enforced) ─────────────────────────────────────────
// POST /api/properties/:id/status   body: { status, dealId? }
exports.changeStatus = catchAsync(async (req, res) => {
  const { status, dealId } = req.body;
  const validStatuses = Object.keys(propertyService.VALID_TRANSITIONS);
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const updated = await propertyService.transitionStatus(req.params.id, status, {
    dealId,
    requesterRole:    req.user.role,
    requesterAgentId: req.agentId,
  });

  auditSvc.logPropertyStatusChange(
    auditSvc.fromRequest(req), req.params.id,
    /* we don't have the old status without re-fetching; transitionStatus handles it */
    null, status
  ).catch(() => {});

  // New listing alert when going from any status → Active (re-listed or fresh)
  if (status === 'Active') {
    prisma.property.findFirst({ where: { id: req.params.id, isDeleted: false } })
      .then(p => p && notificationSvc.notifyNewListing(p))
      .catch(() => {});
  }

  cache.invalidatePattern('properties:');
  success(res, { id: updated.id, status: updated.status, version: updated.version });
});

// ── View tracking ─────────────────────────────────────────────────────────────
// POST /api/properties/:id/view
exports.recordView = catchAsync(async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!property) throw AppError.notFound('Property');

  const result = await propertyService.recordView(req.params.id);
  success(res, result);
  // result.alert carries the HOT_PROPERTY payload when threshold is crossed;
  // deliver via push notification or email in a production webhook handler
});

exports.softDelete = catchAsync(async (req, res) => {
  const existing = await prisma.property.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!existing) throw AppError.notFound('Property');
  await prisma.property.update({ where: { id: req.params.id }, data: { isDeleted: true } });
  cache.invalidatePattern('properties:');
  success(res, { message: 'Property archived' });
});

exports.getComps = catchAsync(async (req, res) => {
  const property = await prisma.property.findFirst({
    where:   { id: req.params.id, isDeleted: false },
    include: { comps: true },
  });
  if (!property) throw AppError.notFound('Property');
  success(res, property.comps);
});

exports.getMarketAnalysis = catchAsync(async (req, res) => {
  const property = await prisma.property.findFirst({
    where:   { id: req.params.id, isDeleted: false },
    include: { comps: true, concerns: true, agent: { select: { name: true } } },
  });
  if (!property) throw AppError.notFound('Property');

  const compsAvgPrice = property.comps.length
    ? property.comps.reduce((s, c) => s + c.price, 0) / property.comps.length
    : property.price;

  success(res, {
    property:      { id: property.id, address: property.address, price: property.price },
    compsAvgPrice,
    priceVsComps:  property.comps.length
      ? ((property.price - compsAvgPrice) / compsAvgPrice * 100).toFixed(1)
      : 0,
    appreciationYoY: property.appreciationYoY,
    recommendation:  property.recommendation,
    concerns:        property.concerns.map(c => c.concern),
    comps:           property.comps,
  });
});

exports.uploadPhotos = [
  upload.array('photos', 20),
  catchAsync(async (req, res) => {
    if (!req.files?.length) throw AppError.badRequest('No files uploaded');
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, isDeleted: false },
    });
    if (!property) throw AppError.notFound('Property');

    const files = await prisma.file.createMany({
      data: req.files.map(f => ({
        filename:     f.filename,
        originalName: f.originalname,
        mimeType:     f.mimetype,
        size:         f.size,
        url:          `/uploads/${f.filename}`,
        entityType:   'property',
        entityId:     req.params.id,
        uploadedById: req.user.id,
      })),
    });

    success(res, { uploaded: files.count, files: req.files.map(f => `/uploads/${f.filename}`) });
  }),
];
