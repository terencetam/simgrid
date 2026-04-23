import { useMemo, useState, useCallback } from "react";
import { useScenarioStore } from "@/store/scenario-store";
import { Lever } from "@/ui/levers/Lever";
import { LeverGroup } from "@/ui/levers/LeverGroup";
import { AddVariableInline } from "@/ui/levers/AddVariableInline";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { getLabel, isHidden, getGroupLabel } from "@/engine/profiler";
import {
  collectVariables,
  type RegisteredVariable,
} from "@/engine/core/variable-registry";
import type { VariableGroup } from "@/engine/schema";

interface LeverDef {
  regVar: RegisteredVariable;
  label: string;
  format: (v: number) => string;
  min: number;
  max: number;
  step: number;
  isCustom: boolean;
  linkCount: number;
}

function inferRange(
  baseValue: number,
  valueType: string,
): { min: number; max: number; step: number } {
  if (valueType === "percent") {
    return { min: 0, max: Math.min(baseValue * 5, 1), step: 0.005 };
  }
  if (valueType === "count") {
    return { min: 0, max: Math.max(20, baseValue * 3), step: 1 };
  }
  if (valueType === "days") {
    return { min: 0, max: Math.max(120, baseValue * 3), step: 1 };
  }
  if (baseValue === 0) {
    return { min: 0, max: 100, step: 1 };
  }
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(baseValue))));
  return {
    min: 0,
    max: Math.ceil((baseValue * 3) / mag) * mag,
    step: Math.max(1, mag / 10),
  };
}

function formatByType(
  value: number,
  valueType: string,
): string {
  switch (valueType) {
    case "percent":
      return formatPercent(value, 1);
    case "count":
      return formatNumber(value);
    case "days":
      return `${Math.round(value)}d`;
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
  { key: "sales_marketing", color: "bg-blue-500", textColor: "text-blue-400" },
  { key: "operations", color: "bg-orange-500", textColor: "text-orange-400" },
  { key: "finance", color: "bg-purple-500", textColor: "text-purple-400" },
];

export function LeverPanel() {
  const scenario = useScenarioStore((s) => s.scenario);
  const updateVariable = useScenarioStore((s) => s.updateVariable);
  const addCustomVariable = useScenarioStore((s) => s.addCustomVariable);
  const deleteCustomVariable = useScenarioStore((s) => s.deleteCustomVariable);
  const archetype = scenario.businessProfile?.archetype;

  const [addingGroup, setAddingGroup] = useState<VariableGroup | null>(null);

  const causalLinkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of scenario.causalLinks ?? []) {
      counts.set(link.targetId, (counts.get(link.targetId) ?? 0) + 1);
    }
    return counts;
  }, [scenario.causalLinks]);

  const grouped = useMemo(() => {
    const allVars = collectVariables(scenario);
    const groups = new Map<VariableGroup, LeverDef[]>();

    for (const groupKey of GROUP_CONFIG.map((g) => g.key)) {
      groups.set(groupKey, []);
    }

    for (const [, regVar] of allVars) {
      if (isHidden(archetype, regVar.fieldPath)) continue;

      const label = getLabel(archetype, regVar.fieldPath, regVar.variable.name);
      const vt = regVar.valueType;
      const range = inferRange(regVar.variable.baseValue, vt);
      const fmt = (v: number) => formatByType(v, vt);

      const leverDef: LeverDef = {
        regVar,
        label,
        format: fmt,
        ...range,
        isCustom: regVar.primitiveType === "customVariables",
        linkCount: causalLinkCounts.get(regVar.variable.id) ?? 0,
      };

      const group = groups.get(regVar.group);
      if (group) {
        group.push(leverDef);
      }
    }

    return groups;
  }, [scenario, archetype, causalLinkCounts]);

  // Also include sales rep count as a pseudo-lever in sales_marketing
  const repCount = scenario.salesRoles[0];

  const handleAdd = useCallback(
    (group: VariableGroup, name: string, baseValue: number) => {
      addCustomVariable(group, name, baseValue);
      setAddingGroup(null);
    },
    [addCustomVariable],
  );

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Levers
        </h2>
      </div>

      {GROUP_CONFIG.map((gc) => {
        const levers = grouped.get(gc.key) ?? [];

        // Include rep count in sales_marketing
        const showRepCount = gc.key === "sales_marketing" && repCount;
        const totalCount = levers.length + (showRepCount ? 1 : 0);

        if (totalCount === 0 && gc.key !== "revenue") return null;

        return (
          <LeverGroup
            key={gc.key}
            label={getGroupLabel(archetype, gc.key)}
            color={gc.color}
            textColor={gc.textColor}
            count={totalCount}
            onAdd={() => setAddingGroup(gc.key)}
          >
            {levers.map((lever) => (
              <div key={lever.regVar.variable.id} className="relative group">
                <Lever
                  label={lever.label}
                  value={lever.regVar.variable.baseValue}
                  min={lever.min}
                  max={lever.max}
                  step={lever.step}
                  format={lever.format}
                  onChange={(v) => updateVariable(lever.regVar.variable.id, v)}
                />
                {/* Link indicator */}
                {lever.linkCount > 0 && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                    {Array.from({ length: Math.min(lever.linkCount, 3) }).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-70" />
                    ))}
                  </div>
                )}
                {/* Delete button for custom variables */}
                {lever.isCustom && (
                  <button
                    onClick={() => deleteCustomVariable(lever.regVar.variable.id)}
                    className="absolute -right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 text-xs"
                    title="Delete variable"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}

            {/* Sales rep count (special non-variable lever) */}
            {showRepCount && (
              <Lever
                label={getLabel(archetype, "salesRole.count", "Sales reps")}
                value={repCount.count}
                min={0}
                max={20}
                step={1}
                format={(v) => formatNumber(v)}
                onChange={(v) => {
                  const updated = structuredClone(scenario);
                  updated.salesRoles[0].count = Math.round(v);
                  useScenarioStore.getState().updateScenario(updated);
                }}
              />
            )}

            {/* Inline add form */}
            {addingGroup === gc.key && (
              <AddVariableInline
                group={gc.key}
                onAdd={handleAdd}
                onCancel={() => setAddingGroup(null)}
              />
            )}
          </LeverGroup>
        );
      })}
    </div>
  );
}
