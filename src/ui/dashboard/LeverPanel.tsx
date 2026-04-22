import { useMemo } from "react";
import { useScenarioStore } from "@/store/scenario-store";
import { Lever } from "@/ui/levers/Lever";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { getLabel, isHidden } from "@/engine/profiler";
import type { Variable } from "@/engine/schema";

interface LeverDef {
  label: string;
  variable: Variable;
  format: (v: number) => string;
  min: number;
  max: number;
  step: number;
}

function isPercent(v: Variable): boolean {
  return v.baseValue > 0 && v.baseValue <= 1;
}

function inferRange(v: Variable): { min: number; max: number; step: number } {
  const base = v.baseValue;
  if (isPercent(v)) {
    return { min: 0.005, max: Math.min(base * 5, 1), step: 0.005 };
  }
  if (base === 0) {
    return { min: 0, max: 100, step: 1 };
  }
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(base))));
  return {
    min: 0,
    max: Math.ceil((base * 3) / mag) * mag,
    step: Math.max(1, mag / 10),
  };
}

const MAX_LEVERS = 8;

export function LeverPanel() {
  const scenario = useScenarioStore((s) => s.scenario);
  const updateVariable = useScenarioStore((s) => s.updateVariable);
  const archetype = scenario.businessProfile?.archetype;

  const levers = useMemo(() => {
    const defs: LeverDef[] = [];

    const tryAdd = (fieldPath: string, v: Variable | undefined) => {
      if (!v) return;
      if (isHidden(archetype, fieldPath)) return;
      const label = getLabel(archetype, fieldPath, v.name);
      const range = inferRange(v);
      const fmt = isPercent(v)
        ? (val: number) => formatPercent(val, 1)
        : (val: number) => formatCurrency(val);
      defs.push({ label, variable: v, format: fmt, ...range });
    };

    // Products
    for (const p of scenario.products) {
      tryAdd("product.price", p.price);
      tryAdd("product.unitCogs", p.unitCogs);
    }

    // Segments
    for (const seg of scenario.segments) {
      tryAdd("segment.churnRate", seg.churnRate);
      tryAdd("segment.tam", seg.tam);
    }

    // Ad channels
    for (const ad of scenario.adChannels) {
      tryAdd("adChannel.spend", ad.spend);
      tryAdd("adChannel.cac", ad.cac);
    }

    // Channels
    for (const ch of scenario.channels) {
      tryAdd("channel.conversionRate", ch.conversionRate);
      tryAdd("channel.capacityPerPeriod", ch.capacityPerPeriod);
    }

    // Stores
    for (const store of scenario.stores) {
      tryAdd("store.fixedCostPerUnit", store.fixedCostPerUnit);
      tryAdd("store.revenueCapPerUnit", store.revenueCapPerUnit);
    }

    // Sales roles
    for (const sr of scenario.salesRoles) {
      tryAdd("salesRole.fullyLoadedCost", sr.fullyLoadedCost);
      tryAdd("salesRole.quota", sr.quota);
    }

    // Headcount
    for (const hc of scenario.otherHeadcount) {
      tryAdd("headcount.salary", hc.salary);
    }

    return defs.slice(0, MAX_LEVERS);
  }, [scenario, archetype]);

  // Sales rep count lever (special — it's a count, not a variable)
  const repCount = scenario.salesRoles[0];

  return (
    <div className="flex flex-col gap-5 p-5">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
        Levers
      </h2>

      {levers.map((lever) => (
        <Lever
          key={lever.variable.id}
          label={lever.label}
          value={lever.variable.baseValue}
          min={lever.min}
          max={lever.max}
          step={lever.step}
          format={lever.format}
          onChange={(v) => updateVariable(lever.variable.id, v)}
        />
      ))}

      {repCount && (
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
    </div>
  );
}
