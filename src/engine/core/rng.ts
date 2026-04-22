/**
 * Seedable PRNG — mulberry32.
 * Fast, deterministic, good enough distribution for Monte Carlo.
 */
export type RNG = () => number;

export function makeRng(seed: number): RNG {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform: uniform → standard normal */
export function normalSample(rng: RNG, mean: number, stddev: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

export function lognormalSample(
  rng: RNG,
  mu: number,
  sigma: number
): number {
  return Math.exp(normalSample(rng, mu, sigma));
}

export function uniformSample(rng: RNG, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function triangularSample(
  rng: RNG,
  min: number,
  max: number,
  mode: number
): number {
  const u = rng();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function bernoulliSample(rng: RNG, p: number): boolean {
  return rng() < p;
}
