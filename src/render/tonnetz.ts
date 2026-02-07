// ---------------------------------------------------------------------------
// Stratum — Tonnetz SVG Renderer
// ---------------------------------------------------------------------------

import type { Triad } from '../analysis/neo-riemannian.js';
import { escapeXml, svgOpen, svgClose, polylinePoints } from './svg-utils.js';

const PC_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Options for Tonnetz rendering. */
export interface TonnetzOptions {
  /** Chart width in pixels (default 500). */
  width?: number;
  /** Chart height in pixels (default 400). */
  height?: number;
  /** Padding (default 40). */
  padding?: number;
  /** Active pitch classes to highlight. */
  activePCs?: readonly number[];
  /** Path of triads to trace (polyline through centroids). */
  triadPath?: readonly Triad[];
  /** Show PLR edge labels (default true). */
  showEdgeLabels?: boolean;
  /** Node radius (default 20). */
  nodeRadius?: number;
  /** Active node color (default '#2563eb'). */
  activeColor?: string;
  /** Inactive node color (default '#e5e7eb'). */
  inactiveColor?: string;
  /** Major triad fill (default '#fbbf24'). */
  majorTriadColor?: string;
  /** Minor triad fill (default '#60a5fa'). */
  minorTriadColor?: string;
  /** Path line color (default '#dc2626'). */
  pathColor?: string;
}

const DEFAULTS: Required<TonnetzOptions> = {
  width: 500,
  height: 400,
  padding: 40,
  activePCs: [],
  triadPath: [],
  showEdgeLabels: true,
  nodeRadius: 20,
  activeColor: '#2563eb',
  inactiveColor: '#e5e7eb',
  majorTriadColor: '#fbbf24',
  minorTriadColor: '#60a5fa',
  pathColor: '#dc2626',
};

/**
 * Tonnetz layout: 4 columns × 3 rows, staggered.
 * Horizontal axis = perfect fifths (+7 semitones).
 * Diagonal NE = major thirds (+4 semitones).
 * Each position maps to a pitch class.
 *
 * Layout grid (row, col) → PC:
 *   Row 0: E(4)  B(11) F#(6) C#(1)
 *   Row 1: C(0)  G(7)  D(2)  A(9)
 *   Row 2: Ab(8) Eb(3) Bb(10) F(5)
 */
const GRID: readonly (readonly number[])[] = [
  [4, 11, 6, 1],
  [0, 7, 2, 9],
  [8, 3, 10, 5],
];

/**
 * Render a Tonnetz lattice as SVG.
 *
 * 12 pitch-class nodes arranged in a triangular lattice where horizontal
 * adjacency = P5, diagonal adjacency = M3/m3. Major triads form downward
 * triangles, minor triads form upward triangles.
 *
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderTonnetz(
  options?: Partial<TonnetzOptions>,
): string {
  const o = { ...DEFAULTS, ...options };
  const activeSet = new Set(o.activePCs);

  const cols = 4;
  const rows = 3;
  const colSpacing = (o.width - 2 * o.padding) / (cols - 0.5);
  const rowSpacing = (o.height - 2 * o.padding) / (rows - 1);

  // Compute node positions
  const positions = new Map<number, { x: number; y: number }>();
  for (let r = 0; r < rows; r++) {
    const xOffset = (rows - 1 - r) * colSpacing * 0.5; // stagger
    for (let c = 0; c < cols; c++) {
      const pc = GRID[r]![c]!;
      const x = o.padding + xOffset + c * colSpacing;
      const y = o.padding + r * rowSpacing;
      positions.set(pc, { x, y });
    }
  }

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Draw edges (fifths = horizontal, thirds = diagonal)
  const edges: Array<{ from: number; to: number; label: string }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pc = GRID[r]![c]!;
      // Right neighbor (P5)
      if (c + 1 < cols) {
        edges.push({ from: pc, to: GRID[r]![c + 1]!, label: 'P' });
      }
      // Down-left neighbor (m3) - next row, same col
      if (r + 1 < rows) {
        edges.push({ from: pc, to: GRID[r + 1]![c]!, label: 'R' });
      }
      // Down-right neighbor (M3 complement) - diagonal
      if (r + 1 < rows && c > 0) {
        // The relationship going down-left in the staggered grid
      }
    }
  }
  // Also add diagonal (M3) edges: row r, col c → row r+1, col c (which is -M3)
  // And row r, col c → row r-1, col c (which is +M3)
  // Actually the vertical edges are already m3. Let's add the other diagonals.
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      // current → diag down-right in next row (if stagger allows)
      // Due to stagger, the "diagonal" edge connects row r col c+1 to row r+1 col c
      const from = GRID[r]![c + 1]!;
      const to = GRID[r + 1]![c]!;
      // This represents L transform
      edges.push({ from, to, label: 'L' });
    }
  }

  for (const edge of edges) {
    const p1 = positions.get(edge.from);
    const p2 = positions.get(edge.to);
    if (!p1 || !p2) continue;

    svg.push(
      `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" ` +
      `x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" ` +
      `stroke="#ccc" stroke-width="1"/>`,
    );

    if (o.showEdgeLabels) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      svg.push(
        `<text x="${mx.toFixed(1)}" y="${(my - 3).toFixed(1)}" ` +
        `text-anchor="middle" font-size="8" font-family="monospace" fill="#999">${escapeXml(edge.label)}</text>`,
      );
    }
  }

  // Draw triad triangles
  // Major triads: root, root+4, root+7 — downward triangle
  // Minor triads: root, root+3, root+7 — upward triangle
  for (let root = 0; root < 12; root++) {
    const major = [root, (root + 4) % 12, (root + 7) % 12];
    const minor = [root, (root + 3) % 12, (root + 7) % 12];

    const majPositions = major.map(pc => positions.get(pc)).filter(Boolean) as Array<{ x: number; y: number }>;
    const minPositions = minor.map(pc => positions.get(pc)).filter(Boolean) as Array<{ x: number; y: number }>;

    if (majPositions.length === 3) {
      // Only draw if all three nodes are adjacent in the grid
      const coords = majPositions.map(p => [p.x, p.y] as const);
      const maxDist = Math.max(
        dist(coords[0]!, coords[1]!),
        dist(coords[1]!, coords[2]!),
        dist(coords[0]!, coords[2]!),
      );
      if (maxDist < colSpacing * 1.5) {
        svg.push(
          `<polygon points="${polylinePoints(coords)}" ` +
          `fill="${o.majorTriadColor}" fill-opacity="0.15" stroke="${o.majorTriadColor}" stroke-width="0.5"/>`,
        );
      }
    }

    if (minPositions.length === 3) {
      const coords = minPositions.map(p => [p.x, p.y] as const);
      const maxDist = Math.max(
        dist(coords[0]!, coords[1]!),
        dist(coords[1]!, coords[2]!),
        dist(coords[0]!, coords[2]!),
      );
      if (maxDist < colSpacing * 1.5) {
        svg.push(
          `<polygon points="${polylinePoints(coords)}" ` +
          `fill="${o.minorTriadColor}" fill-opacity="0.15" stroke="${o.minorTriadColor}" stroke-width="0.5"/>`,
        );
      }
    }
  }

  // Draw nodes on top
  for (const [pc, pos] of positions) {
    const isActive = activeSet.has(pc);
    const fill = isActive ? o.activeColor : o.inactiveColor;
    svg.push(
      `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${o.nodeRadius}" ` +
      `fill="${fill}" stroke="#fff" stroke-width="2"/>`,
    );
    svg.push(
      `<text x="${pos.x.toFixed(1)}" y="${(pos.y + 4).toFixed(1)}" ` +
      `text-anchor="middle" font-size="11" font-family="monospace" font-weight="bold" ` +
      `fill="${isActive ? '#fff' : '#666'}">${escapeXml(PC_NAMES[pc]!)}</text>`,
    );
  }

  // Path tracing
  if (o.triadPath.length > 1) {
    const pathCoords: (readonly [number, number])[] = [];
    for (const triad of o.triadPath) {
      const pcs = triad.quality === 'major'
        ? [triad.root, (triad.root + 4) % 12, (triad.root + 7) % 12]
        : [triad.root, (triad.root + 3) % 12, (triad.root + 7) % 12];
      // Centroid of the triad positions
      let cx = 0, cy = 0, count = 0;
      for (const pc of pcs) {
        const p = positions.get(pc);
        if (p) { cx += p.x; cy += p.y; count++; }
      }
      if (count > 0) {
        pathCoords.push([cx / count, cy / count]);
      }
    }
    if (pathCoords.length > 1) {
      svg.push(
        `<polyline points="${polylinePoints(pathCoords)}" fill="none" ` +
        `stroke="${o.pathColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  }

  svg.push(svgClose());
  return svg.join('\n');
}

function dist(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}
