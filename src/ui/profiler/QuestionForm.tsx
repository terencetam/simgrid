import { useState } from "react";
import type { ProfilerQuestion, Archetype } from "@/engine/profiler";
import { ARCHETYPE_CONFIGS } from "@/engine/profiler";

interface QuestionFormProps {
  archetype: Archetype;
  onSubmit: (answers: Record<string, string | number | boolean>) => void;
  onBack: () => void;
}

export function QuestionForm({ archetype, onSubmit, onBack }: QuestionFormProps) {
  const config = ARCHETYPE_CONFIGS[archetype];
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>(() => {
    const defaults: Record<string, string | number | boolean> = {};
    for (const q of config.questions) {
      defaults[q.id] = q.default;
    }
    return defaults;
  });

  const update = (id: string, value: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{config.name}</h2>
          <p className="text-xs text-zinc-500">{config.description}</p>
        </div>
      </div>

      {config.questions.map((q) => (
        <QuestionInput key={q.id} question={q} value={answers[q.id]} onChange={(v) => update(q.id, v)} />
      ))}

      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="px-6 py-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => onSubmit(answers)}
          className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                     rounded-lg transition-colors text-sm shadow-lg shadow-indigo-900/30"
        >
          Generate My Business
        </button>
      </div>
    </div>
  );
}

function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: ProfilerQuestion;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-300">{q.label}</label>
      {q.helpText && <span className="text-xs text-zinc-600">{q.helpText}</span>}

      {q.type === "number" && (
        <div className="flex items-center gap-2">
          {q.unit === "$" && <span className="text-xs text-zinc-500">$</span>}
          <input
            type="number"
            value={typeof value === "number" ? value : Number(value)}
            min={q.min}
            max={q.max}
            step={q.step}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm
                       font-mono text-zinc-200 focus:outline-none focus:border-indigo-500
                       transition-colors"
          />
          {q.unit === "%" && <span className="text-xs text-zinc-500">({formatPct(value as number)})</span>}
        </div>
      )}

      {q.type === "select" && q.options && (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm
                     text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          {q.options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {q.type === "boolean" && (
        <div className="flex gap-2">
          <button
            onClick={() => onChange(true)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              value === true
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onChange(false)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              value === false
                ? "bg-zinc-700 text-zinc-200"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

function formatPct(v: number): string {
  return v <= 1 ? `${(v * 100).toFixed(1)}%` : `${v}%`;
}
