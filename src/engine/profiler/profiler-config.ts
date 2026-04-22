/**
 * Archetype definitions, questions, and industry-benchmark defaults.
 */

export interface ProfilerQuestion {
  id: string;
  label: string;
  type: "number" | "select" | "boolean";
  options?: { value: string | number; label: string }[];
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  helpText?: string;
}

export type Archetype = "saas" | "restaurant" | "retail" | "ecommerce" | "wholesale" | "services" | "marketplace" | "manufacturing";

export interface ArchetypeConfig {
  id: Archetype;
  name: string;
  description: string;
  icon: string;
  questions: ProfilerQuestion[];
}

export const ARCHETYPE_CONFIGS: Record<Archetype, ArchetypeConfig> = {
  saas: {
    id: "saas",
    name: "SaaS / Subscription",
    description: "Recurring revenue, churn, LTV/CAC",
    icon: "💻",
    questions: [
      { id: "monthly_price", label: "Monthly subscription price", type: "number", default: 99, min: 5, max: 5000, step: 1, unit: "$" },
      { id: "current_customers", label: "Current customers", type: "number", default: 50, min: 0, max: 100000, step: 1, helpText: "0 = pre-launch" },
      { id: "monthly_churn", label: "Monthly churn rate", type: "number", default: 0.05, min: 0.005, max: 0.2, step: 0.005, unit: "%", helpText: "5% is typical for SMB SaaS" },
      { id: "acquisition_method", label: "How do you acquire customers?", type: "select", default: "mix", options: [
        { value: "sales", label: "Sales team" },
        { value: "ads", label: "Paid ads" },
        { value: "organic", label: "Organic / word of mouth" },
        { value: "mix", label: "Mix of channels" },
      ]},
      { id: "cac", label: "Cost per acquisition", type: "number", default: 400, min: 10, max: 10000, step: 10, unit: "$", helpText: "If unsure, leave default" },
      { id: "total_employees", label: "Total employees", type: "number", default: 10, min: 1, max: 500, step: 1 },
    ],
  },

  restaurant: {
    id: "restaurant",
    name: "Restaurant / Hospitality",
    description: "Covers, food cost, table turnover",
    icon: "🍽️",
    questions: [
      { id: "location_count", label: "Number of locations", type: "number", default: 1, min: 1, max: 50, step: 1 },
      { id: "cover_price", label: "Average cover price ($ per guest)", type: "number", default: 35, min: 5, max: 200, step: 1, unit: "$" },
      { id: "seats_per_location", label: "Seats per location", type: "number", default: 60, min: 10, max: 500, step: 5 },
      { id: "turns_per_service", label: "Table turns per service", type: "number", default: 2, min: 1, max: 5, step: 0.5 },
      { id: "operating_hours", label: "Operating hours", type: "select", default: "dinner_only", options: [
        { value: "dinner_only", label: "Dinner only" },
        { value: "lunch_dinner", label: "Lunch + dinner" },
        { value: "all_day", label: "All day" },
      ]},
      { id: "food_cost_pct", label: "Target food cost %", type: "number", default: 0.30, min: 0.15, max: 0.50, step: 0.01, unit: "%", helpText: "Industry benchmark: 28-32%" },
      { id: "liquor_licence", label: "Do you have a liquor licence?", type: "boolean", default: true, helpText: "Liquor significantly changes margin" },
      { id: "planning_expansion", label: "Planning to open new locations?", type: "boolean", default: false },
    ],
  },

  retail: {
    id: "retail",
    name: "Retail (Physical)",
    description: "Revenue per sqft, inventory, foot traffic",
    icon: "🏪",
    questions: [
      { id: "store_count", label: "Number of stores", type: "number", default: 1, min: 1, max: 100, step: 1 },
      { id: "avg_product_price", label: "Average product price", type: "number", default: 50, min: 1, max: 5000, step: 1, unit: "$" },
      { id: "monthly_foot_traffic", label: "Monthly foot traffic per store", type: "number", default: 10000, min: 500, max: 200000, step: 500 },
      { id: "conversion_rate", label: "Foot traffic conversion rate", type: "number", default: 0.03, min: 0.005, max: 0.3, step: 0.005, unit: "%", helpText: "% of visitors who buy" },
      { id: "cogs_pct", label: "Cost of goods as % of price", type: "number", default: 0.55, min: 0.2, max: 0.8, step: 0.01, unit: "%" },
      { id: "has_online", label: "Also sell online?", type: "boolean", default: true },
      { id: "planning_expansion", label: "Planning to open new stores?", type: "boolean", default: false },
    ],
  },

  ecommerce: {
    id: "ecommerce",
    name: "E-commerce / DTC",
    description: "AOV, conversion, return rate, CAC",
    icon: "🛒",
    questions: [
      { id: "aov", label: "Average order value", type: "number", default: 65, min: 5, max: 5000, step: 1, unit: "$" },
      { id: "monthly_visitors", label: "Monthly site visitors", type: "number", default: 50000, min: 1000, max: 5000000, step: 1000 },
      { id: "conversion_rate", label: "Site visitor conversion rate", type: "number", default: 0.025, min: 0.005, max: 0.15, step: 0.005, unit: "%", helpText: "2-3% is typical" },
      { id: "return_rate", label: "Return / refund rate", type: "number", default: 0.15, min: 0, max: 0.5, step: 0.01, unit: "%", helpText: "Fashion ~20-30%, electronics ~5-10%" },
      { id: "cogs_pct", label: "Cost of goods as % of price", type: "number", default: 0.40, min: 0.1, max: 0.8, step: 0.01, unit: "%" },
      { id: "monthly_ad_spend", label: "Monthly advertising spend", type: "number", default: 10000, min: 0, max: 500000, step: 500, unit: "$" },
    ],
  },

  wholesale: {
    id: "wholesale",
    name: "Wholesale / Trading",
    description: "Margin per unit, working capital, inventory",
    icon: "📦",
    questions: [
      { id: "avg_order_size", label: "Average order size", type: "number", default: 5000, min: 100, max: 500000, step: 100, unit: "$" },
      { id: "gross_margin_pct", label: "Gross margin %", type: "number", default: 0.15, min: 0.03, max: 0.5, step: 0.01, unit: "%", helpText: "Typically 10-25%" },
      { id: "payment_terms_days", label: "Customer payment terms (days)", type: "number", default: 45, min: 0, max: 120, step: 5, helpText: "How many days before customers pay" },
      { id: "monthly_orders", label: "Monthly order volume", type: "number", default: 500, min: 10, max: 50000, step: 10 },
      { id: "warehouse_capacity", label: "Warehouse capacity (orders/month)", type: "number", default: 2000, min: 50, max: 100000, step: 50 },
      { id: "total_employees", label: "Total employees", type: "number", default: 15, min: 1, max: 500, step: 1 },
    ],
  },

  services: {
    id: "services",
    name: "Services / Consultancy",
    description: "Utilisation, daily rate, pipeline",
    icon: "💼",
    questions: [
      { id: "billable_consultants", label: "Billable consultants", type: "number", default: 10, min: 1, max: 500, step: 1 },
      { id: "daily_rate", label: "Average daily billing rate", type: "number", default: 1500, min: 100, max: 10000, step: 50, unit: "$" },
      { id: "target_utilisation", label: "Target utilisation %", type: "number", default: 0.75, min: 0.3, max: 0.95, step: 0.05, unit: "%", helpText: "75% is a common target" },
      { id: "avg_project_months", label: "Average project length (months)", type: "number", default: 3, min: 0.5, max: 24, step: 0.5 },
      { id: "consultant_salary", label: "Average consultant monthly salary", type: "number", default: 8000, min: 2000, max: 30000, step: 500, unit: "$" },
      { id: "sales_headcount", label: "Sales / BD headcount", type: "number", default: 2, min: 0, max: 50, step: 1 },
    ],
  },

  marketplace: {
    id: "marketplace",
    name: "Marketplace",
    description: "GMV, take rate, two-sided network",
    icon: "🏛️",
    questions: [
      { id: "active_sellers", label: "Current active sellers", type: "number", default: 100, min: 0, max: 100000, step: 10, helpText: "0 = pre-launch" },
      { id: "active_buyers", label: "Current active buyers", type: "number", default: 500, min: 0, max: 1000000, step: 50 },
      { id: "avg_transaction", label: "Average transaction value", type: "number", default: 50, min: 1, max: 50000, step: 1, unit: "$" },
      { id: "take_rate", label: "Platform take rate", type: "number", default: 0.10, min: 0.01, max: 0.50, step: 0.01, unit: "%", helpText: "% of each transaction you keep" },
      { id: "monthly_ad_spend", label: "Monthly marketing spend", type: "number", default: 5000, min: 0, max: 200000, step: 500, unit: "$" },
      { id: "total_employees", label: "Total employees", type: "number", default: 8, min: 1, max: 200, step: 1 },
    ],
  },

  manufacturing: {
    id: "manufacturing",
    name: "Manufacturing",
    description: "Unit cost, capacity, equipment, shifts",
    icon: "🏭",
    questions: [
      { id: "unit_price", label: "Unit selling price", type: "number", default: 25, min: 0.5, max: 100000, step: 0.5, unit: "$" },
      { id: "unit_cost", label: "Unit production cost", type: "number", default: 12, min: 0.1, max: 50000, step: 0.1, unit: "$" },
      { id: "monthly_capacity", label: "Monthly production capacity (units)", type: "number", default: 10000, min: 100, max: 10000000, step: 100 },
      { id: "current_utilisation", label: "Current capacity utilisation", type: "number", default: 0.60, min: 0.1, max: 1, step: 0.05, unit: "%", helpText: "% of capacity currently used" },
      { id: "facility_count", label: "Number of facilities", type: "number", default: 1, min: 1, max: 20, step: 1 },
      { id: "equipment_cost", label: "Major equipment cost", type: "number", default: 500000, min: 10000, max: 50000000, step: 10000, unit: "$", helpText: "Total cost of key production equipment" },
      { id: "total_employees", label: "Total production employees", type: "number", default: 25, min: 1, max: 2000, step: 1 },
    ],
  },
};
