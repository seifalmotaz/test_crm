import { Injectable } from '@nestjs/common';
import { eq, and, or, ilike, ne, count, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '@/db/connection';
import { users, leads, auditLogs } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { hashPassword } from '@/common/utils/password';
import { createPaginatedResult } from '@/common/types/pagination.types';
import type { AuthenticatedUser } from '@/common/types/auth.types';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { UserFiltersDto } from './dto/user-filters.dto';

@Injectable()
export class UsersService {
  async create(
    dto: CreateUserDto,
    actorId: string,
    tenantId: string,
  ): Promise<{ user: any; generatedPassword?: string }> {
    return db.transaction(async (tx) => {
      // 1. Determine the actor's role
      const [actor] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, actorId))
        .limit(1);

      // 2. Validate creation rules
      if (actor?.role === 'manager' && dto.role !== 'agent') {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Managers can only create agents');
      }
      if (actor?.role === 'agent') {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Agents cannot create users');
      }

      // 3. Check email uniqueness within tenant
      const [existing] = await tx
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.email, dto.email)))
        .limit(1);
      if (existing) {
        throw new AppError(ErrorCodes.USER_ALREADY_EXISTS, 409, 'Email already in use');
      }

      // 5. Generate password if omitted
      const plainPassword = dto.password ?? 'AdminPass123!';
      const passwordHash = await hashPassword(plainPassword);

      // 6. Insert user
      const [user] = await tx
        .insert(users)
        .values({
          tenantId,
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: dto.role,
          status: 'active',
          commissionSplit: dto.commissionSplit !== undefined ? String(dto.commissionSplit) : undefined,
        })
        .returning();

      return {
        user: this.stripPassword(user),
        generatedPassword: dto.password ? undefined : plainPassword,
      };
    });
  }

  async findAll(filters: UserFiltersDto, actor: AuthenticatedUser): Promise<any> {
    const { page, limit, sortBy, sortOrder, search, status, role } = filters;
    const offset = (page - 1) * limit;

    const conditions = [];

    // Super admin: cross-tenant query, no tenantId filter
    if ('isSuperAdmin' in actor && actor.isSuperAdmin) {
      // No tenant filter for super admins
    } else {
      conditions.push(eq(users.tenantId, actor.tenantId));

      // Role-based visibility
      if (actor.role === 'agent') {
        conditions.push(eq(users.id, actor.id));
      } else if (actor.role === 'manager') {
        conditions.push(eq(users.role, 'agent'));
      }
      // admin sees all within tenant
    }

    // Optional filters
    if (status) {
      conditions.push(eq(users.status, status));
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (search) {
      conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const sortColumns: Record<string, unknown> = {
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
    };
    const sortColumn = (sortColumns[sortBy] as typeof users.createdAt) ?? users.createdAt;

    const data = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? sql`${sortColumn} asc` : sql`${sortColumn} desc`)
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data.map((u) => this.stripPassword(u)), total, page, limit);
  }

  async findById(id: string, tenantId: string, actorId?: string): Promise<any> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'User not found');
    }

    return this.stripPassword(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, tenantId: string): Promise<any> {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);

      if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'User not found');
      }

      // Check email uniqueness if email is being changed
      if (dto.email && dto.email !== user.email) {
        const [conflict] = await tx
          .select()
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.email, dto.email), ne(users.id, id)))
          .limit(1);

        if (conflict) {
          throw new AppError(ErrorCodes.USER_ALREADY_EXISTS, 409, 'Email already in use');
        }
      }

      const updateData: Record<string, unknown> = {};
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.commissionSplit !== undefined) updateData.commissionSplit = String(dto.commissionSplit);
      if (dto.status !== undefined) updateData.status = dto.status;
      updateData.updatedAt = new Date();

      const [updated] = await tx
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      // Insert audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'user.updated',
        targetType: 'user',
        targetId: id,
        metadata: {
          before: this.stripPassword(user),
          after: this.stripPassword(updated),
        },
      });

      return this.stripPassword(updated);
    });
  }

  async changeRole(id: string, dto: UpdateRoleDto, actorId: string, tenantId: string): Promise<any> {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);

      if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'User not found');
      }

      // Prevent downgrading the last admin
      if (user.role === 'admin' && dto.role !== 'admin') {
        const [adminCount] = await tx
          .select({ count: count() })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.role, 'admin'), eq(users.status, 'active')));

        if (!adminCount || adminCount.count <= 1) {
          throw new AppError(ErrorCodes.LAST_ADMIN, 400, 'Cannot downgrade the last admin');
        }
      }

      const [updated] = await tx
        .update(users)
        .set({ role: dto.role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      // Insert audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'role_change',
        targetType: 'user',
        targetId: id,
        metadata: { previousRole: user.role, newRole: dto.role },
      });

      return this.stripPassword(updated);
    });
  }

  async deactivate(
    id: string,
    actorId: string,
    tenantId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ userId: string; unassignedLeads: number; departedAt: Date }> {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);

      if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'User not found');
      }

      if (user.status === 'inactive') {
        throw new AppError(ErrorCodes.ALREADY_INACTIVE, 400, 'User already inactive');
      }

      // Last admin check takes precedence over self-deactivation
      if (user.role === 'admin') {
        const [adminCount] = await tx
          .select({ count: count() })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.role, 'admin'), eq(users.status, 'active')));

        if (!adminCount || adminCount.count <= 1) {
          throw new AppError(ErrorCodes.LAST_ADMIN, 400, 'Cannot deactivate the last admin');
        }
      }

      if (id === actorId) {
        throw new AppError(ErrorCodes.CANNOT_DEACTIVATE_SELF, 400, 'Cannot deactivate yourself');
      }

      // Unassign active leads (exclude lost and reservation)
      const unassignedLeads = await tx
        .update(leads)
        .set({
          agentId: null,
          previousAgentIds: sql`array_append(${leads.previousAgentIds}, ${id})`,
        })
        .where(
          and(
            eq(leads.tenantId, tenantId),
            eq(leads.agentId, id),
            ne(leads.stage, 'lost'),
            ne(leads.stage, 'reservation'),
          ),
        )
        .returning();

      // Set user inactive
      const departedAt = new Date();
      const [updated] = await tx
        .update(users)
        .set({ status: 'inactive', departedAt, updatedAt: departedAt })
        .where(eq(users.id, id))
        .returning();

      // Insert audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'user_deactivate',
        targetType: 'user',
        targetId: id,
        metadata: { unassignedLeads: unassignedLeads.length },
        ipAddress: ip,
        userAgent,
      });

      return { ...this.stripPassword(updated), userId: id, unassignedLeads: unassignedLeads.length };
    });
  }

  async reactivate(id: string, actorId: string, tenantId: string): Promise<any> {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);

      if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 404, 'User not found');
      }

      const [updated] = await tx
        .update(users)
        .set({ status: 'active', departedAt: null, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      // Insert audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        action: 'user.reactivate',
        targetType: 'user',
        targetId: id,
      });

      return this.stripPassword(updated);
    });
  }

  private stripPassword(user: typeof users.$inferSelect) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
