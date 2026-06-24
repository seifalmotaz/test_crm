import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedUser } from '@/common/types/auth.types';

// Mock only the db module — the calculator is not needed for these tests
vi.mock('@/db/connection', () => {
  const select = vi.fn();
  return {
    db: {
      select,
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

function makeChain(resolveValue: any) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(resolveValue),
  };
}

function makeCountChain(resolveValue: any) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(resolveValue),
  };
}

function makeFindChain(resolveValue: any) {
  return {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
  };
}

describe('CommissionRecordsService', () => {
  let service: CommissionRecordsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./commission-records.service');
    service = new mod.CommissionRecordsService();
  });

  describe('list() — role-based filtering', () => {
    it('agent sees only their own records (agentId filter forced)', async () => {
      const agentUser: AuthenticatedUser = {
        id: 'agent-1',
        tenantId: 'tenant-1',
        role: 'agent',
        name: 'Agent One',
        email: 'agent1@test.com',
        isSuperAdmin: false,
      };

      const { db } = await import('@/db/connection');
      (db.select as any)
        .mockReturnValueOnce(makeCountChain([{ count: 0 }]))
        .mockReturnValueOnce(makeChain([]));

      const result = await service.list('tenant-1', agentUser, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('manager/admin sees all records in tenant', async () => {
      const managerUser: AuthenticatedUser = {
        id: 'manager-1',
        tenantId: 'tenant-1',
        role: 'manager',
        name: 'Manager',
        email: 'manager@test.com',
        isSuperAdmin: false,
      };

      const { db } = await import('@/db/connection');
      (db.select as any)
        .mockReturnValueOnce(makeCountChain([{ count: 5 }]))
        .mockReturnValueOnce(makeChain([]));

      const result = await service.list('tenant-1', managerUser, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.meta.total).toBe(5);
    });
  });

  describe('findById() — role-based filtering', () => {
    it('agent can find their own record', async () => {
      const agentUser: AuthenticatedUser = {
        id: 'agent-1',
        tenantId: 'tenant-1',
        role: 'agent',
        name: 'Agent One',
        email: 'agent1@test.com',
        isSuperAdmin: false,
      };

      const { db } = await import('@/db/connection');
      (db.select as any).mockReturnValueOnce(makeFindChain([
        {
          record: {
            id: 'record-1',
            tenantId: 'tenant-1',
            dealId: 'deal-1',
            agentId: 'agent-1',
            propertyId: null,
            planId: 'plan-1',
            calculatedAmount: 2_500_000,
            brokerageAmount: 875_000,
            agentPayoutAmount: 1_625_000,
            status: 'calculated',
            calculatedAt: new Date(),
            createdAt: new Date(),
          },
          plan: { id: 'plan-1', name: 'Standard', type: 'percentage', rate: '0.0250' },
          agent: { id: 'agent-1', name: 'Agent One', email: 'agent1@test.com', commissionSplit: '0.65' },
          property: null,
        },
      ]));

      const result = await service.findById('tenant-1', 'record-1', agentUser);
      expect(result.id).toBe('record-1');
      expect(result.agentId).toBe('agent-1');
      expect(result.plan).toBeDefined();
      expect(result.plan?.name).toBe('Standard');
      expect(result.agent).toBeDefined();
      expect(result.agent?.name).toBe('Agent One');
    });

    it('agent cannot find another agent\'s record (returns 404)', async () => {
      const agentUser: AuthenticatedUser = {
        id: 'agent-1',
        tenantId: 'tenant-1',
        role: 'agent',
        name: 'Agent One',
        email: 'agent1@test.com',
        isSuperAdmin: false,
      };

      const { db } = await import('@/db/connection');
      (db.select as any).mockReturnValueOnce(makeFindChain([]));

      await expect(
        service.findById('tenant-1', 'record-other', agentUser),
      ).rejects.toThrow('Commission record not found');
    });
  });
});
