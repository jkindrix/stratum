import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  computeTension,
  renderChromaticStaff,
  renderTensionCurve,
  renderOverlay,
} from '../src/index.js';

describe('Chromatic Staff Renderer', () => {
  it('produces valid SVG for a simple score', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });
    addNote(score, p, { midi: 67, onset: 960, duration: 480 });

    const svg = renderChromaticStaff(score);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains note rectangles', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480, velocity: 100 });

    const svg = renderChromaticStaff(score);

    // Should contain at least one rect with the default voice color
    expect(svg).toContain('fill="#2563eb"');
    // Should have note blocks (rect elements beyond background)
    const rectCount = (svg.match(/<rect/g) || []).length;
    expect(rectCount).toBeGreaterThan(1); // background + at least one note
  });

  it('shows measure lines', () => {
    const score = createScore({ timeSignature: { numerator: 4, denominator: 4 } });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 1920 }); // whole note

    const svg = renderChromaticStaff(score, { showMeasures: true });

    // Should have measure number text
    expect(svg).toContain('>1<');
  });

  it('shows pitch labels', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });

    const svg = renderChromaticStaff(score, { showLabels: true });

    // Should contain pitch labels like C4, E4, etc.
    expect(svg).toContain('C4');
  });

  it('handles empty score', () => {
    const score = createScore();
    const svg = renderChromaticStaff(score);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('uses different colors for multiple parts', () => {
    const score = createScore();
    const p1 = addPart(score, { name: 'Soprano' });
    const p2 = addPart(score, { name: 'Bass' });

    addNote(score, p1, { midi: 72, onset: 0, duration: 480 });
    addNote(score, p2, { midi: 48, onset: 0, duration: 480 });

    const svg = renderChromaticStaff(score);

    // Default colors: blue and red
    expect(svg).toContain('#2563eb');
    expect(svg).toContain('#dc2626');
  });

  it('respects custom options', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });

    const svg = renderChromaticStaff(score, {
      voiceColors: ['#ff0000'],
      showMeasures: false,
      showLabels: false,
    });

    expect(svg).toContain('#ff0000');
  });

  it('has octave boundary lines (C lines) with heavier weight', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });

    const svg = renderChromaticStaff(score);

    // C lines should have stroke-width="2"
    expect(svg).toContain('stroke-width="2"');
    // Natural notes should have dashed lines
    expect(svg).toContain('stroke-dasharray="4,4"');
  });

  it('skips notes outside pitch range', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 }); // in range
    addNote(score, p, { midi: 20, onset: 0, duration: 480 }); // below default lowNote (48)

    const svg = renderChromaticStaff(score);
    // Only one note rect (plus background rect) — the out-of-range note is skipped
    const noteRects = (svg.match(/fill="#2563eb"/g) || []).length;
    expect(noteRects).toBe(1);
  });

  it('no XSS via malicious part names', () => {
    const score = createScore();
    // Note: part name doesn't appear in SVG directly in current impl,
    // but pitch labels use escapeXml to prevent injection
    const p = addPart(score, { name: '<script>alert("xss")</script>' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    const svg = renderChromaticStaff(score);
    expect(svg).not.toContain('<script>');
  });
});

describe('Tension Curve SVG', () => {
  it('renders valid SVG for a tension curve', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 0, duration: 960 });

    const curve = computeTension(score);
    const svg = renderTensionCurve(curve);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('polyline'); // tension line
  });

  it('shows components when enabled', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 0, duration: 960 });

    const curve = computeTension(score);
    const svg = renderTensionCurve(curve, { showComponents: true });

    // Should have multiple polylines (total + 4 components)
    const polylineCount = (svg.match(/<polyline/g) || []).length;
    expect(polylineCount).toBeGreaterThanOrEqual(5);
    // Should have legend text
    expect(svg).toContain('Roughness');
  });

  it('handles empty curve', () => {
    const svg = renderTensionCurve([]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('Overlay (Staff + Tension)', () => {
  it('produces a single SVG with both staff notes and tension polyline', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });

    const curve = computeTension(score);
    const svg = renderOverlay(score, curve);

    // Valid single SVG
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    const svgTagCount = (svg.match(/<svg/g) ?? []).length;
    expect(svgTagCount).toBe(1);

    // Contains staff content (note rectangles) and tension content (polyline)
    expect(svg).toContain('fill="#2563eb"');  // note rect
    expect(svg).toContain('<polyline');        // tension line
    expect(svg).toContain('Tension');          // Y-axis label
  });

  it('aligns staff and tension panel time axes', () => {
    const ppt = 0.15;
    const marginLeft = 44;
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });

    const curve = computeTension(score);
    const svg = renderOverlay(score, curve, {
      staff: { pixelsPerTick: ppt, marginLeft },
    });

    // Note at tick 0: x = marginLeft + 0 * ppt = 44.0
    expect(svg).toContain('x="44.0"');

    // Tension polyline first point should also start at x ≈ 44
    // (first sample is at tick 0)
    const polylines = [...svg.matchAll(/polyline points="([^"]+)"/g)];
    expect(polylines.length).toBeGreaterThanOrEqual(1);
    const lastPolyline = polylines[polylines.length - 1]!;
    const firstPoint = lastPolyline[1].split(' ')[0];
    const firstX = parseFloat(firstPoint.split(',')[0]);
    expect(firstX).toBeCloseTo(marginLeft, 0);

    // Note at tick 480: x = 44 + 480 * 0.15 = 116.0
    const expectedX480 = marginLeft + 480 * ppt;
    expect(svg).toContain(`x="${expectedX480.toFixed(1)}"`);

    // Tension polyline should have a point at that same X for tick 480
    const allPoints = lastPolyline[1].split(' ');
    if (allPoints.length >= 2) {
      const secondX = parseFloat(allPoints[1].split(',')[0]);
      expect(secondX).toBeCloseTo(expectedX480, 0);
    }
  });

  it('handles empty score or empty curve gracefully', () => {
    const score = createScore();
    const svg1 = renderOverlay(score, []);
    expect(svg1).toContain('<svg');
    expect(svg1).toContain('</svg>');

    const score2 = createScore();
    const p = addPart(score2, { name: 'Piano' });
    addNote(score2, p, { midi: 60, onset: 0, duration: 480 });
    const svg2 = renderOverlay(score2, []);
    expect(svg2).toContain('<svg');
    expect(svg2).toContain('</svg>');
  });
});
