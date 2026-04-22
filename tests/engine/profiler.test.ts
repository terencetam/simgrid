import { describe, it, expect } from "vitest";
import { makeRng } from "@/engine/core/rng";
import { simulateRun, allocateBuffers } from "@/engine/simulate";
import { monteCarlo } from "@/engine/montecarlo";
import { generateScenario, ARCHETYPE_CONFIGS, getLabel, isHidden } from "@/engine/profiler";
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
        expect(scenario.goals.length).toBeGreaterThan(0);
        expect(scenario.businessProfile?.archetype).toBe(arch);
      });

      it("has at least one product", () => {
        expect(scenario.products.length).toBeGreaterThan(0);
        expect(scenario.products[0].price.baseValue).toBeGreaterThan(0);
      });

      it("simulates without NaN", () => {
        const rng = makeRng(42);
        const buffers = allocateBuffers(scenario.horizonPeriods);
        simulateRun(scenario, buffers, rng);

        for (let t = 0; t < scenario.horizonPeriods; t++) {
          expect(Number.isNaN(buffers.revenue[t])).toBe(false);
          expect(Number.isNaN(buffers.cash[t])).toBe(false);
          expect(Number.isFinite(buffers.revenue[t])).toBe(true);
          expect(Number.isFinite(buffers.cash[t])).toBe(true);
        }
      });

      it("produces positive revenue by end of horizon", () => {
        const rng = makeRng(42);
        const buffers = allocateBuffers(scenario.horizonPeriods);
        simulateRun(scenario, buffers, rng);

        const lastRevenue = buffers.revenue[scenario.horizonPeriods - 1];
        expect(lastRevenue).toBeGreaterThan(0);
      });

      it("runs MC 50 times with valid results", () => {
        const { result } = monteCarlo(scenario, 50, 42);

        expect(result.nRuns).toBe(50);
        expect(result.winProbability).toBeGreaterThanOrEqual(0);
        expect(result.winProbability).toBeLessThanOrEqual(1);
        expect(result.percentiles.revenue).toBeDefined();
        expect(result.percentiles.revenue["50"]).toHaveLength(scenario.horizonPeriods);
      });
    });
  }
});

describe("templates registry", () => {
  it("has all 8 templates", () => {
    for (const arch of ARCHETYPES) {
      const key = `${arch}-template`;
      // Templates use either "archetype-template" or "archetype-startup" naming
      const found = Object.keys(TEMPLATES).some(
        (k) => k.startsWith(arch) || TEMPLATES[k]?.businessProfile?.archetype === arch
      );
      expect(found).toBe(true);
    }
  });

  it("all templates simulate without errors", () => {
    for (const [id, scenario] of Object.entries(TEMPLATES)) {
      const rng = makeRng(42);
      const buffers = allocateBuffers(scenario.horizonPeriods);
      simulateRun(scenario, buffers, rng);

      const lastRevenue = buffers.revenue[scenario.horizonPeriods - 1];
      expect(lastRevenue).toBeGreaterThan(0);
    }
  });
});

describe("vocabulary", () => {
  it("returns archetype-specific label for SaaS", () => {
    expect(getLabel("saas", "product.price", "Price")).toBe("Monthly subscription price");
    expect(getLabel("saas", "segment.churnRate", "Churn")).toBe("Monthly churn rate");
  });

  it("returns archetype-specific label for restaurant", () => {
    expect(getLabel("restaurant", "product.price", "Price")).toBe("Average cover price");
    expect(getLabel("restaurant", "product.unitCogs", "COGS")).toBe("Food cost per cover");
  });

  it("falls back to default label for unknown field", () => {
    expect(getLabel("saas", "nonexistent.field", "Fallback")).toBe("Fallback");
  });

  it("falls back to default when no archetype", () => {
    expect(getLabel(undefined, "product.price", "Price")).toBe("Price");
  });

  it("hides restaurant-specific fields", () => {
    expect(isHidden("restaurant", "segment.churnRate")).toBe(true);
    expect(isHidden("restaurant", "adChannel.spend")).toBe(true);
    expect(isHidden("restaurant", "metric.burnMultiple")).toBe(true);
  });

  it("does not hide SaaS churn", () => {
    expect(isHidden("saas", "segment.churnRate")).toBe(false);
  });

  it("returns false for no archetype", () => {
    expect(isHidden(undefined, "segment.churnRate")).toBe(false);
  });
});
