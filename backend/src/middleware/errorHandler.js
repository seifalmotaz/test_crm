const { ERROR_CODES } = require('../utils/AppError');

function errorHandler(err, req, res, _next) {
  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `A record with this ${err.meta?.target?.join(', ')} already exists`,
      },
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const first = err.errors?.[0];
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed',
        details: err.errors,
      },
    });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${process.env.MAX_FILE_SIZE_MB || 25}MB limit` },
    });
  }

  // JWT errors (malformed token etc.)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }

  // Operational errors thrown via AppError
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: ERROR_CODES[err.statusCode] || 'ERROR',
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Unexpected errors
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err);
  } else {
    console.error('[ERROR]', err.message);
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

module.exports = errorHandler;
