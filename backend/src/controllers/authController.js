const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { prisma } = require('../config/database');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

function validatePasswordStrength(password) {
  const failures = [];
  if (password.length < 8)              failures.push('at least 8 characters');
  if (!/[A-Z]/.test(password))         failures.push('at least one uppercase letter');
  if (!/[0-9]/.test(password))         failures.push('at least one digit');
  if (!/[!@#$%^&*()]/.test(password))  failures.push('at least one special character (!@#$%^&*())');
  return failures;
}

const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().superRefine((val, ctx) => {
    const failures = validatePasswordStrength(val);
    if (failures.length) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: `Password must contain: ${failures.join(', ')}.`,
      });
    }
  }),
  role:     z.enum(['admin', 'manager', 'agent', 'staff']).optional().default('agent'),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function issueTokens(userId, role, agentId) {
  const payload = {
    iss: 'realestate-crm',
    sub: userId,
    role,
    ...(agentId && { agentId }),
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

const ROLE_FEATURE_DEFAULTS = {
  admin:   ['leads','deals','properties','clients','messages','tasks','calendar','analytics','reports','market','documents','team','commissions','settings','security','audit'],
  manager: ['leads','properties','deals','clients','messages','tasks','analytics','reports','calendar','documents','team','commissions','market'],
  agent:   ['leads','properties','deals','clients','messages','tasks','calendar'],
  staff:   ['leads','properties','clients','tasks'],
};

function safeUser(user) {
  const { password, ...rest } = user;
  if (!rest.features?.length) {
    rest.features = ROLE_FEATURE_DEFAULTS[rest.role] || ROLE_FEATURE_DEFAULTS.agent;
  }
  return rest;
}

exports.register = catchAsync(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const hashed = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: { email: body.email, password: hashed, role: body.role },
    include: { agent: true },
  });
  const tokens = issueTokens(user.id, user.role, user.agent?.id);
  success(res, { user: safeUser(user), ...tokens }, 201);
});

exports.login = catchAsync(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: { agent: true },
  });
  if (!user || !await bcrypt.compare(body.password, user.password)) {
    throw AppError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw AppError.unauthorized('Account is deactivated');

  const tokens = issueTokens(user.id, user.role, user.agent?.id);
  success(res, { user: safeUser(user), ...tokens });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw AppError.badRequest('Refresh token required');

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { agent: true },
  });
  if (!user || !user.isActive) throw AppError.unauthorized();

  const tokens = issueTokens(user.id, user.role, user.agent?.id);
  success(res, tokens);
});

exports.logout = catchAsync(async (_req, res) => {
  // JWT is stateless; client drops tokens. For revocation, add a token blocklist.
  success(res, { message: 'Logged out successfully' });
});

exports.me = catchAsync(async (req, res) => {
  success(res, safeUser(req.user));
});
