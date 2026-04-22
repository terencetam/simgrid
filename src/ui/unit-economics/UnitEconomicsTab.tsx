import type { MonteCarloResult } from "@/engine/schema";
import { formatCurrency, formatPercent } from "@/lib/format";

interface UnitEconomicsTabProps {
  result: MonteCarloResult;
}

interface MetricConfig {
  key: string;
  label: string;
  format: (v: number) => string;
  description: string;
  good: "high" | "low";
}

const METRICS: MetricConfig[] = [
  {
    key: "cac",
    label: "CAC",
    format: formatCurrency,
    description: "Cost to acquire one customer",
    good: "low",
  },
  {
    key: "ltv",
    label: "LTV",
    format: formatCurrency,
    description: "Lifetime value per customer",
    good: "high",
  },
  {
    key: "ltvCacRatio",
    label: "LTV/CAC",
    format: (v) => v.toFixed(1) + "x",
    description: "Must be > 3x for healthy unit economics",
    good: "high",
  },
  {
    key: "paybackMonths",
    label: "Payback",
    format: (v) => v.toFixed(1) + " mo",
    description: "Months to recover CAC",
    good: "low",
  },
  {
    key: "grossMarginPct",
    label: "Gross Margin",
    format: (v) => formatPercent(v, 1),
    description: "Revenue minus COGS as % of revenue",
    good: "high",
  },
  {
    key: "arpu",
    label: "ARPU",
    format: formatCurrency,
    description: "Average revenue per user per month",
    good: "high",
  },
  {
    key: "revenuePerEmployee",
    label: "Rev/Employee",
    format: formatCurrency,
    description: "Monthly revenue per headcount",
    good: "high",
  },
  {
    key: "burnMultiple",
    label: "Burn Multiple",
    format: (v) => v.toFixed(1) + "x",
    description: "Net burn / net new ARR (lower is better)",
    good: "low",
  },
];

function getHealthColor(metric: MetricConfig, value: number): string {
  if (metric.key === "ltvCacRatio") {
    if (value >= 3) return "text-green-400";
    if (value >= 1) return "text-yellow-400";
    return "text-red-400";
  }
  if (metric.key === "grossMarginPct") {
    if (value >= 0.6) return "text-green-400";
    if (value >= 0.3) return "text-yellow-400";
    return "text-red-400";
  }
  if (metric.key === "burnMultiple") {
    if (value === 0) return "text-green-400";
    if (value <= 1.5) return "text-green-400";
    if (value <= 3) return "text-yellow-400";
    return "text-red-400";
  }
  if (metric.key === "paybackMonths") {
    if (value <= 12) return "text-green-400";
    if (value <= 24) return "text-yellow-400";
    return "text-red-400";
  }
  return "text-zinc-200";
}

/** Simple inline sparkline using SVG */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 24;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UnitEconomicsTab({ result }: UnitEconomicsTabProps) {
  const ue = result.unitEconomics;
  const T = result.percentiles.revenue?.["50"]?.length ?? 0;
  const lastIdx = T - 1;

  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        Unit Economics
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((metric) => {
          const series = ue[metric.key];
          const p50 = series?.["50"];
          const p10 = series?.["10"];
          const p90 = series?.["90"];
          const endValue = p50 ? p50[lastIdx] : 0;
          const color = getHealthColor(metric, endValue);

          return (
            <div
              key={metric.key}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {metric.label}
                </span>
                <span className={`text-lg font-mono font-semibold ${color}`}>
                  {p50 ? metric.format(endValue) : "—"}
                </span>
              </div>
              <div className="text-[10px] text-zinc-600 mb-2">
                {metric.description}
              </div>
              {p50 && (
                <div className="flex items-center justify-between">
                  <MiniSparkline data={p50} color="rgb(99, 102, 241)" />
                  {p10 && p90 && (
                    <span className="text-[10px] text-zinc-600 ml-2">
                      {metric.format(p10[lastIdx])}–{metric.format(p90[lastIdx])}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
