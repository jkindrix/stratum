// ---------------------------------------------------------------------------
// Stratum — Just Intonation Lattice SVG Renderer
// ---------------------------------------------------------------------------

import type { Monzo } from '../pitch/monzo.js';
import { escapeXml, svgOpen, svgClose } from './svg-utils.js';

/** A node in the JI lattice. */
export interface JILatticeNode {
  /** Prime exponent vector [e₂, e₃, e₅, e₇, ...]. */
  readonly monzo: Monzo;
  /** Display label (e.g. '3/2', '5/4'). */
  readonly label: string;
}

/** Options for JI lattice rendering. */
export interface JILatticeOptions {
  /** Chart width in pixels (default 600). */
  width?: number;
  /** Chart height in pixels (default 500). */
  height?: number;
  /** Padding (default 40). */
  padding?: number;
  /** Limit: 5 for 2D grid, 7 for oblique 3D projection (default 5). */
  limit?: 5 | 7;
  /** Grid range: ±N for exponents of 3 and 5 (default 2). */
  gridRange?: number;
  /** Node radius (default 18). */
  nodeRadius?: number;
  /** Fifths axis color (default '#2563eb'). */
  fifthsColor?: string;
  /** Thirds axis color (default '#16a34a'). */
  thirdsColor?: string;
  /** Sevenths axis color for 7-limit (default '#dc2626'). */
  seventhsColor?: string;
  /** Node fill color (default '#f8fafc'). */
  nodeFill?: string;
  /** Font size (default 9). */
  fontSize?: number;
}

const DEFAULTS: Required<JILatticeOptions> = {
  width: 600,
  height: 500,
  padding: 40,
  limit: 5,
  gridRange: 2,
  nodeRadius: 18,
  fifthsColor: '#2563eb',
  thirdsColor: '#16a34a',
  seventhsColor: '#dc2626',
  nodeFill: '#f8fafc',
  fontSize: 9,
};

const PRIMES = [2, 3, 5, 7] as const;

/** Compute ratio label from monzo. */
function monzoToLabel(monzo: Monzo): string {
  let num = 1;
  let den = 1;
  for (let i = 0; i < monzo.length; i++) {
    const exp = monzo[i] ?? 0;
    const prime = PRIMES[i] ?? (i + 2);
    if (exp > 0) num *= prime ** exp;
    else if (exp < 0) den *= prime ** (-exp);
  }
  // Normalize octave (remove factors of 2 to bring into one octave)
  while (num >= den * 2) num /= 2;
  while (num < den) num *= 2;
  if (den === 1) return String(Math.round(num));
  return `${Math.round(num)}/${Math.round(den)}`;
}

/**
 * Render a just intonation lattice as SVG.
 *
 * 5-limit: 2D grid where x = exponent of 3 (fifths) and y = exponent of 5 (thirds).
 * 7-limit: adds an oblique projection axis for exponent of 7.
 *
 * @param nodes — Specific nodes to render. If omitted, auto-generates from gridRange.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderJILattice(
  nodes?: readonly JILatticeNode[],
  options?: Partial<JILatticeOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  // Auto-generate grid if no nodes provided
  const latticeNodes: JILatticeNode[] = [];
  if (nodes && nodes.length > 0) {
    latticeNodes.push(...nodes);
  } else {
    const r = o.gridRange;
    if (o.limit === 7) {
      for (let e3 = -r; e3 <= r; e3++) {
        for (let e5 = -r; e5 <= r; e5++) {
          for (let e7 = -1; e7 <= 1; e7++) {
            const monzo = [0, e3, e5, e7];
            latticeNodes.push({ monzo, label: monzoToLabel(monzo) });
          }
        }
      }
    } else {
      for (let e3 = -r; e3 <= r; e3++) {
        for (let e5 = -r; e5 <= r; e5++) {
          const monzo = [0, e3, e5];
          latticeNodes.push({ monzo, label: monzoToLabel(monzo) });
        }
      }
    }
  }

  const contentW = o.width - 2 * o.padding;
  const contentH = o.height - 2 * o.padding;
  const cx = o.width / 2;
  const cy = o.height / 2;

  // Spacing
  const range = o.gridRange || 2;
  const cellX = contentW / (range * 2 + 1);
  const cellY = contentH / (range * 2 + 1);
  const e7OffsetX = cellX * 0.4;
  const e7OffsetY = cellY * 0.3;

  const nodePos = (monzo: Monzo): { x: number; y: number } => {
    const e3 = monzo[1] ?? 0;
    const e5 = monzo[2] ?? 0;
    const e7 = monzo[3] ?? 0;
    let x = cx + e3 * cellX;
    let y = cy - e5 * cellY; // y-axis inverted
    if (o.limit === 7) {
      x += e7 * e7OffsetX;
      y -= e7 * e7OffsetY;
    }
    return { x, y };
  };

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Draw edges between adjacent nodes
  const posMap = new Map<string, { x: number; y: number; node: JILatticeNode }>();
  for (const node of latticeNodes) {
    const key = nodeKey(node.monzo);
    posMap.set(key, { ...nodePos(node.monzo), node });
  }

  for (const node of latticeNodes) {
    const pos = nodePos(node.monzo);
    const e3 = node.monzo[1] ?? 0;
    const e5 = node.monzo[2] ?? 0;
    const e7 = node.monzo[3] ?? 0;

    // Edge along fifths axis (e3+1)
    const fifthKey = nodeKey([node.monzo[0] ?? 0, e3 + 1, e5, ...(o.limit === 7 ? [e7] : [])]);
    const fifthNeighbor = posMap.get(fifthKey);
    if (fifthNeighbor) {
      svg.push(
        `<line x1="${pos.x.toFixed(1)}" y1="${pos.y.toFixed(1)}" ` +
        `x2="${fifthNeighbor.x.toFixed(1)}" y2="${fifthNeighbor.y.toFixed(1)}" ` +
        `stroke="${o.fifthsColor}" stroke-width="1.5" stroke-opacity="0.4"/>`,
      );
    }

    // Edge along thirds axis (e5+1)
    const thirdKey = nodeKey([node.monzo[0] ?? 0, e3, e5 + 1, ...(o.limit === 7 ? [e7] : [])]);
    const thirdNeighbor = posMap.get(thirdKey);
    if (thirdNeighbor) {
      svg.push(
        `<line x1="${pos.x.toFixed(1)}" y1="${pos.y.toFixed(1)}" ` +
        `x2="${thirdNeighbor.x.toFixed(1)}" y2="${thirdNeighbor.y.toFixed(1)}" ` +
        `stroke="${o.thirdsColor}" stroke-width="1.5" stroke-opacity="0.4"/>`,
      );
    }

    // Edge along sevenths axis (e7+1)
    if (o.limit === 7) {
      const seventhKey = nodeKey([node.monzo[0] ?? 0, e3, e5, e7 + 1]);
      const seventhNeighbor = posMap.get(seventhKey);
      if (seventhNeighbor) {
        svg.push(
          `<line x1="${pos.x.toFixed(1)}" y1="${pos.y.toFixed(1)}" ` +
          `x2="${seventhNeighbor.x.toFixed(1)}" y2="${seventhNeighbor.y.toFixed(1)}" ` +
          `stroke="${o.seventhsColor}" stroke-width="1.5" stroke-opacity="0.4"/>`,
        );
      }
    }
  }

  // Draw nodes
  for (const node of latticeNodes) {
    const pos = nodePos(node.monzo);
    const isUnison = (node.monzo[1] ?? 0) === 0 && (node.monzo[2] ?? 0) === 0
      && (o.limit === 7 ? (node.monzo[3] ?? 0) === 0 : true);

    svg.push(
      `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${o.nodeRadius}" ` +
      `fill="${isUnison ? '#2563eb' : o.nodeFill}" stroke="#666" stroke-width="1"/>`,
    );
    svg.push(
      `<text x="${pos.x.toFixed(1)}" y="${(pos.y + 3).toFixed(1)}" ` +
      `text-anchor="middle" font-size="${o.fontSize}" font-family="monospace" ` +
      `fill="${isUnison ? '#fff' : '#333'}">${escapeXml(node.label)}</text>`,
    );
  }

  // Axis legend
  const legendY = o.height - 15;
  svg.push(`<text x="${o.padding}" y="${legendY}" font-size="9" font-family="monospace" fill="${o.fifthsColor}">--- Fifths (3)</text>`);
  svg.push(`<text x="${o.padding + 110}" y="${legendY}" font-size="9" font-family="monospace" fill="${o.thirdsColor}">--- Thirds (5)</text>`);
  if (o.limit === 7) {
    svg.push(`<text x="${o.padding + 220}" y="${legendY}" font-size="9" font-family="monospace" fill="${o.seventhsColor}">--- Sevenths (7)</text>`);
  }

  svg.push(svgClose());
  return svg.join('\n');
}

function nodeKey(monzo: Monzo): string {
  return monzo.slice(1).join(','); // skip e2 (octave)
}
