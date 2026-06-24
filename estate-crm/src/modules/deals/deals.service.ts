import { Injectable } from '@nestjs/common';
import { eq, and, ilike, count, sql, isNull, gte, lte, inArray } from 'drizzle-orm';
import { db } from '@/db/connection';
import { deals, dealTags, properties, leads, users, auditLogs } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import { canTransitionDealStage } from '@/modules/shared/status-fsm';
import { DEAL_STAGE_VALUES, DEAL_TYPE_VALUES } from './enums/deal-constants';
import { DealsActivitiesService } from './deals-activities.service';
import { CommissionRecordsService } from '@/modules/commissions/commission-records/commission-records.service';
import type { CreateDealDto } from './dto/create-deal.dto';
import type { UpdateDealDto } from './dto/update-deal.dto';
import type { DealFiltersDto } from './dto/deal-filters.dto';
import type { AddActivityDto } from './dto/add-activity.dto';
import type { AddTagDto } from './dto/add-tag.dto';
import type { ActivityFiltersDto } from './dto/activity-filters.dto';

const DEAL_SORT_COLUMNS: Record<string, unknown> = {
  createdAt: deals.createdAt,
  updatedAt: deals.updatedAt,
  value: deals.value,
  stage: deals.stage,
  type: deals.type,
};

@Injectable()
export class DealsService {
  constructor(
    private readonly activitiesService: DealsActivitiesService,
    private readonly commissionsService: CommissionRecordsService,
  ) {}

  // ─── CRUD ───────────────────────────────────────────────

  async create(dto: CreateDealDto, actorId: string, tenantId: string) {
    // Validate at least one of propertyId or leadId is provided
    if (!dto.propertyId && !dto.leadId) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        400,
        'At least one of propertyId or leadId is required',
      );
    }

    // Validate type
    if (!DEAL_TYPE_VALUES.includes(dto.type as any)) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        400,
        `Invalid deal type: ${dto.type}`,
      );
    }

    // If propertyId provided, verify property exists in tenant and not deleted
    if (dto.propertyId) {
      const [existingProperty] = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.id, dto.propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
        .limit(1);

      if (!existingProperty) {
        throw new AppError(ErrorCodes.PROPERTY_NOT_FOUND, 404, 'Property not found in this tenant');
      }
    }

    // leadId accepts both Lead and Client IDs — clients are leads with isClient=true
    // If leadId provided, verify lead exists in tenant and not deleted
    if (dto.leadId) {
      const [existingLead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, dto.leadId), eq(leads.tenantId, tenantId), isNull(leads.deletedAt)))
        .limit(1);

      if (!existingLead) {
        throw new AppError(ErrorCodes.LEAD_NOT_FOUND, 404, 'Lead not found in this tenant');
      }
    }

    // Verify agentId user exists in tenant and not deleted
    const [existingAgent] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, dto.agentId), eq(users.tenantId, tenantId), isNull(users.deletedAt)))
      .limit(1);

    if (!existingAgent) {
      throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'Agent not found in this tenant');
    }

    const [deal] = await db
      .insert(deals)
      .values({
        tenantId,
        propertyId: dto.propertyId ?? null,
        leadId: dto.leadId ?? null,
        agentId: dto.agentId,
        type: dto.type,
        value: dto.value,
        stage: 'initialContact',
        probability: dto.probability ?? 50,
        offerDate: dto.offerDate ? new Date(dto.offerDate) : null,
        targetCloseDate: dto.targetCloseDate ? new Date(dto.targetCloseDate) : null,
        notes: dto.notes ?? null,
        // TODO: daysUntilClose and daysElapsed should be computed from targetCloseDate/createdAt
        // These columns exist in the schema but are not yet populated automatically
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'deal.create',
      targetType: 'deal',
      targetId: deal.id,
      metadata: {
        type: deal.type,
        value: deal.value,
        stage: deal.stage,
        agentId: deal.agentId,
      },
    });

    return deal;
  }

  async findAll(
    filters: DealFiltersDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    const { page, limit, sortBy, sortOrder, stage, type, agentId, propertyId, leadId, minValue, maxValue, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(deals.tenantId, user.tenantId),
      isNull(deals.deletedAt),
    ];

    // Agent visibility: agents see only their own deals
    if (user.role === 'agent') {
      conditions.push(eq(deals.agentId, user.id));
    }

    if (stage) {
      conditions.push(eq(deals.stage, stage));
    }
    if (type) {
      conditions.push(eq(deals.type, type));
    }
    if (agentId) {
      conditions.push(eq(deals.agentId, agentId));
    }
    if (propertyId) {
      conditions.push(eq(deals.propertyId, propertyId));
    }
    if (leadId) {
      conditions.push(eq(deals.leadId, leadId));
    }
    if (minValue !== undefined) {
      conditions.push(gte(deals.value, minValue));
    }
    if (maxValue !== undefined) {
      conditions.push(lte(deals.value, maxValue));
    }
    if (search) {
      conditions.push(ilike(deals.notes, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(deals)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const sortColumn = (DEAL_SORT_COLUMNS[sortBy] as typeof deals.createdAt) ?? deals.createdAt;

    const data = await db
      .select()
      .from(deals)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? sql`${sortColumn} asc` : sql`${sortColumn} desc`)
      .limit(limit)
      .offset(offset);

    if (data.length === 0) {
      return createPaginatedResult([], total, page, limit);
    }

    // Batch-fetch properties and agents referenced by these deals
    const propertyIds = [...new Set(data.map((d) => d.propertyId).filter(Boolean))] as string[];
    const agentIds = [...new Set(data.map((d) => d.agentId))];

    const propertiesData = propertyIds.length > 0
      ? await db
          .select({ id: properties.id, title: properties.title, address: properties.address })
          .from(properties)
          .where(inArray(properties.id, propertyIds))
      : [];
    const agentsData = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, agentIds));

    const propertiesMap = new Map(propertiesData.map((p) => [p.id, p]));
    const agentsMap = new Map(agentsData.map((a) => [a.id, a]));

    // Enrich with commission preview + property/agent/risk
    const enriched = await Promise.all(
      data.map(async (deal) => {
        const commission = await this.commissionsService.previewForDeal(deal);
        const prop = deal.propertyId ? propertiesMap.get(deal.propertyId) ?? null : null;
        const agent = agentsMap.get(deal.agentId) ?? null;
        const daysUntilClose =
          deal.targetCloseDate && deal.stage !== 'closedWon' && deal.stage !== 'closedLost'
            ? Math.ceil((deal.targetCloseDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            : null;
        const daysElapsed = deal.createdAt
          ? Math.floor((Date.now() - deal.createdAt.getTime()) / (24 * 60 * 60 * 1000))
          : 0;
        const risk = deal.probability >= 70 ? 'low' : deal.probability >= 50 ? 'medium' : 'high';
        return {
          ...deal,
          property: prop,
          agent,
          daysUntilClose,
          daysElapsed,
          risk,
          resolvedRate: commission.resolvedRate,
          resolvedCommission: commission.resolvedCommission
            ? {
                calculated: commission.resolvedCommission.calculatedAmountCents,
                agentPayout: commission.resolvedCommission.agentPayoutAmountCents,
                brokerage: commission.resolvedCommission.brokerageAmountCents,
                appliedRate: commission.resolvedCommission.appliedRate,
                planType: commission.resolvedCommission.planType,
              }
            : null,
        };
      }),
    );

    return createPaginatedResult(enriched, total, page, limit);
  }

  async findById(id: string, tenantId: string, user?: { id: string; role: string }) {
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId), isNull(deals.deletedAt)))
      .limit(1);

    if (!deal) {
      throw new AppError(ErrorCodes.DEAL_NOT_FOUND, 404, 'Deal not found');
    }

    // Agent visibility enforcement: agents can only view/edit their own deals
    if (user && user.role === 'agent' && deal.agentId !== user.id) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'You can only access deals assigned to you');
    }

    // Enrich with commission preview + property/agent/risk
    const commission = await this.commissionsService.previewForDeal(deal);

    let prop: { id: string; title: string; address: string } | null = null;
    if (deal.propertyId) {
      const [p] = await db
        .select({ id: properties.id, title: properties.title, address: properties.address })
        .from(properties)
        .where(eq(properties.id, deal.propertyId))
        .limit(1);
      prop = p ?? null;
    }

    const [agent] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, deal.agentId))
      .limit(1);

    const daysUntilClose =
      deal.targetCloseDate && deal.stage !== 'closedWon' && deal.stage !== 'closedLost'
        ? Math.ceil((deal.targetCloseDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
    const daysElapsed = deal.createdAt
      ? Math.floor((Date.now() - deal.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    const risk = deal.probability >= 70 ? 'low' : deal.probability >= 50 ? 'medium' : 'high';

    return {
      ...deal,
      property: prop,
      agent: agent ?? null,
      daysUntilClose,
      daysElapsed,
      risk,
      resolvedRate: commission.resolvedRate,
      resolvedCommission: commission.resolvedCommission
        ? {
            calculated: commission.resolvedCommission.calculatedAmountCents,
            agentPayout: commission.resolvedCommission.agentPayoutAmountCents,
            brokerage: commission.resolvedCommission.brokerageAmountCents,
            appliedRate: commission.resolvedCommission.appliedRate,
            planType: commission.resolvedCommission.planType,
          }
        : null,
    };
  }

  async update(id: string, dto: UpdateDealDto, user: { id: string; role: string; tenantId: string }) {
    const existing = await this.findById(id, user.tenantId, user);

    // Agents cannot update probability or value (manager/admin-only fields)
    if (user.role === 'agent') {
      if (dto.probability !== undefined) {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Agents cannot set deal probability');
      }
      if (dto.value !== undefined) {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Agents cannot set deal value');
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (dto.agentId !== undefined) updateData.agentId = dto.agentId;
    if (dto.propertyId !== undefined) updateData.propertyId = dto.propertyId;
    if (dto.leadId !== undefined) updateData.leadId = dto.leadId;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.value !== undefined) updateData.value = dto.value;
    if (dto.probability !== undefined) updateData.probability = dto.probability;
    if (dto.offerDate !== undefined) updateData.offerDate = new Date(dto.offerDate);
    if (dto.targetCloseDate !== undefined) updateData.targetCloseDate = new Date(dto.targetCloseDate);
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    updateData.updatedAt = new Date();

    // If agentId changed, verify new agent exists in tenant
    if (dto.agentId !== undefined && dto.agentId !== existing.agentId) {
      const [existingAgent] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, dto.agentId), eq(users.tenantId, user.tenantId), isNull(users.deletedAt)))
        .limit(1);

      if (!existingAgent) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'Agent not found in this tenant');
      }
    }

    // If propertyId changed, verify property in tenant
    if (dto.propertyId !== undefined && dto.propertyId !== existing.propertyId) {
      if (dto.propertyId) {
        const [existingProperty] = await db
          .select({ id: properties.id })
          .from(properties)
          .where(and(eq(properties.id, dto.propertyId), eq(properties.tenantId, user.tenantId), isNull(properties.deletedAt)))
          .limit(1);

        if (!existingProperty) {
          throw new AppError(ErrorCodes.PROPERTY_NOT_FOUND, 404, 'Property not found in this tenant');
        }
      }
    }

    // If leadId changed, verify lead in tenant
    if (dto.leadId !== undefined && dto.leadId !== existing.leadId) {
      if (dto.leadId) {
        const [existingLead] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(and(eq(leads.id, dto.leadId), eq(leads.tenantId, user.tenantId), isNull(leads.deletedAt)))
          .limit(1);

        if (!existingLead) {
          throw new AppError(ErrorCodes.LEAD_NOT_FOUND, 404, 'Lead not found in this tenant');
        }
      }
    }

    const [updated] = await db
      .update(deals)
      .set(updateData as any)
      .where(eq(deals.id, id))
      .returning();

    // Audit log (exclude internal fields from metadata)
    const updatedFields = Object.keys(updateData).filter((key) => key !== 'updatedAt');
    await db.insert(auditLogs).values({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'deal.update',
      targetType: 'deal',
      targetId: id,
      metadata: { updatedFields },
    });

    return updated;
  }

  async remove(id: string, user: { id: string; role: string; tenantId: string }) {
    await this.findById(id, user.tenantId, user);

    const now = new Date();
    const [deleted] = await db
      .update(deals)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(deals.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'deal.delete',
      targetType: 'deal',
      targetId: id,
      metadata: { type: deleted.type, value: deleted.value },
    });

    return deleted;
  }

  // ─── Stage FSM ──────────────────────────────────────────

  async changeStage(
    id: string,
    newStage: string,
    user: { id: string; role: string; tenantId: string },
  ) {
    const deal = await this.findById(id, user.tenantId, user);

    // Validate stage value
    if (!DEAL_STAGE_VALUES.includes(newStage as any)) {
      throw new AppError(ErrorCodes.DEAL_STAGE_INVALID, 400, `Invalid deal stage: ${newStage}`);
    }

    // FSM check
    if (!canTransitionDealStage(deal.stage, newStage)) {
      throw new AppError(
        ErrorCodes.DEAL_STAGE_INVALID,
        400,
        `Cannot transition deal stage from '${deal.stage}' to '${newStage}'`,
      );
    }

    // Manager approval gate: agents cannot close a deal as won
    if (newStage === 'closedWon' && user.role === 'agent') {
      throw new AppError(
        ErrorCodes.DEAL_CLOSING_LOCKED,
        403,
        'Only managers can close a deal as won',
      );
    }

    const oldStage = deal.stage;

    return db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        stage: newStage,
        updatedAt: new Date(),
      };

      // If transitioning to a terminal stage, set closingDate
      if (newStage === 'closedWon' || newStage === 'closedLost') {
        updateData.closingDate = new Date();
      }

      // TODO: Compute daysElapsed from createdAt and daysUntilClose from targetCloseDate

      const [updated] = await tx
        .update(deals)
        .set(updateData as any)
        .where(eq(deals.id, id))
        .returning();

      // Log stage change activity
      await this.activitiesService.logActivity(tx, {
        tenantId: user.tenantId,
        dealId: id,
        type: 'stage_change',
        content: `Stage changed from '${oldStage}' to '${newStage}'`,
        agentId: user.id,
        metadata: { from: oldStage, to: newStage },
      });

      // Audit log for stage change
      await tx.insert(auditLogs).values({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'deal.stage_change',
        targetType: 'deal',
        targetId: id,
        metadata: { from: oldStage, to: newStage, dealValue: deal.value },
      });

      // Commission calculation + property status update on closedWon
      if (newStage === 'closedWon') {
        // 1. Mark property as sold (if linked)
        if (updated.propertyId) {
          await tx
            .update(properties)
            .set({ status: 'sold', updatedAt: new Date() })
            .where(eq(properties.id, updated.propertyId));
        }

        // 2. Create immutable commission record (throws COMMISSION_PLAN_MISSING if no plan)
        //    This also writes audit log + notification — all in the same transaction.
        await this.commissionsService.recordOnClose(tx, updated, user);
      }

      return updated;
    });
  }

  // ─── Activities ─────────────────────────────────────────

  async addActivity(
    id: string,
    dto: AddActivityDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    await this.findById(id, user.tenantId, user);

    return this.activitiesService.logActivity(db, {
      tenantId: user.tenantId,
      dealId: id,
      type: dto.type,
      content: dto.content,
      agentId: user.id,
      metadata: dto.metadata,
    });
  }

  async findActivities(
    id: string,
    filters: ActivityFiltersDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify deal exists (ensures tenant scoping + 404 + agent enforcement)
    await this.findById(id, user.tenantId, user);
    return this.activitiesService.findActivities(id, user.tenantId, filters);
  }

  // ─── Tags ───────────────────────────────────────────────

  async findTags(dealId: string, tenantId: string, user?: { id: string; role: string }) {
    // Verify deal exists (with agent enforcement if user provided)
    await this.findById(dealId, tenantId, user);

    return db
      .select()
      .from(dealTags)
      .where(and(eq(dealTags.dealId, dealId), eq(dealTags.tenantId, tenantId)));
  }

  async addTag(
    dealId: string,
    dto: AddTagDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify deal exists (with agent enforcement)
    await this.findById(dealId, user.tenantId, user);

    try {
      const [tag] = await db
        .insert(dealTags)
        .values({
          tenantId: user.tenantId,
          dealId,
          tag: dto.tag,
          color: dto.color,
        })
        .returning();
      return tag;
    } catch (err: any) {
      // Drizzle wraps PG errors — check for unique violation
      if (err?.cause?.code === '23505' || err?.code === '23505') {
        throw new AppError(ErrorCodes.DEAL_TAG_DUPLICATE, 409, `Tag '${dto.tag}' already exists on this deal`);
      }
      throw err;
    }
  }

  async removeTag(
    dealId: string,
    tagId: string,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify deal exists (with agent enforcement)
    await this.findById(dealId, user.tenantId, user);

    const [tag] = await db
      .select()
      .from(dealTags)
      .where(and(eq(dealTags.id, tagId), eq(dealTags.dealId, dealId), eq(dealTags.tenantId, user.tenantId)))
      .limit(1);

    if (!tag) {
      throw new AppError(ErrorCodes.DEAL_TAG_NOT_FOUND, 404, 'Tag not found on this deal');
    }

    await db.delete(dealTags).where(eq(dealTags.id, tagId));

    return tag;
  }

}
