/**
 * Vocabulary mapping: generic engine terms → archetype-specific labels.
 * Drives all UI labels so the app speaks the user's language.
 */

type Archetype = "saas" | "restaurant" | "retail" | "ecommerce" | "wholesale" | "services" | "marketplace" | "manufacturing";

interface VocabEntry {
  label: string;
  hidden?: boolean;
}

type VocabMap = Record<string, VocabEntry>;

const DEFAULT_VOCAB: VocabMap = {
  "product.price": { label: "Price" },
  "product.unitCogs": { label: "Unit COGS" },
  "segment.tam": { label: "Total addressable market" },
  "segment.ourShare": { label: "Current customers" },
  "segment.churnRate": { label: "Churn rate" },
  "segment.acv": { label: "Annual contract value" },
  "channel.capacityPerPeriod": { label: "Channel capacity" },
  "channel.conversionRate": { label: "Conversion rate" },
  "store.fixedCostPerUnit": { label: "Fixed cost per unit" },
  "store.revenueCapPerUnit": { label: "Revenue cap per unit" },
  "salesRole.fullyLoadedCost": { label: "Fully loaded cost" },
  "salesRole.quota": { label: "Quota" },
  "salesRole.quotaHitProbability": { label: "Quota hit probability" },
  "adChannel.spend": { label: "Ad spend" },
  "adChannel.cac": { label: "CAC" },
  "headcount.salary": { label: "Monthly salary" },
  "metric.cac": { label: "CAC" },
  "metric.ltv": { label: "LTV" },
  "metric.ltvCacRatio": { label: "LTV/CAC" },
  "metric.paybackMonths": { label: "Payback" },
  "metric.grossMarginPct": { label: "Gross Margin" },
  "metric.arpu": { label: "ARPU" },
  "metric.revenuePerEmployee": { label: "Rev/Employee" },
  "metric.burnMultiple": { label: "Burn Multiple" },
};

const SAAS_VOCAB: VocabMap = {
  "product.price": { label: "Monthly subscription price" },
  "product.unitCogs": { label: "Infrastructure cost per user" },
  "segment.churnRate": { label: "Monthly churn rate" },
  "channel.conversionRate": { label: "Trial-to-paid conversion" },
  "headcount.salary": { label: "Monthly salary" },
};

const RESTAURANT_VOCAB: VocabMap = {
  "product.price": { label: "Average cover price" },
  "product.unitCogs": { label: "Food cost per cover" },
  "segment.churnRate": { hidden: true },
  "segment.acv": { hidden: true },
  "segment.tam": { hidden: true },
  "store.fixedCostPerUnit": { label: "Monthly rent & utilities" },
  "store.revenueCapPerUnit": { label: "Revenue per seat-hour (RevPASH)" },
  "channel.conversionRate": { hidden: true },
  "adChannel.spend": { hidden: true },
  "adChannel.cac": { hidden: true },
  "salesRole.quota": { hidden: true },
  "metric.cac": { hidden: true },
  "metric.ltv": { hidden: true },
  "metric.ltvCacRatio": { hidden: true },
  "metric.burnMultiple": { hidden: true },
  "metric.paybackMonths": { hidden: true },
  "metric.arpu": { label: "Revenue per cover" },
};

const RETAIL_VOCAB: VocabMap = {
  "product.price": { label: "Average product price" },
  "product.unitCogs": { label: "Cost of goods" },
  "segment.churnRate": { label: "Customer lapse rate" },
  "store.fixedCostPerUnit": { label: "Monthly store costs" },
  "store.revenueCapPerUnit": { label: "Revenue per sqft" },
  "channel.conversionRate": { label: "Foot traffic conversion" },
  "metric.burnMultiple": { hidden: true },
  "metric.arpu": { label: "Revenue per customer" },
};

const ECOMMERCE_VOCAB: VocabMap = {
  "product.price": { label: "Average order value" },
  "product.unitCogs": { label: "Cost of goods + shipping" },
  "segment.churnRate": { label: "Customer lapse rate" },
  "channel.conversionRate": { label: "Site visitor conversion" },
  "channel.capacityPerPeriod": { label: "Monthly site visitors" },
  "metric.burnMultiple": { hidden: true },
  "metric.arpu": { label: "Revenue per customer" },
};

const WHOLESALE_VOCAB: VocabMap = {
  "product.price": { label: "Average order size" },
  "product.unitCogs": { label: "Cost per unit (landed)" },
  "segment.churnRate": { label: "Customer attrition rate" },
  "channel.conversionRate": { label: "Win rate" },
  "metric.burnMultiple": { hidden: true },
  "metric.ltvCacRatio": { hidden: true },
  "metric.arpu": { label: "Revenue per customer" },
};

const SERVICES_VOCAB: VocabMap = {
  "product.price": { label: "Daily billing rate" },
  "product.unitCogs": { hidden: true },
  "segment.churnRate": { label: "Client attrition rate" },
  "headcount.salary": { label: "Consultant salary" },
  "store.fixedCostPerUnit": { hidden: true },
  "metric.burnMultiple": { hidden: true },
  "metric.arpu": { label: "Revenue per consultant" },
};

const MARKETPLACE_VOCAB: VocabMap = {
  "product.price": { label: "Average transaction value" },
  "product.unitCogs": { label: "Platform cost per transaction" },
  "segment.churnRate": { label: "Seller churn rate" },
  "channel.conversionRate": { label: "Transaction conversion" },
  "metric.arpu": { label: "Revenue per active user" },
};

const MANUFACTURING_VOCAB: VocabMap = {
  "product.price": { label: "Unit selling price" },
  "product.unitCogs": { label: "Unit production cost" },
  "segment.churnRate": { label: "Customer attrition rate" },
  "store.fixedCostPerUnit": { label: "Facility operating cost" },
  "store.revenueCapPerUnit": { label: "Facility capacity (revenue)" },
  "metric.burnMultiple": { hidden: true },
  "metric.ltvCacRatio": { hidden: true },
  "metric.arpu": { label: "Revenue per customer" },
};

const VOCAB: Record<string, VocabMap> = {
  saas: SAAS_VOCAB,
  restaurant: RESTAURANT_VOCAB,
  retail: RETAIL_VOCAB,
  ecommerce: ECOMMERCE_VOCAB,
  wholesale: WHOLESALE_VOCAB,
  services: SERVICES_VOCAB,
  marketplace: MARKETPLACE_VOCAB,
  manufacturing: MANUFACTURING_VOCAB,
};

export function getLabel(
  archetype: Archetype | undefined,
  fieldPath: string,
  fallback: string,
): string {
  if (archetype) {
    const entry = VOCAB[archetype]?.[fieldPath];
    if (entry?.hidden) return fallback;
    if (entry?.label) return entry.label;
  }
  const def = DEFAULT_VOCAB[fieldPath];
  return def?.label ?? fallback;
}

export function isHidden(
  archetype: Archetype | undefined,
  fieldPath: string,
): boolean {
  if (!archetype) return false;
  return VOCAB[archetype]?.[fieldPath]?.hidden === true;
}
