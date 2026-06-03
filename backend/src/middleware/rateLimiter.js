const rateLimit = require('express-rate-limit');

function limiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message },
    }),
  });
}

const globalLimiter   = limiter(60_000, 200, 'Too many requests');
const authLimiter     = limiter(60_000,  10, 'Too many auth attempts. Try again in 1 minute.');
// Refresh tokens are called automatically by the client on every access-token expiry,
// so allow more headroom than authLimiter while still blocking brute-force attempts.
const refreshLimiter  = limiter(60_000,  30, 'Too many token refresh attempts. Try again in 1 minute.');
const uploadLimiter   = limiter(60_000,  10, 'Upload rate limit exceeded');
const listLimiter     = limiter(60_000,  50, 'List endpoint rate limit exceeded');

module.exports = { globalLimiter, authLimiter, refreshLimiter, uploadLimiter, listLimiter };
