import type { Scenario, MonteCarloResult } from "./schema";
import type { RunMetrics } from "./core/goals";
import { computeWinProbability, checkGoal } from "./core/goals";
import { makeRng } from "./core/rng";
import { compileScenario, simulateRun } from "./simulate";

const PERCENTILE_KEYS = ["5", "10", "25", "50", "75", "90", "95"] as const;
const PERCENTILE_FRACTIONS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95];

interface AggregatedSeries {
  [percentile: string]: number[];
}

/** A sampled individual run trace for spaghetti animation */
export interface SampleRun {
  values: Record<string, number[]>;
  won: boolean;
}

/** Extended MC result that includes sample run traces for animation */
export interface MCResultWithTraces {
  result: MonteCarloResult;
  sampleRuns: SampleRun[];
}

function computePercentiles(
  allRuns: number[][],
  T: number
): AggregatedSeries {
  const result: AggregatedSeries = {};
  for (const key of PERCENTILE_KEYS) result[key] = [];

  for (let t = 0; t < T; t++) {
    const values = allRuns.map((run) => run[t]).sort((a, b) => a - b);
    const n = values.length;
    for (let i = 0; i < PERCENTILE_KEYS.length; i++) {
      const idx = Math.min(
        Math.floor(PERCENTILE_FRACTIONS[i] * n),
        n - 1
      );
      result[PERCENTILE_KEYS[i]].push(values[idx]);
    }
  }

  return result;
}

/**
 * Run Monte Carlo simulation.
 * @param sampleCount - Number of individual run traces to keep for spaghetti animation (default 200)
 */
export function monteCarlo(
  scenario: Scenario,
  nRuns: number,
  baseSeed: number = 42,
  onProgress?: (done: number) => void,
  sampleCount: number = 200
): MCResultWithTraces {
  const T = scenario.horizonPeriods;
  const compiled = compileScenario(scenario);

  // Determine which variables to aggregate:
  // - variables with chartMetric set
  // - variables referenced by goals
  const varsToAggregate = new Set<string>();
  for (const v of scenario.variables) {
    if (v.chartMetric) varsToAggregate.add(v.id);
  }
  for (const g of scenario.goals) {
    // Goal metrics reference variable IDs
    varsToAggregate.add(g.metric);
  }

  // Collect all run data for aggregation
  const allSeries: Record<string, number[][]> = {};
  for (const id of varsToAggregate) {
    allSeries[id] = [];
  }

  const allRunMetrics: RunMetrics[] = [];
  const sampleRuns: SampleRun[] = [];
  const sampleEvery = Math.max(
    1,
    Math.floor(nRuns / Math.max(sampleCount, 1))
  );

  for (let i = 0; i < nRuns; i++) {
    const rng = makeRng(baseSeed + i);
    const result = simulateRun(compiled, rng);

    // Collect series for aggregation
    for (const id of varsToAggregate) {
      const s = result.series.get(id);
      if (s) allSeries[id].push([...s]);
    }

    // Build run metrics for goal checking
    const metrics: RunMetrics = {};
    for (const [id, s] of result.series) {
      metrics[id] = s;
    }
    allRunMetrics.push(metrics);

    // Sample runs for spaghetti animation
    if (
      sampleCount > 0 &&
      i % sampleEvery === 0 &&
      sampleRuns.length < sampleCount
    ) {
      const won = scenario.goals.every((g) => checkGoal(g, metrics));
      const values: Record<string, number[]> = {};
      for (const id of varsToAggregate) {
        const s = result.series.get(id);
        if (s) values[id] = [...s];
      }
      sampleRuns.push({ values, won });
    }

    if (onProgress && i % 50 === 0) onProgress(i);
  }

  // Compute percentiles for each aggregated variable
  const percentiles: Record<string, AggregatedSeries> = {};
  for (const id of varsToAggregate) {
    if (allSeries[id].length > 0) {
      percentiles[id] = computePercentiles(allSeries[id], T);
    }
  }

  const { winProbability, perGoalSuccess } = computeWinProbability(
    scenario.goals,
    allRunMetrics
  );

  return {
    result: {
      scenarioId: scenario.id,
      nRuns,
      percentiles,
      winProbability,
      perGoalSuccess,
    },
    sampleRuns,
  };
}
