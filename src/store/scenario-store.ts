import { create } from "zustand";
import { wrap, proxy } from "comlink";
import type { Scenario, MonteCarloResult, CausalLink, Variable, VariableGroup } from "@/engine/schema";
import type { SampleRun } from "@/engine/montecarlo";
import type { MCWorkerAPI } from "@/workers/mc.worker";
import type { TornadoResult } from "@/engine/core/sensitivity";
import { patchVariable } from "@/engine/core/variable-registry";
import { compileCausalGraph } from "@/engine/core/causal-links";
import { collectVariables } from "@/engine/core/variable-registry";
import { saasStartup } from "@/engine/templates/saas-startup";
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
  addCustomVariable: (group: VariableGroup, name: string, baseValue: number) => void;
  deleteCustomVariable: (variableId: string) => void;
  addCausalLink: (link: CausalLink) => void;
  removeCausalLink: (linkId: string) => void;
  updateCausalLink: (linkId: string, patch: Partial<CausalLink>) => void;
  updateNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
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
  scenario: saasStartup,
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
      scenario: patchVariable(state.scenario, variableId, baseValue),
      isDirty: true,
    })),

  addCustomVariable: (group, name, baseValue) =>
    set((state) => {
      const newVar: Variable = {
        id: crypto.randomUUID(),
        name,
        kind: "constant",
        baseValue,
        resampleEachPeriod: true,
        group,
        valueType: baseValue > 0 && baseValue <= 1 ? "percent" : "currency",
      };
      return {
        scenario: {
          ...state.scenario,
          customVariables: [...(state.scenario.customVariables ?? []), newVar],
        },
        isDirty: true,
      };
    }),

  deleteCustomVariable: (variableId) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        customVariables: (state.scenario.customVariables ?? []).filter(
          (v) => v.id !== variableId,
        ),
        causalLinks: (state.scenario.causalLinks ?? []).filter(
          (l) => l.sourceId !== variableId && l.targetId !== variableId,
        ),
      },
      isDirty: true,
    })),

  addCausalLink: (link) =>
    set((state) => {
      const newLinks = [...(state.scenario.causalLinks ?? []), link];
      // Validate no cycles
      const varIds = new Set(collectVariables(state.scenario).keys());
      try {
        compileCausalGraph(newLinks, varIds);
      } catch {
        return { lastError: "Cannot add link: would create a cycle." };
      }
      return {
        scenario: { ...state.scenario, causalLinks: newLinks },
        isDirty: true,
      };
    }),

  removeCausalLink: (linkId) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        causalLinks: (state.scenario.causalLinks ?? []).filter(
          (l) => l.id !== linkId,
        ),
      },
      isDirty: true,
    })),

  updateCausalLink: (linkId, patch) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        causalLinks: (state.scenario.causalLinks ?? []).map((l) =>
          l.id === linkId ? { ...l, ...patch } : l,
        ),
      },
      isDirty: true,
    })),

  updateNodePositions: (positions) =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        nodePositions: { ...(state.scenario.nodePositions ?? {}), ...positions },
      },
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

      // Run sensitivity analysis in background (non-blocking)
      api.runSensitivityAnalysis(scenario, result.winProbability).then(
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
