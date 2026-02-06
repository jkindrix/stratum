// ---------------------------------------------------------------------------
// Stratum — Key Detection (Krumhansl-Schmuckler Algorithm)
// ---------------------------------------------------------------------------

import type { Score, NoteEvent } from '../core/types.js';
import { tiv, tivDistance } from '../tension/tiv.js';

/** Key profile weights for correlation-based key detection. */
export interface KeyProfile {
  /** 12-element major key profile (C through B). */
  readonly major: readonly number[];
  /** 12-element minor key profile (C through B). */
  readonly minor: readonly number[];
}

/** A candidate key with its correlation score. */
export interface KeyCandidate {
  /** Tonic pitch class (0-11). */
  readonly tonic: number;
  /** Mode: 'major' or 'minor'. */
  readonly mode: 'major' | 'minor';
  /** Pearson correlation with the key profile (-1 to 1). */
  readonly correlation: number;
  /** Human-readable name (e.g., "C major", "F# minor"). */
  readonly name: string;
}

/** Result of key detection. */
export interface KeyDetectionResult {
  /** Best-matching key. */
  readonly best: KeyCandidate;
  /** All 24 candidates ranked by correlation (descending). */
  readonly candidates: readonly KeyCandidate[];
}

/** Options for key detection. */
export interface KeyDetectionOptions {
  /** Key profile to use: 'krumhansl' (default), 'temperley', or a custom KeyProfile. */
  readonly profile?: 'krumhansl' | 'temperley' | KeyProfile;
  /** Weight pitch classes by note duration (default: true). */
  readonly weightByDuration?: boolean;
}

/** Result of windowed key detection at a specific position. */
export interface WindowedKeyResult {
  /** Start tick of this window. */
  readonly startTick: number;
  /** End tick of this window. */
  readonly endTick: number;
  /** Key detection result for this window. */
  readonly result: KeyDetectionResult;
}

// ---- Built-in Key Profiles ----

/**
 * Krumhansl-Kessler (1990) probe tone ratings.
 * Derived from listener experiments on perceived stability of pitches in key context.
 */
const KRUMHANSL_KESSLER: KeyProfile = Object.freeze({
  major: Object.freeze([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]),
  minor: Object.freeze([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]),
});

/**
 * Temperley (2001) key profiles from "The Cognition of Basic Musical Structures".
 * Derived from corpus analysis, emphasizing tonic/dominant weight differences.
 */
const TEMPERLEY: KeyProfile = Object.freeze({
  major: Object.freeze([5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0]),
  minor: Object.freeze([5.0, 2.0, 3.5, 4.5, 2.0, 3.5, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0]),
});

const PC_SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC_FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys that conventionally use flats
const FLAT_MAJOR_TONICS = new Set([1, 3, 5, 8, 10]); // Db, Eb, F, Ab, Bb
const FLAT_MINOR_TONICS = new Set([0, 1, 3, 5, 7, 8, 10]); // C, Db, Eb, F, G, Ab, Bb

// ---- Internal Helpers ----

export function keyName(tonic: number, mode: 'major' | 'minor'): string {
  const useFlats = mode === 'major'
    ? FLAT_MAJOR_TONICS.has(tonic)
    : FLAT_MINOR_TONICS.has(tonic);
  const names = useFlats ? PC_FLAT_NAMES : PC_SHARP_NAMES;
  return `${names[tonic]!} ${mode}`;
}

function pearsonCorrelation(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]!;
    sumY += y[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function resolveProfile(opt: KeyDetectionOptions['profile']): KeyProfile {
  if (!opt || opt === 'krumhansl') return KRUMHANSL_KESSLER;
  if (opt === 'temperley') return TEMPERLEY;
  return opt;
}

export function pcDistribution(events: readonly NoteEvent[], weightByDuration: boolean): number[] {
  const dist = new Array<number>(12).fill(0);
  for (const e of events) {
    const pc = e.pitch.pitchClass;
    dist[pc] = (dist[pc] ?? 0) + (weightByDuration ? e.duration : 1);
  }
  return dist;
}

function detectKeyFromDistribution(dist: number[], profile: KeyProfile): KeyDetectionResult {
  const candidates: KeyCandidate[] = [];

  for (let tonic = 0; tonic < 12; tonic++) {
    // Rotate distribution so that `tonic` aligns with index 0 of the profile
    const rotated = new Array<number>(12);
    for (let i = 0; i < 12; i++) {
      rotated[i] = dist[(i + tonic) % 12]!;
    }

    const majorCorr = pearsonCorrelation(rotated, profile.major);
    candidates.push({
      tonic,
      mode: 'major',
      correlation: majorCorr,
      name: keyName(tonic, 'major'),
    });

    const minorCorr = pearsonCorrelation(rotated, profile.minor);
    candidates.push({
      tonic,
      mode: 'minor',
      correlation: minorCorr,
      name: keyName(tonic, 'minor'),
    });
  }

  candidates.sort((a, b) => b.correlation - a.correlation);

  return {
    best: candidates[0]!,
    candidates,
  };
}

// ---- Public API ----

/**
 * Detect the most likely key of a score using the Krumhansl-Schmuckler algorithm.
 *
 * Computes a pitch-class distribution from all events and correlates it against
 * major and minor key profiles for all 12 tonics (24 candidates total).
 *
 * @param score - The score to analyze.
 * @param options - Detection options (profile choice, duration weighting).
 * @returns Key detection result with best match and all 24 ranked candidates.
 * @throws {Error} If the score contains no note events.
 *
 * @example
 * ```ts
 * const result = detectKey(score);
 * console.log(result.best.name); // "C major"
 * console.log(result.best.correlation); // 0.95
 * ```
 */
export function detectKey(score: Score, options?: KeyDetectionOptions): KeyDetectionResult {
  const events = score.parts.flatMap(p => p.events);
  if (events.length === 0) {
    throw new Error('Cannot detect key: score contains no note events');
  }

  const profile = resolveProfile(options?.profile);
  const weightByDuration = options?.weightByDuration ?? true;
  const dist = pcDistribution(events, weightByDuration);

  return detectKeyFromDistribution(dist, profile);
}

/**
 * Detect key changes over time using a sliding window.
 *
 * Divides the score into windows of the specified size and runs key detection
 * independently on each window. Useful for tracking modulations.
 *
 * @param score - The score to analyze.
 * @param windowSize - Window size in ticks.
 * @param options - Detection options (profile choice, duration weighting).
 * @returns Array of windowed key results, one per window with events.
 * @throws {RangeError} If windowSize is not positive.
 * @throws {Error} If the score contains no note events.
 *
 * @example
 * ```ts
 * const tpq = score.settings.ticksPerQuarter;
 * const results = detectKeyWindowed(score, tpq * 4); // 4-beat windows
 * results.forEach(w => console.log(`${w.startTick}: ${w.result.best.name}`));
 * ```
 */
export function detectKeyWindowed(
  score: Score,
  windowSize: number,
  options?: KeyDetectionOptions,
): WindowedKeyResult[] {
  if (!Number.isFinite(windowSize) || windowSize <= 0) {
    throw new RangeError(`windowSize must be positive (got ${windowSize})`);
  }

  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) {
    throw new Error('Cannot detect key: score contains no note events');
  }

  const profile = resolveProfile(options?.profile);
  const weightByDuration = options?.weightByDuration ?? true;

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const results: WindowedKeyResult[] = [];

  for (let start = 0; start < maxTick; start += windowSize) {
    const end = start + windowSize;
    // Include events that overlap this window
    const windowEvents = allEvents.filter(
      e => e.onset < end && e.onset + e.duration > start,
    );

    if (windowEvents.length === 0) continue;

    const dist = pcDistribution(windowEvents, weightByDuration);
    const result = detectKeyFromDistribution(dist, profile);

    results.push({ startTick: start, endTick: end, result });
  }

  return results;
}

/**
 * Detect the most likely key of a score using Tonal Interval Vector distance.
 *
 * Computes a TIV from the observed pitch-class distribution and compares it
 * against TIVs derived from major/minor key profiles for all 12 tonics.
 * Similarity is computed as 1 / (1 + distance), yielding scores in [0, 1].
 *
 * @param score - The score to analyze.
 * @param options - Detection options (profile choice, duration weighting).
 * @returns Key detection result with best match and all 24 ranked candidates.
 * @throws {Error} If the score contains no note events.
 *
 * @example
 * ```ts
 * const result = detectKeyTIV(score);
 * console.log(result.best.name); // "C major"
 * ```
 */
export function detectKeyTIV(score: Score, options?: KeyDetectionOptions): KeyDetectionResult {
  const events = score.parts.flatMap(p => p.events);
  if (events.length === 0) {
    throw new Error('Cannot detect key: score contains no note events');
  }

  const profile = resolveProfile(options?.profile);
  const weightByDuration = options?.weightByDuration ?? true;
  const dist = pcDistribution(events, weightByDuration);

  const observedTIV = tiv(dist);
  const candidates: KeyCandidate[] = [];

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const profileWeights = mode === 'major' ? profile.major : profile.minor;
      // Place profile weights at correct pitch-class positions
      const placed = new Array<number>(12).fill(0);
      for (let i = 0; i < 12; i++) {
        placed[(i + tonic) % 12] = profileWeights[i] ?? 0;
      }
      const candidateTIV = tiv(placed);
      const dist = tivDistance(observedTIV, candidateTIV);
      const similarity = 1 / (1 + dist);

      candidates.push({
        tonic,
        mode,
        correlation: similarity,
        name: keyName(tonic, mode),
      });
    }
  }

  candidates.sort((a, b) => b.correlation - a.correlation);

  return Object.freeze({
    best: candidates[0]!,
    candidates: Object.freeze(candidates),
  });
}
