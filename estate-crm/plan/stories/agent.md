# Agent User Stories

## AG-001: View Personal Dashboard
As an Agent, I want to see my personal KPIs so that I can track my performance.

**Acceptance Criteria:**
- My leads by stage
- My deals by stage
- My pipeline value
- My commission (calculated from closed deals)
- My tasks (overdue, due today, upcoming)
- Follow-ups due today

## AG-002: Manage Leads
As an Agent, I want to add and work leads so that I can convert them to clients.

**Acceptance Criteria:**
- Add new lead with contact info, budget, preferences
- Update lead details and notes
- Advance lead stage (fresh → qualified → followUp → reservation)
- Log interactions (calls, emails, meetings, WhatsApp)
- See lead score (manually set by manager)
- Reassign not allowed (only manager/admin)

## AG-003: Convert Lead to Client
As an Agent, I want to convert a qualified lead to a client so that I can start working deals.

**Acceptance Criteria:**
- Manual conversion from lead detail page
- System creates Client record linked to Lead
- I can add client type and notes during conversion
- Lead marked as converted, still visible in history

## AG-004: Create Clients Directly
As an Agent, I want to add clients without going through the lead pipeline so that I can track existing relationships.

**Acceptance Criteria:**
- Create client with name, contact, type
- System warns if phone/email matches existing lead
- Client immediately available for deal creation

## AG-005: Manage Deals
As an Agent, I want to create and advance deals so that I can close transactions.

**Acceptance Criteria:**
- Create deal linked to property and client/lead
- Advance deal stage (initialContact → negotiation → contractPending)
- ContractPending → closedWon requires manager approval
- Set deal probability manually (no auto-calculation)
- View deal probability and notes
- Upload deal documents (S3)
- View commission preview

## AG-006: Manage Properties
As an Agent, I want to view properties and projects so that I can match clients to inventory.

**Acceptance Criteria:**
- Browse all active properties
- Filter by type, location, price range, project
- View property details with images and attributes
- See suggested properties for my leads
- Cannot edit or delete properties (admin/manager only)

## AG-007: View Notifications
As an Agent, I want to receive in-app notifications so that I don't miss important events.

**Acceptance Criteria:**
- Notifications for: lead assigned, deal stage changed, task due, chat message
- Unread count badge
- Mark individual or all as read
- Notification history

## AG-008: View Commission Records
As an Agent, I want to see my commission history so that I can track my earnings.

**Acceptance Criteria:**
- List all commission records with deal, property, amount
- View calculation breakdown (deal value × plan rate × my split)
- **No settlement status in v1** — records are immutable calculation logs

## AG-009: Chat with Colleagues
As an Agent, I want to chat with my manager and colleagues so that we can coordinate.

**Acceptance Criteria:**
- Start direct chat with any team member
- Participate in group chats
- Send text messages
- Share files in chat
- See unread message count
- **Polling-based in v1** (no real-time WebSockets)
