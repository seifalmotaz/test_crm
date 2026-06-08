# Estate-CRM Domain Context

Multi-tenant CRM for real estate brokerage organizations.

## Language

### Organizations & Tenancy

**Organization**:
A real estate brokerage company that uses the CRM. Each Organization is an isolated tenant with its own users, properties, leads, and deals.
_Avoid_: Tenant (in code), company, brokerage

**Super Admin**:
The SaaS operator who manages the platform, creates Organizations, assigns plans, and has cross-tenant visibility.
_Avoid_: Platform admin, root user, system admin

**Plan**:
A subscription tier assigned to an Organization (basic, pro, enterprise). Determines feature availability and limits.
_Avoid_: Package, tier (use only in code)

### Users & Roles

**User**:
A person who belongs to exactly one Organization and has exactly one role. Users log in to the CRM and perform actions scoped to their Organization.
_Avoid_: Employee, staff member, account

**Admin** (Organization Admin):
The broker/owner of an Organization. Has full control over their Organization's users, properties, settings, and all data.
_Avoid_: Broker, owner, super user (reserved for Super Admin)

**Manager**:
A team lead who manages a subset of Agents. Can see their team's data, assign leads, and approve deal stage advances. May also have their own leads and deals.
_Avoid_: Team lead, supervisor

**Agent**:
A standard real estate agent who works leads, closes deals, and earns commissions. Can only see their own data unless explicitly shared.
_Avoid_: Realtor, salesperson, broker (conflicts with Admin)

**Departed Agent**:
An Agent whose status has been set to `inactive` with a departure date. Their historical deals and KPIs remain visible, but they can no longer log in or receive new assignments.
_Avoid_: Deleted user, former agent (use "inactive" or "departed" consistently)

### Real Estate Entities

**Project**:
A real estate development (e.g., "Sunset Residences") that may contain multiple Properties. Has its own lifecycle status.
_Avoid_: Development, compound (use in UI but map to Project in code)

**Property**:
A real estate unit (apartment, villa, commercial space, land, townhouse). May be standalone or belong to a Project. Has a status lifecycle and polymorphic attributes based on type.
_Avoid_: Listing, unit, asset

**Phase**:
A textual label on a Property indicating which phase of a Project it belongs to (e.g., "Phase 1", "Tower A"). Not a separate entity in v1.
_Avoid_: Stage (reserved for Lead/Deal pipelines)

### Sales Pipeline

**Lead**:
A prospective buyer or seller who enters the system through a marketing channel. Moves through a pipeline: fresh → qualified → followUp → reservation.
_Avoid_: Prospect, opportunity

**Client**:
A person manually added by an Agent or created by converting a Lead. Skips the lead pipeline and can be directly linked to Deals. Functionally equivalent to a Lead but without pipeline stages.
_Avoid_: Customer, contact

**Deal**:
A transaction in progress. Links to a Property and/or a Lead or Client. Moves through: initialContact → negotiation → contractPending → closedWon/closedLost.
_Avoid_: Transaction, sale, opportunity

**Commission**:
The monetary compensation an Agent receives when a Deal closes. Calculated from a Commission Plan rate and the Agent's split percentage.
_Avoid_: Payout, bonus, fee

**Commission Plan**:
An Organization-level configuration that defines how commissions are calculated (percentage rate, split rules). Properties link to a specific plan.
_Avoid_: Commission rule, payout structure

**Commission Record**:
The immutable financial record created when a Deal closes. Tracks the calculated amount, agent payout, brokerage share, and settlement status.
_Avoid_: Commission entry, payout record

### Status & Lifecycle

**Lead Stage**:
The current position of a Lead in its pipeline: fresh, qualified, followUp, reservation, or lost.
_Avoid_: Lead status (status is reserved for Properties/Deals/Projects)

**Deal Stage**:
The current position of a Deal in its pipeline: initialContact, negotiation, contractPending, closedWon, or closedLost.
_Avoid_: Deal status

**Property Status**:
The availability of a Property: active, pending, sold, or withdrawn.
_Avoid_: Property stage

**Project Status**:
The lifecycle of a Project: planning, preLaunch, active, soldOut, or delivered.

**Reservation**:
The final Lead stage before conversion to a Deal. Indicates the lead has committed to a specific Property.
_Avoid_: Booking, hold

**DNC (Do Not Contact)**:
A compliance flag on a Lead indicating they must not be contacted. Blocks all outreach and interactions.
_Avoid_: Opt-out, unsubscribe

**Tag**:
A color-coded label attached to Leads, Deals, or Properties for categorization and filtering.
_Avoid_: Label, category

**Activity**:
An append-only record of an action performed on a Lead or Deal. Activities include calls, emails, meetings, notes, stage changes, assignments, document uploads, and DNC status changes. Activities form a chronological timeline on the entity's detail page.
_Avoid_: Log, event, interaction (use "interaction" only for the old leadInteractions concept)

**Audit Log**:
A system-wide record of user actions for compliance and accountability. Tracks who performed what action, when, from which IP address, and what changed (before/after values).
_Avoid_: History, trail

**Settled**:
The status of a Commission Record when the brokerage has confirmed and paid the Agent's share.
_Avoid_: Paid, released, approved

## Relationships

- An **Organization** has many **Users** (1:N)
- A **User** belongs to exactly one **Organization** (N:1)
- An **Organization** has many **Projects** (1:N)
- A **Project** has many **Properties** (1:N)
- A **Property** belongs to zero or one **Project** (N:1 or standalone)
- A **Property** links to exactly one **Commission Plan** (or inherits default)
- An **Organization** has many **Commission Plans** (1:N)
- An **Agent** has many **Leads** (1:N)
- A **Lead** belongs to exactly one **Agent** (or is unassigned)
- A **Lead** has many **Activities** (1:N)
- A **Deal** has many **Activities** (1:N)
- A **Lead** converts to zero or one **Client** (1:1, manual)
- A **Client** was converted from zero or one **Lead** (1:1)
- A **Deal** links to exactly one **Property** and one **Lead** or **Client**
- A **Deal** belongs to exactly one **Agent**
- A **Deal** creates exactly one **Commission Record** when closedWon (1:1)
- A **Commission Record** belongs to exactly one **Deal** and one **Agent**
- An **Agent** has one **Commission Split** (percentage they keep)
- A **User** performs actions recorded in **Audit Log** entries (1:N)
- A **User** participates in many **Conversations** (N:M via ConversationParticipant)
- A **Conversation** has many **Messages** (1:N)

## Example Dialogue

> **Dev:** "When an **Agent** converts a **Lead** to a **Client**, does the **Lead** disappear?"
>
> **Domain Expert:** "No — the **Lead** stays in the system with a 'converted' flag. The **Client** record is new but links back to the **Lead** via `convertedFromLeadId`. This preserves the full history of how the **Lead** moved through stages before becoming a **Client**."
>
> **Dev:** "What happens when an **Agent** leaves the **Organization**?"
>
> **Domain Expert:** "Their **Leads** go to the unassigned pool for redistribution. Their **Deals** stay historically linked to them — we never reassign closed deals. Their KPIs freeze at the departure date. A Manager or Admin must handle any active **Deals** by updating the 'current responsible' field if needed."
>
> **Dev:** "Can a **Property** belong to multiple **Projects**?"
>
> **Domain Expert:** "No — a **Property** is either standalone or belongs to exactly one **Project**. If a unit appears in two developments, they're separate **Properties** with different IDs."
>
> **Dev:** "What's the difference between a **Lead** and a **Client**?"
>
> **Domain Expert:** "A **Lead** enters through marketing channels and goes through the pipeline (fresh → qualified → followUp → reservation). A **Client** is someone an **Agent** already has a relationship with — they skip the pipeline and go straight to **Deals**. Every **Client** could have been a **Lead**, but not every **Lead** becomes a **Client** — some go straight to **Deals** without conversion."

## Flagged Ambiguities

- "broker" was used to mean both the **Organization** owner and a licensed real estate agent — resolved: use **Admin** for the Organization role, **Agent** for the salesperson.
- "account" was used to mean both a **User** login and a **Client** financial record — resolved: **User** is the system login, **Client** is the business entity.
- "stage" vs "status" — resolved: **Lead** and **Deal** have "stages" (pipeline positions). **Property** and **Project** have "status" (availability/lifecycle). Never mix the terms.
- "reservation" was ambiguous between a **Lead** stage and a financial deposit — resolved: "reservation" is exclusively the Lead stage. Financial deposits are part of **Deal** value tracking.
- "client" vs "customer" — resolved: use **Client** consistently. "Customer" is not a domain term in this system.
