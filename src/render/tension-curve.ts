import type { TensionCurve } from '../tension/tension.js';
import { escapeXml } from './svg-utils.js';

/** Options for tension curve SVG rendering */
export interface TensionRenderOptions {
  /** Chart width in pixels (default 800) */
  width?: number;
  /** Chart height in pixels (default 200) */
  height?: number;
  /** Left margin for Y-axis labels (default 40) */
  marginLeft?: number;
  /** Bottom margin for X-axis labels (default 30) */
  marginBottom?: number;
  /** Top/right padding (default 10) */
  padding?: number;
  /** Show individual component lines (default false) */
  showComponents?: boolean;
  /** Color for total tension line (default '#2563eb') */
  totalColor?: string;
  /** Colors per component: [roughness, metric, registral, density] */
  componentColors?: [string, string, string, string];
  /** X-axis mode: 'seconds' or 'ticks' (default 'seconds') */
  timeAxis?: 'seconds' | 'ticks';
  /** Stroke width for lines (default 2) */
  strokeWidth?: number;
}

const DEFAULTS: Required<TensionRenderOptions> = {
  width: 800,
  height: 200,
  marginLeft: 40,
  marginBottom: 30,
  padding: 10,
  showComponents: false,
  totalColor: '#2563eb',
  componentColors: ['#dc2626', '#16a34a', '#ca8a04', '#9333ea'],
  timeAxis: 'seconds',
  strokeWidth: 2,
};

/**
 * Render a tension curve as an SVG line chart.
 *
 * The chart plots tension (0.0 - 1.0) on the Y-axis against time on the X-axis.
 * Optionally shows individual component curves (roughness, metric, registral, density).
 *
 * @param curve — The tension curve to render.
 * @param options — Rendering options.
 * @returns An SVG string containing the rendered line chart.
 */
export function renderTensionCurve(
  curve: TensionCurve,
  options?: Partial<TensionRenderOptions>,
): string {
  const o = { ...DEFAULTS, ...options };

  if (curve.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}"></svg>`;
  }

  const chartWidth = o.width - o.marginLeft - o.padding;
  const chartHeight = o.height - o.marginBottom - o.padding;
  const chartTop = o.padding;
  const chartLeft = o.marginLeft;

  // Time range
  const timeKey = o.timeAxis === 'ticks' ? 'tick' : 'seconds';
  const minTime = curve[0]![timeKey];
  const maxTime = curve[curve.length - 1]![timeKey];
  const timeRange = maxTime - minTime || 1;

  const timeToX = (t: number): number =>
    chartLeft + ((t - minTime) / timeRange) * chartWidth;

  const valToY = (v: number): number =>
    chartTop + chartHeight - v * chartHeight;

  const svg: string[] = [];

  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${o.width} ${o.height}" ` +
    `width="${o.width}" height="${o.height}">`,
  );

  // Background
  svg.push(`<rect width="${o.width}" height="${o.height}" fill="#fafafa"/>`);

  // Grid lines (horizontal, 0.0 to 1.0 in 0.25 steps)
  for (let v = 0; v <= 1; v += 0.25) {
    const y = valToY(v);
    svg.push(
      `<line x1="${chartLeft}" y1="${y}" x2="${chartLeft + chartWidth}" y2="${y}" ` +
      `stroke="#e0e0e0" stroke-width="0.5"/>`,
    );
    svg.push(
      `<text x="${chartLeft - 4}" y="${y + 3}" text-anchor="end" ` +
      `font-size="9" font-family="monospace" fill="#999">${v.toFixed(2)}</text>`,
    );
  }

  // X-axis labels
  const numXLabels = Math.min(10, curve.length);
  const xStep = Math.max(1, Math.floor(curve.length / numXLabels));
  for (let i = 0; i < curve.length; i += xStep) {
    const pt = curve[i]!;
    const x = timeToX(pt[timeKey]);
    const label = o.timeAxis === 'ticks'
      ? String(Math.round(pt.tick))
      : pt.seconds.toFixed(1) + 's';
    svg.push(
      `<text x="${x}" y="${o.height - o.marginBottom + 15}" text-anchor="middle" ` +
      `font-size="8" font-family="monospace" fill="#999">${escapeXml(label)}</text>`,
    );
  }

  // Axis labels
  svg.push(
    `<text x="${chartLeft - 4}" y="${chartTop - 4}" text-anchor="end" ` +
    `font-size="10" font-family="monospace" fill="#666">Tension</text>`,
  );

  // Component lines (if enabled)
  if (o.showComponents) {
    const components: Array<{ key: keyof typeof curve[0]['components']; color: string }> = [
      { key: 'roughness', color: o.componentColors[0] },
      { key: 'metric', color: o.componentColors[1] },
      { key: 'registral', color: o.componentColors[2] },
      { key: 'density', color: o.componentColors[3] },
    ];

    for (const comp of components) {
      const points = curve
        .map(pt => `${timeToX(pt[timeKey]).toFixed(1)},${valToY(pt.components[comp.key]).toFixed(1)}`)
        .join(' ');
      svg.push(
        `<polyline points="${points}" fill="none" ` +
        `stroke="${comp.color}" stroke-width="${o.strokeWidth * 0.6}" stroke-opacity="0.5"/>`,
      );
    }

    // Legend
    const legendY = chartTop + 12;
    const legendNames = ['Roughness', 'Metric', 'Registral', 'Density'];
    for (let i = 0; i < components.length; i++) {
      const lx = chartLeft + 5 + i * 90;
      svg.push(
        `<rect x="${lx}" y="${legendY - 6}" width="10" height="3" fill="${components[i]!.color}" opacity="0.5"/>`,
      );
      svg.push(
        `<text x="${lx + 14}" y="${legendY}" font-size="8" font-family="monospace" fill="#666">${escapeXml(legendNames[i]!)}</text>`,
      );
    }
  }

  // Total tension line
  const totalPoints = curve
    .map(pt => `${timeToX(pt[timeKey]).toFixed(1)},${valToY(pt.total).toFixed(1)}`)
    .join(' ');
  svg.push(
    `<polyline points="${totalPoints}" fill="none" ` +
    `stroke="${o.totalColor}" stroke-width="${o.strokeWidth}"/>`,
  );

  // Chart border
  svg.push(
    `<rect x="${chartLeft}" y="${chartTop}" width="${chartWidth}" height="${chartHeight}" ` +
    `fill="none" stroke="#ccc" stroke-width="0.5"/>`,
  );

  svg.push('</svg>');
  return svg.join('\n');
}
