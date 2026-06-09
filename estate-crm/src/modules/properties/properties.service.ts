import { Injectable } from '@nestjs/common';
import { eq, and, or, ilike, count, sql, gte, lte, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { properties, projects, users } from '@/db/schema';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { createPaginatedResult } from '@/common/types/pagination.types';
import { canTransitionPropertyStatus } from '@/modules/shared/status-fsm';
import { validatePropertyAttributes } from '@/modules/properties/dto/property-attributes.dto';
import { PropertyType } from '@/modules/properties/enums/property-type.enum';
import { PropertyStatus } from '@/modules/properties/enums/property-status.enum';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@/config/app.config';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import type { PropertyFiltersDto } from './dto/property-filters.dto';

const PROPERTY_SORT_COLUMNS: Record<string, unknown> = {
  createdAt: properties.createdAt,
  updatedAt: properties.updatedAt,
  title: properties.title,
  price: properties.price,
  status: properties.status,
  type: properties.type,
};

@Injectable()
export class PropertiesService {
  async create(dto: CreatePropertyDto, actorId: string, tenantId: string) {
    // Validate type
    if (!Object.values(PropertyType).includes(dto.type)) {
      throw new AppError(ErrorCodes.PROPERTY_TYPE_INVALID, 400, `Invalid property type: ${dto.type}`);
    }

    let validatedAttributes = dto.attributes as Record<string, unknown> | undefined;
    if (validatedAttributes) {
      validatedAttributes = validatePropertyAttributes(dto.type, validatedAttributes);
    }

    // Verify project exists and belongs to same tenant
    if (dto.projectId) {
      const [existingProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, dto.projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
        .limit(1);

      if (!existingProject) {
        throw new AppError(ErrorCodes.PROJECT_NOT_FOUND, 404, 'Project not found in this tenant');
      }
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

    const [property] = await db
      .insert(properties)
      .values({
        tenantId,
        title: dto.title,
        address: dto.address,
        type: dto.type,
        price: dto.price,
        status: dto.status ?? 'active',
        beds: dto.beds ?? null,
        baths: dto.baths ?? null,
        sqft: dto.sqft ?? null,
        yearBuilt: dto.yearBuilt ?? null,
        attributes: (validatedAttributes ?? {}) as Record<string, unknown>,
        projectId: dto.projectId ?? null,
        agentId: dto.agentId ?? null,
      })
      .returning();

    return property;
  }

  async findAll(filters: PropertyFiltersDto, tenantId: string) {
    const { page, limit, sortBy, sortOrder, status, type, projectId, minPrice, maxPrice, beds, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(properties.tenantId, tenantId),
      isNull(properties.deletedAt),
    ];

    if (status) {
      conditions.push(eq(properties.status, status));
    }
    if (type) {
      conditions.push(eq(properties.type, type));
    }
    if (projectId) {
      conditions.push(eq(properties.projectId, projectId));
    }
    if (minPrice !== undefined) {
      conditions.push(gte(properties.price, minPrice));
    }
    if (maxPrice !== undefined) {
      conditions.push(lte(properties.price, maxPrice));
    }
    if (beds !== undefined) {
      conditions.push(gte(properties.beds, beds));
    }
    if (search) {
      conditions.push(
        or(ilike(properties.title, `%${search}%`), ilike(properties.address, `%${search}%`))!,
      );
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(properties)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const sortColumn = (PROPERTY_SORT_COLUMNS[sortBy] as typeof properties.createdAt) ?? properties.createdAt;

    const data = await db
      .select()
      .from(properties)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? sql`${sortColumn} asc` : sql`${sortColumn} desc`)
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, tenantId: string) {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
      .limit(1);

    if (!property) {
      throw new AppError(ErrorCodes.PROPERTY_NOT_FOUND, 404, 'Property not found');
    }

    return property;
  }

  async update(id: string, dto: UpdatePropertyDto, tenantId: string) {
    // Find existing (ensures ownership and not deleted)
    const existing = await this.findById(id, tenantId);

    // Re-validate attributes if type or attributes changed
    let validatedAttributes: Record<string, unknown> | undefined;
    const effectiveType: PropertyType = (dto.type ?? existing.type) as PropertyType;
    if (dto.attributes !== undefined) {
      validatedAttributes = validatePropertyAttributes(effectiveType, dto.attributes as Record<string, unknown>);
    } else if (dto.type !== undefined && existing.attributes) {
      validatedAttributes = validatePropertyAttributes(effectiveType, existing.attributes as Record<string, unknown>);
    }

    // Build update data matching UsersService pattern
    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.beds !== undefined) updateData.beds = dto.beds;
    if (dto.baths !== undefined) updateData.baths = dto.baths;
    if (dto.sqft !== undefined) updateData.sqft = dto.sqft;
    if (dto.yearBuilt !== undefined) updateData.yearBuilt = dto.yearBuilt;
    if (validatedAttributes !== undefined) updateData.attributes = validatedAttributes;
    if (dto.projectId !== undefined) updateData.projectId = dto.projectId;
    if (dto.agentId !== undefined) updateData.agentId = dto.agentId;
    if (dto.images !== undefined) updateData.images = dto.images;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(properties)
      .set(updateData as any)
      .where(eq(properties.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, tenantId: string) {
    // Verify exists
    await this.findById(id, tenantId);

    const now = new Date();
    const [deleted] = await db
      .update(properties)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(properties.id, id))
      .returning();

    return deleted;
  }

  async changeStatus(id: string, status: string, tenantId: string) {
    const property = await this.findById(id, tenantId);

    // Validate status is a valid enum value
    if (!Object.values(PropertyStatus).includes(status as PropertyStatus)) {
      throw new AppError(ErrorCodes.PROPERTY_STATUS_CONFLICT, 400, `Invalid property status: ${status}`);
    }

    // FSM check
    if (!canTransitionPropertyStatus(property.status, status)) {
      throw new AppError(
        ErrorCodes.PROPERTY_STATUS_CONFLICT,
        400,
        `Cannot transition property status from '${property.status}' to '${status}'`,
      );
    }

    const [updated] = await db
      .update(properties)
      .set({ status, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();

    return updated;
  }

  async getPresignedUploadUrl(propertyId: string, filename: string, contentType: string, tenantId: string) {
    // Verify property exists
    await this.findById(propertyId, tenantId);

    const s3Client = new S3Client({
      region: config.S3_REGION,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY,
        secretAccessKey: config.S3_SECRET_KEY,
      },
    });

    const key = `properties/${propertyId}/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const fileUrl = `https://${config.S3_BUCKET}.s3.${config.S3_REGION}.amazonaws.com/${key}`;

    return { uploadUrl, fileUrl };
  }
}