/**
 * Sensitivity (tornado) analysis.
 * Measures marginal impact of lever changes on win probability.
 */
import type { Scenario } from "../schema";
import { monteCarlo } from "../montecarlo";
import { collectVariables, patchVariable } from "./variable-registry";

export interface SensitivityResult {
  /** Lever variable ID */
  variableId: string;
  /** Display label */
  label: string;
  /** Win probability when lever moved down by pct */
  winProbDown: number;
  /** Win probability when lever moved up by pct */
  winProbUp: number;
  /** Absolute impact = |up - down| */
  impact: number;
  /** Base win probability */
  baseWinProb: number;
}

export interface TornadoResult {
  baseWinProb: number;
  levers: SensitivityResult[];
  /** The single lever change with highest marginal win-probability improvement */
  suggestedMove: { variableId: string; label: string; direction: "up" | "down"; newWinProb: number } | null;
}

/**
 * Run tornado sensitivity analysis.
 * @param pct - percentage to move each lever (default 10%)
 * @param runsPerScenario - MC runs per variant (default 200 for speed)
 */
export function runSensitivity(
  scenario: Scenario,
  baseWinProb: number,
  pct: number = 0.1,
  runsPerScenario: number = 200,
  seed: number = 42,
): TornadoResult {
  const allVars = collectVariables(scenario);
  const results: SensitivityResult[] = [];

  for (const [, regVar] of allVars) {
    const v = regVar.variable;
    const base = v.baseValue;
    if (base === 0) continue;

    const downScenario = patchVariable(scenario, v.id, base * (1 - pct));
    const upScenario = patchVariable(scenario, v.id, base * (1 + pct));

    const downResult = monteCarlo(downScenario, runsPerScenario, seed, undefined, 0);
    const upResult = monteCarlo(upScenario, runsPerScenario, seed, undefined, 0);

    const winDown = downResult.result.winProbability;
    const winUp = upResult.result.winProbability;

    results.push({
      variableId: v.id,
      label: `${regVar.primitiveName} ${v.name}`,
      winProbDown: winDown,
      winProbUp: winUp,
      impact: Math.abs(winUp - winDown),
      baseWinProb,
    });
  }

  // Sort by impact descending
  results.sort((a, b) => b.impact - a.impact);

  // Find suggested move: which single change gives highest win probability
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
