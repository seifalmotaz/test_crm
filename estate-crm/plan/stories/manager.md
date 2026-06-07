# Manager User Stories

## MA-001: View Team Dashboard
As a Manager, I want to see my team's performance so that I can coach and support them.

**Acceptance Criteria:**
- Team leads by stage
- Team deals by stage
- Team pipeline value
- Unassigned leads count
- Agent performance: conversion rate, deals closed, commission earned
- Overdue tasks for team members

## MA-002: Assign Leads
As a Manager, I want to assign leads to agents so that work is distributed fairly.

**Acceptance Criteria:**
- See unassigned leads pool
- Assign lead to specific agent
- Reassign lead from one agent to another
- Bulk assign multiple leads
- System suggests least-loaded agent for auto-assignment

## MA-003: Approve Deal Closure
As a Manager, I want to approve deals advancing to closedWon so that I can verify terms before commitment.

**Acceptance Criteria:**
- Deals in `contractPending` require manager approval to advance
- I see deal details, property, client, value
- Approve or reject with reason
- Approval triggers commission calculation

## MA-004: Manage VIP Clients
As a Manager, I want to mark clients as VIP so that agents prioritize them.

**Acceptance Criteria:**
- Toggle VIP flag on any client
- VIP status records who set it and when
- VIP clients visible in reports

## MA-005: Set Lead Scores
As a Manager, I want to set lead scores so that agents know which leads to prioritize.

**Acceptance Criteria:**
- Update lead score (0-100) manually
- Score visible in lead list and dashboard
- **No auto-scoring in v1** — all scores are manually assigned

## MA-006: Create and Manage Tasks
As a Manager, I want to create and assign tasks to agents so that follow-ups don't fall through cracks.

**Acceptance Criteria:**
- Create task with title, description, due date, priority
- Assign to specific agent
- Link to lead, deal, property, or client
- Track completion status
- **No task automation in v1** — all tasks manually created

## MA-007: Chat with Team
As a Manager, I want to chat with my team so that we can coordinate quickly.

**Acceptance Criteria:**
- Start direct chat with any team member
- Create group chats with multiple agents
- Send text messages
- Upload and share files in chat
- See unread message count
- **Polling-based in v1** (no real-time WebSockets)
