import type { Score, NoteEvent } from '../core/types.js';
import { findPatterns } from '../time/pattern.js';
import { pcDistribution } from './key-detection.js';

/** A point on a density or envelope curve. */
export interface CurvePoint {
  /** Tick position in the score. */
  tick: number;
  /** Value at this tick (e.g. event density). */
  value: number;
}

/** A point on the registral envelope with high and low values. */
export interface EnvelopePoint {
  /** Tick position in the score. */
  tick: number;
  /** Highest sounding MIDI pitch at this tick. */
  high: number;
  /** Lowest sounding MIDI pitch at this tick. */
  low: number;
}

/**
 * Segment a melody into phrases by detecting gaps (rests) between notes.
 * A gap is silence longer than `gapThreshold` ticks.
 *
 * @param events — Note events sorted by onset.
 * @param gapThreshold — Minimum gap in ticks to trigger a segment break (default: 480).
 * @returns Array of segments, each being an array of NoteEvent.
 */
export function segmentByRests(events: NoteEvent[], gapThreshold = 480): NoteEvent[][] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const segments: NoteEvent[][] = [[sorted[0]!]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const gap = curr.onset - (prev.onset + prev.duration);

    if (gap >= gapThreshold) {
      segments.push([curr]);
    } else {
      segments[segments.length - 1]!.push(curr);
    }
  }

  return segments;
}

/**
 * Segment a melody at detected pattern boundaries.
 * Uses `findPatterns` to locate repeating patterns and splits at their boundaries.
 *
 * @param events — Note events sorted by onset.
 * @returns Array of segments.
 */
export function segmentByPattern(events: NoteEvent[]): NoteEvent[][] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const patterns = findPatterns(sorted);

  if (patterns.length === 0) return [sorted];

  // Collect all pattern boundary indices
  const boundarySet = new Set<number>();
  for (const pattern of patterns) {
    for (const occ of pattern.occurrences) {
      boundarySet.add(occ);
      boundarySet.add(occ + pattern.length);
    }
  }

  const boundaries = [...boundarySet].filter(b => b > 0 && b < sorted.length).sort((a, b) => a - b);

  if (boundaries.length === 0) return [sorted];

  const segments: NoteEvent[][] = [];
  let start = 0;
  for (const boundary of boundaries) {
    if (boundary > start) {
      segments.push(sorted.slice(start, boundary));
      start = boundary;
    }
  }
  if (start < sorted.length) {
    segments.push(sorted.slice(start));
  }

  return segments;
}

/**
 * Compute an event density curve: the number of events per time window
 * sampled across the entire score.
 *
 * @param score — The score to analyze.
 * @param windowSize — Window size in ticks (default: ticksPerQuarter).
 * @param sampleInterval — Sample interval in ticks (default: windowSize).
 * @returns Array of {tick, value} points where value = event count in window.
 */
export function eventDensityCurve(
  score: Score,
  windowSize?: number,
  sampleInterval?: number,
): CurvePoint[] {
  const tpq = score.settings.ticksPerQuarter;
  const window = windowSize ?? tpq;
  const interval = sampleInterval ?? window;
  const allEvents = score.parts.flatMap(p => p.events);

  if (allEvents.length === 0) return [];

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const result: CurvePoint[] = [];

  for (let tick = 0; tick <= maxTick; tick += interval) {
    const count = allEvents.filter(
      e => e.onset >= tick - window / 2 && e.onset < tick + window / 2,
    ).length;

    result.push({ tick, value: count });
  }

  return result;
}

/**
 * Compute the registral envelope: the highest and lowest sounding pitch
 * over time, sampled at regular intervals.
 *
 * @param score — The score to analyze.
 * @param sampleInterval — Sample interval in ticks (default: ticksPerQuarter).
 * @returns Array of {tick, high, low} points. Points with no sounding events
 *   have high = 0 and low = 0.
 */
export function registralEnvelope(
  score: Score,
  sampleInterval?: number,
): EnvelopePoint[] {
  const tpq = score.settings.ticksPerQuarter;
  const interval = sampleInterval ?? tpq;
  const allEvents = score.parts.flatMap(p => p.events);

  if (allEvents.length === 0) return [];

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const result: EnvelopePoint[] = [];

  for (let tick = 0; tick <= maxTick; tick += interval) {
    const sounding = allEvents.filter(
      e => e.onset <= tick && e.onset + e.duration > tick,
    );

    if (sounding.length === 0) {
      result.push({ tick, high: 0, low: 0 });
    } else {
      let high = sounding[0]!.pitch.midi;
      let low = sounding[0]!.pitch.midi;
      for (const e of sounding) {
        if (e.pitch.midi > high) high = e.pitch.midi;
        if (e.pitch.midi < low) low = e.pitch.midi;
      }
      result.push({ tick, high, low });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Self-Similarity Matrix & Novelty Detection
// ---------------------------------------------------------------------------

/** A self-similarity matrix computed from windowed features. */
export interface SimilarityMatrix {
  /** Number of windows (N). */
  readonly size: number;
  /** N×N similarity values (0-1). */
  readonly data: readonly (readonly number[])[];
  /** Window size in ticks. */
  readonly windowSize: number;
  /** Hop size in ticks. */
  readonly hopSize: number;
}

/** A novelty score at a specific tick position. */
export interface NoveltyPoint {
  /** Tick position. */
  readonly tick: number;
  /** Novelty score. */
  readonly value: number;
}

/** Extracts a feature vector from a set of note events. */
export type FeatureExtractor = (events: readonly NoteEvent[]) => readonly number[];

/** A similarity metric that compares two feature vectors and returns a value in [0, 1]. */
export type SimilarityMetric = (a: readonly number[], b: readonly number[]) => number;

/**
 * Default feature extractor: 12-bin chroma vector (pitch-class histogram).
 *
 * @param events - Note events in a window.
 * @returns 12-element array of PC durations, normalized to sum to 1.
 */
export function chromaticFeature(events: readonly NoteEvent[]): readonly number[] {
  if (events.length === 0) {
    return Object.freeze(new Array<number>(12).fill(0));
  }
  const dist = pcDistribution(events, true);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += dist[i] ?? 0;
  }
  if (sum === 0) {
    return Object.freeze(dist);
  }
  const normalized: number[] = [];
  for (let i = 0; i < 12; i++) {
    normalized.push((dist[i] ?? 0) / sum);
  }
  return Object.freeze(normalized);
}

/** Cosine similarity between two vectors, clamped to [0, 1]. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Euclidean similarity between two vectors: 1 / (1 + euclidean_distance).
 * Returns a value in [0, 1] where 1 means identical.
 */
export function euclideanSimilarity(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return 1 / (1 + Math.sqrt(sum));
}

/**
 * Pearson correlation similarity: (r + 1) / 2 mapped to [0, 1].
 * Returns 0.5 for uncorrelated, 1 for perfectly correlated, 0 for perfectly anticorrelated.
 */
export function correlationSimilarity(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let sumA = 0, sumB = 0;
  for (let i = 0; i < len; i++) {
    sumA += a[i] ?? 0;
    sumB += b[i] ?? 0;
  }
  const meanA = sumA / len;
  const meanB = sumB / len;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < len; i++) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA) * Math.sqrt(varB);
  if (denom === 0) return 0.5; // undefined correlation → neutral
  const r = cov / denom;
  return (r + 1) / 2;
}

// ---------------------------------------------------------------------------
// Additional Feature Extractors
// ---------------------------------------------------------------------------

/**
 * 128-bin MIDI pitch histogram, duration-weighted and normalized to sum ≈ 1.
 *
 * @param events - Note events in a window.
 * @returns 128-element array of normalized durations per MIDI pitch.
 */
export function pitchHistogramFeature(events: readonly NoteEvent[]): readonly number[] {
  const bins = new Array<number>(128).fill(0);
  let total = 0;
  for (const e of events) {
    const midi = Math.max(0, Math.min(127, e.pitch.midi));
    bins[midi] = (bins[midi] ?? 0) + e.duration;
    total += e.duration;
  }
  if (total > 0) {
    for (let i = 0; i < 128; i++) {
      bins[i] = (bins[i] ?? 0) / total;
    }
  }
  return Object.freeze(bins);
}

/**
 * 16-bin inter-onset interval (IOI) ratio histogram, normalized.
 * Bins represent IOI ratios quantized to 16 levels from very short to very long.
 *
 * @param events - Note events in a window.
 * @returns 16-element array of normalized IOI counts.
 */
export function rhythmFeature(events: readonly NoteEvent[]): readonly number[] {
  const bins = new Array<number>(16).fill(0);
  if (events.length < 2) return Object.freeze(bins);

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  let total = 0;

  for (let i = 1; i < sorted.length; i++) {
    const ioi = sorted[i]!.onset - sorted[i - 1]!.onset;
    // Quantize IOI: bin 0 = 0 ticks, bin 15 = >= 7680 ticks (2 whole notes at 480 tpq)
    const bin = Math.min(15, Math.floor(ioi / 480));
    bins[bin] = (bins[bin] ?? 0) + 1;
    total++;
  }

  if (total > 0) {
    for (let i = 0; i < 16; i++) {
      bins[i] = (bins[i] ?? 0) / total;
    }
  }
  return Object.freeze(bins);
}

/**
 * 25-bin melodic interval histogram (-12 to +12 semitones), normalized.
 * Index 0 = -12, index 12 = 0 (repeat), index 24 = +12.
 *
 * @param events - Note events in a window.
 * @returns 25-element array of normalized interval counts.
 */
export function intervalFeature(events: readonly NoteEvent[]): readonly number[] {
  const bins = new Array<number>(25).fill(0);
  if (events.length < 2) return Object.freeze(bins);

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  let total = 0;

  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i]!.pitch.midi - sorted[i - 1]!.pitch.midi;
    // Clamp to [-12, +12] and map to [0, 24]
    const clamped = Math.max(-12, Math.min(12, interval));
    const bin = clamped + 12;
    bins[bin] = (bins[bin] ?? 0) + 1;
    total++;
  }

  if (total > 0) {
    for (let i = 0; i < 25; i++) {
      bins[i] = (bins[i] ?? 0) / total;
    }
  }
  return Object.freeze(bins);
}

/**
 * Combined feature vector: chroma(12) + rhythm(16) + interval(25) = 53 dimensions.
 *
 * @param events - Note events in a window.
 * @returns 53-element concatenated feature vector.
 */
export function combinedFeature(events: readonly NoteEvent[]): readonly number[] {
  const chroma = chromaticFeature(events);
  const rhythm = rhythmFeature(events);
  const interval = intervalFeature(events);
  const result: number[] = [];
  for (const v of chroma) result.push(v);
  for (const v of rhythm) result.push(v);
  for (const v of interval) result.push(v);
  return Object.freeze(result);
}

/**
 * Build a self-similarity matrix from a score.
 *
 * Divides the score into windows, extracts feature vectors, and computes
 * pairwise cosine similarity.
 *
 * @param score - The score to analyze.
 * @param windowSize - Window size in ticks.
 * @param hopSize - Hop between windows in ticks.
 * @param extractor - Feature extraction function (defaults to chromaticFeature).
 * @param metric - Similarity metric function (defaults to cosineSimilarity).
 * @returns Frozen SimilarityMatrix.
 * @throws {RangeError} If windowSize or hopSize is not positive.
 */
export function selfSimilarityMatrix(
  score: Score,
  windowSize: number,
  hopSize: number,
  extractor?: FeatureExtractor,
  metric?: SimilarityMetric,
): SimilarityMatrix {
  if (!Number.isFinite(windowSize) || windowSize <= 0) {
    throw new RangeError(`windowSize must be positive (got ${windowSize})`);
  }
  if (!Number.isFinite(hopSize) || hopSize <= 0) {
    throw new RangeError(`hopSize must be positive (got ${hopSize})`);
  }

  const extract = extractor ?? chromaticFeature;
  const sim = metric ?? cosineSimilarity;
  const allEvents = score.parts.flatMap(p => p.events);

  if (allEvents.length === 0) {
    return Object.freeze({
      size: 0,
      data: Object.freeze([]),
      windowSize,
      hopSize,
    });
  }

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));

  // Extract feature vectors per window
  const features: (readonly number[])[] = [];
  for (let start = 0; start < maxTick; start += hopSize) {
    const end = start + windowSize;
    const windowEvents = allEvents.filter(
      e => e.onset < end && e.onset + e.duration > start,
    );
    features.push(extract(windowEvents));
  }

  const n = features.length;

  // Compute pairwise similarity
  const data: (readonly number[])[] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(sim(features[i]!, features[j]!));
    }
    data.push(Object.freeze(row));
  }

  return Object.freeze({
    size: n,
    data: Object.freeze(data),
    windowSize,
    hopSize,
  });
}

/** Options for SSM post-processing enhancement. */
export interface EnhanceSSMOptions {
  /** Normalize each row to max=1 for transposition invariance. */
  readonly transpositionInvariant?: boolean;
  /** Diagonal kernel smoothing half-width for path enhancement. */
  readonly pathEnhance?: number;
  /** Zero out cells below this threshold. */
  readonly threshold?: number;
}

/**
 * Post-process a self-similarity matrix with optional enhancements.
 *
 * @param matrix - Input SimilarityMatrix.
 * @param options - Enhancement options.
 * @returns New frozen SimilarityMatrix with enhancements applied.
 */
export function enhanceSSM(
  matrix: SimilarityMatrix,
  options?: EnhanceSSMOptions,
): SimilarityMatrix {
  const n = matrix.size;
  if (n === 0) {
    return Object.freeze({
      size: 0,
      data: Object.freeze([]),
      windowSize: matrix.windowSize,
      hopSize: matrix.hopSize,
    });
  }

  // Copy data to mutable arrays
  let data: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const srcRow = matrix.data[i];
    for (let j = 0; j < n; j++) {
      row.push(srcRow ? (srcRow[j] ?? 0) : 0);
    }
    data.push(row);
  }

  // Transposition invariance: normalize each row to max=1
  if (options?.transpositionInvariant) {
    for (let i = 0; i < n; i++) {
      let maxVal = 0;
      for (let j = 0; j < n; j++) {
        const v = data[i]![j] ?? 0;
        if (v > maxVal) maxVal = v;
      }
      if (maxVal > 0) {
        for (let j = 0; j < n; j++) {
          data[i]![j] = (data[i]![j] ?? 0) / maxVal;
        }
      }
    }
  }

  // Path enhancement: diagonal kernel smoothing
  if (options?.pathEnhance !== undefined && options.pathEnhance > 0) {
    const L = Math.round(options.pathEnhance);
    const enhanced: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        let sum = 0;
        let count = 0;
        for (let k = -L; k <= L; k++) {
          const ri = i + k;
          const ci = j + k;
          if (ri >= 0 && ri < n && ci >= 0 && ci < n) {
            sum += data[ri]![ci] ?? 0;
            count++;
          }
        }
        row.push(count > 0 ? sum / count : 0);
      }
      enhanced.push(row);
    }
    data = enhanced;
  }

  // Thresholding: zero out cells below threshold
  if (options?.threshold !== undefined) {
    const thresh = options.threshold;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((data[i]![j] ?? 0) < thresh) {
          data[i]![j] = 0;
        }
      }
    }
  }

  // Freeze and return
  const frozenData: (readonly number[])[] = [];
  for (let i = 0; i < n; i++) {
    frozenData.push(Object.freeze(data[i]!));
  }

  return Object.freeze({
    size: n,
    data: Object.freeze(frozenData),
    windowSize: matrix.windowSize,
    hopSize: matrix.hopSize,
  });
}

/**
 * Detect novelty along the diagonal of a self-similarity matrix
 * using the Foote checkerboard kernel.
 *
 * @param ssm - A SimilarityMatrix.
 * @param kernelSize - Half-width of the checkerboard kernel (default: 4).
 * @returns Frozen array of NoveltyPoint along the diagonal.
 */
export function noveltyDetection(
  ssm: SimilarityMatrix,
  kernelSize: number = 4,
): readonly NoveltyPoint[] {
  const n = ssm.size;
  if (n === 0) return Object.freeze([]);

  const kSize = Math.max(1, Math.round(kernelSize));
  const result: NoveltyPoint[] = [];

  for (let pos = 0; pos < n; pos++) {
    let novelty = 0;
    for (let i = -kSize; i < kSize; i++) {
      for (let j = -kSize; j < kSize; j++) {
        const ri = pos + i;
        const ci = pos + j;
        if (ri < 0 || ri >= n || ci < 0 || ci >= n) continue;

        // Checkerboard: +1 if same quadrant (both above or both below center), -1 otherwise
        const sign = (i < 0) === (j < 0) ? 1 : -1;
        const row = ssm.data[ri];
        novelty += sign * (row ? (row[ci] ?? 0) : 0);
      }
    }
    result.push(Object.freeze({
      tick: pos * ssm.hopSize,
      value: Math.abs(novelty),
    }));
  }

  return Object.freeze(result);
}

/**
 * Find local maxima in a novelty curve that exceed a threshold.
 *
 * @param novelty - Novelty curve from noveltyDetection.
 * @param threshold - Minimum novelty value (default: mean + 1 stddev).
 * @returns Frozen array of peak NoveltyPoints.
 */
export function noveltyPeaks(
  novelty: readonly NoveltyPoint[],
  threshold?: number,
): readonly NoveltyPoint[] {
  if (novelty.length === 0) return Object.freeze([]);

  // Compute threshold if not provided
  let thresh = threshold;
  if (thresh === undefined) {
    let sum = 0;
    for (const p of novelty) {
      sum += p.value;
    }
    const mean = sum / novelty.length;
    let variance = 0;
    for (const p of novelty) {
      const diff = p.value - mean;
      variance += diff * diff;
    }
    variance /= novelty.length;
    thresh = mean + Math.sqrt(variance);
  }

  const peaks: NoveltyPoint[] = [];
  for (let i = 1; i < novelty.length - 1; i++) {
    const curr = novelty[i]!;
    const prev = novelty[i - 1]!;
    const next = novelty[i + 1]!;
    if (curr.value > prev.value && curr.value > next.value && curr.value >= thresh) {
      peaks.push(curr);
    }
  }

  return Object.freeze(peaks);
}

// ---------------------------------------------------------------------------
// Multi-Scale Novelty & Structural Boundary Detection
// ---------------------------------------------------------------------------

/** A structural boundary detected via novelty analysis. */
export interface StructuralBoundary {
  readonly tick: number;
  readonly confidence: number;  // 0-1, normalized novelty relative to max
}

/**
 * Combine novelty curves at multiple kernel sizes for robust boundary detection.
 * Averages normalized novelty values at each position across all kernel sizes.
 *
 * @param ssm - A SimilarityMatrix.
 * @param kernelSizes - Kernel half-widths to combine (default: [2, 4, 8, 16]).
 * @returns Frozen array of NoveltyPoint with averaged multi-scale values.
 */
export function multiScaleNovelty(
  ssm: SimilarityMatrix,
  kernelSizes?: readonly number[],
): readonly NoveltyPoint[] {
  if (ssm.size === 0) return Object.freeze([]);

  const sizes = kernelSizes ?? [2, 4, 8, 16];
  if (sizes.length === 0) return Object.freeze([]);

  // Compute novelty curve at each scale
  const curves: (readonly NoveltyPoint[])[] = [];
  for (const k of sizes) {
    curves.push(noveltyDetection(ssm, k));
  }

  // Find length (should all be equal = ssm.size)
  const len = curves[0]!.length;

  // Normalize each curve to [0,1] then average
  const normalizedSums = new Array<number>(len).fill(0);
  for (const curve of curves) {
    let maxVal = 0;
    for (const p of curve) {
      if (p.value > maxVal) maxVal = p.value;
    }
    const scale = maxVal > 0 ? 1 / maxVal : 0;
    for (let i = 0; i < curve.length; i++) {
      normalizedSums[i] = (normalizedSums[i] ?? 0) + (curve[i]?.value ?? 0) * scale;
    }
  }

  const numScales = curves.length;
  const result: NoveltyPoint[] = [];
  for (let i = 0; i < len; i++) {
    result.push(Object.freeze({
      tick: curves[0]![i]!.tick,
      value: (normalizedSums[i] ?? 0) / numScales,
    }));
  }

  return Object.freeze(result);
}

/**
 * High-level structural boundary detection pipeline.
 * Computes SSM → multi-scale novelty → peak picking → confidence-scored boundaries.
 *
 * @param score - The score to analyze.
 * @param options - Optional parameters.
 * @returns Frozen array of StructuralBoundary with confidence scores.
 */
export function findStructuralBoundaries(
  score: Score,
  options?: {
    windowSize?: number;
    hopSize?: number;
    kernelSizes?: readonly number[];
    threshold?: number;
    extractor?: FeatureExtractor;
  },
): readonly StructuralBoundary[] {
  const tpq = score.settings.ticksPerQuarter;
  const windowSize = options?.windowSize ?? tpq * 4;
  const hopSize = options?.hopSize ?? tpq;
  const kernelSizes = options?.kernelSizes;
  const threshold = options?.threshold;
  const extractor = options?.extractor;

  const ssm = selfSimilarityMatrix(score, windowSize, hopSize, extractor);
  if (ssm.size === 0) return Object.freeze([]);

  const novelty = multiScaleNovelty(ssm, kernelSizes);
  const peaks = noveltyPeaks(novelty, threshold);

  if (peaks.length === 0) return Object.freeze([]);

  // Find max value for confidence normalization
  let maxValue = 0;
  for (const p of peaks) {
    if (p.value > maxValue) maxValue = p.value;
  }

  const boundaries: StructuralBoundary[] = [];
  for (const p of peaks) {
    boundaries.push(Object.freeze({
      tick: p.tick,
      confidence: maxValue > 0 ? p.value / maxValue : 0,
    }));
  }

  return Object.freeze(boundaries);
}
