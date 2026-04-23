import { useMemo } from "react";
import { useScenarioStore } from "@/store/scenario-store";
import { Lever } from "@/ui/levers/Lever";
import { LeverGroup } from "@/ui/levers/LeverGroup";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { getGroupLabel } from "@/engine/profiler/vocabulary";
import type { ModelVariable, VariableGroup } from "@/engine/schema";

function formatByType(value: number, valueType: string | undefined): string {
  switch (valueType) {
    case "percent":
      return formatPercent(value, 1);
    case "count":
      return formatNumber(value);
    case "ratio":
      return value.toFixed(2);
    default:
      return formatCurrency(value);
  }
}

const GROUP_CONFIG: {
  key: VariableGroup;
  color: string;
  textColor: string;
}[] = [
  { key: "revenue", color: "bg-green-500", textColor: "text-green-400" },
  { key: "growth", color: "bg-blue-500", textColor: "text-blue-400" },
  { key: "costs", color: "bg-orange-500", textColor: "text-orange-400" },
  { key: "risk", color: "bg-purple-500", textColor: "text-purple-400" },
];

export function LeverPanel() {
  const scenario = useScenarioStore((s) => s.scenario);
  const updateVariable = useScenarioStore((s) => s.updateVariable);
  const archetype = scenario.businessProfile?.archetype;

  const grouped = useMemo(() => {
    const groups = new Map<VariableGroup, ModelVariable[]>();
    for (const gc of GROUP_CONFIG) {
      groups.set(gc.key, []);
    }

    for (const v of scenario.variables) {
      if (v.kind !== "input" || !v.isLever) continue;
      const group = v.group ?? "revenue";
      const list = groups.get(group);
      if (list) list.push(v);
    }

    return groups;
  }, [scenario.variables]);

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Levers
        </h2>
      </div>

      {GROUP_CONFIG.map((gc) => {
        const levers = grouped.get(gc.key) ?? [];
        if (levers.length === 0) return null;

        return (
          <LeverGroup
            key={gc.key}
            label={getGroupLabel(archetype, gc.key)}
            color={gc.color}
            textColor={gc.textColor}
            count={levers.length}
          >
            {levers.map((v) => (
              <Lever
                key={v.id}
                label={v.name}
                value={v.baseValue ?? 0}
                min={v.min ?? 0}
                max={v.max ?? (v.baseValue ?? 0) * 3}
                step={v.step ?? 1}
                format={(val) => formatByType(val, v.valueType)}
                onChange={(val) => updateVariable(v.id, val)}
              />
            ))}
          </LeverGroup>
        );
      })}
    </div>
  );
}
