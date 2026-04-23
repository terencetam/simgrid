/**
 * Vocabulary: group label overrides per archetype.
 * Variable names are already business-specific (set by profiler).
 */

const DEFAULT_GROUP_LABELS: Record<string, string> = {
  revenue: "Revenue",
  growth: "Growth",
  costs: "Costs",
  risk: "Risk & Events",
};

const GROUP_LABEL_OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  saas: { growth: "Growth & Acquisition" },
  restaurant: { revenue: "Menu & Pricing", costs: "Kitchen & Staff" },
  retail: { growth: "Traffic & Conversion" },
  ecommerce: { growth: "Traffic & Conversion" },
  wholesale: { growth: "Orders & Pipeline" },
  services: { revenue: "Billing & Utilisation" },
  marketplace: { growth: "Network" },
  manufacturing: { revenue: "Production & Pricing" },
};

export function getGroupLabel(
  archetype: string | undefined,
  group: string
): string {
  if (archetype) {
    const override = GROUP_LABEL_OVERRIDES[archetype]?.[group];
    if (override) return override;
  }
  return DEFAULT_GROUP_LABELS[group] ?? group;
}
