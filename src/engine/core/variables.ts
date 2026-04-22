import type { Variable } from "../schema";
import {
  type RNG,
  normalSample,
  lognormalSample,
  uniformSample,
  triangularSample,
} from "./rng";

/**
 * Resolve a single variable's value at period t.
 * Does NOT handle kind === "formula" — those are resolved in a second pass.
 */
export function resolveVariable(v: Variable, t: number, rng: RNG): number {
  switch (v.kind) {
    case "constant":
      return v.baseValue;

    case "linear_trend":
      return v.baseValue + (v.rate ?? 0) * t;

    case "exponential":
      return v.baseValue * Math.pow(1 + (v.rate ?? 0), t);

    case "step":
      return t >= (v.changeAt ?? 0) ? (v.newValue ?? v.baseValue) : v.baseValue;

    case "seasonal": {
      const amp = v.amplitude ?? 0;
      const p = v.period ?? 12;
      return v.baseValue + amp * Math.sin((2 * Math.PI * t) / p);
    }

    case "stochastic":
      return sampleDistribution(v, rng);

    case "piecewise": {
      const s = v.series;
      if (!s || s.length === 0) return v.baseValue;
      return t < s.length ? s[t] : s[s.length - 1];
    }

    case "elasticity":
      // Elasticity variables are resolved during flow computation
      // where the reference price is available. Return baseValue as default.
      return v.baseValue;

    case "formula":
      // Formula variables are resolved in the second pass
      return 0;
  }
}

function sampleDistribution(v: Variable, rng: RNG): number {
  const p = v.distributionParams ?? {};
  switch (v.distribution) {
    case "normal":
      return normalSample(rng, p.mean ?? v.baseValue, p.stddev ?? 0);
    case "lognormal":
      return lognormalSample(rng, p.mu ?? Math.log(v.baseValue), p.sigma ?? 0);
    case "uniform":
      return uniformSample(rng, p.min ?? v.baseValue * 0.8, p.max ?? v.baseValue * 1.2);
    case "triangular":
      return triangularSample(
        rng,
        p.min ?? v.baseValue * 0.8,
        p.max ?? v.baseValue * 1.2,
        p.mode ?? v.baseValue
      );
    case "bernoulli":
      return rng() < (p.p ?? 0.5) ? 1 : 0;
    default:
      return v.baseValue;
  }
}
