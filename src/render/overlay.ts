// ---------------------------------------------------------------------------
// Stratum — Overlay Renderer (Chromatic Staff + Tension Curve)
// ---------------------------------------------------------------------------

import type { Score } from '../core/types.js';
import type { TensionCurve } from '../tension/tension.js';
import type { RenderOptions } from './chromatic-staff.js';
import { renderChromaticStaff } from './chromatic-staff.js';

/** Options for rendering a combined chromatic staff + tension curve overlay. */
export interface OverlayOptions {
  /** Chromatic staff rendering options. */
  staff?: Partial<RenderOptions>;
  /** Height of the tension curve panel in pixels (default 150). */
  tensionHeight?: number;
  /** Vertical gap between staff and tension panels in pixels (default 10). */
  gap?: number;
  /** Show individual tension component lines (default false). */
  showComponents?: boolean;
  /** Color for total tension line (default '#2563eb'). */
  totalColor?: string;
  /** Colors per component: [roughness, metric, registral, density]. */
  componentColors?: [string, string, string, string];
  /** Stroke width for tension lines (default 2). */
  strokeWidth?: number;
}

// Mirrors chromatic-staff.ts DEFAULTS — kept in sync for dimension calculation.
const STAFF_DEFAULTS: Required<RenderOptions> = {
  pixelsPerTick: 0.15,
  pixelsPerSemitone: 8,
  lowNote: 48,
  highNote: 84,
  voiceColors: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04'],
  showMeasures: true,
  showLabels: true,
  marginLeft: 44,
  padding: 20,
};

/**
 * Render a combined chromatic staff + tension curve as a single SVG.
 *
 * The chromatic staff appears on top and the tension curve below. Both panels
 * share the same tick-based horizontal axis (`marginLeft + tick * pixelsPerTick`)
 * so tension values align vertically with the notes that produce them.
 *
 * @param score — The score to render.
 * @param curve — The tension curve data (from `computeTension`).
 * @param options — Rendering options for the overlay.
 * @returns A single SVG string containing both panels with aligned time axes.
 */
export function renderOverlay(
  score: Score,
  curve: TensionCurve,
  options?: OverlayOptions,
): string {
  const so = { ...STAFF_DEFAULTS, ...options?.staff };
  const gap = options?.gap ?? 10;
  const tensionHeight = options?.tensionHeight ?? 150;
  const showComponents = options?.showComponents ?? false;
  const totalColor = options?.totalColor ?? '#2563eb';
  const componentColors: [string, string, string, string] =
    options?.componentColors ?? ['#dc2626', '#16a34a', '#ca8a04', '#9333ea'];
  const strokeWidth = options?.strokeWidth ?? 2;

  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0 || curve.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>';
  }

  // ---- Shared dimensions (same formula as chromatic-staff.ts) ----
  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const noteRange = so.highNote - so.lowNote;
  const staffHeight = noteRange * so.pixelsPerSemitone + so.padding * 2;
  const contentWidth = maxTick * so.pixelsPerTick;
  const totalWidth = so.marginLeft + contentWidth + so.padding;
  const totalHeight = staffHeight + gap + tensionHeight;

  // ---- Staff panel (reuse existing renderer, strip SVG wrapper) ----
  const staffSvg = renderChromaticStaff(score, so);
  const staffInner = staffSvg
    .replace(/^<svg[^>]*>\n?/, '')
    .replace(/\n?<\/svg>\s*$/, '');

  // ---- Tension panel (tick-based X axis aligned with staff) ----
  const tensionTop = staffHeight + gap;
  const tensionBottomMargin = 20;
  const chartHeight = tensionHeight - tensionBottomMargin;

  const tickToX = (tick: number): number =>
    so.marginLeft + tick * so.pixelsPerTick;

  const valToY = (v: number): number =>
    tensionTop + chartHeight - v * chartHeight;

  const tension: string[] = [];

  // Background
  tension.push(
    `<rect x="0" y="${tensionTop}" width="${totalWidth}" height="${tensionHeight}" fill="#fafafa"/>`,
  );

  // Horizontal grid lines (0.00 to 1.00 in 0.25 steps)
  for (let v = 0; v <= 1; v += 0.25) {
    const y = valToY(v);
    tension.push(
      `<line x1="${so.marginLeft}" y1="${y}" x2="${so.marginLeft + contentWidth}" y2="${y}" ` +
      `stroke="#e0e0e0" stroke-width="0.5"/>`,
    );
    tension.push(
      `<text x="${so.marginLeft - 4}" y="${y + 3}" text-anchor="end" ` +
      `font-size="9" font-family="monospace" fill="#999">${v.toFixed(2)}</text>`,
    );
  }

  // Y-axis label
  tension.push(
    `<text x="${so.marginLeft - 4}" y="${tensionTop - 4}" text-anchor="end" ` +
    `font-size="10" font-family="monospace" fill="#666">Tension</text>`,
  );

  // Component lines (optional)
  if (showComponents) {
    const comps: ReadonlyArray<{
      key: 'roughness' | 'metric' | 'registral' | 'density';
      color: string;
    }> = [
      { key: 'roughness', color: componentColors[0] },
      { key: 'metric', color: componentColors[1] },
      { key: 'registral', color: componentColors[2] },
      { key: 'density', color: componentColors[3] },
    ];

    for (const comp of comps) {
      const points = curve
        .map(pt =>
          `${tickToX(pt.tick).toFixed(1)},${valToY(pt.components[comp.key]).toFixed(1)}`,
        )
        .join(' ');
      tension.push(
        `<polyline points="${points}" fill="none" ` +
        `stroke="${comp.color}" stroke-width="${(strokeWidth * 0.6).toFixed(1)}" stroke-opacity="0.5"/>`,
      );
    }
  }

  // Total tension line
  const totalPoints = curve
    .map(pt => `${tickToX(pt.tick).toFixed(1)},${valToY(pt.total).toFixed(1)}`)
    .join(' ');
  tension.push(
    `<polyline points="${totalPoints}" fill="none" ` +
    `stroke="${totalColor}" stroke-width="${strokeWidth}"/>`,
  );

  // Chart border
  tension.push(
    `<rect x="${so.marginLeft}" y="${tensionTop}" ` +
    `width="${contentWidth}" height="${chartHeight}" ` +
    `fill="none" stroke="#ccc" stroke-width="0.5"/>`,
  );

  // ---- Combine into single SVG ----
  const svg: string[] = [];
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${totalWidth} ${totalHeight}" ` +
    `width="${totalWidth}" height="${totalHeight}">`,
  );
  svg.push(staffInner);
  svg.push(...tension);
  svg.push('</svg>');

  return svg.join('\n');
}
