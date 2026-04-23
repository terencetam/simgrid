import { Handle, Position } from "@xyflow/react";
import type { SystemNodeData } from "./graph-builder";

export function FlowNode({ data }: { data: SystemNodeData }) {
  return (
    <div className="bg-zinc-800 border-2 border-amber-500 rounded-md px-3 py-2 min-w-[120px] shadow-lg"
      style={{ clipPath: "polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)" }}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <div className="text-center">
        <div className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-0.5">
          Flow
        </div>
        <div className="text-xs font-medium text-zinc-100">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2.5 !h-2.5" />
    </div>
  );
}
