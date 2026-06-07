# Departing Agent Data Preservation

When an Agent leaves an Organization (status set to `inactive` with `departedAt` timestamp), we intentionally preserve all their historical data rather than reassigning or deleting it.

Leads become unassigned (agentId set to null, previousAgentIds append the departing agent). Deals remain linked to the departed agent for historical accuracy. KPIs freeze at the departure date — the agent appears in historical reports but not current leaderboards.

This decision was driven by real estate brokerage reality: departed agents' closed deals and commissions are legally and financially significant. The Organization must retain records for compliance, commission disputes, and historical performance analysis. Reassigning closed deals to another agent would corrupt historical truth.

Managers can update a Deal's "current responsible" field for active management, but the original `agentId` stays for historical reference.

**Considered options**: Reassign leads and deals to manager (corrupts KPIs), hard delete agent (loses history), preserve everything (correct but requires unassigned lead pool).
