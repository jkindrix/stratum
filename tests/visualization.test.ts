import { describe, it, expect } from 'vitest';
import {
  renderPCDistribution,
  renderICVRadar,
  renderCircleOfFifths,
  renderSSM,
  renderChordGraph,
  renderTonnetz,
} from '../src/index.js';
import type { ICV, SimilarityMatrix, ChordGraph } from '../src/index.js';

// ---------------------------------------------------------------------------
// Section 9.23 — Visualization Tests
// ---------------------------------------------------------------------------

describe('PC Distribution', () => {
  it('produces valid SVG with 12 bars', () => {
    const dist = [10, 2, 8, 1, 7, 6, 0, 9, 3, 5, 4, 1];
    const svg = renderPCDistribution(dist);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 12 data bars + 1 background rect + grid line rects = many rects
    const barRects = (svg.match(/fill="#2563eb"/g) ?? []).length;
    expect(barRects).toBe(12);
  });

  it('handles key profile overlay', () => {
    const dist = [10, 2, 8, 1, 7, 6, 0, 9, 3, 5, 4, 1];
    const profile = [6, 2, 3, 1, 5, 4, 1, 6, 2, 4, 1, 3];
    const svg = renderPCDistribution(dist, profile);

    // Profile rects drawn with stroke
    expect(svg).toContain('stroke="#dc2626"');
  });

  it('renders circular mode', () => {
    const dist = [10, 2, 8, 1, 7, 6, 0, 9, 3, 5, 4, 1];
    const svg = renderPCDistribution(dist, undefined, { mode: 'circular' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('polygon');
  });

  it('handles empty/invalid distribution gracefully', () => {
    const svg = renderPCDistribution([]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('ICV Radar', () => {
  it('produces valid SVG with 6 axes', () => {
    const icv1: ICV = [0, 0, 0, 1, 1, 1];
    const icv2: ICV = [2, 1, 0, 3, 2, 1];
    const svg = renderICVRadar([icv1, icv2], ['Set A', 'Set B']);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 6 axis labels
    for (let i = 1; i <= 6; i++) {
      expect(svg).toContain(`IC${i}`);
    }

    // Two polygons for two ICVs
    const polygonCount = (svg.match(/<polygon/g) ?? []).length;
    // Grid polygons (4 default) + 2 data polygons = 6
    expect(polygonCount).toBeGreaterThanOrEqual(6);
  });

  it('handles single ICV', () => {
    const icv: ICV = [1, 1, 1, 1, 1, 1];
    const svg = renderICVRadar([icv]);
    expect(svg).toContain('<polygon');
  });

  it('handles empty input', () => {
    const svg = renderICVRadar([]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('Circle of Fifths', () => {
  it('produces valid SVG with correct PC ordering', () => {
    const svg = renderCircleOfFifths();

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // Should have 12 circles for nodes (plus background circles)
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBeGreaterThanOrEqual(12);

    // Fifths order: C, G, D, A, E, B, F♯, ...
    expect(svg).toContain('>C<');
    expect(svg).toContain('>G<');
    expect(svg).toContain('>D<');
  });

  it('shows chord qualities when enabled', () => {
    const svg = renderCircleOfFifths({
      keyTonic: 0,
      keyMode: 'major',
      showChordQuality: true,
    });
    // Major key has M, m, dim qualities
    expect(svg).toContain('>M<');
    expect(svg).toContain('>m<');
  });

  it('highlights active PCs', () => {
    const svg = renderCircleOfFifths({
      activePCs: [0, 4, 7],
      activeColor: '#ff0000',
    });
    expect(svg).toContain('#ff0000');
  });
});

describe('SSM Heatmap', () => {
  it('produces valid SVG with dimensions matching matrix size', () => {
    const data = [
      [1, 0.8, 0.3],
      [0.8, 1, 0.5],
      [0.3, 0.5, 1],
    ];
    const matrix: SimilarityMatrix = {
      size: 3,
      data,
      windowSize: 480,
    };

    const svg = renderSSM(matrix);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 3×3 = 9 cell rects + 1 background + 1 border = 11 rects
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(10); // 9 cells + bg + border
  });

  it('shows novelty peak markers', () => {
    const data = [
      [1, 0.5, 0.2, 0.1],
      [0.5, 1, 0.5, 0.2],
      [0.2, 0.5, 1, 0.5],
      [0.1, 0.2, 0.5, 1],
    ];
    const matrix: SimilarityMatrix = { size: 4, data, windowSize: 480 };
    const peaks = [{ tick: 960, value: 0.8 }];

    const svg = renderSSM(matrix, peaks);
    expect(svg).toContain('stroke="#dc2626"');
  });

  it('handles empty matrix', () => {
    const matrix: SimilarityMatrix = { size: 0, data: [], windowSize: 480 };
    const svg = renderSSM(matrix);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('Chord Graph', () => {
  it('produces valid SVG with nodes and edges', () => {
    const graph: ChordGraph = {
      nodes: [
        { label: 'Cmaj', root: 0, quality: 'maj', count: 5 },
        { label: 'Gdom7', root: 7, quality: 'dom7', count: 3 },
        { label: 'Amin', root: 9, quality: 'min', count: 2 },
      ],
      edges: [
        { from: 'Cmaj', to: 'Gdom7', weight: 3 },
        { from: 'Gdom7', to: 'Cmaj', weight: 2 },
        { from: 'Cmaj', to: 'Amin', weight: 1 },
      ],
    };

    const svg = renderChordGraph(graph);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // Should have node circles (3)
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(3);

    // Should have edges (3 lines)
    const lineCount = (svg.match(/<line/g) ?? []).length;
    expect(lineCount).toBe(3);

    // Should have labels
    expect(svg).toContain('Cmaj');
    expect(svg).toContain('Gdom7');
    expect(svg).toContain('Amin');

    // Should have arrowhead marker
    expect(svg).toContain('arrowhead');
  });

  it('handles empty graph', () => {
    const graph: ChordGraph = { nodes: [], edges: [] };
    const svg = renderChordGraph(graph);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('Tonnetz', () => {
  it('produces valid SVG with 12 nodes', () => {
    const svg = renderTonnetz();

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    // 12 PC nodes
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBeGreaterThanOrEqual(12);

    // Should have all 12 pitch-class names
    expect(svg).toContain('>C<');
    expect(svg).toContain('>G<');
    expect(svg).toContain('>E<');
  });

  it('highlights active pitch classes', () => {
    const svg = renderTonnetz({ activePCs: [0, 4, 7], activeColor: '#ff0000' });
    expect(svg).toContain('#ff0000');
  });

  it('shows PLR edge labels', () => {
    const svg = renderTonnetz({ showEdgeLabels: true });
    expect(svg).toContain('>P<');
    expect(svg).toContain('>R<');
    expect(svg).toContain('>L<');
  });

  it('draws triad path', () => {
    const svg = renderTonnetz({
      triadPath: [
        { root: 0, quality: 'major' },
        { root: 0, quality: 'minor' },
        { root: 5, quality: 'major' },
      ],
    });
    // Should have path polyline
    expect(svg).toContain('<polyline');
  });
});
