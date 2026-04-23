/**
 * Sensitivity (tornado) analysis.
 * Measures marginal impact of lever changes on win probability.
 */
import type { Scenario } from "../schema";
import { monteCarlo } from "../montecarlo";

export interface SensitivityResult {
  variableId: string;
  label: string;
  winProbDown: number;
  winProbUp: number;
  impact: number;
  baseWinProb: number;
}

export interface TornadoResult {
  baseWinProb: number;
  levers: SensitivityResult[];
  suggestedMove: {
    variableId: string;
    label: string;
    direction: "up" | "down";
    newWinProb: number;
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
  baseWinProb: number,
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
      winProbDown: downResult.result.winProbability,
      winProbUp: upResult.result.winProbability,
      impact: Math.abs(
        upResult.result.winProbability - downResult.result.winProbability
      ),
      baseWinProb,
    });
  }

  results.sort((a, b) => b.impact - a.impact);

  let suggestedMove: TornadoResult["suggestedMove"] = null;
  let bestWinProb = baseWinProb;

  for (const r of results) {
    if (r.winProbUp > bestWinProb) {
      bestWinProb = r.winProbUp;
      suggestedMove = {
        variableId: r.variableId,
        label: r.label,
        direction: "up",
        newWinProb: r.winProbUp,
      };
    }
    if (r.winProbDown > bestWinProb) {
      bestWinProb = r.winProbDown;
      suggestedMove = {
        variableId: r.variableId,
        label: r.label,
        direction: "down",
        newWinProb: r.winProbDown,
      };
    }
  }

  return { baseWinProb, levers: results, suggestedMove };
}
