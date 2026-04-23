import type { Scenario, ModelVariable, Distribution } from "./schema";
import type { RNG } from "./core/rng";
import {
  normalSample,
  lognormalSample,
  uniformSample,
  triangularSample,
} from "./core/rng";
import { compile, topologicalSort, type CompiledFormula } from "./core/evaluator";

// ─── Compiled scenario (pre-computed for fast MC runs) ───────────

export interface CompiledScenario {
  scenario: Scenario;
  inputs: ModelVariable[];
  sortedFormulaIds: string[];
  compiledFormulas: Map<string, CompiledFormula>;
  formulaVars: Map<string, ModelVariable>;
  chartVarIds: Map<string, string>; // chartMetric → variableId
}

export function compileScenario(scenario: Scenario): CompiledScenario {
  const inputs = scenario.variables.filter((v) => v.kind === "input");
  const formulaVars = scenario.variables.filter((v) => v.kind === "formula");

  // Compile all formulas
  const compiledFormulas = new Map<string, CompiledFormula>();
  const formulaVarMap = new Map<string, ModelVariable>();
  for (const v of formulaVars) {
    compiledFormulas.set(v.id, compile(v.formula ?? "0"));
    formulaVarMap.set(v.id, v);
  }

  // Topological sort
  const inputIds = new Set(inputs.map((v) => v.id));
  const toSort = formulaVars.map((v) => ({
    id: v.id,
    currentDeps: compiledFormulas.get(v.id)!.currentDeps,
  }));
  const sortedFormulaIds = topologicalSort(toSort, inputIds);

  // Map chart metrics to variable IDs
  const chartVarIds = new Map<string, string>();
  for (const v of scenario.variables) {
    if (v.chartMetric) chartVarIds.set(v.chartMetric, v.id);
  }

  return {
    scenario,
    inputs,
    sortedFormulaIds,
    compiledFormulas,
    formulaVars: formulaVarMap,
    chartVarIds,
  };
}

// ─── Distribution sampling ───────────────────────────────────────

function sampleDistribution(
  dist: Distribution,
  baseValue: number,
  rng: RNG
): number {
  switch (dist.kind) {
    case "normal":
      return normalSample(
        rng,
        dist.params.mean ?? baseValue,
        dist.params.stddev ?? 0
      );
    case "lognormal":
      return lognormalSample(
        rng,
        dist.params.mu ?? Math.log(baseValue),
        dist.params.sigma ?? 0.1
      );
    case "uniform":
      return uniformSample(
        rng,
        dist.params.min ?? baseValue * 0.8,
        dist.params.max ?? baseValue * 1.2
      );
    case "triangular":
      return triangularSample(
        rng,
        dist.params.min ?? baseValue * 0.8,
        dist.params.max ?? baseValue * 1.2,
        dist.params.mode ?? baseValue
      );
    case "bernoulli":
      return rng() < (dist.params.p ?? 0.5) ? 1 : 0;
  }
}

// ─── Single simulation run ───────────────────────────────────────

export interface RunResult {
  series: Map<string, number[]>;
}

export function simulateRun(
  compiled: CompiledScenario,
  rng: RNG
): RunResult {
  const T = compiled.scenario.horizonPeriods;
  const series = new Map<string, number[]>();

  // Initialize series arrays for all variables
  for (const v of compiled.scenario.variables) {
    series.set(v.id, new Array(T));
  }

  const currentValues = new Map<string, number>();
  const prevValues = new Map<string, number>();

  // Initialize prev values from initialValue or baseValue or 0
  for (const v of compiled.scenario.variables) {
    prevValues.set(v.id, v.initialValue ?? v.baseValue ?? 0);
  }

  for (let t = 0; t < T; t++) {
    // Pass 1: Resolve all inputs (sample distributions for stochastic)
    for (const v of compiled.inputs) {
      let value = v.baseValue ?? 0;
      if (v.distribution) {
        value = sampleDistribution(v.distribution, value, rng);
      }
      currentValues.set(v.id, value);
      series.get(v.id)![t] = value;
    }

    // Pass 2: Evaluate formulas in topological order
    for (const id of compiled.sortedFormulaIds) {
      const formula = compiled.compiledFormulas.get(id)!;
      const value = formula.evaluate(currentValues, prevValues);
      currentValues.set(id, value);
      series.get(id)![t] = value;
    }

    // Copy current → prev for next iteration
    for (const [id, val] of currentValues) {
      prevValues.set(id, val);
    }
  }

  return { series };
}
