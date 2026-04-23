import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useScenarioStore } from "@/store/scenario-store";
import { buildSystemGraph, type CausalEdgeData } from "./graph-builder";
import { StockNode } from "./StockNode";
import { FlowNode } from "./FlowNode";
import { ConverterNode } from "./ConverterNode";
import { CausalEdge } from "./CausalEdge";
import { EdgeConfigPanel } from "./EdgeConfigPanel";
import type { CausalLink } from "@/engine/schema";

const nodeTypes: NodeTypes = {
  stock: StockNode,
  flow: FlowNode,
  converter: ConverterNode,
};

const edgeTypes: EdgeTypes = {
  causal: CausalEdge,
};

// Custom SVG markers for edge arrows
function EdgeMarkers() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <marker
          id="marker-positive"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
        </marker>
        <marker
          id="marker-negative"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}

export function SystemEditor() {
  const scenario = useScenarioStore((s) => s.scenario);
  const addCausalLink = useScenarioStore((s) => s.addCausalLink);
  const updateNodePositions = useScenarioStore((s) => s.updateNodePositions);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildSystemGraph(scenario),
    [scenario],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedLink, setSelectedLink] = useState<CausalLink | null>(null);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Persist position changes
      const positionUpdates: Record<string, { x: number; y: number }> = {};
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          positionUpdates[change.id] = change.position;
        }
      }
      if (Object.keys(positionUpdates).length > 0) {
        updateNodePositions(positionUpdates);
      }
    },
    [onNodesChange, updateNodePositions],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const newLink: CausalLink = {
        id: crypto.randomUUID(),
        sourceId: connection.source,
        targetId: connection.target,
        polarity: "positive",
        strength: 1.0,
        delay: 0,
        noise: 0,
      };

      addCausalLink(newLink);

      // Add edge to local state
      const newEdge: Edge<CausalEdgeData> = {
        id: newLink.id,
        source: connection.source,
        target: connection.target,
        type: "causal",
        data: {
          polarity: "positive",
          strength: 1.0,
          delay: 0,
          noise: 0,
          linkId: newLink.id,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [addCausalLink, setEdges],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      // Only allow editing causal links (not implicit edges)
      if (edge.type !== "causal") return;
      const link = (scenario.causalLinks ?? []).find((l) => l.id === edge.id);
      if (link) setSelectedLink(link);
    },
    [scenario.causalLinks],
  );

  return (
    <div className="w-full h-full relative">
      <EdgeMarkers />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-zinc-900"
        defaultEdgeOptions={{ animated: false }}
      >
        <Controls className="!bg-zinc-800 !border-zinc-600 [&_button]:!bg-zinc-700 [&_button]:!border-zinc-600 [&_button]:!text-zinc-300" />
        <MiniMap
          className="!bg-zinc-800 !border-zinc-600"
          nodeColor={(node) => {
            switch (node.type) {
              case "stock": return "#10b981";
              case "flow": return "#f59e0b";
              case "converter": return "#6366f1";
              default: return "#71717a";
            }
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
      </ReactFlow>

      {selectedLink && (
        <EdgeConfigPanel
          link={selectedLink}
          onClose={() => setSelectedLink(null)}
        />
      )}
    </div>
  );
}
