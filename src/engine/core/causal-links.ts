/**
 * Causal Links Engine — Meadows-style system dynamics.
 * Compiles causal links into a dependency graph and resolves effects per timestep.
 */
import type { CausalLink } from "../schema";
import { type RNG, normalSample } from "./rng";

export interface CompiledCausalGraph {
  /** Target variable IDs in topological order */
  order: string[];
  /** Links grouped by target variable ID */
  linksByTarget: Map<string, CausalLink[]>;
}

/**
 * Compile causal links into a dependency graph with topological ordering.
 * Throws if a cycle is detected.
 */
export function compileCausalGraph(
  links: CausalLink[],
  variableIds: Set<string>,
): CompiledCausalGraph {
  // Group links by target
  const linksByTarget = new Map<string, CausalLink[]>();
  for (const link of links) {
    if (!variableIds.has(link.sourceId) || !variableIds.has(link.targetId)) {
      continue; // Skip links referencing unknown variables
    }
    const existing = linksByTarget.get(link.targetId);
    if (existing) {
      existing.push(link);
    } else {
      linksByTarget.set(link.targetId, [link]);
    }
  }

  // Build adjacency for topological sort (source → targets)
  const adjacency = new Map<string, Set<string>>();
  for (const link of links) {
    if (!variableIds.has(link.sourceId) || !variableIds.has(link.targetId)) continue;
    const targets = adjacency.get(link.sourceId);
    if (targets) {
      targets.add(link.targetId);
    } else {
      adjacency.set(link.sourceId, new Set([link.targetId]));
    }
  }

  // Topological sort using Kahn's algorithm on target variables only
  const targetIds = new Set(linksByTarget.keys());
  const inDegree = new Map<string, number>();

  for (const targetId of targetIds) {
    inDegree.set(targetId, 0);
  }

  // Count in-degrees: for each target, count how many of its sources are also targets
  for (const targetId of targetIds) {
    const incomingLinks = linksByTarget.get(targetId)!;
    for (const link of incomingLinks) {
      if (targetIds.has(link.sourceId)) {
        inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    // For each target that depends on current (current is a source for those targets)
    const targets = adjacency.get(current);
    if (targets) {
      for (const targetId of targets) {
        if (!targetIds.has(targetId)) continue;
        const newDegree = (inDegree.get(targetId) ?? 1) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0) queue.push(targetId);
      }
    }
  }

  if (order.length < targetIds.size) {
    throw new Error(
      "Causal link cycle detected. Remove circular dependencies between variables.",
    );
  }

  return { order, linksByTarget };
}

/**
 * Apply causal links to compute the adjusted value for a target variable.
 *
 * The effect model: for each incoming link, compute how much the source has
 * deviated from its base value (as a ratio), multiply by strength and polarity,
 * and apply as a multiplicative adjustment to the target.
 *
 * Example: Ad Spend base=10000, current=12000, link strength=0.5, polarity=positive
 * → delta = (12000-10000)/10000 = 0.2
 * → adjustment = 0.2 * 0.5 * 1 = 0.1
 * → target *= 1.1 (10% increase)
 */
export function applyCausalLinks(
  targetId: string,
  baseResolvedValue: number,
  linksByTarget: Map<string, CausalLink[]>,
  resolvedValues: Map<string, number>,
  baseValues: Map<string, number>,
  history: Map<string, number[]>,
  rng: RNG,
): number {
  const links = linksByTarget.get(targetId);
  if (!links || links.length === 0) return baseResolvedValue;

  let value = baseResolvedValue;

  for (const link of links) {
    // Get source value — use delayed value if delay > 0
    let sourceValue: number;
    if (link.delay > 0) {
      const hist = history.get(link.sourceId);
      if (hist && hist.length >= link.delay) {
        sourceValue = hist[hist.length - link.delay];
      } else {
        // Not enough history yet — use base value (no effect)
        continue;
      }
    } else {
      sourceValue = resolvedValues.get(link.sourceId) ?? 0;
    }

    const sourceBase = baseValues.get(link.sourceId) ?? 0;
    if (sourceBase === 0) continue; // Can't compute relative delta from zero base

    const delta = (sourceValue - sourceBase) / sourceBase;
    const polaritySign = link.polarity === "positive" ? 1 : -1;
    let adjustment = delta * link.strength * polaritySign;

    if (link.noise > 0) {
      adjustment += normalSample(rng, 0, link.noise);
    }

    value *= 1 + adjustment;
  }

  return value;
}
