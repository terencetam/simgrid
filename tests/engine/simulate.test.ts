import { describe, it, expect } from "vitest";
import { makeRng } from "@/engine/core/rng";
import { simulateRun, allocateBuffers } from "@/engine/simulate";
import { monteCarlo } from "@/engine/montecarlo";
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

  it("completes 1000 runs in under 3 seconds", () => {
    const start = performance.now();
    monteCarlo(saasStartup, 1000, 42);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });
});
