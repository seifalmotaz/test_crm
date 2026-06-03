/**
 * Commission Calculation Engine
 *
 * RATES (from deal management rules):
 *  Standard:   5.0% of final price
 *  Luxury:     4.5% (deal value > $5M)
 *  Investment: 3.0% (deal type contains "investment")
 *
 * SPLIT (when two agents involved):
 *  Listing agent:  2.5%
 *  Selling agent:  2.5%
 *
 * Additional rules (Section 6 — to be completed):
 *  [Commission disbursement schedule]
 *  [Clawback rules]
 *  [Referral fees]
 *  [Team splits]
 *  [Brokerage deductions]
 */

const { prisma } = require('../config/database');

// ─── Rate table ───────────────────────────────────────────────────────────────

const RATES = {
  standard:   5.0, // percent — e.g. 5.0 = 5%
  luxury:     4.5,
  investment: 3.0,
};

const SPLIT_RATE_EACH = 2.5; // percent per agent when deal is split

const LUXURY_THRESHOLD = 5_000_000;

// ─── Deal classification ──────────────────────────────────────────────────────

function classify(dealValue, dealType) {
  const t = (dealType ?? '').toLowerCase();
  if (t.includes('investment')) return 'investment';
  if (dealValue > LUXURY_THRESHOLD) return 'luxury';
  return 'standard';
}

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * @param {number} dealValue - final deal price
 * @param {string} dealType  - deal type string (e.g. 'residential', 'investment', 'luxury')
 * @param {object} opts
 * @param {number}  opts.overrideRate   - custom rate in percent (skips automatic classification)
 * @param {boolean} opts.split          - true if listing/selling agents split the commission
 * @param {string}  opts.listingAgentId - required when split=true
 * @param {string}  opts.sellingAgentId - required when split=true
 */
function calculate(dealValue, dealType, opts = {}) {
  const { overrideRate = null, split = false } = opts;

  const category = classify(dealValue, dealType);
  const ratePct  = overrideRate != null ? overrideRate : RATES[category];
  const total    = dealValue * (ratePct / 100);

  const result = {
    dealValue,
    category,
    ratePct,
    rateDisplay:  `${ratePct.toFixed(1)}%`,
    total,
    totalDisplay: `$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    split:        null,
  };

  if (split) {
    const perAgent = dealValue * (SPLIT_RATE_EACH / 100);
    result.split = {
      rateEach:       SPLIT_RATE_EACH,
      listingAgent:   perAgent,
      sellingAgent:   perAgent,
      display:        `$${perAgent.toLocaleString('en-US', { maximumFractionDigits: 0 })} each (2.5% + 2.5%)`,
    };
  }

  return result;
}

// ─── What-if preview (no DB writes) ──────────────────────────────────────────

function preview(dealValue, dealType) {
  return {
    standard:   calculate(dealValue, 'standard'),
    luxury:     dealValue > LUXURY_THRESHOLD ? calculate(dealValue, 'luxury') : null,
    investment: calculate(dealValue, 'investment'),
    split:      calculate(dealValue, dealType, { split: true }),
    applicable: calculate(dealValue, dealType),
    thresholds: {
      luxury:     LUXURY_THRESHOLD,
      luxuryNote: `Deals above $${LUXURY_THRESHOLD.toLocaleString()} qualify for ${RATES.luxury}% luxury rate`,
    },
  };
}

// ─── Finalize on deal close ───────────────────────────────────────────────────

async function finalizeDealCommission(dealId, opts = {}) {
  const deal = await prisma.deal.findUnique({
    where:  { id: dealId },
    select: { value: true, type: true, commissionRate: true },
  });
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const commission = calculate(deal.value, deal.type, {
    overrideRate: deal.commissionRate > 0 ? deal.commissionRate : null,
    split:        opts.split ?? false,
  });

  // Persist the resolved rate back to the deal record
  await prisma.deal.update({
    where: { id: dealId },
    data:  { commissionRate: commission.ratePct },
  });

  return commission;
}

module.exports = {
  RATES,
  SPLIT_RATE_EACH,
  LUXURY_THRESHOLD,
  classify,
  calculate,
  preview,
  finalizeDealCommission,
};
