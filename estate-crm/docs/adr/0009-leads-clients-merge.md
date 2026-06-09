# Leads and Clients Are the Same Entity

A Lead and a Client are the same record in the system. The "client" concept is a mental label that an Agent applies when they decide a Lead is ready to transact. There is no separate `clients` table; instead, a Lead with `isConverted = true` is what an Agent calls a "Client".

## Decision

- The `clients` table is dropped (migration `0003_orange_wrecking_crew.sql`).
- The `deals.clientId` column is dropped; deals link to leads only via `deals.leadId` (Phase 8+).
- The `leads.convertedToClientId` column is dropped; the `isConverted` boolean is the sole signal.
- The conversion endpoint (`POST /api/leads/:id/convert`) sets `isConverted = true` and writes a `convert` activity to the `activities` table.
- The "client" remains a UI concept — the Agents dashboard and Kanban board can group/filter leads by `isConverted = true`.

## Rationale

- **The Agent's mental model is simpler**: "I converted this lead to a client" means "I marked this lead as ready to deal with."
- **No data duplication**: contact info, tags, activities, and history all live in one place.
- **Audit-friendly**: the Lead's full pipeline history is preserved with a single `isConverted` flag rather than a parallel table.
- **Cleaner Deal linkage**: When Phase 8 builds Deals, they link to leads only, simplifying the data model.

## Considered options

- **Keep the `clients` table** (rejected: adds duplication, no real value)
- **Self-referencing FK `convertedToClientId = lead.id`** (rejected: weird semantics, dead column)
- **Pure flag, no FK** (chosen: cleanest)

## Side effects

- Phase 7 (Clients) in the original plan is now obsolete. The planned duplicate-detection logic for clients is no longer applicable.
- The `deals.clientId` FK was dropped; Phase 8 (Deals) will use `deals.leadId` only.
- Frontend UI may show a "Converted" badge on leads with `isConverted = true` instead of a separate "Clients" page.

## Compliance

- The conversion action is recorded in the `audit_logs` table with action `lead.convert`, targetType `lead`, and metadata `{ agentId, previousStage }`.
- A `convert` activity is also written to the `activities` table for the lead's timeline.
