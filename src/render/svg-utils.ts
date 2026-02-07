// ---------------------------------------------------------------------------
// Stratum — Shared SVG Utilities
// ---------------------------------------------------------------------------

/** Escape text for safe XML embedding. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Open an SVG root element with viewBox. */
export function svgOpen(width: number, height: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">`
  );
}

/** Close an SVG root element. */
export function svgClose(): string {
  return '</svg>';
}

/** Return a valid empty SVG of the given dimensions. */
export function svgEmpty(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
}

/** A color stop for linear interpolation. */
export interface ColorStop {
  readonly t: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 5-stop viridis approximation for heatmaps. */
export const VIRIDIS_STOPS: readonly ColorStop[] = Object.freeze([
  Object.freeze({ t: 0.0, r: 68, g: 1, b: 84 }),
  Object.freeze({ t: 0.25, r: 59, g: 82, b: 139 }),
  Object.freeze({ t: 0.5, r: 33, g: 145, b: 140 }),
  Object.freeze({ t: 0.75, r: 94, g: 201, b: 98 }),
  Object.freeze({ t: 1.0, r: 253, g: 231, b: 37 }),
]);

/**
 * Linearly interpolate between color stops to produce an RGB hex string.
 * @param t — Value in [0, 1].
 * @param stops — Sorted array of color stops.
 */
export function colorRamp(t: number, stops: readonly ColorStop[]): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (stops.length === 0) return '#000000';
  if (stops.length === 1) {
    const s = stops[0]!;
    return rgbHex(s.r, s.g, s.b);
  }

  // Find the two stops to interpolate between
  let lo = stops[0]!;
  let hi = stops[stops.length - 1]!;
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i]!.t && clamped <= stops[i + 1]!.t) {
      lo = stops[i]!;
      hi = stops[i + 1]!;
      break;
    }
  }

  const range = hi.t - lo.t;
  const frac = range === 0 ? 0 : (clamped - lo.t) / range;
  const r = Math.round(lo.r + (hi.r - lo.r) * frac);
  const g = Math.round(lo.g + (hi.g - lo.g) * frac);
  const b = Math.round(lo.b + (hi.b - lo.b) * frac);
  return rgbHex(r, g, b);
}

/** Convert RGB 0-255 to hex string. */
function rgbHex(r: number, g: number, b: number): string {
  const hex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Convert HSL to RGB hex string.
 * @param h — Hue in [0, 360).
 * @param s — Saturation in [0, 1].
 * @param l — Lightness in [0, 1].
 */
export function hslToRgb(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = l - c / 2;
  return rgbHex(
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  );
}

/** Format [x,y] coordinate pairs for SVG polyline points attribute. */
export function polylinePoints(coords: readonly (readonly [number, number])[]): string {
  return coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
