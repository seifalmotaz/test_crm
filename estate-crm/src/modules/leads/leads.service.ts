import { Injectable } from '@nestjs/common';
import { eq, and, ilike, count, sql, isNull, or, desc, asc, ne } from 'drizzle-orm';
import { db } from '@/db/connection';
import { leads, leadTags, users, auditLogs } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import { canTransitionLeadStage } from '@/modules/shared/status-fsm';
import { LEAD_STAGE_VALUES } from './enums/lead-constants';
import { LeadsActivitiesService } from './leads-activities.service';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';
import type { LeadFiltersDto } from './dto/lead-filters.dto';
import type { AddActivityDto } from './dto/add-activity.dto';
import type { AddTagDto } from './dto/add-tag.dto';
import type { SetDncDto } from './dto/set-dnc.dto';

const LEAD_SORT_COLUMNS: Record<string, unknown> = {
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  name: leads.name,
  score: leads.score,
  stage: leads.stage,
};

@Injectable()
export class LeadsService {
  constructor(private readonly activitiesService: LeadsActivitiesService) {}

  // ─── CRUD ───────────────────────────────────────────────

  async create(dto: CreateLeadDto, actorId: string, tenantId: string) {
    // Validate stage if provided
    if (dto.stage && !LEAD_STAGE_VALUES.includes(dto.stage as any)) {
      throw new AppError(ErrorCodes.LEAD_STAGE_INVALID, 400, `Invalid lead stage: ${dto.stage}`);
    }

    // Verify agent exists and belongs to same tenant
    if (dto.agentId) {
      const [existingAgent] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, dto.agentId), eq(users.tenantId, tenantId), isNull(users.deletedAt)))
        .limit(1);

      if (!existingAgent) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'Agent not found in this tenant');
      }
    }

    const [lead] = await db
      .insert(leads)
      .values({
        tenantId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone,
        source: dto.source,
        type: dto.type,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        timeline: dto.timeline ?? null,
        preferredLocation: dto.preferredLocation ?? null,
        preferredType: dto.preferredType ?? null,
        stage: dto.stage ?? 'fresh',
        score: dto.score ?? 0,
        agentId: dto.agentId ?? null,
        notes: dto.notes ?? null,
        nextAction: dto.nextAction ?? null,
        nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : null,
        isClient: dto.isClient ?? false,
        isDnc: false,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'lead.create',
      targetType: 'lead',
      targetId: lead.id,
      metadata: { name: lead.name, source: lead.source, stage: lead.stage },
    });

    return lead;
  }

  async findAll(
    filters: LeadFiltersDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    const { page, limit, sortBy, sortOrder, stage, source, type, agentId, isDnc, isClient, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(leads.tenantId, user.tenantId),
      isNull(leads.deletedAt),
    ];

    // Agent visibility: agents see only their own leads
    if (user.role === 'agent') {
      conditions.push(eq(leads.agentId, user.id));
    }

    if (stage) {
      conditions.push(eq(leads.stage, stage));
    }
    if (source) {
      conditions.push(eq(leads.source, source));
    }
    if (type) {
      conditions.push(eq(leads.type, type));
    }
    if (agentId) {
      conditions.push(eq(leads.agentId, agentId));
    }
    if (isDnc !== undefined) {
      conditions.push(eq(leads.isDnc, isDnc));
    }
    if (isClient !== undefined) {
      conditions.push(eq(leads.isClient, isClient));
    }
    if (search) {
      conditions.push(
        or(
          ilike(leads.name, `%${search}%`),
          ilike(leads.email, `%${search}%`),
          ilike(leads.phone, `%${search}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(leads)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const sortColumn = (LEAD_SORT_COLUMNS[sortBy] as typeof leads.createdAt) ?? leads.createdAt;

    const data = await db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? sql`${sortColumn} asc` : sql`${sortColumn} desc`)
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, tenantId: string, user?: { id: string; role: string }) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId), isNull(leads.deletedAt)))
      .limit(1);

    if (!lead) {
      throw new AppError(ErrorCodes.LEAD_NOT_FOUND, 404, 'Lead not found');
    }

    // Agent visibility enforcement: agents can only view/edit their own leads
    if (user && user.role === 'agent' && lead.agentId !== user.id) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'You can only access leads assigned to you');
    }

    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, user: { id: string; role: string; tenantId: string }) {
    const existing = await this.findById(id, user.tenantId, user);

    // Agents cannot set score
    if (dto.score !== undefined && user.role === 'agent') {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Agents cannot set lead score');
    }

    // Agents cannot set VIP fields
    if (dto.isVip !== undefined && user.role === 'agent') {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Agents cannot set VIP status');
    }
    if (dto.lifetimeValue !== undefined && user.role === 'agent') {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Agents cannot set lifetime value');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.budgetMin !== undefined) updateData.budgetMin = dto.budgetMin;
    if (dto.budgetMax !== undefined) updateData.budgetMax = dto.budgetMax;
    if (dto.timeline !== undefined) updateData.timeline = dto.timeline;
    if (dto.preferredLocation !== undefined) updateData.preferredLocation = dto.preferredLocation;
    if (dto.preferredType !== undefined) updateData.preferredType = dto.preferredType;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.nextAction !== undefined) updateData.nextAction = dto.nextAction;
    if (dto.nextActionDate !== undefined) updateData.nextActionDate = new Date(dto.nextActionDate);
    if (dto.score !== undefined) updateData.score = dto.score;
    if (dto.isVip !== undefined) updateData.isVip = dto.isVip;
    if (dto.lifetimeValue !== undefined) updateData.lifetimeValue = dto.lifetimeValue;
    updateData.updatedAt = new Date();

    // Handle agentId change: append old agentId to previousAgentIds
    if (dto.agentId !== undefined && dto.agentId !== existing.agentId) {
      // Verify new agent exists in tenant
      if (dto.agentId) {
        const [existingAgent] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, dto.agentId), eq(users.tenantId, user.tenantId), isNull(users.deletedAt)))
          .limit(1);

        if (!existingAgent) {
          throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'Agent not found in this tenant');
        }
      }

      // Use transaction for lead update + activity log
      return db.transaction(async (tx) => {
        // Append old agent to previousAgentIds
        if (existing.agentId) {
          await tx
            .update(leads)
            .set({
              previousAgentIds: sql`array_append(${leads.previousAgentIds}, ${existing.agentId})`,
            })
            .where(eq(leads.id, id));
        }

        // Update lead
        const [updated] = await tx
          .update(leads)
          .set({ ...updateData, agentId: dto.agentId })
          .where(eq(leads.id, id))
          .returning();

        // Log assignment activity
        await this.activitiesService.logActivity(tx, {
          tenantId: user.tenantId,
          leadId: id,
          type: 'assignment',
          content: `Lead reassigned from ${existing.agentId ?? 'unassigned'} to ${dto.agentId ?? 'unassigned'}`,
          agentId: user.id,
          metadata: { from: existing.agentId, to: dto.agentId },
        });

        // Audit log
        await tx.insert(auditLogs).values({
          tenantId: user.tenantId,
          actorId: user.id,
          action: 'lead.assign',
          targetType: 'lead',
          targetId: id,
          metadata: { from: existing.agentId, to: dto.agentId },
        });

        return updated;
      });
    }

    // No agentId change — simple update
    const [updated] = await db
      .update(leads)
      .set(updateData as any)
      .where(eq(leads.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, user: { id: string; role: string; tenantId: string }) {
    await this.findById(id, user.tenantId, user);

    const now = new Date();
    const [deleted] = await db
      .update(leads)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(leads.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'lead.delete',
      targetType: 'lead',
      targetId: id,
      metadata: { name: deleted.name },
    });

    return deleted;
  }

  // ─── Stage FSM ──────────────────────────────────────────

  async changeStage(
    id: string,
    newStage: string,
    user: { id: string; role: string; tenantId: string },
  ) {
    const lead = await this.findById(id, user.tenantId, user);

    // Validate stage value
    if (!LEAD_STAGE_VALUES.includes(newStage as any)) {
      throw new AppError(ErrorCodes.LEAD_STAGE_INVALID, 400, `Invalid lead stage: ${newStage}`);
    }

    // FSM check
    if (!canTransitionLeadStage(lead.stage, newStage)) {
      throw new AppError(
        ErrorCodes.LEAD_STAGE_INVALID,
        400,
        `Cannot transition lead stage from '${lead.stage}' to '${newStage}'`,
      );
    }

    const oldStage = lead.stage;

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(leads)
        .set({ stage: newStage, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();

      // Log stage change activity
      await this.activitiesService.logActivity(tx, {
        tenantId: user.tenantId,
        leadId: id,
        type: 'stage_change',
        content: `Stage changed from '${oldStage}' to '${newStage}'`,
        agentId: user.id,
        metadata: { from: oldStage, to: newStage },
      });

      return updated;
    });
  }

  // ─── Conversion ─────────────────────────────────────────

  async convert(id: string, user: { id: string; role: string; tenantId: string }) {
    const lead = await this.findById(id, user.tenantId, user);

    if (lead.isClient) {
      throw new AppError(ErrorCodes.LEAD_ALREADY_CLIENT, 400, 'Lead is already a client');
    }

    if (!lead.agentId) {
      throw new AppError(
        ErrorCodes.LEAD_NOT_ASSIGNED,
        400,
        'Lead must be assigned to an agent before conversion',
      );
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(leads)
        .set({ isClient: true, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();

      // Log convert activity
      await this.activitiesService.logActivity(tx, {
        tenantId: user.tenantId,
        leadId: id,
        type: 'convert',
        content: `Lead promoted to client`,
        agentId: user.id,
      });

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'lead.promote',
        targetType: 'lead',
        targetId: id,
        metadata: { agentId: lead.agentId, previousStage: lead.stage },
      });

      return updated;
    });
  }

  // ─── DNC ────────────────────────────────────────────────

  async setDnc(
    id: string,
    dto: SetDncDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    const lead = await this.findById(id, user.tenantId, user);

    return db.transaction(async (tx) => {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (dto.isDnc) {
        updateData.isDnc = true;
        updateData.dncReason = dto.reason ?? null;
        updateData.dncSetAt = now;
        updateData.dncSetById = user.id;
      } else {
        updateData.isDnc = false;
        updateData.dncReason = null;
        updateData.dncSetAt = null;
        updateData.dncSetById = null;
      }

      const [updated] = await tx
        .update(leads)
        .set(updateData as any)
        .where(eq(leads.id, id))
        .returning();

      // Log DNC activity
      await this.activitiesService.logActivity(tx, {
        tenantId: user.tenantId,
        leadId: id,
        type: dto.isDnc ? 'dnc_set' : 'dnc_unset',
        content: dto.isDnc
          ? `DNC enabled${dto.reason ? `: ${dto.reason}` : ''}`
          : 'DNC disabled',
        agentId: user.id,
        metadata: dto.isDnc ? { reason: dto.reason ?? null } : undefined,
      });

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId: user.tenantId,
        actorId: user.id,
        action: dto.isDnc ? 'lead.dnc_set' : 'lead.dnc_unset',
        targetType: 'lead',
        targetId: id,
        metadata: dto.isDnc ? { reason: dto.reason ?? null } : null,
      });

      return updated;
    });
  }

  // ─── Activities ─────────────────────────────────────────

  async addActivity(
    id: string,
    dto: AddActivityDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    const lead = await this.findById(id, user.tenantId, user);

    // Hard guard: DNC blocks activity creation
    if (lead.isDnc) {
      throw new AppError(
        ErrorCodes.LEAD_DNC_ACTIVE,
        403,
        'Cannot add activity to a lead marked as Do-Not-Contact',
      );
    }

    return this.activitiesService.logActivity(db, {
      tenantId: user.tenantId,
      leadId: id,
      type: dto.type,
      content: dto.content,
      agentId: user.id,
      metadata: dto.metadata,
    });
  }

  async findActivities(
    id: string,
    filters: import('./dto/activity-filters.dto').ActivityFiltersDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify lead exists (ensures tenant scoping + 404 + agent enforcement)
    await this.findById(id, user.tenantId, user);
    return this.activitiesService.findActivities(id, user.tenantId, filters);
  }

  // ─── Tags ───────────────────────────────────────────────

  async findTags(leadId: string, tenantId: string, user?: { id: string; role: string }) {
    // Verify lead exists (with agent enforcement if user provided)
    await this.findById(leadId, tenantId, user);

    return db
      .select()
      .from(leadTags)
      .where(and(eq(leadTags.leadId, leadId), eq(leadTags.tenantId, tenantId)));
  }

  async addTag(
    leadId: string,
    dto: AddTagDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify lead exists (with agent enforcement)
    await this.findById(leadId, user.tenantId, user);

    try {
      const [tag] = await db
        .insert(leadTags)
        .values({
          tenantId: user.tenantId,
          leadId,
          tag: dto.tag,
          color: dto.color,
        })
        .returning();
      return tag;
    } catch (err: any) {
      // Drizzle wraps PG errors — check for unique violation
      if (err?.cause?.code === '23505' || err?.code === '23505') {
        throw new AppError(ErrorCodes.LEAD_TAG_DUPLICATE, 409, `Tag '${dto.tag}' already exists on this lead`);
      }
      throw err;
    }
  }

  async removeTag(
    leadId: string,
    tagId: string,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify lead exists (with agent enforcement)
    await this.findById(leadId, user.tenantId, user);

    const [tag] = await db
      .select()
      .from(leadTags)
      .where(and(eq(leadTags.id, tagId), eq(leadTags.leadId, leadId), eq(leadTags.tenantId, user.tenantId)))
      .limit(1);

    if (!tag) {
      throw new AppError(ErrorCodes.LEAD_TAG_NOT_FOUND, 404, 'Tag not found on this lead');
    }

    await db.delete(leadTags).where(eq(leadTags.id, tagId));

    return tag;
  }

  // ─── Bulk Assign ──────────────────────────────────────────

  async bulkAssign(
    leadIds: string[],
    agentId: string | null | undefined,
    user: { id: string; role: string; tenantId: string },
  ) {
    if (!leadIds || leadIds.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'leadIds cannot be empty');
    }

    // Verify target agent exists in tenant (if provided)
    if (agentId) {
      const [existingAgent] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, agentId), eq(users.tenantId, user.tenantId), isNull(users.deletedAt)))
        .limit(1);

      if (!existingAgent) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'Agent not found in this tenant');
      }
    }

    // Find leads that exist in this tenant and are not deleted
    const existingLeads = await db
      .select({ id: leads.id, agentId: leads.agentId })
      .from(leads)
      .where(and(eq(leads.tenantId, user.tenantId), isNull(leads.deletedAt)));

    const validLeadIds = new Set(existingLeads.map((l) => l.id));
    const validIds = leadIds.filter((id) => validLeadIds.has(id));
    const failedIds = leadIds.filter((id) => !validLeadIds.has(id));

    if (validIds.length === 0) {
      return {
        assigned: 0,
        failed: failedIds.length,
        failedIds,
        agentId: agentId ?? null,
      };
    }

    // Perform all updates + activities in a single transaction
    await db.transaction(async (tx) => {
      // Append old agent to previousAgentIds when reassigning
      if (agentId !== undefined && agentId !== null) {
        // Get current agentIds for valid leads (to record previousAgentIds)
        const currentLeads = existingLeads.filter((l) => validIds.includes(l.id) && l.agentId);

        for (const lead of currentLeads) {
          await tx
            .update(leads)
            .set({
              previousAgentIds: sql`array_append(${leads.previousAgentIds}, ${lead.agentId})`,
            })
            .where(eq(leads.id, lead.id));
        }
      }

      // Update all leads
      await tx
        .update(leads)
        .set({ agentId: agentId ?? null, updatedAt: new Date() })
        .where(
          and(
            eq(leads.tenantId, user.tenantId),
            isNull(leads.deletedAt),
            sql`${leads.id} = ANY(${validIds})`,
          ),
        );

      // Log a single activity per lead for traceability
      for (const leadId of validIds) {
        const original = existingLeads.find((l) => l.id === leadId);
        await this.activitiesService.logActivity(tx, {
          tenantId: user.tenantId,
          leadId,
          type: 'assignment',
          content: `Lead bulk-reassigned from ${original?.agentId ?? 'unassigned'} to ${agentId ?? 'unassigned'}`,
          agentId: user.id,
          metadata: { from: original?.agentId ?? null, to: agentId ?? null, bulk: true },
        });
      }

      // Single audit log entry summarising the bulk action
      await tx.insert(auditLogs).values({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'lead.bulk_assign',
        targetType: 'lead',
        targetId: null,
        metadata: {
          count: validIds.length,
          agentId: agentId ?? null,
          leadIds: validIds,
        },
      });
    });

    return {
      assigned: validIds.length,
      failed: failedIds.length,
      failedIds,
      agentId: agentId ?? null,
    };
  }
}
