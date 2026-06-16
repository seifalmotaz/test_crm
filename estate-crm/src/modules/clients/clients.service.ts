import { Injectable } from '@nestjs/common';
import { eq, and, ilike, count, sql, isNull, or } from 'drizzle-orm';
import { db } from '@/db/connection';
import { leads, users, auditLogs } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import { LeadsService } from '@/modules/leads/leads.service';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { ClientFiltersDto } from './dto/client-filters.dto';
import type { SetVipDto } from './dto/set-vip.dto';
import type { AddActivityDto } from '@/modules/leads/dto/add-activity.dto';
import type { ActivityFiltersDto } from '@/modules/leads/dto/activity-filters.dto';
import type { AddTagDto } from '@/modules/leads/dto/add-tag.dto';

const CLIENT_SORT_COLUMNS: Record<string, unknown> = {
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  name: leads.name,
  lifetimeValue: leads.lifetimeValue,
};

@Injectable()
export class ClientsService {
  constructor(private readonly leadsService: LeadsService) {}

  // ─── Duplicate Detection ───────────────────────────────

  /**
   * Check if a lead/client with the same phone already exists in the tenant.
   * Returns a warning object if duplicate found, null otherwise.
   * This is a NON-BLOCKING check — it warns but doesn't prevent creation.
   */
  private async checkDuplicate(
    tenantId: string,
    phone: string,
    email?: string,
  ): Promise<{ type: 'lead' | 'client'; id: string; name: string } | null> {
    // Check by phone first (most reliable identifier)
    const [phoneMatch] = await db
      .select({ id: leads.id, name: leads.name, isClient: leads.isClient })
      .from(leads)
      .where(and(eq(leads.phone, phone), eq(leads.tenantId, tenantId), isNull(leads.deletedAt)))
      .limit(1);

    if (phoneMatch) {
      return { type: phoneMatch.isClient ? 'client' : 'lead', id: phoneMatch.id, name: phoneMatch.name };
    }

    // If email provided, check by email
    if (email) {
      const [emailMatch] = await db
        .select({ id: leads.id, name: leads.name, isClient: leads.isClient })
        .from(leads)
        .where(and(eq(leads.email, email), eq(leads.tenantId, tenantId), isNull(leads.deletedAt)))
        .limit(1);

      if (emailMatch) {
        return { type: emailMatch.isClient ? 'client' : 'lead', id: emailMatch.id, name: emailMatch.name };
      }
    }

    return null;
  }

  // ─── CRUD ───────────────────────────────────────────────

  async create(dto: CreateClientDto, actorId: string, tenantId: string) {
    // Check for duplicate phone/email (non-blocking warning)
    const duplicateWarning = await this.checkDuplicate(tenantId, dto.phone, dto.email);

    // Verify agent exists in tenant
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

    const [client] = await db
      .insert(leads)
      .values({
        tenantId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone,
        source: 'direct', // Clients are always direct — no marketing source
        type: dto.type,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        timeline: dto.timeline ?? null,
        preferredLocation: dto.preferredLocation ?? null,
        preferredType: dto.preferredType ?? null,
        stage: 'fresh', // Default stage, but irrelevant for clients
        score: 0,
        agentId: dto.agentId ?? null,
        notes: dto.notes ?? null,
        nextAction: dto.nextAction ?? null,
        nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : null,
        isClient: true,
        lifetimeValue: dto.lifetimeValue ?? 0,
        isDnc: false,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      action: 'client.create',
      targetType: 'lead',
      targetId: client.id,
      metadata: { name: client.name, phone: client.phone, duplicateWarning },
    });

    // Return client + duplicate warning
    return { ...client, duplicateWarning };
  }

  async findAll(
    filters: ClientFiltersDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    const { page, limit, sortBy, sortOrder, isVip, agentId, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(leads.tenantId, user.tenantId),
      isNull(leads.deletedAt),
      eq(leads.isClient, true), // CRITICAL: only clients
    ];

    // Agent visibility: agents see only their own clients
    if (user.role === 'agent') {
      conditions.push(eq(leads.agentId, user.id));
    }

    if (isVip !== undefined) {
      conditions.push(eq(leads.isVip, isVip));
    }
    if (agentId) {
      conditions.push(eq(leads.agentId, agentId));
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

    const sortColumn = (CLIENT_SORT_COLUMNS[sortBy] as typeof leads.createdAt) ?? leads.createdAt;

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
    const lead = await this.leadsService.findById(id, tenantId, user);

    if (!lead.isClient) {
      throw new AppError(ErrorCodes.CLIENT_NOT_A_CLIENT, 400, 'This record is not a client');
    }

    return lead;
  }

  async update(id: string, dto: UpdateClientDto, user: { id: string; role: string; tenantId: string }) {
    // Verify this is a client
    const existing = await this.findById(id, user.tenantId, user);

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
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.budgetMin !== undefined) updateData.budgetMin = dto.budgetMin;
    if (dto.budgetMax !== undefined) updateData.budgetMax = dto.budgetMax;
    if (dto.timeline !== undefined) updateData.timeline = dto.timeline;
    if (dto.preferredLocation !== undefined) updateData.preferredLocation = dto.preferredLocation;
    if (dto.preferredType !== undefined) updateData.preferredType = dto.preferredType;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.nextAction !== undefined) updateData.nextAction = dto.nextAction;
    if (dto.nextActionDate !== undefined) updateData.nextActionDate = new Date(dto.nextActionDate);
    if (dto.agentId !== undefined) updateData.agentId = dto.agentId;
    if (dto.isVip !== undefined) updateData.isVip = dto.isVip;
    if (dto.lifetimeValue !== undefined) updateData.lifetimeValue = dto.lifetimeValue;
    updateData.updatedAt = new Date();

    // Verify new agent exists in tenant (if agentId being changed)
    if (dto.agentId !== undefined && dto.agentId !== existing.agentId) {
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

      // Use transaction for reassignment + audit
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

        const [updated] = await tx
          .update(leads)
          .set({ ...updateData, agentId: dto.agentId })
          .where(eq(leads.id, id))
          .returning();

        // Audit log
        await tx.insert(auditLogs).values({
          tenantId: user.tenantId,
          actorId: user.id,
          action: 'client.assign',
          targetType: 'lead',
          targetId: id,
          metadata: { from: existing.agentId, to: dto.agentId },
        });

        return updated;
      });
    }

    // Simple update
    const [updated] = await db
      .update(leads)
      .set(updateData as any)
      .where(eq(leads.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, user: { id: string; role: string; tenantId: string }) {
    // Verify this is a client
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
      action: 'client.delete',
      targetType: 'lead',
      targetId: id,
      metadata: { name: deleted.name },
    });

    return deleted;
  }

  // ─── VIP ────────────────────────────────────────────────

  async setVip(
    id: string,
    dto: SetVipDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify this is a client
    const client = await this.findById(id, user.tenantId, user);

    // Only managers and admins can set VIP
    if (user.role === 'agent') {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Only managers and admins can set VIP status');
    }

    return db.transaction(async (tx) => {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (dto.isVip) {
        updateData.isVip = true;
        updateData.vipSetById = user.id;
        updateData.vipSetAt = now;
      } else {
        updateData.isVip = false;
        updateData.vipSetById = null;
        updateData.vipSetAt = null;
      }

      const [updated] = await tx
        .update(leads)
        .set(updateData as any)
        .where(eq(leads.id, id))
        .returning();

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId: user.tenantId,
        actorId: user.id,
        action: dto.isVip ? 'client.vip_set' : 'client.vip_unset',
        targetType: 'lead',
        targetId: id,
        metadata: { isVip: dto.isVip, setBy: user.id },
      });

      return updated;
    });
  }

  // ─── Activities (delegate to LeadsService) ─────────────

  async addActivity(
    id: string,
    dto: AddActivityDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify this is a client
    await this.findById(id, user.tenantId, user);
    return this.leadsService.addActivity(id, dto, user);
  }

  async findActivities(
    id: string,
    filters: ActivityFiltersDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify this is a client
    await this.findById(id, user.tenantId, user);
    return this.leadsService.findActivities(id, filters, user);
  }

  // ─── Tags (delegate to LeadsService) ────────────────────

  async findTags(id: string, tenantId: string, user?: { id: string; role: string }) {
    // Verify this is a client
    await this.findById(id, tenantId, user);
    return this.leadsService.findTags(id, tenantId, user);
  }

  async addTag(
    id: string,
    dto: AddTagDto,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify this is a client
    await this.findById(id, user.tenantId, user);
    return this.leadsService.addTag(id, dto, user);
  }

  async removeTag(
    id: string,
    tagId: string,
    user: { id: string; role: string; tenantId: string },
  ) {
    // Verify this is a client
    await this.findById(id, user.tenantId, user);
    return this.leadsService.removeTag(id, tagId, user);
  }
}
