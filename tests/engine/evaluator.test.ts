import { describe, it, expect, beforeEach } from "vitest";
import { compile, topologicalSort } from "@/engine/core/evaluator";

describe("expression evaluator", () => {
  const current = new Map<string, number>();
  const prev = new Map<string, number>();

  beforeEach(() => {
    current.clear();
    prev.clear();
  });

  it("evaluates simple arithmetic", () => {
    const f = compile("2 + 3 * 4");
    expect(f.evaluate(current, prev)).toBe(14);
  });

  it("evaluates parentheses", () => {
    const f = compile("(2 + 3) * 4");
    expect(f.evaluate(current, prev)).toBe(20);
  });

  it("evaluates division", () => {
    const f = compile("10 / 4");
    expect(f.evaluate(current, prev)).toBe(2.5);
  });

  it("evaluates exponentiation", () => {
    const f = compile("2 ^ 3");
    expect(f.evaluate(current, prev)).toBe(8);
  });

  it("evaluates modulo", () => {
    const f = compile("10 % 3");
    expect(f.evaluate(current, prev)).toBe(1);
  });

  it("evaluates variable references", () => {
    current.set("price", 99);
    current.set("customers", 100);
    const f = compile("price * customers");
    expect(f.evaluate(current, prev)).toBe(9900);
    expect(f.currentDeps).toContain("price");
    expect(f.currentDeps).toContain("customers");
  });

  it("evaluates prev references", () => {
    prev.set("cash", 5000);
    current.set("profit", 200);
    const f = compile("prev.cash + profit");
    expect(f.evaluate(current, prev)).toBe(5200);
    expect(f.prevDeps).toContain("cash");
    expect(f.currentDeps).toContain("profit");
  });

  it("evaluates comparisons", () => {
    const f = compile("3 > 2");
    expect(f.evaluate(current, prev)).toBe(1);

    const f2 = compile("2 > 3");
    expect(f2.evaluate(current, prev)).toBe(0);
  });

  it("evaluates min function", () => {
    const f = compile("min(10, 5)");
    expect(f.evaluate(current, prev)).toBe(5);
  });

  it("evaluates max function", () => {
    const f = compile("max(10, 5)");
    expect(f.evaluate(current, prev)).toBe(10);
  });

  it("evaluates abs function", () => {
    const f = compile("abs(-42)");
    expect(f.evaluate(current, prev)).toBe(42);
  });

  it("evaluates round function", () => {
    const f = compile("round(3.7)");
    expect(f.evaluate(current, prev)).toBe(4);
  });

  it("evaluates clamp function", () => {
    const f = compile("clamp(15, 0, 10)");
    expect(f.evaluate(current, prev)).toBe(10);

    const f2 = compile("clamp(-5, 0, 10)");
    expect(f2.evaluate(current, prev)).toBe(0);
  });

  it("evaluates if function", () => {
    current.set("profit", -100);
    const f = compile("if(profit > 0, 1, 0)");
    expect(f.evaluate(current, prev)).toBe(0);

    current.set("profit", 200);
    expect(f.evaluate(current, prev)).toBe(1);
  });

  it("evaluates unary negation", () => {
    const f = compile("-5 + 3");
    expect(f.evaluate(current, prev)).toBe(-2);
  });

  it("handles underscore variable names", () => {
    current.set("food_cost_pct", 0.3);
    current.set("revenue", 10000);
    const f = compile("revenue * food_cost_pct");
    expect(f.evaluate(current, prev)).toBe(3000);
  });

  it("throws on unknown function", () => {
    expect(() => compile("unknown(1)")).toThrow();
  });

  it("throws on empty expression", () => {
    expect(() => compile("")).toThrow();
  });
});

describe("topologicalSort", () => {
  it("sorts formulas by dependency order", () => {
    const formulas = [
      { id: "c", currentDeps: ["a", "b"] },
      { id: "b", currentDeps: ["a"] },
      { id: "a", currentDeps: [] },
    ];
    const result = topologicalSort(formulas, new Set([]));
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
    expect(result.indexOf("b")).toBeLessThan(result.indexOf("c"));
  });

  it("handles independent formulas", () => {
    const formulas = [
      { id: "a", currentDeps: [] },
      { id: "b", currentDeps: [] },
    ];
    const result = topologicalSort(formulas, new Set([]));
    expect(result).toHaveLength(2);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  it("throws on circular dependency", () => {
    const formulas = [
      { id: "a", currentDeps: ["b"] },
      { id: "b", currentDeps: ["a"] },
    ];
    expect(() => topologicalSort(formulas, new Set([]))).toThrow(/circular/i);
  });

  it("ignores dependencies on inputs (not in formula set)", () => {
    const formulas = [
      { id: "revenue", currentDeps: ["price", "customers"] },
    ];
    const result = topologicalSort(formulas, new Set(["price", "customers"]));
    expect(result).toEqual(["revenue"]);
  });
});
