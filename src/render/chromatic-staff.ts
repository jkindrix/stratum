import type { Score } from '../core/types.js';

/** Options for chromatic staff SVG rendering */
export interface RenderOptions {
  /** Pixels per tick (horizontal scale) */
  pixelsPerTick?: number;
  /** Pixels per semitone (vertical scale) */
  pixelsPerSemitone?: number;
  /** Lowest MIDI note displayed */
  lowNote?: number;
  /** Highest MIDI note displayed */
  highNote?: number;
  /** Colors for each part/voice */
  voiceColors?: string[];
  /** Show measure bar lines */
  showMeasures?: boolean;
  /** Show pitch labels in left margin */
  showLabels?: boolean;
  /** Left margin width in pixels */
  marginLeft?: number;
  /** Top/bottom padding */
  padding?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);

const DEFAULTS: Required<RenderOptions> = {
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

/** Escape text for safe XML embedding. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render a score as an SVG chromatic staff.
 *
 * Uses proportional (piano-roll) view: each note is a horizontal block
 * whose width represents duration and vertical position represents pitch.
 * The staff has one line per semitone with visual weight distinguishing
 * natural notes, chromatic notes, and octave boundaries.
 */
export function renderChromaticStaff(score: Score, options?: Partial<RenderOptions>): string {
  const o = { ...DEFAULTS, ...options };

  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>';
  }

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const noteRange = o.highNote - o.lowNote;
  const staffHeight = noteRange * o.pixelsPerSemitone;
  const contentWidth = maxTick * o.pixelsPerTick;
  const totalWidth = o.marginLeft + contentWidth + o.padding;
  const totalHeight = staffHeight + o.padding * 2;

  const midiToY = (midi: number): number =>
    o.padding + (o.highNote - midi) * o.pixelsPerSemitone;

  const tickToX = (tick: number): number =>
    o.marginLeft + tick * o.pixelsPerTick;

  const svg: string[] = [];

  // Header
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${totalWidth} ${totalHeight}" ` +
    `width="${totalWidth}" height="${totalHeight}">`,
  );

  // Background
  svg.push(`<rect width="${totalWidth}" height="${totalHeight}" fill="#fafafa"/>`);

  // Octave band shading
  for (let midi = o.lowNote; midi < o.highNote; midi += 12) {
    const octave = Math.floor(midi / 12) - 1;
    if (octave % 2 === 1) {
      const top = midiToY(Math.min(midi + 12, o.highNote));
      const bottom = midiToY(midi);
      svg.push(
        `<rect x="${o.marginLeft}" y="${top}" ` +
        `width="${contentWidth}" height="${bottom - top}" fill="#f0f0f0"/>`,
      );
    }
  }

  // Staff lines
  for (let midi = o.lowNote; midi <= o.highNote; midi++) {
    const pc = midi % 12;
    const y = midiToY(midi);

    let width: number;
    let color: string;
    let dash = '';

    if (pc === 0) {
      // Octave boundary (C)
      width = 2;
      color = '#333';
    } else if (NATURAL_PCS.has(pc)) {
      // Natural note — dashed
      width = 0.5;
      color = '#aaa';
      dash = ' stroke-dasharray="4,4"';
    } else {
      // Chromatic note — thin solid
      width = 0.75;
      color = '#ccc';
    }

    svg.push(
      `<line x1="${o.marginLeft}" y1="${y}" x2="${totalWidth - o.padding}" y2="${y}" ` +
      `stroke="${color}" stroke-width="${width}"${dash}/>`,
    );

    // Left-margin labels
    if (o.showLabels && (NATURAL_PCS.has(pc) || pc === 0)) {
      const octave = Math.floor(midi / 12) - 1;
      const label = escapeXml(`${NOTE_NAMES[pc]}${octave}`);
      svg.push(
        `<text x="${o.marginLeft - 4}" y="${y + 3}" ` +
        `text-anchor="end" font-size="9" font-family="monospace" fill="#666">${label}</text>`,
      );
    }
  }

  // Measure lines — adapts to multiple time signatures
  if (o.showMeasures && score.timeSignatures.length > 0) {
    const tpq = score.settings.ticksPerQuarter;
    let measureNum = 1;

    // Sort time signatures by tick
    const sortedTS = [...score.timeSignatures].sort((a, b) => a.atTick - b.atTick);

    for (let tsi = 0; tsi < sortedTS.length; tsi++) {
      const ts = sortedTS[tsi]!;
      const ticksPerMeasure = ts.numerator * (4 / ts.denominator) * tpq;
      const nextTsTick = tsi + 1 < sortedTS.length ? sortedTS[tsi + 1]!.atTick : maxTick + ticksPerMeasure;

      for (let tick = ts.atTick; tick <= maxTick && tick < nextTsTick; tick += ticksPerMeasure) {
        const x = tickToX(tick);
        svg.push(
          `<line x1="${x}" y1="${o.padding}" x2="${x}" y2="${o.padding + staffHeight}" ` +
          `stroke="#bbb" stroke-width="1"/>`,
        );
        svg.push(
          `<text x="${x + 3}" y="${o.padding - 5}" ` +
          `font-size="8" font-family="monospace" fill="#999">${measureNum}</text>`,
        );
        measureNum++;
      }
    }
  }

  // Note blocks (proportional view)
  for (let pi = 0; pi < score.parts.length; pi++) {
    const part = score.parts[pi]!;
    const color = o.voiceColors[pi % o.voiceColors.length]!;

    for (const evt of part.events) {
      const midi = evt.pitch.midi;
      if (midi < o.lowNote || midi > o.highNote) continue;

      const x = tickToX(evt.onset);
      const w = Math.max(2, evt.duration * o.pixelsPerTick);
      const y = midiToY(midi) - o.pixelsPerSemitone / 2;
      const h = o.pixelsPerSemitone - 1;
      const opacity = (0.4 + (evt.velocity / 127) * 0.6).toFixed(2);

      svg.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${w.toFixed(1)}" height="${h}" rx="2" ` +
        `fill="${color}" opacity="${opacity}"/>`,
      );
    }
  }

  svg.push('</svg>');
  return svg.join('\n');
}
