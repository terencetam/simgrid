import { describe, it, expect, beforeEach } from "vitest";
import { saasStartup } from "@/engine/templates/saas-startup";
import { TEMPLATES } from "@/engine/templates";
import LZString from "lz-string";
import { Scenario } from "@/engine/schema";

// Note: Dexie tests require fake-indexeddb, which is heavy.
// We test the serialisation/validation logic here; Dexie CRUD is tested manually.

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
    // Scenarios are ~5-20KB JSON; compressed ~2-4KB URL-safe string
    // Modern browsers handle URLs up to ~8KB
    expect(compressed.length).toBeLessThan(4000);
  });

  it("all templates compress to under 5000 chars", () => {
    for (const [id, scenario] of Object.entries(TEMPLATES)) {
      const json = JSON.stringify(scenario);
      const compressed = LZString.compressToEncodedURIComponent(json);
      expect(compressed.length).toBeLessThan(5000);
    }
  });

  it("returns null for invalid compressed data", () => {
    const decompressed = LZString.decompressFromEncodedURIComponent("garbage-data-!!!");
    // lz-string may return empty string or null for invalid data
    if (decompressed) {
      // If it somehow decompresses, it shouldn't be valid JSON
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
      products: [{ id: "p1", name: "P", price: { id: "pr", name: "Price", kind: "constant", baseValue: 10 }, unitCogs: { id: "c", name: "COGS", kind: "constant", baseValue: 2 } }],
      channels: [{ id: "ch", name: "Ch", channelType: "online", capacityPerPeriod: { id: "cap", name: "Cap", kind: "constant", baseValue: 100 }, conversionRate: { id: "conv", name: "Conv", kind: "constant", baseValue: 0.05 }, fixedCost: { id: "fc", name: "FC", kind: "constant", baseValue: 0 }, variableCostPct: { id: "vc", name: "VC", kind: "constant", baseValue: 0 } }],
      goals: [{ id: "g1", metric: "revenue", direction: "at_least", threshold: 1000, byPeriod: 12 }],
      startingCash: 10000,
    };
    const result = Scenario.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      // Defaults should be filled in
      expect(result.data.horizonPeriods).toBe(36);
      expect(result.data.currency).toBe("AUD");
      expect(result.data.stores).toEqual([]);
    }
  });

  it("Zod rejects scenario with missing required fields", () => {
    const invalid = { id: "test" }; // missing name, products, channels, goals, startingCash
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
      expect(result.data.products.length).toBe(saasStartup.products.length);
      expect(result.data.goals.length).toBe(saasStartup.goals.length);
    }
  });

  it("all templates round-trip through JSON", () => {
    for (const [id, scenario] of Object.entries(TEMPLATES)) {
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
