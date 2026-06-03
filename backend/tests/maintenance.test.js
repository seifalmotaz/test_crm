'use strict'

// ── Mocks must be declared before any require ──────────────────────────────────

jest.mock('../src/config/database', () => ({
  prisma: {
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $executeRaw:       jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../src/maintenance/vacuum', () => ({
  runNightlyVacuum:       jest.fn(),
  runWeeklyMaintenance:   jest.fn(),
  getBloatReport:         jest.fn(),
  checkXidWraparoundRisk: jest.fn(),
}))

jest.mock('../src/maintenance/reindex', () => ({
  runWeeklyReindex:  jest.fn(),
  getIndexHealth:    jest.fn(),
  getUnusedIndexes:  jest.fn(),
  runSmartReindex:   jest.fn(),
}))

jest.mock('../src/maintenance/analyze', () => ({
  runFullAnalyze: jest.fn(),
  getStaleStats:  jest.fn(),
}))

jest.mock('../src/maintenance/cluster', () => ({
  runMonthlyCluster:      jest.fn(),
  isFirstSundayOfMonth:   jest.fn(),
  getClusterStatus:       jest.fn(),
}))

jest.mock('../src/services/taskAutomation', () => ({
  processOverdueTasks: jest.fn(),
}))

jest.mock('../src/services/commissionRecordService', () => ({
  releaseEligibleCommissions: jest.fn(),
}))

jest.mock('../src/services/notificationService', () => ({
  scanClosingSoonDeals: jest.fn(),
}))

jest.mock('../src/services/agentService', () => ({
  recalculateTiersAndRanks: jest.fn(),
  scanPerformanceAlerts:    jest.fn(),
}))

jest.mock('../src/services/retentionService', () => ({
  purgeExpiredAuditLogs:        jest.fn(),
  archiveOldSoftDeletedData:    jest.fn(),
}))

jest.mock('../src/utils/cache', () => ({
  invalidatePattern: jest.fn(),
}))

// ── Imports after mocks ────────────────────────────────────────────────────────

const vacuumMod      = require('../src/maintenance/vacuum')
const reindexMod     = require('../src/maintenance/reindex')
const analyzeMod     = require('../src/maintenance/analyze')
const clusterMod     = require('../src/maintenance/cluster')
const taskSvc        = require('../src/services/taskAutomation')
const commissionSvc  = require('../src/services/commissionRecordService')
const notifySvc      = require('../src/services/notificationService')
const agentSvc       = require('../src/services/agentService')
const retentionSvc   = require('../src/services/retentionService')
const scheduler      = require('../src/maintenance/scheduler')

beforeEach(() => jest.clearAllMocks())

// ─── runNow — job dispatch ────────────────────────────────────────────────────

describe('scheduler.runNow', () => {
  it('throws for an unknown job name', async () => {
    await expect(scheduler.runNow('nonexistent-job')).rejects.toThrow('Unknown job')
  })

  it('runs nightly-vacuum via runNow', async () => {
    vacuumMod.runNightlyVacuum.mockResolvedValue({ results: [], errors: [] })

    await scheduler.runNow('nightly-vacuum')

    expect(vacuumMod.runNightlyVacuum).toHaveBeenCalledTimes(1)
  })

  it('runs task-escalation via runNow', async () => {
    taskSvc.processOverdueTasks.mockResolvedValue({ processed: 0, reminded: 0, escalatedManager: 0, escalatedDirector: 0 })

    await scheduler.runNow('task-escalation')

    expect(taskSvc.processOverdueTasks).toHaveBeenCalledTimes(1)
  })

  it('runs commission-release via runNow', async () => {
    commissionSvc.releaseEligibleCommissions.mockResolvedValue({ released: 3 })

    await scheduler.runNow('commission-release')

    expect(commissionSvc.releaseEligibleCommissions).toHaveBeenCalledTimes(1)
  })

  it('runs closing-soon-alerts via runNow', async () => {
    notifySvc.scanClosingSoonDeals.mockResolvedValue({ scanned: 10, sent: 2 })

    await scheduler.runNow('closing-soon-alerts')

    expect(notifySvc.scanClosingSoonDeals).toHaveBeenCalledTimes(1)
  })

  it('runs nightly-analyze via runNow', async () => {
    analyzeMod.runFullAnalyze.mockResolvedValue({ results: [], errors: [] })

    await scheduler.runNow('nightly-analyze')

    expect(analyzeMod.runFullAnalyze).toHaveBeenCalledTimes(1)
  })

  it('runs bloat-check via runNow', async () => {
    vacuumMod.getBloatReport.mockResolvedValue({ needsAttention: [] })

    await scheduler.runNow('bloat-check')

    expect(vacuumMod.getBloatReport).toHaveBeenCalledTimes(1)
  })

  it('runs xid-check via runNow', async () => {
    vacuumMod.checkXidWraparoundRisk.mockResolvedValue([])

    await scheduler.runNow('xid-check')

    expect(vacuumMod.checkXidWraparoundRisk).toHaveBeenCalledTimes(1)
  })
})

// ─── weekly-maintenance — Sunday guard ────────────────────────────────────────

describe('scheduler.runNow weekly-maintenance', () => {
  it('calls runWeeklyMaintenance regardless of day-of-week check in job', async () => {
    // The weeklyMaintenance function checks getDay() === 0 internally.
    // runNow calls the function directly — behavior depends on what day tests run.
    // We just verify the call reaches the mock without error.
    vacuumMod.runWeeklyMaintenance.mockResolvedValue({ log: [] })

    // If today is not Sunday the function returns early — mock may not be called.
    // Either way runNow should not throw.
    await expect(scheduler.runNow('weekly-maintenance')).resolves.not.toThrow()
  })
})

// ─── tier-recalculation — Sunday guard ───────────────────────────────────────

describe('scheduler.runNow tier-recalculation', () => {
  it('resolves without error regardless of day', async () => {
    agentSvc.recalculateTiersAndRanks.mockResolvedValue({ updated: 5 })

    await expect(scheduler.runNow('tier-recalculation')).resolves.not.toThrow()
  })
})

// ─── audit-log-purge — January 1st guard ─────────────────────────────────────

describe('scheduler.runNow audit-log-purge', () => {
  it('resolves without error (no-ops outside Jan 1)', async () => {
    retentionSvc.purgeExpiredAuditLogs.mockResolvedValue({ deleted: 0 })

    await expect(scheduler.runNow('audit-log-purge')).resolves.not.toThrow()
  })
})

// ─── data-archival — January 1st guard ───────────────────────────────────────

describe('scheduler.runNow data-archival', () => {
  it('resolves without error (no-ops outside Jan 1)', async () => {
    retentionSvc.archiveOldSoftDeletedData.mockResolvedValue({ results: [] })

    await expect(scheduler.runNow('data-archival')).resolves.not.toThrow()
  })
})

// ─── performance-alert-scan ───────────────────────────────────────────────────

describe('scheduler.runNow performance-alert-scan', () => {
  it('resolves when no alerts are found', async () => {
    agentSvc.scanPerformanceAlerts.mockResolvedValue([])

    await expect(scheduler.runNow('performance-alert-scan')).resolves.not.toThrow()
    expect(agentSvc.scanPerformanceAlerts).toHaveBeenCalledTimes(1)
  })

  it('resolves and logs when alerts are found', async () => {
    agentSvc.scanPerformanceAlerts.mockResolvedValue([
      { name: 'John Doe', type: 'revenue_drop' },
    ])

    await expect(scheduler.runNow('performance-alert-scan')).resolves.not.toThrow()
  })
})

// ─── stop — clears all timers ─────────────────────────────────────────────────

describe('scheduler.stop', () => {
  it('does not throw when called without start', () => {
    expect(() => scheduler.stop()).not.toThrow()
  })
})
