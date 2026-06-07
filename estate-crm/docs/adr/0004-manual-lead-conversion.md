# Manual Lead-to-Client Conversion

When a Lead progresses through the pipeline and is ready to transact, an Agent or Manager must manually convert the Lead to a Client. The system does not auto-convert on deal closure or reservation stage.

This preserves agent agency and data quality. A Lead might be ready for a deal but the agent decides to keep them as a Lead for continued nurturing. Manual conversion also lets the agent add Client-specific data (type, VIP flag, notes) at conversion time.

The Lead record remains with a `isConverted: true` flag and `convertedToClientId` linking to the new Client. This preserves the full Lead pipeline history while creating a clean Client record for deal tracking.

**Considered options**: Auto-convert on deal close (convenient but removes agent control), auto-convert on reservation stage (too early), manual conversion (agent controls timing, preserves history).
