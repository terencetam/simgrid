import { Handle, Position } from "@xyflow/react";
import type { SystemNodeData } from "./graph-builder";
import { formatCurrency } from "@/lib/format";

export function StockNode({ data }: { data: SystemNodeData }) {
  return (
    <div className="bg-zinc-800 border-2 border-emerald-500 rounded-lg px-4 py-3 min-w-[140px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-2.5 !h-2.5" />
      <div className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mb-1">
        Stock
      </div>
      <div className="text-sm font-medium text-zinc-100">{data.label}</div>
      {data.value !== undefined && (
        <div className="text-xs font-mono text-zinc-400 mt-1">
          {formatCurrency(data.value)}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-2.5 !h-2.5" />
    </div>
  );
}
