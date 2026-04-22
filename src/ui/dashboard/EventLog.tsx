import type { Scenario } from "@/engine/schema";
import { formatPercent } from "@/lib/format";

interface EventLogProps {
  scenario: Scenario;
}

export function EventLog({ scenario }: EventLogProps) {
  if (scenario.events.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-5">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
        Events
      </h2>
      <div className="flex flex-col gap-1.5">
        {scenario.events.map((evt) => (
          <div
            key={evt.id}
            className="flex items-center justify-between text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2"
          >
            <span className="text-zinc-300">{evt.name}</span>
            <span className="text-zinc-500 font-mono">
              {evt.trigger.kind === "bernoulli" && evt.trigger.probability != null
                ? `${formatPercent(evt.trigger.probability)}/mo`
                : evt.trigger.kind === "scheduled" && evt.trigger.period != null
                  ? `Month ${evt.trigger.period}`
                  : evt.trigger.kind}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
