/**
 * Status Finite State Machine utilities for Properties and Projects.
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