/**
 * Sensitivity (tornado) analysis.
 * Measures marginal impact of lever changes on survival rate.
 */
import type { Scenario } from "../schema";
import { monteCarlo } from "../montecarlo";

export interface SensitivityResult {
  variableId: string;
  label: string;
  survivalDown: number;
  survivalUp: number;
  impact: number;
  baseSurvivalRate: number;
}

export interface TornadoResult {
  baseSurvivalRate: number;
  levers: SensitivityResult[];
  suggestedMove: {
    variableId: string;
    label: string;
    direction: "up" | "down";
    newSurvivalRate: number;
  } | null;
}

function patchVariable(
  scenario: Scenario,
  varId: string,
  newBaseValue: number
): Scenario {
  return {
    ...scenario,
    variables: scenario.variables.map((v) =>
      v.id === varId ? { ...v, baseValue: newBaseValue } : v
    ),
  };
}

export function runSensitivity(
  scenario: Scenario,
  baseSurvivalRate: number,
  pct: number = 0.1,
  runsPerScenario: number = 200,
  seed: number = 42
): TornadoResult {
  const inputs = scenario.variables.filter(
    (v) => v.kind === "input" && v.isLever && (v.baseValue ?? 0) !== 0
  );
  const results: SensitivityResult[] = [];

  for (const v of inputs) {
    const base = v.baseValue ?? 0;

    const downScenario = patchVariable(scenario, v.id, base * (1 - pct));
    const upScenario = patchVariable(scenario, v.id, base * (1 + pct));

    const downResult = monteCarlo(downScenario, runsPerScenario, seed, undefined, 0);
    const upResult = monteCarlo(upScenario, runsPerScenario, seed, undefined, 0);

    results.push({
      variableId: v.id,
      label: v.name,
      survivalDown: downResult.result.survivalRate,
      survivalUp: upResult.result.survivalRate,
      impact: Math.abs(
        upResult.result.survivalRate - downResult.result.survivalRate
      ),
      baseSurvivalRate,
    });
  }

  results.sort((a, b) => b.impact - a.impact);

  let suggestedMove: TornadoResult["suggestedMove"] = null;
  let bestSurvival = baseSurvivalRate;

  for (const r of results) {
    if (r.survivalUp > bestSurvival) {
      bestSurvival = r.survivalUp;
      suggestedMove = {
        variableId: r.variableId,
        label: r.label,
        direction: "up",
        newSurvivalRate: r.survivalUp,
      };
    }
    if (r.survivalDown > bestSurvival) {
      bestSurvival = r.survivalDown;
      suggestedMove = {
        variableId: r.variableId,
        label: r.label,
        direction: "down",
        newSurvivalRate: r.survivalDown,
      };
    }
  }

  return { baseSurvivalRate, levers: results, suggestedMove };
}
