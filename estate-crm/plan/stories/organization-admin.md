# Organization Admin User Stories

## OA-001: View Organization Dashboard
As an Organization Admin, I want to see an overview of my brokerage so that I can monitor performance.

**Acceptance Criteria:**
- Total properties (active/pending/sold)
- Total leads by stage
- Pipeline value (sum of all deal values by stage)
- Closed deals this month (count and total value)
- Total commission calculated this month
- Agent count (active/inactive)
- Overdue tasks count

## OA-002: Manage Users
As an Organization Admin, I want to create and manage users so that my team can use the CRM.

**Acceptance Criteria:**
- Create users with role (manager or agent)
- Edit user details and role
- Deactivate users (trigger departure flow)
- View all users in my Organization
- Cannot create other admins (only super admin can)

## OA-003: Configure Commission Plans
As an Organization Admin, I want to set up commission plans so that commissions calculate correctly.

**Acceptance Criteria:**
- Create plans with type (percentage, flat, tiered)
- Set default plan for Organization
- Plan applies to Properties unless overridden
- Edit or deactivate plans not in use

## OA-004: Manage Projects
As an Organization Admin, I want to create and manage development projects so that agents can list properties within them.

**Acceptance Criteria:**
- Create project with name, location, developer, dates
- Set project status lifecycle
- View all projects with property counts
- Soft delete project only if no active properties

## OA-005: View Audit Logs
As an Organization Admin, I want to see who did what in my Organization so that I can ensure accountability.

**Acceptance Criteria:**
- Filter by user, action type, date range
- Shows actor, action, target, timestamp, IP
- Immutable — no edit or delete

## OA-006: View Commissions
As an Organization Admin, I want to see commission records so that I can review agent payouts.

**Acceptance Criteria:**
- View all commission records with calculation breakdown
- Filter by agent, date range
- Export summary for accounting (CSV)
- **No settlement workflow in v1** — records are read-only logs
