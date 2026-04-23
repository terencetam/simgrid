import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { CausalEdgeData } from "./graph-builder";

export function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as CausalEdgeData | undefined;
  const isPositive = edgeData?.polarity === "positive";
  const color = isPositive ? "#22c55e" : "#ef4444";
  const label = isPositive ? "+" : "\u2212";

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          opacity: selected ? 1 : 0.7,
        }}
        markerEnd={`url(#marker-${isPositive ? "positive" : "negative"})`}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div
            className={`
              text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center
              ${isPositive ? "bg-green-900 text-green-300 border border-green-600" : "bg-red-900 text-red-300 border border-red-600"}
              ${selected ? "ring-2 ring-white/30" : ""}
            `}
          >
            {label}
          </div>
          {selected && edgeData && (
            <div className="mt-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-[10px] text-zinc-300 whitespace-nowrap">
              Strength: {edgeData.strength.toFixed(1)}
              {edgeData.delay > 0 && ` | Delay: ${edgeData.delay}p`}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
