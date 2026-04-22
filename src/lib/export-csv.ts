import type { MonteCarloResult } from "@/engine/schema";

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

const METRICS = ["revenue", "cash", "customers", "profit"] as const;
const PERCENTILES = ["10", "50", "90"] as const;

export function exportResultsCSV(
  result: MonteCarloResult,
  scenarioName: string,
): void {
  const headers = ["Month"];
  for (const m of METRICS) {
    for (const p of PERCENTILES) {
      headers.push(`${m}_P${p}`);
    }
  }

  const T =
    result.percentiles.revenue?.["50"]?.length ??
    result.percentiles.cash?.["50"]?.length ??
    0;

  const rows: string[] = [headers.join(",")];
  for (let t = 0; t < T; t++) {
    const cells: (string | number)[] = [t + 1];
    for (const m of METRICS) {
      for (const p of PERCENTILES) {
        const val = result.percentiles[m]?.[p]?.[t];
        cells.push(val != null ? Math.round(val * 100) / 100 : "");
      }
    }
    rows.push(cells.join(","));
  }

  downloadCSV(rows.join("\n"), `${sanitizeName(scenarioName)}-results.csv`);
}

interface LineItem {
  key: string;
  label: string;
  statement: string;
}

const FINANCIAL_LINES: LineItem[] = [
  // Income Statement
  { key: "revenue", label: "Revenue", statement: "IS" },
  { key: "cogs", label: "COGS", statement: "IS" },
  { key: "grossProfit", label: "Gross Profit", statement: "IS" },
  { key: "totalOpex", label: "Operating Expenses", statement: "IS" },
  { key: "ebitda", label: "EBITDA", statement: "IS" },
  { key: "depreciation", label: "Depreciation", statement: "IS" },
  { key: "ebit", label: "EBIT", statement: "IS" },
  { key: "interest", label: "Interest Expense", statement: "IS" },
  { key: "netIncome", label: "Net Income", statement: "IS" },
  // Balance Sheet
  { key: "cash", label: "Cash", statement: "BS" },
  { key: "accountsReceivable", label: "Accounts Receivable", statement: "BS" },
  { key: "inventory", label: "Inventory", statement: "BS" },
  { key: "fixedAssetsNet", label: "Fixed Assets (net)", statement: "BS" },
  { key: "totalAssets", label: "Total Assets", statement: "BS" },
  { key: "accountsPayable", label: "Accounts Payable", statement: "BS" },
  { key: "debt", label: "Debt", statement: "BS" },
  { key: "totalLiabilities", label: "Total Liabilities", statement: "BS" },
  { key: "retainedEarnings", label: "Retained Earnings", statement: "BS" },
  { key: "totalEquity", label: "Total Equity", statement: "BS" },
  // Cash Flow
  { key: "cashFromOperations", label: "Cash from Operations", statement: "CF" },
  { key: "cashFromInvesting", label: "Cash from Investing", statement: "CF" },
  { key: "cashFromFinancing", label: "Cash from Financing", statement: "CF" },
  { key: "netCashChange", label: "Net Cash Change", statement: "CF" },
  { key: "endingCash", label: "Ending Cash", statement: "CF" },
];

function getStatementData(
  result: MonteCarloResult,
  type: string,
): Record<string, Record<string, number[]>> {
  switch (type) {
    case "IS": return result.financialStatements.incomeStatement;
    case "BS": return result.financialStatements.balanceSheet;
    case "CF": return result.financialStatements.cashFlowStatement;
    default: return {};
  }
}

export function exportFinancialsCSV(
  result: MonteCarloResult,
  scenarioName: string,
): void {
  const T = result.percentiles.revenue?.["50"]?.length ?? 0;

  const headers = ["Statement", "Line Item"];
  for (let t = 0; t < T; t++) headers.push(`M${t + 1}`);

  const rows: string[] = [headers.join(",")];

  for (const line of FINANCIAL_LINES) {
    const data = getStatementData(result, line.statement);
    const p50 = data[line.key]?.["50"];
    const cells: (string | number)[] = [line.statement, `"${line.label}"`];
    for (let t = 0; t < T; t++) {
      cells.push(p50 ? Math.round(p50[t] * 100) / 100 : "");
    }
    rows.push(cells.join(","));
  }

  downloadCSV(rows.join("\n"), `${sanitizeName(scenarioName)}-financials.csv`);
}
