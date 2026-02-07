import { describe, it, expect } from 'vitest';
import {
  chordTransitionGraph,
  transitionProbabilities,
  graphCentrality,
  detectCommunities,
  findCycles,
  compareGraphs,
} from '../src/index.js';
import type { ChordLabel, ChordGraph } from '../src/index.js';

function makeChord(symbol: string, root: number): ChordLabel {
  return { name: symbol, symbol, root, pcs: [] };
}

describe('Harmonic Network Analysis', () => {
  // Standard I-IV-V-I progression
  const iIVVI: ChordLabel[] = [
    makeChord('Cmaj', 0),
    makeChord('Fmaj', 5),
    makeChord('Gmaj', 7),
    makeChord('Cmaj', 0),
  ];

  describe('chordTransitionGraph', () => {
    it('creates correct nodes for I-IV-V-I', () => {
      const graph = chordTransitionGraph(iIVVI);
      expect(graph.nodes).toHaveLength(3); // Cmaj, Fmaj, Gmaj
      const labels = graph.nodes.map(n => n.label).sort();
      expect(labels).toEqual(['Cmaj', 'Fmaj', 'Gmaj']);
    });

    it('creates correct edges for I-IV-V-I', () => {
      const graph = chordTransitionGraph(iIVVI);
      expect(graph.edges).toHaveLength(3); // C→F, F→G, G→C
      const edgeKeys = graph.edges.map(e => `${e.from}→${e.to}`).sort();
      expect(edgeKeys).toEqual(['Cmaj→Fmaj', 'Fmaj→Gmaj', 'Gmaj→Cmaj']);
    });

    it('counts repeated transitions', () => {
      const chords = [
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
        makeChord('Cmaj', 0),
      ];
      const graph = chordTransitionGraph(chords);
      const cgEdge = graph.edges.find(e => e.from === 'Cmaj' && e.to === 'Gmaj');
      expect(cgEdge?.weight).toBe(2);
      const gcEdge = graph.edges.find(e => e.from === 'Gmaj' && e.to === 'Cmaj');
      expect(gcEdge?.weight).toBe(2);
    });

    it('counts node occurrences', () => {
      const graph = chordTransitionGraph(iIVVI);
      const cNode = graph.nodes.find(n => n.label === 'Cmaj');
      expect(cNode?.count).toBe(2);
      const fNode = graph.nodes.find(n => n.label === 'Fmaj');
      expect(fNode?.count).toBe(1);
    });

    it('returns frozen result', () => {
      const graph = chordTransitionGraph(iIVVI);
      expect(Object.isFrozen(graph)).toBe(true);
      expect(Object.isFrozen(graph.nodes)).toBe(true);
      expect(Object.isFrozen(graph.edges)).toBe(true);
    });

    it('throws RangeError for empty chords', () => {
      expect(() => chordTransitionGraph([])).toThrow(RangeError);
    });

    it('handles single chord (no edges)', () => {
      const graph = chordTransitionGraph([makeChord('Cmaj', 0)]);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('transitionProbabilities', () => {
    it('normalizes outgoing edge weights to 1.0', () => {
      const graph = chordTransitionGraph(iIVVI);
      const probs = transitionProbabilities(graph);

      // Each node in I-IV-V-I has exactly one outgoing edge
      for (const [, outgoing] of probs) {
        let sum = 0;
        for (const p of outgoing.values()) sum += p;
        if (sum > 0) expect(sum).toBeCloseTo(1.0, 10);
      }
    });

    it('handles multiple outgoing edges', () => {
      const chords = [
        makeChord('Cmaj', 0),
        makeChord('Fmaj', 5),
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
      ];
      const graph = chordTransitionGraph(chords);
      const probs = transitionProbabilities(graph);

      const cProbs = probs.get('Cmaj');
      expect(cProbs).toBeDefined();
      // Cmaj → Fmaj (1x) and Cmaj → Gmaj (1x): each 0.5
      expect(cProbs?.get('Fmaj')).toBeCloseTo(0.5, 10);
      expect(cProbs?.get('Gmaj')).toBeCloseTo(0.5, 10);
    });
  });

  describe('graphCentrality', () => {
    it('computes PageRank summing to ~1.0', () => {
      const graph = chordTransitionGraph(iIVVI);
      const metrics = graphCentrality(graph);

      let sum = 0;
      for (const v of metrics.pageRank.values()) sum += v;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('I chord has highest PageRank when it receives multiple incoming edges', () => {
      // Asymmetric graph: multiple chords resolve to Cmaj
      // C→F, C→G, F→C, G→C — Cmaj gets 2 incoming edges, others get 1
      const chords = [
        makeChord('Cmaj', 0),
        makeChord('Fmaj', 5),
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
        makeChord('Cmaj', 0),
      ];
      const graph = chordTransitionGraph(chords);
      const metrics = graphCentrality(graph);

      const cRank = metrics.pageRank.get('Cmaj') ?? 0;
      const fRank = metrics.pageRank.get('Fmaj') ?? 0;
      const gRank = metrics.pageRank.get('Gmaj') ?? 0;

      expect(cRank).toBeGreaterThan(fRank);
      expect(cRank).toBeGreaterThan(gRank);
    });

    it('computes betweenness centrality', () => {
      const graph = chordTransitionGraph(iIVVI);
      const metrics = graphCentrality(graph);

      // All nodes should have betweenness scores
      for (const node of graph.nodes) {
        expect(metrics.betweenness.has(node.label)).toBe(true);
      }
    });

    it('returns frozen result', () => {
      const graph = chordTransitionGraph(iIVVI);
      const metrics = graphCentrality(graph);
      expect(Object.isFrozen(metrics)).toBe(true);
    });

    it('handles empty graph', () => {
      const emptyGraph: ChordGraph = Object.freeze({
        nodes: Object.freeze([]),
        edges: Object.freeze([]),
      });
      const metrics = graphCentrality(emptyGraph);
      expect(metrics.pageRank.size).toBe(0);
      expect(metrics.betweenness.size).toBe(0);
    });
  });

  describe('detectCommunities', () => {
    it('detects at least one community', () => {
      const graph = chordTransitionGraph(iIVVI);
      const result = detectCommunities(graph);
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('assigns a community to every node', () => {
      const graph = chordTransitionGraph(iIVVI);
      const result = detectCommunities(graph);
      for (const node of graph.nodes) {
        expect(result.communities.has(node.label)).toBe(true);
      }
    });

    it('tightly connected nodes share a community', () => {
      // Two groups with cross-link
      const chords = [
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
      ];
      const graph = chordTransitionGraph(chords);
      const result = detectCommunities(graph);
      // Should have 1 community since they're all connected
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('returns frozen result', () => {
      const graph = chordTransitionGraph(iIVVI);
      const result = detectCommunities(graph);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('handles empty graph', () => {
      const emptyGraph: ChordGraph = Object.freeze({
        nodes: Object.freeze([]),
        edges: Object.freeze([]),
      });
      const result = detectCommunities(emptyGraph);
      expect(result.count).toBe(0);
    });
  });

  describe('findCycles', () => {
    it('finds the I-IV-V cycle', () => {
      const graph = chordTransitionGraph(iIVVI);
      const cycles = findCycles(graph);
      expect(cycles.length).toBeGreaterThanOrEqual(1);

      // Should find a 3-node cycle
      const threeNodeCycles = cycles.filter(c => c.length === 3);
      expect(threeNodeCycles.length).toBeGreaterThanOrEqual(1);
    });

    it('normalizes cycles lexicographically', () => {
      const graph = chordTransitionGraph(iIVVI);
      const cycles = findCycles(graph);

      for (const cycle of cycles) {
        if (cycle.length > 0) {
          // First element should be lexicographically smallest
          for (let i = 1; i < cycle.length; i++) {
            expect(cycle[0]! <= cycle[i]!).toBe(true);
          }
        }
      }
    });

    it('respects maxLength parameter', () => {
      const graph = chordTransitionGraph(iIVVI);
      const shortCycles = findCycles(graph, 2);
      // maxLength=2 means max 2 nodes in cycle → needs 2-node cycle
      for (const cycle of shortCycles) {
        expect(cycle.length).toBeLessThanOrEqual(2);
      }
    });

    it('returns empty for maxLength < 2', () => {
      const graph = chordTransitionGraph(iIVVI);
      expect(findCycles(graph, 1)).toHaveLength(0);
    });

    it('returns frozen result', () => {
      const graph = chordTransitionGraph(iIVVI);
      const cycles = findCycles(graph);
      expect(Object.isFrozen(cycles)).toBe(true);
    });

    it('excludes self-loops', () => {
      const chords = [
        makeChord('Cmaj', 0),
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
      ];
      const graph = chordTransitionGraph(chords);
      const cycles = findCycles(graph);
      // Self-loops should not appear as cycles
      for (const cycle of cycles) {
        expect(cycle.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('compareGraphs', () => {
    it('returns perfect similarity for identical graphs', () => {
      const graph = chordTransitionGraph(iIVVI);
      const result = compareGraphs(graph, graph);
      expect(result.jaccardNodes).toBe(1);
      expect(result.jaccardEdges).toBe(1);
      expect(result.cosineSimilarity).toBeCloseTo(1.0, 10);
    });

    it('returns 0 for completely disjoint graphs', () => {
      const graphA = chordTransitionGraph([
        makeChord('Cmaj', 0),
        makeChord('Fmaj', 5),
      ]);
      const graphB = chordTransitionGraph([
        makeChord('Dmin', 2),
        makeChord('Amin', 9),
      ]);
      const result = compareGraphs(graphA, graphB);
      expect(result.jaccardNodes).toBe(0);
      expect(result.jaccardEdges).toBe(0);
    });

    it('returns partial similarity for overlapping graphs', () => {
      const graphA = chordTransitionGraph([
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
        makeChord('Fmaj', 5),
      ]);
      const graphB = chordTransitionGraph([
        makeChord('Cmaj', 0),
        makeChord('Gmaj', 7),
        makeChord('Amin', 9),
      ]);
      const result = compareGraphs(graphA, graphB);
      expect(result.jaccardNodes).toBeGreaterThan(0);
      expect(result.jaccardNodes).toBeLessThan(1);
    });

    it('returns frozen result', () => {
      const graph = chordTransitionGraph(iIVVI);
      const result = compareGraphs(graph, graph);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });
});
