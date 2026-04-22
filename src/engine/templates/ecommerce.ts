import { generateScenario } from "../profiler/profiler-engine";

export const ecommerce = generateScenario({
  archetype: "ecommerce",
  stage: "early",
  answers: {},
});
