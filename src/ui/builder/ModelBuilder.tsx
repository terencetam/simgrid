import { useState } from "react";
import type { Scenario, Variable } from "@/engine/schema";
import { formatCurrency } from "@/lib/format";

interface ModelBuilderProps {
  scenario: Scenario;
  onUpdateVariable: (variableId: string, baseValue: number) => void;
  onUpdateScenario: (patch: Partial<Scenario>) => void;
}

type SectionKey = "products" | "segments" | "channels" | "salesRoles" | "adChannels" | "headcount" | "general";

const SECTION_LABELS: Record<SectionKey, string> = {
  products: "Products",
  segments: "Market Segments",
  channels: "Sales Channels",
  salesRoles: "Sales Team",
  adChannels: "Marketing Channels",
  headcount: "Headcount",
  general: "General Settings",
};

function VariableInput({
  variable,
  onUpdate,
  suffix,
}: {
  variable: Variable;
  onUpdate: (id: string, value: number) => void;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(variable.baseValue));

  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v)) onUpdate(variable.id, v);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-1.5 group">
      <span className="text-xs text-zinc-400 truncate mr-2">
        {variable.name}
        {variable.kind !== "constant" && (
          <span className="ml-1 text-[10px] text-zinc-600">({variable.kind})</span>
        )}
      </span>
      {editing ? (
        <input
          type="number"
          className="w-28 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-xs font-mono text-zinc-200 text-right focus:outline-none focus:border-indigo-500"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button
          className="text-xs font-mono text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 rounded px-2 py-0.5 transition-colors"
          onClick={() => {
            setDraft(String(variable.baseValue));
            setEditing(true);
          }}
        >
          {variable.baseValue < 1 && variable.baseValue > 0
            ? `${(variable.baseValue * 100).toFixed(1)}%`
            : formatCurrency(variable.baseValue)}
          {suffix ? ` ${suffix}` : ""}
        </button>
      )}
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800/80 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          {title}
        </span>
        <span className="text-zinc-500 text-xs">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="px-4 py-2 bg-zinc-950">{children}</div>}
    </div>
  );
}

export function ModelBuilder({ scenario, onUpdateVariable, onUpdateScenario }: ModelBuilderProps) {
  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        Model Builder
      </h2>

      <div className="flex flex-col gap-3">
        {/* General Settings */}
        <Section title={SECTION_LABELS.general} defaultOpen>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-zinc-400">Horizon</span>
              <span className="text-xs font-mono text-zinc-200">
                {scenario.horizonPeriods} {scenario.timeStep}s
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-zinc-400">Starting Cash</span>
              <span className="text-xs font-mono text-zinc-200">
                {formatCurrency(scenario.startingCash)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-zinc-400">Currency</span>
              <span className="text-xs font-mono text-zinc-200">{scenario.currency}</span>
            </div>
            {scenario.paymentTerms && (
              <>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-zinc-400">DSO (days)</span>
                  <span className="text-xs font-mono text-zinc-200">{scenario.paymentTerms.dso}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-zinc-400">DPO (days)</span>
                  <span className="text-xs font-mono text-zinc-200">{scenario.paymentTerms.dpo}</span>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Products */}
        {scenario.products.length > 0 && (
          <Section title={`${SECTION_LABELS.products} (${scenario.products.length})`} defaultOpen>
            {scenario.products.map((p) => (
              <div key={p.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-zinc-300 mb-1">{p.name}</div>
                <VariableInput variable={p.price} onUpdate={onUpdateVariable} />
                <VariableInput variable={p.unitCogs} onUpdate={onUpdateVariable} />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-zinc-500">Contribution margin</span>
                  <span className="text-xs font-mono text-green-400">
                    {formatCurrency(p.price.baseValue - p.unitCogs.baseValue)} ({((1 - p.unitCogs.baseValue / p.price.baseValue) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Segments */}
        {scenario.segments.length > 0 && (
          <Section title={`${SECTION_LABELS.segments} (${scenario.segments.length})`} defaultOpen>
            {scenario.segments.map((seg) => (
              <div key={seg.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-zinc-300 mb-1">{seg.name}</div>
                <VariableInput variable={seg.tam} onUpdate={onUpdateVariable} />
                <VariableInput variable={seg.ourShare} onUpdate={onUpdateVariable} />
                <VariableInput variable={seg.churnRate} onUpdate={onUpdateVariable} />
                <VariableInput variable={seg.acv} onUpdate={onUpdateVariable} />
              </div>
            ))}
          </Section>
        )}

        {/* Channels */}
        {scenario.channels.length > 0 && (
          <Section title={`${SECTION_LABELS.channels} (${scenario.channels.length})`}>
            {scenario.channels.map((ch) => (
              <div key={ch.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-zinc-300 mb-1">
                  {ch.name}
                  <span className="ml-1 text-[10px] text-zinc-600">({ch.channelType})</span>
                </div>
                <VariableInput variable={ch.capacityPerPeriod} onUpdate={onUpdateVariable} />
                <VariableInput variable={ch.conversionRate} onUpdate={onUpdateVariable} />
                <VariableInput variable={ch.fixedCost} onUpdate={onUpdateVariable} />
                <VariableInput variable={ch.variableCostPct} onUpdate={onUpdateVariable} />
              </div>
            ))}
          </Section>
        )}

        {/* Sales Roles */}
        {scenario.salesRoles.length > 0 && (
          <Section title={`${SECTION_LABELS.salesRoles} (${scenario.salesRoles.length})`}>
            {scenario.salesRoles.map((sr) => (
              <div key={sr.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-zinc-300 mb-1">
                  {sr.name}
                  <span className="ml-1 text-[10px] text-zinc-600">({sr.count} people)</span>
                </div>
                <VariableInput variable={sr.fullyLoadedCost} onUpdate={onUpdateVariable} />
                <VariableInput variable={sr.quota} onUpdate={onUpdateVariable} />
                <VariableInput variable={sr.quotaHitProbability} onUpdate={onUpdateVariable} />
              </div>
            ))}
          </Section>
        )}

        {/* Ad Channels */}
        {scenario.adChannels.length > 0 && (
          <Section title={`${SECTION_LABELS.adChannels} (${scenario.adChannels.length})`}>
            {scenario.adChannels.map((ad) => (
              <div key={ad.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-zinc-300 mb-1">{ad.name}</div>
                <VariableInput variable={ad.spend} onUpdate={onUpdateVariable} />
                <VariableInput variable={ad.cac} onUpdate={onUpdateVariable} />
              </div>
            ))}
          </Section>
        )}

        {/* Headcount */}
        {scenario.otherHeadcount.length > 0 && (
          <Section title={`${SECTION_LABELS.headcount} (${scenario.otherHeadcount.length})`}>
            {scenario.otherHeadcount.map((hc) => (
              <div key={hc.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-zinc-300 mb-1">
                  {hc.name}
                  <span className="ml-1 text-[10px] text-zinc-600">({hc.count} people)</span>
                </div>
                <VariableInput variable={hc.salary} onUpdate={onUpdateVariable} />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-zinc-500">Fully loaded cost</span>
                  <span className="text-xs font-mono text-zinc-300">
                    {formatCurrency(hc.salary.baseValue * hc.onCostsMultiplier)} /mo
                  </span>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Goals */}
        <Section title={`Goals (${scenario.goals.length})`}>
          {scenario.goals.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-zinc-400">
                {g.metric} {g.direction === "at_least" ? "≥" : g.direction === "at_most" ? "≤" : "between"}{" "}
                {g.metric === "cash" ? formatCurrency(g.threshold) : formatCurrency(g.threshold)}
              </span>
              <span className="text-[10px] text-zinc-600">
                by M{g.byPeriod}{g.allPeriods ? " (all periods)" : ""}
              </span>
            </div>
          ))}
        </Section>

        {/* Events */}
        {scenario.events.length > 0 && (
          <Section title={`Events (${scenario.events.length})`}>
            {scenario.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-zinc-400">{e.name}</span>
                <span className="text-[10px] text-zinc-600">
                  {e.trigger.kind === "bernoulli"
                    ? `${((e.trigger.probability ?? 0) * 100).toFixed(0)}% /period`
                    : e.trigger.kind}
                </span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
