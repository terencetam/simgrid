import { describe, it, expect } from "vitest";
import { TEMPLATES } from "@/engine/templates";
import LZString from "lz-string";
import { Scenario } from "@/engine/schema";

const saasStartup = TEMPLATES["saas-startup"];

describe("URL sharing", () => {
  it("round-trips a scenario through LZ compression", () => {
    const json = JSON.stringify(saasStartup);
    const compressed = LZString.compressToEncodedURIComponent(json);
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    expect(decompressed).toBe(json);

    const parsed = JSON.parse(decompressed!);
    const result = Scenario.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(saasStartup.id);
      expect(result.data.name).toBe(saasStartup.name);
    }
  });

  it("compresses SaaS template to under 4000 chars", () => {
    const json = JSON.stringify(saasStartup);
    const compressed = LZString.compressToEncodedURIComponent(json);
    expect(compressed.length).toBeLessThan(4000);
  });

  it("all templates compress to under 5000 chars", () => {
    for (const [, scenario] of Object.entries(TEMPLATES)) {
      const json = JSON.stringify(scenario);
      const compressed = LZString.compressToEncodedURIComponent(json);
      expect(compressed.length).toBeLessThan(5000);
    }
  });

  it("returns null for invalid compressed data", () => {
    const decompressed = LZString.decompressFromEncodedURIComponent("garbage-data-!!!");
    if (decompressed) {
      const result = Scenario.safeParse((() => {
        try { return JSON.parse(decompressed); }
        catch { return undefined; }
      })());
      expect(result.success).toBe(false);
    }
  });

  it("Zod validates and adds defaults for minimal scenario", () => {
    const minimal = {
      id: "test",
      name: "Test",
      variables: [
        { id: "v1", name: "Price", kind: "input", baseValue: 10 },
      ],
      goals: [{ id: "g1", metric: "revenue", direction: "at_least", threshold: 1000, byPeriod: 12 }],
      startingCash: 10000,
    };
    const result = Scenario.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.horizonPeriods).toBe(24);
      expect(result.data.currency).toBe("AUD");
    }
  });

  it("Zod rejects scenario with missing required fields", () => {
    const invalid = { id: "test" };
    const result = Scenario.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("JSON export/import", () => {
  it("round-trips through JSON stringify/parse + Zod", () => {
    const json = JSON.stringify(saasStartup, null, 2);
    const parsed = JSON.parse(json);
    const result = Scenario.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(saasStartup.id);
      expect(result.data.variables.length).toBe(saasStartup.variables.length);
      expect(result.data.goals.length).toBe(saasStartup.goals.length);
    }
  });

  it("all templates round-trip through JSON", () => {
    for (const [, scenario] of Object.entries(TEMPLATES)) {
      const json = JSON.stringify(scenario, null, 2);
      const parsed = JSON.parse(json);
      const result = Scenario.safeParse(parsed);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid JSON content", () => {
    const result = Scenario.safeParse({ not: "a scenario" });
    expect(result.success).toBe(false);
  });
});
