// ---------------------------------------------------------------------------
// Stratum — Pitch-Space Plot SVG Renderer
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';
import { svgOpen, svgClose, svgEmpty, polylinePoints } from './svg-utils.js';

/** Options for pitch-space plot rendering. */
export interface PitchSpacePlotOptions {
  /** Chart width in pixels (default 600). */
  width?: number;
  /** Chart height in pixels (default 400). */
  height?: number;
  /** Padding (default 30). */
  padding?: number;
  /** Geometry: 'linear' (piano-roll), 'circular' (PC on circle), 'spiral' (default 'linear'). */
  geometry?: 'linear' | 'circular' | 'spiral';
  /** Dot radius (default 3). */
  dotRadius?: number;
  /** Dot color (default '#2563eb'). */
  dotColor?: string;
  /** Contour line color (default '#94a3b8'). */
  contourColor?: string;
  /** Show contour lines connecting successive events (default true). */
  showContour?: boolean;
  /** Stroke width for contour lines (default 1). */
  contourWidth?: number;
  /** Spiral base radius (default 80). */
  spiralBaseRadius?: number;
  /** Spiral octave step (default 25). */
  spiralOctaveStep?: number;
}

const DEFAULTS: Required<PitchSpacePlotOptions> = {
  width: 600,
  height: 400,
  padding: 30,
  geometry: 'linear',
  dotRadius: 3,
  dotColor: '#2563eb',
  contourColor: '#94a3b8',
  showContour: true,
  contourWidth: 1,
  spiralBaseRadius: 80,
  spiralOctaveStep: 25,
};

/**
 * Render note events as a pitch-space plot in one of three geometries.
 *
 * - **linear**: X = onset, Y = MIDI pitch (piano-roll with dots + contour).
 * - **circular**: 12 PCs on a circle, radius encodes time progression.
 * - **spiral**: angle = PC * 30 deg, radius = baseRadius + octave * step.
 *
 * @param events — Note events to plot.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderPitchSpacePlot(
  events: readonly NoteEvent[],
  options?: Partial<PitchSpacePlotOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  if (events.length === 0) {
    return svgEmpty(o.width, o.height);
  }

  const sorted = [...events].sort((a, b) => a.onset - b.onset);

  switch (o.geometry) {
    case 'circular': return renderCircular(sorted, o);
    case 'spiral': return renderSpiral(sorted, o);
    default: return renderLinear(sorted, o);
  }
}

function renderLinear(
  events: readonly NoteEvent[],
  o: Required<PitchSpacePlotOptions>,
): string {
  const chartW = o.width - 2 * o.padding;
  const chartH = o.height - 2 * o.padding;

  const minOnset = events[0]!.onset;
  const maxOnset = Math.max(...events.map(e => e.onset + e.duration));
  const onsetRange = maxOnset - minOnset || 1;

  const minMidi = Math.min(...events.map(e => e.pitch.midi));
  const maxMidi = Math.max(...events.map(e => e.pitch.midi));
  const midiRange = maxMidi - minMidi || 1;

  const toX = (onset: number) => o.padding + ((onset - minOnset) / onsetRange) * chartW;
  const toY = (midi: number) => o.padding + chartH - ((midi - minMidi) / midiRange) * chartH;

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Contour line
  if (o.showContour && events.length > 1) {
    const coords: (readonly [number, number])[] = events.map(e =>
      [toX(e.onset), toY(e.pitch.midi)] as const,
    );
    svg.push(
      `<polyline points="${polylinePoints(coords)}" fill="none" ` +
      `stroke="${o.contourColor}" stroke-width="${o.contourWidth}"/>`,
    );
  }

  // Dots
  for (const e of events) {
    const x = toX(e.onset);
    const y = toY(e.pitch.midi);
    svg.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${o.dotRadius}" fill="${o.dotColor}"/>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}

function renderCircular(
  events: readonly NoteEvent[],
  o: Required<PitchSpacePlotOptions>,
): string {
  const cx = o.width / 2;
  const cy = o.height / 2;
  const maxR = Math.min(cx, cy) - o.padding;
  const minR = maxR * 0.2;

  const minOnset = events[0]!.onset;
  const maxOnset = Math.max(...events.map(e => e.onset));
  const onsetRange = maxOnset - minOnset || 1;

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // PC guide circle
  svg.push(`<circle cx="${cx}" cy="${cy}" r="${maxR.toFixed(1)}" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>`);

  // Contour
  if (o.showContour && events.length > 1) {
    const coords: (readonly [number, number])[] = events.map(e => {
      const angle = (e.pitch.pitchClass / 12) * 2 * Math.PI - Math.PI / 2;
      const r = minR + ((e.onset - minOnset) / onsetRange) * (maxR - minR);
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
    });
    svg.push(
      `<polyline points="${polylinePoints(coords)}" fill="none" ` +
      `stroke="${o.contourColor}" stroke-width="${o.contourWidth}"/>`,
    );
  }

  // Dots
  for (const e of events) {
    const angle = (e.pitch.pitchClass / 12) * 2 * Math.PI - Math.PI / 2;
    const r = minR + ((e.onset - minOnset) / onsetRange) * (maxR - minR);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    svg.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${o.dotRadius}" fill="${o.dotColor}"/>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}

function renderSpiral(
  events: readonly NoteEvent[],
  o: Required<PitchSpacePlotOptions>,
): string {
  const cx = o.width / 2;
  const cy = o.height / 2;

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Spiral guide
  const minOct = Math.min(...events.map(e => e.pitch.octave));
  const maxOct = Math.max(...events.map(e => e.pitch.octave));
  for (let oct = minOct; oct <= maxOct; oct++) {
    const r = o.spiralBaseRadius + (oct - minOct) * o.spiralOctaveStep;
    svg.push(
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2"/>`,
    );
  }

  const toPos = (e: NoteEvent): readonly [number, number] => {
    const angle = (e.pitch.pitchClass / 12) * 2 * Math.PI - Math.PI / 2;
    const r = o.spiralBaseRadius + (e.pitch.octave - minOct) * o.spiralOctaveStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  // Contour
  if (o.showContour && events.length > 1) {
    const coords = events.map(toPos);
    svg.push(
      `<polyline points="${polylinePoints(coords)}" fill="none" ` +
      `stroke="${o.contourColor}" stroke-width="${o.contourWidth}"/>`,
    );
  }

  // Dots
  for (const e of events) {
    const [x, y] = toPos(e);
    svg.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${o.dotRadius}" fill="${o.dotColor}"/>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}
