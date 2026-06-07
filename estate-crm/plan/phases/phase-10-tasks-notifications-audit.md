# Phase 10: Tasks, Notifications, Chat & Audit Log

## Goal
Implement supporting modules for **manual** task management, in-app notifications, chat messaging, and immutable user-level audit trails.

**v1 Decisions:**
- Tasks are **fully manual** — no auto-creation, no templates, no escalation rules
- Chat is **polling-based** — no WebSockets in v1
- Commission records have **no settlement workflow** — immutable logs only

## Why This Phase Tenth
These are the operational glue that keeps the CRM functional: tasks ensure follow-ups happen, notifications keep users informed, chat enables team coordination, and audit logs provide accountability.

---

## File Manifest

- `src/modules/tasks/tasks.module.ts`
- `src/modules/tasks/dto/create-task.dto.ts`
- `src/modules/tasks/dto/update-task.dto.ts`
- `src/modules/tasks/enums/task-status.enum.ts`
- `src/modules/tasks/enums/task-priority.enum.ts`
- `src/modules/tasks/tasks.service.ts`
- `src/modules/activities/activities.module.ts`
- `src/modules/activities/dto/create-activity.dto.ts`
- `src/modules/activities/enums/activity-type.enum.ts`
- `src/modules/activities/activities.service.ts`
- `src/modules/activities/activities.controller.ts`
- `src/modules/notifications/notifications.module.ts`
- `src/modules/notifications/dto/create-notification.dto.ts`
- `src/modules/notifications/notifications.service.ts`
- `src/modules/notifications/notifications.controller.ts`
- `src/modules/chat/chat.module.ts`
- `src/modules/chat/dto/create-conversation.dto.ts`
- `src/modules/chat/dto/send-message.dto.ts`
- `src/modules/chat/enums/conversation-type.enum.ts`
- `src/modules/chat/enums/message-type.enum.ts`
- `src/modules/chat/chat.service.ts`
- `src/modules/chat/chat.controller.ts`
- `src/modules/audit/audit.module.ts`
- `src/modules/audit/audit.service.ts`
- `src/modules/audit/audit.controller.ts`

---

## Task Breakdown

### 10.1 Tasks Schema

```typescript
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  assignedToId: uuid('assigned_to_id').notNull(),
  createdById: uuid('created_by_id').notNull(),
  relatedType: varchar('related_type', { length: 20 }),
  relatedId: uuid('related_id'),
  createdAt, updatedAt, deletedAt,
});
```

### 10.2 Activities Schema

```typescript
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  entityType: varchar('entity_type', { length: 20 }).notNull(), // 'lead' | 'deal'
  entityId: uuid('entity_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  agentId: uuid('agent_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Activity Types:**
- `call`, `email`, `meeting`, `note`, `whatsapp`, `sms`, `voicemail`, `directMail`
- `stageChange` — automatic when lead/deal stage changes
- `assignment` — automatic when lead/deal reassigned
- `documentUpload` — automatic when document uploaded
- `tagAdded`, `tagRemoved` — automatic when tags change
- `dncSet`, `dncRemoved` — automatic when DNC flag changes
- `converted` — automatic when lead converted to client
- `comment` — manual agent comment

### 10.3 Notifications Schema

```typescript
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 10.3 Chat Schema

```typescript
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }),
  createdById: uuid('created_by_id'),
  createdAt, updatedAt, deletedAt,
});

export const conversationParticipants = pgTable('conversation_participants', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  conversationId: uuid('conversation_id').notNull(),
  userId: uuid('user_id').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  conversationId: uuid('conversation_id').notNull(),
  senderId: uuid('sender_id').notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('text'),
  fileUrl: text('file_url'),
  fileName: varchar('file_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 10.4 Audit Log Schema

```typescript
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetId: uuid('target_id'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 10.5 Chat Endpoints

- `GET /api/chat/conversations` — List user's conversations with last message preview
- `POST /api/chat/conversations` — Create direct or group conversation
- `GET /api/chat/conversations/:id` — Get conversation with participants
- `GET /api/chat/conversations/:id/messages` — Paginated messages (cursor-based)
- `POST /api/chat/conversations/:id/messages` — Send text or file message
- `POST /api/chat/conversations/:id/read` — Mark all messages as read

**Business Rules:**
1. Users can only chat with users in the same tenant
2. Direct conversations are unique per pair of users
3. Messages are append-only (no edit, no delete in v1)
4. File uploads use S3 pre-signed URLs
5. **No real-time WebSockets in v1** — polling only
6. **No message reactions/threads in v1** — simple linear chat

### 10.6 Integration Tests

```typescript
describe('Tasks & Notifications', () => {
  it('should create task and notify assignee', async () => {
    // POST /api/tasks assigned to agent
    // Assert task created
    // Assert notification sent to agent
  });
  
  it('should mark notification as read', async () => {
    // Create notification
    // POST /api/notifications/:id/read
    // Assert isRead = true
  });
});

describe('Chat', () => {
  it('should create direct conversation', async () => {
    // POST /api/chat/conversations { type: 'direct', participantIds: ['uuid'] }
    // Assert 201
  });
  
  it('should send and retrieve messages', async () => {
    // Create conversation
    // POST /api/chat/conversations/:id/messages { content: 'Hello' }
    // GET /api/chat/conversations/:id/messages
    // Assert message in list
  });
});

describe('Activities', () => {
  it('should log manual activity on lead', async () => {
    // POST /api/leads/:id/activities { type: 'call', content: '...' }
    // Assert activity created
    // GET /api/leads/:id/activities
    // Assert activity in timeline
  });
  
  it('should auto-log stage change activity', async () => {
    // Change lead stage
    // Assert stageChange activity created automatically
    // Assert metadata contains { from, to }
  });
  
  it('should auto-log assignment activity', async () => {
    // Reassign lead to different agent
    // Assert assignment activity created automatically
    // Assert metadata contains { fromAgentId, toAgentId }
  });
  
  it('should auto-log DNC flag activity', async () => {
    // Set DNC on lead
    // Assert dncSet activity created automatically
  });
  
  it('should show deal activity timeline', async () => {
    // Create deal
    // Advance deal stage (triggers stageChange activity)
    // Upload document (triggers documentUpload activity)
    // GET /api/deals/:id/activities
    // Assert timeline contains all activities in order
  });
});

describe('Audit Log', () => {
  it('should record user actions', async () => {
    // Perform action (e.g., update lead)
    // GET /api/audit-logs
    // Assert action recorded with actor, target, metadata
  });
  
  it('should reject agent viewing audit logs', async () => {
    // Agent auth
    // GET /api/audit-logs
    // Assert 403 FORBIDDEN
  });
});
```

---

## Dependencies
- Phase 4 (Users exist)
- Phase 5 (Properties exist for file upload pattern reuse)

## Verification

- [ ] Creating task for another user sends notification
- [ ] Unread count endpoint returns correct count
- [ ] Audit log records login with IP and user agent
- [ ] Admin can query audit logs filtered by action type
- [ ] Agent cannot access audit logs
- [ ] Chat conversations scoped to tenant
- [ ] Direct chats unique per user pair
- [ ] Messages paginated with cursor-based pagination
- [ ] No WebSockets in v1 — polling-based messaging
- [ ] **Activity timeline shows chronological activities for leads and deals**
- [ ] **Stage changes auto-create stageChange activities**
- [ ] **Assignments auto-create assignment activities**
- [ ] **DNC changes auto-create dncSet/dncRemoved activities**
- [ ] **Document uploads auto-create documentUpload activities**
- [ ] **Tag changes auto-create tagAdded/tagRemoved activities**

## Business Rules

### Tasks
1. Tasks can link to any entity (lead, deal, property, client)
2. Creating a task for another user sends them a notification
3. Overdue tasks appear in dashboard "overdue" count
4. **No task automation in v1** — no auto-creation, no templates, no escalation
5. **No subtasks in v1** — simple single-level tasks only

### Notifications
1. Notifications created synchronously on events
2. Types: lead_assigned, deal_stage_changed, commission_calculated, task_due, agent_departed, chat_message
3. Unread count cached in Redis per user (5 min TTL)

### Chat
1. Polling-based messaging in v1 (WebSockets deferred to v2)
2. File sharing via S3 pre-signed URLs
3. Group and direct conversations supported
4. Unread counts per conversation

### Audit Logs
1. **Immutable** — no update or delete endpoints
2. Recorded automatically by service layer
3. Every significant mutation creates an audit entry
4. Admin can query all tenant logs

## Risks

| Risk | Mitigation |
|------|-----------|
| Audit log table growth | No pruning in v1; PostgreSQL partitioning deferred to v2 |
| Chat message bloat | Cursor pagination, no hard limit on history in v1 |
| Notification spam | Synchronous creation only on significant events |

## Error Codes

| Code | Status | When |
|------|--------|------|
| TASK_NOT_FOUND | 404 | Task ID doesn't exist |
| NOTIFICATION_NOT_FOUND | 404 | Notification ID doesn't exist |
| CONVERSATION_NOT_FOUND | 404 | Conversation doesn't exist or user not participant |
| FORBIDDEN | 403 | Agent accessing audit logs |
