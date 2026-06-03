// Wraps async route handlers so unhandled rejections flow to errorHandler
function catchAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = catchAsync;
