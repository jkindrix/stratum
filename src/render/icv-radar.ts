// ---------------------------------------------------------------------------
// Stratum — Interval-Class Vector Radar Chart SVG Renderer
// ---------------------------------------------------------------------------

import { escapeXml, svgOpen, svgClose, svgEmpty, polylinePoints } from './svg-utils.js';

const AXIS_LABELS = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6'];
const DEFAULT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2'];

/** A 6-element interval-class vector. */
export type ICV = readonly [number, number, number, number, number, number];

/** Options for ICV radar chart rendering. */
export interface ICVRadarOptions {
  /** Chart width in pixels (default 400). */
  width?: number;
  /** Chart height in pixels (default 400). */
  height?: number;
  /** Padding around chart (default 40). */
  padding?: number;
  /** Colors for each overlaid ICV polygon (default: 6 distinct colors). */
  colors?: readonly string[];
  /** Number of concentric grid circles (default 4). */
  gridLevels?: number;
  /** Polygon fill opacity (default 0.15). */
  fillOpacity?: number;
  /** Stroke width for polygons (default 2). */
  strokeWidth?: number;
}

const DEFAULTS: Required<ICVRadarOptions> = {
  width: 400,
  height: 400,
  padding: 40,
  colors: DEFAULT_COLORS,
  gridLevels: 4,
  fillOpacity: 0.15,
  strokeWidth: 2,
};

/**
 * Render one or more interval-class vectors as a 6-axis radar chart.
 *
 * @param icvs — Array of 6-element ICVs to overlay.
 * @param labels — Optional string labels for each ICV (shown in legend).
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderICVRadar(
  icvs: readonly ICV[],
  labels?: readonly string[],
  options?: Partial<ICVRadarOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  if (icvs.length === 0) {
    return svgEmpty(o.width, o.height);
  }

  const cx = o.width / 2;
  const cy = o.height / 2;
  const radius = Math.min(cx, cy) - o.padding;

  // Find global max for normalization
  let maxVal = 0;
  for (const icv of icvs) {
    for (let i = 0; i < 6; i++) {
      const v = icv[i] ?? 0;
      if (v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) maxVal = 1;

  const angleStep = (2 * Math.PI) / 6;

  const axisCoord = (axis: number, r: number): readonly [number, number] => {
    const angle = -Math.PI / 2 + axis * angleStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Grid circles
  for (let level = 1; level <= o.gridLevels; level++) {
    const r = (level / o.gridLevels) * radius;
    const pts: (readonly [number, number])[] = [];
    for (let i = 0; i < 6; i++) {
      pts.push(axisCoord(i, r));
    }
    svg.push(
      `<polygon points="${polylinePoints(pts)}" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>`,
    );
  }

  // Axes
  for (let i = 0; i < 6; i++) {
    const [ex, ey] = axisCoord(i, radius);
    svg.push(
      `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" ` +
      `x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#ccc" stroke-width="0.5"/>`,
    );

    // Label
    const [lx, ly] = axisCoord(i, radius + 15);
    svg.push(
      `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" ` +
      `text-anchor="middle" font-size="10" font-family="monospace" fill="#666">${escapeXml(AXIS_LABELS[i]!)}</text>`,
    );
  }

  // ICV polygons
  for (let vi = 0; vi < icvs.length; vi++) {
    const icv = icvs[vi]!;
    const color = o.colors[vi % o.colors.length] ?? DEFAULT_COLORS[0]!;
    const pts: (readonly [number, number])[] = [];
    for (let i = 0; i < 6; i++) {
      const val = (icv[i] ?? 0) / maxVal;
      pts.push(axisCoord(i, val * radius));
    }
    svg.push(
      `<polygon points="${polylinePoints(pts)}" ` +
      `fill="${color}" fill-opacity="${o.fillOpacity}" ` +
      `stroke="${color}" stroke-width="${o.strokeWidth}"/>`,
    );
  }

  // Legend
  if (labels && labels.length > 0) {
    const legendX = 10;
    let legendY = 15;
    for (let i = 0; i < Math.min(labels.length, icvs.length); i++) {
      const color = o.colors[i % o.colors.length] ?? DEFAULT_COLORS[0]!;
      svg.push(
        `<rect x="${legendX}" y="${legendY - 8}" width="12" height="4" fill="${color}"/>`,
      );
      svg.push(
        `<text x="${legendX + 16}" y="${legendY}" font-size="9" font-family="monospace" fill="#666">${escapeXml(labels[i]!)}</text>`,
      );
      legendY += 14;
    }
  }

  svg.push(svgClose());
  return svg.join('\n');
}
