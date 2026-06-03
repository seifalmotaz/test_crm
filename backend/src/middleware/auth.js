const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const ROLE_HIERARCHY = { admin: 4, manager: 3, agent: 2, staff: 1 };

function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}

const authenticate = catchAsync(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw AppError.unauthorized();

  const token = header.slice(7);
  const payload = verifyToken(token, process.env.JWT_SECRET);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { agent: true },
  });

  if (!user || !user.isActive) throw AppError.unauthorized('Account not found or deactivated');

  req.user = user;
  req.agentId = user.agent?.id || null;
  next();
});

// Factory: require minimum role level
function requireRole(...roles) {
  return (req, _res, next) => {
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const minLevel = Math.max(...roles.map(r => ROLE_HIERARCHY[r] || 0));
    if (userLevel < minLevel) throw AppError.forbidden();
    next();
  };
}

// Apply RLS: build a where-clause filter based on caller's role
function agentFilter(req) {
  if (['admin', 'manager'].includes(req.user.role)) return {};
  // Agent with no profile yet — return impossible filter so queries return empty
  if (!req.agentId) return { id: '__no_profile__' };
  return { agentId: req.agentId };
}

module.exports = { authenticate, requireRole, agentFilter };
