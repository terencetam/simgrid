import { Handle, Position } from "@xyflow/react";
import type { SystemNodeData } from "./graph-builder";
import { formatCurrency, formatPercent } from "@/lib/format";

const GROUP_COLORS: Record<string, string> = {
  revenue: "border-green-500",
  sales_marketing: "border-blue-500",
  operations: "border-orange-500",
  finance: "border-purple-500",
};

const GROUP_TEXT_COLORS: Record<string, string> = {
  revenue: "text-green-400",
  sales_marketing: "text-blue-400",
  operations: "text-orange-400",
  finance: "text-purple-400",
};

function formatValue(value: number): string {
  if (value > 0 && value <= 1) return formatPercent(value, 1);
  return formatCurrency(value);
}

export function ConverterNode({ data }: { data: SystemNodeData }) {
  const borderColor = GROUP_COLORS[data.group ?? "operations"] ?? "border-zinc-500";
  const textColor = GROUP_TEXT_COLORS[data.group ?? "operations"] ?? "text-zinc-400";

  return (
    <div className={`bg-zinc-800 border-2 ${borderColor} rounded-full px-4 py-2.5 min-w-[100px] shadow-lg flex flex-col items-center`}>
      <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-2.5 !h-2.5" />
      <div className={`text-[10px] ${textColor} uppercase tracking-wider font-semibold`}>
        Converter
      </div>
      <div className="text-xs font-medium text-zinc-100 text-center leading-tight mt-0.5">
        {data.label}
      </div>
      {data.value !== undefined && (
        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
          {formatValue(data.value)}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-2.5 !h-2.5" />
    </div>
  );
}
