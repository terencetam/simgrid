import { generateScenario } from "../profiler/profiler-engine";

export const services = generateScenario({
  archetype: "services",
  stage: "early",
  answers: {},
});
