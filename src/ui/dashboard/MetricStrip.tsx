import { formatCurrency, formatNumber } from "@/lib/format";
import type { MonteCarloResult } from "@/engine/schema";

interface MetricStripProps {
  result: MonteCarloResult | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
}

function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 min-w-[140px]">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-mono font-semibold text-zinc-100">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

export function MetricStrip({ result }: MetricStripProps) {
  if (!result) {
    return (
      <div className="flex gap-3 px-6 py-4 overflow-x-auto">
        <MetricCard label="Revenue (P50)" value="—" subtitle="Press Run" />
        <MetricCard label="Cash low (P10)" value="—" />
        <MetricCard label="Customers (P50)" value="—" />
        <MetricCard label="Profit (P50)" value="—" />
      </div>
    );
  }

  const T = result.percentiles.revenue?.["50"]?.length ?? 0;
  const lastIdx = T - 1;

  const endRevenue = result.percentiles.revenue?.["50"]?.[lastIdx] ?? 0;
  const cashTrough = result.percentiles.cash?.["10"]
    ? Math.min(...result.percentiles.cash["10"])
    : 0;
  const endCustomers = result.percentiles.customers?.["50"]?.[lastIdx] ?? 0;
  const endProfit = result.percentiles.profit?.["50"]?.[lastIdx] ?? 0;

  return (
    <div className="flex gap-3 px-6 py-4 overflow-x-auto">
      <MetricCard
        label="Revenue (P50)"
        value={formatCurrency(endRevenue)}
        subtitle={`Month ${T}`}
      />
      <MetricCard
        label="Cash trough (P10)"
        value={formatCurrency(cashTrough)}
      />
      <MetricCard
        label="Customers (P50)"
        value={formatNumber(endCustomers)}
      />
      <MetricCard
        label="Net Income (P50)"
        value={formatCurrency(endProfit)}
        subtitle={endProfit >= 0 ? "Profitable" : "Burning"}
      />
    </div>
  );
}
