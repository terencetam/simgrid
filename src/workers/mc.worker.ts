import { expose } from "comlink";
import type { Scenario } from "@/engine/schema";
import type { MCResultWithTraces } from "@/engine/montecarlo";
import { monteCarlo } from "@/engine/montecarlo";
import { runSensitivity, type TornadoResult } from "@/engine/core/sensitivity";

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

  runSensitivityAnalysis(
    scenario: Scenario,
    baseWinProb: number,
  ): TornadoResult {
    return runSensitivity(scenario, baseWinProb);
  },
};

export type MCWorkerAPI = typeof api;

expose(api);
