import { Injectable } from '@nestjs/common';
import { db as defaultDb } from '@/db/connection';
import { activities } from '@/db/schema';
import { eq, and, desc, ilike, count, SQL } from 'drizzle-orm';
import { createPaginatedResult } from '@/common/types/pagination.types';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/db/schema';
import { ActivityFiltersDto } from './dto/activity-filters.dto';

type DbOrTx = PostgresJsDatabase<typeof schema> | typeof defaultDb;

@Injectable()
export class DealsActivitiesService {
  /**
   * Log an activity for a deal. Accepts either a `db` or a `tx` (transaction) instance.
   * Returns the inserted activity record.
   */
  async logActivity(
    target: DbOrTx,
    params: {
      tenantId: string;
      dealId: string;
      type: string;
      content: string;
      agentId: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<typeof activities.$inferSelect> {
    const [activity] = await target
      .insert(activities)
      .values({
        tenantId: params.tenantId,
        entityType: 'deal',
        entityId: params.dealId,
        type: params.type,
        content: params.content,
        metadata: params.metadata ?? null,
        agentId: params.agentId,
      })
      .returning();
    return activity;
  }

  /**
   * List activities for a deal, paginated, sorted by createdAt DESC.
   */
  async findActivities(
    dealId: string,
    tenantId: string,
    filters: ActivityFiltersDto,
  ) {
    const { page, limit, type, search } = filters;
    const offset = (page - 1) * limit;

    const conditions: (SQL | undefined)[] = [
      eq(activities.tenantId, tenantId),
      eq(activities.entityType, 'deal'),
      eq(activities.entityId, dealId),
    ];

    if (type) {
      conditions.push(eq(activities.type, type));
    }
    if (search) {
      conditions.push(ilike(activities.content, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await defaultDb
      .select({ count: count() })
      .from(activities)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const data = await defaultDb
      .select()
      .from(activities)
      .where(whereClause)
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);

    return createPaginatedResult(data, total, page, limit);
  }
}
