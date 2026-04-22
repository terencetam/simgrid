/**
 * Sensitivity (tornado) analysis.
 * Measures marginal impact of lever changes on win probability.
 */
import type { Scenario, Variable } from "../schema";
import { monteCarlo } from "../montecarlo";

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
 * Find all adjustable variables in a scenario (levers).
 */
function findLevers(scenario: Scenario): { id: string; label: string; var: Variable; path: string }[] {
  const levers: { id: string; label: string; var: Variable; path: string }[] = [];

  for (const p of scenario.products) {
    levers.push({ id: p.price.id, label: `${p.name} price`, var: p.price, path: "products" });
  }
  for (const seg of scenario.segments) {
    levers.push({ id: seg.churnRate.id, label: `${seg.name} churn`, var: seg.churnRate, path: "segments" });
    levers.push({ id: seg.acv.id, label: `${seg.name} ACV`, var: seg.acv, path: "segments" });
  }
  for (const ad of scenario.adChannels) {
    levers.push({ id: ad.spend.id, label: `${ad.name} spend`, var: ad.spend, path: "adChannels" });
    levers.push({ id: ad.cac.id, label: `${ad.name} CAC`, var: ad.cac, path: "adChannels" });
  }
  for (const ch of scenario.channels) {
    levers.push({ id: ch.conversionRate.id, label: `${ch.name} conv. rate`, var: ch.conversionRate, path: "channels" });
  }

  return levers;
}

/**
 * Create a scenario clone with one variable's baseValue adjusted.
 */
function adjustScenario(scenario: Scenario, varId: string, newValue: number): Scenario {
  const s = structuredClone(scenario);

  const adjustVar = (v: Variable) => {
    if (v.id === varId) v.baseValue = newValue;
  };

  for (const p of s.products) { adjustVar(p.price); adjustVar(p.unitCogs); }
  for (const seg of s.segments) { adjustVar(seg.tam); adjustVar(seg.ourShare); adjustVar(seg.churnRate); adjustVar(seg.acv); }
  for (const ad of s.adChannels) { adjustVar(ad.spend); adjustVar(ad.cac); }
  for (const ch of s.channels) { adjustVar(ch.capacityPerPeriod); adjustVar(ch.conversionRate); adjustVar(ch.fixedCost); adjustVar(ch.variableCostPct); }
  for (const sr of s.salesRoles) { adjustVar(sr.fullyLoadedCost); adjustVar(sr.quota); adjustVar(sr.quotaHitProbability); }

  return s;
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
  const levers = findLevers(scenario);
  const results: SensitivityResult[] = [];

  for (const lever of levers) {
    const base = lever.var.baseValue;
    if (base === 0) continue;

    const downScenario = adjustScenario(scenario, lever.id, base * (1 - pct));
    const upScenario = adjustScenario(scenario, lever.id, base * (1 + pct));

    const downResult = monteCarlo(downScenario, runsPerScenario, seed, undefined, 0);
    const upResult = monteCarlo(upScenario, runsPerScenario, seed, undefined, 0);

    const winDown = downResult.result.winProbability;
    const winUp = upResult.result.winProbability;

    results.push({
      variableId: lever.id,
      label: lever.label,
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
