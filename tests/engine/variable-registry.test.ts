import { describe, it, expect } from "vitest";
import { collectVariables, patchVariable } from "@/engine/core/variable-registry";
import { saasStartup } from "@/engine/templates/saas-startup";

describe("collectVariables", () => {
  it("collects all variables from a scenario", () => {
    const vars = collectVariables(saasStartup);
    // SaaS template has: price, cogs, ch-cap, ch-conv, ch-fixed, ch-var,
    // tam, share, churn, acv, ae-cost, ae-quota, ae-hit, ae-attr,
    // ad-spend, ad-cac, eng-salary, ops-salary = 18 variables
    expect(vars.size).toBe(18);
  });

  it("assigns correct groups", () => {
    const vars = collectVariables(saasStartup);
    const price = vars.get("price")!;
    expect(price.group).toBe("revenue");
    expect(price.fieldPath).toBe("product.price");

    const adSpend = vars.get("ad-spend")!;
    expect(adSpend.group).toBe("sales_marketing");

    const cogs = vars.get("cogs")!;
    expect(cogs.group).toBe("operations");
  });

  it("infers valueType from explicit annotations", () => {
    const vars = collectVariables(saasStartup);
    const conv = vars.get("ch-conv")!;
    expect(conv.valueType).toBe("percent");

    const price = vars.get("price")!;
    expect(price.valueType).toBe("currency");
  });

  it("infers valueType from patterns when not explicit", () => {
    const vars = collectVariables(saasStartup);
    const attrition = vars.get("ae-attr")!;
    expect(attrition.valueType).toBe("percent"); // "attrition" triggers percent pattern
  });

  it("includes custom variables", () => {
    const scenario = {
      ...saasStartup,
      customVariables: [
        {
          id: "custom-1",
          name: "Brand Awareness",
          kind: "constant" as const,
          baseValue: 0.5,
          resampleEachPeriod: true,
          group: "sales_marketing" as const,
          valueType: "percent" as const,
        },
      ],
    };
    const vars = collectVariables(scenario);
    expect(vars.has("custom-1")).toBe(true);
    expect(vars.get("custom-1")!.group).toBe("sales_marketing");
  });
});

describe("patchVariable", () => {
  it("patches a product variable", () => {
    const updated = patchVariable(saasStartup, "price", 149);
    expect(updated.products[0].price.baseValue).toBe(149);
    // Original unchanged
    expect(saasStartup.products[0].price.baseValue).toBe(99);
  });

  it("patches a segment variable", () => {
    const updated = patchVariable(saasStartup, "churn", 0.08);
    expect(updated.segments[0].churnRate.baseValue).toBe(0.08);
  });

  it("patches an ad channel variable", () => {
    const updated = patchVariable(saasStartup, "ad-spend", 20000);
    expect(updated.adChannels[0].spend.baseValue).toBe(20000);
  });

  it("patches a custom variable", () => {
    const scenario = {
      ...saasStartup,
      customVariables: [
        {
          id: "custom-1",
          name: "Test",
          kind: "constant" as const,
          baseValue: 100,
          resampleEachPeriod: true,
        },
      ],
    };
    const updated = patchVariable(scenario, "custom-1", 200);
    expect(updated.customVariables![0].baseValue).toBe(200);
  });

  it("does not mutate the original scenario", () => {
    const original = saasStartup.products[0].price.baseValue;
    patchVariable(saasStartup, "price", 999);
    expect(saasStartup.products[0].price.baseValue).toBe(original);
  });
});
