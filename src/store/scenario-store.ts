import { create } from "zustand";
import { wrap, proxy } from "comlink";
import type { Scenario, MonteCarloResult, ModelVariable } from "@/engine/schema";
import type { SampleRun } from "@/engine/montecarlo";
import type { MCWorkerAPI } from "@/workers/mc.worker";
import type { TornadoResult } from "@/engine/core/sensitivity";
import { TEMPLATES } from "@/engine/templates";
import type { AnimationPhase } from "@/ui/charts/SimulationChart";
import { saveScenario, getSavedScenario } from "@/lib/db";

interface ScenarioState {
  scenario: Scenario;
  result: MonteCarloResult | null;
  sensitivityResult: TornadoResult | null;
  sampleRuns: SampleRun[];
  isRunning: boolean;
  nRuns: number;
  progress: number;
  animationPhase: AnimationPhase;
  showProfiler: boolean;
  savedScenarioId: string | null;
  isDirty: boolean;
  lastError: string | null;

  updateScenario: (patch: Partial<Scenario>) => void;
  updateVariable: (variableId: string, baseValue: number) => void;
  addVariable: (variable: ModelVariable) => void;
  deleteVariable: (variableId: string) => void;
  updateVariableField: (variableId: string, patch: Partial<ModelVariable>) => void;
  runSimulation: () => void;
  setAnimationPhase: (phase: AnimationPhase) => void;
  loadScenario: (scenario: Scenario, savedId?: string) => void;
  resetToProfiler: () => void;
  clearError: () => void;
  saveCurrentScenario: () => Promise<void>;
  loadSavedScenario: (id: string) => Promise<void>;
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
  scenario: TEMPLATES["saas-startup"],
  result: null,
  sensitivityResult: null,
  sampleRuns: [],
  isRunning: false,
  nRuns: 1000,
  progress: 0,
  animationPhase: "idle" as AnimationPhase,
  showProfiler: true,
  savedScenarioId: null,
  isDirty: false,
  lastError: null,

  updateScenario: (patch) =>
    set((state) => ({
      scenario: { ...state.scenario, ...patch },
      isDirty: true,
    })),

  updateVariable: (variableId, baseValue) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        variables: state.scenario.variables.map((v) =>
          v.id === variableId ? { ...v, baseValue } : v
        ),
      },
      isDirty: true,
    })),

  addVariable: (variable) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        variables: [...state.scenario.variables, variable],
      },
      isDirty: true,
    })),

  deleteVariable: (variableId) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        variables: state.scenario.variables.filter(
          (v) => v.id !== variableId
        ),
      },
      isDirty: true,
    })),

  updateVariableField: (variableId, patch) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        variables: state.scenario.variables.map((v) =>
          v.id === variableId ? { ...v, ...patch } : v
        ),
      },
      isDirty: true,
    })),

  setAnimationPhase: (phase) => set({ animationPhase: phase }),

  loadScenario: (scenario, savedId) =>
    set({
      scenario,
      result: null,
      sensitivityResult: null,
      sampleRuns: [],
      isRunning: false,
      progress: 0,
      animationPhase: "idle",
      showProfiler: false,
      savedScenarioId: savedId ?? null,
      isDirty: false,
    }),

  resetToProfiler: () => set({ showProfiler: true }),

  clearError: () => set({ lastError: null }),

  saveCurrentScenario: async () => {
    const { scenario } = get();
    const id = await saveScenario(scenario);
    set({ savedScenarioId: id, isDirty: false });
  },

  loadSavedScenario: async (id) => {
    try {
      const saved = await getSavedScenario(id);
      if (saved) {
        get().loadScenario(saved.scenario, saved.id);
      }
    } catch (err) {
      console.error("Failed to load scenario:", err);
    }
  },

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

      // Run sensitivity analysis in background
      api.runSensitivityAnalysis(scenario, result.survivalRate).then(
        (sensitivityResult) => set({ sensitivityResult }),
        (err) => console.error("Sensitivity analysis error:", err),
      );
    } catch (err) {
      console.error("MC worker error:", err);
      set({
        isRunning: false,
        animationPhase: "idle",
        lastError: err instanceof Error ? err.message : "Simulation failed",
      });
    }
  },
}));
