# Projects & Properties Module Specification

## Purpose
Manages real estate development Projects and individual Properties. Properties have polymorphic attributes based on type and a status lifecycle.

## Data Model

### Database Tables

**projects** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `name`: String
- `description`: String, nullable
- `location`: String
- `developerName`: String, nullable
- `status`: Enum [planning, preLaunch, active, soldOut, delivered]
- `launchDate`: Date, nullable
- `completionDate`: Date, nullable
- `totalUnits`: Int, nullable
- `soldUnits`: Int, default 0
- `commissionPlanId`: UUIDv7 FK, nullable
- `createdAt`, `updatedAt`, `deletedAt`

**properties** (base entity):
- `id`: UUIDv7 PK
- `tenantId`: UUIDv7 FK
- `projectId`: UUIDv7 FK, nullable
- `title`: String
- `address`: String
- `type`: Enum [apartment, villa, commercial, townhouse, land]
- `status`: Enum [active, pending, sold, withdrawn]
- `price`: Decimal (integer cents in DB)
- `beds`: Int, nullable
- `baths`: Int, nullable
- `sqft`: Int, nullable
- `yearBuilt`: Int, nullable
- `attributes`: JSONB (type-specific, validated by Zod)
- `images`: Text[] (S3 URLs)
- `videos`: Text[] (S3 URLs)
- **tags**: String[] (e.g., ["luxury", "sea-view", "new-construction"])
- `agentId`: UUIDv7 FK, nullable
- `commissionPlanId`: UUIDv7 FK, nullable
- `createdAt`, `updatedAt`, `deletedAt`

### Zod Attribute Schemas

**ApartmentAttributes:**
```typescript
{
  floor: number,
  totalFloors: number,
  hasElevator: boolean,
  maintenanceFee: number,
  amenities: string[],
  parkingSpots: number
}
```

**VillaAttributes:**
```typescript
{
  plotSize: number,
  gardenArea: number,
  floors: number,
  hasPool: boolean,
  hasGarden: boolean,
  parkingSpots: number
}
```

**CommercialAttributes:**
```typescript
{
  frontage: number,
  ceilingHeight: number,
  licenseType: string,
  footTraffic: string,
  utilities: string[]
}
```

**LandAttributes:**
```typescript
{
  zoningType: string,
  buildableArea: number,
  roadAccess: boolean,
  utilitiesAvailable: string[],
  topography: string
}
```

**TownhouseAttributes:**
```typescript
{
  plotSize: number,
  sharedWalls: number,
  floors: number,
  hasGarden: boolean,
  parkingSpots: number
}
```

## API Endpoints

### Projects

#### GET /api/projects
**Query:** `?status=active&search=sunset&page=1&limit=20`

**Success 200:** Paginated project list with property counts.

#### POST /api/projects
**Request Body:**
```json
{
  "name": "Sunset Residences",
  "location": "Downtown Dubai",
  "developerName": "Emaar",
  "status": "active",
  "launchDate": "2024-01-01",
  "totalUnits": 200,
  "commissionPlanId": "uuid"
}
```

**Success 201:** Created project.

#### GET /api/projects/:id
**Success 200:** Project with properties list.

#### PATCH /api/projects/:id
**Request Body:** Partial project fields.

#### POST /api/projects/:id/status
**Request Body:**
```json
{ "status": "soldOut" }
```

**Validation:** Status transitions follow FSM.

#### DELETE /api/projects/:id
**Validation:** Only if no active properties linked.
**Errors:** `409 PROJECT_HAS_PROPERTIES`

### Properties

#### GET /api/properties
**Query:** `?status=active&type=apartment&projectId=uuid&minPrice=100000&maxPrice=500000&search=downtown&page=1&limit=20`

**Success 200:** Paginated property list.

#### POST /api/properties
**Request Body:**
```json
{
  "projectId": "uuid",
  "title": "Luxury Apartment 4B",
  "address": "123 Main St",
  "type": "apartment",
  "status": "active",
  "price": 450000,
  "beds": 3,
  "baths": 2,
  "sqft": 1200,
  "attributes": {
    "floor": 5,
    "totalFloors": 20,
    "hasElevator": true,
    "maintenanceFee": 200,
    "amenities": ["gym", "pool"],
    "parkingSpots": 2
  },
  "agentId": "uuid",
  "commissionPlanId": "uuid"
}
```

**Validation:** `attributes` validated against Zod schema for the `type`.

**Errors:**
- `400 VALIDATION_ERROR` — Invalid attributes for type
- `404 PROJECT_NOT_FOUND`

#### GET /api/properties/:id
**Success 200:** Property details with project info.

#### PATCH /api/properties/:id
**Request Body:** Partial fields.
**Note:** Price changes recorded in audit log.

#### POST /api/properties/:id/status
**Request Body:**
```json
{ "status": "pending" }
```

**FSM Validation:**
- active → pending ✓
- active → sold ✗ (must go through pending)
- active → withdrawn ✓
- pending → sold ✓
- pending → active ✓ (deal fell through)
- sold → anything ✗ (terminal)

#### POST /api/properties/:id/media
**Request Body:**
```json
{
  "filename": "photo1.jpg",
  "contentType": "image/jpeg"
}
```

**Success 200:**
```json
{
  "uploadUrl": "https://s3...",
  "fileUrl": "https://cdn.../properties/uuid/photo1.jpg"
}
```

**Flow:**
1. Client requests pre-signed PUT URL
2. Backend generates S3 pre-signed URL
3. Client uploads directly to S3
4. Client PATCHes property with the fileUrl

## Business Rules

1. Property can be standalone or belong to one Project
2. Property attributes validated by Zod based on `type`
3. `sold` status is terminal and irreversible
4. Price stored as integer cents to avoid floating point
5. Media uploaded via S3 pre-signed URLs, never to application server
6. Property commissionPlanId overrides project default, which overrides tenant default
7. Soft delete only; hard delete reserved for super admin tenant removal

## Error Codes

| Code | Status | When |
|------|--------|------|
| PROJECT_NOT_FOUND | 404 | Project ID doesn't exist |
| PROJECT_HAS_PROPERTIES | 409 | Delete attempted with linked properties |
| PROJECT_SOLD_OUT | 400 | Adding property to soldOut project |
| PROPERTY_NOT_FOUND | 404 | Property ID doesn't exist |
| PROPERTY_STATUS_CONFLICT | 409 | Invalid status transition |
| PROPERTY_ALREADY_SOLD | 400 | Property already in sold status |
| VALIDATION_ERROR | 400 | Invalid attributes for property type |
| FORBIDDEN | 403 | Agent editing property |

## OpenAPI Notes
- Property endpoints include discriminator schema for `attributes` based on `type`
- Media upload documented as two-step flow (pre-signed URL, then direct S3 upload)
- Status transition FSM documented with state diagram
