import { Injectable } from '@nestjs/common';
import { eq, and, ilike, count, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { commissionPlans } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import type { CommissionPlanFiltersDto } from './dto/commission-plan-filters.dto';
import type { CommissionPlanResponseDto } from './dto/commission-plan-response.dto';

@Injectable()
export class CommissionPlansService {
  async findAll(
    tenantId: string,
    filters: CommissionPlanFiltersDto,
  ): Promise<{ data: CommissionPlanResponseDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const { page, limit, isDefault, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(commissionPlans.tenantId, tenantId),
      isNull(commissionPlans.deletedAt),
    ];

    if (isDefault !== undefined) {
      conditions.push(eq(commissionPlans.isDefault, isDefault));
    }
    if (search) {
      conditions.push(ilike(commissionPlans.name, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(commissionPlans)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const data = await db
      .select()
      .from(commissionPlans)
      .where(whereClause)
      .orderBy(commissionPlans.createdAt)
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data, total, page, limit);
  }

  async findById(tenantId: string, id: string): Promise<typeof commissionPlans.$inferSelect> {
    const [plan] = await db
      .select()
      .from(commissionPlans)
      .where(and(eq(commissionPlans.id, id), eq(commissionPlans.tenantId, tenantId), isNull(commissionPlans.deletedAt)))
      .limit(1);

    if (!plan) {
      throw new AppError(ErrorCodes.COMMISSION_PLAN_NOT_FOUND, 404, 'Commission plan not found');
    }

    return plan;
  }

  async findDefaultForTenant(tenantId: string): Promise<typeof commissionPlans.$inferSelect | null> {
    const [plan] = await db
      .select()
      .from(commissionPlans)
      .where(and(eq(commissionPlans.tenantId, tenantId), eq(commissionPlans.isDefault, true), isNull(commissionPlans.deletedAt)))
      .limit(1);

    return plan ?? null;
  }
}
