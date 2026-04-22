import { create } from "zustand";
import type { Scenario, MonteCarloResult } from "@/engine/schema";
import { saasStartup } from "@/engine/templates/saas-startup";
import { monteCarlo } from "@/engine/montecarlo";

interface ScenarioState {
  scenario: Scenario;
  result: MonteCarloResult | null;
  isRunning: boolean;
  nRuns: number;

  /** Update a top-level scenario field */
  updateScenario: (patch: Partial<Scenario>) => void;

  /** Update a variable's baseValue by variable ID (searches all primitives) */
  updateVariable: (variableId: string, baseValue: number) => void;

  /** Run Monte Carlo simulation */
  runSimulation: () => void;
}

function patchVariableInScenario(
  scenario: Scenario,
  variableId: string,
  baseValue: number
): Scenario {
  const s = structuredClone(scenario);

  // Search products
  for (const p of s.products) {
    if (p.price.id === variableId) p.price.baseValue = baseValue;
    if (p.unitCogs.id === variableId) p.unitCogs.baseValue = baseValue;
  }

  // Search segments
  for (const seg of s.segments) {
    if (seg.tam.id === variableId) seg.tam.baseValue = baseValue;
    if (seg.ourShare.id === variableId) seg.ourShare.baseValue = baseValue;
    if (seg.churnRate.id === variableId) seg.churnRate.baseValue = baseValue;
    if (seg.acv.id === variableId) seg.acv.baseValue = baseValue;
  }

  // Search ad channels
  for (const ad of s.adChannels) {
    if (ad.spend.id === variableId) ad.spend.baseValue = baseValue;
    if (ad.cac.id === variableId) ad.cac.baseValue = baseValue;
  }

  // Search sales roles
  for (const sr of s.salesRoles) {
    if (sr.fullyLoadedCost.id === variableId) sr.fullyLoadedCost.baseValue = baseValue;
    if (sr.quota.id === variableId) sr.quota.baseValue = baseValue;
    if (sr.quotaHitProbability.id === variableId) sr.quotaHitProbability.baseValue = baseValue;
  }

  // Search channels
  for (const ch of s.channels) {
    if (ch.capacityPerPeriod.id === variableId) ch.capacityPerPeriod.baseValue = baseValue;
    if (ch.conversionRate.id === variableId) ch.conversionRate.baseValue = baseValue;
  }

  return s;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenario: saasStartup,
  result: null,
  isRunning: false,
  nRuns: 500,

  updateScenario: (patch) =>
    set((state) => ({
      scenario: { ...state.scenario, ...patch },
    })),

  updateVariable: (variableId, baseValue) =>
    set((state) => ({
      scenario: patchVariableInScenario(state.scenario, variableId, baseValue),
    })),

  runSimulation: () => {
    set({ isRunning: true });
    // Use setTimeout to let React paint the "running" state
    setTimeout(() => {
      const { scenario, nRuns } = get();
      const result = monteCarlo(scenario, nRuns);
      set({ result, isRunning: false });
    }, 16);
  },
}));
