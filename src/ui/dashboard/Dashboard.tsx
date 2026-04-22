import { useScenarioStore } from "@/store/scenario-store";
import { GoalBar } from "./GoalBar";
import { LeverPanel } from "./LeverPanel";
import { MetricStrip } from "./MetricStrip";
import { EventLog } from "./EventLog";
import { SimulationChart } from "@/ui/charts/SimulationChart";
import { FanChart } from "@/ui/charts/FanChart";
import { FinancialsTab } from "@/ui/financials/FinancialsTab";
import { UnitEconomicsTab } from "@/ui/unit-economics/UnitEconomicsTab";
import { TornadoChart } from "@/ui/charts/TornadoChart";
import { ModelBuilder } from "@/ui/builder/ModelBuilder";
import { ParentSize } from "@visx/responsive";
import { useState, useCallback } from "react";

type ViewMode = "chart" | "financials" | "unitEcon" | "sensitivity" | "model";
type ChartMetric = "revenue" | "cash" | "customers" | "profit";

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: "chart", label: "Chart" },
  { key: "financials", label: "Financials" },
  { key: "unitEcon", label: "Unit Econ" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "model", label: "Model" },
];

const CHART_CONFIG: Record<
  ChartMetric,
  { label: string; goalMetric?: string }
> = {
  revenue: { label: "Revenue", goalMetric: "revenue" },
  cash: { label: "Cash", goalMetric: "cash" },
  customers: { label: "Customers" },
  profit: { label: "Net Income" },
};

export function Dashboard() {
  const scenario = useScenarioStore((s) => s.scenario);
  const result = useScenarioStore((s) => s.result);
  const sensitivityResult = useScenarioStore((s) => s.sensitivityResult);
  const sampleRuns = useScenarioStore((s) => s.sampleRuns);
  const isRunning = useScenarioStore((s) => s.isRunning);
  const progress = useScenarioStore((s) => s.progress);
  const nRuns = useScenarioStore((s) => s.nRuns);
  const animationPhase = useScenarioStore((s) => s.animationPhase);
  const runSimulation = useScenarioStore((s) => s.runSimulation);
  const setAnimationPhase = useScenarioStore((s) => s.setAnimationPhase);
  const updateVariable = useScenarioStore((s) => s.updateVariable);
  const updateScenario = useScenarioStore((s) => s.updateScenario);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [activeMetric, setActiveMetric] = useState<ChartMetric>("revenue");

  const chartData = result?.percentiles[activeMetric] ?? {};
  const cfg = CHART_CONFIG[activeMetric];

  const goal = scenario.goals.find((g) => g.metric === cfg.goalMetric);
  const threshold = goal?.threshold;

  const handleAnimationComplete = useCallback(() => {
    setAnimationPhase("complete");
  }, [setAnimationPhase]);

  const showAnimatedChart =
    sampleRuns.length > 0 &&
    (animationPhase === "spaghetti" || animationPhase === "transition");

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <GoalBar
        scenarioName={scenario.name}
        winProbability={result?.winProbability ?? null}
        isRunning={isRunning}
        animate={animationPhase === "spaghetti" || animationPhase === "transition"}
        progress={progress}
        nRuns={nRuns}
      />

      <div className="flex flex-1 min-h-0">
        {/* Lever panel + event log */}
        <div className="w-72 border-r border-zinc-800 overflow-y-auto bg-zinc-925 flex flex-col">
          <LeverPanel />
          <div className="border-t border-zinc-800">
            <EventLog scenario={scenario} />
          </div>
          <div className="mt-auto border-t border-zinc-800 px-5 py-3">
            <span className="text-[10px] font-mono text-zinc-600">
              {__COMMIT_SHA__}
            </span>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* View tabs */}
          <div className="flex items-center gap-1 px-4 pt-3">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === tab.key
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Chart sub-tabs */}
            {viewMode === "chart" && (
              <>
                <div className="w-px h-4 bg-zinc-800 mx-1" />
                {(Object.keys(CHART_CONFIG) as ChartMetric[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveMetric(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeMetric === key
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    {CHART_CONFIG[key].label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 px-4 py-2 min-h-0">
            {viewMode === "chart" && (
              <>
                {showAnimatedChart ? (
                  <ParentSize>
                    {({ width, height }) => (
                      <SimulationChart
                        fanData={chartData}
                        sampleRuns={sampleRuns}
                        metric={activeMetric}
                        width={width}
                        height={height}
                        yLabel={cfg.label}
                        threshold={threshold}
                        phase={animationPhase}
                        onAnimationComplete={handleAnimationComplete}
                      />
                    )}
                  </ParentSize>
                ) : result ? (
                  <ParentSize>
                    {({ width, height }) => (
                      <FanChart
                        data={chartData}
                        width={width}
                        height={height}
                        yLabel={cfg.label}
                        threshold={threshold}
                      />
                    )}
                  </ParentSize>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600">
                    <div className="text-center">
                      {isRunning ? (
                        <>
                          <div className="text-4xl mb-3 animate-pulse">⚡</div>
                          <div className="text-lg">Running simulation...</div>
                          <div className="text-sm text-zinc-700 mt-1">
                            {progress} / {nRuns} runs complete
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-3">▶</div>
                          <div className="text-lg">
                            Adjust levers, then press Run
                          </div>
                          <div className="text-sm text-zinc-700 mt-1">
                            {nRuns.toLocaleString()} Monte Carlo simulations will
                            play out
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {viewMode === "financials" && (
              result ? (
                <FinancialsTab result={result} />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Run a simulation to see financial statements
                </div>
              )
            )}

            {viewMode === "unitEcon" && (
              result ? (
                <UnitEconomicsTab result={result} />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Run a simulation to see unit economics
                </div>
              )
            )}

            {viewMode === "sensitivity" && (
              sensitivityResult ? (
                <TornadoChart data={sensitivityResult} />
              ) : result ? (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  <div className="text-center">
                    <div className="animate-pulse text-zinc-500 mb-2">Analyzing...</div>
                    <div className="text-xs text-zinc-700">
                      Running sensitivity analysis in background
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Run a simulation to see sensitivity analysis
                </div>
              )
            )}

            {viewMode === "model" && (
              <ModelBuilder
                scenario={scenario}
                onUpdateVariable={updateVariable}
                onUpdateScenario={updateScenario}
              />
            )}
          </div>

          {/* Run button */}
          <div className="px-4 pb-3 flex justify-center">
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700
                         text-white font-semibold rounded-lg transition-colors
                         text-sm tracking-wide shadow-lg shadow-indigo-900/30
                         disabled:cursor-not-allowed"
            >
              {isRunning ? "Running..." : "Run Simulation"}
            </button>
          </div>

          {/* Metric strip */}
          <div className="border-t border-zinc-800">
            <MetricStrip result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}
