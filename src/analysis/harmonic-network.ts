// ---------------------------------------------------------------------------
// Stratum — Harmonic Network Analysis (Chord Transition Graphs)
// ---------------------------------------------------------------------------

import type { ChordLabel } from './harmonic.js';

/** A node in a chord transition graph. */
export interface ChordNode {
  /** Chord label string (e.g. "Cmaj"). */
  readonly label: string;
  /** Root pitch class (0-11). */
  readonly root: number;
  /** Chord quality string (e.g. "maj", "min"). */
  readonly quality: string;
  /** Number of occurrences in the source sequence. */
  readonly count: number;
}

/** A directed edge in a chord transition graph. */
export interface ChordEdge {
  /** Source chord label. */
  readonly from: string;
  /** Target chord label. */
  readonly to: string;
  /** Transition count (weight). */
  readonly weight: number;
}

/** A directed weighted chord transition graph. */
export interface ChordGraph {
  /** Unique chord nodes. */
  readonly nodes: readonly ChordNode[];
  /** Directed edges between chords. */
  readonly edges: readonly ChordEdge[];
}

/** Centrality metrics for a chord graph. */
export interface GraphMetrics {
  /** PageRank scores (node label → score, sums to ~1.0). */
  readonly pageRank: ReadonlyMap<string, number>;
  /** Betweenness centrality scores (node label → score). */
  readonly betweenness: ReadonlyMap<string, number>;
}

/** Community detection result. */
export interface CommunityResult {
  /** Node label → community ID assignment. */
  readonly communities: ReadonlyMap<string, number>;
  /** Number of communities found. */
  readonly count: number;
}

/** Comparison metrics between two chord graphs. */
export interface GraphComparison {
  /** Jaccard similarity of node sets. */
  readonly jaccardNodes: number;
  /** Jaccard similarity of edge sets. */
  readonly jaccardEdges: number;
  /** Cosine similarity of shared edge weights. */
  readonly cosineSimilarity: number;
}

// ---- Internal helpers ----

function chordKey(label: ChordLabel): string {
  return `${label.symbol}`;
}

// ---- Public API ----

/**
 * Build a directed weighted chord transition graph from a sequence of chord labels.
 *
 * Each unique chord becomes a node; each consecutive pair becomes a directed edge
 * whose weight is the transition count.
 *
 * @param chords - Sequence of identified chords.
 * @returns Frozen ChordGraph.
 * @throws {RangeError} If chords is empty.
 */
export function chordTransitionGraph(chords: readonly ChordLabel[]): ChordGraph {
  if (chords.length === 0) {
    throw new RangeError('chords array must not be empty');
  }

  // Count node occurrences
  const nodeCounts = new Map<string, { root: number; quality: string; count: number }>();
  for (const chord of chords) {
    const key = chordKey(chord);
    const existing = nodeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      nodeCounts.set(key, { root: chord.root, quality: chord.symbol, count: 1 });
    }
  }

  // Build nodes
  const nodes: ChordNode[] = [];
  for (const [label, data] of nodeCounts) {
    nodes.push(Object.freeze({ label, root: data.root, quality: data.quality, count: data.count }));
  }

  // Count edge transitions
  const edgeCounts = new Map<string, number>();
  for (let i = 1; i < chords.length; i++) {
    const from = chordKey(chords[i - 1]!);
    const to = chordKey(chords[i]!);
    const edgeKey = `${from}\0${to}`;
    edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
  }

  // Build edges
  const edges: ChordEdge[] = [];
  for (const [edgeKey, weight] of edgeCounts) {
    const sepIdx = edgeKey.indexOf('\0');
    const from = edgeKey.slice(0, sepIdx);
    const to = edgeKey.slice(sepIdx + 1);
    edges.push(Object.freeze({ from, to, weight }));
  }

  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

/**
 * Compute transition probabilities from a chord graph.
 *
 * For each node, normalizes outgoing edge weights to sum to 1.0.
 *
 * @param graph - Chord transition graph.
 * @returns Nested map: from-label → (to-label → probability).
 */
export function transitionProbabilities(
  graph: ChordGraph,
): ReadonlyMap<string, ReadonlyMap<string, number>> {
  // Sum outgoing weights per node
  const outSums = new Map<string, number>();
  for (const edge of graph.edges) {
    outSums.set(edge.from, (outSums.get(edge.from) ?? 0) + edge.weight);
  }

  const result = new Map<string, ReadonlyMap<string, number>>();
  for (const node of graph.nodes) {
    const outgoing = new Map<string, number>();
    const sum = outSums.get(node.label) ?? 0;

    if (sum > 0) {
      for (const edge of graph.edges) {
        if (edge.from === node.label) {
          outgoing.set(edge.to, edge.weight / sum);
        }
      }
    }

    result.set(node.label, outgoing);
  }

  return result;
}

/**
 * Compute centrality metrics for a chord graph.
 *
 * Calculates PageRank (iterative power method, damping = 0.85, 100 iterations)
 * and betweenness centrality (BFS-based shortest paths).
 *
 * @param graph - Chord transition graph.
 * @param options - Optional: damping (default 0.85), iterations (default 100).
 * @returns Frozen GraphMetrics.
 */
export function graphCentrality(
  graph: ChordGraph,
  options?: { damping?: number; iterations?: number },
): GraphMetrics {
  const damping = options?.damping ?? 0.85;
  const iterations = options?.iterations ?? 100;
  const n = graph.nodes.length;

  if (n === 0) {
    return Object.freeze({
      pageRank: new Map<string, number>(),
      betweenness: new Map<string, number>(),
    });
  }

  const labels = graph.nodes.map(node => node.label);
  const labelIdx = new Map<string, number>();
  for (let i = 0; i < labels.length; i++) {
    labelIdx.set(labels[i]!, i);
  }

  // ---- PageRank ----
  // Build adjacency: outgoing edges per node
  const outEdges: Map<number, { to: number; weight: number }[]> = new Map();
  const outWeightSum: number[] = new Array(n).fill(0);

  for (const edge of graph.edges) {
    const fromIdx = labelIdx.get(edge.from);
    const toIdx = labelIdx.get(edge.to);
    if (fromIdx !== undefined && toIdx !== undefined) {
      let list = outEdges.get(fromIdx);
      if (!list) {
        list = [];
        outEdges.set(fromIdx, list);
      }
      list.push({ to: toIdx, weight: edge.weight });
      outWeightSum[fromIdx] = (outWeightSum[fromIdx] ?? 0) + edge.weight;
    }
  }

  let ranks = new Array<number>(n).fill(1 / n);

  for (let iter = 0; iter < iterations; iter++) {
    const newRanks = new Array<number>(n).fill((1 - damping) / n);

    for (let i = 0; i < n; i++) {
      const edges = outEdges.get(i);
      if (edges && (outWeightSum[i] ?? 0) > 0) {
        for (const edge of edges) {
          newRanks[edge.to] = (newRanks[edge.to] ?? 0) +
            damping * (ranks[i] ?? 0) * edge.weight / (outWeightSum[i] ?? 1);
        }
      } else {
        // Dangling node: distribute evenly
        for (let j = 0; j < n; j++) {
          newRanks[j] = (newRanks[j] ?? 0) + damping * (ranks[i] ?? 0) / n;
        }
      }
    }

    ranks = newRanks;
  }

  const pageRank = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    pageRank.set(labels[i]!, ranks[i] ?? 0);
  }

  // ---- Betweenness Centrality ----
  // Build adjacency list (unweighted for shortest paths)
  const adj: number[][] = [];
  for (let i = 0; i < n; i++) {
    adj.push([]);
  }
  for (const edge of graph.edges) {
    const fromIdx = labelIdx.get(edge.from);
    const toIdx = labelIdx.get(edge.to);
    if (fromIdx !== undefined && toIdx !== undefined) {
      adj[fromIdx]!.push(toIdx);
    }
  }

  const betweennessArr = new Array<number>(n).fill(0);

  for (let s = 0; s < n; s++) {
    // BFS from s
    const dist = new Array<number>(n).fill(-1);
    const sigma = new Array<number>(n).fill(0); // number of shortest paths
    const pred: number[][] = [];
    for (let i = 0; i < n; i++) pred.push([]);

    dist[s] = 0;
    sigma[s] = 1;
    const queue: number[] = [s];
    const stack: number[] = [];
    let head = 0;

    while (head < queue.length) {
      const v = queue[head]!;
      head++;
      stack.push(v);

      for (const w of adj[v]!) {
        if ((dist[w] ?? -1) === -1) {
          dist[w] = (dist[v] ?? 0) + 1;
          queue.push(w);
        }
        if ((dist[w] ?? -1) === (dist[v] ?? 0) + 1) {
          sigma[w] = (sigma[w] ?? 0) + (sigma[v] ?? 0);
          pred[w]!.push(v);
        }
      }
    }

    // Back-propagation
    const delta = new Array<number>(n).fill(0);
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred[w]!) {
        const contribution = ((sigma[v] ?? 0) / (sigma[w] ?? 1)) * (1 + (delta[w] ?? 0));
        delta[v] = (delta[v] ?? 0) + contribution;
      }
      if (w !== s) {
        betweennessArr[w] = (betweennessArr[w] ?? 0) + (delta[w] ?? 0);
      }
    }
  }

  const betweenness = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    betweenness.set(labels[i]!, betweennessArr[i] ?? 0);
  }

  return Object.freeze({ pageRank, betweenness });
}

/**
 * Detect communities in a chord graph using label propagation.
 *
 * Each node starts with a unique label. Iteratively, each node adopts
 * the most frequent label among its neighbors (weighted by edge weight).
 * Converges when no labels change.
 *
 * @param graph - Chord transition graph.
 * @returns Frozen CommunityResult.
 */
export function detectCommunities(graph: ChordGraph): CommunityResult {
  const n = graph.nodes.length;
  if (n === 0) {
    return Object.freeze({ communities: new Map<string, number>(), count: 0 });
  }

  const labels = graph.nodes.map(node => node.label);
  const labelIdx = new Map<string, number>();
  for (let i = 0; i < labels.length; i++) {
    labelIdx.set(labels[i]!, i);
  }

  // Community labels (initially node index)
  const community = new Array<number>(n);
  for (let i = 0; i < n; i++) community[i] = i;

  // Build weighted adjacency (bidirectional for community detection)
  const neighbors: Map<number, { neighbor: number; weight: number }[]> = new Map();
  for (const edge of graph.edges) {
    const fromIdx = labelIdx.get(edge.from);
    const toIdx = labelIdx.get(edge.to);
    if (fromIdx !== undefined && toIdx !== undefined) {
      let fromList = neighbors.get(fromIdx);
      if (!fromList) {
        fromList = [];
        neighbors.set(fromIdx, fromList);
      }
      fromList.push({ neighbor: toIdx, weight: edge.weight });

      let toList = neighbors.get(toIdx);
      if (!toList) {
        toList = [];
        neighbors.set(toIdx, toList);
      }
      toList.push({ neighbor: fromIdx, weight: edge.weight });
    }
  }

  // Iterate until stable (max 100 iterations)
  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      const neighList = neighbors.get(i);
      if (!neighList || neighList.length === 0) continue;

      // Count weighted votes per community label
      const votes = new Map<number, number>();
      for (const { neighbor, weight } of neighList) {
        const lbl = community[neighbor] ?? 0;
        votes.set(lbl, (votes.get(lbl) ?? 0) + weight);
      }

      // Find max vote
      let maxVote = -1;
      let bestLabel = community[i] ?? 0;
      for (const [lbl, vote] of votes) {
        if (vote > maxVote) {
          maxVote = vote;
          bestLabel = lbl;
        }
      }

      if (bestLabel !== (community[i] ?? 0)) {
        community[i] = bestLabel;
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Normalize community IDs to sequential 0, 1, 2, ...
  const idMap = new Map<number, number>();
  let nextId = 0;
  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const rawId = community[i] ?? 0;
    if (!idMap.has(rawId)) {
      idMap.set(rawId, nextId++);
    }
    result.set(labels[i]!, idMap.get(rawId)!);
  }

  return Object.freeze({ communities: result, count: nextId });
}

/**
 * Find cycles in a chord transition graph using DFS.
 *
 * Returns unique cycles normalized so the lexicographically smallest label
 * appears first. Self-loops are excluded.
 *
 * @param graph - Chord transition graph.
 * @param maxLength - Maximum cycle length (default 6).
 * @returns Frozen array of frozen cycle arrays.
 */
export function findCycles(
  graph: ChordGraph,
  maxLength: number = 6,
): readonly (readonly string[])[] {
  if (maxLength < 2) return Object.freeze([]);

  const labels = graph.nodes.map(node => node.label);
  const labelIdx = new Map<string, number>();
  for (let i = 0; i < labels.length; i++) {
    labelIdx.set(labels[i]!, i);
  }

  const n = labels.length;
  // Build adjacency list
  const adj: number[][] = [];
  for (let i = 0; i < n; i++) adj.push([]);
  for (const edge of graph.edges) {
    const fromIdx = labelIdx.get(edge.from);
    const toIdx = labelIdx.get(edge.to);
    if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
      adj[fromIdx]!.push(toIdx);
    }
  }

  const cycleSet = new Set<string>();
  const cycles: (readonly string[])[] = [];

  // DFS from each node
  for (let start = 0; start < n; start++) {
    const path: number[] = [start];
    const visited = new Set<number>([start]);

    function dfs(): void {
      const current = path[path.length - 1]!;

      for (const next of adj[current]!) {
        if (next === start && path.length >= 2) {
          // Found a cycle — normalize
          const cycleLabels = path.map(idx => labels[idx]!);
          const normalized = normalizeCycle(cycleLabels);
          const key = normalized.join('\0');
          if (!cycleSet.has(key)) {
            cycleSet.add(key);
            cycles.push(Object.freeze(normalized));
          }
        } else if (!visited.has(next) && path.length < maxLength) {
          visited.add(next);
          path.push(next);
          dfs();
          path.pop();
          visited.delete(next);
        }
      }
    }

    dfs();
  }

  return Object.freeze(cycles);
}

/** Normalize a cycle so the lexicographically smallest label appears first. */
function normalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) return cycle;

  // Find the index of the lexicographically smallest element
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if ((cycle[i] ?? '') < (cycle[minIdx] ?? '')) {
      minIdx = i;
    }
  }

  // Rotate to start at minIdx
  const result: string[] = [];
  for (let i = 0; i < cycle.length; i++) {
    result.push(cycle[(i + minIdx) % cycle.length]!);
  }

  return result;
}

/**
 * Compare two chord graphs by node/edge overlap and weight similarity.
 *
 * @param a - First chord graph.
 * @param b - Second chord graph.
 * @returns Frozen GraphComparison with Jaccard and cosine metrics.
 */
export function compareGraphs(a: ChordGraph, b: ChordGraph): GraphComparison {
  // Jaccard for nodes
  const nodesA = new Set(a.nodes.map(n => n.label));
  const nodesB = new Set(b.nodes.map(n => n.label));
  const nodeIntersection = new Set([...nodesA].filter(x => nodesB.has(x)));
  const nodeUnion = new Set([...nodesA, ...nodesB]);
  const jaccardNodes = nodeUnion.size === 0 ? 0 : nodeIntersection.size / nodeUnion.size;

  // Jaccard for edges (by from→to key)
  const edgeKey = (e: ChordEdge) => `${e.from}\0${e.to}`;
  const edgesA = new Set(a.edges.map(edgeKey));
  const edgesB = new Set(b.edges.map(edgeKey));
  const edgeIntersection = new Set([...edgesA].filter(x => edgesB.has(x)));
  const edgeUnion = new Set([...edgesA, ...edgesB]);
  const jaccardEdges = edgeUnion.size === 0 ? 0 : edgeIntersection.size / edgeUnion.size;

  // Cosine similarity of shared edge weights
  const weightsA = new Map<string, number>();
  for (const e of a.edges) weightsA.set(edgeKey(e), e.weight);
  const weightsB = new Map<string, number>();
  for (const e of b.edges) weightsB.set(edgeKey(e), e.weight);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const key of edgeUnion) {
    const wA = weightsA.get(key) ?? 0;
    const wB = weightsB.get(key) ?? 0;
    dot += wA * wB;
    magA += wA * wA;
    magB += wB * wB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  const cosineSimilarity = denom === 0 ? 0 : dot / denom;

  return Object.freeze({ jaccardNodes, jaccardEdges, cosineSimilarity });
}
