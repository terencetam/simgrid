/**
 * Profiler engine: answers → formula-based Scenario.
 * Each archetype generates a flat list of ModelVariables (inputs + formulas).
 */
import type { Scenario, ModelVariable } from "../schema";

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

// Helper to create input variables
function input(
  id: string,
  name: string,
  baseValue: number,
  opts: Partial<ModelVariable> = {}
): ModelVariable {
  return {
    id,
    name,
    kind: "input",
    baseValue,
    isLever: true,
    ...opts,
  };
}

// Helper to create formula variables
function formula(
  id: string,
  name: string,
  expr: string,
  opts: Partial<ModelVariable> = {}
): ModelVariable {
  return {
    id,
    name,
    kind: "formula",
    formula: expr,
    isLever: false,
    ...opts,
  };
}

// ─── SaaS ──────────────────────────────────────────────────────────

function generateSaas(answers: Answers): Scenario {
  const price = num(answers, "monthly_price", 99);
  const customers = num(answers, "current_customers", 50);
  const churn = num(answers, "monthly_churn", 0.05);
  const method = str(answers, "acquisition_method", "mix");
  const cac = num(answers, "cac", 400);
  const employees = num(answers, "total_employees", 10);

  const hasAds = method === "ads" || method === "mix";
  const hasSales = method === "sales" || method === "mix";
  const newCustBase = hasAds ? Math.round(15000 / cac) : 0;
  const salesCusts = hasSales ? Math.round(employees * 0.3 * 3) : 0;
  const totalNewCusts = newCustBase + salesCusts + (method === "organic" ? 20 : 5);

  const variables: ModelVariable[] = [
    // Inputs
    input("price", "Monthly price", price, { group: "revenue", valueType: "currency", min: 10, max: price * 5, step: 1 }),
    input("churn", "Monthly churn rate", churn, {
      group: "risk", valueType: "percent", min: 0.005, max: 0.2, step: 0.005,
      distribution: { kind: "normal", params: { mean: churn, stddev: churn * 0.2 } },
    }),
    input("new_customers", "New customers/month", totalNewCusts, {
      group: "growth", valueType: "count", min: 0, max: totalNewCusts * 5, step: 1,
      distribution: { kind: "normal", params: { mean: totalNewCusts, stddev: Math.max(3, totalNewCusts * 0.25) } },
    }),
    input("cac", "Customer acquisition cost", cac, {
      group: "growth", valueType: "currency", min: 50, max: cac * 5, step: 10,
      distribution: { kind: "normal", params: { mean: cac, stddev: cac * 0.12 } },
    }),
    input("team_size", "Team size", employees, { group: "costs", valueType: "count", min: 1, max: 100, step: 1 }),
    input("avg_salary", "Avg monthly salary", 8000, { group: "costs", valueType: "currency", min: 3000, max: 20000, step: 500 }),
    input("infra_per_user", "Infra cost per user", Math.round(price * 0.08), { group: "costs", valueType: "currency", min: 0, max: price, step: 1 }),
    // Risk events
    input("big_churn_event", "Big customer churns", 0, {
      group: "risk", valueType: "count", isLever: false,
      distribution: { kind: "bernoulli", params: { p: 0.05 } },
    }),
    input("competitor_event", "Competitor launches", 0, {
      group: "risk", valueType: "count", isLever: false,
      distribution: { kind: "bernoulli", params: { p: 0.03 } },
    }),
    // Formulas
    formula("churned", "Churned customers", "prev.customers * churn", { group: "growth", valueType: "count" }),
    formula("customers", "Total customers", "max(0, prev.customers + new_customers - churned)", {
      group: "growth", valueType: "count", chartMetric: "customers", initialValue: customers,
    }),
    formula("mrr", "Monthly recurring revenue", "customers * price", { group: "revenue", valueType: "currency" }),
    formula("event_impact", "Event impact", "1 - big_churn_event * 0.1 - competitor_event * 0.08", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "mrr * event_impact", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("cogs", "COGS", "customers * infra_per_user", { group: "costs", valueType: "currency" }),
    formula("acq_cost", "Acquisition cost", "new_customers * cac", { group: "costs", valueType: "currency" }),
    formula("payroll", "Payroll", "team_size * avg_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "cogs + acq_cost + payroll", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 500_000 }),
  ];

  return {
    id: "profiler-saas",
    name: "SaaS Startup",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    startingCash: 500_000,
    variables,
    goals: [
      { id: "goal-arr", metric: "revenue", direction: "at_least", threshold: Math.max(price * 100, 50000), byPeriod: 24, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    businessProfile: { archetype: "saas", stage: "early", answers },
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
  const avgCover = liquor ? coverPrice * 1.3 : coverPrice;
  const kitchenStaff = Math.max(2, Math.ceil(seats / 20)) * locations;
  const serviceStaff = Math.max(2, Math.ceil(seats / 15)) * locations;
  const monthlyRent = seats * 50 * locations;

  const variables: ModelVariable[] = [
    input("cover_price", "Average cover price", avgCover, { group: "revenue", valueType: "currency", min: 10, max: avgCover * 3, step: 1 }),
    input("seats", "Total seats", seats * locations, { group: "revenue", valueType: "count", min: 10, max: 500, step: 5 }),
    input("turns_per_day", "Table turns per service", turns, {
      group: "revenue", valueType: "count", min: 1, max: 5, step: 0.5,
      distribution: { kind: "normal", params: { mean: turns, stddev: 0.3 } },
    }),
    input("services_per_day", "Services per day", services, { group: "revenue", valueType: "count", min: 1, max: 3, step: 1 }),
    input("occupancy", "Occupancy rate", 0.7, {
      group: "risk", valueType: "percent", min: 0.2, max: 1, step: 0.05,
      distribution: { kind: "normal", params: { mean: 0.7, stddev: 0.1 } },
    }),
    input("food_cost_pct", "Food cost %", foodCostPct, { group: "costs", valueType: "percent", min: 0.15, max: 0.5, step: 0.01 }),
    input("kitchen_staff", "Kitchen staff", kitchenStaff, { group: "costs", valueType: "count", min: 1, max: 50, step: 1 }),
    input("service_staff", "Service staff", serviceStaff, { group: "costs", valueType: "count", min: 1, max: 50, step: 1 }),
    input("kitchen_wage", "Kitchen monthly wage", 4500, { group: "costs", valueType: "currency", min: 2000, max: 10000, step: 250 }),
    input("service_wage", "Service monthly wage", 3500, { group: "costs", valueType: "currency", min: 2000, max: 8000, step: 250 }),
    input("rent", "Monthly rent & utilities", monthlyRent, { group: "costs", valueType: "currency", min: 1000, max: monthlyRent * 3, step: 500 }),
    input("mgmt_count", "Managers", locations, { group: "costs", valueType: "count", min: 1, max: 10, step: 1 }),
    input("mgmt_salary", "Manager salary", 7000, { group: "costs", valueType: "currency", min: 3000, max: 15000, step: 500 }),
    // Risk events
    input("health_event", "Health inspection issue", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.02 } } }),
    input("staff_shortage", "Staff shortage", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.04 } } }),
    // Formulas
    formula("daily_covers", "Daily covers", "seats * turns_per_day * services_per_day * occupancy", { group: "revenue", valueType: "count" }),
    formula("monthly_covers", "Monthly covers", "daily_covers * 30", { group: "revenue", valueType: "count", chartMetric: "customers" }),
    formula("event_impact", "Event impact", "1 - health_event * 0.5 - staff_shortage * 0.15", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "monthly_covers * cover_price * event_impact", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("food_costs", "Food costs", "revenue * food_cost_pct", { group: "costs", valueType: "currency" }),
    formula("kitchen_payroll", "Kitchen payroll", "kitchen_staff * kitchen_wage * 1.2", { group: "costs", valueType: "currency" }),
    formula("service_payroll", "Service payroll", "service_staff * service_wage * 1.2", { group: "costs", valueType: "currency" }),
    formula("mgmt_payroll", "Management payroll", "mgmt_count * mgmt_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "food_costs + kitchen_payroll + service_payroll + mgmt_payroll + rent", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 200_000 * locations }),
  ];

  return {
    id: "profiler-restaurant",
    name: "Restaurant",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    startingCash: 200_000 * locations,
    variables,
    goals: [
      { id: "goal-breakeven", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 18, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    businessProfile: { archetype: "restaurant", stage: "early", answers },
  };
}

// ─── Retail ────────────────────────────────────────────────────────

function generateRetail(answers: Answers): Scenario {
  const stores = num(answers, "store_count", 1);
  const price = num(answers, "avg_product_price", 50);
  const footTraffic = num(answers, "monthly_foot_traffic", 10000);
  const convRate = num(answers, "conversion_rate", 0.03);
  const cogsPct = num(answers, "cogs_pct", 0.55);

  const storeStaff = Math.max(2, Math.ceil(stores * 4));

  const variables: ModelVariable[] = [
    input("price", "Average product price", price, { group: "revenue", valueType: "currency", min: 1, max: price * 5, step: 1 }),
    input("foot_traffic", "Monthly foot traffic", footTraffic * stores, {
      group: "growth", valueType: "count", min: 500, max: footTraffic * stores * 3, step: 500,
      distribution: { kind: "normal", params: { mean: footTraffic * stores, stddev: footTraffic * stores * 0.15 } },
    }),
    input("conversion", "Foot traffic conversion", convRate, {
      group: "growth", valueType: "percent", min: 0.005, max: 0.3, step: 0.005,
      distribution: { kind: "normal", params: { mean: convRate, stddev: convRate * 0.2 } },
    }),
    input("cogs_pct", "Cost of goods %", cogsPct, { group: "costs", valueType: "percent", min: 0.2, max: 0.8, step: 0.01 }),
    input("store_staff", "Store staff", storeStaff, { group: "costs", valueType: "count", min: 1, max: 50, step: 1 }),
    input("staff_salary", "Staff monthly salary", 3800, { group: "costs", valueType: "currency", min: 2000, max: 10000, step: 200 }),
    input("store_rent", "Monthly store costs", 8000 * stores, { group: "costs", valueType: "currency", min: 2000, max: 50000, step: 1000 }),
    input("mgr_count", "Managers", stores, { group: "costs", valueType: "count", min: 1, max: 20, step: 1 }),
    input("mgr_salary", "Manager salary", 6500, { group: "costs", valueType: "currency", min: 3000, max: 15000, step: 500 }),
    // Risk
    input("seasonal_surge", "Seasonal surge", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.08 } } }),
    input("shrinkage_event", "Inventory shrinkage", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.05 } } }),
    // Formulas
    formula("units_sold", "Units sold", "foot_traffic * conversion", { group: "growth", valueType: "count", chartMetric: "customers" }),
    formula("gross_revenue", "Gross revenue", "units_sold * price", { group: "revenue", valueType: "currency" }),
    formula("event_adj", "Event adjustment", "1 + seasonal_surge * 0.3 - shrinkage_event * 0.05", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "gross_revenue * event_adj", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("cogs", "Cost of goods", "revenue * cogs_pct", { group: "costs", valueType: "currency" }),
    formula("payroll", "Payroll", "store_staff * staff_salary * 1.2 + mgr_count * mgr_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "cogs + payroll + store_rent", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 150_000 * stores }),
  ];

  return {
    id: "profiler-retail",
    name: "Retail Chain",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    startingCash: 150_000 * stores,
    variables,
    goals: [
      { id: "goal-profit", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 18, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    businessProfile: { archetype: "retail", stage: "early", answers },
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

  const variables: ModelVariable[] = [
    input("aov", "Average order value", aov, { group: "revenue", valueType: "currency", min: 5, max: aov * 5, step: 1 }),
    input("visitors", "Monthly site visitors", visitors, {
      group: "growth", valueType: "count", min: 1000, max: visitors * 5, step: 1000,
      distribution: { kind: "normal", params: { mean: visitors, stddev: visitors * 0.15 } },
    }),
    input("conversion", "Site conversion rate", convRate, {
      group: "growth", valueType: "percent", min: 0.005, max: 0.15, step: 0.005,
      distribution: { kind: "normal", params: { mean: convRate, stddev: convRate * 0.15 } },
    }),
    input("return_rate", "Return rate", returnRate, { group: "risk", valueType: "percent", min: 0, max: 0.5, step: 0.01 }),
    input("cogs_pct", "Cost of goods %", cogsPct, { group: "costs", valueType: "percent", min: 0.1, max: 0.8, step: 0.01 }),
    input("ad_spend", "Monthly ad spend", adSpend, { group: "costs", valueType: "currency", min: 0, max: adSpend * 5, step: 500 }),
    input("team_size", "Team size", 5, { group: "costs", valueType: "count", min: 1, max: 30, step: 1 }),
    input("avg_salary", "Avg monthly salary", 6000, { group: "costs", valueType: "currency", min: 3000, max: 15000, step: 500 }),
    input("platform_cost", "Platform & hosting", 800, { group: "costs", valueType: "currency", min: 100, max: 5000, step: 100 }),
    // Risk
    input("seasonal_peak", "Seasonal peak", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.08 } } }),
    input("supply_disruption", "Supply chain disruption", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.03 } } }),
    // Formulas
    formula("orders", "Monthly orders", "visitors * conversion", { group: "growth", valueType: "count" }),
    formula("net_orders", "Net orders (after returns)", "orders * (1 - return_rate)", { group: "growth", valueType: "count", chartMetric: "customers" }),
    formula("event_adj", "Event adjustment", "1 + seasonal_peak * 0.5 - supply_disruption * 0.3", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "net_orders * aov * event_adj", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("cogs", "Cost of goods", "revenue * cogs_pct", { group: "costs", valueType: "currency" }),
    formula("payroll", "Payroll", "team_size * avg_salary * 1.25", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "cogs + ad_spend + payroll + platform_cost", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 200_000 }),
  ];

  return {
    id: "profiler-ecommerce",
    name: "E-commerce / DTC",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    startingCash: 200_000,
    variables,
    goals: [
      { id: "goal-profit", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 12, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    businessProfile: { archetype: "ecommerce", stage: "early", answers },
  };
}

// ─── Wholesale ─────────────────────────────────────────────────────

function generateWholesale(answers: Answers): Scenario {
  const orderSize = num(answers, "avg_order_size", 5000);
  const marginPct = num(answers, "gross_margin_pct", 0.15);
  const monthlyOrders = num(answers, "monthly_orders", 500);
  const warehouseCap = num(answers, "warehouse_capacity", 2000);
  const employees = num(answers, "total_employees", 15);

  const variables: ModelVariable[] = [
    input("order_size", "Average order size", orderSize, { group: "revenue", valueType: "currency", min: 100, max: orderSize * 5, step: 100 }),
    input("monthly_orders", "Monthly orders", monthlyOrders, {
      group: "growth", valueType: "count", min: 10, max: warehouseCap, step: 10,
      distribution: { kind: "normal", params: { mean: monthlyOrders, stddev: monthlyOrders * 0.15 } },
    }),
    input("margin_pct", "Gross margin %", marginPct, { group: "revenue", valueType: "percent", min: 0.03, max: 0.5, step: 0.01 }),
    input("warehouse_cap", "Warehouse capacity", warehouseCap, { group: "costs", valueType: "count", min: 50, max: warehouseCap * 3, step: 50 }),
    input("warehouse_cost", "Monthly warehouse cost", 15000, { group: "costs", valueType: "currency", min: 2000, max: 50000, step: 1000 }),
    input("team_size", "Team size", employees, { group: "costs", valueType: "count", min: 1, max: 50, step: 1 }),
    input("avg_salary", "Avg monthly salary", 5500, { group: "costs", valueType: "currency", min: 3000, max: 12000, step: 500 }),
    // Risk
    input("price_drop", "Market price drop", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.04 } } }),
    input("big_order", "Large contract win", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.05 } } }),
    // Formulas
    formula("capped_orders", "Fulfilled orders", "min(monthly_orders, warehouse_cap)", { group: "growth", valueType: "count", chartMetric: "customers" }),
    formula("gross_revenue", "Gross revenue", "capped_orders * order_size", { group: "revenue", valueType: "currency" }),
    formula("event_adj", "Event adjustment", "1 - price_drop * 0.15 + big_order * 0.2", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "gross_revenue * event_adj", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("cogs", "Cost of goods", "revenue * (1 - margin_pct)", { group: "costs", valueType: "currency" }),
    formula("payroll", "Payroll", "team_size * avg_salary * 1.25", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "cogs + payroll + warehouse_cost", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 500_000 }),
  ];

  return {
    id: "profiler-wholesale",
    name: "Wholesale Trading",
    horizonPeriods: 36,
    timeStep: "month",
    currency: "AUD",
    startingCash: 500_000,
    variables,
    goals: [
      { id: "goal-profit", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 12, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 36, allPeriods: true },
    ],
    businessProfile: { archetype: "wholesale", stage: "early", answers },
  };
}

// ─── Services ──────────────────────────────────────────────────────

function generateServices(answers: Answers): Scenario {
  const consultants = num(answers, "billable_consultants", 10);
  const dailyRate = num(answers, "daily_rate", 1500);
  const utilisation = num(answers, "target_utilisation", 0.75);
  const consultantSalary = num(answers, "consultant_salary", 8000);
  const salesHC = num(answers, "sales_headcount", 2);

  const variables: ModelVariable[] = [
    input("consultants", "Billable consultants", consultants, { group: "revenue", valueType: "count", min: 1, max: 100, step: 1 }),
    input("daily_rate", "Daily billing rate", dailyRate, { group: "revenue", valueType: "currency", min: 100, max: 10000, step: 50 }),
    input("utilisation", "Utilisation rate", utilisation, {
      group: "revenue", valueType: "percent", min: 0.3, max: 0.95, step: 0.05,
      distribution: { kind: "normal", params: { mean: utilisation, stddev: 0.08 } },
    }),
    input("consultant_salary", "Consultant monthly salary", consultantSalary, { group: "costs", valueType: "currency", min: 3000, max: 25000, step: 500 }),
    input("sales_hc", "Sales / BD headcount", salesHC, { group: "costs", valueType: "count", min: 0, max: 20, step: 1 }),
    input("sales_salary", "Sales salary", 10000, { group: "costs", valueType: "currency", min: 4000, max: 20000, step: 500 }),
    input("admin_count", "Admin & ops staff", Math.max(1, Math.ceil(consultants / 8)), { group: "costs", valueType: "count", min: 1, max: 20, step: 1 }),
    input("admin_salary", "Admin salary", 5000, { group: "costs", valueType: "currency", min: 3000, max: 12000, step: 500 }),
    input("office_cost", "Monthly office cost", 3000, { group: "costs", valueType: "currency", min: 500, max: 20000, step: 500 }),
    // Risk
    input("key_quit", "Key consultant quits", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.04 } } }),
    input("big_deal", "Large project win", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.06 } } }),
    // Formulas
    formula("billable_days", "Billable days", "consultants * 22 * utilisation", { group: "revenue", valueType: "count", chartMetric: "customers" }),
    formula("event_adj", "Event adjustment", "1 - key_quit * 0.15 + big_deal * 0.25", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "billable_days * daily_rate * event_adj", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("consultant_payroll", "Consultant payroll", "consultants * consultant_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("sales_payroll", "Sales payroll", "sales_hc * sales_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("admin_payroll", "Admin payroll", "admin_count * admin_salary * 1.2", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "consultant_payroll + sales_payroll + admin_payroll + office_cost", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 300_000 }),
  ];

  const monthlyRevTarget = dailyRate * 22 * utilisation * consultants;
  return {
    id: "profiler-services",
    name: "Services Consultancy",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    startingCash: 300_000,
    variables,
    goals: [
      { id: "goal-rev", metric: "revenue", direction: "at_least", threshold: monthlyRevTarget * 1.2, byPeriod: 24, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    businessProfile: { archetype: "services", stage: "early", answers },
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

  const variables: ModelVariable[] = [
    input("sellers", "Active sellers", sellers, {
      group: "growth", valueType: "count", min: 10, max: sellers * 10, step: 10,
      distribution: { kind: "normal", params: { mean: sellers, stddev: sellers * 0.1 } },
    }),
    input("buyers", "Active buyers", buyers, {
      group: "growth", valueType: "count", min: 50, max: buyers * 10, step: 50,
      distribution: { kind: "normal", params: { mean: buyers, stddev: buyers * 0.1 } },
    }),
    input("avg_transaction", "Avg transaction value", avgTransaction, { group: "revenue", valueType: "currency", min: 1, max: avgTransaction * 5, step: 1 }),
    input("take_rate", "Platform take rate", takeRate, { group: "revenue", valueType: "percent", min: 0.01, max: 0.5, step: 0.01 }),
    input("ad_spend", "Monthly marketing spend", adSpend, { group: "costs", valueType: "currency", min: 0, max: adSpend * 5, step: 500 }),
    input("team_size", "Team size", employees, { group: "costs", valueType: "count", min: 1, max: 50, step: 1 }),
    input("avg_salary", "Avg salary", 8000, { group: "costs", valueType: "currency", min: 3000, max: 20000, step: 500 }),
    input("platform_cost", "Platform infrastructure", 3000, { group: "costs", valueType: "currency", min: 500, max: 20000, step: 500 }),
    // Risk
    input("platform_outage", "Platform outage", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.02 } } }),
    input("viral_spike", "Viral growth spike", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.04 } } }),
    // Formulas
    formula("transactions", "Monthly transactions", "min(sellers * 5, buyers * 0.8)", { group: "growth", valueType: "count", chartMetric: "customers" }),
    formula("gmv", "Gross merchandise value", "transactions * avg_transaction", { group: "revenue", valueType: "currency" }),
    formula("event_adj", "Event adjustment", "1 - platform_outage * 0.4 + viral_spike * 0.4", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue (take)", "gmv * take_rate * event_adj", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("platform_cogs", "Platform COGS", "revenue * 0.15", { group: "costs", valueType: "currency" }),
    formula("payroll", "Payroll", "team_size * avg_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "platform_cogs + payroll + ad_spend + platform_cost", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 400_000 }),
  ];

  return {
    id: "profiler-marketplace",
    name: "Marketplace",
    horizonPeriods: 24,
    timeStep: "month",
    currency: "AUD",
    startingCash: 400_000,
    variables,
    goals: [
      { id: "goal-gmv", metric: "revenue", direction: "at_least", threshold: monthlyTransactions * avgTransaction * takeRate * 3, byPeriod: 24, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 24, allPeriods: true },
    ],
    businessProfile: { archetype: "marketplace", stage: "early", answers },
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

  const variables: ModelVariable[] = [
    input("unit_price", "Unit selling price", unitPrice, { group: "revenue", valueType: "currency", min: 1, max: unitPrice * 5, step: 0.5 }),
    input("unit_cost", "Unit production cost", unitCost, { group: "costs", valueType: "currency", min: 0.5, max: unitPrice, step: 0.5 }),
    input("capacity", "Monthly capacity (units)", capacity * facilities, { group: "revenue", valueType: "count", min: 100, max: capacity * facilities * 3, step: 100 }),
    input("utilisation", "Capacity utilisation", utilisation, {
      group: "revenue", valueType: "percent", min: 0.1, max: 1, step: 0.05,
      distribution: { kind: "normal", params: { mean: utilisation, stddev: 0.08 } },
    }),
    input("prod_workers", "Production workers", Math.max(5, Math.floor(employees * 0.6)), { group: "costs", valueType: "count", min: 1, max: 200, step: 1 }),
    input("prod_wage", "Production worker wage", 4500, { group: "costs", valueType: "currency", min: 2000, max: 10000, step: 250 }),
    input("overhead_staff", "Overhead staff", Math.max(3, Math.ceil(employees * 0.25)), { group: "costs", valueType: "count", min: 1, max: 50, step: 1 }),
    input("overhead_salary", "Overhead salary", 6000, { group: "costs", valueType: "currency", min: 3000, max: 15000, step: 500 }),
    input("facility_cost", "Facility operating cost", 25000 * facilities, { group: "costs", valueType: "currency", min: 5000, max: 100000, step: 5000 }),
    input("depreciation", "Monthly depreciation", Math.round(equipmentCost / 120), { group: "costs", valueType: "currency", min: 0, max: 50000, step: 500 }),
    // Risk
    input("breakdown", "Equipment breakdown", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.03 } } }),
    input("quality_issue", "Quality issue / recall", 0, { group: "risk", isLever: false, distribution: { kind: "bernoulli", params: { p: 0.02 } } }),
    // Formulas
    formula("units_produced", "Units produced", "capacity * utilisation", { group: "revenue", valueType: "count", chartMetric: "customers" }),
    formula("event_adj", "Event adjustment", "1 - breakdown * 0.3 - quality_issue * 0.2", { group: "risk", valueType: "ratio" }),
    formula("revenue", "Revenue", "units_produced * unit_price * event_adj", { group: "revenue", valueType: "currency", chartMetric: "revenue" }),
    formula("cogs", "Cost of goods", "units_produced * unit_cost", { group: "costs", valueType: "currency" }),
    formula("prod_payroll", "Production payroll", "prod_workers * prod_wage * 1.2", { group: "costs", valueType: "currency" }),
    formula("overhead_payroll", "Overhead payroll", "overhead_staff * overhead_salary * 1.3", { group: "costs", valueType: "currency" }),
    formula("total_costs", "Total costs", "cogs + prod_payroll + overhead_payroll + facility_cost + depreciation", { group: "costs", valueType: "currency" }),
    formula("profit", "Profit", "revenue - total_costs", { group: "revenue", valueType: "currency", chartMetric: "profit" }),
    formula("cash", "Cash", "prev.cash + profit", { group: "revenue", valueType: "currency", chartMetric: "cash", initialValue: 300_000 + equipmentCost * 0.3 }),
  ];

  return {
    id: "profiler-manufacturing",
    name: "Manufacturing",
    horizonPeriods: 36,
    timeStep: "month",
    currency: "AUD",
    startingCash: 300_000 + equipmentCost * 0.3,
    variables,
    goals: [
      { id: "goal-profit", metric: "profit", direction: "at_least", threshold: 0, byPeriod: 12, allPeriods: false },
      { id: "goal-cash", metric: "cash", direction: "at_least", threshold: 0, byPeriod: 36, allPeriods: true },
    ],
    businessProfile: { archetype: "manufacturing", stage: "early", answers },
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
