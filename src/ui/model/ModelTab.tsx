import { useState, useCallback } from "react";
import { useScenarioStore } from "@/store/scenario-store";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { compile } from "@/engine/core/evaluator";
import type { ModelVariable, VariableGroup } from "@/engine/schema";

const GROUP_LABELS: Record<VariableGroup, string> = {
  revenue: "Revenue",
  growth: "Growth",
  costs: "Costs",
  risk: "Risk & Events",
};

const GROUP_COLORS: Record<VariableGroup, string> = {
  revenue: "text-green-400",
  growth: "text-blue-400",
  costs: "text-orange-400",
  risk: "text-purple-400",
};

function formatValue(value: number, valueType: string | undefined): string {
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

function validateFormula(formula: string): string | null {
  try {
    compile(formula);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid formula";
  }
}

interface EditingState {
  variableId: string;
  field: "name" | "baseValue" | "formula";
  value: string;
}

export function ModelTab() {
  const scenario = useScenarioStore((s) => s.scenario);
  const updateVariableField = useScenarioStore((s) => s.updateVariableField);
  const addVariable = useScenarioStore((s) => s.addVariable);
  const deleteVariable = useScenarioStore((s) => s.deleteVariable);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVar, setNewVar] = useState({
    name: "",
    kind: "input" as "input" | "formula",
    baseValue: "0",
    formula: "",
    group: "revenue" as VariableGroup,
  });

  const startEdit = useCallback(
    (variableId: string, field: "name" | "baseValue" | "formula", currentValue: string) => {
      setEditing({ variableId, field, value: currentValue });
      setFormulaError(null);
    },
    [],
  );

  const commitEdit = useCallback(() => {
    if (!editing) return;

    if (editing.field === "name") {
      updateVariableField(editing.variableId, { name: editing.value });
    } else if (editing.field === "baseValue") {
      const num = parseFloat(editing.value);
      if (!isNaN(num)) {
        updateVariableField(editing.variableId, { baseValue: num });
      }
    } else if (editing.field === "formula") {
      const err = validateFormula(editing.value);
      if (err) {
        setFormulaError(err);
        return;
      }
      updateVariableField(editing.variableId, { formula: editing.value });
    }

    setEditing(null);
    setFormulaError(null);
  }, [editing, updateVariableField]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setFormulaError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") cancelEdit();
    },
    [commitEdit, cancelEdit],
  );

  const handleAdd = useCallback(() => {
    const id = `var_${Date.now()}`;
    const variable: ModelVariable = {
      id,
      name: newVar.name || "New Variable",
      kind: newVar.kind,
      isLever: newVar.kind === "input",
      group: newVar.group,
      ...(newVar.kind === "input"
        ? { baseValue: parseFloat(newVar.baseValue) || 0 }
        : { formula: newVar.formula || "0" }),
    };

    // Validate formula if it's a formula variable
    if (newVar.kind === "formula" && newVar.formula) {
      const err = validateFormula(newVar.formula);
      if (err) {
        setFormulaError(err);
        return;
      }
    }

    addVariable(variable);
    setShowAddForm(false);
    setNewVar({ name: "", kind: "input", baseValue: "0", formula: "", group: "revenue" });
    setFormulaError(null);
  }, [newVar, addVariable]);

  // Group variables
  const groups = new Map<VariableGroup, ModelVariable[]>();
  for (const g of ["revenue", "growth", "costs", "risk"] as VariableGroup[]) {
    groups.set(g, []);
  }
  const ungrouped: ModelVariable[] = [];

  for (const v of scenario.variables) {
    const g = v.group;
    if (g && groups.has(g)) {
      groups.get(g)!.push(v);
    } else {
      ungrouped.push(v);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-300">
          Model Variables ({scenario.variables.length})
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add Variable
        </button>
      </div>

      {/* Add variable form */}
      {showAddForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Variable name"
              value={newVar.name}
              onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 col-span-2"
            />
            <select
              value={newVar.kind}
              onChange={(e) => setNewVar({ ...newVar, kind: e.target.value as "input" | "formula" })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
            >
              <option value="input">Input</option>
              <option value="formula">Formula</option>
            </select>
            <select
              value={newVar.group}
              onChange={(e) => setNewVar({ ...newVar, group: e.target.value as VariableGroup })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
            >
              {(["revenue", "growth", "costs", "risk"] as VariableGroup[]).map((g) => (
                <option key={g} value={g}>{GROUP_LABELS[g]}</option>
              ))}
            </select>
            {newVar.kind === "input" ? (
              <input
                type="number"
                placeholder="Base value"
                value={newVar.baseValue}
                onChange={(e) => setNewVar({ ...newVar, baseValue: e.target.value })}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 col-span-2"
              />
            ) : (
              <input
                type="text"
                placeholder="Formula (e.g. customers * price)"
                value={newVar.formula}
                onChange={(e) => setNewVar({ ...newVar, formula: e.target.value })}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono col-span-2"
              />
            )}
          </div>
          {formulaError && showAddForm && (
            <div className="text-xs text-red-400 mb-2">{formulaError}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormulaError(null); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Variable table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="text-left px-3 py-2 text-zinc-500 font-medium w-[200px]">Name</th>
              <th className="text-left px-3 py-2 text-zinc-500 font-medium w-[60px]">Kind</th>
              <th className="text-left px-3 py-2 text-zinc-500 font-medium">Value / Formula</th>
              <th className="text-left px-3 py-2 text-zinc-500 font-medium w-[80px]">Distribution</th>
              <th className="text-right px-3 py-2 text-zinc-500 font-medium w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {(["revenue", "growth", "costs", "risk"] as VariableGroup[]).map((groupKey) => {
              const vars = groups.get(groupKey) ?? [];
              if (vars.length === 0) return null;

              return (
                <GroupSection
                  key={groupKey}
                  groupKey={groupKey}
                  variables={vars}
                  editing={editing}
                  formulaError={formulaError}
                  onStartEdit={startEdit}
                  onEditChange={(value) => editing && setEditing({ ...editing, value })}
                  onKeyDown={handleKeyDown}
                  onCommit={commitEdit}
                  onCancel={cancelEdit}
                  onDelete={deleteVariable}
                />
              );
            })}
            {ungrouped.length > 0 && (
              <GroupSection
                groupKey={undefined}
                variables={ungrouped}
                editing={editing}
                formulaError={formulaError}
                onStartEdit={startEdit}
                onEditChange={(value) => editing && setEditing({ ...editing, value })}
                onKeyDown={handleKeyDown}
                onCommit={commitEdit}
                onCancel={cancelEdit}
                onDelete={deleteVariable}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface GroupSectionProps {
  groupKey: VariableGroup | undefined;
  variables: ModelVariable[];
  editing: EditingState | null;
  formulaError: string | null;
  onStartEdit: (id: string, field: "name" | "baseValue" | "formula", value: string) => void;
  onEditChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

function GroupSection({
  groupKey,
  variables,
  editing,
  formulaError,
  onStartEdit,
  onEditChange,
  onKeyDown,
  onCommit,
  onCancel,
  onDelete,
}: GroupSectionProps) {
  return (
    <>
      <tr className="bg-zinc-900/50">
        <td
          colSpan={5}
          className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
            groupKey ? GROUP_COLORS[groupKey] : "text-zinc-500"
          }`}
        >
          {groupKey ? GROUP_LABELS[groupKey] : "Other"}
        </td>
      </tr>
      {variables.map((v) => (
        <VariableRow
          key={v.id}
          variable={v}
          editing={editing}
          formulaError={formulaError}
          onStartEdit={onStartEdit}
          onEditChange={onEditChange}
          onKeyDown={onKeyDown}
          onCommit={onCommit}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

interface VariableRowProps {
  variable: ModelVariable;
  editing: EditingState | null;
  formulaError: string | null;
  onStartEdit: (id: string, field: "name" | "baseValue" | "formula", value: string) => void;
  onEditChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

function VariableRow({
  variable: v,
  editing,
  formulaError,
  onStartEdit,
  onEditChange,
  onKeyDown,
  onCommit,
  onCancel: _onCancel,
  onDelete,
}: VariableRowProps) {
  const isEditingName = editing?.variableId === v.id && editing.field === "name";
  const isEditingValue = editing?.variableId === v.id && editing.field === "baseValue";
  const isEditingFormula = editing?.variableId === v.id && editing.field === "formula";

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/30 group">
      {/* Name */}
      <td className="px-3 py-1.5">
        {isEditingName ? (
          <input
            autoFocus
            type="text"
            value={editing!.value}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onCommit}
            className="bg-zinc-800 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-zinc-200 w-full"
          />
        ) : (
          <button
            onClick={() => onStartEdit(v.id, "name", v.name)}
            className="text-zinc-300 hover:text-zinc-100 text-left transition-colors"
          >
            {v.name}
          </button>
        )}
      </td>

      {/* Kind badge */}
      <td className="px-3 py-1.5">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            v.kind === "input"
              ? "bg-green-900/40 text-green-400"
              : "bg-blue-900/40 text-blue-400"
          }`}
        >
          {v.kind === "input" ? "input" : "f(x)"}
        </span>
      </td>

      {/* Value / Formula */}
      <td className="px-3 py-1.5">
        {v.kind === "input" ? (
          isEditingValue ? (
            <input
              autoFocus
              type="number"
              value={editing!.value}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={onCommit}
              className="bg-zinc-800 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-zinc-200 font-mono w-32"
            />
          ) : (
            <button
              onClick={() => onStartEdit(v.id, "baseValue", String(v.baseValue ?? 0))}
              className="font-mono text-zinc-200 hover:text-zinc-100 transition-colors"
            >
              {formatValue(v.baseValue ?? 0, v.valueType)}
            </button>
          )
        ) : isEditingFormula ? (
          <div className="flex flex-col gap-1">
            <input
              autoFocus
              type="text"
              value={editing!.value}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={onCommit}
              className="bg-zinc-800 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-zinc-200 font-mono w-full"
            />
            {formulaError && (
              <span className="text-[10px] text-red-400">{formulaError}</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => onStartEdit(v.id, "formula", v.formula ?? "")}
            className="font-mono text-zinc-400 hover:text-zinc-200 transition-colors text-left truncate max-w-[300px] block"
            title={v.formula}
          >
            {v.formula || "—"}
          </button>
        )}
      </td>

      {/* Distribution */}
      <td className="px-3 py-1.5 text-zinc-500">
        {v.distribution ? (
          <span className="text-[10px]">
            {v.distribution.kind === "bernoulli"
              ? `B(${v.distribution.params.p ?? 0})`
              : `${v.distribution.kind.charAt(0).toUpperCase()}(${Object.values(v.distribution.params).join(", ")})`}
          </span>
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </td>

      {/* Delete */}
      <td className="px-3 py-1.5 text-right">
        <button
          onClick={() => onDelete(v.id)}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
          title="Delete variable"
        >
          &times;
        </button>
      </td>
    </tr>
  );
}
