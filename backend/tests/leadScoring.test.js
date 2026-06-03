'use strict'

// calculateScore is pure (no DB access) — no mocks needed
const { calculateScore, SCORE, MAX_ACTIVE_LEADS } = require('../src/services/leadService')

describe('calculateScore — base', () => {
  it('starts at 50 for a bare minimum lead', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { score, breakdown } = calculateScore(lead, 0)
    expect(score).toBe(50)
    expect(breakdown.base).toBe(50)
  })

  it('caps at 100', () => {
    const lead = { budgetMin: 500000, preApproved: true, timeline: 30, location: 'NYC', interest: 'condo' }
    const { score } = calculateScore(lead, 100)
    expect(score).toBe(100)
  })
})

describe('calculateScore — budget component', () => {
  it('adds 15 pts when budgetMin > 0', () => {
    const lead = { budgetMin: 1, preApproved: false, timeline: 999, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.budgetConfirmed).toBe(SCORE.budgetConfirmed)
  })

  it('adds 15 pts when preApproved even if budgetMin is 0', () => {
    const lead = { budgetMin: 0, preApproved: true, timeline: 999, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.budgetConfirmed).toBe(SCORE.budgetConfirmed)
  })

  it('adds 0 when no budget and not pre-approved', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.budgetConfirmed).toBe(0)
  })
})

describe('calculateScore — timeline component', () => {
  it('adds full 20 pts for timeline ≤ 90 days', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 90, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.timeline).toBe(SCORE.timeline)
  })

  it('adds 10 pts (half) for timeline 91–180 days', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 120, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.timeline).toBe(Math.round(SCORE.timeline / 2))
  })

  it('adds 0 pts for timeline > 180 days', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 181, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.timeline).toBe(0)
  })
})

describe('calculateScore — engagement component', () => {
  it('adds 0 engagement pts with 0 interactions', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.engagement).toBe(0)
  })

  it('adds proportional pts for 1 interaction (≈ 3.3 pts)', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 1)
    expect(breakdown.engagement).toBe(Math.round((1 / 3) * SCORE.engagement))
  })

  it('adds full 10 engagement pts at 3+ interactions', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { breakdown } = calculateScore(lead, 3)
    expect(breakdown.engagement).toBe(SCORE.engagement)
  })

  it('caps engagement at 3 interactions (more does not help)', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { breakdown: at3  } = calculateScore(lead, 3)
    const { breakdown: at10 } = calculateScore(lead, 10)
    expect(at3.engagement).toBe(at10.engagement)
  })
})

describe('calculateScore — propertyMatch component', () => {
  it('adds 5 pts when both location and interest are present', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: 'Miami', interest: 'condo' }
    const { breakdown } = calculateScore(lead, 0)
    expect(breakdown.propertyMatch).toBe(SCORE.propertyMatch)
  })

  it('adds 0 pts when either location or interest is missing', () => {
    const noLoc = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: 'condo' }
    const noInt = { budgetMin: 0, preApproved: false, timeline: 999, location: 'Miami', interest: null }
    expect(calculateScore(noLoc, 0).breakdown.propertyMatch).toBe(0)
    expect(calculateScore(noInt, 0).breakdown.propertyMatch).toBe(0)
  })
})

describe('calculateScore — tier thresholds', () => {
  it('fully qualified lead (score ≥ 80) is immediate tier', () => {
    // budget + full timeline + 3 interactions + prefs = 50+15+20+10+5 = 100
    const lead = { budgetMin: 200000, preApproved: false, timeline: 30, location: 'NYC', interest: 'house' }
    const { score } = calculateScore(lead, 3)
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('lead with only budget confirmed sits at 65 (standard tier)', () => {
    const lead = { budgetMin: 100000, preApproved: false, timeline: 999, location: null, interest: null }
    const { score } = calculateScore(lead, 0)
    expect(score).toBe(65)
  })

  it('bare lead scores 50 (pool tier — below auto-assignment threshold of 60)', () => {
    const lead = { budgetMin: 0, preApproved: false, timeline: 999, location: null, interest: null }
    const { score } = calculateScore(lead, 0)
    expect(score).toBe(50)
  })
})

describe('constants', () => {
  it('MAX_ACTIVE_LEADS is 15', () => {
    expect(MAX_ACTIVE_LEADS).toBe(15)
  })

  it('score components sum to 100', () => {
    const total = SCORE.base + SCORE.budgetConfirmed + SCORE.timeline + SCORE.engagement + SCORE.propertyMatch
    expect(total).toBe(100)
  })
})
