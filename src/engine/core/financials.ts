/**
 * Three-way financial statement derivation.
 * Computes IS, BS, CF line items from simulation data each period.
 */

/** Per-period income statement line items */
export interface IncomeStatement {
  revenue: number;
  cogs: number;
  grossProfit: number;
  salaries: number;
  marketing: number;
  rent: number;
  recruitmentCosts: number;
  otherOpex: number;
  totalOpex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interest: number;
  preTaxProfit: number;
  tax: number;
  netIncome: number;
}

/** End-of-period balance sheet snapshot */
export interface BalanceSheet {
  // Assets
  cash: number;
  accountsReceivable: number;
  inventory: number;
  fixedAssetsGross: number;
  accumulatedDepreciation: number;
  fixedAssetsNet: number;
  totalAssets: number;
  // Liabilities
  accountsPayable: number;
  deferredRevenue: number;
  debt: number;
  totalLiabilities: number;
  // Equity
  investedCapital: number;
  retainedEarnings: number;
  totalEquity: number;
}

/** Per-period cash flow statement (indirect method) */
export interface CashFlowStatement {
  // Operating
  netIncome: number;
  depreciation: number;
  changeInAR: number;
  changeInInventory: number;
  changeInAP: number;
  changeInDeferredRevenue: number;
  cashFromOperations: number;
  // Investing
  capex: number;
  cashFromInvesting: number;
  // Financing
  debtDrawdown: number;
  debtRepayment: number;
  equityInvested: number;
  cashFromFinancing: number;
  // Net
  netCashChange: number;
  endingCash: number;
}

/** Full financial snapshot for a single period */
export interface FinancialSnapshot {
  is: IncomeStatement;
  bs: BalanceSheet;
  cf: CashFlowStatement;
}

/** Buffers to track financial line items across all periods */
export interface FinancialBuffers {
  is: { [K in keyof IncomeStatement]: number[] };
  bs: { [K in keyof BalanceSheet]: number[] };
  cf: { [K in keyof CashFlowStatement]: number[] };
}

const IS_KEYS: (keyof IncomeStatement)[] = [
  "revenue", "cogs", "grossProfit", "salaries", "marketing", "rent",
  "recruitmentCosts", "otherOpex", "totalOpex", "ebitda", "depreciation",
  "ebit", "interest", "preTaxProfit", "tax", "netIncome",
];

const BS_KEYS: (keyof BalanceSheet)[] = [
  "cash", "accountsReceivable", "inventory", "fixedAssetsGross",
  "accumulatedDepreciation", "fixedAssetsNet", "totalAssets",
  "accountsPayable", "deferredRevenue", "debt", "totalLiabilities",
  "investedCapital", "retainedEarnings", "totalEquity",
];

const CF_KEYS: (keyof CashFlowStatement)[] = [
  "netIncome", "depreciation", "changeInAR", "changeInInventory",
  "changeInAP", "changeInDeferredRevenue", "cashFromOperations",
  "capex", "cashFromInvesting", "debtDrawdown", "debtRepayment",
  "equityInvested", "cashFromFinancing", "netCashChange", "endingCash",
];

export function allocateFinancialBuffers(T: number): FinancialBuffers {
  const makeArr = () => new Array(T).fill(0);
  const is = {} as FinancialBuffers["is"];
  for (const k of IS_KEYS) is[k] = makeArr();
  const bs = {} as FinancialBuffers["bs"];
  for (const k of BS_KEYS) bs[k] = makeArr();
  const cf = {} as FinancialBuffers["cf"];
  for (const k of CF_KEYS) cf[k] = makeArr();
  return { is, bs, cf };
}

export interface PeriodFlows {
  revenue: number;
  cogs: number;
  salaries: number;
  marketing: number;
  rent: number;
  recruitmentCosts: number;
  otherOpex: number;
  depreciation: number;
  interest: number;
  taxRate: number;
  capex: number;
  debtDrawdown: number;
  debtRepayment: number;
  equityInvested: number;
}

export interface WorkingCapitalParams {
  dso: number; // days sales outstanding
  dpo: number; // days payable outstanding
  dio: number; // days inventory outstanding
}

interface PrevBalances {
  ar: number;
  ap: number;
  inventory: number;
  deferredRevenue: number;
  accDepreciation: number;
  debt: number;
  retainedEarnings: number;
}

/**
 * Derive one period's financial statements from the flows and previous balances.
 * Returns the snapshot and the new balances for next period.
 */
export function derivePeriodFinancials(
  flows: PeriodFlows,
  wc: WorkingCapitalParams,
  prev: PrevBalances,
  startingCash: number,
  prevCash: number,
): { snapshot: FinancialSnapshot; newBalances: PrevBalances; newCash: number } {
  // ── Income Statement ──
  const grossProfit = flows.revenue - flows.cogs;
  const totalOpex = flows.salaries + flows.marketing + flows.rent +
    flows.recruitmentCosts + flows.otherOpex;
  const ebitda = grossProfit - totalOpex;
  const ebit = ebitda - flows.depreciation;
  const preTaxProfit = ebit - flows.interest;
  const tax = flows.taxRate > 0 ? Math.max(0, preTaxProfit * flows.taxRate) : 0;
  const netIncome = preTaxProfit - tax;

  const is: IncomeStatement = {
    revenue: flows.revenue,
    cogs: flows.cogs,
    grossProfit,
    salaries: flows.salaries,
    marketing: flows.marketing,
    rent: flows.rent,
    recruitmentCosts: flows.recruitmentCosts,
    otherOpex: flows.otherOpex,
    totalOpex,
    ebitda,
    depreciation: flows.depreciation,
    ebit,
    interest: flows.interest,
    preTaxProfit,
    tax,
    netIncome,
  };

  // ── Working Capital balances ──
  // AR = revenue * (DSO / 30); represents revenue earned but not yet collected
  const ar = flows.revenue * (wc.dso / 30);
  // AP = (cogs + opex portions) * (DPO / 30); represents costs incurred but not yet paid
  const ap = flows.cogs * (wc.dpo / 30);
  // Inventory = cogs * (DIO / 30); represents goods purchased but not yet sold
  const inventory = flows.cogs * (wc.dio / 30);
  // Deferred revenue = 0 for monthly billing (all recognised same period)
  const deferredRevenue = 0;

  // ── Cash Flow Statement (indirect) ──
  const changeInAR = ar - prev.ar;
  const changeInInventory = inventory - prev.inventory;
  const changeInAP = ap - prev.ap;
  const changeInDR = deferredRevenue - prev.deferredRevenue;

  const cashFromOps = netIncome + flows.depreciation
    - changeInAR - changeInInventory + changeInAP + changeInDR;
  const cashFromInvesting = -flows.capex;
  const cashFromFinancing = flows.debtDrawdown - flows.debtRepayment + flows.equityInvested;
  const netCashChange = cashFromOps + cashFromInvesting + cashFromFinancing;
  const endingCash = prevCash + netCashChange;

  const cf: CashFlowStatement = {
    netIncome,
    depreciation: flows.depreciation,
    changeInAR: -changeInAR,
    changeInInventory: -changeInInventory,
    changeInAP: changeInAP,
    changeInDeferredRevenue: changeInDR,
    cashFromOperations: cashFromOps,
    capex: -flows.capex,
    cashFromInvesting,
    debtDrawdown: flows.debtDrawdown,
    debtRepayment: -flows.debtRepayment,
    equityInvested: flows.equityInvested,
    cashFromFinancing,
    netCashChange,
    endingCash,
  };

  // ── Balance Sheet ──
  const accDepreciation = prev.accDepreciation + flows.depreciation;
  // fixedAssetsGross/Net are filled by the caller (simulate loop tracks cumulative capex)
  const debt = prev.debt + flows.debtDrawdown - flows.debtRepayment;
  const retainedEarnings = prev.retainedEarnings + netIncome;

  // We track fixed assets gross as: total depreciation / (dep rate) if useful,
  // but simpler: the simulate loop will pass cumulative gross asset value.
  // For now approximate from accumulated depreciation + net.
  const bs: BalanceSheet = {
    cash: endingCash,
    accountsReceivable: ar,
    inventory,
    fixedAssetsGross: 0, // filled by caller
    accumulatedDepreciation: accDepreciation,
    fixedAssetsNet: 0, // filled by caller
    totalAssets: 0, // computed below
    accountsPayable: ap,
    deferredRevenue,
    debt,
    totalLiabilities: 0,
    investedCapital: startingCash + flows.equityInvested,
    retainedEarnings,
    totalEquity: 0,
  };

  // Caller sets fixedAssetsGross/Net; we compute totals
  bs.totalLiabilities = bs.accountsPayable + bs.deferredRevenue + bs.debt;
  bs.totalEquity = bs.investedCapital + bs.retainedEarnings;
  bs.totalAssets = bs.cash + bs.accountsReceivable + bs.inventory + bs.fixedAssetsNet;

  const snapshot: FinancialSnapshot = { is, bs, cf };
  const newBalances: PrevBalances = {
    ar, ap, inventory, deferredRevenue, accDepreciation, debt, retainedEarnings,
  };
  return { snapshot, newBalances, newCash: endingCash };
}

/** Record a snapshot into the financial buffers at period t */
export function recordFinancials(fb: FinancialBuffers, t: number, snap: FinancialSnapshot) {
  for (const k of IS_KEYS) fb.is[k][t] = snap.is[k];
  for (const k of BS_KEYS) fb.bs[k][t] = snap.bs[k];
  for (const k of CF_KEYS) fb.cf[k][t] = snap.cf[k];
}
