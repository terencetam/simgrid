import type { Scenario, MonteCarloResult } from "./schema";
import type { RunMetrics } from "./core/goals";
import { computeWinProbability, checkGoal } from "./core/goals";
import { makeRng } from "./core/rng";
import { simulateRun, allocateBuffers } from "./simulate";

const PERCENTILE_KEYS = ["5", "10", "25", "50", "75", "90", "95"] as const;
const PERCENTILE_FRACTIONS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95];

interface AggregatedSeries {
  [percentile: string]: number[];
}

/** A sampled individual run trace for spaghetti animation */
export interface SampleRun {
  revenue: number[];
  cash: number[];
  customers: number[];
  profit: number[];
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
      const idx = Math.min(Math.floor(PERCENTILE_FRACTIONS[i] * n), n - 1);
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

  const allRevenue: number[][] = [];
  const allCash: number[][] = [];
  const allProfit: number[][] = [];
  const allCustomers: number[][] = [];
  const allRunMetrics: RunMetrics[] = [];

  // Determine which runs to sample (evenly spaced)
  const sampleEvery = Math.max(1, Math.floor(nRuns / sampleCount));
  const sampleRuns: SampleRun[] = [];

  for (let i = 0; i < nRuns; i++) {
    const rng = makeRng(baseSeed + i);
    const buffers = allocateBuffers(T);
    simulateRun(scenario, buffers, rng);

    const rev = [...buffers.revenue];
    const cash = [...buffers.cash];
    const prof = [...buffers.profit];
    const custs = [...buffers.customers];

    allRevenue.push(rev);
    allCash.push(cash);
    allProfit.push(prof);
    allCustomers.push(custs);

    const metrics: RunMetrics = {
      revenue: buffers.revenue,
      cash: buffers.cash,
      profit: buffers.profit,
      profitMargin: buffers.revenue.map((r, idx) =>
        r > 0 ? buffers.profit[idx] / r : 0
      ),
      customers: buffers.customers,
    };
    allRunMetrics.push(metrics);

    // Sample this run for spaghetti animation
    if (i % sampleEvery === 0 && sampleRuns.length < sampleCount) {
      const won = scenario.goals.every((g) => checkGoal(g, metrics));
      sampleRuns.push({ revenue: rev, cash, customers: custs, profit: prof, won });
    }

    if (onProgress && i % 50 === 0) onProgress(i);
  }

  const percentiles: Record<string, AggregatedSeries> = {
    revenue: computePercentiles(allRevenue, T),
    cash: computePercentiles(allCash, T),
    profit: computePercentiles(allProfit, T),
    customers: computePercentiles(allCustomers, T),
  };

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
      bindingConstraints: {},
      financialStatements: {
        incomeStatement: {},
        balanceSheet: {},
        cashFlowStatement: {},
      },
      unitEconomics: {},
    },
    sampleRuns,
  };
}
