import type { Scenario, Variable } from "./schema";
import { type RNG, bernoulliSample } from "./core/rng";
import { resolveVariable } from "./core/variables";
import {
  type FinancialBuffers,
  type PeriodFlows,
  type WorkingCapitalParams,
  allocateFinancialBuffers,
  derivePeriodFinancials,
  recordFinancials,
} from "./core/financials";
import { applyConstraints, prepareConstraints } from "./core/constraints";

/**
 * RunBuffers holds the time-series data for a single simulation run.
 */
export interface RunBuffers {
  revenue: number[];
  cogs: number[];
  opex: number[];
  profit: number[];
  cash: number[];
  customers: number[];
  newCustomers: number[];
  totalAdSpend: number[];
  // Detailed OpEx breakdown
  salaries: number[];
  marketing: number[];
  rent: number[];
  recruitmentCosts: number[];
  // For unit economics
  totalSalesCost: number[];
  totalHeadcount: number[];
  // Financial statements
  financials: FinancialBuffers;
  // Constraint binding log: constraintId → count of periods binding
  bindingLog: Record<string, number>;
}

export function allocateBuffers(T: number): RunBuffers {
  const arr = () => new Array(T).fill(0);
  return {
    revenue: arr(),
    cogs: arr(),
    opex: arr(),
    profit: arr(),
    cash: arr(),
    customers: arr(),
    newCustomers: arr(),
    totalAdSpend: arr(),
    salaries: arr(),
    marketing: arr(),
    rent: arr(),
    recruitmentCosts: arr(),
    totalSalesCost: arr(),
    totalHeadcount: arr(),
    financials: allocateFinancialBuffers(T),
    bindingLog: {},
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

  // Working capital params
  const wc: WorkingCapitalParams = {
    dso: scenario.paymentTerms.dso,
    dpo: scenario.paymentTerms.dpo,
    dio: scenario.paymentTerms.dio,
  };

  // Previous-period balance sheet balances for CF derivation
  let prevBalances = {
    ar: 0, ap: 0, inventory: 0, deferredRevenue: 0,
    accDepreciation: 0, debt: 0, retainedEarnings: 0,
  };

  // Track cumulative fixed asset gross value
  let cumulativeCapex = 0;

  // Track which scaling costs have fired (for one_time triggers)
  const scalingTriggered = new Set<string>();

  // Initial debt outstanding
  let totalDebtOutstanding = 0;
  for (const debt of scenario.debtFacilities) {
    totalDebtOutstanding += debt.principal;
  }
  prevBalances.debt = totalDebtOutstanding;

  // Prepare constraints
  const constraintChecks = prepareConstraints(scenario.constraints);

  // Pre-compute segment starting customers
  for (const seg of scenario.segments) {
    totalCustomers += resolveVar(seg.ourShare, 0, rng);
  }

  for (let t = 0; t < T; t++) {
    let periodRevenue = 0;
    let periodCogs = 0;
    let periodSalaries = 0;
    let periodMarketing = 0;
    let periodRent = 0;
    let periodRecruitment = 0;
    let periodOtherOpex = 0;
    let periodNewCustomers = 0;
    let periodAdSpend = 0;
    let periodSalesCost = 0;
    let periodHeadcount = 0;

    // ── Products: direct revenue from channels ──
    for (const product of scenario.products) {
      if (t < product.launchPeriod) continue;
      const price = resolveVar(product.price, t, rng);
      const unitCogs = resolveVar(product.unitCogs, t, rng);

      let totalUnits = 0;
      for (const channel of scenario.channels) {
        const capacity = resolveVar(channel.capacityPerPeriod, t, rng);
        const conversion = resolveVar(channel.conversionRate, t, rng);
        const rampIdx = Math.min(t, channel.rampCurve.length - 1);
        const rampFactor = channel.rampCurve[rampIdx];
        const units = capacity * conversion * rampFactor;
        totalUnits += units;

        const fixedCost = resolveVar(channel.fixedCost, t, rng);
        const varPct = resolveVar(channel.variableCostPct, t, rng);
        periodOtherOpex += fixedCost + units * price * varPct;
      }

      periodRevenue += totalUnits * price;
      periodCogs += totalUnits * unitCogs;
    }

    // ── Segments: subscription / cohort revenue ──
    for (const seg of scenario.segments) {
      const churn = resolveVar(seg.churnRate, t, rng);
      const acv = resolveVar(seg.acv, t, rng);

      let newCusts = 0;
      for (const ad of scenario.adChannels) {
        const spend = resolveVar(ad.spend, t, rng);
        const cac = resolveVar(ad.cac, t, rng);
        if (cac > 0) {
          newCusts += spend / cac;
        }
        periodAdSpend += spend;
        periodMarketing += spend;
      }

      for (const role of scenario.salesRoles) {
        const rampIdx = Math.min(t, role.rampCurve.length - 1);
        const rampFactor = role.rampCurve[rampIdx];
        const quota = resolveVar(role.quota, t, rng);
        const hitProb = resolveVar(role.quotaHitProbability, t, rng);

        let activeReps = role.count;
        const attrProb = resolveVar(role.attritionProbPerPeriod, t, rng);
        for (let r = 0; r < role.count; r++) {
          if (bernoulliSample(rng, attrProb)) activeReps--;
        }

        for (let r = 0; r < activeReps; r++) {
          if (bernoulliSample(rng, hitProb)) {
            newCusts += quota * rampFactor;
          }
        }

        const repCost = activeReps * resolveVar(role.fullyLoadedCost, t, rng);
        periodSalaries += repCost;
        periodSalesCost += repCost;
        periodHeadcount += activeReps;
      }

      // TAM constraint
      const tam = resolveVar(seg.tam, t, rng);
      const maxNew = Math.max(0, tam - totalCustomers);
      newCusts = Math.min(newCusts, maxNew);

      const churned = totalCustomers * churn;
      totalCustomers = totalCustomers - churned + newCusts;
      periodNewCustomers += newCusts;

      periodRevenue += totalCustomers * (acv / 12);
    }

    // ── Stores ──
    for (const store of scenario.stores) {
      let activeCount = store.count;
      for (const [period, count] of store.openingSchedule) {
        if (t >= period) activeCount += count;
      }
      const fixedCost = resolveVar(store.fixedCostPerUnit, t, rng);
      periodRent += activeCount * fixedCost;
    }

    // ── Headcount ──
    for (const hc of scenario.otherHeadcount) {
      const salary = resolveVar(hc.salary, t, rng);
      periodSalaries += hc.count * salary * hc.onCostsMultiplier;
      periodHeadcount += hc.count;

      // Recruitment costs (one-time per period increase; simplified as first-period cost)
      if (t === 0 && hc.recruitmentCostPerHire > 0) {
        periodRecruitment += hc.count * hc.recruitmentCostPerHire;
      }
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
          break;
      }
      if (triggered) {
        for (const eff of evt.effects) {
          if (eff.targetId === "revenue") {
            if (eff.operation === "multiply") periodRevenue *= eff.value;
            else if (eff.operation === "add") periodRevenue += eff.value;
          } else if (eff.targetId === "opex") {
            if (eff.operation === "multiply") periodOtherOpex *= eff.value;
            else if (eff.operation === "add") periodOtherOpex += eff.value;
          }
        }
      }
    }

    // ── Scaling cost triggers ──
    for (const sc of scenario.scalingCosts) {
      let metricValue = 0;
      if (sc.triggerMetric === "customers") metricValue = totalCustomers;
      else if (sc.triggerMetric === "revenue") metricValue = periodRevenue;
      else if (sc.triggerMetric === "headcount") metricValue = periodHeadcount;

      if (metricValue >= sc.threshold) {
        const amount = resolveVar(sc.amount, t, rng);
        if (sc.costType === "recurring") {
          periodOtherOpex += amount;
        } else if (sc.costType === "one_time" && !scalingTriggered.has(sc.id)) {
          periodOtherOpex += amount;
          scalingTriggered.add(sc.id);
        }
      }
    }

    // ── Apply constraints ──
    periodRevenue = applyConstraints(
      periodRevenue, "revenue", constraintChecks, buffers.bindingLog, t
    );

    // ── Fixed assets: depreciation + capex ──
    let depreciation = 0;
    let periodCapex = 0;
    for (const asset of scenario.fixedAssets) {
      const cost = resolveVar(asset.purchaseCost, 0, rng);
      if (asset.usefulLifeMonths > 0) {
        depreciation += cost / asset.usefulLifeMonths;
      }
      // Capex in first period (simplified; purchase schedule for Phase 4)
      if (t === 0) {
        periodCapex += cost;
        cumulativeCapex += cost;
      }
    }

    // ── Debt facilities: interest + principal ──
    let interestExpense = 0;
    let debtDrawdown = 0;
    let debtRepayment = 0;
    for (const debt of scenario.debtFacilities) {
      const monthlyRate = debt.interestRate / 12;
      interestExpense += totalDebtOutstanding > 0 ? totalDebtOutstanding * monthlyRate : 0;

      // Simple amortization: equal principal payments over term
      if (debt.termMonths > 0 && totalDebtOutstanding > 0) {
        const monthlyPrincipal = debt.principal / debt.termMonths;
        debtRepayment += Math.min(monthlyPrincipal, totalDebtOutstanding);
      }
    }
    totalDebtOutstanding = Math.max(0, totalDebtOutstanding - debtRepayment);

    // ── Derive three-way financial statements ──
    const totalOpex = periodSalaries + periodMarketing + periodRent +
      periodRecruitment + periodOtherOpex;

    const flows: PeriodFlows = {
      revenue: periodRevenue,
      cogs: periodCogs,
      salaries: periodSalaries,
      marketing: periodMarketing,
      rent: periodRent,
      recruitmentCosts: periodRecruitment,
      otherOpex: periodOtherOpex,
      depreciation,
      interest: interestExpense,
      taxRate: scenario.taxRate,
      capex: periodCapex,
      debtDrawdown,
      debtRepayment,
      equityInvested: 0,
    };

    const { snapshot, newBalances, newCash } = derivePeriodFinancials(
      flows, wc, prevBalances, scenario.startingCash, cash,
    );

    // Set fixed asset values on balance sheet
    snapshot.bs.fixedAssetsGross = cumulativeCapex;
    snapshot.bs.fixedAssetsNet = cumulativeCapex - snapshot.bs.accumulatedDepreciation;
    snapshot.bs.totalAssets = snapshot.bs.cash + snapshot.bs.accountsReceivable +
      snapshot.bs.inventory + snapshot.bs.fixedAssetsNet;
    // Update debt from our tracking
    snapshot.bs.debt = totalDebtOutstanding;
    snapshot.bs.totalLiabilities = snapshot.bs.accountsPayable +
      snapshot.bs.deferredRevenue + snapshot.bs.debt;
    snapshot.bs.totalEquity = snapshot.bs.investedCapital + snapshot.bs.retainedEarnings;

    cash = newCash;
    prevBalances = newBalances;
    prevBalances.debt = totalDebtOutstanding;

    recordFinancials(buffers.financials, t, snapshot);

    // ── Record core buffers ──
    buffers.revenue[t] = periodRevenue;
    buffers.cogs[t] = periodCogs;
    buffers.opex[t] = totalOpex;
    buffers.profit[t] = snapshot.is.netIncome;
    buffers.cash[t] = cash;
    buffers.customers[t] = totalCustomers;
    buffers.newCustomers[t] = periodNewCustomers;
    buffers.totalAdSpend[t] = periodAdSpend;
    buffers.salaries[t] = periodSalaries;
    buffers.marketing[t] = periodMarketing;
    buffers.rent[t] = periodRent;
    buffers.recruitmentCosts[t] = periodRecruitment;
    buffers.totalSalesCost[t] = periodSalesCost;
    buffers.totalHeadcount[t] = periodHeadcount;
  }
}
