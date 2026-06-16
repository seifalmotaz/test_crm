/**
 * Deal Stage values — pipeline with terminal states.
 * No TS enum: stored as varchar(20) in DB, validated at DTO layer.
 */
export const DEAL_STAGE_VALUES = ['initialContact', 'negotiation', 'contractPending', 'closedWon', 'closedLost'] as const;
export type DealStage = (typeof DEAL_STAGE_VALUES)[number];

/**
 * Deal Type values — categorization of deal nature.
 * No TS enum: stored as varchar(20) in DB, validated at DTO layer.
 */
export const DEAL_TYPE_VALUES = ['standard', 'resale', 'rental', 'investment'] as const;
export type DealType = (typeof DEAL_TYPE_VALUES)[number];

/**
 * Deal Activity Type values — polymorphic activities written to the `activities` table.
 * No TS enum: stored as varchar(30) in DB, validated at DTO layer.
 */
export const DEAL_ACTIVITY_TYPE_VALUES = [
  'call',
  'email',
  'meeting',
  'note',
  'stage_change',
  'assignment',
] as const;
export type DealActivityType = (typeof DEAL_ACTIVITY_TYPE_VALUES)[number];
