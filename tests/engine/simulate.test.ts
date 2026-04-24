import { describe, it, expect } from "vitest";
import { makeRng } from "@/engine/core/rng";
import { compileScenario, simulateRun } from "@/engine/simulate";
import { monteCarlo } from "@/engine/montecarlo";
import { runSensitivity } from "@/engine/core/sensitivity";
import { TEMPLATES } from "@/engine/templates";

const saasStartup = TEMPLATES["saas-startup"];

describe("simulateRun", () => {
  it("produces non-zero revenue over 24 months", () => {
    const rng = makeRng(42);
    const compiled = compileScenario(saasStartup);
    const result = simulateRun(compiled, rng);

    // Revenue should be positive by the end
    const revSeries = result.series.get("revenue");
    expect(revSeries).toBeDefined();
    const lastRevenue = revSeries![revSeries!.length - 1];
    expect(lastRevenue).toBeGreaterThan(0);
  });

  it("tracks cash from starting value", () => {
    const rng = makeRng(42);
    const compiled = compileScenario(saasStartup);
    const result = simulateRun(compiled, rng);

    const cashSeries = result.series.get("cash");
    expect(cashSeries).toBeDefined();
    // Cash should exist at period 0
    expect(cashSeries![0]).toBeDefined();
    expect(Number.isFinite(cashSeries![0])).toBe(true);
  });

  it("tracks customer growth", () => {
    const rng = makeRng(42);
    const compiled = compileScenario(saasStartup);
    const result = simulateRun(compiled, rng);

    const custSeries = result.series.get("customers");
    expect(custSeries).toBeDefined();
    expect(custSeries![0]).toBeGreaterThan(0);
    expect(custSeries![23]).toBeGreaterThan(custSeries![0]);
  });

  it("is deterministic with same seed", () => {
    const compiled = compileScenario(saasStartup);

    const rng1 = makeRng(42);
    const result1 = simulateRun(compiled, rng1);

    const rng2 = makeRng(42);
    const result2 = simulateRun(compiled, rng2);

    const rev1 = result1.series.get("revenue")!;
    const rev2 = result2.series.get("revenue")!;
    expect(rev1).toEqual(rev2);

    const cash1 = result1.series.get("cash")!;
    const cash2 = result2.series.get("cash")!;
    expect(cash1).toEqual(cash2);
  });

  it("varies with different seeds", () => {
    const compiled = compileScenario(saasStartup);

    const rng1 = makeRng(42);
    const result1 = simulateRun(compiled, rng1);

    const rng2 = makeRng(999);
    const result2 = simulateRun(compiled, rng2);

    const rev1 = result1.series.get("revenue")!;
    const rev2 = result2.series.get("revenue")!;
    const same = rev1.every((v, i) => v === rev2[i]);
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

  it("computes survival rate between 0 and 1", () => {
    const { result } = monteCarlo(saasStartup, 100, 42);

    expect(result.survivalRate).toBeGreaterThanOrEqual(0);
    expect(result.survivalRate).toBeLessThanOrEqual(1);
  });

  it("returns sample run traces for spaghetti animation", () => {
    const { result, sampleRuns } = monteCarlo(saasStartup, 100, 42, undefined, 50);

    expect(result.nRuns).toBe(100);
    expect(sampleRuns.length).toBeLessThanOrEqual(50);
    expect(sampleRuns.length).toBeGreaterThan(0);

    // Each sample run should have values and survived status
    for (const run of sampleRuns) {
      expect(run.values).toBeDefined();
      expect(typeof run.survived).toBe("boolean");
      // Should have at least revenue series
      const revenueVals = Object.values(run.values).find(
        (v) => v.length === 24
      );
      expect(revenueVals).toBeDefined();
    }
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
    const tornado = runSensitivity(saasStartup, result.survivalRate, 0.1, 100, 42);

    expect(tornado.baseSurvivalRate).toBe(result.survivalRate);
    expect(tornado.levers.length).toBeGreaterThan(0);

    // Levers should be sorted by impact (descending)
    for (let i = 1; i < tornado.levers.length; i++) {
      expect(tornado.levers[i - 1].impact).toBeGreaterThanOrEqual(tornado.levers[i].impact);
    }
  });
});
