import { useScenarioStore } from "@/store/scenario-store";
import { GoalBar } from "./GoalBar";
import { LeverPanel } from "./LeverPanel";
import { MetricStrip } from "./MetricStrip";
import { EventLog } from "./EventLog";
import { SimulationChart } from "@/ui/charts/SimulationChart";
import { FanChart } from "@/ui/charts/FanChart";
import { ParentSize } from "@visx/responsive";
import { useState, useCallback } from "react";

type ChartMetric = "revenue" | "cash" | "customers" | "profit";

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
  const sampleRuns = useScenarioStore((s) => s.sampleRuns);
  const isRunning = useScenarioStore((s) => s.isRunning);
  const progress = useScenarioStore((s) => s.progress);
  const nRuns = useScenarioStore((s) => s.nRuns);
  const animationPhase = useScenarioStore((s) => s.animationPhase);
  const runSimulation = useScenarioStore((s) => s.runSimulation);
  const setAnimationPhase = useScenarioStore((s) => s.setAnimationPhase);
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
        </div>

        {/* Chart area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chart tabs */}
          <div className="flex gap-1 px-4 pt-3">
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
          </div>

          {/* Chart */}
          <div className="flex-1 px-4 py-2 min-h-0">
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
