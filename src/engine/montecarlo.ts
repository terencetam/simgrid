import type { Scenario, MonteCarloResult } from "./schema";
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
  survived: boolean;
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
 * Survival = cash never goes negative across all periods.
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

  // Determine which variables to aggregate (those with chartMetric set)
  const varsToAggregate = new Set<string>();
  for (const v of scenario.variables) {
    if (v.chartMetric) varsToAggregate.add(v.id);
  }

  // Find the cash variable ID (tagged with chartMetric: "cash")
  const cashVarId = scenario.variables.find((v) => v.chartMetric === "cash")?.id;

  // Collect all run data for aggregation
  const allSeries: Record<string, number[][]> = {};
  for (const id of varsToAggregate) {
    allSeries[id] = [];
  }

  let survivedCount = 0;
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

    // Check survival: cash >= 0 for every period
    const cashSeries = cashVarId ? result.series.get(cashVarId) : null;
    const survived = cashSeries ? cashSeries.every((v) => v >= 0) : true;
    if (survived) survivedCount++;

    // Sample runs for spaghetti animation
    if (
      sampleCount > 0 &&
      i % sampleEvery === 0 &&
      sampleRuns.length < sampleCount
    ) {
      const values: Record<string, number[]> = {};
      for (const id of varsToAggregate) {
        const s = result.series.get(id);
        if (s) values[id] = [...s];
      }
      sampleRuns.push({ values, survived });
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

  const survivalRate = nRuns > 0 ? survivedCount / nRuns : 0;

  return {
    result: {
      scenarioId: scenario.id,
      nRuns,
      percentiles,
      survivalRate,
    },
    sampleRuns,
  };
}
