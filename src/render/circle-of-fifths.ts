// ---------------------------------------------------------------------------
// Stratum — Circle of Fifths SVG Renderer
// ---------------------------------------------------------------------------

import { escapeXml, svgOpen, svgClose } from './svg-utils.js';

/** Pitch classes arranged in fifths order. */
const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const;

const SHARP_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const FLAT_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];

/** Options for circle-of-fifths rendering. */
export interface CircleOfFifthsOptions {
  /** Chart width in pixels (default 400). */
  width?: number;
  /** Chart height in pixels (default 400). */
  height?: number;
  /** Active pitch classes to highlight (default all). */
  activePCs?: readonly number[];
  /** Tonic pitch class for key highlighting (default undefined). */
  keyTonic?: number;
  /** Key mode (default 'major'). */
  keyMode?: 'major' | 'minor';
  /** Show chord quality labels M/m/dim (default true). */
  showChordQuality?: boolean;
  /** Label format: 'sharp' or 'flat' (default 'sharp'). */
  labelFormat?: 'sharp' | 'flat';
  /** Node radius (default 24). */
  nodeRadius?: number;
  /** Active node fill color (default '#2563eb'). */
  activeColor?: string;
  /** Inactive node fill color (default '#e5e7eb'). */
  inactiveColor?: string;
  /** Key arc color (default '#fbbf24'). */
  keyArcColor?: string;
}

const DEFAULTS: Required<CircleOfFifthsOptions> = {
  width: 400,
  height: 400,
  activePCs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  keyTonic: 0,
  keyMode: 'major',
  showChordQuality: true,
  labelFormat: 'sharp',
  nodeRadius: 24,
  activeColor: '#2563eb',
  inactiveColor: '#e5e7eb',
  keyArcColor: '#fbbf24',
};

// Major scale intervals from tonic in semitones
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
// Minor scale intervals from tonic in semitones
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
// Chord quality for each scale degree (major): M M m M M m dim
const MAJOR_QUALITIES = ['M', 'M', 'm', 'M', 'M', 'm', 'dim'];
// Chord quality for each scale degree (minor): m dim M m m M M
const MINOR_QUALITIES = ['m', 'dim', 'M', 'm', 'm', 'M', 'M'];

/**
 * Render a circle of fifths as SVG.
 *
 * @param options — Rendering options.
 * @returns SVG string with 12 pitch-class nodes in fifths order.
 */
export function renderCircleOfFifths(
  options?: Partial<CircleOfFifthsOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  const cx = o.width / 2;
  const cy = o.height / 2;
  const circleR = Math.min(cx, cy) - 40;
  const activeSet = new Set(o.activePCs);
  const names = o.labelFormat === 'flat' ? FLAT_NAMES : SHARP_NAMES;

  // Build key PCs and quality map
  const scalePCs = new Set<number>();
  const qualityMap = new Map<number, string>();
  if (o.keyTonic !== undefined) {
    const intervals = o.keyMode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
    const qualities = o.keyMode === 'minor' ? MINOR_QUALITIES : MAJOR_QUALITIES;
    for (let i = 0; i < intervals.length; i++) {
      const pc = ((o.keyTonic + (intervals[i] ?? 0)) % 12 + 12) % 12;
      scalePCs.add(pc);
      qualityMap.set(pc, qualities[i]!);
    }
  }

  const angleStep = (2 * Math.PI) / 12;

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Key arc highlighting
  if (o.keyTonic !== undefined) {
    // Find the index of the tonic in FIFTHS_ORDER
    const tonicIdx = FIFTHS_ORDER.indexOf(o.keyTonic as 0);
    if (tonicIdx >= 0) {
      // Highlight 7 consecutive fifths-order positions centered on tonic
      // Major: tonic is at center; Minor: relative major's tonic at center
      const centerIdx = o.keyMode === 'minor'
        ? FIFTHS_ORDER.indexOf(((o.keyTonic + 3) % 12) as 0)
        : tonicIdx;
      if (centerIdx >= 0) {
        for (let d = -3; d <= 3; d++) {
          const idx = ((centerIdx + d) % 12 + 12) % 12;
          const angle = -Math.PI / 2 + idx * angleStep;
          const ax = cx + circleR * Math.cos(angle);
          const ay = cy + circleR * Math.sin(angle);
          svg.push(
            `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="${(o.nodeRadius + 4).toFixed(1)}" ` +
            `fill="${o.keyArcColor}" opacity="0.3"/>`,
          );
        }
      }
    }
  }

  // Connecting circle (decorative)
  svg.push(
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${circleR.toFixed(1)}" ` +
    `fill="none" stroke="#ddd" stroke-width="1"/>`,
  );

  // Nodes
  for (let i = 0; i < 12; i++) {
    const pc = FIFTHS_ORDER[i]!;
    const angle = -Math.PI / 2 + i * angleStep;
    const nx = cx + circleR * Math.cos(angle);
    const ny = cy + circleR * Math.sin(angle);
    const isActive = activeSet.has(pc);
    const isInKey = scalePCs.has(pc);
    const fill = isActive ? o.activeColor : o.inactiveColor;
    const opacity = isInKey ? '1' : '0.5';

    svg.push(
      `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${o.nodeRadius}" ` +
      `fill="${fill}" opacity="${opacity}" stroke="#fff" stroke-width="2"/>`,
    );

    // Pitch name
    svg.push(
      `<text x="${nx.toFixed(1)}" y="${(ny + 1).toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="middle" ` +
      `font-size="12" font-family="monospace" font-weight="bold" fill="#fff">${escapeXml(names[i]!)}</text>`,
    );

    // Chord quality
    if (o.showChordQuality && qualityMap.has(pc)) {
      const quality = qualityMap.get(pc)!;
      svg.push(
        `<text x="${nx.toFixed(1)}" y="${(ny + 12).toFixed(1)}" ` +
        `text-anchor="middle" font-size="8" font-family="monospace" fill="#fff">${escapeXml(quality)}</text>`,
      );
    }
  }

  svg.push(svgClose());
  return svg.join('\n');
}
