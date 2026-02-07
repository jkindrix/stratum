import { normalizePc } from './pitch-class.js';

/**
 * Compute minimum voice-leading distance between two equal-sized pitch-class sets.
 * Finds the assignment of source PCs to target PCs that minimizes total semitone movement.
 *
 * For sets of size <= 8, uses exact brute-force (8! = 40,320 permutations).
 * For sets of size > 8, uses a greedy approximation that may not find the global
 * optimum but runs in O(n^2) time.
 *
 * @param from — Source pitch classes (will be normalized to 0-11).
 * @param to — Target pitch classes (will be normalized to 0-11).
 * @throws {Error} If arrays have different lengths.
 */
export function voiceLeadingDistance(from: number[], to: number[]): number {
  if (from.length !== to.length) {
    throw new Error(`Voice leading requires equal-sized sets (got ${from.length} and ${to.length})`);
  }

  const n = from.length;
  if (n === 0) return 0;

  const src = from.map(normalizePc);
  const dst = to.map(normalizePc);

  // For sets up to size 8, brute-force is fine (8! = 40320)
  if (n <= 8) {
    return bruteForceMinDistance(src, dst);
  }

  // For larger sets, use greedy approximation
  return greedyMinDistance(src, dst);
}

/**
 * Minimum pitch-class distance (0–6 semitones) between two pitch classes.
 *
 * @param a - First pitch class.
 * @param b - Second pitch class.
 * @returns Shortest distance in semitones (0–6).
 */
export function pcDistance(a: number, b: number): number {
  const diff = (b - a + 12) % 12;
  return Math.min(diff, 12 - diff);
}

function bruteForceMinDistance(src: number[], dst: number[]): number {
  let min = Infinity;

  for (const perm of permutations(dst)) {
    let dist = 0;
    for (let i = 0; i < src.length; i++) {
      dist += pcDistance(src[i]!, perm[i]!);
    }
    if (dist < min) min = dist;
  }

  return min;
}

function greedyMinDistance(src: number[], dst: number[]): number {
  // Build cost matrix and use greedy assignment
  const n = src.length;
  const used = new Set<number>();
  let total = 0;

  // For each source, find nearest unused destination
  const srcCopy = [...src];
  for (const s of srcCopy) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      const d = pcDistance(s, dst[j]!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx);
      total += bestDist;
    }
  }

  return total;
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i]!, ...perm]);
    }
  }
  return result;
}

/**
 * Find the smoothest voice leading between two pitch-class sets.
 * Returns an array of [from, to] pairs representing the optimal assignment.
 *
 * For sets of size <= 8, uses exact brute-force to find the global optimum.
 * For sets of size > 8, uses a greedy approximation.
 *
 * @param from — Source pitch classes (will be normalized to 0-11).
 * @param to — Target pitch classes (will be normalized to 0-11).
 * @throws {Error} If arrays have different lengths.
 */
export function smoothestVoiceLeading(
  from: number[],
  to: number[],
): Array<[number, number]> {
  if (from.length !== to.length) {
    throw new Error(`Voice leading requires equal-sized sets (got ${from.length} and ${to.length})`);
  }

  const n = from.length;
  if (n === 0) return [];

  const src = from.map(normalizePc);
  const dst = to.map(normalizePc);

  if (n > 8) {
    // Greedy for large sets
    return greedyAssignment(src, dst);
  }

  // Brute force optimal
  let minDist = Infinity;
  let bestPerm: number[] = dst;

  for (const perm of permutations(dst)) {
    let dist = 0;
    for (let i = 0; i < n; i++) {
      dist += pcDistance(src[i]!, perm[i]!);
    }
    if (dist < minDist) {
      minDist = dist;
      bestPerm = perm;
    }
  }

  return src.map((s, i) => [s, bestPerm[i]!] as [number, number]);
}

function greedyAssignment(src: number[], dst: number[]): Array<[number, number]> {
  const n = src.length;
  const used = new Set<number>();
  const result: Array<[number, number]> = [];

  for (const s of src) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      const d = pcDistance(s, dst[j]!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx);
      result.push([s, dst[bestIdx]!]);
    }
  }

  return result;
}
