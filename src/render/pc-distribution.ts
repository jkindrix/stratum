// ---------------------------------------------------------------------------
// Stratum — Pitch-Class Distribution SVG Renderer
// ---------------------------------------------------------------------------

import { escapeXml, svgOpen, svgClose, svgEmpty } from './svg-utils.js';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Options for pitch-class distribution rendering. */
export interface PCDistributionOptions {
  /** Chart width in pixels (default 400). */
  width?: number;
  /** Chart height in pixels (default 300). */
  height?: number;
  /** Left margin for labels (default 40). */
  marginLeft?: number;
  /** Bottom margin for labels (default 30). */
  marginBottom?: number;
  /** Top/right padding (default 10). */
  padding?: number;
  /** Bar color (default '#2563eb'). */
  barColor?: string;
  /** Key profile overlay color (default '#dc2626'). */
  profileColor?: string;
  /** Layout mode: 'horizontal' bars or 'circular' (default 'horizontal'). */
  mode?: 'horizontal' | 'circular';
}

const DEFAULTS: Required<PCDistributionOptions> = {
  width: 400,
  height: 300,
  marginLeft: 40,
  marginBottom: 30,
  padding: 10,
  barColor: '#2563eb',
  profileColor: '#dc2626',
  mode: 'horizontal',
};

/**
 * Render a 12-element pitch-class distribution as an SVG bar chart.
 *
 * @param distribution — 12-element array of values (e.g. from `pcDistribution()`).
 * @param keyProfile — Optional 12-element key profile overlay.
 * @param options — Rendering options.
 * @returns SVG string.
 */
export function renderPCDistribution(
  distribution: readonly number[],
  keyProfile?: readonly number[],
  options?: Partial<PCDistributionOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  if (distribution.length !== 12) {
    return svgEmpty(o.width, o.height);
  }

  const maxVal = Math.max(...distribution, 0.001);
  const maxProfile = keyProfile && keyProfile.length === 12
    ? Math.max(...keyProfile, 0.001)
    : 0;

  if (o.mode === 'circular') {
    return renderCircular(distribution, keyProfile, o, maxVal);
  }

  const chartWidth = o.width - o.marginLeft - o.padding;
  const chartHeight = o.height - o.marginBottom - o.padding;
  const barWidth = chartWidth / 12 - 2;

  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Bars
  for (let i = 0; i < 12; i++) {
    const val = distribution[i] ?? 0;
    const barH = (val / maxVal) * chartHeight;
    const x = o.marginLeft + (chartWidth / 12) * i + 1;
    const y = o.padding + chartHeight - barH;

    svg.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
      `width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" ` +
      `fill="${o.barColor}" opacity="0.8"/>`,
    );

    // Label
    svg.push(
      `<text x="${(x + barWidth / 2).toFixed(1)}" y="${o.height - o.marginBottom + 15}" ` +
      `text-anchor="middle" font-size="9" font-family="monospace" fill="#666">${escapeXml(NOTE_NAMES[i]!)}</text>`,
    );
  }

  // Key profile overlay
  if (keyProfile && keyProfile.length === 12 && maxProfile > 0) {
    for (let i = 0; i < 12; i++) {
      const val = (keyProfile[i] ?? 0) / maxProfile;
      const barH = val * chartHeight;
      const x = o.marginLeft + (chartWidth / 12) * i + 1;
      const y = o.padding + chartHeight - barH;

      svg.push(
        `<rect x="${(x + barWidth * 0.3).toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${(barWidth * 0.4).toFixed(1)}" height="${barH.toFixed(1)}" ` +
        `fill="none" stroke="${o.profileColor}" stroke-width="1.5"/>`,
      );
    }
  }

  // Y-axis grid lines
  for (let frac = 0; frac <= 1; frac += 0.25) {
    const y = o.padding + chartHeight * (1 - frac);
    svg.push(
      `<line x1="${o.marginLeft}" y1="${y.toFixed(1)}" ` +
      `x2="${o.marginLeft + chartWidth}" y2="${y.toFixed(1)}" ` +
      `stroke="#e0e0e0" stroke-width="0.5"/>`,
    );
    svg.push(
      `<text x="${o.marginLeft - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" ` +
      `font-size="8" font-family="monospace" fill="#999">${(frac * maxVal).toFixed(0)}</text>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}

function renderCircular(
  distribution: readonly number[],
  keyProfile: readonly number[] | undefined,
  o: Required<PCDistributionOptions>,
  maxVal: number,
): string {
  const svg: string[] = [];
  svg.push(svgOpen(o.width, o.height));
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  const cx = o.width / 2;
  const cy = o.height / 2;
  const maxRadius = Math.min(cx, cy) - 30;
  const innerRadius = maxRadius * 0.3;

  // Radial bars
  const angleStep = (2 * Math.PI) / 12;
  const halfArc = angleStep * 0.35;

  for (let i = 0; i < 12; i++) {
    const val = distribution[i] ?? 0;
    const r = innerRadius + (val / maxVal) * (maxRadius - innerRadius);
    const angle = -Math.PI / 2 + i * angleStep;

    const x1 = cx + innerRadius * Math.cos(angle - halfArc);
    const y1 = cy + innerRadius * Math.sin(angle - halfArc);
    const x2 = cx + r * Math.cos(angle - halfArc);
    const y2 = cy + r * Math.sin(angle - halfArc);
    const x3 = cx + r * Math.cos(angle + halfArc);
    const y3 = cy + r * Math.sin(angle + halfArc);
    const x4 = cx + innerRadius * Math.cos(angle + halfArc);
    const y4 = cy + innerRadius * Math.sin(angle + halfArc);

    svg.push(
      `<polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ` +
      `${x3.toFixed(1)},${y3.toFixed(1)} ${x4.toFixed(1)},${y4.toFixed(1)}" ` +
      `fill="${o.barColor}" opacity="0.7"/>`,
    );

    // Label
    const labelR = maxRadius + 15;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    svg.push(
      `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" ` +
      `text-anchor="middle" font-size="9" font-family="monospace" fill="#666">${escapeXml(NOTE_NAMES[i]!)}</text>`,
    );
  }

  // Profile overlay
  if (keyProfile && keyProfile.length === 12) {
    const maxP = Math.max(...keyProfile, 0.001);
    const pts: string[] = [];
    for (let i = 0; i < 12; i++) {
      const val = (keyProfile[i] ?? 0) / maxP;
      const r = innerRadius + val * (maxRadius - innerRadius);
      const angle = -Math.PI / 2 + i * angleStep;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
    }
    svg.push(
      `<polygon points="${pts.join(' ')}" fill="none" ` +
      `stroke="${o.profileColor}" stroke-width="1.5" stroke-dasharray="4,2"/>`,
    );
  }

  svg.push(svgClose());
  return svg.join('\n');
}
