/**
 * Lead Stage values — flexible pipeline with backward regression.
 * No TS enum: stored as varchar(20) in DB, validated at DTO layer.
 */
export const LEAD_STAGE_VALUES = ['fresh', 'qualified', 'followUp', 'reservation', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGE_VALUES)[number];

/**
 * Lead Activity Type values — polymorphic activities written to the `activities` table.
 * No TS enum: stored as varchar(30) in DB, validated at DTO layer.
 */
export const LEAD_ACTIVITY_TYPE_VALUES = [
  'call',
  'email',
  'meeting',
  'note',
  'stage_change',
  'assignment',
  'dnc_set',
  'dnc_unset',
  'convert',
] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPE_VALUES)[number];
