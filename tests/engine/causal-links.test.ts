import { describe, it, expect } from "vitest";
import { compileCausalGraph, applyCausalLinks } from "@/engine/core/causal-links";
import { makeRng } from "@/engine/core/rng";
import type { CausalLink } from "@/engine/schema";

describe("compileCausalGraph", () => {
  it("compiles a simple chain A → B → C", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "a", targetId: "b", polarity: "positive", strength: 1, delay: 0, noise: 0 },
      { id: "l2", sourceId: "b", targetId: "c", polarity: "positive", strength: 1, delay: 0, noise: 0 },
    ];
    const varIds = new Set(["a", "b", "c"]);
    const graph = compileCausalGraph(links, varIds);

    expect(graph.order).toEqual(["b", "c"]);
    expect(graph.linksByTarget.get("b")?.length).toBe(1);
    expect(graph.linksByTarget.get("c")?.length).toBe(1);
  });

  it("detects cycles", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "a", targetId: "b", polarity: "positive", strength: 1, delay: 0, noise: 0 },
      { id: "l2", sourceId: "b", targetId: "a", polarity: "positive", strength: 1, delay: 0, noise: 0 },
    ];
    const varIds = new Set(["a", "b"]);
    expect(() => compileCausalGraph(links, varIds)).toThrow("cycle");
  });

  it("handles independent links (no chain)", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "a", targetId: "b", polarity: "positive", strength: 1, delay: 0, noise: 0 },
      { id: "l2", sourceId: "c", targetId: "d", polarity: "negative", strength: 0.5, delay: 0, noise: 0 },
    ];
    const varIds = new Set(["a", "b", "c", "d"]);
    const graph = compileCausalGraph(links, varIds);
    expect(graph.order.length).toBe(2);
    expect(graph.order).toContain("b");
    expect(graph.order).toContain("d");
  });

  it("skips links referencing unknown variables", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "unknown", targetId: "b", polarity: "positive", strength: 1, delay: 0, noise: 0 },
    ];
    const varIds = new Set(["b"]);
    const graph = compileCausalGraph(links, varIds);
    expect(graph.order.length).toBe(0);
  });
});

describe("applyCausalLinks", () => {
  const rng = makeRng(42);

  it("applies a positive link (source increased)", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "spend", targetId: "conv", polarity: "positive", strength: 0.5, delay: 0, noise: 0 },
    ];
    const varIds = new Set(["spend", "conv"]);
    const graph = compileCausalGraph(links, varIds);

    const resolvedValues = new Map([["spend", 12000], ["conv", 0.03]]);
    const baseValues = new Map([["spend", 10000], ["conv", 0.03]]);
    const history = new Map<string, number[]>();

    const result = applyCausalLinks(
      "conv", 0.03, graph.linksByTarget,
      resolvedValues, baseValues, history, rng,
    );

    // spend increased 20% from base, strength 0.5, positive
    // adjustment = 0.2 * 0.5 * 1 = 0.1
    // 0.03 * 1.1 = 0.033
    expect(result).toBeCloseTo(0.033, 4);
  });

  it("applies a negative link (balancing)", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "customers", targetId: "churn", polarity: "negative", strength: 1.0, delay: 0, noise: 0 },
    ];
    const varIds = new Set(["customers", "churn"]);
    const graph = compileCausalGraph(links, varIds);

    const resolvedValues = new Map([["customers", 150], ["churn", 0.05]]);
    const baseValues = new Map([["customers", 100], ["churn", 0.05]]);
    const history = new Map<string, number[]>();

    const result = applyCausalLinks(
      "churn", 0.05, graph.linksByTarget,
      resolvedValues, baseValues, history, rng,
    );

    // customers increased 50% from base, strength 1.0, negative
    // adjustment = 0.5 * 1.0 * -1 = -0.5
    // 0.05 * (1 + (-0.5)) = 0.05 * 0.5 = 0.025
    expect(result).toBeCloseTo(0.025, 4);
  });

  it("handles delayed links (waits for history)", () => {
    const links: CausalLink[] = [
      { id: "l1", sourceId: "spend", targetId: "conv", polarity: "positive", strength: 0.5, delay: 2, noise: 0 },
    ];
    const varIds = new Set(["spend", "conv"]);
    const graph = compileCausalGraph(links, varIds);

    const resolvedValues = new Map([["spend", 15000], ["conv", 0.03]]);
    const baseValues = new Map([["spend", 10000], ["conv", 0.03]]);

    // Not enough history — should return baseResolvedValue unchanged
    const history = new Map([["spend", [10000]]]); // only 1 period of history, need 2
    const result = applyCausalLinks(
      "conv", 0.03, graph.linksByTarget,
      resolvedValues, baseValues, history, rng,
    );
    expect(result).toBe(0.03);

    // With enough history — should apply
    const history2 = new Map([["spend", [10000, 12000]]]); // 2 periods, delay=2 → use index 0
    const result2 = applyCausalLinks(
      "conv", 0.03, graph.linksByTarget,
      resolvedValues, baseValues, history2, rng,
    );
    // Uses spend from 2 periods ago (10000), delta = (10000-10000)/10000 = 0
    expect(result2).toBeCloseTo(0.03, 4);
  });

  it("returns unchanged value when no links exist", () => {
    const linksByTarget = new Map<string, CausalLink[]>();
    const result = applyCausalLinks(
      "conv", 0.03, linksByTarget,
      new Map(), new Map(), new Map(), rng,
    );
    expect(result).toBe(0.03);
  });
});
