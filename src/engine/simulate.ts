import type { Scenario, Variable } from "./schema";
import { type RNG, bernoulliSample } from "./core/rng";
import { resolveVariable } from "./core/variables";

/**
 * RunBuffers holds the time-series data for a single simulation run.
 * All values are plain arrays for Phase 1; upgrade to TypedArrays in Phase 2.
 */
export interface RunBuffers {
  revenue: number[];
  cogs: number[];
  opex: number[];
  profit: number[];
  cash: number[];
  customers: number[];
  /** Per-channel new customers acquired this period */
  newCustomers: number[];
  /** For unit economics */
  totalAdSpend: number[];
}

export function allocateBuffers(T: number): RunBuffers {
  return {
    revenue: new Array(T).fill(0),
    cogs: new Array(T).fill(0),
    opex: new Array(T).fill(0),
    profit: new Array(T).fill(0),
    cash: new Array(T).fill(0),
    customers: new Array(T).fill(0),
    newCustomers: new Array(T).fill(0),
    totalAdSpend: new Array(T).fill(0),
  };
}

function resolveVar(v: Variable, t: number, rng: RNG): number {
  return resolveVariable(v, t, rng);
}

/**
 * Run a single simulation of the scenario. Mutates `buffers`.
 */
export function simulateRun(
  scenario: Scenario,
  buffers: RunBuffers,
  rng: RNG
): void {
  const T = scenario.horizonPeriods;
  let cash = scenario.startingCash;
  let totalCustomers = 0;

  // Pre-compute segment starting customers
  for (const seg of scenario.segments) {
    totalCustomers += resolveVar(seg.ourShare, 0, rng);
  }

  for (let t = 0; t < T; t++) {
    let periodRevenue = 0;
    let periodCogs = 0;
    let periodOpex = 0;
    let periodNewCustomers = 0;
    let periodAdSpend = 0;

    // ── Products: direct revenue from channels ──
    for (const product of scenario.products) {
      if (t < product.launchPeriod) continue;
      const price = resolveVar(product.price, t, rng);
      const unitCogs = resolveVar(product.unitCogs, t, rng);

      // Units come from channels
      let totalUnits = 0;
      for (const channel of scenario.channels) {
        const capacity = resolveVar(channel.capacityPerPeriod, t, rng);
        const conversion = resolveVar(channel.conversionRate, t, rng);
        // Apply ramp curve
        const rampIdx = Math.min(t, channel.rampCurve.length - 1);
        const rampFactor = channel.rampCurve[rampIdx];
        const units = capacity * conversion * rampFactor;
        totalUnits += units;

        // Channel costs
        const fixedCost = resolveVar(channel.fixedCost, t, rng);
        const varPct = resolveVar(channel.variableCostPct, t, rng);
        periodOpex += fixedCost + units * price * varPct;
      }

      periodRevenue += totalUnits * price;
      periodCogs += totalUnits * unitCogs;
    }

    // ── Segments: subscription / cohort revenue ──
    for (const seg of scenario.segments) {
      const churn = resolveVar(seg.churnRate, t, rng);
      const acv = resolveVar(seg.acv, t, rng);

      // New customers from ad channels
      let newCusts = 0;
      for (const ad of scenario.adChannels) {
        const spend = resolveVar(ad.spend, t, rng);
        const cac = resolveVar(ad.cac, t, rng);
        if (cac > 0) {
          newCusts += spend / cac;
        }
        periodAdSpend += spend;
        periodOpex += spend;
      }

      // New customers from sales roles
      for (const role of scenario.salesRoles) {
        const rampIdx = Math.min(t, role.rampCurve.length - 1);
        const rampFactor = role.rampCurve[rampIdx];
        const quota = resolveVar(role.quota, t, rng);
        const hitProb = resolveVar(role.quotaHitProbability, t, rng);

        let activeReps = role.count;
        // Attrition check per rep
        const attrProb = resolveVar(role.attritionProbPerPeriod, t, rng);
        for (let r = 0; r < role.count; r++) {
          if (bernoulliSample(rng, attrProb)) activeReps--;
        }

        for (let r = 0; r < activeReps; r++) {
          if (bernoulliSample(rng, hitProb)) {
            newCusts += quota * rampFactor;
          }
        }

        periodOpex += activeReps * resolveVar(role.fullyLoadedCost, t, rng);
      }

      // TAM constraint
      const tam = resolveVar(seg.tam, t, rng);
      const maxNew = Math.max(0, tam - totalCustomers);
      newCusts = Math.min(newCusts, maxNew);

      // Apply churn
      const churned = totalCustomers * churn;
      totalCustomers = totalCustomers - churned + newCusts;
      periodNewCustomers += newCusts;

      // Revenue from customer base (monthly fraction of ACV)
      periodRevenue += totalCustomers * (acv / 12);
    }

    // ── Stores ──
    for (const store of scenario.stores) {
      let activeCount = store.count;
      // Add from opening schedule
      for (const [period, count] of store.openingSchedule) {
        if (t >= period) activeCount += count;
      }
      const fixedCost = resolveVar(store.fixedCostPerUnit, t, rng);
      periodOpex += activeCount * fixedCost;

      // Store revenue cap already factored via channels typically
    }

    // ── Headcount ──
    for (const hc of scenario.otherHeadcount) {
      const salary = resolveVar(hc.salary, t, rng);
      periodOpex += hc.count * salary * hc.onCostsMultiplier;
    }

    // ── Events ──
    for (const evt of scenario.events) {
      let triggered = false;
      switch (evt.trigger.kind) {
        case "bernoulli":
          triggered = bernoulliSample(rng, evt.trigger.probability ?? 0);
          break;
        case "scheduled":
          triggered = t === (evt.trigger.period ?? -1);
          break;
        case "conditional":
          // Simplified: skip for Phase 1
          break;
      }
      if (triggered) {
        for (const eff of evt.effects) {
          // Apply effects to the current period
          if (eff.targetId === "revenue") {
            if (eff.operation === "multiply") periodRevenue *= eff.value;
            else if (eff.operation === "add") periodRevenue += eff.value;
          } else if (eff.targetId === "opex") {
            if (eff.operation === "multiply") periodOpex *= eff.value;
            else if (eff.operation === "add") periodOpex += eff.value;
          }
        }
      }
    }

    // ── Scaling cost triggers ──
    for (const sc of scenario.scalingCosts) {
      let metricValue = 0;
      if (sc.triggerMetric === "customers") metricValue = totalCustomers;
      else if (sc.triggerMetric === "revenue") metricValue = periodRevenue;

      if (metricValue >= sc.threshold) {
        const amount = resolveVar(sc.amount, t, rng);
        if (sc.costType === "recurring") {
          periodOpex += amount;
        } else if (sc.costType === "one_time" && t === 0) {
          // Simplified: only apply once in the period where threshold is first met
          // TODO: track if already triggered
          periodOpex += amount;
        }
      }
    }

    // ── Fixed assets: depreciation ──
    let depreciation = 0;
    for (const asset of scenario.fixedAssets) {
      const cost = resolveVar(asset.purchaseCost, 0, rng);
      if (asset.usefulLifeMonths > 0) {
        depreciation += cost / asset.usefulLifeMonths;
      }
    }

    // ── Debt facilities: interest ──
    let interestExpense = 0;
    for (const debt of scenario.debtFacilities) {
      const monthlyRate = debt.interestRate / 12;
      interestExpense += debt.principal * monthlyRate;
    }

    // ── Compute financials ──
    const grossProfit = periodRevenue - periodCogs;
    const ebitda = grossProfit - periodOpex;
    const ebit = ebitda - depreciation;
    const preTaxProfit = ebit - interestExpense;
    const tax = scenario.taxRate > 0 ? Math.max(0, preTaxProfit * scenario.taxRate) : 0;
    const netIncome = preTaxProfit - tax;

    cash += netIncome;

    // ── Record ──
    buffers.revenue[t] = periodRevenue;
    buffers.cogs[t] = periodCogs;
    buffers.opex[t] = periodOpex;
    buffers.profit[t] = netIncome;
    buffers.cash[t] = cash;
    buffers.customers[t] = totalCustomers;
    buffers.newCustomers[t] = periodNewCustomers;
    buffers.totalAdSpend[t] = periodAdSpend;
  }
}
