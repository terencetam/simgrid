import { useScenarioStore } from "@/store/scenario-store";
import { GoalBar } from "./GoalBar";
import { LeverPanel } from "./LeverPanel";
import { MetricStrip } from "./MetricStrip";
import { SimulationChart } from "@/ui/charts/SimulationChart";
import { FanChart } from "@/ui/charts/FanChart";
import { TornadoChart } from "@/ui/charts/TornadoChart";
import { ModelTab } from "@/ui/model/ModelTab";
import { ScenarioLibrary } from "@/ui/library/ScenarioLibrary";
import { CompareView } from "@/ui/compare/CompareView";
import { ARCHETYPE_CONFIGS } from "@/engine/profiler";
import { copyShareURL } from "@/lib/sharing";
import { exportScenarioJSON } from "@/lib/file-io";
import { ParentSize } from "@visx/responsive";
import { useState, useCallback, useMemo, useRef } from "react";
import { useKeyboardShortcuts, SHORTCUTS } from "@/lib/keyboard";
import { exportResultsCSV } from "@/lib/export-csv";
import { exportChartPNG } from "@/lib/export-png";
import { OnboardingTour } from "@/ui/onboarding/OnboardingTour";

type ViewMode = "chart" | "model" | "sensitivity" | "compare";
type ChartMetric = "revenue" | "cash" | "customers" | "profit";

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: "chart", label: "Chart" },
  { key: "model", label: "Model" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "compare", label: "Compare" },
];

const CHART_METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: "Revenue",
  cash: "Cash",
  customers: "Customers",
  profit: "Net Income",
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
  const resetToProfiler = useScenarioStore((s) => s.resetToProfiler);
  const isDirty = useScenarioStore((s) => s.isDirty);
  const saveCurrentScenario = useScenarioStore((s) => s.saveCurrentScenario);
  const loadScenario = useScenarioStore((s) => s.loadScenario);
  const lastError = useScenarioStore((s) => s.lastError);
  const clearError = useScenarioStore((s) => s.clearError);

  const chartRef = useRef<SVGSVGElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [activeMetric, setActiveMetric] = useState<ChartMetric>("revenue");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTour, setShowTour] = useState(() => !localStorage.getItem("simgrid-tour-done"));
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Build a map from chartMetric ("revenue"|"cash"|etc.) → variable ID
  const chartMetricToVarId = useMemo(() => {
    const map = new Map<ChartMetric, string>();
    for (const v of scenario.variables) {
      if (v.chartMetric) {
        map.set(v.chartMetric as ChartMetric, v.id);
      }
    }
    return map;
  }, [scenario.variables]);

  const activeVarId = chartMetricToVarId.get(activeMetric) ?? activeMetric;
  const chartData = result?.percentiles[activeVarId] ?? {};
  const metricLabel = CHART_METRIC_LABELS[activeMetric];

  const handleAnimationComplete = useCallback(() => {
    setAnimationPhase("complete");
  }, [setAnimationPhase]);

  const showAnimatedChart =
    sampleRuns.length > 0 &&
    (animationPhase === "spaghetti" || animationPhase === "transition");

  const handleSave = useCallback(async () => {
    try {
      await saveCurrentScenario();
      showToast("Saved!");
    } catch {
      showToast("Failed to save");
    }
  }, [saveCurrentScenario, showToast]);

  const handleShare = useCallback(async () => {
    try {
      await copyShareURL(scenario);
      showToast("Share URL copied!");
    } catch {
      showToast("Failed to copy URL");
    }
  }, [scenario, showToast]);

  const handleExport = useCallback(() => {
    exportScenarioJSON(scenario);
    showToast("Exported!");
  }, [scenario, showToast]);

  const handleLibraryLoad = useCallback(
    (s: typeof scenario) => {
      loadScenario(s, s.id);
      setShowLibrary(false);
      showToast("Loaded!");
    },
    [loadScenario, showToast],
  );

  const shortcutActions = useMemo(
    () => ({
      run: () => { if (!isRunning) runSimulation(); },
      save: handleSave,
      setView: (v: string) => setViewMode(v as ViewMode),
      closeModal: () => {
        if (showHelp) setShowHelp(false);
        else if (showLibrary) setShowLibrary(false);
      },
      toggleHelp: () => setShowHelp((v) => !v),
    }),
    [isRunning, runSimulation, handleSave, showHelp, showLibrary],
  );
  useKeyboardShortcuts(shortcutActions);

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <GoalBar
        scenarioName={scenario.name}
        archetypeLabel={
          scenario.businessProfile?.archetype
            ? ARCHETYPE_CONFIGS[scenario.businessProfile.archetype]?.name
            : undefined
        }
        survivalRate={result?.survivalRate ?? null}
        isRunning={isRunning}
        animate={animationPhase === "spaghetti" || animationPhase === "transition"}
        progress={progress}
        nRuns={nRuns}
        isDirty={isDirty}
        onSave={handleSave}
        onOpenLibrary={() => setShowLibrary(true)}
        onShare={handleShare}
        onExport={handleExport}
        onNewScenario={resetToProfiler}
      />

      {/* Error banner */}
      {lastError && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-950/50 border-b border-red-900/50">
          <span className="text-xs text-red-300">{lastError}</span>
          <button
            onClick={clearError}
            className="text-xs text-red-400 hover:text-red-200 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Lever panel */}
        <div className="w-80 border-r border-zinc-800 overflow-y-auto bg-zinc-925 flex flex-col" data-tour="levers">
          <LeverPanel />
          <div className="mt-auto border-t border-zinc-800 px-5 py-3">
            <span className="text-[10px] font-mono text-zinc-600">
              {__COMMIT_SHA__}
            </span>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* View tabs */}
          <div className="flex items-center gap-1 px-4 pt-3" data-tour="view-tabs">
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
                {(Object.keys(CHART_METRIC_LABELS) as ChartMetric[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveMetric(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeMetric === key
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    {CHART_METRIC_LABELS[key]}
                  </button>
                ))}
              </>
            )}

            {/* Export buttons */}
            {result && viewMode === "chart" && (
              <>
                <div className="flex-1" />
                {chartRef.current && (
                  <button
                    onClick={() => exportChartPNG(chartRef.current!, scenario.name)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1"
                  >
                    PNG
                  </button>
                )}
                <button
                  onClick={() => exportResultsCSV(result, scenario.name)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1"
                >
                  CSV
                </button>
              </>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 px-4 py-2 min-h-0" data-tour="chart">
            {viewMode === "chart" && (
              <>
                {showAnimatedChart ? (
                  <ParentSize>
                    {({ width, height }) => (
                      <SimulationChart
                        fanData={chartData}
                        sampleRuns={sampleRuns}
                        metricVarId={activeVarId}
                        width={width}
                        height={height}
                        yLabel={metricLabel}
                        phase={animationPhase}
                        onAnimationComplete={handleAnimationComplete}
                      />
                    )}
                  </ParentSize>
                ) : result ? (
                  <ParentSize>
                    {({ width, height }) => (
                      <FanChart
                        ref={chartRef}
                        data={chartData}
                        width={width}
                        height={height}
                        yLabel={metricLabel}
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
              <ModelTab />
            )}

            {viewMode === "compare" && (
              <CompareView currentScenario={scenario} />
            )}
          </div>

          {/* Run button */}
          <div className="px-4 pb-3 flex justify-center" data-tour="run-button">
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

      {/* Onboarding tour */}
      {showTour && (
        <OnboardingTour
          steps={OnboardingTour.defaultSteps}
          onComplete={() => {
            setShowTour(false);
            localStorage.setItem("simgrid-tour-done", "1");
          }}
        />
      )}

      {/* Library modal */}
      {showLibrary && (
        <ScenarioLibrary
          onLoad={handleLibraryLoad}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Keyboard shortcuts help */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHelp(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 max-w-sm">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">Keyboard Shortcuts</h3>
            <div className="flex flex-col gap-2">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{s.description}</span>
                  <kbd className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">
                    {s.label}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm px-4 py-2 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
