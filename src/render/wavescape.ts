// ---------------------------------------------------------------------------
// Stratum — Wavescape SVG Renderer (Hierarchical DFT Visualization)
// ---------------------------------------------------------------------------

import type { Score } from '../core/types.js';
import { chromaVector } from '../tension/tiv.js';
import { svgOpen, svgClose, svgEmpty, hslToRgb } from './svg-utils.js';

/** Options for wavescape rendering. */
export interface WavescapeOptions {
  /** Chart width in pixels (default 800). */
  width?: number;
  /** Chart height in pixels (default 400). */
  height?: number;
  /** DFT coefficient to display (1-6, default 5 for diatonicity). */
  coefficient?: number;
  /** Ticks per beat-level window (default: ticksPerQuarter from score). */
  windowSize?: number;
  /** Background color (default '#1a1a2e' — dark for contrast). */
  background?: string;
  /** Minimum saturation (default 0.7). */
  minSaturation?: number;
}

const DEFAULTS: Required<WavescapeOptions> = {
  width: 800,
  height: 400,
  coefficient: 5,
  windowSize: 0, // 0 = auto from score
  background: '#1a1a2e',
  minSaturation: 0.7,
};

/**
 * Render a wavescape visualization as SVG.
 *
 * A wavescape is a triangular layout where the bottom row shows beat-level
 * DFT analysis and each higher row aggregates wider time windows, up to
 * the entire piece at the apex. Color encodes phase (hue) and magnitude
 * (saturation) of a selected DFT coefficient.
 *
 * @param score — The score to analyze.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderWavescape(
  score: Score,
  options?: Partial<WavescapeOptions>,
): string {
  const o = { ...DEFAULTS, ...options };
  const coeff = Math.max(1, Math.min(6, o.coefficient));

  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) {
    return svgEmpty(o.width, o.height);
  }

  const windowSize = o.windowSize > 0 ? o.windowSize : score.settings.ticksPerQuarter;
  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const numWindows = Math.max(1, Math.ceil(maxTick / windowSize));

  // Build chroma vectors for each beat-level window
  const windowChromas: number[][] = [];
  for (let w = 0; w < numWindows; w++) {
    const startTick = w * windowSize;
    const endTick = startTick + windowSize;
    const windowEvents = allEvents.filter(
      e => e.onset < endTick && e.onset + e.duration > startTick,
    );
    windowChromas.push(chromaVector(windowEvents));
  }

  // Build hierarchy: level 0 = individual windows, level k = aggregations of k+1 windows
  // At level k, there are (numWindows - k) cells
  const levels: Array<Array<{ phase: number; magnitude: number }>> = [];

  for (let level = 0; level < numWindows; level++) {
    const count = numWindows - level;
    const row: Array<{ phase: number; magnitude: number }> = [];
    for (let i = 0; i < count; i++) {
      // Aggregate chroma from window i to window i+level
      const agg = new Array<number>(12).fill(0);
      for (let w = i; w <= i + level; w++) {
        const chroma = windowChromas[w];
        if (chroma) {
          for (let pc = 0; pc < 12; pc++) {
            agg[pc] = (agg[pc] ?? 0) + (chroma[pc] ?? 0);
          }
        }
      }
      // Compute DFT coefficient
      const { phase, magnitude } = dftCoefficient(agg, coeff);
      row.push({ phase, magnitude });
    }
    levels.push(row);
  }

  // Find max magnitude for normalization
  let maxMag = 0;
  for (const row of levels) {
    for (const cell of row) {
      if (cell.magnitude > maxMag) maxMag = cell.magnitude;
    }
  }
  if (maxMag === 0) maxMag = 1;

  // Render triangular layout
  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="${o.background}"/>`);

  const cellWidth = o.width / numWindows;
  const cellHeight = o.height / numWindows;

  for (let level = 0; level < levels.length; level++) {
    const row = levels[level]!;
    const count = row.length;
    const xOffset = (level * cellWidth) / 2; // center triangle
    const y = o.height - (level + 1) * cellHeight; // bottom = level 0

    for (let i = 0; i < count; i++) {
      const cell = row[i]!;
      const x = xOffset + i * cellWidth;

      // Map phase to hue (0-360) and magnitude to saturation
      const hue = ((cell.phase / (2 * Math.PI)) * 360 + 360) % 360;
      const sat = o.minSaturation + (1 - o.minSaturation) * (cell.magnitude / maxMag);
      const light = 0.35 + 0.15 * (cell.magnitude / maxMag);
      const color = hslToRgb(hue, sat, light);

      svg.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${(cellWidth + 0.5).toFixed(1)}" height="${(cellHeight + 0.5).toFixed(1)}" ` +
        `fill="${color}"/>`,
      );
    }
  }

  svg.push(svgClose());
  return svg.join('\n');
}

/** Compute a single DFT coefficient (magnitude and phase) from a 12-element chroma vector. */
function dftCoefficient(chroma: number[], k: number): { phase: number; magnitude: number } {
  let real = 0;
  let imag = 0;
  for (let n = 0; n < 12; n++) {
    const angle = (2 * Math.PI * k * n) / 12;
    real += (chroma[n] ?? 0) * Math.cos(angle);
    imag += (chroma[n] ?? 0) * Math.sin(angle);
  }
  return {
    magnitude: Math.sqrt(real * real + imag * imag),
    phase: Math.atan2(imag, real),
  };
}
