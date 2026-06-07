# Synchronous Commission Calculation

Commission Records are created synchronously when a Deal advances to `closedWon`. There is no background job, queue, or deferred processing in v1.

The calculation reads the Property's linked Commission Plan (or project default, or tenant default), applies the Agent's commission split percentage, and creates the Commission Record with `pending` status. All arithmetic uses integer cents to avoid floating point errors.

This simplifies v1 architecture. The trade-off is that deal closure requests take slightly longer (one extra read + insert). In v2, this will move to BullMQ with a hold period, settlement batching, and chargeback protection.

**Considered options**: Async BullMQ job (more complex, needs queue infra), synchronous calculation (simpler, slightly slower deal closure, acceptable for v1).
