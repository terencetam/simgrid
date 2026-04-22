import { TEMPLATES } from "@/engine/templates";
import { ARCHETYPE_CONFIGS } from "@/engine/profiler";
import { formatCurrency } from "@/lib/format";

interface TemplatePickerProps {
  onSelect: (scenarioId: string) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Object.entries(TEMPLATES).map(([id, scenario]) => {
        const arch = scenario.businessProfile?.archetype;
        const config = arch ? ARCHETYPE_CONFIGS[arch] : null;

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex flex-col items-start gap-2 p-4 bg-zinc-900 border border-zinc-800
                       rounded-lg hover:border-indigo-500 hover:bg-zinc-800/80
                       transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{config?.icon ?? "📊"}</span>
              <span className="text-xs font-semibold text-zinc-200">{scenario.name}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-[10px] text-zinc-500">
              <span>{scenario.horizonPeriods} {scenario.timeStep}s</span>
              <span>{formatCurrency(scenario.startingCash)} starting cash</span>
              <span>{scenario.goals.length} goal{scenario.goals.length !== 1 ? "s" : ""}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
