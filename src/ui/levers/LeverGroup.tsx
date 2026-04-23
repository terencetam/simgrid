import { useState, type ReactNode } from "react";

interface LeverGroupProps {
  label: string;
  color: string;
  textColor: string;
  count: number;
  children: ReactNode;
  onAdd?: () => void;
}

export function LeverGroup({
  label,
  color,
  textColor,
  count,
  children,
  onAdd,
}: LeverGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
      >
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${textColor}`}>
          {label}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto mr-2">{count}</span>
        <svg
          className={`w-3 h-3 text-zinc-600 transition-transform ${collapsed ? "" : "rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 flex flex-col gap-3">
          {children}
          {onAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add variable
            </button>
          )}
        </div>
      )}
    </div>
  );
}
