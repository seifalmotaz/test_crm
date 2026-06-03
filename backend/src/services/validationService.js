/**
 * Validation Service
 *
 * Business-rule validation beyond what Zod handles at the schema level.
 *
 * RULES:
 *  Email  — format + uniqueness + common-typo correction suggestions
 *  Phone  — format normalisation + uniqueness
 *  Price  — min/max + >$100K reduction requires manager approval
 *  Budget — budgetMin <= budgetMax, reasonable for market
 *  Timeline — future, max 5 years, <30 days = high-priority flag
 */

const { prisma }   = require('../config/database');
const { AppError } = require('../utils/AppError');

// ─── Email ────────────────────────────────────────────────────────────────────

// Common domain typos (left = typo, right = correct)
const DOMAIN_CORRECTIONS = {
  'gmai.com':      'gmail.com',
  'gmial.com':     'gmail.com',
  'gmail.co':      'gmail.com',
  'gamil.com':     'gmail.com',
  'yahooo.com':    'yahoo.com',
  'yaho.com':      'yahoo.com',
  'hotmai.com':    'hotmail.com',
  'hotmial.com':   'hotmail.com',
  'outllook.com':  'outlook.com',
  'outlok.com':    'outlook.com',
  'iclod.com':     'icloud.com',
  'icoud.com':     'icloud.com',
};

function checkEmailTypo(email) {
  const [, domain] = email.toLowerCase().split('@');
  if (!domain) return null;
  const suggestion = DOMAIN_CORRECTIONS[domain];
  if (!suggestion) return null;
  const [local] = email.split('@');
  return `${local}@${suggestion}`;
}

async function validateEmail(email, excludeLeadId) {
  const normalised = email.trim().toLowerCase();
  const result     = { email: normalised, valid: true, warnings: [] };

  // Typo detection
  const corrected = checkEmailTypo(normalised);
  if (corrected) result.warnings.push({ type: 'POSSIBLE_TYPO', suggestion: corrected });

  // Uniqueness check in leads table
  const existingLead = await prisma.lead.findFirst({
    where: {
      email:     { equals: normalised, mode: 'insensitive' },
      isDeleted: false,
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (existingLead) {
    result.valid         = false;
    result.duplicate     = existingLead;
    result.duplicateType = 'lead';
  }

  // Uniqueness in clients table
  const existingClient = await prisma.client.findFirst({
    where:  { email: { equals: normalised, mode: 'insensitive' }, isDeleted: false },
    select: { id: true, name: true },
  });
  if (existingClient && !result.duplicate) {
    result.warnings.push({ type: 'CLIENT_EMAIL_EXISTS', client: existingClient });
  }

  return result;
}

// ─── Phone ────────────────────────────────────────────────────────────────────

function normalisePhone(phone) {
  // Strip all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned;
}

async function validatePhone(phone, excludeLeadId) {
  const normalised = normalisePhone(phone);
  const result = { phone: normalised, valid: true, warnings: [] };

  if (normalised.replace('+', '').length < 7) {
    result.valid = false;
    result.error = 'Phone number too short (minimum 7 digits)';
    return result;
  }

  const existing = await prisma.lead.findFirst({
    where: {
      phone:     normalised,
      isDeleted: false,
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
    },
    select: { id: true, name: true },
  });

  if (existing) {
    result.valid     = false;
    result.duplicate = existing;
  }

  return result;
}

// ─── Price ────────────────────────────────────────────────────────────────────

const PRICE_MIN = 0;
const PRICE_MAX = 999_000_000;
const LARGE_REDUCTION = 100_000;

function validatePrice(newPrice, currentPrice, requesterRole) {
  if (newPrice < PRICE_MIN || newPrice > PRICE_MAX) {
    throw AppError.badRequest(`Price must be between $${PRICE_MIN.toLocaleString()} and $${PRICE_MAX.toLocaleString()}`);
  }

  if (currentPrice != null) {
    const reduction = currentPrice - newPrice;
    if (reduction > LARGE_REDUCTION && !['admin', 'manager'].includes(requesterRole)) {
      const err = AppError.forbidden(
        `Price reductions over $${LARGE_REDUCTION.toLocaleString()} require manager approval`
      );
      err.code          = 'REQUIRES_MANAGER_APPROVAL';
      err.reduction     = reduction;
      err.currentPrice  = currentPrice;
      err.newPrice      = newPrice;
      throw err;
    }
    return {
      valid:            true,
      reduction:        Math.max(0, reduction),
      requiresApproval: reduction > LARGE_REDUCTION,
    };
  }

  return { valid: true, reduction: 0, requiresApproval: false };
}

// ─── Budget ───────────────────────────────────────────────────────────────────

// "Reasonable for market" is a soft warning, not an error (thresholds are configurable)
const MARKET_MIN = 50_000;
const MARKET_MAX = 50_000_000;

function validateBudget(budgetMin, budgetMax) {
  const warnings = [];

  if (budgetMin > budgetMax) {
    throw AppError.badRequest('Budget min cannot exceed budget max');
  }

  if (budgetMax > 0 && budgetMax < MARKET_MIN) {
    warnings.push({ type: 'LOW_BUDGET', message: `Budget of $${budgetMax.toLocaleString()} may be below market minimum` });
  }
  if (budgetMin > MARKET_MAX) {
    warnings.push({ type: 'ULTRA_HIGH_BUDGET', message: 'Budget exceeds typical market range — confirm with client' });
  }

  return { valid: true, warnings };
}

// ─── Timeline ────────────────────────────────────────────────────────────────

const MAX_TIMELINE_DAYS = 5 * 365; // 5 years

function validateTimeline(timelineDays) {
  const warnings = [];

  if (timelineDays <= 0) {
    throw AppError.badRequest('Timeline must be a positive number of days');
  }
  if (timelineDays > MAX_TIMELINE_DAYS) {
    throw AppError.badRequest(`Timeline cannot exceed ${MAX_TIMELINE_DAYS} days (5 years)`);
  }

  const isHighPriority = timelineDays < 30;
  if (isHighPriority) {
    warnings.push({
      type:     'HIGH_PRIORITY',
      message:  `Timeline of ${timelineDays} days is under 30 — lead should be treated as high priority`,
    });
  }

  return {
    valid:          true,
    isHighPriority,
    warnings,
  };
}

// ─── Composite: validate a full lead body ─────────────────────────────────────

async function validateLeadBody(body, excludeLeadId) {
  const [emailResult, phoneResult] = await Promise.all([
    validateEmail(body.email, excludeLeadId),
    body.phone ? validatePhone(body.phone, excludeLeadId) : Promise.resolve({ valid: true, warnings: [] }),
  ]);

  const budgetResult   = (body.budgetMin != null && body.budgetMax != null)
    ? validateBudget(body.budgetMin, body.budgetMax ?? body.budget ?? body.budgetMin)
    : { valid: true, warnings: [] };

  const timelineResult = body.timeline != null
    ? validateTimeline(body.timeline)
    : { valid: true, isHighPriority: false, warnings: [] };

  const errors = [];
  if (!emailResult.valid)  errors.push({ field: 'email',  ...emailResult });
  if (!phoneResult.valid)  errors.push({ field: 'phone',  ...phoneResult });

  const allWarnings = [
    ...emailResult.warnings,
    ...phoneResult.warnings,
    ...budgetResult.warnings,
    ...timelineResult.warnings,
  ];

  return {
    valid:           errors.length === 0,
    errors,
    warnings:        allWarnings,
    isHighPriority:  timelineResult.isHighPriority,
    emailNormalised: emailResult.email,
    phoneNormalised: phoneResult.phone,
  };
}

module.exports = {
  DOMAIN_CORRECTIONS,
  LARGE_REDUCTION,
  MAX_TIMELINE_DAYS,
  checkEmailTypo,
  validateEmail,
  normalisePhone,
  validatePhone,
  validatePrice,
  validateBudget,
  validateTimeline,
  validateLeadBody,
};
