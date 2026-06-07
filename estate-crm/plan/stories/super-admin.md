# Super Admin User Stories

## SA-001: Create Organization
As a Super Admin, I want to create a new Organization so that a new real estate brokerage can use the CRM.

**Acceptance Criteria:**
- I can specify Organization name, slug, and initial admin user details
- Slug must be unique across the platform
- Initial admin user is created with a temporary password
- Organization status defaults to `active`

## SA-002: Suspend Organization
As a Super Admin, I want to suspend an Organization so that they can no longer access the system.

**Acceptance Criteria:**
- Suspending sets Organization status to `suspended`
- All API requests from that Organization return `TENANT_SUSPENDED`
- Existing data is preserved
- I can reactivate the Organization later

## SA-003: View All Organizations
As a Super Admin, I want to see a list of all Organizations so that I can monitor platform health.

**Acceptance Criteria:**
- List shows name, slug, status, plan, user count, created date
- Filterable by status and plan
- Paginated with offset pagination

## SA-004: Manage Organization Plans
As a Super Admin, I want to assign and change an Organization's plan so that I can control feature access.

**Acceptance Criteria:**
- Plans: basic, pro, enterprise
- Plan change is recorded in audit log
- I can see plan usage statistics

## SA-005: Impersonate Organization Admin
As a Super Admin, I want to impersonate an Organization Admin so that I can troubleshoot tenant issues.

**Acceptance Criteria:**
- Impersonation generates a temporary JWT scoped to that Organization
- Audit log records the impersonation action with my super admin ID
- I can see exactly what the tenant admin sees
- I can end impersonation and return to super admin view

## SA-006: View Cross-Tenant Analytics
As a Super Admin, I want to see platform-wide analytics so that I can understand business growth.

**Acceptance Criteria:**
- Total Organizations (active/suspended)
- Total deals closed across all tenants
- Total commission volume
- New tenant signups over time
- Churn rate (suspended/closed tenants)
