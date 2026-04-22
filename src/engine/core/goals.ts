import type { Goal } from "../schema";

export interface RunMetrics {
  /** metric name → value at each period */
  [metric: string]: number[];
}

/** Check whether a single run satisfies a goal */
export function checkGoal(goal: Goal, metrics: RunMetrics): boolean {
  const series = metrics[goal.metric];
  if (!series) return false;

  if (goal.allPeriods) {
    // Must hold for every period up to byPeriod
    const end = Math.min(goal.byPeriod, series.length);
    for (let t = 0; t < end; t++) {
      if (!checkValue(series[t], goal)) return false;
    }
    return true;
  }

  // Check at the specified period
  const idx = Math.min(goal.byPeriod, series.length) - 1;
  if (idx < 0) return false;
  return checkValue(series[idx], goal);
}

function checkValue(value: number, goal: Goal): boolean {
  switch (goal.direction) {
    case "at_least":
      return value >= goal.threshold;
    case "at_most":
      return value <= goal.threshold;
    case "between":
      return value >= goal.threshold && value <= (goal.upperThreshold ?? Infinity);
    default:
      return false;
  }
}

/** Compute win probability: fraction of runs where ALL goals pass */
export function computeWinProbability(
  goals: Goal[],
  allRunMetrics: RunMetrics[]
): { winProbability: number; perGoalSuccess: Record<string, number> } {
  const n = allRunMetrics.length;
  if (n === 0) return { winProbability: 0, perGoalSuccess: {} };

  const perGoalWins: Record<string, number> = {};
  for (const g of goals) perGoalWins[g.id] = 0;

  let allWins = 0;

  for (const runMetrics of allRunMetrics) {
    let allPass = true;
    for (const g of goals) {
      const pass = checkGoal(g, runMetrics);
      if (pass) perGoalWins[g.id]++;
      else allPass = false;
    }
    if (allPass) allWins++;
  }

  const perGoalSuccess: Record<string, number> = {};
  for (const g of goals) {
    perGoalSuccess[g.id] = perGoalWins[g.id] / n;
  }

  return { winProbability: allWins / n, perGoalSuccess };
}
