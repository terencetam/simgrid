/**
 * Graph Builder — converts a Scenario into React Flow nodes and edges.
 * Pure function, no React dependencies.
 */
import type { Scenario } from "@/engine/schema";
import type { Node, Edge } from "@xyflow/react";
import { collectVariables } from "@/engine/core/variable-registry";

export type SystemNodeType = "stock" | "flow" | "converter";

export interface SystemNodeData {
  label: string;
  value?: number;
  nodeType: SystemNodeType;
  variableId?: string;
  fieldPath?: string;
  group?: string;
  [key: string]: unknown;
}

export interface CausalEdgeData {
  polarity: "positive" | "negative";
  strength: number;
  delay: number;
  noise: number;
  linkId: string;
  [key: string]: unknown;
}

// ─── Layout constants ───────────────────────────────────────────

const COL_CONVERTER = 0;
const COL_FLOW = 400;
const COL_STOCK = 800;
const ROW_GAP = 100;
const START_Y = 50;

// ─── Stock definitions (derived from scenario structure) ────────

interface StockDef {
  id: string;
  label: string;
  value: number;
}

function getStocks(scenario: Scenario): StockDef[] {
  const stocks: StockDef[] = [
    { id: "stock-cash", label: "Cash", value: scenario.startingCash },
  ];

  if (scenario.segments.length > 0) {
    const totalCustomers = scenario.segments.reduce(
      (sum, seg) => sum + seg.ourShare.baseValue,
      0,
    );
    stocks.push({ id: "stock-customers", label: "Customers", value: totalCustomers });
  }

  const totalHeadcount =
    scenario.salesRoles.reduce((s, r) => s + r.count, 0) +
    scenario.otherHeadcount.reduce((s, h) => s + h.count, 0);
  if (totalHeadcount > 0) {
    stocks.push({ id: "stock-headcount", label: "Headcount", value: totalHeadcount });
  }

  return stocks;
}

// ─── Flow definitions (implicit in simulateRun) ─────────────────

interface FlowDef {
  id: string;
  label: string;
  targetStock: string;
  direction: "inflow" | "outflow";
}

function getFlows(scenario: Scenario): FlowDef[] {
  const flows: FlowDef[] = [];

  if (scenario.products.length > 0 || scenario.segments.length > 0) {
    flows.push({ id: "flow-revenue", label: "Revenue", targetStock: "stock-cash", direction: "inflow" });
  }
  if (scenario.products.length > 0) {
    flows.push({ id: "flow-cogs", label: "COGS", targetStock: "stock-cash", direction: "outflow" });
  }
  if (scenario.otherHeadcount.length > 0 || scenario.salesRoles.length > 0) {
    flows.push({ id: "flow-opex", label: "Operating Expenses", targetStock: "stock-cash", direction: "outflow" });
  }
  if (scenario.adChannels.length > 0 || scenario.salesRoles.length > 0) {
    flows.push({ id: "flow-acquisition", label: "Customer Acquisition", targetStock: "stock-customers", direction: "inflow" });
  }
  if (scenario.segments.some((s) => s.churnRate.baseValue > 0)) {
    flows.push({ id: "flow-churn", label: "Churn", targetStock: "stock-customers", direction: "outflow" });
  }
  if (scenario.adChannels.length > 0) {
    flows.push({ id: "flow-marketing", label: "Marketing Spend", targetStock: "stock-cash", direction: "outflow" });
  }

  return flows;
}

// ─── Implicit edges (structural relationships from the model) ───

interface ImplicitEdge {
  source: string;
  target: string;
  label?: string;
}

function getImplicitEdges(scenario: Scenario): ImplicitEdge[] {
  const edges: ImplicitEdge[] = [];

  // Ad spend → acquisition flow
  for (const ad of scenario.adChannels) {
    edges.push({ source: ad.spend.id, target: "flow-acquisition" });
    edges.push({ source: ad.cac.id, target: "flow-acquisition" });
  }

  // Sales roles → acquisition flow
  for (const sr of scenario.salesRoles) {
    edges.push({ source: sr.quota.id, target: "flow-acquisition" });
  }

  // Churn rate → churn flow
  for (const seg of scenario.segments) {
    if (seg.churnRate.baseValue > 0) {
      edges.push({ source: seg.churnRate.id, target: "flow-churn" });
    }
    edges.push({ source: seg.acv.id, target: "flow-revenue" });
  }

  // Product price → revenue
  for (const p of scenario.products) {
    edges.push({ source: p.price.id, target: "flow-revenue" });
    edges.push({ source: p.unitCogs.id, target: "flow-cogs" });
  }

  // Headcount salary → opex
  for (const hc of scenario.otherHeadcount) {
    edges.push({ source: hc.salary.id, target: "flow-opex" });
  }
  for (const sr of scenario.salesRoles) {
    edges.push({ source: sr.fullyLoadedCost.id, target: "flow-opex" });
  }

  // Flow → stock connections
  edges.push({ source: "flow-revenue", target: "stock-cash" });
  edges.push({ source: "flow-cogs", target: "stock-cash" });
  edges.push({ source: "flow-opex", target: "stock-cash" });
  if (scenario.adChannels.length > 0 || scenario.salesRoles.length > 0) {
    edges.push({ source: "flow-acquisition", target: "stock-customers" });
  }
  if (scenario.segments.some((s) => s.churnRate.baseValue > 0)) {
    edges.push({ source: "flow-churn", target: "stock-customers" });
    edges.push({ source: "flow-marketing", target: "stock-cash" });
  }

  return edges;
}

// ─── Main builder ───────────────────────────────────────────────

export function buildSystemGraph(
  scenario: Scenario,
): { nodes: Node<SystemNodeData>[]; edges: Edge<CausalEdgeData>[] } {
  const nodes: Node<SystemNodeData>[] = [];
  const edges: Edge<CausalEdgeData>[] = [];
  const savedPositions = scenario.nodePositions ?? {};

  // ─── Stock nodes (right column) ───
  const stocks = getStocks(scenario);
  stocks.forEach((stock, i) => {
    const pos = savedPositions[stock.id] ?? { x: COL_STOCK, y: START_Y + i * ROW_GAP * 1.5 };
    nodes.push({
      id: stock.id,
      type: "stock",
      position: pos,
      data: {
        label: stock.label,
        value: stock.value,
        nodeType: "stock",
      },
    });
  });

  // ─── Flow nodes (middle column) ───
  const flows = getFlows(scenario);
  flows.forEach((flow, i) => {
    const pos = savedPositions[flow.id] ?? { x: COL_FLOW, y: START_Y + i * ROW_GAP };
    nodes.push({
      id: flow.id,
      type: "flow",
      position: pos,
      data: {
        label: flow.label,
        nodeType: "flow",
      },
    });
  });

  // ─── Converter nodes (left column) — one per variable ───
  const allVars = collectVariables(scenario);
  let converterIdx = 0;
  for (const [id, regVar] of allVars) {
    const pos = savedPositions[id] ?? { x: COL_CONVERTER, y: START_Y + converterIdx * ROW_GAP * 0.8 };
    nodes.push({
      id,
      type: "converter",
      position: pos,
      data: {
        label: regVar.variable.name,
        value: regVar.variable.baseValue,
        nodeType: "converter",
        variableId: id,
        fieldPath: regVar.fieldPath,
        group: regVar.group,
      },
    });
    converterIdx++;
  }

  // ─── Implicit structural edges (gray, non-editable) ───
  const implicitEdges = getImplicitEdges(scenario);
  for (const ie of implicitEdges) {
    // Only add if both source and target nodes exist
    if (nodes.some((n) => n.id === ie.source) && nodes.some((n) => n.id === ie.target)) {
      edges.push({
        id: `implicit-${ie.source}-${ie.target}`,
        source: ie.source,
        target: ie.target,
        type: "default",
        style: { stroke: "#52525b", strokeDasharray: "4 4" },
        animated: false,
      });
    }
  }

  // ─── User causal links (colored, editable) ───
  for (const link of scenario.causalLinks ?? []) {
    if (nodes.some((n) => n.id === link.sourceId) && nodes.some((n) => n.id === link.targetId)) {
      edges.push({
        id: link.id,
        source: link.sourceId,
        target: link.targetId,
        type: "causal",
        data: {
          polarity: link.polarity,
          strength: link.strength,
          delay: link.delay,
          noise: link.noise,
          linkId: link.id,
        },
      });
    }
  }

  return { nodes, edges };
}
