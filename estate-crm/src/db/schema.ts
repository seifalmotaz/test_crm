import { pgTable, uuid, varchar, text, integer, decimal, boolean, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

// 1. organizations (NO tenantId, NO deletedAt)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  plan: varchar('plan', { length: 20 }).notNull().default('basic'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  departedAt: timestamp('departed_at', { withTimezone: true }),
  commissionSplit: decimal('commission_split', { precision: 5, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('users_tenant_email_idx').on(t.tenantId, t.email),
]);

// 3. projects
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 255 }).notNull(),
  developerName: varchar('developer_name', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('planning'),
  launchDate: timestamp('launch_date', { withTimezone: true }),
  completionDate: timestamp('completion_date', { withTimezone: true }),
  totalUnits: integer('total_units'),
  soldUnits: integer('sold_units').default(0),
  commissionPlanId: uuid('commission_plan_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('projects_tenant_id_idx').on(t.tenantId),
]);

// 4. properties
export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id),
  title: varchar('title', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  price: integer('price').notNull(),
  beds: integer('beds'),
  baths: integer('baths'),
  sqft: integer('sqft'),
  yearBuilt: integer('year_built'),
  attributes: jsonb('attributes'),
  images: text('images').array().default([]),
  videos: text('videos').array().default([]),
  tags: text('tags').array().default([]),
  agentId: uuid('agent_id').references(() => users.id),
  commissionPlanId: uuid('commission_plan_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('properties_tenant_id_idx').on(t.tenantId),
]);

// 5. leads
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  source: varchar('source', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  budgetMin: integer('budget_min'),
  budgetMax: integer('budget_max'),
  timeline: integer('timeline'),
  preferredLocation: varchar('preferred_location', { length: 255 }),
  preferredType: varchar('preferred_type', { length: 20 }),
  stage: varchar('stage', { length: 20 }).notNull().default('fresh'),
  score: integer('score').default(0),
  agentId: uuid('agent_id').references(() => users.id),
  previousAgentIds: text('previous_agent_ids').array().default([]),
  notes: text('notes'),
  nextAction: varchar('next_action', { length: 255 }),
  nextActionDate: timestamp('next_action_date', { withTimezone: true }),
  isConverted: boolean('is_converted').default(false),
  convertedToClientId: uuid('converted_to_client_id'),
  isDnc: boolean('is_dnc').default(false),
  dncReason: varchar('dnc_reason', { length: 500 }),
  dncSetAt: timestamp('dnc_set_at', { withTimezone: true }),
  dncSetById: uuid('dnc_set_by_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('leads_tenant_id_idx').on(t.tenantId),
]);

// 6. activities (polymorphic, append-only — NO deletedAt, NO updatedAt)
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 10 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  agentId: uuid('agent_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('activities_tenant_id_idx').on(t.tenantId),
]);

// 7. clients
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  isVip: boolean('is_vip').default(false),
  vipSetById: uuid('vip_set_by_id').references(() => users.id),
  vipSetAt: timestamp('vip_set_at', { withTimezone: true }),
  lifetimeValue: integer('lifetime_value').default(0),
  agentId: uuid('agent_id').notNull().references(() => users.id),
  convertedFromLeadId: uuid('converted_from_lead_id').references(() => leads.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('clients_tenant_id_idx').on(t.tenantId),
]);

// 8. deals
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id').references(() => properties.id),
  leadId: uuid('lead_id').references(() => leads.id),
  clientId: uuid('client_id').references(() => clients.id),
  agentId: uuid('agent_id').notNull().references(() => users.id),
  type: varchar('type', { length: 20 }).notNull(),
  value: integer('value').notNull(),
  stage: varchar('stage', { length: 20 }).notNull().default('initialContact'),
  probability: integer('probability').default(50),
  offerDate: timestamp('offer_date', { withTimezone: true }),
  targetCloseDate: timestamp('target_close_date', { withTimezone: true }),
  closingDate: timestamp('closing_date', { withTimezone: true }),
  daysUntilClose: integer('days_until_close'),
  daysElapsed: integer('days_elapsed').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('deals_tenant_id_idx').on(t.tenantId),
]);

// 9. commissionPlans
export const commissionPlans = pgTable('commission_plans', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  rate: decimal('rate', { precision: 5, scale: 4 }),
  flatAmount: integer('flat_amount'),
  tierConfig: jsonb('tier_config'),
  splitConfig: jsonb('split_config').default({ listingAgentShare: 50, buyerAgentShare: 50 }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('commission_plans_tenant_id_idx').on(t.tenantId),
]);

// 10. commissionRecords (NO deletedAt, NO updatedAt — immutable)
export const commissionRecords = pgTable('commission_records', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  agentId: uuid('agent_id').notNull().references(() => users.id),
  propertyId: uuid('property_id').references(() => properties.id),
  planId: uuid('plan_id').notNull().references(() => commissionPlans.id),
  calculatedAmount: integer('calculated_amount').notNull(),
  brokerageAmount: integer('brokerage_amount').notNull(),
  agentPayoutAmount: integer('agent_payout_amount').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('calculated'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('commission_records_tenant_id_idx').on(t.tenantId),
]);

// 11. tasks
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  assignedToId: uuid('assigned_to_id').notNull().references(() => users.id),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  relatedType: varchar('related_type', { length: 20 }),
  relatedId: uuid('related_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('tasks_tenant_id_idx').on(t.tenantId),
]);

// 12. notifications (NO deletedAt)
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('notifications_tenant_id_idx').on(t.tenantId),
]);

// 13. auditLogs (NO deletedAt, NO updatedAt — immutable)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 30 }).notNull(),
  targetId: uuid('target_id'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('audit_logs_tenant_id_idx').on(t.tenantId),
]);

// 14. leadTags
export const leadTags = pgTable('lead_tags', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  leadId: uuid('lead_id').notNull().references(() => leads.id),
  tag: varchar('tag', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).notNull(),
}, (t) => [
  uniqueIndex('lead_tags_lead_tag_idx').on(t.leadId, t.tag),
]);

// 15. leadDocuments
export const leadDocuments = pgTable('lead_documents', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  leadId: uuid('lead_id').notNull().references(() => leads.id),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 1000 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
});

// 16. dealTags
export const dealTags = pgTable('deal_tags', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  tag: varchar('tag', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).notNull(),
}, (t) => [
  uniqueIndex('deal_tags_deal_tag_idx').on(t.dealId, t.tag),
]);

// 17. dealDocuments
export const dealDocuments = pgTable('deal_documents', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 1000 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
});

// 18. dealMilestones
export const dealMilestones = pgTable('deal_milestones', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  name: varchar('name', { length: 255 }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 19. conversations
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 10 }).notNull(),
  title: varchar('title', { length: 255 }),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('conversations_tenant_id_idx').on(t.tenantId),
]);

// 20. conversationParticipants
export const conversationParticipants = pgTable('conversation_participants', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('conv_participants_conv_user_idx').on(t.conversationId, t.userId),
]);

// 21. chatMessages (append-only — NO deletedAt, NO updatedAt)
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  type: varchar('type', { length: 10 }).notNull().default('text'),
  fileUrl: varchar('file_url', { length: 1000 }),
  fileName: varchar('file_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
