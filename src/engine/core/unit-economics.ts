/**
 * Unit economics computation — derived from simulation buffers.
 * All metrics are per-period arrays computed after a run completes.
 */

export interface UnitEconomicsData {
  /** Blended CAC = total acquisition cost / new customers */
  cac: number[];
  /** Customer LTV = ACV / monthly churn (simple model) */
  ltv: number[];
  /** LTV / CAC ratio */
  ltvCacRatio: number[];
  /** Months to recover CAC from contribution margin per customer */
  paybackMonths: number[];
  /** Gross margin % = (Revenue - COGS) / Revenue */
  grossMarginPct: number[];
  /** Revenue per employee = revenue / total headcount */
  revenuePerEmployee: number[];
  /** Burn multiple = net burn / net new ARR (SaaS) */
  burnMultiple: number[];
  /** Monthly revenue per customer */
  arpu: number[];
}

export interface UnitEconomicsInput {
  revenue: number[];
  cogs: number[];
  totalOpex: number[];
  netIncome: number[];
  customers: number[];
  newCustomers: number[];
  totalAdSpend: number[];
  totalSalesCost: number[];
  totalHeadcount: number[];
  churnRate: number; // average monthly churn rate for LTV calc
  T: number;
}

export function computeUnitEconomics(input: UnitEconomicsInput): UnitEconomicsData {
  const {
    revenue, cogs, netIncome, customers, newCustomers,
    totalAdSpend, totalSalesCost, totalHeadcount, churnRate, T,
  } = input;

  const cac: number[] = [];
  const ltv: number[] = [];
  const ltvCacRatio: number[] = [];
  const paybackMonths: number[] = [];
  const grossMarginPct: number[] = [];
  const revenuePerEmployee: number[] = [];
  const burnMultiple: number[] = [];
  const arpu: number[] = [];

  for (let t = 0; t < T; t++) {
    // CAC
    const acquisitionCost = totalAdSpend[t] + totalSalesCost[t];
    const nc = newCustomers[t];
    const periodCac = nc > 0 ? acquisitionCost / nc : 0;
    cac.push(periodCac);

    // ARPU (monthly)
    const c = customers[t];
    const monthlyArpu = c > 0 ? revenue[t] / c : 0;
    arpu.push(monthlyArpu);

    // LTV (simple: ARPU / churn)
    const effectiveChurn = Math.max(churnRate, 0.001); // avoid division by zero
    const periodLtv = monthlyArpu / effectiveChurn;
    ltv.push(periodLtv);

    // LTV/CAC
    ltvCacRatio.push(periodCac > 0 ? periodLtv / periodCac : 0);

    // Gross margin %
    const gm = revenue[t] > 0 ? (revenue[t] - cogs[t]) / revenue[t] : 0;
    grossMarginPct.push(gm);

    // Payback months
    const marginPerCustomer = monthlyArpu * gm;
    paybackMonths.push(
      marginPerCustomer > 0 ? periodCac / marginPerCustomer : 0
    );

    // Revenue per employee
    const hc = totalHeadcount[t];
    revenuePerEmployee.push(hc > 0 ? revenue[t] / hc : 0);

    // Burn multiple = net burn / net new ARR
    const monthlyBurn = netIncome[t] < 0 ? -netIncome[t] : 0;
    const netNewArr = nc * monthlyArpu * 12; // annualize
    burnMultiple.push(netNewArr > 0 ? monthlyBurn / netNewArr : 0);
  }

  return {
    cac, ltv, ltvCacRatio, paybackMonths,
    grossMarginPct, revenuePerEmployee, burnMultiple, arpu,
  };
}
