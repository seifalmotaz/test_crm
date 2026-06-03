'use strict'

// Mock DB and notifications so the module loads without a live connection.
// None of the pure functions under test touch these — the mocks just prevent
// PrismaClient instantiation and outbound HTTP at require time.
jest.mock('../src/config/database', () => ({ prisma: {} }))
jest.mock('../src/services/notificationService', () => ({
  notifyDealStageAdvanced: jest.fn().mockResolvedValue(undefined),
  notifyDealClosed:        jest.fn().mockResolvedValue(undefined),
}))

const {
  STAGE_ORDER,
  STAGE_PROBABILITY,
  LUXURY_THRESHOLD,
  INFERRED_RATE,
  assertValidStageTransition,
  assertNotLocked,
  calculateProbability,
  calculateCommission,
  classifyDeal,
} = require('../src/services/dealService')

// ─── assertValidStageTransition ───────────────────────────────────────────────

describe('assertValidStageTransition — valid forward moves', () => {
  it('allows each consecutive forward step in STAGE_ORDER', () => {
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      expect(() => assertValidStageTransition(STAGE_ORDER[i], STAGE_ORDER[i + 1])).not.toThrow()
    }
  })

  it('always allows moving to lost from any stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(() => assertValidStageTransition(stage, 'lost')).not.toThrow()
    }
  })
})

describe('assertValidStageTransition — backward moves are rejected', () => {
  it('rejects offer ← negotiation', () => {
    expect(() => assertValidStageTransition('negotiation', 'offer')).toThrow(/backward/i)
  })

  it('rejects inspection ← closing', () => {
    expect(() => assertValidStageTransition('closing', 'inspection')).toThrow(/backward/i)
  })

  it('rejects closed ← offer', () => {
    expect(() => assertValidStageTransition('closed', 'offer')).toThrow(/backward/i)
  })
})

describe('assertValidStageTransition — skipping stages is rejected', () => {
  it('rejects offer → inspection (skips negotiation)', () => {
    expect(() => assertValidStageTransition('offer', 'inspection')).toThrow(/skip/i)
  })

  it('rejects offer → closed (skips 4 stages)', () => {
    expect(() => assertValidStageTransition('offer', 'closed')).toThrow(/skip/i)
  })

  it('rejects negotiation → appraisal (skips inspection)', () => {
    expect(() => assertValidStageTransition('negotiation', 'appraisal')).toThrow(/skip/i)
  })
})

describe('assertValidStageTransition — invalid stage names', () => {
  it('rejects an entirely unknown target stage', () => {
    expect(() => assertValidStageTransition('offer', 'signed')).toThrow(/invalid stage/i)
  })

  it('rejects an entirely unknown current stage', () => {
    expect(() => assertValidStageTransition('draft', 'offer')).toThrow(/invalid stage/i)
  })
})

// ─── assertNotLocked ──────────────────────────────────────────────────────────

describe('assertNotLocked', () => {
  const closingDeal = { stage: 'closing' }
  const offerDeal   = { stage: 'offer' }

  it('throws for agent role when deal is in closing stage', () => {
    expect(() => assertNotLocked(closingDeal, 'agent')).toThrow(/locked/i)
  })

  it('does not throw for manager role when deal is in closing stage', () => {
    expect(() => assertNotLocked(closingDeal, 'manager')).not.toThrow()
  })

  it('does not throw for admin role when deal is in closing stage', () => {
    expect(() => assertNotLocked(closingDeal, 'admin')).not.toThrow()
  })

  it('does not throw for any role when deal is not in closing stage', () => {
    for (const role of ['agent', 'manager', 'admin']) {
      expect(() => assertNotLocked(offerDeal, role)).not.toThrow()
    }
  })
})

// ─── calculateProbability ─────────────────────────────────────────────────────

describe('calculateProbability — stage base values', () => {
  it('returns 0 for lost', () => {
    expect(calculateProbability('lost', {})).toBe(0)
  })

  it('returns 100 for closed', () => {
    expect(calculateProbability('closed', {})).toBe(100)
  })

  it('returns base probability at offer with no adjustments', () => {
    expect(calculateProbability('offer', { progress: {}, daysUntilClose: 20 }))
      .toBe(STAGE_PROBABILITY.offer)
  })

  it('returns base probability at closing with no adjustments', () => {
    expect(calculateProbability('closing', { progress: {}, daysUntilClose: 20 }))
      .toBe(STAGE_PROBABILITY.closing)
  })
})

describe('calculateProbability — situational deductions', () => {
  const base = { progress: {}, daysUntilClose: 20 }

  it('deducts 20 pts when appraisalGapPct > 10', () => {
    const withGap = { progress: { appraisalGapPct: '15' }, daysUntilClose: 20 }
    const normal  = calculateProbability('inspection', base)
    const gapped  = calculateProbability('inspection', withGap)
    expect(normal - gapped).toBe(20)
  })

  it('deducts 15 pts when hasInspectionIssues is true', () => {
    const withIssues = { progress: { hasInspectionIssues: true }, daysUntilClose: 20 }
    const normal     = calculateProbability('inspection', base)
    const issues     = calculateProbability('inspection', withIssues)
    expect(normal - issues).toBe(15)
  })

  it('deducts 5 pts when missingDocuments is true', () => {
    const withMissing = { progress: { missingDocuments: true }, daysUntilClose: 20 }
    const normal      = calculateProbability('inspection', base)
    const missing     = calculateProbability('inspection', withMissing)
    expect(normal - missing).toBe(5)
  })

  it('stacks multiple deductions', () => {
    const worst  = { progress: { hasInspectionIssues: true, missingDocuments: true }, daysUntilClose: 20 }
    const normal = calculateProbability('inspection', base)
    const bad    = calculateProbability('inspection', worst)
    expect(normal - bad).toBe(20) // 15 + 5
  })

  it('deducts 5 pts for closing pressure (daysUntilClose ≤ 7)', () => {
    const urgent = { progress: {}, daysUntilClose: 3 }
    const normal = calculateProbability('inspection', base)
    const rushed = calculateProbability('inspection', urgent)
    expect(normal - rushed).toBe(5)
  })

  it('deducts 10 pts when daysUntilClose > 45 (deal dragging)', () => {
    const dragging = { progress: {}, daysUntilClose: 60 }
    const normal   = calculateProbability('inspection', base)
    const slow     = calculateProbability('inspection', dragging)
    expect(normal - slow).toBe(10)
  })

  it('never returns below 0', () => {
    const catastrophic = {
      progress: { appraisalGapPct: '50', hasInspectionIssues: true, missingDocuments: true },
      daysUntilClose: 100,
    }
    expect(calculateProbability('offer', catastrophic)).toBe(0)
  })
})

// ─── classifyDeal ─────────────────────────────────────────────────────────────

describe('classifyDeal', () => {
  it('classifies as investment when dealType contains "investment"', () => {
    expect(classifyDeal(10_000_000, 'Investment Property')).toBe('investment')
    expect(classifyDeal(100_000, 'investment')).toBe('investment')
  })

  it('classifies as luxury when value > LUXURY_THRESHOLD and not investment', () => {
    expect(classifyDeal(LUXURY_THRESHOLD + 1, 'residential')).toBe('luxury')
    expect(classifyDeal(8_000_000, 'Penthouse')).toBe('luxury')
  })

  it('classifies as standard for value ≤ LUXURY_THRESHOLD and not investment', () => {
    expect(classifyDeal(LUXURY_THRESHOLD, 'residential')).toBe('standard')
    expect(classifyDeal(500_000, 'condo')).toBe('standard')
  })

  it('uses the LUXURY_THRESHOLD constant correctly', () => {
    expect(LUXURY_THRESHOLD).toBe(5_000_000)
  })
})

// ─── calculateCommission ──────────────────────────────────────────────────────

describe('calculateCommission — rate selection', () => {
  it('applies standard rate (5%) for a sub-luxury residential deal', () => {
    const result = calculateCommission(1_000_000, 'residential', null)
    expect(result.category).toBe('standard')
    expect(result.ratePct).toBe(INFERRED_RATE.standard)
    expect(result.total).toBe(1_000_000 * (INFERRED_RATE.standard / 100))
  })

  it('applies luxury rate (4.5%) when value exceeds $5M', () => {
    const result = calculateCommission(6_000_000, 'residential', null)
    expect(result.category).toBe('luxury')
    expect(result.ratePct).toBe(INFERRED_RATE.luxury)
    expect(result.total).toBe(6_000_000 * (INFERRED_RATE.luxury / 100))
  })

  it('applies investment rate (3%) when dealType contains "investment"', () => {
    const result = calculateCommission(2_000_000, 'investment', null)
    expect(result.category).toBe('investment')
    expect(result.ratePct).toBe(INFERRED_RATE.investment)
    expect(result.total).toBe(2_000_000 * (INFERRED_RATE.investment / 100))
  })

  it('uses storedRate over inferred rate when storedRate > 0', () => {
    const result = calculateCommission(1_000_000, 'residential', 6)
    expect(result.ratePct).toBe(6)
    expect(result.total).toBe(60_000)
  })

  it('falls back to inferred rate when storedRate is 0 or null', () => {
    const withNull = calculateCommission(1_000_000, 'residential', null)
    const withZero = calculateCommission(1_000_000, 'residential', 0)
    expect(withNull.ratePct).toBe(INFERRED_RATE.standard)
    expect(withZero.ratePct).toBe(INFERRED_RATE.standard)
  })
})

describe('calculateCommission — result shape', () => {
  it('includes dealValue, category, ratePct, rateDisplay, total, totalDisplay', () => {
    const result = calculateCommission(500_000, 'condo', null)
    expect(result).toMatchObject({
      dealValue:    500_000,
      category:     'standard',
      ratePct:      expect.any(Number),
      rateDisplay:  expect.stringMatching(/%$/),
      total:        expect.any(Number),
      totalDisplay: expect.stringMatching(/^\$/),
    })
  })

  it('does not include split when splitCommission is false (default)', () => {
    const result = calculateCommission(500_000, 'condo', null, false)
    expect(result.split).toBeUndefined()
  })

  it('includes split breakdown when splitCommission is true', () => {
    const result = calculateCommission(1_000_000, 'residential', null, true)
    expect(result.split).toBeDefined()
    expect(result.split.listingAgent).toBeCloseTo(result.split.sellingAgent)
    expect(result.split.listingAgent).toBeGreaterThan(0)
    expect(result.split.display).toMatch(/^\$/)
  })

  it('split total equals 5% of deal value (2.5% each side)', () => {
    const value  = 2_000_000
    const result = calculateCommission(value, 'residential', null, true)
    expect(result.split.listingAgent).toBeCloseTo(value * 0.025)
    expect(result.split.sellingAgent).toBeCloseTo(value * 0.025)
  })
})

describe('calculateCommission — INFERRED_RATE constants', () => {
  it('standard rate is 5.0%', () => {
    expect(INFERRED_RATE.standard).toBe(5.0)
  })

  it('luxury rate is 4.5%', () => {
    expect(INFERRED_RATE.luxury).toBe(4.5)
  })

  it('investment rate is 3.0%', () => {
    expect(INFERRED_RATE.investment).toBe(3.0)
  })
})
