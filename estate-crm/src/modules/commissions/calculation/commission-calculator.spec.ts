import { describe, it, expect } from 'vitest';
import { calculateCommission } from './commission-calculator';
import type { CalculationInput } from './commission-calculator';

describe('calculateCommission', () => {
  it('percentage: $999,999.99 × 2.5% × 65% = exactly 1,625,000¢ agent (rounded up from 1,624,999.99¢)', () => {
    const input: CalculationInput = {
      dealValueCents: 99_999_999, // $999,999.99
      agentCommissionSplit: 0.65,
      plan: {
        type: 'percentage',
        rate: '0.0250',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    // base = round(99,999,999 × 0.025) = round(2,499,999.975) = 2,500,000
    // agent = floor(2,500,000 × 0.65) = floor(1,625,000) = 1,625,000
    // brokerage = 2,500,000 - 1,625,000 = 875,000
    expect(result.calculatedAmountCents).toBe(2_500_000);
    expect(result.agentPayoutAmountCents).toBe(1_625_000);
    expect(result.brokerageAmountCents).toBe(875_000);
    expect(result.appliedRate).toBe(0.025);
    expect(result.planType).toBe('percentage');
  });

  it('percentage: rounds at the end, not at intermediate steps', () => {
    // dealValue = $333,333.33, rate = 3.3333%, split = 50%
    // base = round(33,333,333 × 0.033333) = round(1,111,099.99...) = 1,111,100
    // agent = floor(1,111,100 × 0.5) = 555,550
    const input: CalculationInput = {
      dealValueCents: 33_333_333,
      agentCommissionSplit: 0.5,
      plan: {
        type: 'percentage',
        rate: '0.033333',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    expect(result.calculatedAmountCents).toBe(1_111_100);
    expect(result.agentPayoutAmountCents).toBe(555_550);
    expect(result.brokerageAmountCents).toBe(555_550);
  });

  it('flat: $5M deal, flat $10,000, split 70% → agent $7,000, brokerage $3,000', () => {
    const input: CalculationInput = {
      dealValueCents: 500_000_000,
      agentCommissionSplit: 0.7,
      plan: {
        type: 'flat',
        rate: null,
        flatAmount: 1_000_000, // $10,000 in cents
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    expect(result.calculatedAmountCents).toBe(1_000_000);
    expect(result.agentPayoutAmountCents).toBe(700_000);
    expect(result.brokerageAmountCents).toBe(300_000);
    expect(result.planType).toBe('flat');
  });

  it('tiered: deal $1M in [0, $5M @ 3%] tier → base $30,000', () => {
    const input: CalculationInput = {
      dealValueCents: 100_000_000, // $1M
      agentCommissionSplit: 0.5,
      plan: {
        type: 'tiered',
        rate: null,
        flatAmount: null,
        tierConfig: [
          { minValue: 0, maxValue: 500_000_000, rate: 0.03 },
          { minValue: 500_000_000, maxValue: 1_000_000_000, rate: 0.025 },
        ],
      },
    };
    const result = calculateCommission(input);
    // base = round(100,000,000 × 0.03) = 3,000,000
    expect(result.calculatedAmountCents).toBe(3_000_000);
    expect(result.agentPayoutAmountCents).toBe(1_500_000);
    expect(result.brokerageAmountCents).toBe(1_500_000);
    expect(result.appliedRate).toBe(0.03);
    expect(result.planType).toBe('tiered');
  });

  it('tiered: deal $5M boundary falls in [$5M, $10M @ 2.5%] tier → base $125,000', () => {
    const input: CalculationInput = {
      dealValueCents: 500_000_000, // $5M — boundary, falls in second tier (maxValue exclusive)
      agentCommissionSplit: 0.5,
      plan: {
        type: 'tiered',
        rate: null,
        flatAmount: null,
        tierConfig: [
          { minValue: 0, maxValue: 500_000_000, rate: 0.03 },
          { minValue: 500_000_000, maxValue: 1_000_000_000, rate: 0.025 },
        ],
      },
    };
    const result = calculateCommission(input);
    // base = round(500,000,000 × 0.025) = 12,500,000
    expect(result.calculatedAmountCents).toBe(12_500_000);
    expect(result.appliedRate).toBe(0.025);
  });

  it('tiered: no matching tier throws', () => {
    const input: CalculationInput = {
      dealValueCents: 2_000_000_000, // $20M — above all tiers
      agentCommissionSplit: 0.5,
      plan: {
        type: 'tiered',
        rate: null,
        flatAmount: null,
        tierConfig: [
          { minValue: 0, maxValue: 500_000_000, rate: 0.03 },
          { minValue: 500_000_000, maxValue: 1_000_000_000, rate: 0.025 },
        ],
      },
    };
    expect(() => calculateCommission(input)).toThrow('No matching tier');
  });

  it('agent split = 0 → agent payout = 0, brokerage = base', () => {
    const input: CalculationInput = {
      dealValueCents: 100_000_000,
      agentCommissionSplit: 0,
      plan: {
        type: 'percentage',
        rate: '0.0500',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    expect(result.calculatedAmountCents).toBe(5_000_000);
    expect(result.agentPayoutAmountCents).toBe(0);
    expect(result.brokerageAmountCents).toBe(5_000_000);
  });

  it('agent split = 1 → agent payout = base, brokerage = 0', () => {
    const input: CalculationInput = {
      dealValueCents: 100_000_000,
      agentCommissionSplit: 1,
      plan: {
        type: 'percentage',
        rate: '0.0500',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    expect(result.calculatedAmountCents).toBe(5_000_000);
    expect(result.agentPayoutAmountCents).toBe(5_000_000);
    expect(result.brokerageAmountCents).toBe(0);
  });

  it('rate = 0 → all amounts = 0', () => {
    const input: CalculationInput = {
      dealValueCents: 100_000_000,
      agentCommissionSplit: 0.5,
      plan: {
        type: 'percentage',
        rate: '0.0000',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    expect(result.calculatedAmountCents).toBe(0);
    expect(result.agentPayoutAmountCents).toBe(0);
    expect(result.brokerageAmountCents).toBe(0);
  });

  it('dealValue = 0 → all amounts = 0', () => {
    const input: CalculationInput = {
      dealValueCents: 0,
      agentCommissionSplit: 0.5,
      plan: {
        type: 'percentage',
        rate: '0.0500',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    expect(result.calculatedAmountCents).toBe(0);
    expect(result.agentPayoutAmountCents).toBe(0);
    expect(result.brokerageAmountCents).toBe(0);
  });

  it('rate = 0.9999 (max precision) → no float drift', () => {
    const input: CalculationInput = {
      dealValueCents: 1_000_000, // $10,000
      agentCommissionSplit: 0.5,
      plan: {
        type: 'percentage',
        rate: '0.9999',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    // base = round(1,000,000 × 0.9999) = round(999,900) = 999,900
    expect(result.calculatedAmountCents).toBe(999_900);
    expect(result.agentPayoutAmountCents).toBe(499_950);
    expect(result.brokerageAmountCents).toBe(499_950);
  });

  it('large value: $100M × 5% × 50% → no overflow', () => {
    const input: CalculationInput = {
      dealValueCents: 10_000_000_000, // $100M
      agentCommissionSplit: 0.5,
      plan: {
        type: 'percentage',
        rate: '0.0500',
        flatAmount: null,
        tierConfig: null,
      },
    };
    const result = calculateCommission(input);
    // base = round(10,000,000,000 × 0.05) = 500,000,000
    expect(result.calculatedAmountCents).toBe(500_000_000);
    expect(result.agentPayoutAmountCents).toBe(250_000_000);
    expect(result.brokerageAmountCents).toBe(250_000_000);
  });
});
