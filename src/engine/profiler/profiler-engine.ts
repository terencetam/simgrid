/**
 * Profiler engine: answers → complete Scenario generation.
 * Each archetype has a dedicated generator that builds appropriate primitives.
 */
import type { Scenario } from "../schema";
import { mkVar } from "../templates/helpers";

type Answers = Record<string, string | number | boolean>;

function num(answers: Answers, key: string, fallback: number): number {
  const v = answers[key];
  return typeof v === "number" ? v : fallback;
}

function str(answers: Answers, key: string, fallback: string): string {
  const v = answers[key];
  return typeof v === "string" ? v : fallback;
}

function bool(answers: Answers, key: string, fallback: boolean): boolean {
  const v = answers[key];
  return typeof v === "boolean" ? v : fallback;
}

// ─── SaaS ──────────────────────────────────────────────────────────

function generateSaas(answers: Answers): Scenario {
  const price = num(answers, "monthly_price", 99);
  const customers = num(answers, "current_customers", 50);
  const churn = num(answers, "monthly_churn", 0.05);
  const method = str(answers, "acquisition_method", "mix");
  const cac = num(answers, "cac", 400);
  const employees = num(answers, "total_employees", 10);

  const engCount = Math.max(1, Math.floor(employees * 0.5));
  const opsCount = Math.max(1, Math.ceil(employees * 0.2));
  const hasSales = method === "sales" || method === "mix";
  const hasAds = method === "ads" || method === "mix";
  const salesCount = hasSales ? Math.max(1, Math.floor(employees * 0.3)) : 0;

  return {
    id: "profiler-saas",
    name: "SaaS Startup",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-1", name: "SaaS Platform",
      price: mkVar("price", "Monthly subscription price", price),
      unitCogs: mkVar("cogs", "Infrastructure cost per user", Math.round(price * 0.08)),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-online", name: "Online (self-serve)", channelType: "online",
      capacityPerPeriod: mkVar("ch-cap", "Monthly site visitors", 5000),
      conversionRate: mkVar("ch-conv", "Trial-to-paid conversion", 0.03),
      fixedCost: mkVar("ch-fixed", "Platform costs", 500),
      variableCostPct: mkVar("ch-var", "Payment processing %", 0.029),
      rampCurve: [0.5, 0.75, 1],
    }],
    stores: [],
    segments: [{
      id: "seg-1", name: "Customers",
      tam: mkVar("tam", "Total addressable market", 50000),
      ourShare: mkVar("share", "Current customers", customers),
      churnRate: mkVar("churn", "Monthly churn rate", churn, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: churn, stddev: churn * 0.2 },
      }),
      acv: mkVar("acv", "Annual contract value", price * 12),
    }],
    salesRoles: salesCount > 0 ? [{
      id: "sr-ae", name: "Account Executive", count: salesCount,
      fullyLoadedCost: mkVar("ae-cost", "AE fully loaded cost", 12000),
      rampCurve: [0.25, 0.5, 0.75, 1],
      quota: mkVar("ae-quota", "Deals per month at full ramp", 5),
      quotaHitProbability: mkVar("ae-hit", "Quota hit probability", 0.7, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.7, stddev: 0.1 },
      }),
      attritionProbPerPeriod: mkVar("ae-attr", "Monthly attrition prob", 0.02),
    }] : [],
    adChannels: hasAds ? [{
      id: "ad-1", name: "Paid Ads",
      spend: mkVar("ad-spend", "Monthly ad spend", 15000),
      cac: mkVar("ad-cac", "Cost per acquisition", cac, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: cac, stddev: cac * 0.12 },
      }),
    }] : [],
    otherHeadcount: [
      { id: "hc-eng", name: "Engineering", count: engCount, salary: mkVar("eng-salary", "Engineer monthly salary", 10000), onCostsMultiplier: 1.3, rampMonths: 2, attritionProbPerPeriod: 0.02, recruitmentCostPerHire: 8000 },
      { id: "hc-ops", name: "Operations & Support", count: opsCount, salary: mkVar("ops-salary", "Ops monthly salary", 6000), onCostsMultiplier: 1.3, rampMonths: 1, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 3000 },
    ],
    events: [
      { id: "evt-churn", name: "Big customer churns", trigger: { kind: "bernoulli", probability: 0.05 }, effects: [{ targetId: "revenue", operation: "add", value: -5000, persistent: false }] },
      { id: "evt-competitor", name: "Competitor launches", trigger: { kind: "bernoulli", probability: 0.03 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.92, persistent: false }] },
    ],
    constraints: [],
    goals: [
      { id: "goal-arr", metric: "revenue", direction: "at_least", threshold: Math.max(price * customers * 3, 100000) / 12, byPeriod: 24, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    startingCash: 500_000,
    paymentTerms: { dso: 30, dpo: 0, dio: 0, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "saas", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Restaurant ────────────────────────────────────────────────────

function generateRestaurant(answers: Answers): Scenario {
  const locations = num(answers, "location_count", 1);
  const coverPrice = num(answers, "cover_price", 35);
  const seats = num(answers, "seats_per_location", 60);
  const turns = num(answers, "turns_per_service", 2);
  const hours = str(answers, "operating_hours", "dinner_only");
  const foodCostPct = num(answers, "food_cost_pct", 0.30);
  const liquor = bool(answers, "liquor_licence", true);

  const services = hours === "all_day" ? 3 : hours === "lunch_dinner" ? 2 : 1;
  const dailyCovers = seats * turns * services;
  const monthlyRevCap = dailyCovers * coverPrice * 30;
  const kitchenStaff = Math.max(2, Math.ceil(seats / 20));
  const serviceStaff = Math.max(2, Math.ceil(seats / 15));
  const avgCoverWithDrinks = liquor ? coverPrice * 1.3 : coverPrice;
  const monthlyRent = seats * 50; // ~$50/seat/month

  return {
    id: "profiler-restaurant",
    name: "Restaurant",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-menu", name: "Menu",
      price: mkVar("cover-price", "Average cover price", avgCoverWithDrinks),
      unitCogs: mkVar("food-cost", "Food cost per cover", avgCoverWithDrinks * foodCostPct),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-walkin", name: "Walk-in & reservations", channelType: "direct",
      capacityPerPeriod: mkVar("ch-cap", "Monthly covers capacity", dailyCovers * 30),
      conversionRate: mkVar("ch-conv", "Occupancy rate", 0.7, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.7, stddev: 0.1 },
      }),
      fixedCost: mkVar("ch-fixed", "Booking system", 200),
      variableCostPct: mkVar("ch-var", "Card processing %", 0.015),
      rampCurve: [0.4, 0.6, 0.8, 1],
    }],
    stores: [{
      id: "store-1", name: "Location", count: locations,
      fixedCostPerUnit: mkVar("rent", "Monthly rent & utilities", monthlyRent),
      revenueCapPerUnit: mkVar("rev-cap", "Revenue cap per location", monthlyRevCap),
      rampCurve: [0.3, 0.5, 0.7, 0.85, 1],
      openingSchedule: [],
    }],
    segments: [],
    salesRoles: [],
    adChannels: [],
    otherHeadcount: [
      { id: "hc-kitchen", name: "Kitchen staff", count: kitchenStaff * locations, salary: mkVar("kitchen-salary", "Kitchen staff salary", 4500), onCostsMultiplier: 1.2, rampMonths: 1, attritionProbPerPeriod: 0.05, recruitmentCostPerHire: 1000 },
      { id: "hc-service", name: "Service staff", count: serviceStaff * locations, salary: mkVar("service-salary", "Service staff salary", 3500), onCostsMultiplier: 1.2, rampMonths: 0, attritionProbPerPeriod: 0.08, recruitmentCostPerHire: 500 },
      { id: "hc-mgmt", name: "Management", count: locations, salary: mkVar("mgr-salary", "Manager salary", 7000), onCostsMultiplier: 1.3, rampMonths: 1, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 3000 },
    ],
    events: [
      { id: "evt-health", name: "Health inspection issue", trigger: { kind: "bernoulli", probability: 0.02 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.5, persistent: false }] },
      { id: "evt-staff", name: "Staff shortage", trigger: { kind: "bernoulli", probability: 0.04 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.85, persistent: false }] },
    ],
    constraints: [],
    goals: [
      { id: "goal-breakeven", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 18, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    startingCash: 200_000 * locations,
    paymentTerms: { dso: 0, dpo: 15, dio: 5, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "restaurant", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Retail ────────────────────────────────────────────────────────

function generateRetail(answers: Answers): Scenario {
  const stores = num(answers, "store_count", 1);
  const price = num(answers, "avg_product_price", 50);
  const footTraffic = num(answers, "monthly_foot_traffic", 10000);
  const convRate = num(answers, "conversion_rate", 0.03);
  const cogsPct = num(answers, "cogs_pct", 0.55);
  const hasOnline = bool(answers, "has_online", true);

  const monthlyRevPerStore = footTraffic * convRate * price;

  const channels: Scenario["channels"] = [{
    id: "ch-foot", name: "In-store foot traffic", channelType: "retail",
    capacityPerPeriod: mkVar("ch-cap", "Monthly foot traffic", footTraffic * stores),
    conversionRate: mkVar("ch-conv", "Foot traffic conversion", convRate),
    fixedCost: mkVar("ch-fixed", "Store operating costs", 0),
    variableCostPct: mkVar("ch-var", "Card processing %", 0.02),
    rampCurve: [0.5, 0.75, 1],
  }];

  if (hasOnline) {
    channels.push({
      id: "ch-online", name: "Online store", channelType: "online",
      capacityPerPeriod: mkVar("ch-cap-online", "Monthly site visitors", footTraffic * 0.5),
      conversionRate: mkVar("ch-conv-online", "Online conversion", 0.02),
      fixedCost: mkVar("ch-fixed-online", "E-commerce platform", 500),
      variableCostPct: mkVar("ch-var-online", "Processing + shipping %", 0.08),
      rampCurve: [0.3, 0.6, 1],
    });
  }

  return {
    id: "profiler-retail",
    name: "Retail Chain",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-1", name: "Average SKU",
      price: mkVar("price", "Average product price", price),
      unitCogs: mkVar("cogs", "Cost of goods", price * cogsPct),
      launchPeriod: 0,
    }],
    channels,
    stores: [{
      id: "store-1", name: "Store", count: stores,
      fixedCostPerUnit: mkVar("rent", "Monthly store costs", 8000),
      revenueCapPerUnit: mkVar("rev-cap", "Revenue cap per store", monthlyRevPerStore * 1.5),
      rampCurve: [0.4, 0.7, 0.9, 1],
      openingSchedule: [],
    }],
    segments: [{
      id: "seg-1", name: "Retail Customers",
      tam: mkVar("tam", "Addressable market (monthly shoppers)", footTraffic * stores * 2),
      ourShare: mkVar("share", "Current monthly customers", footTraffic * convRate * stores),
      churnRate: mkVar("churn", "Customer lapse rate", 0.15),
      acv: mkVar("acv", "Annual customer value", price * 6),
    }],
    salesRoles: [],
    adChannels: [],
    otherHeadcount: [
      { id: "hc-store", name: "Store staff", count: Math.max(2, Math.ceil(stores * 4)), salary: mkVar("store-salary", "Store staff salary", 3800), onCostsMultiplier: 1.2, rampMonths: 0, attritionProbPerPeriod: 0.06, recruitmentCostPerHire: 800 },
      { id: "hc-mgmt", name: "Management", count: stores, salary: mkVar("mgr-salary", "Store manager salary", 6500), onCostsMultiplier: 1.3, rampMonths: 1, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 3000 },
    ],
    events: [
      { id: "evt-seasonal", name: "Seasonal surge", trigger: { kind: "bernoulli", probability: 0.08 }, effects: [{ targetId: "revenue", operation: "multiply", value: 1.3, persistent: false }] },
      { id: "evt-shrinkage", name: "Inventory shrinkage", trigger: { kind: "bernoulli", probability: 0.05 }, effects: [{ targetId: "revenue", operation: "add", value: -2000, persistent: false }] },
    ],
    constraints: [],
    goals: [
      { id: "goal-profit", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 18, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    startingCash: 150_000 * stores,
    paymentTerms: { dso: 0, dpo: 30, dio: 30, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "retail", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── E-commerce ────────────────────────────────────────────────────

function generateEcommerce(answers: Answers): Scenario {
  const aov = num(answers, "aov", 65);
  const visitors = num(answers, "monthly_visitors", 50000);
  const convRate = num(answers, "conversion_rate", 0.025);
  const returnRate = num(answers, "return_rate", 0.15);
  const cogsPct = num(answers, "cogs_pct", 0.40);
  const adSpend = num(answers, "monthly_ad_spend", 10000);

  const monthlyOrders = visitors * convRate;
  const effectiveOrders = monthlyOrders * (1 - returnRate);
  const cac = adSpend > 0 ? adSpend / monthlyOrders : 50;

  return {
    id: "profiler-ecommerce",
    name: "E-commerce / DTC",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-1", name: "Product",
      price: mkVar("price", "Average order value", aov),
      unitCogs: mkVar("cogs", "Cost of goods + shipping", aov * cogsPct),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-online", name: "Online store", channelType: "online",
      capacityPerPeriod: mkVar("ch-cap", "Monthly site visitors", visitors),
      conversionRate: mkVar("ch-conv", "Site visitor conversion", convRate, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: convRate, stddev: convRate * 0.15 },
      }),
      fixedCost: mkVar("ch-fixed", "Platform & hosting", 800),
      variableCostPct: mkVar("ch-var", "Processing + shipping %", 0.08),
      rampCurve: [0.6, 0.8, 1],
    }],
    stores: [],
    segments: [{
      id: "seg-1", name: "Online Customers",
      tam: mkVar("tam", "Addressable market", visitors * 5),
      ourShare: mkVar("share", "Current monthly customers", effectiveOrders),
      churnRate: mkVar("churn", "Customer lapse rate", 0.12),
      acv: mkVar("acv", "Annual customer value", aov * 4),
    }],
    salesRoles: [],
    adChannels: adSpend > 0 ? [{
      id: "ad-1", name: "Paid Ads",
      spend: mkVar("ad-spend", "Monthly ad spend", adSpend),
      cac: mkVar("ad-cac", "Cost per acquisition", cac, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: cac, stddev: cac * 0.15 },
      }),
    }] : [],
    otherHeadcount: [
      { id: "hc-ops", name: "Operations", count: 3, salary: mkVar("ops-salary", "Ops salary", 5000), onCostsMultiplier: 1.2, rampMonths: 1, attritionProbPerPeriod: 0.04, recruitmentCostPerHire: 2000 },
      { id: "hc-marketing", name: "Marketing", count: 2, salary: mkVar("mktg-salary", "Marketing salary", 7000), onCostsMultiplier: 1.3, rampMonths: 1, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 4000 },
    ],
    events: [
      { id: "evt-seasonal", name: "Seasonal peak", trigger: { kind: "bernoulli", probability: 0.08 }, effects: [{ targetId: "revenue", operation: "multiply", value: 1.5, persistent: false }] },
      { id: "evt-supply", name: "Supply chain disruption", trigger: { kind: "bernoulli", probability: 0.03 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.7, persistent: false }] },
    ],
    constraints: [],
    goals: [
      { id: "goal-margin", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 12, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    startingCash: 200_000,
    paymentTerms: { dso: 5, dpo: 30, dio: 15, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "ecommerce", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Wholesale ─────────────────────────────────────────────────────

function generateWholesale(answers: Answers): Scenario {
  const orderSize = num(answers, "avg_order_size", 5000);
  const marginPct = num(answers, "gross_margin_pct", 0.15);
  const dso = num(answers, "payment_terms_days", 45);
  const monthlyOrders = num(answers, "monthly_orders", 500);
  const warehouseCap = num(answers, "warehouse_capacity", 2000);
  const employees = num(answers, "total_employees", 15);

  return {
    id: "profiler-wholesale",
    name: "Wholesale Trading",
    horizonPeriods: 36,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-1", name: "Traded Goods",
      price: mkVar("price", "Average order size", orderSize),
      unitCogs: mkVar("cogs", "Cost of goods (landed)", orderSize * (1 - marginPct)),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-sales", name: "Sales team", channelType: "direct",
      capacityPerPeriod: mkVar("ch-cap", "Monthly order capacity", warehouseCap),
      conversionRate: mkVar("ch-conv", "Win rate", 0.6, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.6, stddev: 0.08 },
      }),
      fixedCost: mkVar("ch-fixed", "Warehouse costs", 15000),
      variableCostPct: mkVar("ch-var", "Logistics %", 0.03),
      rampCurve: [0.7, 0.9, 1],
    }],
    stores: [],
    segments: [{
      id: "seg-1", name: "Trade Customers",
      tam: mkVar("tam", "Addressable customers", 2000),
      ourShare: mkVar("share", "Active customers", Math.round(monthlyOrders / 3)),
      churnRate: mkVar("churn", "Customer attrition rate", 0.03),
      acv: mkVar("acv", "Annual customer value", orderSize * 12),
    }],
    salesRoles: [{
      id: "sr-sales", name: "Sales Rep", count: Math.max(2, Math.floor(employees * 0.3)),
      fullyLoadedCost: mkVar("sr-cost", "Sales rep cost", 8000),
      rampCurve: [0.5, 0.75, 1],
      quota: mkVar("sr-quota", "Orders per month", 30),
      quotaHitProbability: mkVar("sr-hit", "Quota hit probability", 0.65, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.65, stddev: 0.1 },
      }),
      attritionProbPerPeriod: mkVar("sr-attr", "Monthly attrition", 0.03),
    }],
    adChannels: [],
    otherHeadcount: [
      { id: "hc-warehouse", name: "Warehouse staff", count: Math.max(3, Math.floor(employees * 0.4)), salary: mkVar("wh-salary", "Warehouse salary", 4500), onCostsMultiplier: 1.2, rampMonths: 0, attritionProbPerPeriod: 0.05, recruitmentCostPerHire: 800 },
      { id: "hc-admin", name: "Admin & Finance", count: Math.max(2, Math.ceil(employees * 0.15)), salary: mkVar("admin-salary", "Admin salary", 5500), onCostsMultiplier: 1.3, rampMonths: 1, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 2000 },
    ],
    events: [
      { id: "evt-price-drop", name: "Market price drop", trigger: { kind: "bernoulli", probability: 0.04 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.85, persistent: false }] },
      { id: "evt-big-order", name: "Large contract win", trigger: { kind: "bernoulli", probability: 0.05 }, effects: [{ targetId: "revenue", operation: "add", value: orderSize * 5, persistent: false }] },
    ],
    constraints: [{
      id: "c-warehouse", targetId: "revenue",
      capValue: warehouseCap * orderSize, capKind: "hard",
    }],
    goals: [
      { id: "goal-profit", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 12, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 36, allPeriods: true },
    ],
    startingCash: 500_000,
    paymentTerms: { dso, dpo: 30, dio: 60, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "wholesale", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Services ──────────────────────────────────────────────────────

function generateServices(answers: Answers): Scenario {
  const consultants = num(answers, "billable_consultants", 10);
  const dailyRate = num(answers, "daily_rate", 1500);
  const utilisation = num(answers, "target_utilisation", 0.75);
  const consultantSalary = num(answers, "consultant_salary", 8000);
  const salesHC = num(answers, "sales_headcount", 2);

  const monthlyRevPerConsultant = dailyRate * 22 * utilisation;
  const monthlyRevTarget = monthlyRevPerConsultant * consultants;

  return {
    id: "profiler-services",
    name: "Services Consultancy",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-1", name: "Consulting Services",
      price: mkVar("price", "Daily billing rate", dailyRate),
      unitCogs: mkVar("cogs", "Direct project costs", dailyRate * 0.05),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-pipeline", name: "Sales pipeline", channelType: "direct",
      capacityPerPeriod: mkVar("ch-cap", "Monthly billable days", consultants * 22),
      conversionRate: mkVar("ch-conv", "Utilisation rate", utilisation, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: utilisation, stddev: 0.08 },
      }),
      fixedCost: mkVar("ch-fixed", "Office costs", 3000),
      variableCostPct: mkVar("ch-var", "Project expenses %", 0.02),
      rampCurve: [0.6, 0.8, 1],
    }],
    stores: [],
    segments: [{
      id: "seg-1", name: "Clients",
      tam: mkVar("tam", "Addressable clients", 500),
      ourShare: mkVar("share", "Active clients", Math.max(5, Math.ceil(consultants * 1.5))),
      churnRate: mkVar("churn", "Client attrition rate", 0.04),
      acv: mkVar("acv", "Annual client value", monthlyRevPerConsultant * 3 * 12 / consultants),
    }],
    salesRoles: salesHC > 0 ? [{
      id: "sr-bd", name: "Business Development", count: salesHC,
      fullyLoadedCost: mkVar("bd-cost", "BD fully loaded cost", 10000),
      rampCurve: [0.3, 0.6, 1],
      quota: mkVar("bd-quota", "New projects per month", 3),
      quotaHitProbability: mkVar("bd-hit", "Quota hit probability", 0.6, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.6, stddev: 0.12 },
      }),
      attritionProbPerPeriod: mkVar("bd-attr", "Monthly attrition", 0.02),
    }] : [],
    adChannels: [],
    otherHeadcount: [
      { id: "hc-consultants", name: "Consultants", count: consultants, salary: mkVar("consult-salary", "Consultant salary", consultantSalary), onCostsMultiplier: 1.3, rampMonths: 1, attritionProbPerPeriod: 0.04, recruitmentCostPerHire: 5000 },
      { id: "hc-admin", name: "Admin & Operations", count: Math.max(1, Math.ceil(consultants / 8)), salary: mkVar("admin-salary", "Admin salary", 5000), onCostsMultiplier: 1.2, rampMonths: 0, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 2000 },
    ],
    events: [
      { id: "evt-key-quit", name: "Key consultant quits", trigger: { kind: "bernoulli", probability: 0.04 }, effects: [{ targetId: "revenue", operation: "add", value: -monthlyRevPerConsultant, persistent: false }] },
      { id: "evt-big-deal", name: "Large project win", trigger: { kind: "bernoulli", probability: 0.06 }, effects: [{ targetId: "revenue", operation: "add", value: monthlyRevPerConsultant * 2, persistent: false }] },
    ],
    constraints: [],
    goals: [
      { id: "goal-rev", metric: "revenue", direction: "at_least", threshold: monthlyRevTarget * 1.2, byPeriod: 24, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    startingCash: 300_000,
    paymentTerms: { dso: 30, dpo: 0, dio: 0, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "services", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Marketplace ───────────────────────────────────────────────────

function generateMarketplace(answers: Answers): Scenario {
  const sellers = num(answers, "active_sellers", 100);
  const buyers = num(answers, "active_buyers", 500);
  const avgTransaction = num(answers, "avg_transaction", 50);
  const takeRate = num(answers, "take_rate", 0.10);
  const adSpend = num(answers, "monthly_ad_spend", 5000);
  const employees = num(answers, "total_employees", 8);

  const monthlyTransactions = Math.min(sellers * 5, buyers * 0.8);
  const monthlyGMV = monthlyTransactions * avgTransaction;

  return {
    id: "profiler-marketplace",
    name: "Marketplace",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-platform", name: "Platform",
      price: mkVar("price", "Average transaction value", avgTransaction * takeRate),
      unitCogs: mkVar("cogs", "Platform cost per transaction", avgTransaction * takeRate * 0.15),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-organic", name: "Organic & referral", channelType: "online",
      capacityPerPeriod: mkVar("ch-cap", "Monthly potential transactions", monthlyTransactions * 2),
      conversionRate: mkVar("ch-conv", "Transaction conversion", 0.5, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.5, stddev: 0.08 },
      }),
      fixedCost: mkVar("ch-fixed", "Platform infrastructure", 3000),
      variableCostPct: mkVar("ch-var", "Payment processing %", 0.025),
      rampCurve: [0.4, 0.6, 0.8, 1],
    }],
    stores: [],
    segments: [
      {
        id: "seg-sellers", name: "Sellers",
        tam: mkVar("tam-sellers", "Addressable sellers", sellers * 20),
        ourShare: mkVar("share-sellers", "Active sellers", sellers),
        churnRate: mkVar("churn-sellers", "Seller churn rate", 0.06, {
          kind: "stochastic", distribution: "normal",
          distributionParams: { mean: 0.06, stddev: 0.02 },
        }),
        acv: mkVar("acv-sellers", "Annual seller value", monthlyGMV / sellers * takeRate * 12),
      },
      {
        id: "seg-buyers", name: "Buyers",
        tam: mkVar("tam-buyers", "Addressable buyers", buyers * 10),
        ourShare: mkVar("share-buyers", "Active buyers", buyers),
        churnRate: mkVar("churn-buyers", "Buyer churn rate", 0.08),
        acv: mkVar("acv-buyers", "Annual buyer value", monthlyGMV / buyers * takeRate * 12),
      },
    ],
    salesRoles: [],
    adChannels: adSpend > 0 ? [{
      id: "ad-1", name: "Growth Marketing",
      spend: mkVar("ad-spend", "Monthly marketing spend", adSpend),
      cac: mkVar("ad-cac", "Cost per new user", adSpend / (sellers + buyers) * 10, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: adSpend / (sellers + buyers) * 10, stddev: 5 },
      }),
    }] : [],
    otherHeadcount: [
      { id: "hc-eng", name: "Engineering", count: Math.max(2, Math.floor(employees * 0.5)), salary: mkVar("eng-salary", "Engineer salary", 10000), onCostsMultiplier: 1.3, rampMonths: 2, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 8000 },
      { id: "hc-ops", name: "Operations & Support", count: Math.max(1, Math.ceil(employees * 0.3)), salary: mkVar("ops-salary", "Ops salary", 5500), onCostsMultiplier: 1.2, rampMonths: 1, attritionProbPerPeriod: 0.04, recruitmentCostPerHire: 2000 },
    ],
    events: [
      { id: "evt-outage", name: "Platform outage", trigger: { kind: "bernoulli", probability: 0.02 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.6, persistent: false }] },
      { id: "evt-viral", name: "Viral growth spike", trigger: { kind: "bernoulli", probability: 0.04 }, effects: [{ targetId: "revenue", operation: "multiply", value: 1.4, persistent: false }] },
    ],
    constraints: [],
    goals: [
      { id: "goal-gmv", metric: "revenue", direction: "at_least", threshold: monthlyGMV * takeRate * 3, byPeriod: 24, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    startingCash: 400_000,
    paymentTerms: { dso: 5, dpo: 3, dio: 0, billingFrequency: "monthly" },
    scalingCosts: [], fixedAssets: [], debtFacilities: [],
    businessProfile: { archetype: "marketplace", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Manufacturing ─────────────────────────────────────────────────

function generateManufacturing(answers: Answers): Scenario {
  const unitPrice = num(answers, "unit_price", 25);
  const unitCost = num(answers, "unit_cost", 12);
  const capacity = num(answers, "monthly_capacity", 10000);
  const utilisation = num(answers, "current_utilisation", 0.60);
  const facilities = num(answers, "facility_count", 1);
  const equipmentCost = num(answers, "equipment_cost", 500000);
  const employees = num(answers, "total_employees", 25);

  const currentUnits = Math.round(capacity * utilisation);

  return {
    id: "profiler-manufacturing",
    name: "Manufacturing",
    horizonPeriods: 36,
    timeStep: "month",
    currency: "AUD",
    products: [{
      id: "prod-1", name: "Manufactured Product",
      price: mkVar("price", "Unit selling price", unitPrice),
      unitCogs: mkVar("cogs", "Unit production cost", unitCost),
      launchPeriod: 0,
    }],
    channels: [{
      id: "ch-sales", name: "B2B Sales", channelType: "direct",
      capacityPerPeriod: mkVar("ch-cap", "Monthly production capacity", capacity * facilities),
      conversionRate: mkVar("ch-conv", "Capacity utilisation", utilisation, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: utilisation, stddev: 0.08 },
      }),
      fixedCost: mkVar("ch-fixed", "Sales office costs", 5000),
      variableCostPct: mkVar("ch-var", "Freight & handling %", 0.04),
      rampCurve: [0.7, 0.85, 1],
    }],
    stores: [{
      id: "facility-1", name: "Production Facility", count: facilities,
      fixedCostPerUnit: mkVar("facility-cost", "Facility operating cost", 25000),
      revenueCapPerUnit: mkVar("facility-cap", "Facility revenue cap", capacity * unitPrice),
      rampCurve: [0.5, 0.75, 0.9, 1],
      openingSchedule: [],
    }],
    segments: [{
      id: "seg-1", name: "B2B Customers",
      tam: mkVar("tam", "Addressable market (units/mo)", capacity * 3),
      ourShare: mkVar("share", "Current customers", Math.ceil(currentUnits / 100)),
      churnRate: mkVar("churn", "Customer attrition rate", 0.03),
      acv: mkVar("acv", "Annual customer value", unitPrice * 100 * 12),
    }],
    salesRoles: [{
      id: "sr-sales", name: "Sales Rep", count: Math.max(1, Math.ceil(employees * 0.12)),
      fullyLoadedCost: mkVar("sr-cost", "Sales rep cost", 8000),
      rampCurve: [0.5, 0.75, 1],
      quota: mkVar("sr-quota", "Monthly units sold", Math.round(capacity / 3)),
      quotaHitProbability: mkVar("sr-hit", "Quota hit", 0.6, {
        kind: "stochastic", distribution: "normal",
        distributionParams: { mean: 0.6, stddev: 0.1 },
      }),
      attritionProbPerPeriod: mkVar("sr-attr", "Monthly attrition", 0.02),
    }],
    adChannels: [],
    otherHeadcount: [
      { id: "hc-production", name: "Production workers", count: Math.max(5, Math.floor(employees * 0.6)), salary: mkVar("prod-salary", "Production worker salary", 4500), onCostsMultiplier: 1.2, rampMonths: 1, attritionProbPerPeriod: 0.04, recruitmentCostPerHire: 1500 },
      { id: "hc-maintenance", name: "Maintenance & QA", count: Math.max(2, Math.ceil(employees * 0.15)), salary: mkVar("maint-salary", "Maintenance salary", 5500), onCostsMultiplier: 1.2, rampMonths: 1, attritionProbPerPeriod: 0.03, recruitmentCostPerHire: 2000 },
      { id: "hc-admin", name: "Admin & Management", count: Math.max(2, Math.ceil(employees * 0.12)), salary: mkVar("admin-salary", "Admin salary", 6500), onCostsMultiplier: 1.3, rampMonths: 0, attritionProbPerPeriod: 0.02, recruitmentCostPerHire: 3000 },
    ],
    events: [
      { id: "evt-breakdown", name: "Equipment breakdown", trigger: { kind: "bernoulli", probability: 0.03 }, effects: [{ targetId: "revenue", operation: "multiply", value: 0.7, persistent: false }] },
      { id: "evt-quality", name: "Quality issue / recall", trigger: { kind: "bernoulli", probability: 0.02 }, effects: [{ targetId: "revenue", operation: "add", value: -(currentUnits * unitPrice * 0.2), persistent: false }] },
    ],
    constraints: [{
      id: "c-capacity", targetId: "revenue",
      capValue: capacity * facilities * unitPrice, capKind: "hard",
    }],
    goals: [
      { id: "goal-cost", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 12, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 36, allPeriods: true },
    ],
    startingCash: 300_000 + equipmentCost * 0.3,
    paymentTerms: { dso: 30, dpo: 30, dio: 45, billingFrequency: "monthly" },
    scalingCosts: [],
    fixedAssets: [{
      id: "fa-equipment", name: "Production Equipment",
      purchaseCost: mkVar("equip-cost", "Equipment cost", equipmentCost),
      usefulLifeMonths: 120,
      depreciationMethod: "straight_line",
      purchaseSchedule: [[0, 1]],
    }],
    debtFacilities: [],
    businessProfile: { archetype: "manufacturing", stage: "early", answers },
    taxRate: 0,
    customVariables: [],
    causalLinks: [],
    nodePositions: {},
  };
}

// ─── Main entry point ──────────────────────────────────────────────

export function generateScenario(profile: {
  archetype: string;
  stage: string;
  answers: Record<string, string | number | boolean>;
}): Scenario {
  const answers = profile.answers;

  switch (profile.archetype) {
    case "saas": return generateSaas(answers);
    case "restaurant": return generateRestaurant(answers);
    case "retail": return generateRetail(answers);
    case "ecommerce": return generateEcommerce(answers);
    case "wholesale": return generateWholesale(answers);
    case "services": return generateServices(answers);
    case "marketplace": return generateMarketplace(answers);
    case "manufacturing": return generateManufacturing(answers);
    default: return generateSaas(answers);
  }
}
