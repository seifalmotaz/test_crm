# Chat Module Specification

## Purpose
In-app messaging system for users within a tenant. Supports direct conversations and group channels. Replaces external messaging (WhatsApp, email) for team communication.

**v1 Inclusion:** Yes — included in v1 per user decision.

## Data Model

### Database Tables

**conversations** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `type`: Enum [direct, group]
- `title`: String, nullable (for group chats)
- `createdById`: UUIDv7 FK
- `createdAt`, `updatedAt`, `deletedAt`

**conversationParticipants** (junction):
- `id`: UUIDv7 PK
- `conversationId`: UUIDv7 FK
- `userId`: UUIDv7 FK
- `joinedAt`: Timestamp
- `lastReadAt`: Timestamp, nullable

**chatMessages** (append-only):
- `id`: UUIDv7 PK
- `conversationId`: UUIDv7 FK
- `senderId`: UUIDv7 FK
- `content`: Text
- `type`: Enum [text, file]
- `fileUrl`: String, nullable
- `fileName`: String, nullable
- `createdAt`

## API Endpoints

### Conversations

#### GET /api/chat/conversations
**Success 200:** List of user's conversations with last message preview and unread count.

```json
[
  {
    "id": "uuid",
    "type": "direct",
    "title": null,
    "participants": [{ "id": "uuid", "name": "Alice" }],
    "lastMessage": { "content": "Hello", "createdAt": "2024-06-07T10:00:00Z" },
    "unreadCount": 3
  }
]
```

#### POST /api/chat/conversations
**Request Body:**
```json
{
  "type": "direct",
  "participantIds": ["uuid"] // For direct: exactly 1 other user
}
```

**Request Body (group):**
```json
{
  "type": "group",
  "title": "Sales Team",
  "participantIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Success 201:** Created conversation.

**Errors:**
- `400 VALIDATION_ERROR` — Invalid participant count or missing title for group
- `409 CONVERSATION_EXISTS` — Direct chat with same user already exists

#### GET /api/chat/conversations/:id
**Success 200:** Conversation with participant list.

#### DELETE /api/chat/conversations/:id
**Success 204:** Soft delete. Removes user from conversation (not the conversation itself).

### Messages

#### GET /api/chat/conversations/:id/messages
**Query:** `?before=uuid&limit=50`

**Success 200:** Paginated messages (newest first, cursor-based pagination).

```json
{
  "messages": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "senderName": "Alice",
      "content": "The client is ready to close",
      "type": "text",
      "createdAt": "2024-06-07T10:00:00Z"
    }
  ],
  "nextCursor": "uuid"
}
```

#### POST /api/chat/conversations/:id/messages
**Request Body:**
```json
{
  "content": "The client is ready to close",
  "type": "text"
}
```

**Request Body (file):**
```json
{
  "content": "Contract.pdf",
  "type": "file",
  "fileUrl": "https://s3.../contract.pdf",
  "fileName": "Contract.pdf"
}
```

**Success 201:** Created message.

**Side Effects:**
- Creates notifications for all other participants
- Updates conversation `lastMessageAt`

#### POST /api/chat/conversations/:id/read
**Success 200:** Marks all messages in conversation as read for current user.

## Business Rules

1. Users can only chat with users in the same tenant
2. Direct conversations are unique per pair of users (no duplicate direct chats)
3. Group conversations can have any number of participants (min 2)
4. Messages are append-only (no edit, no delete in v1)
5. File uploads use S3 pre-signed URLs (same as property media)
6. Notifications sent to offline participants
7. **No real-time WebSockets in v1** — polling only. WebSockets deferred to v2.
8. **No message reactions/threads in v1** — simple linear chat only.

## Error Codes

| Code | Status | When |
|------|--------|------|
| CONVERSATION_NOT_FOUND | 404 | Conversation doesn't exist or user not participant |
| CONVERSATION_EXISTS | 409 | Direct chat already exists |
| NOT_PARTICIPANT | 403 | User not in conversation |
| VALIDATION_ERROR | 400 | Missing content or invalid type |

## OpenAPI Notes
- Cursor-based pagination for messages (not offset)
- File messages documented with S3 upload flow
- Polling-only behavior noted in v1
