import { z } from "zod";

// ─── Variable kinds ───────────────────────────────────────────────

export const VariableKind = z.enum([
  "constant",
  "linear_trend",
  "exponential",
  "step",
  "seasonal",
  "stochastic",
  "piecewise",
  "elasticity",
  "formula",
]);

export const DistributionKind = z.enum([
  "normal",
  "lognormal",
  "uniform",
  "triangular",
  "bernoulli",
]);

export const Variable = z.object({
  id: z.string(),
  name: z.string(),
  kind: VariableKind,
  baseValue: z.number(),
  rate: z.number().optional(),
  changeAt: z.number().int().optional(),
  newValue: z.number().optional(),
  amplitude: z.number().optional(),
  period: z.number().int().optional(),
  distribution: DistributionKind.optional(),
  distributionParams: z.record(z.string(), z.number()).optional(),
  series: z.array(z.number()).optional(),
  expression: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  resampleEachPeriod: z.boolean().default(true),
});
export type Variable = z.infer<typeof Variable>;

// ─── Constraint ───────────────────────────────────────────────────

export const Constraint = z.object({
  id: z.string(),
  targetId: z.string(),
  capValue: z.union([z.number(), z.string()]),
  capKind: z.enum(["hard", "soft"]).default("hard"),
});

// ─── Primitives ───────────────────────────────────────────────────

export const Product = z.object({
  id: z.string(),
  name: z.string(),
  price: Variable,
  unitCogs: Variable,
  elasticity: z.number().optional(),
  launchPeriod: z.number().int().default(0),
});

export const Channel = z.object({
  id: z.string(),
  name: z.string(),
  channelType: z.enum(["direct", "retail", "online", "wholesale", "partner"]),
  capacityPerPeriod: Variable,
  conversionRate: Variable,
  fixedCost: Variable,
  variableCostPct: Variable,
  rampCurve: z.array(z.number()).default([1]),
});

export const Store = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
  fixedCostPerUnit: Variable,
  revenueCapPerUnit: Variable,
  rampCurve: z.array(z.number()).default([0.25, 0.5, 0.75, 1]),
  openingSchedule: z
    .array(z.tuple([z.number().int(), z.number().int()]))
    .default([]),
});

export const Segment = z.object({
  id: z.string(),
  name: z.string(),
  tam: Variable,
  ourShare: Variable,
  churnRate: Variable,
  acv: Variable,
});

export const SalesRole = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
  fullyLoadedCost: Variable,
  rampCurve: z.array(z.number()),
  quota: Variable,
  quotaHitProbability: Variable,
  attritionProbPerPeriod: Variable,
});

export const AdChannel = z.object({
  id: z.string(),
  name: z.string(),
  spend: Variable,
  cac: Variable,
  diminishingReturnsThreshold: Variable.optional(),
});

export const HeadcountRole = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
  salary: Variable,
  onCostsMultiplier: z.number().default(1.3),
  rampMonths: z.number().int().default(0),
  attritionProbPerPeriod: z.number().default(0),
  recruitmentCostPerHire: z.number().default(0),
});

export const PaymentTerms = z.object({
  dso: z.number().default(0),
  dpo: z.number().default(0),
  dio: z.number().default(0),
  billingFrequency: z
    .enum(["monthly", "quarterly", "annual", "upfront"])
    .default("monthly"),
});

export const ScalingCostTrigger = z.object({
  id: z.string(),
  name: z.string(),
  triggerMetric: z.string(),
  threshold: z.number(),
  costType: z.enum(["one_time", "recurring"]),
  amount: Variable,
});

export const FixedAsset = z.object({
  id: z.string(),
  name: z.string(),
  purchaseCost: Variable,
  usefulLifeMonths: z.number().int(),
  depreciationMethod: z.enum(["straight_line"]).default("straight_line"),
  purchaseSchedule: z
    .array(z.tuple([z.number().int(), z.number().int()]))
    .default([]),
});

export const DebtFacility = z.object({
  id: z.string(),
  name: z.string(),
  principal: z.number(),
  interestRate: z.number(),
  termMonths: z.number().int(),
  drawdownSchedule: z
    .array(z.tuple([z.number().int(), z.number()]))
    .default([]),
  isRevolving: z.boolean().default(false),
  revolvingLimit: z.number().optional(),
});

export const BusinessProfile = z.object({
  archetype: z.enum([
    "saas",
    "restaurant",
    "retail",
    "ecommerce",
    "wholesale",
    "services",
    "marketplace",
    "manufacturing",
  ]),
  stage: z.enum(["idea", "pre_revenue", "early", "growth", "mature"]),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const EventTrigger = z.object({
  kind: z.enum(["bernoulli", "scheduled", "conditional"]),
  probability: z.number().optional(),
  period: z.number().int().optional(),
  condition: z.string().optional(),
});

export const EventEffect = z.object({
  targetId: z.string(),
  operation: z.enum(["set", "add", "multiply"]),
  value: z.number(),
  persistent: z.boolean().default(false),
});

export const Event = z.object({
  id: z.string(),
  name: z.string(),
  trigger: EventTrigger,
  effects: z.array(EventEffect),
});

export const Goal = z.object({
  id: z.string(),
  metric: z.string(),
  direction: z.enum(["at_least", "at_most", "between"]),
  threshold: z.number(),
  upperThreshold: z.number().optional(),
  byPeriod: z.number().int(),
  allPeriods: z.boolean().default(false),
});
export type Goal = z.infer<typeof Goal>;

export const Scenario = z.object({
  id: z.string(),
  name: z.string(),
  horizonPeriods: z.number().int().default(36),
  timeStep: z.enum(["month", "quarter"]).default("month"),
  currency: z.string().default("AUD"),
  products: z.array(Product),
  channels: z.array(Channel),
  stores: z.array(Store).default([]),
  segments: z.array(Segment).default([]),
  salesRoles: z.array(SalesRole).default([]),
  adChannels: z.array(AdChannel).default([]),
  otherHeadcount: z.array(HeadcountRole).default([]),
  events: z.array(Event).default([]),
  constraints: z.array(Constraint).default([]),
  goals: z.array(Goal),
  startingCash: z.number(),
  paymentTerms: PaymentTerms.default(() => ({
    dso: 0,
    dpo: 0,
    dio: 0,
    billingFrequency: "monthly" as const,
  })),
  scalingCosts: z.array(ScalingCostTrigger).default([]),
  fixedAssets: z.array(FixedAsset).default([]),
  debtFacilities: z.array(DebtFacility).default([]),
  businessProfile: BusinessProfile.optional(),
  taxRate: z.number().default(0),
});
export type Scenario = z.infer<typeof Scenario>;

export const MonteCarloResult = z.object({
  scenarioId: z.string(),
  nRuns: z.number().int(),
  percentiles: z.record(z.string(), z.record(z.string(), z.array(z.number()))),
  winProbability: z.number(),
  perGoalSuccess: z.record(z.string(), z.number()),
  bindingConstraints: z.record(z.string(), z.number()),
  financialStatements: z.object({
    incomeStatement: z.record(
      z.string(),
      z.record(z.string(), z.array(z.number()))
    ),
    balanceSheet: z.record(
      z.string(),
      z.record(z.string(), z.array(z.number()))
    ),
    cashFlowStatement: z.record(
      z.string(),
      z.record(z.string(), z.array(z.number()))
    ),
  }),
  unitEconomics: z.record(
    z.string(),
    z.record(z.string(), z.array(z.number()))
  ),
});
export type MonteCarloResult = z.infer<typeof MonteCarloResult>;
