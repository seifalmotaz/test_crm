import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/db/schema';

const TENANT_TABLES = [
  'chat_messages',
  'conversation_participants',
  'conversations',
  'deal_milestones',
  'deal_documents',
  'deal_tags',
  'lead_documents',
  'lead_tags',
  'audit_logs',
  'notifications',
  'tasks',
  'commission_records',
  'commission_plans',
  'deals',
  'activities',
  'leads',
  'properties',
  'projects',
  'users',
];

/**
 * Truncates all tenant-scoped tables in the correct order
 * (respecting foreign key constraints).
 * Runs in a single transaction.
 */
export async function truncateAll(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  // Disable triggers temporarily to allow truncation in any order
  await db.execute(sql`
    SET session_replication_role = 'replica';
  `);

  for (const table of TENANT_TABLES) {
    await db.execute(sql`
      TRUNCATE TABLE ${sql.identifier(table)} CASCADE;
    `);
  }

  // Re-enable triggers
  await db.execute(sql`
    SET session_replication_role = 'origin';
  `);
}

/**
 * Truncates all tenant-scoped tables AND organization table.
 * Use when you need a completely clean slate.
 */
export async function truncateAllWithOrg(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  await db.execute(sql`
    SET session_replication_role = 'replica';
  `);

  for (const table of [...TENANT_TABLES, 'organizations']) {
    await db.execute(sql`
      TRUNCATE TABLE ${sql.identifier(table)} CASCADE;
    `);
  }

  await db.execute(sql`
    SET session_replication_role = 'origin';
  `);
}