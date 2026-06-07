# Tasks, Notifications & Audit Log Module Specification

## Purpose
Supporting modules for manual task management, in-app notifications, and immutable user-level audit trails.

**Important v1 Decision:** Tasks are **fully manual** in v1. No auto-creation, no automation templates, no escalation rules.

## Data Model

### Database Tables

**tasks** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `title`: String
- `description`: String, nullable
- `status`: Enum [pending, inProgress, completed, cancelled]
- `priority`: Enum [low, medium, high, urgent]
- `dueDate`: Date, nullable
- `assignedToId`: UUIDv7 FK
- `createdById`: UUIDv7 FK
- `relatedType`: Enum [lead, deal, property, client]
- `relatedId`: UUIDv7
- `createdAt`, `updatedAt`, `deletedAt`

**notifications** (no soft delete):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `userId`: UUIDv7 FK
- `type`: Enum [lead_assigned, deal_stage_changed, commission_calculated, task_due, agent_departed, deal_closing_soon, chat_message]
- `title`: String
- `message`: String
- `data`: JSONB
- `isRead`: Boolean
- `readAt`: Timestamp, nullable
- `createdAt`

**auditLogs** (immutable, no soft delete):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `actorId`: UUIDv7 FK (who performed the action)
- `action`: Enum [login, logout, password_change, role_change, user_create, user_deactivate, user_reactivate, lead_create, lead_update, lead_stage_change, lead_assign, lead_convert, deal_create, deal_update, deal_stage_change, property_create, property_update, property_status_change, project_create, commission_calculated, task_create, task_complete, chat_message_sent]
- `targetType`: Enum [user, lead, deal, property, project, commission, task, organization, conversation]
- `targetId`: UUIDv7, nullable
- `metadata`: JSONB
- `ipAddress`: String
- `userAgent`: String
- `createdAt`

## API Endpoints

### Tasks

#### GET /api/tasks
**Query:** `?status=pending&assignedToId=uuid&relatedType=lead&relatedId=uuid&page=1&limit=20`

**Success 200:** Paginated task list.
- Agent: sees tasks assigned to them
- Manager: sees team tasks
- Admin: sees all

#### POST /api/tasks
**Request Body:**
```json
{
  "title": "Follow up with lead",
  "description": "Call John about the downtown apartment",
  "priority": "high",
  "dueDate": "2024-06-10T09:00:00Z",
  "assignedToId": "uuid",
  "relatedType": "lead",
  "relatedId": "uuid"
}
```

**Success 201:** Created task. Sends notification to assigned user.

**Note:** Tasks are **manually created only** in v1. No auto-generation from deals/leads.

#### GET /api/tasks/:id
**Success 200:** Task details.

#### PATCH /api/tasks/:id
**Request Body:** Partial fields.

#### POST /api/tasks/:id/complete
**Success 200:** Sets status to `completed`.

#### POST /api/tasks/:id/cancel
**Success 200:** Sets status to `cancelled`.

### Notifications

#### GET /api/notifications
**Query:** `?isRead=false&page=1&limit=20`

**Success 200:** User's notifications.

#### GET /api/notifications/unread-count
**Success 200:**
```json
{ "count": 5 }
```

#### POST /api/notifications/:id/read
**Success 200:** Marks as read. Sets `readAt`.

#### POST /api/notifications/read-all
**Success 200:** Marks all user's notifications as read.

### Audit Logs

#### GET /api/audit-logs
**Query:** `?actorId=uuid&action=deal_stage_change&targetType=deal&dateFrom=2024-01-01&dateTo=2024-12-31&page=1&limit=50`

**Success 200:** Paginated audit log entries.

**Access:** Admin and Manager only. Agent cannot view audit logs.

## Business Rules

### Tasks
1. Tasks can link to any entity (lead, deal, property, client)
2. Creating a task for another user sends them a notification
3. Overdue tasks appear in dashboard "overdue" count
4. Completed/cancelled tasks excluded from active lists by default
5. **No task automation in v1** — no auto-creation, no templates, no escalation
6. **No subtasks in v1** — simple single-level tasks only

### Notifications
1. Notifications created synchronously on events (no background job)
2. Types: lead_assigned, deal_stage_changed, commission_calculated, task_due, agent_departed, chat_message
3. Unread count cached in Redis per user (5 min TTL)
4. Notifications pruned after 90 days (or archived — deferred)

### Audit Logs
1. **Immutable** — no update or delete endpoints
2. Recorded automatically by service layer, not by controllers
3. Every significant mutation creates an audit entry
4. `metadata` contains before/after values for updates
5. Admin can query all tenant logs; Manager can query team logs
6. Super admin can query cross-tenant logs

## Error Codes

| Code | Status | When |
|------|--------|------|
| TASK_NOT_FOUND | 404 | Task ID doesn't exist |
| NOTIFICATION_NOT_FOUND | 404 | Notification ID doesn't exist |
| FORBIDDEN | 403 | Agent accessing audit logs |

## OpenAPI Notes
- Task endpoints show linked entity in responses
- Notification data field documented with per-type schema
- Audit log metadata examples show oldValue/newValue structure
- v1 limitation noted: no automation, no subtasks
