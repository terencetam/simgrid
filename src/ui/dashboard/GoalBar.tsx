import { useEffect, useRef, useState } from "react";
import { formatPercent } from "@/lib/format";

interface GoalBarProps {
  scenarioName: string;
  winProbability: number | null;
  isRunning: boolean;
  /** Whether to animate the counter from 0 to the target value */
  animate: boolean;
  /** Progress through MC runs (0 to nRuns) */
  progress?: number;
  nRuns?: number;
}

const COUNTER_DURATION = 1200; // ms

export function GoalBar({
  scenarioName,
  winProbability,
  isRunning,
  animate,
  progress = 0,
  nRuns = 1000,
}: GoalBarProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const prevProbRef = useRef<number | null>(null);

  useEffect(() => {
    if (animate && winProbability != null) {
      const from = prevProbRef.current ?? 0;
      const to = winProbability;
      startTimeRef.current = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const t = Math.min(elapsed / COUNTER_DURATION, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayValue(from + (to - from) * eased);

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          prevProbRef.current = to;
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animFrameRef.current);
    }

    if (!animate && winProbability != null) {
      setDisplayValue(winProbability);
      prevProbRef.current = winProbability;
    }

    if (winProbability == null) {
      setDisplayValue(null);
      prevProbRef.current = null;
    }
  }, [winProbability, animate]);

  const shown = displayValue ?? winProbability;
  const probDisplay = shown != null ? formatPercent(shown) : "—";

  const probColor =
    shown == null
      ? "text-zinc-500"
      : shown >= 0.7
        ? "text-green-400"
        : shown >= 0.4
          ? "text-yellow-400"
          : "text-red-400";

  const progressPct = nRuns > 0 ? Math.min((progress / nRuns) * 100, 100) : 0;

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-925">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">{scenarioName}</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
          SaaS
        </span>
      </div>

      <div className="flex items-center gap-4">
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-mono w-12 text-right">
              {Math.round(progressPct)}%
            </span>
          </div>
        )}

        <div className="text-right">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            Win probability
          </div>
          <div className={`text-2xl font-mono font-bold ${probColor}`}>
            {isRunning ? (
              <span className="animate-pulse">...</span>
            ) : (
              probDisplay
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
