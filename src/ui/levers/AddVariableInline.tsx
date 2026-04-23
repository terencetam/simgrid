import { useState } from "react";
import type { VariableGroup } from "@/engine/schema";

interface AddVariableInlineProps {
  group: VariableGroup;
  onAdd: (group: VariableGroup, name: string, baseValue: number) => void;
  onCancel: () => void;
}

export function AddVariableInline({ group, onAdd, onCancel }: AddVariableInlineProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(group, trimmed, parseFloat(value) || 0);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2 bg-zinc-800/50 rounded-md border border-zinc-700">
      <input
        type="text"
        placeholder="Variable name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
      />
      <input
        type="number"
        placeholder="Initial value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 px-2 py-1 text-[10px] font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-2 py-1 text-[10px] font-medium text-zinc-400 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
