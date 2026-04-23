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

/** Find a variable ID in percentiles that matches a chart metric name */
function findVarId(
  percentiles: Record<string, Record<string, number[]>>,
  metric: string,
): string | undefined {
  // Direct match first
  if (percentiles[metric]) return metric;
  // Substring match (e.g. "total_revenue" for "revenue")
  for (const varId of Object.keys(percentiles)) {
    if (varId.includes(metric)) return varId;
  }
  return undefined;
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

  const cards: { label: string; value: string; subtitle?: string }[] = [];

  const revenueId = findVarId(result.percentiles, "revenue");
  if (revenueId) {
    const T = result.percentiles[revenueId]["50"]?.length ?? 0;
    const endVal = result.percentiles[revenueId]["50"]?.[T - 1] ?? 0;
    cards.push({ label: "Revenue (P50)", value: formatCurrency(endVal), subtitle: `Month ${T}` });
  }

  const cashId = findVarId(result.percentiles, "cash");
  if (cashId) {
    const p10 = result.percentiles[cashId]["10"];
    const trough = p10 ? Math.min(...p10) : 0;
    cards.push({ label: "Cash trough (P10)", value: formatCurrency(trough) });
  }

  const custId = findVarId(result.percentiles, "customers");
  if (custId) {
    const T = result.percentiles[custId]["50"]?.length ?? 0;
    const endVal = result.percentiles[custId]["50"]?.[T - 1] ?? 0;
    cards.push({ label: "Customers (P50)", value: formatNumber(endVal) });
  }

  const profitId = findVarId(result.percentiles, "profit");
  if (profitId) {
    const T = result.percentiles[profitId]["50"]?.length ?? 0;
    const endVal = result.percentiles[profitId]["50"]?.[T - 1] ?? 0;
    cards.push({
      label: "Net Income (P50)",
      value: formatCurrency(endVal),
      subtitle: endVal >= 0 ? "Profitable" : "Burning",
    });
  }

  return (
    <div className="flex gap-3 px-6 py-4 overflow-x-auto">
      {cards.map((c) => (
        <MetricCard key={c.label} label={c.label} value={c.value} subtitle={c.subtitle} />
      ))}
    </div>
  );
}
