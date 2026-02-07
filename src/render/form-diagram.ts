// ---------------------------------------------------------------------------
// Stratum — Form Diagram SVG Renderer
// ---------------------------------------------------------------------------

import type { NoveltyPoint } from '../analysis/structural.js';
import { escapeXml, svgOpen, svgClose, svgEmpty, polylinePoints } from './svg-utils.js';

/** A section in a formal structure. */
export interface FormSection {
  /** Start tick of this section. */
  readonly startTick: number;
  /** End tick of this section. */
  readonly endTick: number;
  /** Section label (e.g. 'A', 'B', 'Coda'). */
  readonly label: string;
}

/** Options for form diagram rendering. */
export interface FormDiagramOptions {
  /** Chart width in pixels (default 800). */
  width?: number;
  /** Chart height in pixels (default 150). */
  height?: number;
  /** Left margin (default 10). */
  marginLeft?: number;
  /** Right padding (default 10). */
  padding?: number;
  /** Bar height in pixels (default 40). */
  barHeight?: number;
  /** Bar top offset (default 20). */
  barTop?: number;
  /** Novelty curve height (default 60). */
  noveltyHeight?: number;
  /** Section colors (cycled by unique label). */
  sectionColors?: readonly string[];
  /** Novelty line color (default '#dc2626'). */
  noveltyColor?: string;
  /** Stroke width for novelty line (default 1.5). */
  noveltyStrokeWidth?: number;
}

const DEFAULT_SECTION_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#65a30d', '#7c3aed', '#0284c7',
];

const DEFAULTS: Required<FormDiagramOptions> = {
  width: 800,
  height: 150,
  marginLeft: 10,
  padding: 10,
  barHeight: 40,
  barTop: 20,
  noveltyHeight: 60,
  sectionColors: DEFAULT_SECTION_COLORS,
  noveltyColor: '#dc2626',
  noveltyStrokeWidth: 1.5,
};

/**
 * Render a form diagram as SVG: horizontal segmented bar with optional novelty curve.
 *
 * @param sections — Structural sections in tick order.
 * @param novelty — Optional novelty curve to plot below the bar.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderFormDiagram(
  sections: readonly FormSection[],
  novelty?: readonly NoveltyPoint[],
  options?: Partial<FormDiagramOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  if (sections.length === 0) {
    return svgEmpty(o.width, o.height);
  }

  const minTick = Math.min(...sections.map(s => s.startTick));
  const maxTick = Math.max(...sections.map(s => s.endTick));
  const tickRange = maxTick - minTick || 1;
  const contentWidth = o.width - o.marginLeft - o.padding;

  const tickToX = (tick: number): number =>
    o.marginLeft + ((tick - minTick) / tickRange) * contentWidth;

  // Assign colors by unique label
  const labelColors = new Map<string, string>();
  let colorIdx = 0;
  for (const s of sections) {
    if (!labelColors.has(s.label)) {
      labelColors.set(s.label, o.sectionColors[colorIdx % o.sectionColors.length]!);
      colorIdx++;
    }
  }

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Section bars
  for (const s of sections) {
    const x = tickToX(s.startTick);
    const w = tickToX(s.endTick) - x;
    const color = labelColors.get(s.label)!;

    svg.push(
      `<rect x="${x.toFixed(1)}" y="${o.barTop}" ` +
      `width="${Math.max(1, w).toFixed(1)}" height="${o.barHeight}" ` +
      `fill="${color}" opacity="0.7" stroke="#fff" stroke-width="1"/>`,
    );

    // Section label centered
    if (w > 20) {
      svg.push(
        `<text x="${(x + w / 2).toFixed(1)}" y="${(o.barTop + o.barHeight / 2 + 4).toFixed(1)}" ` +
        `text-anchor="middle" font-size="12" font-family="monospace" font-weight="bold" ` +
        `fill="#fff">${escapeXml(s.label)}</text>`,
      );
    }
  }

  // Novelty curve
  if (novelty && novelty.length > 0) {
    const noveltyTop = o.barTop + o.barHeight + 10;
    const maxNovelty = Math.max(...novelty.map(p => p.value), 0.001);

    const coords: (readonly [number, number])[] = novelty.map(p => [
      tickToX(p.tick),
      noveltyTop + o.noveltyHeight - (p.value / maxNovelty) * o.noveltyHeight,
    ] as const);

    svg.push(
      `<polyline points="${polylinePoints(coords)}" fill="none" ` +
      `stroke="${o.noveltyColor}" stroke-width="${o.noveltyStrokeWidth}"/>`,
    );

    // Axis label
    svg.push(
      `<text x="${o.marginLeft}" y="${noveltyTop - 3}" ` +
      `font-size="8" font-family="monospace" fill="#999">Novelty</text>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}
