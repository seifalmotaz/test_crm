/**
 * Pure commission calculator — no NestJS, no DB, no side effects.
 * All amounts are integer cents. Arithmetic is plain Number (no Decimal.js).
 *
 * Math rules (MUST follow exactly):
 *   1. percentage: base = round(dealValue × rate); split by agent.commissionSplit
 *   2. flat:       base = flatAmount; split by agent.commissionSplit
 *   3. tiered:     find tier where dealValue falls; base = round(dealValue × tier.rate); split
 *   4. agentPayout = floor(base × split)  ← floor in agent's favor to avoid over-promising
 *   5. brokerage   = base - agentPayout   ← derived to ensure sum equals base
 */

export interface CalculationInput {
  dealValueCents: number;           // integer cents (deals.value)
  agentCommissionSplit: number;     // decimal 0-1, e.g. 0.6500 (users.commissionSplit)
  plan: {
    type: 'percentage' | 'flat' | 'tiered';
    rate: string | null;             // decimal as string from Drizzle, e.g. '0.0250'
    flatAmount: number | null;      // integer cents
    tierConfig: Array<{ minValue: number; maxValue: number; rate: number }> | null;
  };
}

export interface CalculationOutput {
  calculatedAmountCents: number;    // integer cents
  agentPayoutAmountCents: number;    // integer cents
  brokerageAmountCents: number;     // integer cents
  appliedRate: number;              // decimal for response (e.g. 0.025)
  planType: 'percentage' | 'flat' | 'tiered';
}

/**
 * Calculate commission amounts in integer cents.
 *
 * IMPORTANT: Use plain integer arithmetic. NO Decimal.js. Round ONCE at the
 * final multiplication. Use Number() to convert rate string to number.
 */
export function calculateCommission(input: CalculationInput): CalculationOutput {
  const { dealValueCents, agentCommissionSplit, plan } = input;

  let base: number;
  let appliedRate: number;

  switch (plan.type) {
    case 'percentage': {
      const rate = plan.rate !== null ? Number(plan.rate) : 0;
      appliedRate = rate;
      base = Math.round(dealValueCents * rate);
      break;
    }
    case 'flat': {
      base = plan.flatAmount ?? 0;
      appliedRate = 0; // flat plans don't have a meaningful rate
      break;
    }
    case 'tiered': {
      const tiers = plan.tierConfig;
      if (!tiers || tiers.length === 0) {
        throw new Error('Tiered plan has no tier configuration');
      }
      const tier = tiers.find(
        (t) => dealValueCents >= t.minValue && dealValueCents < t.maxValue,
      );
      if (!tier) {
        throw new Error(
          `No matching tier for deal value ${dealValueCents}. Tiers: ${JSON.stringify(tiers)}`,
        );
      }
      appliedRate = tier.rate;
      base = Math.round(dealValueCents * tier.rate);
      break;
    }
    default: {
      // Exhaustiveness check — should never happen
      const _exhaustive: never = plan.type;
      throw new Error(`Unknown plan type: ${_exhaustive}`);
    }
  }

  // agentPayout = floor(base × split) — floor ensures the brokerage absorbs any rounding remainder (agent receives less than their mathematical share; brokerage gets the extra cents)
  const agentPayoutAmountCents = Math.floor(base * agentCommissionSplit);
  // brokerage = base - agentPayout — derived to ensure sum equals base
  const brokerageAmountCents = base - agentPayoutAmountCents;

  return {
    calculatedAmountCents: base,
    agentPayoutAmountCents,
    brokerageAmountCents,
    appliedRate,
    planType: plan.type,
  };
}
