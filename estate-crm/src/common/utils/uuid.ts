/**
 * Re-exports uuidv7 from the uuidv7 package.
 * uuidv7 generates time-sortable UUIDs (per RFC 9562).
 * These are monotonically increasing within the same millisecond,
 * making them ideal for use as primary keys (per ADR-0007).
 */
export { uuidv7 } from 'uuidv7';