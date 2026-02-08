// ---------------------------------------------------------------------------
// Stratum — Pitch-Class Set Similarity Measures
// ---------------------------------------------------------------------------

import { PitchClassSet } from './pitch-class-set.js';

/**
 * Interval-class vector similarity (IcVSIM).
 * Pearson correlation coefficient between two interval-class vectors.
 *
 * @param a - First pitch-class set.
 * @param b - Second pitch-class set.
 * @returns Correlation from -1 to 1. Identical ICVs yield 1.0.
 *
 * @example
 * ```ts
 * const major = new PitchClassSet([0, 4, 7]);
 * const minor = new PitchClassSet([0, 3, 7]);
 * icvsim(major, minor); // ~0.5
 * ```
 */
export function icvsim(a: PitchClassSet, b: PitchClassSet): number {
  const va = a.intervalVector();
  const vb = b.intervalVector();
  return pearson6(va, vb);
}

/**
 * Angle similarity between two interval-class vectors.
 * Returns the angle (in radians) between two ICVs treated as 6D vectors.
 * Smaller angle = more similar. Range: 0 (identical) to PI (opposite).
 *
 * @param a - First pitch-class set.
 * @param b - Second pitch-class set.
 * @returns Angle in radians between the two ICVs.
 */
export function angleSimilarity(a: PitchClassSet, b: PitchClassSet): number {
  const va = a.intervalVector();
  const vb = b.intervalVector();

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < 6; i++) {
    dot += va[i]! * vb[i]!;
    magA += va[i]! * va[i]!;
    magB += vb[i]! * vb[i]!;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;

  // Clamp for floating point safety
  const cosine = Math.max(-1, Math.min(1, dot / denom));
  return Math.acos(cosine);
}

/**
 * Cosine similarity between two pitch-class distributions.
 * Treats each set as a 12-element binary vector (0/1 membership).
 *
 * @param a - First pitch-class set.
 * @param b - Second pitch-class set.
 * @returns Cosine similarity from 0 (disjoint) to 1 (identical membership).
 */
export function pcSetCosine(a: PitchClassSet, b: PitchClassSet): number {
  const va = pcVector(a);
  const vb = pcVector(b);

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < 12; i++) {
    dot += va[i]! * vb[i]!;
    magA += va[i]! * va[i]!;
    magB += vb[i]! * vb[i]!;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Detect Z-related sets: sets with the same interval-class vector but different prime forms.
 *
 * @param a - First pitch-class set.
 * @param b - Second pitch-class set.
 * @returns True if the sets are Z-related (same ICV, different prime form).
 *
 * @example
 * ```ts
 * const z15 = new PitchClassSet([0, 1, 4, 6]); // 4-Z15
 * const z29 = new PitchClassSet([0, 1, 3, 7]); // 4-Z29
 * zRelation(z15, z29); // true
 * ```
 */
export function zRelation(a: PitchClassSet, b: PitchClassSet): boolean {
  const va = a.intervalVector();
  const vb = b.intervalVector();

  // Same ICV?
  for (let i = 0; i < 6; i++) {
    if (va[i] !== vb[i]) return false;
  }

  // Different prime form?
  const pa = a.primeForm();
  const pb = b.primeForm();
  if (pa.length !== pb.length) return true;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return true;
  }

  return false; // Same ICV AND same prime form → not Z-related, just equivalent
}

/**
 * A function that computes the ground distance between two pitch classes.
 * Used as a custom distance metric for Earth Mover's Distance.
 *
 * @param from - Source pitch class (0-11).
 * @param to - Target pitch class (0-11).
 * @returns Non-negative distance.
 */
export type GroundDistance = (from: number, to: number) => number;

/**
 * Earth Mover's Distance (EMD) between two pitch-class distributions on the chroma circle.
 *
 * Computes the minimum cost of transforming distribution `a` into distribution `b`,
 * where cost is the circular semitone distance on the 12-element pitch-class ring.
 * Uses the efficient 1D circular EMD algorithm when no custom ground distance is provided.
 *
 * @param a - First pitch-class distribution (12-element array of non-negative weights).
 * @param b - Second pitch-class distribution (12-element array of non-negative weights).
 * @param groundDistance - Optional custom ground distance function. When omitted,
 *   uses circular semitone distance (min of clockwise/counterclockwise on the pitch-class ring).
 * @returns The Earth Mover's Distance (non-negative). 0 if distributions are identical.
 * @throws {RangeError} If inputs are not 12-element arrays or contain negative values.
 *
 * @example
 * ```ts
 * const cMajor = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // C D E F G A B
 * const gMajor = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1]; // G A B C D E F#
 * earthMoversDistance(cMajor, gMajor); // small value (closely related keys)
 *
 * // Circle-of-fifths distance
 * const fifthsDist = (a: number, b: number) => {
 *   const steps = Math.abs(((a * 7) % 12) - ((b * 7) % 12));
 *   return Math.min(steps, 12 - steps);
 * };
 * earthMoversDistance(cMajor, gMajor, fifthsDist);
 * ```
 */
export function earthMoversDistance(
  a: readonly number[],
  b: readonly number[],
  groundDistance?: GroundDistance,
): number {
  if (a.length !== 12 || b.length !== 12) {
    throw new RangeError('Both distributions must have exactly 12 elements');
  }
  for (let i = 0; i < 12; i++) {
    if (a[i]! < 0 || b[i]! < 0) {
      throw new RangeError('Distribution values must be non-negative');
    }
  }

  // Normalize distributions to sum to 1
  const sumA = a.reduce((s, v) => s + v, 0);
  const sumB = b.reduce((s, v) => s + v, 0);

  if (sumA === 0 && sumB === 0) return 0;
  if (sumA === 0 || sumB === 0) {
    throw new RangeError('Cannot compute EMD when one distribution sums to zero');
  }

  const normA = a.map(v => v / sumA);
  const normB = b.map(v => v / sumB);

  if (groundDistance) {
    return generalEMD(normA, normB, groundDistance);
  }
  return circularEMD(normA, normB);
}

// ---- Internal Helpers ----

/** Efficient O(n) circular EMD for the default semitone ground distance. */
function circularEMD(normA: number[], normB: number[]): number {
  const diff = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    diff[i] = normA[i]! - normB[i]!;
  }

  const cumSum = new Array<number>(12);
  cumSum[0] = diff[0]!;
  for (let i = 1; i < 12; i++) {
    cumSum[i] = cumSum[i - 1]! + diff[i]!;
  }

  const sorted = [...cumSum].sort((x, y) => x - y);
  const median = sorted[6]!;

  let emd = 0;
  for (let i = 0; i < 12; i++) {
    emd += Math.abs(cumSum[i]! - median);
  }
  return emd;
}

/**
 * General EMD using the transportation simplex method for arbitrary ground distances.
 * Solves the optimal transport problem for N=12 supply/demand nodes.
 */
function generalEMD(
  supply: number[],
  demand: number[],
  distFn: GroundDistance,
): number {
  const N = 12;
  const EPS = 1e-12;

  // Build cost matrix
  const cost: number[][] = [];
  for (let i = 0; i < N; i++) {
    cost[i] = [];
    for (let j = 0; j < N; j++) {
      cost[i]![j] = distFn(i, j);
    }
  }

  // Filter to non-zero supply and demand indices for efficiency
  const sIdx: number[] = [];
  const dIdx: number[] = [];
  const s: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < N; i++) {
    if (supply[i]! > EPS) { sIdx.push(i); s.push(supply[i]!); }
    if (demand[i]! > EPS) { dIdx.push(i); d.push(demand[i]!); }
  }

  const m = s.length;
  const n = d.length;
  if (m === 0 || n === 0) return 0;

  // Allocate flow matrix using Northwest Corner Method
  const flow: number[][] = [];
  for (let i = 0; i < m; i++) {
    flow[i] = new Array<number>(n).fill(0);
  }

  const remS = [...s];
  const remD = [...d];
  let si = 0;
  let di = 0;
  while (si < m && di < n) {
    const amt = Math.min(remS[si]!, remD[di]!);
    flow[si]![di] = amt;
    remS[si]! -= amt;
    remD[di]! -= amt;
    if (remS[si]! < EPS) si++;
    if (remD[di]! < EPS) di++;
  }

  // Track basis cells
  const inBasis: boolean[][] = [];
  for (let i = 0; i < m; i++) {
    inBasis[i] = new Array<boolean>(n).fill(false);
  }
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (flow[i]![j]! > EPS) inBasis[i]![j] = true;
    }
  }

  // Ensure basis has m + n - 1 cells (add degenerate cells if needed)
  let basisCount = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (inBasis[i]![j]) basisCount++;
    }
  }
  // Add degenerate cells along the diagonal if needed
  for (let i = 0; i < m && basisCount < m + n - 1; i++) {
    for (let j = 0; j < n && basisCount < m + n - 1; j++) {
      if (!inBasis[i]![j]) {
        inBasis[i]![j] = true;
        flow[i]![j] = 0;
        basisCount++;
      }
    }
  }

  // MODI method: iterate until optimal
  const MAX_ITER = 200;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Compute dual variables u, v via basis cells: u[i] + v[j] = cost[sIdx[i]][dIdx[j]]
    const u = new Array<number>(m).fill(NaN);
    const v = new Array<number>(n).fill(NaN);
    u[0] = 0;
    let assigned = 1;
    let changed = true;
    while (changed && assigned < m + n) {
      changed = false;
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          if (!inBasis[i]![j]) continue;
          const c = cost[sIdx[i]!]![dIdx[j]!]!;
          if (!isNaN(u[i]!) && isNaN(v[j]!)) {
            v[j] = c - u[i]!;
            assigned++;
            changed = true;
          } else if (isNaN(u[i]!) && !isNaN(v[j]!)) {
            u[i] = c - v[j]!;
            assigned++;
            changed = true;
          }
        }
      }
    }

    // Find most negative reduced cost among non-basis cells
    let minRC = -EPS;
    let enterI = -1;
    let enterJ = -1;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (inBasis[i]![j]) continue;
        const rc = cost[sIdx[i]!]![dIdx[j]!]! - (u[i] ?? 0) - (v[j] ?? 0);
        if (rc < minRC) {
          minRC = rc;
          enterI = i;
          enterJ = j;
        }
      }
    }

    if (enterI === -1) break; // Optimal

    // Find loop through basis cells starting/ending at (enterI, enterJ)
    const loop = findLoop(inBasis, m, n, enterI, enterJ);
    if (loop.length === 0) break;

    // Find minimum flow on negative arcs (odd-indexed cells in loop)
    let minFlow = Infinity;
    for (let k = 1; k < loop.length; k += 2) {
      const [li, lj] = loop[k]!;
      const f = flow[li!]![lj!]!;
      if (f < minFlow) minFlow = f;
    }

    // Adjust flow along loop
    for (let k = 0; k < loop.length; k++) {
      const [li, lj] = loop[k]!;
      if (k % 2 === 0) {
        flow[li!]![lj!]! += minFlow;
      } else {
        flow[li!]![lj!]! -= minFlow;
      }
    }

    // Update basis: add entering cell, remove one leaving cell
    inBasis[enterI]![enterJ] = true;
    for (let k = 1; k < loop.length; k += 2) {
      const [li, lj] = loop[k]!;
      if (flow[li!]![lj!]! < EPS) {
        flow[li!]![lj!] = 0;
        inBasis[li!]![lj!] = false;
        break;
      }
    }
  }

  // Compute total cost
  let totalCost = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (flow[i]![j]! > EPS) {
        totalCost += flow[i]![j]! * cost[sIdx[i]!]![dIdx[j]!]!;
      }
    }
  }
  return totalCost;
}

/**
 * Find a loop through basis cells for the entering variable at (enterI, enterJ).
 * Uses BFS alternating between row and column scans.
 */
function findLoop(
  inBasis: boolean[][],
  m: number,
  n: number,
  enterI: number,
  enterJ: number,
): [number, number][] {
  type Step = { i: number; j: number; path: [number, number][] };

  const start: Step = { i: enterI, j: enterJ, path: [[enterI, enterJ]] };
  const queue: Step[] = [start];
  const maxLen = 2 * (m + n);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const step = cur.path.length;
    const isRowStep = step % 2 === 1;

    if (isRowStep) {
      for (let j = 0; j < n; j++) {
        if (j === cur.j) continue;
        if (!inBasis[cur.i]![j]) continue;
        const newPath: [number, number][] = [...cur.path, [cur.i, j]];
        if (newPath.length > maxLen) continue;
        queue.push({ i: cur.i, j, path: newPath });
      }
    } else {
      for (let i = 0; i < m; i++) {
        if (i === cur.i) continue;
        if (!inBasis[i]![cur.j]) continue;
        if (i === enterI && step >= 3) {
          return [...cur.path, [i, cur.j]];
        }
        const newPath: [number, number][] = [...cur.path, [i, cur.j]];
        if (newPath.length > maxLen) continue;
        queue.push({ i, j: cur.j, path: newPath });
      }
    }
  }
  return [];
}

function pearson6(
  x: [number, number, number, number, number, number],
  y: [number, number, number, number, number, number],
): number {
  let sumX = 0, sumY = 0;
  for (let i = 0; i < 6; i++) {
    sumX += x[i]!;
    sumY += y[i]!;
  }
  const meanX = sumX / 6;
  const meanY = sumY / 6;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < 6; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function pcVector(set: PitchClassSet): number[] {
  const v = new Array<number>(12).fill(0);
  for (const pc of set.pcs) {
    v[pc] = 1;
  }
  return v;
}
