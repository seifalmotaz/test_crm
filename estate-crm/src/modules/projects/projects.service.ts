import { Injectable } from '@nestjs/common';
import { eq, and, ilike, count, sql, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { projects } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import { canTransitionProjectStatus } from '@/modules/shared/status-fsm';
import { ProjectStatus } from '@/modules/projects/enums/project-status.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import type { ProjectFiltersDto } from './dto/project-filters.dto';

const PROJECT_SORT_COLUMNS: Record<string, unknown> = {
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  name: projects.name,
  status: projects.status,
};

@Injectable()
export class ProjectsService {
  async create(dto: CreateProjectDto, actorId: string, tenantId: string) {
    const [project] = await db
      .insert(projects)
      .values({
        tenantId,
        name: dto.name,
        location: dto.location,
        description: dto.description ?? undefined,
        developerName: dto.developerName ?? undefined,
        launchDate: dto.launchDate ? new Date(dto.launchDate) : undefined,
        completionDate: dto.completionDate ? new Date(dto.completionDate) : undefined,
        totalUnits: dto.totalUnits ?? undefined,
        commissionPlanId: dto.commissionPlanId ?? null,
      })
      .returning();

    return project;
  }

  async findAll(filters: ProjectFiltersDto, tenantId: string) {
    const { page, limit, sortBy, sortOrder, status, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(projects.tenantId, tenantId),
      isNull(projects.deletedAt),
    ];

    if (status) {
      conditions.push(eq(projects.status, status));
    }
    if (search) {
      conditions.push(ilike(projects.name, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const sortColumn = (PROJECT_SORT_COLUMNS[sortBy] as typeof projects.createdAt) ?? projects.createdAt;

    const data = await db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? sql`${sortColumn} asc` : sql`${sortColumn} desc`)
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, tenantId: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      throw new AppError(ErrorCodes.PROJECT_NOT_FOUND, 404, 'Project not found');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, tenantId: string) {
    // Find existing (ensures ownership and not deleted)
    await this.findById(id, tenantId);

    // Build update data matching the pattern from UsersService
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.developerName !== undefined) updateData.developerName = dto.developerName;
    if (dto.launchDate !== undefined) updateData.launchDate = dto.launchDate;
    if (dto.completionDate !== undefined) updateData.completionDate = dto.completionDate;
    if (dto.totalUnits !== undefined) updateData.totalUnits = dto.totalUnits;
    if (dto.commissionPlanId !== undefined) updateData.commissionPlanId = dto.commissionPlanId;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(projects)
      .set(updateData as any)
      .where(eq(projects.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, tenantId: string) {
    // Verify exists
    await this.findById(id, tenantId);

    const now = new Date();
    const [deleted] = await db
      .update(projects)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(projects.id, id))
      .returning();

    return deleted;
  }

  async changeStatus(id: string, status: string, tenantId: string) {
    const project = await this.findById(id, tenantId);

    // Validate status is a valid enum value
    if (!Object.values(ProjectStatus).includes(status as ProjectStatus)) {
      throw new AppError(ErrorCodes.PROJECT_STATUS_INVALID, 400, `Invalid project status: ${status}`);
    }

    // FSM check
    if (!canTransitionProjectStatus(project.status, status)) {
      throw new AppError(
        ErrorCodes.PROJECT_STATUS_INVALID,
        400,
        `Cannot transition project status from '${project.status}' to '${status}'`,
      );
    }

    const [updated] = await db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    return updated;
  }
}