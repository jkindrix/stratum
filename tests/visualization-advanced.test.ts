import { describe, it, expect } from 'vitest';
import {
  renderJILattice,
  renderWavescape,
  renderFormDiagram,
  renderPitchSpacePlot,
  createScore,
  addPart,
  addNote,
  pitchFromMidi,
} from '../src/index.js';
import type { FormSection, NoteEvent } from '../src/index.js';

// ---------------------------------------------------------------------------
// Section 9.32 — Advanced Visualization Tests
// ---------------------------------------------------------------------------

describe('JI Lattice', () => {
  it('produces valid SVG with 25 nodes for 5-limit range ±2', () => {
    const svg = renderJILattice(undefined, { limit: 5, gridRange: 2 });

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 5-limit, range ±2: (2*2+1) × (2*2+1) = 25 nodes
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(25);
  });

  it('renders 7-limit with additional dimension', () => {
    const svg = renderJILattice(undefined, { limit: 7, gridRange: 1 });

    // 7-limit, range ±1: (3 × 3) × 3 = 27 nodes for e7 in {-1,0,1}
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(27);

    // Should show sevenths axis legend
    expect(svg).toContain('Sevenths');
  });

  it('renders custom nodes', () => {
    const nodes = [
      { monzo: [0, 0, 0], label: '1/1' },
      { monzo: [0, 1, 0], label: '3/2' },
      { monzo: [0, 0, 1], label: '5/4' },
    ];
    const svg = renderJILattice(nodes);
    expect(svg).toContain('1/1');
    expect(svg).toContain('3/2');
    expect(svg).toContain('5/4');
  });

  it('shows axis legend', () => {
    const svg = renderJILattice();
    expect(svg).toContain('Fifths');
    expect(svg).toContain('Thirds');
  });
});

describe('Wavescape', () => {
  it('produces valid SVG with hierarchical rects', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    // C major scale across 4 beats
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 62, onset: 480, duration: 480 });
    addNote(score, p, { midi: 64, onset: 960, duration: 480 });
    addNote(score, p, { midi: 65, onset: 1440, duration: 480 });

    const svg = renderWavescape(score);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // Dark background
    expect(svg).toContain('#1a1a2e');

    // Should have many colored rects (hierarchical: 4 + 3 + 2 + 1 = 10 cells + background)
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(10);
  });

  it('handles empty score', () => {
    const score = createScore();
    const svg = renderWavescape(score);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('respects coefficient option', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 0, duration: 480 });

    // Coefficient 3 = triadicity
    const svg = renderWavescape(score, { coefficient: 3 });
    expect(svg).toContain('<svg');
  });
});

describe('Form Diagram', () => {
  it('produces valid SVG with section count matching input', () => {
    const sections: FormSection[] = [
      { startTick: 0, endTick: 1920, label: 'A' },
      { startTick: 1920, endTick: 3840, label: 'B' },
      { startTick: 3840, endTick: 5760, label: 'A' },
    ];

    const svg = renderFormDiagram(sections);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 3 section rects + 1 background
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(4);

    // Section labels
    expect(svg).toContain('>A<');
    expect(svg).toContain('>B<');
  });

  it('renders with novelty curve', () => {
    const sections: FormSection[] = [
      { startTick: 0, endTick: 1920, label: 'A' },
      { startTick: 1920, endTick: 3840, label: 'B' },
    ];
    const novelty = [
      { tick: 0, value: 0.1 },
      { tick: 960, value: 0.5 },
      { tick: 1920, value: 0.9 },
      { tick: 2880, value: 0.3 },
    ];

    const svg = renderFormDiagram(sections, novelty);
    expect(svg).toContain('<polyline');
    expect(svg).toContain('Novelty');
  });

  it('handles empty sections', () => {
    const svg = renderFormDiagram([]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('colors sections by label identity', () => {
    const sections: FormSection[] = [
      { startTick: 0, endTick: 960, label: 'A' },
      { startTick: 960, endTick: 1920, label: 'B' },
      { startTick: 1920, endTick: 2880, label: 'A' },
    ];
    const svg = renderFormDiagram(sections);

    // The two 'A' sections should share same color (first default: #2563eb)
    const matches = svg.match(/fill="#2563eb"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });
});

describe('Pitch-Space Plot', () => {
  const makeEvents = (): NoteEvent[] => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });
    addNote(score, p, { midi: 67, onset: 960, duration: 480 });
    addNote(score, p, { midi: 72, onset: 1440, duration: 480 });
    return score.parts[0]!.events as NoteEvent[];
  };

  it('renders linear geometry', () => {
    const svg = renderPitchSpacePlot(makeEvents(), { geometry: 'linear' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 4 dots + contour polyline
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(4);
    expect(svg).toContain('<polyline');
  });

  it('renders circular geometry', () => {
    const svg = renderPitchSpacePlot(makeEvents(), { geometry: 'circular' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<polyline');
  });

  it('renders spiral geometry', () => {
    const svg = renderPitchSpacePlot(makeEvents(), { geometry: 'spiral' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<polyline');
  });

  it('handles empty events', () => {
    const svg = renderPitchSpacePlot([]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
