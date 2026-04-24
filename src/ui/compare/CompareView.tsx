import { useState, useCallback, useEffect } from "react";
import type { Scenario, MonteCarloResult } from "@/engine/schema";
import { listScenarios, type SavedScenario } from "@/lib/db";
import { monteCarlo } from "@/engine/montecarlo";
import { ComparisonChart } from "./ComparisonChart";
import { ParentSize } from "@visx/responsive";

type ChartMetric = "revenue" | "cash" | "customers" | "profit";

const COLORS = ["#6366f1", "#10b981", "#f59e0b"]; // indigo, emerald, amber
const MAX_SCENARIOS = 3;

interface CompareEntry {
  scenario: Scenario;
  result: MonteCarloResult | null;
  isRunning: boolean;
}

interface CompareViewProps {
  currentScenario: Scenario;
}

const METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: "Revenue",
  cash: "Cash",
  customers: "Customers",
  profit: "Net Income",
};

export function CompareView({ currentScenario }: CompareViewProps) {
  const [entries, setEntries] = useState<CompareEntry[]>([
    { scenario: currentScenario, result: null, isRunning: false },
  ]);
  const [savedList, setSavedList] = useState<SavedScenario[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [metric, setMetric] = useState<ChartMetric>("revenue");

  useEffect(() => {
    listScenarios()
      .then(setSavedList)
      .catch((err) => console.warn("Failed to load scenarios:", err));
  }, []);

  const runMC = useCallback(
    async (index: number) => {
      setEntries((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], isRunning: true, result: null };
        return next;
      });

      const scenario = entries[index].scenario;
      // Run MC synchronously (fast enough: ~50ms for 1K runs)
      const { result } = monteCarlo(scenario, 500, 42);

      setEntries((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], isRunning: false, result };
        return next;
      });
    },
    [entries],
  );

  const addScenario = useCallback((scenario: Scenario) => {
    setEntries((prev) => {
      if (prev.length >= MAX_SCENARIOS) return prev;
      return [...prev, { scenario, result: null, isRunning: false }];
    });
    setShowPicker(false);
  }, []);

  const removeScenario = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const runAll = useCallback(async () => {
    for (let i = 0; i < entries.length; i++) {
      await runMC(i);
    }
  }, [entries.length, runMC]);

  const chartSeries = entries
    .filter((e) => e.result)
    .map((e, idx) => ({
      label: e.scenario.name,
      color: COLORS[idx % COLORS.length],
      data: e.result!.percentiles[metric] ?? {},
      survivalRate: e.result!.survivalRate,
    }));

  const hasResults = chartSeries.length > 0;
  const anyRunning = entries.some((e) => e.isRunning);

  return (
    <div className="flex flex-col h-full">
      {/* Scenario list */}
      <div className="flex flex-col gap-2 mb-4">
        {entries.map((entry, idx) => (
          <div
            key={`${entry.scenario.id}-${idx}`}
            className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 rounded-lg"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-zinc-200 truncate block">
                {entry.scenario.name}
              </span>
            </div>
            {entry.isRunning && (
              <span className="text-xs text-zinc-500 animate-pulse">
                Running...
              </span>
            )}
            {entry.result && (
              <span className="text-xs text-zinc-400">
                Survival: {Math.round(entry.result.survivalRate * 100)}%
              </span>
            )}
            {idx > 0 && (
              <button
                onClick={() => removeScenario(idx)}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2">
          {entries.length < MAX_SCENARIOS && (
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-zinc-800/50 rounded-lg"
            >
              + Add scenario
            </button>
          )}
          <button
            onClick={runAll}
            disabled={anyRunning || entries.length === 0}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {anyRunning ? "Running..." : "Run All"}
          </button>
        </div>

        {/* Scenario picker dropdown */}
        {showPicker && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 max-h-48 overflow-y-auto">
            {savedList.length === 0 ? (
              <div className="text-xs text-zinc-600 p-2">
                No saved scenarios. Save some first.
              </div>
            ) : (
              savedList.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => addScenario(saved.scenario)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
                >
                  {saved.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Metric tabs */}
      {hasResults && (
        <div className="flex items-center gap-1 mb-2">
          {(Object.keys(METRIC_LABELS) as ChartMetric[]).map((key) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metric === key
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {METRIC_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {hasResults ? (
          <ParentSize>
            {({ width, height }) => (
              <ComparisonChart
                series={chartSeries}
                width={width}
                height={height}
                yLabel={METRIC_LABELS[metric]}
              />
            )}
          </ParentSize>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600">
            <div className="text-center">
              <div className="text-3xl mb-3">⚖️</div>
              <div className="text-sm">
                Add scenarios and press "Run All" to compare
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
