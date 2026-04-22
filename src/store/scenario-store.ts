import { create } from "zustand";
import { wrap, proxy } from "comlink";
import type { Scenario, MonteCarloResult } from "@/engine/schema";
import type { SampleRun } from "@/engine/montecarlo";
import type { MCWorkerAPI } from "@/workers/mc.worker";
import type { TornadoResult } from "@/engine/core/sensitivity";
import { saasStartup } from "@/engine/templates/saas-startup";
import type { AnimationPhase } from "@/ui/charts/SimulationChart";

interface ScenarioState {
  scenario: Scenario;
  result: MonteCarloResult | null;
  sensitivityResult: TornadoResult | null;
  sampleRuns: SampleRun[];
  isRunning: boolean;
  nRuns: number;
  progress: number;
  animationPhase: AnimationPhase;

  updateScenario: (patch: Partial<Scenario>) => void;
  updateVariable: (variableId: string, baseValue: number) => void;
  runSimulation: () => void;
  setAnimationPhase: (phase: AnimationPhase) => void;
}

function patchVariableInScenario(
  scenario: Scenario,
  variableId: string,
  baseValue: number
): Scenario {
  const s = structuredClone(scenario);

  for (const p of s.products) {
    if (p.price.id === variableId) p.price.baseValue = baseValue;
    if (p.unitCogs.id === variableId) p.unitCogs.baseValue = baseValue;
  }

  for (const seg of s.segments) {
    if (seg.tam.id === variableId) seg.tam.baseValue = baseValue;
    if (seg.ourShare.id === variableId) seg.ourShare.baseValue = baseValue;
    if (seg.churnRate.id === variableId) seg.churnRate.baseValue = baseValue;
    if (seg.acv.id === variableId) seg.acv.baseValue = baseValue;
  }

  for (const ad of s.adChannels) {
    if (ad.spend.id === variableId) ad.spend.baseValue = baseValue;
    if (ad.cac.id === variableId) ad.cac.baseValue = baseValue;
  }

  for (const sr of s.salesRoles) {
    if (sr.fullyLoadedCost.id === variableId)
      sr.fullyLoadedCost.baseValue = baseValue;
    if (sr.quota.id === variableId) sr.quota.baseValue = baseValue;
    if (sr.quotaHitProbability.id === variableId)
      sr.quotaHitProbability.baseValue = baseValue;
  }

  for (const ch of s.channels) {
    if (ch.capacityPerPeriod.id === variableId)
      ch.capacityPerPeriod.baseValue = baseValue;
    if (ch.conversionRate.id === variableId)
      ch.conversionRate.baseValue = baseValue;
  }

  return s;
}

// Lazy-init worker singleton
let workerInstance: Worker | null = null;
let workerApi: ReturnType<typeof wrap<MCWorkerAPI>> | null = null;

function getWorkerApi() {
  if (!workerApi) {
    workerInstance = new Worker(
      new URL("../workers/mc.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerApi = wrap<MCWorkerAPI>(workerInstance);
  }
  return workerApi;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenario: saasStartup,
  result: null,
  sensitivityResult: null,
  sampleRuns: [],
  isRunning: false,
  nRuns: 1000,
  progress: 0,
  animationPhase: "idle" as AnimationPhase,

  updateScenario: (patch) =>
    set((state) => ({
      scenario: { ...state.scenario, ...patch },
    })),

  updateVariable: (variableId, baseValue) =>
    set((state) => ({
      scenario: patchVariableInScenario(state.scenario, variableId, baseValue),
    })),

  setAnimationPhase: (phase) => set({ animationPhase: phase }),

  runSimulation: async () => {
    set({
      isRunning: true,
      progress: 0,
      result: null,
      sensitivityResult: null,
      sampleRuns: [],
      animationPhase: "idle",
    });

    const { scenario, nRuns } = get();
    const api = getWorkerApi();

    try {
      const { result, sampleRuns } = await api.runMonteCarlo(
        scenario,
        nRuns,
        42,
        proxy((done: number) => {
          set({ progress: done });
        }),
        200
      );

      set({
        result,
        sampleRuns,
        isRunning: false,
        progress: nRuns,
        animationPhase: "spaghetti",
      });

      // Run sensitivity analysis in background (non-blocking)
      api.runSensitivityAnalysis(scenario, result.winProbability).then(
        (sensitivityResult) => set({ sensitivityResult }),
        (err) => console.error("Sensitivity analysis error:", err),
      );
    } catch (err) {
      console.error("MC worker error:", err);
      set({ isRunning: false, animationPhase: "idle" });
    }
  },
}));
