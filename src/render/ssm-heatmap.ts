// ---------------------------------------------------------------------------
// Stratum — Self-Similarity Matrix Heatmap SVG Renderer
// ---------------------------------------------------------------------------

import type { SimilarityMatrix, NoveltyPoint } from '../analysis/structural.js';
import { svgOpen, svgClose, svgEmpty, colorRamp, VIRIDIS_STOPS } from './svg-utils.js';
import type { ColorStop } from './svg-utils.js';

/** Options for SSM heatmap rendering. */
export interface SSMHeatmapOptions {
  /** Chart width in pixels (default 500). */
  width?: number;
  /** Chart height in pixels (default 500). */
  height?: number;
  /** Padding around the matrix (default 30). */
  padding?: number;
  /** Color stops for the heatmap (default viridis). */
  colorStops?: readonly ColorStop[];
  /** Show novelty peak markers (default true). */
  showNoveltyPeaks?: boolean;
  /** Novelty peak marker color (default '#dc2626'). */
  peakColor?: string;
}

const DEFAULTS: Required<SSMHeatmapOptions> = {
  width: 500,
  height: 500,
  padding: 30,
  colorStops: VIRIDIS_STOPS,
  showNoveltyPeaks: true,
  peakColor: '#dc2626',
};

/**
 * Render a self-similarity matrix as an SVG heatmap.
 *
 * @param matrix — The similarity matrix to render.
 * @param noveltyPeaks — Optional novelty peaks to mark as vertical/horizontal red lines.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderSSM(
  matrix: SimilarityMatrix,
  noveltyPeaks?: readonly NoveltyPoint[],
  options?: Partial<SSMHeatmapOptions>,
): string {
  const o = { ...DEFAULTS, ...options };
  const n = matrix.size;

  if (n === 0) {
    return svgEmpty(o.width, o.height);
  }

  const matrixSize = Math.min(o.width, o.height) - 2 * o.padding;
  const cellSize = matrixSize / n;
  const offsetX = o.padding;
  const offsetY = o.padding;

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Matrix cells
  for (let i = 0; i < n; i++) {
    const row = matrix.data[i];
    if (!row) continue;
    for (let j = 0; j < n; j++) {
      const val = row[j] ?? 0;
      const color = colorRamp(val, o.colorStops);
      const x = offsetX + j * cellSize;
      const y = offsetY + i * cellSize;

      svg.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${(cellSize + 0.5).toFixed(1)}" height="${(cellSize + 0.5).toFixed(1)}" ` +
        `fill="${color}"/>`,
      );
    }
  }

  // Border
  svg.push(
    `<rect x="${offsetX}" y="${offsetY}" ` +
    `width="${matrixSize.toFixed(1)}" height="${matrixSize.toFixed(1)}" ` +
    `fill="none" stroke="#333" stroke-width="0.5"/>`,
  );

  // Novelty peak markers
  if (o.showNoveltyPeaks && noveltyPeaks && noveltyPeaks.length > 0) {
    // Map peak tick positions to matrix indices using the matrix windowSize
    const totalDuration = matrix.windowSize * n;
    for (const peak of noveltyPeaks) {
      const idx = totalDuration > 0
        ? (peak.tick / totalDuration) * n
        : 0;
      if (idx < 0 || idx > n) continue;
      const pos = offsetX + idx * cellSize;

      // Vertical line
      svg.push(
        `<line x1="${pos.toFixed(1)}" y1="${offsetY}" ` +
        `x2="${pos.toFixed(1)}" y2="${(offsetY + matrixSize).toFixed(1)}" ` +
        `stroke="${o.peakColor}" stroke-width="1" stroke-opacity="0.6"/>`,
      );
      // Horizontal line
      svg.push(
        `<line x1="${offsetX}" y1="${pos.toFixed(1)}" ` +
        `x2="${(offsetX + matrixSize).toFixed(1)}" y2="${pos.toFixed(1)}" ` +
        `stroke="${o.peakColor}" stroke-width="1" stroke-opacity="0.6"/>`,
      );
    }
  }

  svg.push(svgClose());
  return svg.join('\n');
}
