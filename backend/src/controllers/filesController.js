const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { prisma } = require('../config/database');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024 },
});

exports.upload = [
  upload.single('file'),
  catchAsync(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No file uploaded');

    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) {
      throw AppError.badRequest('entityType and entityId are required');
    }

    const record = await prisma.file.create({
      data: {
        filename:     req.file.filename,
        originalName: req.file.originalname,
        mimeType:     req.file.mimetype,
        size:         req.file.size,
        url:          `/uploads/${req.file.filename}`,
        entityType,
        entityId,
        uploadedById: req.user.id,
      },
    });

    success(res, record, 201);
  }),
];

exports.getFile = catchAsync(async (req, res) => {
  const file = await prisma.file.findUnique({ where: { id: req.params.id } });
  if (!file) throw AppError.notFound('File');
  success(res, file);
});

exports.deleteFile = catchAsync(async (req, res) => {
  const file = await prisma.file.findUnique({ where: { id: req.params.id } });
  if (!file) throw AppError.notFound('File');

  const filePath = path.join(__dirname, '../../uploads', file.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await prisma.file.delete({ where: { id: req.params.id } });
  success(res, { message: 'File deleted' });
});

exports.listByEntity = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) throw AppError.badRequest('entityType and entityId are required');
  const files = await prisma.file.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
  success(res, files);
});
