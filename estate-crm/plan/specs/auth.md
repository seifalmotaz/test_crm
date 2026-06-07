# Auth Module Specification

## Purpose
Handles user authentication, JWT token management, password hashing, and refresh token rotation.

## Data Model

### Database Tables

**users** (extends base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK → organizations.id
- `email`: String, unique per tenant
- `passwordHash`: String (Argon2id)
- `name`: String
- `role`: Enum [admin, manager, agent]
- `status`: Enum [active, inactive, suspended]
- `departedAt`: Timestamp, nullable
- `commissionSplit`: Decimal (default 0.6 for agents)
- `createdAt`, `updatedAt`, `deletedAt`

**refresh_tokens** (Redis only, not DB table):
- Key: `refresh:{userId}`
- Value: token string
- TTL: 7 days

## API Endpoints

### Public

#### POST /api/auth/login
**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Success 200:**
- Sets `access_token` HTTP-only cookie (15 min expiry)
- Returns user object without password
- Stores refresh token in Redis

**Errors:**
- `400 VALIDATION_ERROR` — Invalid email format or missing fields
- `401 INVALID_CREDENTIALS` — Email or password incorrect
- `403 TENANT_SUSPENDED` — Organization is suspended

#### POST /api/auth/logout
**Success 200:**
- Clears `access_token` cookie
- Deletes refresh token from Redis
- Returns `{ success: true }`

#### POST /api/auth/refresh
**Success 200:**
- Reads refresh token from Redis (keyed by userId from valid but expired access token)
- Issues new `access_token` cookie
- Rotates refresh token in Redis
- Returns user object

**Errors:**
- `401 TOKEN_EXPIRED` — Refresh token expired or not found
- `401 UNAUTHORIZED` — No refresh token provided

### Authenticated

#### GET /api/auth/me
**Headers:** Cookie with `access_token`

**Success 200:**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "role": "admin|manager|agent",
  "tenantId": "uuid",
  "tenantName": "string",
  "status": "active"
}
```

**Errors:**
- `401 UNAUTHORIZED` — No valid token
- `401 TOKEN_EXPIRED` — Token expired

## Business Rules

1. Passwords hashed with Argon2id (m=65536, t=3, p=4)
2. JWT signed with RS256 asymmetric keys (private key on server, public key verifiable)
3. Access token: 15 minutes
4. Refresh token: 7 days, single-use, stored in Redis
5. All authenticated endpoints (except refresh) require valid access token
6. TenantGuard injects `tenantId` from user into request context
7. Inactive or suspended users cannot authenticate
8. Suspended organizations block all tenant-scoped requests

## Error Codes

| Code | Status | When |
|------|--------|------|
| UNAUTHORIZED | 401 | No token, invalid token |
| TOKEN_EXPIRED | 401 | Access token expired |
| INVALID_CREDENTIALS | 401 | Wrong email/password |
| TENANT_SUSPENDED | 403 | Organization suspended |
| VALIDATION_ERROR | 400 | Missing/invalid fields |
| INTERNAL_ERROR | 500 | Server error |

## OpenAPI Schema

### Request Schemas
- `LoginDto`: email (string, format email), password (string, min 8)
- `RefreshDto`: (empty body, uses cookie)

### Response Schemas
- `AuthResponse`: user object with tenant info
- `LogoutResponse`: { success: boolean }

### Error Responses
Every endpoint documents:
- 400: Problem Details with VALIDATION_ERROR
- 401: Problem Details with UNAUTHORIZED or TOKEN_EXPIRED
- 403: Problem Details with TENANT_SUSPENDED
- 500: Problem Details with INTERNAL_ERROR
