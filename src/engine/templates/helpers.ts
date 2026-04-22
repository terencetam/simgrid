import type { Variable } from "../schema";

export function mkVar(
  id: string,
  name: string,
  baseValue: number,
  overrides?: Partial<Variable>
): Variable {
  return {
    id,
    name,
    kind: "constant",
    baseValue,
    resampleEachPeriod: true,
    ...overrides,
  };
}
