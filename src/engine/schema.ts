import { z } from "zod";

// ─── Distribution (for stochastic inputs) ────────────────────────

export const DistributionKind = z.enum([
  "normal",
  "lognormal",
  "uniform",
  "triangular",
  "bernoulli",
]);
export type DistributionKind = z.infer<typeof DistributionKind>;

export const Distribution = z.object({
  kind: DistributionKind,
  params: z.record(z.string(), z.number()),
});
export type Distribution = z.infer<typeof Distribution>;

// ─── Variable groups and value types ────────────────────────────

export const VariableGroup = z.enum([
  "revenue",
  "growth",
  "costs",
  "risk",
]);
export type VariableGroup = z.infer<typeof VariableGroup>;

export const ValueType = z.enum([
  "currency",
  "percent",
  "count",
  "ratio",
]);
export type ValueType = z.infer<typeof ValueType>;

// ─── The single ModelVariable type ──────────────────────────────

export const ModelVariable = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["input", "formula"]),

  // Input fields
  baseValue: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  distribution: Distribution.optional(),

  // Formula fields
  formula: z.string().optional(),
  initialValue: z.number().optional(),

  // Display
  group: VariableGroup.optional(),
  valueType: ValueType.optional(),

  // Chart integration
  chartMetric: z
    .enum(["revenue", "cash", "customers", "profit"])
    .optional(),

  // Lever visibility
  isLever: z.boolean().default(true),
});
export type ModelVariable = z.infer<typeof ModelVariable>;

// ─── Business profile ───────────────────────────────────────────

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
  answers: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()])
  ),
});
export type BusinessProfile = z.infer<typeof BusinessProfile>;

// ─── Goal ────────────────────────────────────────────────────────

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

// ─── Scenario ────────────────────────────────────────────────────

export const Scenario = z.object({
  id: z.string(),
  name: z.string(),
  horizonPeriods: z.number().int().default(24),
  timeStep: z.enum(["month", "quarter"]).default("month"),
  currency: z.string().default("AUD"),

  variables: z.array(ModelVariable),
  goals: z.array(Goal),
  startingCash: z.number(),

  businessProfile: BusinessProfile.optional(),
});
export type Scenario = z.infer<typeof Scenario>;

// ─── Monte Carlo Result ──────────────────────────────────────────

export const MonteCarloResult = z.object({
  scenarioId: z.string(),
  nRuns: z.number().int(),
  percentiles: z.record(
    z.string(),
    z.record(z.string(), z.array(z.number()))
  ),
  winProbability: z.number(),
  perGoalSuccess: z.record(z.string(), z.number()),
});
export type MonteCarloResult = z.infer<typeof MonteCarloResult>;
