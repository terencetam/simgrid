import type { Scenario } from "../schema";
import { generateScenario } from "../profiler/profiler-engine";

export const TEMPLATES: Record<string, Scenario> = {
  "saas-startup": generateScenario({ archetype: "saas", stage: "early", answers: {} }),
  restaurant: generateScenario({ archetype: "restaurant", stage: "early", answers: {} }),
  retail: generateScenario({ archetype: "retail", stage: "early", answers: {} }),
  ecommerce: generateScenario({ archetype: "ecommerce", stage: "early", answers: {} }),
  wholesale: generateScenario({ archetype: "wholesale", stage: "early", answers: {} }),
  services: generateScenario({ archetype: "services", stage: "early", answers: {} }),
  marketplace: generateScenario({ archetype: "marketplace", stage: "early", answers: {} }),
  manufacturing: generateScenario({ archetype: "manufacturing", stage: "early", answers: {} }),
};
