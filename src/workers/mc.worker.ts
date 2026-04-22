import { expose } from "comlink";
import type { Scenario } from "@/engine/schema";
import type { MCResultWithTraces } from "@/engine/montecarlo";
import { monteCarlo } from "@/engine/montecarlo";

const api = {
  runMonteCarlo(
    scenario: Scenario,
    nRuns: number,
    seed: number,
    onProgress: (done: number) => void,
    sampleCount?: number
  ): MCResultWithTraces {
    return monteCarlo(scenario, nRuns, seed, onProgress, sampleCount);
  },
};

export type MCWorkerAPI = typeof api;

expose(api);
