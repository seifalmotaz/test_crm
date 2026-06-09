import { Injectable } from '@nestjs/common';
import { eq, and, or, ilike, count, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import { organizations, users, commissionPlans } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { hashPassword } from '@/common/utils/password';
import { createPaginatedResult } from '@/common/types/pagination.types';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { OrganizationFiltersDto } from './dto/organization-filters.dto';

@Injectable()
export class OrganizationsService {
  async create(dto: CreateOrganizationDto) {
    return db.transaction(async (tx) => {
      const [existingSlug] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, dto.slug))
        .limit(1);

      if (existingSlug) {
        throw new AppError(ErrorCodes.SLUG_EXISTS, 409, 'Slug already exists');
      }

      const [existingEmail] = await tx
        .select()
        .from(users)
        .where(eq(users.email, dto.adminEmail))
        .limit(1);

      if (existingEmail) {
        throw new AppError(ErrorCodes.EMAIL_EXISTS, 409, 'Email already in use');
      }

      const [org] = await tx
        .insert(organizations)
        .values({
          name: dto.name,
          slug: dto.slug,
          plan: dto.plan ?? 'basic',
          status: 'active',
        })
        .returning();

      const passwordHash = await hashPassword(dto.adminPassword);

      const [adminUser] = await tx
        .insert(users)
        .values({
          tenantId: org.id,
          email: dto.adminEmail,
          passwordHash,
          name: dto.adminName,
          role: 'admin',
          status: 'active',
        })
        .returning();

      const [commissionPlan] = await tx
        .insert(commissionPlans)
        .values({
          tenantId: org.id,
          name: 'Default',
          type: 'percentage',
          rate: '0.0300',
          isDefault: true,
        })
        .returning();

      return { organization: org, adminUser, commissionPlan };
    });
  }

  async findById(id: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      throw new AppError(ErrorCodes.ORGANIZATION_NOT_FOUND, 404, 'Organization not found');
    }

    const [userCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.tenantId, id));

    return { ...org, userCount: userCountResult?.count ?? 0 };
  }

  async findAll(filters: OrganizationFiltersDto) {
    const { page, limit, sortBy, sortOrder, search, status, plan } = filters;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(eq(organizations.status, status));
    }
    if (plan) {
      conditions.push(eq(organizations.plan, plan));
    }
    if (search) {
      conditions.push(
        or(ilike(organizations.name, `%${search}%`), ilike(organizations.slug, `%${search}%`))!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(organizations)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const sortColumns: Record<string, unknown> = {
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      plan: organizations.plan,
    };
    const sortColumn = (sortColumns[sortBy] as typeof organizations.createdAt) ?? organizations.createdAt;

    const orgs = await db
      .select()
      .from(organizations)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? sql`${sortColumn} asc` : sql`${sortColumn} desc`)
      .limit(limit)
      .offset(offset);

    const orgIds = orgs.map((o) => o.id);

    let userCounts: Record<string, number> = {};
    if (orgIds.length > 0) {
      const counts = await db
        .select({ tenantId: users.tenantId, count: count() })
        .from(users)
        .where(
          sql`${users.tenantId} IN (${sql.join(orgIds.map((id) => sql`${id}`), sql`, `)})`,
        )
        .groupBy(users.tenantId);

      for (const row of counts) {
        userCounts[row.tenantId] = row.count;
      }
    }

    const data = orgs.map((org) => ({
      ...org,
      userCount: userCounts[org.id] ?? 0,
    }));

    return createPaginatedResult(data, total, page, limit);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!existing) {
        throw new AppError(ErrorCodes.ORGANIZATION_NOT_FOUND, 404, 'Organization not found');
      }

      if (dto.slug && dto.slug !== existing.slug) {
        const [slugConflict] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.slug, dto.slug))
          .limit(1);

        if (slugConflict) {
          throw new AppError(ErrorCodes.SLUG_EXISTS, 409, 'Slug already exists');
        }
      }

      const [updated] = await tx
        .update(organizations)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning();

      return updated;
    });
  }

  async delete(id: string) {
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError(ErrorCodes.ORGANIZATION_NOT_FOUND, 404, 'Organization not found');
    }

    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async activate(id: string) {
    const [updated] = await db
      .update(organizations)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCodes.ORGANIZATION_NOT_FOUND, 404, 'Organization not found');
    }

    return updated;
  }

  async suspend(id: string) {
    const [updated] = await db
      .update(organizations)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCodes.ORGANIZATION_NOT_FOUND, 404, 'Organization not found');
    }

    return updated;
  }
}
