import { formatPercent } from "@/lib/format";

interface GoalBarProps {
  scenarioName: string;
  winProbability: number | null;
  isRunning: boolean;
}

export function GoalBar({
  scenarioName,
  winProbability,
  isRunning,
}: GoalBarProps) {
  const probDisplay =
    winProbability != null ? formatPercent(winProbability) : "—";

  const probColor =
    winProbability == null
      ? "text-zinc-500"
      : winProbability >= 0.7
        ? "text-green-400"
        : winProbability >= 0.4
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-925">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">{scenarioName}</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
          SaaS
        </span>
      </div>

      <div className="flex items-center gap-4">
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
