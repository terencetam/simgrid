import { useState } from "react";
import type { MonteCarloResult } from "@/engine/schema";
import { formatCurrency } from "@/lib/format";

interface FinancialsTabProps {
  result: MonteCarloResult;
}

type StatementType = "is" | "bs" | "cf";

const STATEMENT_LABELS: Record<StatementType, string> = {
  is: "Income Statement",
  bs: "Balance Sheet",
  cf: "Cash Flow",
};

interface LineItem {
  key: string;
  label: string;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
}

const IS_LINES: LineItem[] = [
  { key: "revenue", label: "Revenue", bold: true },
  { key: "cogs", label: "Cost of Goods Sold", indent: true },
  { key: "grossProfit", label: "Gross Profit", bold: true, separator: true },
  { key: "totalOpex", label: "Operating Expenses", indent: true },
  { key: "ebitda", label: "EBITDA", bold: true, separator: true },
  { key: "depreciation", label: "Depreciation", indent: true },
  { key: "ebit", label: "EBIT", bold: true },
  { key: "interest", label: "Interest Expense", indent: true },
  { key: "netIncome", label: "Net Income", bold: true, separator: true },
];

const BS_LINES: LineItem[] = [
  { key: "cash", label: "Cash", indent: true },
  { key: "accountsReceivable", label: "Accounts Receivable", indent: true },
  { key: "inventory", label: "Inventory", indent: true },
  { key: "fixedAssetsNet", label: "Fixed Assets (net)", indent: true },
  { key: "totalAssets", label: "Total Assets", bold: true, separator: true },
  { key: "accountsPayable", label: "Accounts Payable", indent: true },
  { key: "debt", label: "Debt", indent: true },
  { key: "totalLiabilities", label: "Total Liabilities", bold: true, separator: true },
  { key: "retainedEarnings", label: "Retained Earnings", indent: true },
  { key: "totalEquity", label: "Total Equity", bold: true },
];

const CF_LINES: LineItem[] = [
  { key: "cashFromOperations", label: "Cash from Operations", bold: true },
  { key: "cashFromInvesting", label: "Cash from Investing" },
  { key: "cashFromFinancing", label: "Cash from Financing" },
  { key: "netCashChange", label: "Net Cash Change", bold: true, separator: true },
  { key: "endingCash", label: "Ending Cash", bold: true },
];

const STATEMENT_LINES: Record<StatementType, LineItem[]> = {
  is: IS_LINES,
  bs: BS_LINES,
  cf: CF_LINES,
};

function getStatementData(
  result: MonteCarloResult,
  type: StatementType
): Record<string, Record<string, number[]>> {
  switch (type) {
    case "is": return result.financialStatements.incomeStatement;
    case "bs": return result.financialStatements.balanceSheet;
    case "cf": return result.financialStatements.cashFlowStatement;
  }
}

export function FinancialsTab({ result }: FinancialsTabProps) {
  const [activeStatement, setActiveStatement] = useState<StatementType>("is");

  const data = getStatementData(result, activeStatement);
  const lines = STATEMENT_LINES[activeStatement];
  const T = result.percentiles.revenue?.["50"]?.length ?? 0;
  const lastIdx = T - 1;

  // Show quarters: months 2, 5, 8, 11, 14, 17, 20, 23 (end of each quarter)
  const quarterIndices: number[] = [];
  for (let q = 2; q < T; q += 3) quarterIndices.push(q);
  if (quarterIndices.length === 0 && T > 0) quarterIndices.push(lastIdx);

  return (
    <div className="flex flex-col h-full">
      {/* Statement type tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2">
        {(Object.keys(STATEMENT_LABELS) as StatementType[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveStatement(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeStatement === key
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            {STATEMENT_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 pr-4 text-zinc-500 font-normal w-48">
                {STATEMENT_LABELS[activeStatement]}
              </th>
              {quarterIndices.map((qi) => (
                <th key={qi} className="text-right py-2 px-2 text-zinc-500 font-normal min-w-[80px]">
                  M{qi + 1}
                </th>
              ))}
              <th className="text-right py-2 px-2 text-zinc-400 font-semibold min-w-[80px]">
                End
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const series = data[line.key];
              const p50 = series?.["50"];
              const p10 = series?.["10"];
              const p90 = series?.["90"];

              return (
                <tr
                  key={line.key}
                  className={`${line.separator ? "border-t border-zinc-800" : ""} group hover:bg-zinc-900/50`}
                >
                  <td
                    className={`py-1.5 pr-4 ${line.indent ? "pl-4" : ""} ${
                      line.bold ? "text-zinc-200 font-semibold" : "text-zinc-400"
                    }`}
                  >
                    {line.label}
                  </td>
                  {quarterIndices.map((qi) => (
                    <td key={qi} className="text-right py-1.5 px-2 text-zinc-400" title={
                      p10 && p90 ? `P10: ${formatCurrency(p10[qi])} | P90: ${formatCurrency(p90[qi])}` : undefined
                    }>
                      {p50 ? formatCurrency(p50[qi]) : "—"}
                    </td>
                  ))}
                  <td className={`text-right py-1.5 px-2 ${
                    line.bold ? "text-zinc-200 font-semibold" : "text-zinc-300"
                  }`}>
                    {p50 ? formatCurrency(p50[lastIdx]) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 text-[10px] text-zinc-600 border-t border-zinc-800">
        P50 values shown. Hover for P10-P90 range.
      </div>
    </div>
  );
}
