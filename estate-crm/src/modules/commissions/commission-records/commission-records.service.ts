import { Injectable } from '@nestjs/common';
import { eq, and, count, isNull, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import {
  commissionRecords,
  commissionPlans,
  properties,
  projects,
  users,
  auditLogs,
  notifications,
} from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import { calculateCommission } from '../calculation/commission-calculator';
import type { AuthenticatedUser } from '@/common/types/auth.types';
import type { CommissionRecordFiltersDto } from './dto/commission-record-filters.dto';
import type { CommissionSummaryFiltersDto } from './dto/commission-summary.dto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/db/schema';

type DrizzleTx = PostgresJsDatabase<typeof schema>;

export interface CommissionCalculationResult {
  calculatedAmountCents: number;
  agentPayoutAmountCents: number;
  brokerageAmountCents: number;
  appliedRate: number;
  planType: 'percentage' | 'flat' | 'tiered';
}

@Injectable()
export class CommissionRecordsService {
  // ─── HTTP-facing methods ─────────────────────────────────

  async list(
    tenantId: string,
    user: AuthenticatedUser,
    filters: CommissionRecordFiltersDto,
  ) {
    const { page, limit, agentId, dateFrom, dateTo } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(commissionRecords.tenantId, tenantId),
    ];

    // Agent visibility: agents see only their own records
    if (user.role === 'agent') {
      conditions.push(eq(commissionRecords.agentId, user.id));
    } else if (agentId) {
      conditions.push(eq(commissionRecords.agentId, agentId));
    }

    if (dateFrom) {
      conditions.push(gte(commissionRecords.calculatedAt, new Date(dateFrom)) as any);
    }
    if (dateTo) {
      conditions.push(lte(commissionRecords.calculatedAt, new Date(dateTo)) as any);
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(commissionRecords)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const data = await db
      .select()
      .from(commissionRecords)
      .where(whereClause)
      .orderBy(sql`${commissionRecords.calculatedAt} desc`)
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data, total, page, limit);
  }

  async findById(tenantId: string, id: string, user: AuthenticatedUser) {
    const conditions: ReturnType<typeof eq>[] = [
      eq(commissionRecords.id, id),
      eq(commissionRecords.tenantId, tenantId),
    ];

    // Agent visibility: agents can only see their own records
    if (user.role === 'agent') {
      conditions.push(eq(commissionRecords.agentId, user.id));
    }

    const [row] = await db
      .select({
        record: commissionRecords,
        plan: commissionPlans,
        agent: { id: users.id, name: users.name, email: users.email, commissionSplit: users.commissionSplit },
        property: { id: properties.id, title: properties.title, address: properties.address },
      })
      .from(commissionRecords)
      .leftJoin(commissionPlans, eq(commissionRecords.planId, commissionPlans.id))
      .leftJoin(users, eq(commissionRecords.agentId, users.id))
      .leftJoin(properties, eq(commissionRecords.propertyId, properties.id))
      .where(and(...conditions, isNull(commissionPlans.deletedAt)))
      .limit(1);

    if (!row) {
      throw new AppError(ErrorCodes.COMMISSION_NOT_FOUND, 404, 'Commission record not found');
    }

    return {
      ...row.record,
      plan: row.plan
        ? { id: row.plan.id, name: row.plan.name, type: row.plan.type, rate: row.plan.rate }
        : null,
      agent: row.agent?.id
        ? { id: row.agent.id, name: row.agent.name, email: row.agent.email }
        : null,
      property: row.property?.id
        ? { id: row.property.id, title: row.property.title }
        : null,
    };
  }

  async summary(tenantId: string, filters: CommissionSummaryFiltersDto) {
    const { agentId, dateFrom, dateTo } = filters;

    const conditions: ReturnType<typeof eq>[] = [
      eq(commissionRecords.tenantId, tenantId),
    ];

    if (agentId) {
      conditions.push(eq(commissionRecords.agentId, agentId));
    }
    if (dateFrom) {
      conditions.push(gte(commissionRecords.calculatedAt, new Date(dateFrom)) as any);
    }
    if (dateTo) {
      conditions.push(lte(commissionRecords.calculatedAt, new Date(dateTo)) as any);
    }

    const whereClause = and(...conditions);

    const [result] = await db
      .select({
        totalCalculated: sql<number>`COALESCE(SUM(${commissionRecords.calculatedAmount}), 0)`,
        totalBrokerage: sql<number>`COALESCE(SUM(${commissionRecords.brokerageAmount}), 0)`,
        totalAgentPayout: sql<number>`COALESCE(SUM(${commissionRecords.agentPayoutAmount}), 0)`,
        count: count(),
      })
      .from(commissionRecords)
      .where(whereClause);

    return {
      totalCalculated: Number(result?.totalCalculated ?? 0),
      totalBrokerage: Number(result?.totalBrokerage ?? 0),
      totalAgentPayout: Number(result?.totalAgentPayout ?? 0),
      count: Number(result?.count ?? 0),
    };
  }

  async agentSummary(tenantId: string, agentId: string) {
    return this.summary(tenantId, { agentId });
  }

  // ─── Internal hook (called from DealsService.changeStage) ──

  /**
   * Resolve the commission plan for a deal using the chain:
   * property.commissionPlanId → project.commissionPlanId → tenant default plan.
   * Returns the plan ID or null if none resolves.
   */
  async resolvePlanForDeal(
    tx: DrizzleTx,
    deal: { tenantId: string; propertyId: string | null },
  ): Promise<{ planId: string | null; plan: typeof commissionPlans.$inferSelect | null }> {
    // 1. Resolve plan: property → project → tenant default
    let property: { commissionPlanId: string | null; projectId: string | null } | null = null;
    if (deal.propertyId) {
      const [p] = await tx
        .select({ commissionPlanId: properties.commissionPlanId, projectId: properties.projectId })
        .from(properties)
        .where(eq(properties.id, deal.propertyId))
        .limit(1);
      property = p ?? null;
    }

    let projectPlanId: string | null = null;
    if (property?.projectId) {
      const [proj] = await tx
        .select({ commissionPlanId: projects.commissionPlanId })
        .from(projects)
        .where(eq(projects.id, property.projectId))
        .limit(1);
      projectPlanId = proj?.commissionPlanId ?? null;
    }

    const planId = property?.commissionPlanId ?? projectPlanId ?? null;
    if (!planId) {
      return { planId: null, plan: null };
    }

    const [plan] = await tx
      .select()
      .from(commissionPlans)
      .where(eq(commissionPlans.id, planId))
      .limit(1);

    return { planId, plan: plan ?? null };
  }

  /**
   * Preview commission for a deal without creating a record.
   * Used by DealsService.findAll/findById to show resolved commission info.
   */
  async previewForDeal(
    deal: { tenantId: string; propertyId: string | null; value: number; agentId: string },
  ): Promise<{ resolvedRate: number | null; resolvedCommission: CommissionCalculationResult | null }> {
    const { planId, plan } = await this.resolvePlanForDeal(db, deal);
    if (!planId || !plan) {
      return { resolvedRate: null, resolvedCommission: null };
    }

    // Load agent split
    const [agent] = await db
      .select({ commissionSplit: users.commissionSplit })
      .from(users)
      .where(eq(users.id, deal.agentId))
      .limit(1);

    const split = parseFloat(agent?.commissionSplit ?? '0');

    const calc = calculateCommission({
      dealValueCents: deal.value,
      agentCommissionSplit: split,
      plan: {
        type: plan.type as 'percentage' | 'flat' | 'tiered',
        rate: plan.rate,
        flatAmount: plan.flatAmount,
        tierConfig: plan.tierConfig as Array<{ minValue: number; maxValue: number; rate: number }> | null,
      },
    });

    return {
      resolvedRate: calc.appliedRate,
      resolvedCommission: calc,
    };
  }

  /**
   * Internal hook called from DealsService.changeStage when a deal transitions to closedWon.
   * Creates an immutable commission record, audit log, and notification — all in the same transaction.
   */
  async recordOnClose(
    tx: DrizzleTx,
    deal: {
      id: string;
      tenantId: string;
      propertyId: string | null;
      agentId: string;
      value: number;
    },
    user: AuthenticatedUser,
  ): Promise<typeof commissionRecords.$inferSelect> {
    // 1. Resolve plan: property → project → tenant default
    const { planId, plan } = await this.resolvePlanForDeal(tx, deal);

    let resolvedPlanId = planId;
    let resolvedPlan = plan;

    // If no plan resolved from property/project chain, try tenant default
    if (!resolvedPlanId) {
      const [defaultPlan] = await tx
        .select()
        .from(commissionPlans)
        .where(and(eq(commissionPlans.tenantId, deal.tenantId), eq(commissionPlans.isDefault, true), isNull(commissionPlans.deletedAt)))
        .limit(1);

      if (!defaultPlan) {
        throw new AppError(
          ErrorCodes.COMMISSION_PLAN_MISSING,
          400,
          'No commission plan resolves for this deal. Configure a default plan or set commissionPlanId on this property or its project.',
        );
      }
      resolvedPlanId = defaultPlan.id;
      resolvedPlan = defaultPlan;
    }

    // 2. Load plan + agent
    if (!resolvedPlan) {
      const [loadedPlan] = await tx
        .select()
        .from(commissionPlans)
        .where(eq(commissionPlans.id, resolvedPlanId))
        .limit(1);
      if (!loadedPlan) {
        throw new AppError(ErrorCodes.COMMISSION_PLAN_NOT_FOUND, 404, 'Commission plan not found');
      }
      resolvedPlan = loadedPlan;
    }

    const [agent] = await tx
      .select({ commissionSplit: users.commissionSplit, name: users.name })
      .from(users)
      .where(eq(users.id, deal.agentId))
      .limit(1);

    const split = parseFloat(agent?.commissionSplit ?? '0');

    // 3. Calculate
    const calc = calculateCommission({
      dealValueCents: deal.value,
      agentCommissionSplit: split,
      plan: {
        type: resolvedPlan.type as 'percentage' | 'flat' | 'tiered',
        rate: resolvedPlan.rate,
        flatAmount: resolvedPlan.flatAmount,
        tierConfig: resolvedPlan.tierConfig as Array<{ minValue: number; maxValue: number; rate: number }> | null,
      },
    });

    // 4. Insert commission record (handle unique constraint on dealId)
    let record: typeof commissionRecords.$inferSelect;
    try {
      [record] = await tx
        .insert(commissionRecords)
        .values({
          tenantId: deal.tenantId,
          dealId: deal.id,
          agentId: deal.agentId,
          propertyId: deal.propertyId ?? null,
          planId: resolvedPlanId,
          calculatedAmount: calc.calculatedAmountCents,
          brokerageAmount: calc.brokerageAmountCents,
          agentPayoutAmount: calc.agentPayoutAmountCents,
          status: 'calculated',
          calculatedAt: new Date(),
        })
        .returning();
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate key') || err?.cause?.code === '23505') {
        throw new AppError(
          ErrorCodes.COMMISSION_DUPLICATE,
          409,
          'Commission record already exists for this deal',
        );
      }
      throw err;
    }

    // 5. Audit log
    await tx.insert(auditLogs).values({
      tenantId: deal.tenantId,
      actorId: user.id,
      action: 'commission.calculated',
      targetType: 'commission',
      targetId: record.id,
      metadata: {
        dealId: deal.id,
        agentId: deal.agentId,
        calculatedAmount: calc.calculatedAmountCents,
        agentPayout: calc.agentPayoutAmountCents,
        brokerage: calc.brokerageAmountCents,
        planId: resolvedPlanId,
        planType: calc.planType,
        appliedRate: calc.appliedRate,
      },
    });

    // 6. Notification
    await tx.insert(notifications).values({
      tenantId: deal.tenantId,
      userId: deal.agentId,
      type: 'commission_calculated',
      title: 'Commission calculated',
      message: `Commission of $${(calc.agentPayoutAmountCents / 100).toLocaleString()} calculated for closed deal.`,
      data: {
        dealId: deal.id,
        recordId: record.id,
        calculatedAmount: calc.agentPayoutAmountCents,
      },
    });

    return record;
  }
}
