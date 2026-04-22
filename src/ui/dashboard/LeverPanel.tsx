import { useScenarioStore } from "@/store/scenario-store";
import { Lever } from "@/ui/levers/Lever";
import { formatCurrency, formatPercent } from "@/lib/format";

export function LeverPanel() {
  const scenario = useScenarioStore((s) => s.scenario);
  const updateVariable = useScenarioStore((s) => s.updateVariable);

  const price = scenario.products[0]?.price;
  const churn = scenario.segments[0]?.churnRate;
  const adSpend = scenario.adChannels[0]?.spend;
  const adCac = scenario.adChannels[0]?.cac;
  const repCount = scenario.salesRoles[0];
  const convRate = scenario.channels[0]?.conversionRate;

  return (
    <div className="flex flex-col gap-5 p-5">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
        Levers
      </h2>

      {price && (
        <Lever
          label="Monthly price"
          value={price.baseValue}
          min={19}
          max={299}
          step={1}
          format={(v) => formatCurrency(v)}
          onChange={(v) => updateVariable(price.id, v)}
        />
      )}

      {churn && (
        <Lever
          label="Monthly churn rate"
          value={churn.baseValue}
          min={0.01}
          max={0.15}
          step={0.005}
          format={(v) => formatPercent(v, 1)}
          onChange={(v) => updateVariable(churn.id, v)}
        />
      )}

      {adSpend && (
        <Lever
          label="Monthly ad spend"
          value={adSpend.baseValue}
          min={0}
          max={50000}
          step={1000}
          format={(v) => formatCurrency(v)}
          onChange={(v) => updateVariable(adSpend.id, v)}
        />
      )}

      {adCac && (
        <Lever
          label="CAC (cost per acq.)"
          value={adCac.baseValue}
          min={100}
          max={1000}
          step={10}
          format={(v) => formatCurrency(v)}
          onChange={(v) => updateVariable(adCac.id, v)}
        />
      )}

      {convRate && (
        <Lever
          label="Conversion rate"
          value={convRate.baseValue}
          min={0.005}
          max={0.15}
          step={0.005}
          format={(v) => formatPercent(v, 1)}
          onChange={(v) => updateVariable(convRate.id, v)}
        />
      )}

      {repCount && (
        <Lever
          label="Sales reps"
          value={repCount.count}
          min={0}
          max={20}
          step={1}
          format={(v) => `${v}`}
          onChange={(v) => {
            // For count, we update the scenario directly
            const updated = structuredClone(scenario);
            updated.salesRoles[0].count = Math.round(v);
            useScenarioStore.getState().updateScenario(updated);
          }}
        />
      )}
    </div>
  );
}
