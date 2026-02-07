// ---------------------------------------------------------------------------
// Stratum — Chord Graph SVG Renderer (Force-Directed Layout)
// ---------------------------------------------------------------------------

import type { ChordGraph } from '../analysis/harmonic-network.js';
import { escapeXml, svgOpen, svgClose, svgEmpty } from './svg-utils.js';

/** Options for chord graph rendering. */
export interface ChordGraphOptions {
  /** Chart width in pixels (default 600). */
  width?: number;
  /** Chart height in pixels (default 600). */
  height?: number;
  /** Padding (default 50). */
  padding?: number;
  /** Fruchterman-Reingold iterations (default 200). */
  iterations?: number;
  /** Node base radius (default 12). */
  nodeRadius?: number;
  /** Node fill color (default '#2563eb'). */
  nodeColor?: string;
  /** Edge base color (default '#999'). */
  edgeColor?: string;
  /** Show arrowheads for directed edges (default true). */
  showArrows?: boolean;
  /** Max edge width (default 4). */
  maxEdgeWidth?: number;
  /** Font size for labels (default 10). */
  fontSize?: number;
}

const DEFAULTS: Required<ChordGraphOptions> = {
  width: 600,
  height: 600,
  padding: 50,
  iterations: 200,
  nodeRadius: 12,
  nodeColor: '#2563eb',
  edgeColor: '#999',
  showArrows: true,
  maxEdgeWidth: 4,
  fontSize: 10,
};

/**
 * Render a chord transition graph as SVG using Fruchterman-Reingold layout.
 *
 * @param graph — The chord graph with nodes and directed edges.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderChordGraph(
  graph: ChordGraph,
  options?: Partial<ChordGraphOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  if (graph.nodes.length === 0) {
    return svgEmpty(o.width, o.height);
  }

  const n = graph.nodes.length;
  const areaW = o.width - 2 * o.padding;
  const areaH = o.height - 2 * o.padding;
  const area = areaW * areaH;
  const k = Math.sqrt(area / n); // ideal distance

  // Initialize positions on a circle
  const posX = new Float64Array(n);
  const posY = new Float64Array(n);
  const cx = o.width / 2;
  const cy = o.height / 2;
  const initR = Math.min(areaW, areaH) * 0.35;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    posX[i] = cx + initR * Math.cos(angle);
    posY[i] = cy + initR * Math.sin(angle);
  }

  // Build label→index map
  const labelIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    labelIdx.set(graph.nodes[i]!.label, i);
  }

  // Fruchterman-Reingold
  const dispX = new Float64Array(n);
  const dispY = new Float64Array(n);

  for (let iter = 0; iter < o.iterations; iter++) {
    const temp = k * (1 - iter / o.iterations);

    // Reset displacements
    dispX.fill(0);
    dispY.fill(0);

    // Repulsive forces
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = (posX[i] ?? 0) - (posX[j] ?? 0);
        const dy = (posY[i] ?? 0) - (posY[j] ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        dispX[i] = (dispX[i] ?? 0) + fx;
        dispY[i] = (dispY[i] ?? 0) + fy;
        dispX[j] = (dispX[j] ?? 0) - fx;
        dispY[j] = (dispY[j] ?? 0) - fy;
      }
    }

    // Attractive forces
    for (const edge of graph.edges) {
      const si = labelIdx.get(edge.from);
      const ti = labelIdx.get(edge.to);
      if (si === undefined || ti === undefined) continue;
      const dx = (posX[si] ?? 0) - (posX[ti] ?? 0);
      const dy = (posY[si] ?? 0) - (posY[ti] ?? 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      dispX[si] = (dispX[si] ?? 0) - fx;
      dispY[si] = (dispY[si] ?? 0) - fy;
      dispX[ti] = (dispX[ti] ?? 0) + fx;
      dispY[ti] = (dispY[ti] ?? 0) + fy;
    }

    // Apply displacements with temperature damping
    for (let i = 0; i < n; i++) {
      const dx = dispX[i] ?? 0;
      const dy = dispY[i] ?? 0;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const scale = Math.min(dist, temp) / dist;
      posX[i] = Math.max(o.padding, Math.min(o.width - o.padding,
        (posX[i] ?? 0) + dx * scale));
      posY[i] = Math.max(o.padding, Math.min(o.height - o.padding,
        (posY[i] ?? 0) + dy * scale));
    }
  }

  // Find max count and weight for scaling
  const maxCount = Math.max(...graph.nodes.map(nd => nd.count), 1);
  const maxWeight = Math.max(...graph.edges.map(e => e.weight), 1);

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Arrow marker definition
  if (o.showArrows) {
    svg.push(
      '<defs>' +
      `<marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" ` +
      `markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
      `<path d="M 0 0 L 10 5 L 0 10 z" fill="${o.edgeColor}"/>` +
      '</marker>' +
      '</defs>',
    );
  }

  // Edges
  for (const edge of graph.edges) {
    const si = labelIdx.get(edge.from);
    const ti = labelIdx.get(edge.to);
    if (si === undefined || ti === undefined) continue;

    const x1 = posX[si] ?? 0;
    const y1 = posY[si] ?? 0;
    const x2 = posX[ti] ?? 0;
    const y2 = posY[ti] ?? 0;
    const w = 0.5 + (edge.weight / maxWeight) * (o.maxEdgeWidth - 0.5);

    // Shorten line to not overlap node circles
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const srcR = o.nodeRadius * Math.sqrt(graph.nodes[si]!.count / maxCount) + 2;
    const tgtR = o.nodeRadius * Math.sqrt(graph.nodes[ti]!.count / maxCount) + 2;
    const nx = dx / dist;
    const ny = dy / dist;

    const sx = x1 + nx * srcR;
    const sy = y1 + ny * srcR;
    const ex = x2 - nx * (tgtR + (o.showArrows ? 6 : 0));
    const ey = y2 - ny * (tgtR + (o.showArrows ? 6 : 0));

    svg.push(
      `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" ` +
      `x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" ` +
      `stroke="${o.edgeColor}" stroke-width="${w.toFixed(1)}"` +
      (o.showArrows ? ' marker-end="url(#arrowhead)"' : '') + '/>',
    );
  }

  // Nodes
  for (let i = 0; i < n; i++) {
    const node = graph.nodes[i]!;
    const x = posX[i] ?? 0;
    const y = posY[i] ?? 0;
    const r = o.nodeRadius * Math.sqrt(node.count / maxCount);

    svg.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(4, r).toFixed(1)}" ` +
      `fill="${o.nodeColor}" stroke="#fff" stroke-width="1.5"/>`,
    );
    svg.push(
      `<text x="${x.toFixed(1)}" y="${(y + o.fontSize * 0.35).toFixed(1)}" ` +
      `text-anchor="middle" font-size="${o.fontSize}" font-family="monospace" ` +
      `fill="#fff">${escapeXml(node.label)}</text>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}
