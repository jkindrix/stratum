// ---------------------------------------------------------------------------
// Stratum — SIA/SIATEC Repetition Discovery
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

/** A point in (onset, pitch) space. */
export interface MusicPoint {
  readonly onset: number;
  readonly pitch: number;
}

/** A translation vector in (onset, pitch) space. */
export interface TranslationVector {
  readonly dOnset: number;
  readonly dPitch: number;
}

/** A maximal translatable pattern (MTP) discovered by SIA. */
export interface SIAPattern {
  readonly pattern: readonly MusicPoint[];
  readonly vector: TranslationVector;
}

/** A translation equivalence class: a pattern + all translations where it occurs. */
export interface TEC {
  readonly pattern: readonly MusicPoint[];
  readonly translators: readonly TranslationVector[];
}

/** Result of COSIATEC greedy compression. */
export interface CosiatecResult {
  readonly tecs: readonly TEC[];
  readonly compressionRatio: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointKey(p: MusicPoint): string {
  return `${p.onset},${p.pitch}`;
}

function vectorKey(v: TranslationVector): string {
  return `${v.dOnset},${v.dPitch}`;
}

function comparePoints(a: MusicPoint, b: MusicPoint): number {
  if (a.onset !== b.onset) return a.onset - b.onset;
  return a.pitch - b.pitch;
}

function patternKey(pts: readonly MusicPoint[]): string {
  return pts.map(pointKey).join(';');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert NoteEvent[] to a sorted, deduplicated point set in (onset, pitch) space.
 *
 * @param events - Note events.
 * @returns Frozen array of MusicPoints, sorted lexicographically.
 */
export function pointSetRepresentation(events: readonly NoteEvent[]): readonly MusicPoint[] {
  const seen = new Set<string>();
  const points: MusicPoint[] = [];

  for (const e of events) {
    const p: MusicPoint = { onset: e.onset, pitch: e.pitch.midi };
    const k = pointKey(p);
    if (!seen.has(k)) {
      seen.add(k);
      points.push(p);
    }
  }

  points.sort(comparePoints);

  const frozen: MusicPoint[] = [];
  for (const p of points) {
    frozen.push(Object.freeze(p));
  }
  return Object.freeze(frozen);
}

/**
 * SIA algorithm: discover all maximal translatable patterns.
 *
 * For every ordered pair (p_i, p_j) with i < j, computes the difference
 * vector and groups source points by identical vectors. Each group forms
 * a translatable pattern.
 *
 * @param points - Sorted, deduplicated point set.
 * @param minPatternSize - Minimum pattern size to include (default: 2).
 * @returns Frozen array of SIAPattern.
 */
export function sia(
  points: readonly MusicPoint[],
  minPatternSize: number = 2,
): readonly SIAPattern[] {
  if (points.length < 2) return Object.freeze([]);

  // Compute all difference vectors and group source points
  const vectorGroups = new Map<string, MusicPoint[]>();
  const vectorMap = new Map<string, TranslationVector>();

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const pi = points[i]!;
      const pj = points[j]!;
      const vec: TranslationVector = {
        dOnset: pj.onset - pi.onset,
        dPitch: pj.pitch - pi.pitch,
      };
      const vk = vectorKey(vec);

      if (!vectorGroups.has(vk)) {
        vectorGroups.set(vk, []);
        vectorMap.set(vk, vec);
      }
      vectorGroups.get(vk)!.push(pi);
    }
  }

  // Deduplicate source points within each group and filter by min size
  const result: SIAPattern[] = [];
  for (const [vk, sources] of vectorGroups) {
    const seen = new Set<string>();
    const unique: MusicPoint[] = [];
    for (const p of sources) {
      const pk = pointKey(p);
      if (!seen.has(pk)) {
        seen.add(pk);
        unique.push(p);
      }
    }

    if (unique.length >= minPatternSize) {
      unique.sort(comparePoints);
      const frozenPattern = Object.freeze(unique.map(p => Object.freeze({ ...p })));
      result.push(Object.freeze({
        pattern: frozenPattern,
        vector: Object.freeze(vectorMap.get(vk)!),
      }));
    }
  }

  return Object.freeze(result);
}

/**
 * SIATEC: find all translation equivalence classes.
 *
 * For each unique pattern from SIA, finds ALL translation vectors that
 * map the pattern into the point set.
 *
 * @param points - Sorted, deduplicated point set.
 * @param minPatternSize - Minimum pattern size (default: 2).
 * @returns Frozen array of TEC.
 */
export function siatec(
  points: readonly MusicPoint[],
  minPatternSize: number = 2,
): readonly TEC[] {
  if (points.length < 2) return Object.freeze([]);

  const patterns = sia(points, minPatternSize);
  if (patterns.length === 0) return Object.freeze([]);

  // Build point lookup set
  const pointSet = new Set<string>();
  for (const p of points) {
    pointSet.add(pointKey(p));
  }

  // Group patterns by content to deduplicate
  const uniquePatterns = new Map<string, readonly MusicPoint[]>();
  for (const sp of patterns) {
    const pk = patternKey(sp.pattern);
    if (!uniquePatterns.has(pk)) {
      uniquePatterns.set(pk, sp.pattern);
    }
  }

  const result: TEC[] = [];

  for (const [, pattern] of uniquePatterns) {
    // For each point in the set, check if it could be the translation
    // of the first point of the pattern
    const firstPoint = pattern[0]!;
    const translators: TranslationVector[] = [];

    for (const p of points) {
      const vec: TranslationVector = {
        dOnset: p.onset - firstPoint.onset,
        dPitch: p.pitch - firstPoint.pitch,
      };

      // Check if ALL pattern points exist when translated by vec
      let allPresent = true;
      for (const pp of pattern) {
        const translated = `${pp.onset + vec.dOnset},${pp.pitch + vec.dPitch}`;
        if (!pointSet.has(translated)) {
          allPresent = false;
          break;
        }
      }

      if (allPresent) {
        translators.push(Object.freeze(vec));
      }
    }

    if (translators.length > 0) {
      result.push(Object.freeze({
        pattern: Object.freeze([...pattern]),
        translators: Object.freeze(translators),
      }));
    }
  }

  return Object.freeze(result);
}

/**
 * COSIATEC: greedy set-cover compression using SIATEC.
 *
 * Iteratively selects the TEC covering the most points, removes covered
 * points, and repeats until all points are covered.
 *
 * @param points - Sorted, deduplicated point set.
 * @param minPatternSize - Minimum pattern size (default: 2).
 * @returns Frozen CosiatecResult with selected TECs and compression ratio.
 */
export function cosiatec(
  points: readonly MusicPoint[],
  minPatternSize: number = 2,
): CosiatecResult {
  if (points.length === 0) {
    return Object.freeze({
      tecs: Object.freeze([]),
      compressionRatio: 0,
    });
  }

  const totalPoints = points.length;
  let uncovered = new Set<string>();
  const mutablePoints: MusicPoint[] = [];
  for (const p of points) {
    uncovered.add(pointKey(p));
    mutablePoints.push({ onset: p.onset, pitch: p.pitch });
  }

  const selectedTecs: TEC[] = [];
  let descriptionLength = 0;

  while (uncovered.size > 0) {
    // Build point array from uncovered set
    const currentPoints: MusicPoint[] = [];
    for (const k of uncovered) {
      const parts = k.split(',');
      currentPoints.push({
        onset: Number(parts[0]),
        pitch: Number(parts[1]),
      });
    }
    currentPoints.sort(comparePoints);

    const tecs = siatec(currentPoints, minPatternSize);

    if (tecs.length === 0) {
      // Remaining points can't form patterns; each is its own "pattern"
      descriptionLength += uncovered.size;
      break;
    }

    // Select TEC covering the most points
    let bestTec: TEC | undefined;
    let bestCoverage = 0;

    for (const tec of tecs) {
      const coverage = tec.pattern.length * tec.translators.length;
      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        bestTec = tec;
      }
    }

    if (!bestTec) break;

    // Remove covered points
    for (const translator of bestTec.translators) {
      for (const pp of bestTec.pattern) {
        const translated = `${pp.onset + translator.dOnset},${pp.pitch + translator.dPitch}`;
        uncovered.delete(translated);
      }
    }

    selectedTecs.push(bestTec);
    // Description length = pattern size (we describe the pattern once + translators)
    descriptionLength += bestTec.pattern.length + bestTec.translators.length;
  }

  // Compression ratio: description length / total points (lower = more repetitive)
  const compressionRatio = totalPoints > 0 ? descriptionLength / totalPoints : 0;

  return Object.freeze({
    tecs: Object.freeze(selectedTecs),
    compressionRatio,
  });
}

/**
 * Compute the COSIATEC compression ratio for a point set.
 *
 * @param points - Sorted, deduplicated point set.
 * @param minPatternSize - Minimum pattern size (default: 2).
 * @returns Compression ratio (lower = more repetitive). 0 for empty input.
 */
export function compressionRatio(
  points: readonly MusicPoint[],
  minPatternSize: number = 2,
): number {
  return cosiatec(points, minPatternSize).compressionRatio;
}
