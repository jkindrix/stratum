// ---------------------------------------------------------------------------
// Stratum — Rhythmic Complexity Measures
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';
import type { MetricLevel } from './metric.js';
import { beatStrength } from './metric.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the groove score composite measure. */
export interface GrooveOptions {
  /** Weight for syncopation component (default 0.4). */
  readonly syncopationWeight?: number;
  /** Weight for micro-timing / note-to-beat distance component (default 0.3). */
  readonly microTimingWeight?: number;
  /** Weight for IOI variety component (default 0.3). */
  readonly varietyWeight?: number;
  /** Grid resolution in ticks for binary onset string (default 120). */
  readonly gridTicks?: number;
}

// ---------------------------------------------------------------------------
// LZ Complexity
// ---------------------------------------------------------------------------

/**
 * Compute Lempel-Ziv complexity of a rhythmic pattern.
 *
 * Quantizes note onsets to a binary grid string, then applies LZ76
 * factorization. Result is normalized to [0, 1] by dividing by the
 * theoretical maximum (n / log2(n)).
 *
 * @param events - Note events to analyze.
 * @param gridTicks - Grid resolution in ticks (default 120).
 * @returns Normalized LZ complexity in [0, 1]. Higher = more complex.
 * @throws {RangeError} If gridTicks is not a positive integer.
 */
export function lzComplexity(events: readonly NoteEvent[], gridTicks = 120): number {
  if (!Number.isInteger(gridTicks) || gridTicks < 1) {
    throw new RangeError(`gridTicks must be a positive integer (got ${gridTicks})`);
  }
  if (events.length === 0) return 0;

  // Find extent
  let maxTick = 0;
  for (const e of events) {
    const end = e.onset + e.duration;
    if (end > maxTick) maxTick = end;
  }

  const gridLen = Math.ceil(maxTick / gridTicks);
  if (gridLen === 0) return 0;

  // Build binary onset string
  const grid = new Uint8Array(gridLen);
  for (const e of events) {
    const idx = Math.floor(e.onset / gridTicks);
    if (idx < gridLen) grid[idx] = 1;
  }

  // LZ76 factorization
  const factors = lz76Count(grid);
  const n = gridLen;
  if (n <= 1) return 0;

  // Theoretical maximum for binary string of length n
  const maxFactors = n / Math.log2(n);
  return Math.min(1, factors / maxFactors);
}

/**
 * LZ76 factorization: count the number of distinct factors.
 * @internal
 */
function lz76Count(s: Uint8Array): number {
  const n = s.length;
  if (n === 0) return 0;

  let complexity = 1;
  let i = 0;
  let len = 1;

  while (i + len < n) {
    // Check if s[i..i+len-1] appears as a substring of s[0..i+len-2]
    const sub = s.subarray(i, i + len);
    const searchSpace = s.subarray(0, i + len - 1);
    if (containsSubarray(searchSpace, sub)) {
      len++;
    } else {
      complexity++;
      i += len;
      len = 1;
    }
  }

  return complexity;
}

/**
 * Check if `haystack` contains `needle` as a contiguous subsequence.
 * @internal
 */
function containsSubarray(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length > haystack.length) return false;
  const limit = haystack.length - needle.length;
  outer: for (let i = 0; i <= limit; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Syncopation Index (LHL model)
// ---------------------------------------------------------------------------

/**
 * Compute the Longuet-Higgins & Lee syncopation index.
 *
 * Sums positive beat-strength differences between consecutive onsets.
 * When a note on a weak beat is followed by a note on a stronger beat,
 * that pair contributes to syncopation.
 *
 * @param events - Note events (sorted by onset).
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @returns Syncopation index (≥ 0). Higher = more syncopated.
 */
export function syncopationIndex(
  events: readonly NoteEvent[],
  levels: MetricLevel[],
): number {
  if (events.length < 2) return 0;

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  let index = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;
    const currStrength = beatStrength(curr.onset, levels);
    const nextStrength = beatStrength(next.onset, levels);
    const diff = nextStrength - currStrength;
    if (diff > 0) {
      index += diff;
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Weighted Note-to-Beat Distance (WNBD)
// ---------------------------------------------------------------------------

/**
 * Compute the average velocity-weighted distance from each note to the nearest beat.
 *
 * Higher values indicate notes placed further from metrical beats,
 * suggesting more "off-beat" or micro-timed placement.
 *
 * @param events - Note events.
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @returns Normalized value in [0, 1].
 */
export function weightedNoteToBeatDistance(
  events: readonly NoteEvent[],
  levels: MetricLevel[],
): number {
  if (events.length === 0) return 0;

  // Find beat-level period
  const beatLevel = levels.find(l => l.name === 'beat');
  if (!beatLevel) return 0;
  const beatPeriod = beatLevel.periodTicks;
  if (beatPeriod <= 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const e of events) {
    const distToBeat = Math.min(
      e.onset % beatPeriod,
      beatPeriod - (e.onset % beatPeriod),
    );
    const normalizedDist = distToBeat / (beatPeriod / 2); // 0 = on beat, 1 = maximally off
    const weight = e.velocity / 127;
    weightedSum += normalizedDist * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ---------------------------------------------------------------------------
// Groove Score (Composite)
// ---------------------------------------------------------------------------

/**
 * Compute a composite groove score combining syncopation, micro-timing, and IOI variety.
 *
 * @param events - Note events.
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @param options - Weight and grid options.
 * @returns Groove score in [0, 1]. Higher = more groove.
 */
export function grooveScore(
  events: readonly NoteEvent[],
  levels: MetricLevel[],
  options?: GrooveOptions,
): number {
  if (events.length < 2) return 0;

  const synW = options?.syncopationWeight ?? 0.4;
  const mtW = options?.microTimingWeight ?? 0.3;
  const varW = options?.varietyWeight ?? 0.3;

  // Syncopation component: normalize by number of transitions
  const synRaw = syncopationIndex(events, levels);
  const maxPossibleSyn = (events.length - 1) * levels.reduce((s, l) => s + l.weight, 0);
  const synNorm = maxPossibleSyn > 0 ? Math.min(1, synRaw / maxPossibleSyn) : 0;

  // Micro-timing component
  const mtNorm = weightedNoteToBeatDistance(events, levels);

  // IOI variety component
  const varNorm = ioiVariety(events);

  return Math.min(1, synW * synNorm + mtW * mtNorm + varW * varNorm);
}

/**
 * IOI (inter-onset interval) variety: normalized count of distinct IOIs.
 * @internal
 */
function ioiVariety(events: readonly NoteEvent[]): number {
  if (events.length < 2) return 0;

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const iois = new Set<number>();

  for (let i = 1; i < sorted.length; i++) {
    const ioi = (sorted[i]?.onset ?? 0) - (sorted[i - 1]?.onset ?? 0);
    if (ioi > 0) iois.add(ioi);
  }

  // Normalize by count of intervals
  const maxDistinct = sorted.length - 1;
  return maxDistinct > 0 ? iois.size / maxDistinct : 0;
}
