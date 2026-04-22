import { describe, it, expect } from "vitest";
import { makeRng } from "@/engine/core/rng";
import { simulateRun, allocateBuffers } from "@/engine/simulate";
import { monteCarlo } from "@/engine/montecarlo";
import { runSensitivity } from "@/engine/core/sensitivity";
import { saasStartup } from "@/engine/templates/saas-startup";

describe("simulateRun", () => {
  it("produces non-zero revenue over 24 months", () => {
    const rng = makeRng(42);
    const buffers = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buffers, rng);

    // Revenue should be positive by the end
    const lastRevenue = buffers.revenue[buffers.revenue.length - 1];
    expect(lastRevenue).toBeGreaterThan(0);
  });

  it("starts with the correct starting cash", () => {
    const rng = makeRng(42);
    const buffers = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buffers, rng);

    // First period cash should be close to starting cash (minus first period costs)
    // Starting cash is $500K
    expect(buffers.cash[0]).toBeLessThan(saasStartup.startingCash);
    expect(buffers.cash[0]).toBeGreaterThan(0);
  });

  it("tracks customer growth", () => {
    const rng = makeRng(42);
    const buffers = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buffers, rng);

    // Customers should grow over time (from 50 starting)
    expect(buffers.customers[0]).toBeGreaterThan(0);
    expect(buffers.customers[23]).toBeGreaterThan(buffers.customers[0]);
  });

  it("is deterministic with same seed", () => {
    const rng1 = makeRng(42);
    const buf1 = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buf1, rng1);

    const rng2 = makeRng(42);
    const buf2 = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buf2, rng2);

    expect(buf1.revenue).toEqual(buf2.revenue);
    expect(buf1.cash).toEqual(buf2.cash);
    expect(buf1.customers).toEqual(buf2.customers);
  });

  it("varies with different seeds", () => {
    const rng1 = makeRng(42);
    const buf1 = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buf1, rng1);

    const rng2 = makeRng(999);
    const buf2 = allocateBuffers(saasStartup.horizonPeriods);
    simulateRun(saasStartup, buf2, rng2);

    // Should not be identical
    const same = buf1.revenue.every((v, i) => v === buf2.revenue[i]);
    expect(same).toBe(false);
  });
});

describe("monteCarlo", () => {
  it("runs 100 simulations and returns percentiles", () => {
    const { result } = monteCarlo(saasStartup, 100, 42);

    expect(result.nRuns).toBe(100);
    expect(result.percentiles.revenue).toBeDefined();
    expect(result.percentiles.revenue["50"]).toHaveLength(24);

    // P90 revenue should be >= P50 >= P10
    const lastIdx = 23;
    const p10 = result.percentiles.revenue["10"][lastIdx];
    const p50 = result.percentiles.revenue["50"][lastIdx];
    const p90 = result.percentiles.revenue["90"][lastIdx];
    expect(p90).toBeGreaterThanOrEqual(p50);
    expect(p50).toBeGreaterThanOrEqual(p10);
  });

  it("computes win probability between 0 and 1", () => {
    const { result } = monteCarlo(saasStartup, 100, 42);

    expect(result.winProbability).toBeGreaterThanOrEqual(0);
    expect(result.winProbability).toBeLessThanOrEqual(1);
  });

  it("returns per-goal success rates", () => {
    const { result } = monteCarlo(saasStartup, 100, 42);

    expect(result.perGoalSuccess["goal-arr"]).toBeDefined();
    expect(result.perGoalSuccess["goal-cash"]).toBeDefined();
  });

  it("returns sample run traces for spaghetti animation", () => {
    const { result, sampleRuns } = monteCarlo(saasStartup, 100, 42, undefined, 50);

    expect(result.nRuns).toBe(100);
    expect(sampleRuns.length).toBeLessThanOrEqual(50);
    expect(sampleRuns.length).toBeGreaterThan(0);

    // Each sample run should have the right length
    for (const run of sampleRuns) {
      expect(run.revenue).toHaveLength(24);
      expect(run.cash).toHaveLength(24);
      expect(run.customers).toHaveLength(24);
      expect(run.profit).toHaveLength(24);
      expect(typeof run.won).toBe("boolean");
    }
  });

  it("returns financial statements with IS, BS, CF", () => {
    const { result } = monteCarlo(saasStartup, 50, 42);

    // Income statement
    const is = result.financialStatements.incomeStatement;
    expect(is.revenue).toBeDefined();
    expect(is.revenue["50"]).toHaveLength(24);
    expect(is.netIncome).toBeDefined();
    expect(is.grossProfit).toBeDefined();

    // Balance sheet
    const bs = result.financialStatements.balanceSheet;
    expect(bs.cash).toBeDefined();
    expect(bs.totalAssets).toBeDefined();
    expect(bs.totalEquity).toBeDefined();

    // Cash flow statement
    const cf = result.financialStatements.cashFlowStatement;
    expect(cf.cashFromOperations).toBeDefined();
    expect(cf.endingCash).toBeDefined();
  });

  it("returns unit economics data", () => {
    const { result } = monteCarlo(saasStartup, 50, 42);

    const ue = result.unitEconomics;
    expect(ue.cac).toBeDefined();
    expect(ue.ltv).toBeDefined();
    expect(ue.ltvCacRatio).toBeDefined();
    expect(ue.grossMarginPct).toBeDefined();

    // Gross margin should be reasonable for SaaS (price $99, cogs $8 = ~92%)
    const lastGM = ue.grossMarginPct["50"][23];
    expect(lastGM).toBeGreaterThan(0.5);
    expect(lastGM).toBeLessThanOrEqual(1);
  });

  it("completes 1000 runs in under 3 seconds", () => {
    const start = performance.now();
    monteCarlo(saasStartup, 1000, 42);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });
});

describe("sensitivity analysis", () => {
  it("identifies levers and computes impact", () => {
    const { result } = monteCarlo(saasStartup, 100, 42);
    const tornado = runSensitivity(saasStartup, result.winProbability, 0.1, 100, 42);

    expect(tornado.baseWinProb).toBe(result.winProbability);
    expect(tornado.levers.length).toBeGreaterThan(0);

    // Levers should be sorted by impact (descending)
    for (let i = 1; i < tornado.levers.length; i++) {
      expect(tornado.levers[i - 1].impact).toBeGreaterThanOrEqual(tornado.levers[i].impact);
    }
  });
});
