/**
 * Status Finite State Machine utilities for Properties, Projects, and Leads.
 *
 * Property Status Transitions (valid moves):
 *   active     → pending, withdrawn
 *   pending    → sold, active
 *   withdrawn  → active
 *   sold       → (terminal — no outgoing transitions)
 *
 * Project Status Transitions (valid moves):
 *   planning   → preLaunch, active
 *   preLaunch  → active, planning
 *   active     → soldOut, delivered
 *   soldOut    → delivered
 *   delivered  → (terminal — no outgoing transitions)
 *
 * Lead Stage Transitions (valid moves — flexible pipeline with backward regression):
 *   fresh       → qualified, lost
 *   qualified   → fresh, followUp, lost
 *   followUp    → qualified, reservation, lost
 *   reservation → followUp, lost
 *   lost        → (terminal — no outgoing transitions)
 */

// ─── Property Status FSM ──────────────────────────────────────

const PROPERTY_TRANSITIONS: Record<string, Set<string>> = {
  active: new Set(['pending', 'withdrawn']),
  pending: new Set(['sold', 'active']),
  withdrawn: new Set(['active']),
  sold: new Set(), // terminal
};

export function canTransitionPropertyStatus(current: string, next: string): boolean {
  const allowed = PROPERTY_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.has(next);
}

// ─── Project Status FSM ───────────────────────────────────────

const PROJECT_TRANSITIONS: Record<string, Set<string>> = {
  planning: new Set(['preLaunch', 'active']),
  preLaunch: new Set(['active', 'planning']),
  active: new Set(['soldOut', 'delivered']),
  soldOut: new Set(['delivered']),
  delivered: new Set(), // terminal
};

export function canTransitionProjectStatus(current: string, next: string): boolean {
  const allowed = PROJECT_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.has(next);
}

// ─── Lead Stage FSM ───────────────────────────────────────

const LEAD_TRANSITIONS: Record<string, Set<string>> = {
  fresh: new Set(['qualified', 'lost']),
  qualified: new Set(['fresh', 'followUp', 'lost']),
  followUp: new Set(['qualified', 'reservation', 'lost']),
  reservation: new Set(['followUp', 'lost']),
  lost: new Set(), // terminal
};

export function canTransitionLeadStage(current: string, next: string): boolean {
  const allowed = LEAD_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.has(next);
}