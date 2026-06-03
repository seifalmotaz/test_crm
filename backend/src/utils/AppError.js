class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const ERROR_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

AppError.badRequest = (msg, details) => new AppError(400, msg, details);
AppError.unauthorized = (msg = 'Authentication required') => new AppError(401, msg);
AppError.forbidden = (msg = 'Insufficient permissions') => new AppError(403, msg);
AppError.notFound = (resource = 'Resource') => new AppError(404, `${resource} not found`);
AppError.conflict = (msg) => new AppError(409, msg);
AppError.versionConflict = () => new AppError(409, 'Resource was modified by another request. Refresh and try again.');

module.exports = { AppError, ERROR_CODES };
