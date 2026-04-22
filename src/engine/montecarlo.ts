import type { Scenario, MonteCarloResult } from "./schema";
import type { RunMetrics } from "./core/goals";
import { computeWinProbability, checkGoal } from "./core/goals";
import { makeRng } from "./core/rng";
import { simulateRun, allocateBuffers } from "./simulate";
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from "./core/financials";
import { computeUnitEconomics, type UnitEconomicsData } from "./core/unit-economics";
import { aggregateBindings } from "./core/constraints";

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

// Keys to aggregate for financial statements
const IS_AGG_KEYS: (keyof IncomeStatement)[] = [
  "revenue", "cogs", "grossProfit", "totalOpex", "ebitda",
  "depreciation", "ebit", "interest", "netIncome",
];
const BS_AGG_KEYS: (keyof BalanceSheet)[] = [
  "cash", "accountsReceivable", "inventory", "fixedAssetsNet",
  "totalAssets", "accountsPayable", "debt", "totalLiabilities",
  "retainedEarnings", "totalEquity",
];
const CF_AGG_KEYS: (keyof CashFlowStatement)[] = [
  "cashFromOperations", "cashFromInvesting", "cashFromFinancing",
  "netCashChange", "endingCash",
];
const UE_AGG_KEYS: (keyof UnitEconomicsData)[] = [
  "cac", "ltv", "ltvCacRatio", "paybackMonths",
  "grossMarginPct", "revenuePerEmployee", "burnMultiple", "arpu",
];

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
  const allBindingLogs: Record<string, number>[] = [];

  // Financial statement series per run
  const allIS: Record<string, number[][]> = {};
  const allBS: Record<string, number[][]> = {};
  const allCF: Record<string, number[][]> = {};
  const allUE: Record<string, number[][]> = {};
  for (const k of IS_AGG_KEYS) allIS[k] = [];
  for (const k of BS_AGG_KEYS) allBS[k] = [];
  for (const k of CF_AGG_KEYS) allCF[k] = [];
  for (const k of UE_AGG_KEYS) allUE[k] = [];

  const sampleEvery = Math.max(1, Math.floor(nRuns / Math.max(sampleCount, 1)));
  const sampleRuns: SampleRun[] = [];

  // Average churn rate for LTV calculation
  const avgChurn = scenario.segments.length > 0
    ? scenario.segments[0].churnRate.baseValue
    : 0.05;

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
    allBindingLogs.push(buffers.bindingLog);

    // Collect financial statement line items
    for (const k of IS_AGG_KEYS) allIS[k].push([...buffers.financials.is[k]]);
    for (const k of BS_AGG_KEYS) allBS[k].push([...buffers.financials.bs[k]]);
    for (const k of CF_AGG_KEYS) allCF[k].push([...buffers.financials.cf[k]]);

    // Compute unit economics for this run
    const ue = computeUnitEconomics({
      revenue: buffers.revenue,
      cogs: buffers.cogs,
      totalOpex: buffers.opex,
      netIncome: buffers.profit,
      customers: buffers.customers,
      newCustomers: buffers.newCustomers,
      totalAdSpend: buffers.totalAdSpend,
      totalSalesCost: buffers.totalSalesCost,
      totalHeadcount: buffers.totalHeadcount,
      churnRate: avgChurn,
      T,
    });
    for (const k of UE_AGG_KEYS) allUE[k].push([...ue[k]]);

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

    if (sampleCount > 0 && i % sampleEvery === 0 && sampleRuns.length < sampleCount) {
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

  // Aggregate financial statements into percentiles
  const incomeStatement: Record<string, AggregatedSeries> = {};
  for (const k of IS_AGG_KEYS) incomeStatement[k] = computePercentiles(allIS[k], T);
  const balanceSheet: Record<string, AggregatedSeries> = {};
  for (const k of BS_AGG_KEYS) balanceSheet[k] = computePercentiles(allBS[k], T);
  const cashFlowStatement: Record<string, AggregatedSeries> = {};
  for (const k of CF_AGG_KEYS) cashFlowStatement[k] = computePercentiles(allCF[k], T);
  const unitEconomics: Record<string, AggregatedSeries> = {};
  for (const k of UE_AGG_KEYS) unitEconomics[k] = computePercentiles(allUE[k], T);

  const { winProbability, perGoalSuccess } = computeWinProbability(
    scenario.goals,
    allRunMetrics
  );

  const bindingConstraints = aggregateBindings(allBindingLogs, T);

  return {
    result: {
      scenarioId: scenario.id,
      nRuns,
      percentiles,
      winProbability,
      perGoalSuccess,
      bindingConstraints,
      financialStatements: { incomeStatement, balanceSheet, cashFlowStatement },
      unitEconomics,
    },
    sampleRuns,
  };
}
