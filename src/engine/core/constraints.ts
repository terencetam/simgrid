/**
 * Constraint enforcement and binding detection.
 */
import type { Scenario } from "../schema";

export interface ConstraintResult {
  /** constraint ID → fraction of periods where it was binding */
  bindingFraction: Record<string, number>;
  /** constraint ID → first period where it binds (or -1) */
  firstBindingPeriod: Record<string, number>;
}

export interface ConstraintCheck {
  constraintId: string;
  targetId: string;
  capValue: number;
  capKind: "hard" | "soft";
}

/**
 * Apply constraints to a metric value. Returns the clamped value and
 * whether any constraint was binding.
 */
export function applyConstraints(
  value: number,
  targetId: string,
  constraints: ConstraintCheck[],
  bindingLog: Record<string, number>,
  _t: number
): number {
  let result = value;
  for (const c of constraints) {
    if (c.targetId !== targetId) continue;
    if (result > c.capValue) {
      // Constraint is binding
      bindingLog[c.constraintId] = (bindingLog[c.constraintId] ?? 0) + 1;
      if (c.capKind === "hard") {
        result = c.capValue;
      }
    }
  }
  return result;
}

/**
 * Prepare constraint checks from scenario constraints.
 * Resolves cap values that are numbers (string refs deferred to formula phase).
 */
export function prepareConstraints(constraints: Scenario["constraints"]): ConstraintCheck[] {
  return constraints
    .filter((c) => typeof c.capValue === "number")
    .map((c) => ({
      constraintId: c.id,
      targetId: c.targetId,
      capValue: c.capValue as number,
      capKind: c.capKind,
    }));
}

/**
 * Aggregate binding logs across runs into per-constraint fractions.
 */
export function aggregateBindings(
  allBindingLogs: Record<string, number>[],
  T: number
): Record<string, number> {
  const n = allBindingLogs.length;
  if (n === 0) return {};

  const totals: Record<string, number> = {};
  for (const log of allBindingLogs) {
    for (const [id, count] of Object.entries(log)) {
      totals[id] = (totals[id] ?? 0) + count;
    }
  }

  const result: Record<string, number> = {};
  for (const [id, total] of Object.entries(totals)) {
    // fraction of (run × period) pairs where this constraint bound
    result[id] = total / (n * T);
  }
  return result;
}
