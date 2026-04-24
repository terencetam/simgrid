import { describe, it, expect } from "vitest";
import { makeRng } from "@/engine/core/rng";
import { compileScenario, simulateRun } from "@/engine/simulate";
import { monteCarlo } from "@/engine/montecarlo";
import { generateScenario, ARCHETYPE_CONFIGS } from "@/engine/profiler";
import { getGroupLabel } from "@/engine/profiler/vocabulary";
import { TEMPLATES } from "@/engine/templates";
import type { Archetype } from "@/engine/profiler";

const ARCHETYPES: Archetype[] = [
  "saas", "restaurant", "retail", "ecommerce",
  "wholesale", "services", "marketplace", "manufacturing",
];

describe("profiler config", () => {
  it("has configs for all 8 archetypes", () => {
    for (const arch of ARCHETYPES) {
      expect(ARCHETYPE_CONFIGS[arch]).toBeDefined();
      expect(ARCHETYPE_CONFIGS[arch].id).toBe(arch);
      expect(ARCHETYPE_CONFIGS[arch].name).toBeTruthy();
      expect(ARCHETYPE_CONFIGS[arch].icon).toBeTruthy();
    }
  });

  it("each archetype has at least 5 questions", () => {
    for (const arch of ARCHETYPES) {
      expect(ARCHETYPE_CONFIGS[arch].questions.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("each question has required fields", () => {
    for (const arch of ARCHETYPES) {
      for (const q of ARCHETYPE_CONFIGS[arch].questions) {
        expect(q.id).toBeTruthy();
        expect(q.label).toBeTruthy();
        expect(["number", "select", "boolean"]).toContain(q.type);
        expect(q.default).toBeDefined();
      }
    }
  });
});

describe("generateScenario", () => {
  for (const arch of ARCHETYPES) {
    describe(arch, () => {
      const scenario = generateScenario({
        archetype: arch,
        stage: "early",
        answers: {},
      });

      it("produces a valid scenario structure", () => {
        expect(scenario.id).toBeTruthy();
        expect(scenario.name).toBeTruthy();
        expect(scenario.horizonPeriods).toBeGreaterThan(0);
        expect(scenario.startingCash).toBeGreaterThan(0);
        expect(scenario.businessProfile?.archetype).toBe(arch);
      });

      it("has variables with inputs and formulas", () => {
        expect(scenario.variables.length).toBeGreaterThan(0);
        const inputs = scenario.variables.filter((v) => v.kind === "input");
        const formulas = scenario.variables.filter((v) => v.kind === "formula");
        expect(inputs.length).toBeGreaterThan(0);
        expect(formulas.length).toBeGreaterThan(0);
      });

      it("has chart metric variables for revenue, cash, profit", () => {
        const chartVars = scenario.variables.filter((v) => v.chartMetric);
        const chartMetrics = chartVars.map((v) => v.chartMetric);
        expect(chartMetrics).toContain("revenue");
        expect(chartMetrics).toContain("cash");
        expect(chartMetrics).toContain("profit");
      });

      it("simulates without NaN", () => {
        const rng = makeRng(42);
        const compiled = compileScenario(scenario);
        const result = simulateRun(compiled, rng);

        for (const [varId, series] of result.series) {
          for (let t = 0; t < series.length; t++) {
            expect(Number.isNaN(series[t])).toBe(false);
            expect(Number.isFinite(series[t])).toBe(true);
          }
        }
      });

      it("produces positive revenue by end of horizon", () => {
        const rng = makeRng(42);
        const compiled = compileScenario(scenario);
        const result = simulateRun(compiled, rng);

        const revSeries = result.series.get("revenue");
        expect(revSeries).toBeDefined();
        const lastRevenue = revSeries![scenario.horizonPeriods - 1];
        expect(lastRevenue).toBeGreaterThan(0);
      });

      it("runs MC 50 times with valid results", () => {
        const { result } = monteCarlo(scenario, 50, 42);

        expect(result.nRuns).toBe(50);
        expect(result.survivalRate).toBeGreaterThanOrEqual(0);
        expect(result.survivalRate).toBeLessThanOrEqual(1);
        expect(result.percentiles.revenue).toBeDefined();
        expect(result.percentiles.revenue["50"]).toHaveLength(scenario.horizonPeriods);
      });
    });
  }
});

describe("templates registry", () => {
  it("has all 8 templates", () => {
    for (const arch of ARCHETYPES) {
      const found = Object.values(TEMPLATES).some(
        (s) => s.businessProfile?.archetype === arch
      );
      expect(found).toBe(true);
    }
  });

  it("all templates simulate without errors", () => {
    for (const [, scenario] of Object.entries(TEMPLATES)) {
      const rng = makeRng(42);
      const compiled = compileScenario(scenario);
      const result = simulateRun(compiled, rng);

      const revSeries = result.series.get("revenue");
      expect(revSeries).toBeDefined();
      const lastRevenue = revSeries![scenario.horizonPeriods - 1];
      expect(lastRevenue).toBeGreaterThan(0);
    }
  });
});

describe("vocabulary", () => {
  it("returns group labels for known groups", () => {
    expect(getGroupLabel("saas", "growth")).toBe("Growth & Acquisition");
    expect(getGroupLabel("restaurant", "revenue")).toBe("Menu & Pricing");
    expect(getGroupLabel(undefined, "revenue")).toBe("Revenue");
  });

  it("falls back to default for unknown group", () => {
    expect(getGroupLabel("saas", "unknown")).toBe("unknown");
  });
});
