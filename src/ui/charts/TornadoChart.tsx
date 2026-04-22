import type { TornadoResult } from "@/engine/core/sensitivity";
import { formatPercent } from "@/lib/format";

interface TornadoChartProps {
  data: TornadoResult;
}

export function TornadoChart({ data }: TornadoChartProps) {
  const { levers, baseWinProb, suggestedMove } = data;

  if (levers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        No sensitivity data available
      </div>
    );
  }

  // Show top 10 levers
  const topLevers = levers.slice(0, 10);
  const maxImpact = Math.max(...topLevers.map((l) => l.impact), 0.01);

  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
        Sensitivity Analysis
      </h2>
      <p className="text-xs text-zinc-600 mb-4">
        Impact of +/-10% lever change on win probability
      </p>

      {/* Suggested move */}
      {suggestedMove && (
        <div className="bg-indigo-950 border border-indigo-800 rounded-lg px-4 py-3 mb-4">
          <div className="text-xs text-indigo-400 uppercase tracking-wider mb-1">
            Suggested Next Move
          </div>
          <div className="text-sm text-zinc-200">
            {suggestedMove.direction === "up" ? "Increase" : "Decrease"}{" "}
            <span className="font-semibold text-indigo-300">
              {suggestedMove.label}
            </span>{" "}
            by 10% to reach{" "}
            <span className="font-mono font-semibold text-green-400">
              {formatPercent(suggestedMove.newWinProb)}
            </span>{" "}
            win probability
          </div>
        </div>
      )}

      {/* Tornado bars */}
      <div className="flex flex-col gap-2">
        {topLevers.map((lever) => {
          const isSuggested = suggestedMove?.variableId === lever.variableId;
          // Width proportional to impact
          const barWidth = (lever.impact / maxImpact) * 100;

          // Determine if going up or down helps
          const upBetter = lever.winProbUp > lever.winProbDown;

          return (
            <div key={lever.variableId} className="flex items-center gap-3">
              <div className={`w-32 text-right text-xs truncate ${
                isSuggested ? "text-indigo-300 font-semibold" : "text-zinc-400"
              }`}>
                {lever.label}
              </div>
              <div className="flex-1 flex items-center gap-1">
                {/* Down bar */}
                <div className="flex-1 flex justify-end">
                  <div
                    className={`h-5 rounded-l ${
                      !upBetter ? "bg-green-700" : "bg-red-900"
                    }`}
                    style={{
                      width: `${(Math.abs(lever.winProbDown - baseWinProb) / maxImpact) * 100}%`,
                      minWidth: 2,
                    }}
                  />
                </div>
                {/* Center line */}
                <div className="w-px h-6 bg-zinc-600" />
                {/* Up bar */}
                <div className="flex-1">
                  <div
                    className={`h-5 rounded-r ${
                      upBetter ? "bg-green-700" : "bg-red-900"
                    }`}
                    style={{
                      width: `${(Math.abs(lever.winProbUp - baseWinProb) / maxImpact) * 100}%`,
                      minWidth: 2,
                    }}
                  />
                </div>
              </div>
              <div className="w-16 text-right text-[10px] font-mono text-zinc-500">
                {formatPercent(lever.impact)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-[10px] text-zinc-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-700" /> Improves win prob
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-900" /> Hurts win prob
        </div>
        <div className="ml-auto">
          Base: {formatPercent(baseWinProb)}
        </div>
      </div>
    </div>
  );
}
