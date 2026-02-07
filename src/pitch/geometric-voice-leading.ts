// ---------------------------------------------------------------------------
// Stratum — Geometric Voice Leading (Tymoczko / OPTIC)
// ---------------------------------------------------------------------------

import { normalizePc } from './pitch-class.js';
import { pcDistance } from './voice-leading.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Distance metric for geometric voice-leading space. */
export type VoiceLeadingMetric = 'L1' | 'L2' | 'Linf';

/** Result of OPTIC equivalence reduction. */
export interface OPTICResult {
  /** Representative pitch-class set after equivalence reduction. */
  readonly representative: readonly number[];
  /** Names of equivalences that were applied. */
  readonly applied: readonly string[];
}

// ---------------------------------------------------------------------------
// Hungarian Algorithm (Kuhn-Munkres) — O(n³)
// ---------------------------------------------------------------------------

/**
 * Solve the assignment problem on an n×n cost matrix.
 * Returns the column assigned to each row.
 * @internal
 */
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];

  // u[i] = potential for worker i, v[j] = potential for job j
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  // p[j] = worker assigned to job j (1-indexed workers)
  const p = new Array<number>(n + 1).fill(0);
  // way[j] = previous job in augmenting path
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    // Start augmenting path from worker i
    p[0] = i;
    let j0 = 0; // virtual "start" job
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = -1;

      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = (cost[i0 - 1]?.[j - 1] ?? 0) - (u[i0] ?? 0) - (v[j] ?? 0);
        if (cur < (minv[j] ?? Infinity)) {
          minv[j] = cur;
          way[j] = j0;
        }
        if ((minv[j] ?? Infinity) < delta) {
          delta = minv[j] ?? Infinity;
          j1 = j;
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!] = (u[p[j]!] ?? 0) + delta;
          v[j] = (v[j] ?? 0) - delta;
        } else {
          minv[j] = (minv[j] ?? 0) - delta;
        }
      }

      j0 = j1;
    } while ((p[j0] ?? 0) !== 0);

    // Trace back augmenting path
    do {
      const j1 = way[j0] ?? 0;
      p[j0] = p[j1] ?? 0;
      j0 = j1;
    } while (j0 !== 0);
  }

  // Build result: assignment[row] = col (0-indexed)
  const assignment = new Array<number>(n).fill(0);
  for (let j = 1; j <= n; j++) {
    if ((p[j] ?? 0) > 0) {
      assignment[(p[j] ?? 1) - 1] = j - 1;
    }
  }

  return assignment;
}

/**
 * Build a signed displacement for a single voice with tritone = +6.
 * @internal
 */
function signedDisplacement(from: number, to: number): number {
  const diff = ((to - from) % 12 + 12) % 12;
  if (diff <= 6) return diff;
  return diff - 12;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the optimal voice-leading vector between two pitch-class sets
 * using the Hungarian algorithm.
 *
 * @param from - Source pitch classes.
 * @param to - Target pitch classes.
 * @returns Frozen array of signed displacements (one per voice). Tritone = +6.
 * @throws {RangeError} If sets have different sizes or are empty.
 *
 * @example
 * ```ts
 * voiceLeadingVector([0, 4, 7], [0, 3, 7]); // [0, -1, 0] (C maj → C min)
 * ```
 */
export function voiceLeadingVector(
  from: readonly number[],
  to: readonly number[],
): readonly number[] {
  if (from.length !== to.length) {
    throw new RangeError(
      `Sets must have equal size (got ${from.length} and ${to.length})`,
    );
  }
  if (from.length === 0) {
    throw new RangeError('Sets must not be empty');
  }

  const n = from.length;
  const src = from.map(normalizePc);
  const dst = to.map(normalizePc);

  // Build cost matrix using pcDistance
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(pcDistance(src[i]!, dst[j]!));
    }
    cost.push(row);
  }

  const assignment = hungarian(cost);

  const vector: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = assignment[i]!;
    vector.push(signedDisplacement(src[i]!, dst[j]!));
  }

  return Object.freeze(vector);
}

/**
 * Compute geometric distance between two pitch-class sets.
 *
 * @param from - Source pitch classes.
 * @param to - Target pitch classes.
 * @param metric - Distance metric: 'L1' (taxicab), 'L2' (Euclidean), 'Linf' (Chebyshev). Default 'L1'.
 * @returns Distance value.
 * @throws {RangeError} If sets have different sizes or are empty.
 */
export function geometricDistance(
  from: readonly number[],
  to: readonly number[],
  metric: VoiceLeadingMetric = 'L1',
): number {
  const vec = voiceLeadingVector(from, to);

  switch (metric) {
    case 'L1':
      return vec.reduce((sum, d) => sum + Math.abs(d), 0);
    case 'L2':
      return Math.sqrt(vec.reduce((sum, d) => sum + d * d, 0));
    case 'Linf':
      return vec.reduce((max, d) => Math.max(max, Math.abs(d)), 0);
  }
}

/**
 * Reduce a pitch-class set under OPTIC equivalences.
 *
 * - **O** (Octave): reduce mod 12
 * - **P** (Permutation): sort ascending
 * - **T** (Transposition): transpose so minimum = 0
 * - **I** (Inversion): choose lexicographically smaller of set vs. inverted set
 * - **C** (Cardinality): remove duplicates
 *
 * @param pcs - Input pitch classes.
 * @param equiv - String of equivalences to apply (default 'OPTIC'). Any subset in any order.
 * @returns Frozen OPTICResult with representative and list of applied equivalences.
 *
 * @example
 * ```ts
 * opticEquivalence([7, 0, 4], 'OPT'); // { representative: [0, 4, 7], applied: ['O', 'P', 'T'] }
 * ```
 */
export function opticEquivalence(
  pcs: readonly number[],
  equiv = 'OPTIC',
): OPTICResult {
  let set = [...pcs];
  const applied: string[] = [];
  const flags = equiv.toUpperCase();

  // O: Octave equivalence
  if (flags.includes('O')) {
    set = set.map(normalizePc);
    applied.push('O');
  }

  // C: Cardinality equivalence (dedup) — apply before sort for cleanliness
  if (flags.includes('C')) {
    set = [...new Set(set)];
    applied.push('C');
  }

  // P: Permutation equivalence (sort)
  if (flags.includes('P')) {
    set.sort((a, b) => a - b);
    applied.push('P');
  }

  // T: Transposition equivalence (min → 0)
  if (flags.includes('T')) {
    const min = Math.min(...set);
    set = set.map(pc => ((pc - min) % 12 + 12) % 12);
    applied.push('T');
  }

  // I: Inversion equivalence (prefer lexicographically smaller)
  if (flags.includes('I')) {
    const inverted = set.map(pc => ((12 - pc) % 12 + 12) % 12).sort((a, b) => a - b);
    // Transpose inverted so min = 0
    const invMin = Math.min(...inverted);
    const invertedT = inverted.map(pc => ((pc - invMin) % 12 + 12) % 12);

    // Compare lexicographically
    let useInverted = false;
    for (let i = 0; i < set.length; i++) {
      if ((invertedT[i] ?? 0) < (set[i] ?? 0)) { useInverted = true; break; }
      if ((invertedT[i] ?? 0) > (set[i] ?? 0)) break;
    }
    if (useInverted) {
      set = invertedT;
    }
    applied.push('I');
  }

  return Object.freeze({
    representative: Object.freeze(set),
    applied: Object.freeze(applied),
  });
}

/**
 * Parsimony score: total semitone displacement (L1 distance).
 *
 * @param from - Source pitch classes.
 * @param to - Target pitch classes.
 * @returns Total semitone displacement.
 */
export function parsimonyScore(
  from: readonly number[],
  to: readonly number[],
): number {
  return geometricDistance(from, to, 'L1');
}

/**
 * Count common tones between two pitch-class sets.
 *
 * @param from - First set.
 * @param to - Second set.
 * @returns Number of shared pitch classes.
 */
export function commonToneCount(
  from: readonly number[],
  to: readonly number[],
): number {
  const a = new Set(from.map(normalizePc));
  const b = new Set(to.map(normalizePc));
  let count = 0;
  for (const pc of a) {
    if (b.has(pc)) count++;
  }
  return count;
}

/**
 * Test whether two pitch-class sets are connected by parsimonious voice leading.
 *
 * @param from - Source pitch classes.
 * @param to - Target pitch classes.
 * @param threshold - Maximum total displacement to count as parsimonious (default 2).
 * @returns True if parsimonyScore ≤ threshold.
 */
export function isParsimoniousConnection(
  from: readonly number[],
  to: readonly number[],
  threshold = 2,
): boolean {
  return parsimonyScore(from, to) <= threshold;
}
