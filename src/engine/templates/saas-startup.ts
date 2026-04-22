import type { Scenario } from "../schema";
import { mkVar } from "./helpers";

export const saasStartup: Scenario = {
  id: "saas-startup",
  name: "SaaS Startup",
  horizonPeriods: 24,
  timeStep: "month",
  currency: "AUD",

  products: [
    {
      id: "prod-1",
      name: "SaaS Platform",
      price: mkVar("price", "Monthly subscription price", 99),
      unitCogs: mkVar("cogs", "Infrastructure cost per user", 8),
      launchPeriod: 0,
    },
  ],

  channels: [
    {
      id: "ch-online",
      name: "Online (self-serve)",
      channelType: "online",
      capacityPerPeriod: mkVar("ch-cap", "Monthly site visitors", 5000),
      conversionRate: mkVar("ch-conv", "Trial-to-paid conversion", 0.03),
      fixedCost: mkVar("ch-fixed", "Platform costs", 500),
      variableCostPct: mkVar("ch-var", "Payment processing %", 0.029),
      rampCurve: [0.5, 0.75, 1],
    },
  ],

  stores: [],

  segments: [
    {
      id: "seg-smb",
      name: "SMB Customers",
      tam: mkVar("tam", "Total addressable market", 50000),
      ourShare: mkVar("share", "Current customers", 50),
      churnRate: mkVar("churn", "Monthly churn rate", 0.05, {
        kind: "stochastic",
        distribution: "normal",
        distributionParams: { mean: 0.05, stddev: 0.01 },
      }),
      acv: mkVar("acv", "Annual contract value", 1188), // $99 × 12
    },
  ],

  salesRoles: [
    {
      id: "sr-ae",
      name: "Account Executive",
      count: 3,
      fullyLoadedCost: mkVar("ae-cost", "AE fully loaded cost", 12000),
      rampCurve: [0.25, 0.5, 0.75, 1],
      quota: mkVar("ae-quota", "Deals per month at full ramp", 5),
      quotaHitProbability: mkVar("ae-hit", "Quota hit probability", 0.7, {
        kind: "stochastic",
        distribution: "normal",
        distributionParams: { mean: 0.7, stddev: 0.1 },
      }),
      attritionProbPerPeriod: mkVar("ae-attr", "Monthly attrition prob", 0.02),
    },
  ],

  adChannels: [
    {
      id: "ad-google",
      name: "Google Ads",
      spend: mkVar("ad-spend", "Monthly ad spend", 15000),
      cac: mkVar("ad-cac", "Cost per acquisition", 400, {
        kind: "stochastic",
        distribution: "normal",
        distributionParams: { mean: 400, stddev: 50 },
      }),
    },
  ],

  otherHeadcount: [
    {
      id: "hc-eng",
      name: "Engineering",
      count: 5,
      salary: mkVar("eng-salary", "Engineer monthly salary", 10000),
      onCostsMultiplier: 1.3,
      rampMonths: 2,
      attritionProbPerPeriod: 0.02,
      recruitmentCostPerHire: 8000,
    },
    {
      id: "hc-ops",
      name: "Operations & Support",
      count: 2,
      salary: mkVar("ops-salary", "Ops monthly salary", 6000),
      onCostsMultiplier: 1.3,
      rampMonths: 1,
      attritionProbPerPeriod: 0.03,
      recruitmentCostPerHire: 3000,
    },
  ],

  events: [
    {
      id: "evt-big-churn",
      name: "Big customer churns",
      trigger: { kind: "bernoulli", probability: 0.05 },
      effects: [
        {
          targetId: "revenue",
          operation: "add",
          value: -5000,
          persistent: false,
        },
      ],
    },
    {
      id: "evt-competitor",
      name: "Competitor launches",
      trigger: { kind: "bernoulli", probability: 0.03 },
      effects: [
        {
          targetId: "revenue",
          operation: "multiply",
          value: 0.92,
          persistent: false,
        },
      ],
    },
  ],

  constraints: [],

  goals: [
    {
      id: "goal-arr",
      metric: "revenue",
      direction: "at_least",
      threshold: 5_000_000 / 12, // ~$416K monthly = $5M ARR
      byPeriod: 24,
      allPeriods: false,
    },
    {
      id: "goal-cash",
      metric: "cash",
      direction: "at_least",
      threshold: 0,
      byPeriod: 24,
      allPeriods: true,
    },
  ],

  startingCash: 500_000,

  paymentTerms: { dso: 30, dpo: 0, dio: 0, billingFrequency: "monthly" },
  scalingCosts: [],
  fixedAssets: [],
  debtFacilities: [],
  businessProfile: {
    archetype: "saas",
    stage: "early",
    answers: {},
  },
  taxRate: 0,
};
