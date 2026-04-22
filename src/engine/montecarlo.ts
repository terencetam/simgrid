import type { Scenario, MonteCarloResult } from "./schema";
import type { RunMetrics } from "./core/goals";
import { computeWinProbability } from "./core/goals";
import { makeRng } from "./core/rng";
import { simulateRun, allocateBuffers } from "./simulate";

const PERCENTILE_KEYS = ["5", "10", "25", "50", "75", "90", "95"] as const;
const PERCENTILE_FRACTIONS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95];

interface AggregatedSeries {
  [percentile: string]: number[];
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

export function monteCarlo(
  scenario: Scenario,
  nRuns: number,
  baseSeed: number = 42,
  onProgress?: (done: number) => void
): MonteCarloResult {
  const T = scenario.horizonPeriods;

  // Collect all runs
  const allRevenue: number[][] = [];
  const allCash: number[][] = [];
  const allProfit: number[][] = [];
  const allCustomers: number[][] = [];
  const allRunMetrics: RunMetrics[] = [];

  for (let i = 0; i < nRuns; i++) {
    const rng = makeRng(baseSeed + i);
    const buffers = allocateBuffers(T);
    simulateRun(scenario, buffers, rng);

    allRevenue.push([...buffers.revenue]);
    allCash.push([...buffers.cash]);
    allProfit.push([...buffers.profit]);
    allCustomers.push([...buffers.customers]);

    allRunMetrics.push({
      revenue: buffers.revenue,
      cash: buffers.cash,
      profit: buffers.profit,
      profitMargin: buffers.revenue.map((r, idx) =>
        r > 0 ? buffers.profit[idx] / r : 0
      ),
      customers: buffers.customers,
    });

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
  };
}
