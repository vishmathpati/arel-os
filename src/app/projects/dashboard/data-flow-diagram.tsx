/**
 * DataFlowDiagram — a node + directed-edge diagram of a project's architecture
 * data-flow (project-sync v2, Structure tab). shadcn has no diagram primitive, so
 * this is a small custom component built from a functional SVG (a deliberate,
 * recorded exception to DESIGN.md's "no decorative SVG" — this is functional, not
 * decoration). No graph lib: nodes are placed in topological levels (longest-path)
 * and directed edges are drawn with an arrowhead marker + optional label. All
 * color comes from DESIGN.md tokens via `var(--color-*)`.
 */

import type { FlowEdge } from "@/shared/lib/project-dashboard/snapshot";

const NODE_W = 132;
const NODE_H = 42;
const GAP_X = 36;
const GAP_Y = 56;
const PAD = 10;

/** Assign each node a level = its longest path from a source (in-degree 0). */
function computeLevels(nodes: string[], edges: FlowEdge[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n, []);
    indeg.set(n, 0);
  }
  for (const e of edges) {
    if (!adj.has(e.from) || !adj.has(e.to) || e.from === e.to) continue;
    adj.get(e.from)?.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }

  const level = new Map<string, number>();
  const queue = nodes.filter((n) => (indeg.get(n) ?? 0) === 0);
  for (const n of queue) level.set(n, 0);
  // Pure cycle (no source): seed the first node so we still produce a layout.
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0]);
    level.set(nodes[0], 0);
  }

  const remaining = new Map(indeg);
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    const ln = level.get(n) ?? 0;
    for (const m of adj.get(n) ?? []) {
      level.set(m, Math.max(level.get(m) ?? 0, ln + 1));
      const d = (remaining.get(m) ?? 0) - 1;
      remaining.set(m, d);
      if (d <= 0 && !queue.includes(m)) queue.push(m);
    }
  }
  // Cycle nodes never drained → park them at level 0.
  for (const n of nodes) if (!level.has(n)) level.set(n, 0);
  return level;
}

function truncate(s: string, max = 18): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function DataFlowDiagram({ edges }: { edges: FlowEdge[] }) {
  const nodes: string[] = [];
  for (const e of edges) {
    if (e.from && !nodes.includes(e.from)) nodes.push(e.from);
    if (e.to && !nodes.includes(e.to)) nodes.push(e.to);
  }
  if (nodes.length === 0) return null;

  const level = computeLevels(nodes, edges);

  // Group nodes by level (rows), preserving encounter order within a row.
  const rows = new Map<number, string[]>();
  for (const n of nodes) {
    const l = level.get(n) ?? 0;
    const bucket = rows.get(l);
    if (bucket) bucket.push(n);
    else rows.set(l, [n]);
  }
  const levelKeys = [...rows.keys()].sort((a, b) => a - b);
  const maxRow = Math.max(...[...rows.values()].map((r) => r.length));

  const diagramW = maxRow * NODE_W + (maxRow - 1) * GAP_X;
  const diagramH = levelKeys.length * NODE_H + (levelKeys.length - 1) * GAP_Y;
  const W = diagramW + PAD * 2;
  const H = diagramH + PAD * 2;

  // Place each node.
  const pos = new Map<string, { x: number; y: number }>();
  levelKeys.forEach((lk, li) => {
    const row = rows.get(lk) ?? [];
    const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
    const startX = PAD + (diagramW - rowW) / 2;
    const y = PAD + li * (NODE_H + GAP_Y);
    row.forEach((n, idx) => pos.set(n, { x: startX + idx * (NODE_W + GAP_X), y }));
  });

  const center = (n: string) => {
    const p = pos.get(n);
    return p ? { cx: p.x + NODE_W / 2, cy: p.y + NODE_H / 2 } : null;
  };

  return (
    <div className="overflow-x-auto" style={{ maxWidth: `${W}px` }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Architecture data-flow diagram"
        style={{ minWidth: `${Math.min(W, 320)}px` }}
      >
        <title>Architecture data-flow diagram</title>
        <defs>
          <marker
            id="dataflow-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6.5,3 L0,6 Z" fill="var(--color-muted-foreground)" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const a = center(e.from);
          const b = center(e.to);
          if (!a || !b || e.from === e.to) return null;
          const la = level.get(e.from) ?? 0;
          const lb = level.get(e.to) ?? 0;
          // Forward (downward) edges leave the bottom and enter the top; back edges flip.
          const forward = lb >= la;
          const x1 = a.cx;
          const y1 = forward ? a.cy + NODE_H / 2 : a.cy - NODE_H / 2;
          const x2 = b.cx;
          const y2 = forward ? b.cy - NODE_H / 2 : b.cy + NODE_H / 2;
          // Labels are hover-only (a <title>): always-on labels collide when
          // several edges fan in/out of one band. The arrows carry the flow.
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              {e.label && <title>{`${e.from} → ${e.to}: ${e.label}`}</title>}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.25}
                markerEnd="url(#dataflow-arrow)"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const p = pos.get(n);
          if (!p) return null;
          return (
            <g key={n}>
              <rect
                x={p.x}
                y={p.y}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill="var(--color-card)"
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={p.x + NODE_W / 2}
                y={p.y + NODE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fill="var(--color-foreground)"
              >
                {truncate(n)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
