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
 * Earth Mover's Distance (EMD) between two pitch-class distributions on the chroma circle.
 *
 * Computes the minimum cost of transforming distribution `a` into distribution `b`,
 * where cost is the circular semitone distance on the 12-element pitch-class ring.
 * Uses the efficient 1D circular EMD algorithm.
 *
 * @param a - First pitch-class distribution (12-element array of non-negative weights).
 * @param b - Second pitch-class distribution (12-element array of non-negative weights).
 * @returns The Earth Mover's Distance (non-negative). 0 if distributions are identical.
 * @throws {Error} If inputs are not 12-element arrays or contain negative values.
 *
 * @example
 * ```ts
 * const cMajor = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // C D E F G A B
 * const gMajor = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1]; // G A B C D E F#
 * earthMoversDistance(cMajor, gMajor); // small value (closely related keys)
 * ```
 */
export function earthMoversDistance(a: readonly number[], b: readonly number[]): number {
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

  // 1D circular EMD via cumulative difference
  // For circular distributions, EMD = min over rotations of the linear EMD
  // We use the efficient O(n) algorithm: compute prefix sum of differences,
  // then EMD = sum of |prefix[i] - median(prefix)|
  const diff = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    diff[i] = normA[i]! - normB[i]!;
  }

  // Cumulative sum
  const cumSum = new Array<number>(12);
  cumSum[0] = diff[0]!;
  for (let i = 1; i < 12; i++) {
    cumSum[i] = cumSum[i - 1]! + diff[i]!;
  }

  // For circular EMD, find the offset that minimizes total work
  // This is equivalent to finding the median of cumulative sums
  const sorted = [...cumSum].sort((x, y) => x - y);
  const median = sorted[6]!; // median of 12 values

  let emd = 0;
  for (let i = 0; i < 12; i++) {
    emd += Math.abs(cumSum[i]! - median);
  }

  return emd;
}

// ---- Internal Helpers ----

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
