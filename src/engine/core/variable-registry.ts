/**
 * Variable Registry — central discovery and patching for all variables in a scenario.
 * Eliminates duplicated "walk all primitives" patterns across store, sensitivity, and UI.
 */
import type {
  Scenario,
  Variable,
  VariableGroup,
  ValueType,
} from "../schema";

export interface RegisteredVariable {
  variable: Variable;
  fieldPath: string;
  primitiveName: string;
  primitiveType: string;
  group: VariableGroup;
  valueType: ValueType;
}

// ─── Group inference from field path ────────────────────────────

const GROUP_MAP: Record<string, VariableGroup> = {
  "product.price": "revenue",
  "product.unitCogs": "operations",
  "segment.tam": "revenue",
  "segment.ourShare": "revenue",
  "segment.churnRate": "revenue",
  "segment.acv": "revenue",
  "channel.capacityPerPeriod": "sales_marketing",
  "channel.conversionRate": "sales_marketing",
  "channel.fixedCost": "sales_marketing",
  "channel.variableCostPct": "sales_marketing",
  "adChannel.spend": "sales_marketing",
  "adChannel.cac": "sales_marketing",
  "salesRole.fullyLoadedCost": "sales_marketing",
  "salesRole.quota": "sales_marketing",
  "salesRole.quotaHitProbability": "sales_marketing",
  "salesRole.attritionProbPerPeriod": "sales_marketing",
  "store.fixedCostPerUnit": "operations",
  "store.revenueCapPerUnit": "operations",
  "headcount.salary": "operations",
  "scalingCost.amount": "operations",
  "fixedAsset.purchaseCost": "finance",
};

function inferGroup(fieldPath: string): VariableGroup {
  return GROUP_MAP[fieldPath] ?? "operations";
}

// ─── ValueType inference ────────────────────────────────────────

const PERCENT_PATTERNS = /rate|probability|pct|conversion|margin|attrition/i;
const COUNT_PATTERNS = /count|reps|headcount/i;
const DAYS_PATTERNS = /days|dso|dpo|dio/i;

function inferValueType(v: Variable, fieldPath: string): ValueType {
  const nameAndPath = `${v.name} ${fieldPath}`;
  if (PERCENT_PATTERNS.test(nameAndPath)) return "percent";
  if (COUNT_PATTERNS.test(nameAndPath)) return "count";
  if (DAYS_PATTERNS.test(nameAndPath)) return "days";
  if (v.baseValue > 0 && v.baseValue <= 1) return "percent";
  return "currency";
}

// ─── Collect all variables ──────────────────────────────────────

function addVar(
  map: Map<string, RegisteredVariable>,
  v: Variable,
  fieldPath: string,
  primitiveName: string,
  primitiveType: string,
): void {
  map.set(v.id, {
    variable: v,
    fieldPath,
    primitiveName,
    primitiveType,
    group: v.group ?? inferGroup(fieldPath),
    valueType: v.valueType ?? inferValueType(v, fieldPath),
  });
}

/**
 * Collect ALL variables from a scenario into a flat map keyed by variable ID.
 */
export function collectVariables(
  scenario: Scenario,
): Map<string, RegisteredVariable> {
  const map = new Map<string, RegisteredVariable>();

  for (const p of scenario.products) {
    addVar(map, p.price, "product.price", p.name, "products");
    addVar(map, p.unitCogs, "product.unitCogs", p.name, "products");
  }

  for (const seg of scenario.segments) {
    addVar(map, seg.tam, "segment.tam", seg.name, "segments");
    addVar(map, seg.ourShare, "segment.ourShare", seg.name, "segments");
    addVar(map, seg.churnRate, "segment.churnRate", seg.name, "segments");
    addVar(map, seg.acv, "segment.acv", seg.name, "segments");
  }

  for (const ad of scenario.adChannels) {
    addVar(map, ad.spend, "adChannel.spend", ad.name, "adChannels");
    addVar(map, ad.cac, "adChannel.cac", ad.name, "adChannels");
  }

  for (const ch of scenario.channels) {
    addVar(map, ch.capacityPerPeriod, "channel.capacityPerPeriod", ch.name, "channels");
    addVar(map, ch.conversionRate, "channel.conversionRate", ch.name, "channels");
    addVar(map, ch.fixedCost, "channel.fixedCost", ch.name, "channels");
    addVar(map, ch.variableCostPct, "channel.variableCostPct", ch.name, "channels");
  }

  for (const sr of scenario.salesRoles) {
    addVar(map, sr.fullyLoadedCost, "salesRole.fullyLoadedCost", sr.name, "salesRoles");
    addVar(map, sr.quota, "salesRole.quota", sr.name, "salesRoles");
    addVar(map, sr.quotaHitProbability, "salesRole.quotaHitProbability", sr.name, "salesRoles");
    addVar(map, sr.attritionProbPerPeriod, "salesRole.attritionProbPerPeriod", sr.name, "salesRoles");
  }

  for (const store of scenario.stores) {
    addVar(map, store.fixedCostPerUnit, "store.fixedCostPerUnit", store.name, "stores");
    addVar(map, store.revenueCapPerUnit, "store.revenueCapPerUnit", store.name, "stores");
  }

  for (const hc of scenario.otherHeadcount) {
    addVar(map, hc.salary, "headcount.salary", hc.name, "otherHeadcount");
  }

  for (const sc of scenario.scalingCosts) {
    addVar(map, sc.amount, "scalingCost.amount", sc.name, "scalingCosts");
  }

  for (const fa of scenario.fixedAssets) {
    addVar(map, fa.purchaseCost, "fixedAsset.purchaseCost", fa.name, "fixedAssets");
  }

  // Custom variables (user-created)
  for (const cv of scenario.customVariables ?? []) {
    addVar(map, cv, "custom", cv.name, "customVariables");
  }

  return map;
}

/**
 * Patch a single variable's baseValue by ID. Returns a new scenario (immutable).
 */
export function patchVariable(
  scenario: Scenario,
  variableId: string,
  baseValue: number,
): Scenario {
  const s = structuredClone(scenario);

  const patchIn = (v: Variable): boolean => {
    if (v.id === variableId) {
      v.baseValue = baseValue;
      return true;
    }
    return false;
  };

  for (const p of s.products) {
    if (patchIn(p.price) || patchIn(p.unitCogs)) return s;
  }
  for (const seg of s.segments) {
    if (patchIn(seg.tam) || patchIn(seg.ourShare) || patchIn(seg.churnRate) || patchIn(seg.acv)) return s;
  }
  for (const ad of s.adChannels) {
    if (patchIn(ad.spend) || patchIn(ad.cac)) return s;
  }
  for (const ch of s.channels) {
    if (patchIn(ch.capacityPerPeriod) || patchIn(ch.conversionRate) || patchIn(ch.fixedCost) || patchIn(ch.variableCostPct)) return s;
  }
  for (const sr of s.salesRoles) {
    if (patchIn(sr.fullyLoadedCost) || patchIn(sr.quota) || patchIn(sr.quotaHitProbability) || patchIn(sr.attritionProbPerPeriod)) return s;
  }
  for (const store of s.stores) {
    if (patchIn(store.fixedCostPerUnit) || patchIn(store.revenueCapPerUnit)) return s;
  }
  for (const hc of s.otherHeadcount) {
    if (patchIn(hc.salary)) return s;
  }
  for (const sc of s.scalingCosts) {
    if (patchIn(sc.amount)) return s;
  }
  for (const fa of s.fixedAssets) {
    if (patchIn(fa.purchaseCost)) return s;
  }
  for (const cv of s.customVariables ?? []) {
    if (patchIn(cv)) return s;
  }

  return s;
}
