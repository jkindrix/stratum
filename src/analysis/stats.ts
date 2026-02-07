// ---------------------------------------------------------------------------
// Stratum — Statistical Analysis (Entropy, Zipf, Markov, Distributions)
// ---------------------------------------------------------------------------

import type { NoteEvent, Score } from '../core/types.js';
import { harmonicRhythm } from './harmonic.js';

/** Markov chain built from pitch-class transitions. */
export interface MarkovChain {
  /** Unique pitch-class states observed. */
  readonly states: readonly number[];
  /** Transition probability matrix (row = from state, col = to state). */
  readonly matrix: readonly (readonly number[])[];
  /** Markov order (1 = first-order). */
  readonly order: number;
}

/** Style fingerprint combining multiple statistical features. */
export interface StyleFingerprint {
  /** 12-element normalized pitch-class histogram (sums to 1.0). */
  readonly pitchDistribution: readonly number[];
  /** Signed MIDI interval → frequency count. */
  readonly intervalDistribution: ReadonlyMap<number, number>;
  /** Duration value → frequency count. */
  readonly durationDistribution: ReadonlyMap<number, number>;
  /** Shannon entropy of pitch-class distribution (bits). */
  readonly pitchEntropy: number;
  /** Entropy of inter-onset interval distribution (bits). */
  readonly rhythmicEntropy: number;
  /** Zipf exponent from pitch-class rank-frequency distribution. */
  readonly zipfExponent: number;
}

/** Rank-frequency distribution result. */
export interface ZipfResult {
  /** Items ranked by frequency (descending). */
  readonly ranks: readonly {
    readonly item: number;
    readonly count: number;
    readonly rank: number;
  }[];
  /** Log-log regression slope (Zipf exponent). */
  readonly exponent: number;
}

// ---- Internal helpers ----

function validateEvents(events: readonly NoteEvent[]): void {
  if (events.length === 0) {
    throw new RangeError('events array must not be empty');
  }
}

function log2Safe(x: number): number {
  return x > 0 ? Math.log2(x) : 0;
}

/** Least-squares slope of log(x) vs log(y). */
function logLogSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const lx: number[] = [];
  const ly: number[] = [];
  for (let i = 0; i < n; i++) {
    if ((xs[i] ?? 0) > 0 && (ys[i] ?? 0) > 0) {
      lx.push(Math.log((xs[i] ?? 1)));
      ly.push(Math.log((ys[i] ?? 1)));
    }
  }

  if (lx.length < 2) return 0;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < lx.length; i++) {
    sumX += lx[i] ?? 0;
    sumY += ly[i] ?? 0;
  }
  const meanX = sumX / lx.length;
  const meanY = sumY / lx.length;

  let num = 0, den = 0;
  for (let i = 0; i < lx.length; i++) {
    const dx = (lx[i] ?? 0) - meanX;
    const dy = (ly[i] ?? 0) - meanY;
    num += dx * dy;
    den += dx * dx;
  }

  return den === 0 ? 0 : num / den;
}

// ---- Public API ----

/**
 * Shannon entropy of the pitch-class distribution.
 *
 * H = -Σ p(x) log2 p(x), where p(x) is the relative frequency of each PC.
 *
 * @param events - Note events to analyze.
 * @returns Entropy in bits (0 = uniform single PC, max ≈ log2(12) ≈ 3.585).
 * @throws {RangeError} If events is empty.
 */
export function shannonEntropy(events: readonly NoteEvent[]): number {
  validateEvents(events);

  const counts = new Array<number>(12).fill(0);
  for (const e of events) {
    counts[e.pitch.pitchClass] = (counts[e.pitch.pitchClass] ?? 0) + 1;
  }

  const total = events.length;
  let entropy = 0;
  for (let i = 0; i < 12; i++) {
    const p = (counts[i] ?? 0) / total;
    if (p > 0) {
      entropy -= p * log2Safe(p);
    }
  }

  return entropy;
}

/**
 * Entropy of the inter-onset interval (IOI) distribution.
 *
 * Sorts events by onset, computes IOIs, optionally quantizes them,
 * and returns Shannon entropy of the resulting distribution.
 *
 * @param events - Note events to analyze.
 * @param quantize - Optional quantization grid in ticks (IOIs are rounded to nearest multiple).
 * @returns Entropy in bits.
 * @throws {RangeError} If events is empty.
 */
export function rhythmicEntropy(events: readonly NoteEvent[], quantize?: number): number {
  validateEvents(events);

  if (events.length < 2) return 0;

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const iois: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    let ioi = sorted[i]!.onset - sorted[i - 1]!.onset;
    if (quantize && quantize > 0) {
      ioi = Math.round(ioi / quantize) * quantize;
    }
    iois.push(ioi);
  }

  // Count IOI frequencies
  const counts = new Map<number, number>();
  for (const ioi of iois) {
    counts.set(ioi, (counts.get(ioi) ?? 0) + 1);
  }

  const total = iois.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * log2Safe(p);
    }
  }

  return entropy;
}

/**
 * Zipf rank-frequency distribution of pitch classes.
 *
 * Ranks PCs by descending frequency and fits a log-log regression
 * to compute the Zipf exponent.
 *
 * @param events - Note events to analyze.
 * @returns ZipfResult with ranks and fitted exponent.
 * @throws {RangeError} If events is empty.
 */
export function zipfDistribution(events: readonly NoteEvent[]): ZipfResult {
  validateEvents(events);

  const counts = new Array<number>(12).fill(0);
  for (const e of events) {
    counts[e.pitch.pitchClass] = (counts[e.pitch.pitchClass] ?? 0) + 1;
  }

  // Build ranked list (only PCs that appear)
  const items: { item: number; count: number }[] = [];
  for (let pc = 0; pc < 12; pc++) {
    if ((counts[pc] ?? 0) > 0) {
      items.push({ item: pc, count: counts[pc] ?? 0 });
    }
  }

  items.sort((a, b) => b.count - a.count);

  const ranks = items.map((it, idx) =>
    Object.freeze({ item: it.item, count: it.count, rank: idx + 1 }),
  );

  // Fit Zipf exponent via log-log regression
  const xs = ranks.map(r => r.rank);
  const ys = ranks.map(r => r.count);
  const exponent = -logLogSlope(xs, ys); // negate: Zipf law expects negative slope

  return Object.freeze({ ranks: Object.freeze(ranks), exponent });
}

/**
 * Build a Markov transition matrix from pitch-class successions.
 *
 * @param events - Note events (sorted by onset internally).
 * @param order - Markov order (default: 1). Only order 1 is currently supported.
 * @returns Frozen MarkovChain with states and transition probabilities.
 * @throws {RangeError} If events is empty or order < 1.
 */
export function markovTransition(
  events: readonly NoteEvent[],
  order: number = 1,
): MarkovChain {
  validateEvents(events);
  if (!Number.isInteger(order) || order < 1) {
    throw new RangeError(`order must be a positive integer (got ${order})`);
  }

  const sorted = [...events].sort((a, b) => a.onset - b.onset);

  // Collect unique states
  const stateSet = new Set<number>();
  for (const e of sorted) {
    stateSet.add(e.pitch.pitchClass);
  }
  const states = [...stateSet].sort((a, b) => a - b);
  const stateIndex = new Map<number, number>();
  for (let i = 0; i < states.length; i++) {
    stateIndex.set(states[i]!, i);
  }

  const n = states.length;
  // Build count matrix
  const counts: number[][] = [];
  for (let i = 0; i < n; i++) {
    counts.push(new Array<number>(n).fill(0));
  }

  for (let i = order; i < sorted.length; i++) {
    const fromPc = sorted[i - order]!.pitch.pitchClass;
    const toPc = sorted[i]!.pitch.pitchClass;
    const fromIdx = stateIndex.get(fromPc);
    const toIdx = stateIndex.get(toPc);
    if (fromIdx !== undefined && toIdx !== undefined) {
      counts[fromIdx]![toIdx] = (counts[fromIdx]![toIdx] ?? 0) + 1;
    }
  }

  // Normalize rows to probabilities
  const matrix: (readonly number[])[] = [];
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += counts[i]![j] ?? 0;
    }
    if (rowSum === 0) {
      matrix.push(Object.freeze(new Array<number>(n).fill(0)));
    } else {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        row.push((counts[i]![j] ?? 0) / rowSum);
      }
      matrix.push(Object.freeze(row));
    }
  }

  return Object.freeze({
    states: Object.freeze(states),
    matrix: Object.freeze(matrix),
    order,
  });
}

/**
 * Generate a stochastic pitch-class sequence from a Markov chain.
 *
 * @param chain - A MarkovChain.
 * @param startPc - Starting pitch class.
 * @param length - Number of PCs to generate.
 * @param rng - Optional random number generator (returns [0,1)). Defaults to Math.random.
 * @param temperature - Optional temperature scaling (default 1.0).
 *   T > 1.0 → more uniform (exploratory).
 *   T < 1.0 → more peaked (conservative).
 *   T = 1.0 → unchanged.
 * @returns Frozen array of generated pitch classes.
 * @throws {RangeError} If startPc is not in the chain's states, length < 1, or temperature ≤ 0.
 */
export function markovGenerate(
  chain: MarkovChain,
  startPc: number,
  length: number,
  rng?: () => number,
  temperature?: number,
): readonly number[] {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`length must be a positive integer (got ${length})`);
  }
  if (temperature !== undefined && (typeof temperature !== 'number' || temperature <= 0)) {
    throw new RangeError(`temperature must be > 0 (got ${temperature})`);
  }

  const stateIndex = new Map<number, number>();
  for (let i = 0; i < chain.states.length; i++) {
    stateIndex.set(chain.states[i]!, i);
  }

  const startIdx = stateIndex.get(startPc);
  if (startIdx === undefined) {
    throw new RangeError(`startPc ${startPc} is not in the chain's states`);
  }

  const random = rng ?? Math.random;
  const temp = temperature ?? 1.0;
  const result: number[] = [startPc];
  let currentIdx = startIdx;

  for (let step = 1; step < length; step++) {
    const row = chain.matrix[currentIdx]!;

    // Apply temperature scaling: p_i' = p_i^(1/T) / Σ(p_j^(1/T))
    let scaledRow: number[];
    if (temp === 1.0) {
      scaledRow = row as unknown as number[];
    } else {
      const invT = 1.0 / temp;
      scaledRow = [];
      let sum = 0;
      for (let j = 0; j < row.length; j++) {
        const v = Math.pow(row[j] ?? 0, invT);
        scaledRow.push(v);
        sum += v;
      }
      if (sum > 0) {
        for (let j = 0; j < scaledRow.length; j++) {
          scaledRow[j] = (scaledRow[j] ?? 0) / sum;
        }
      }
    }

    const r = random();
    let cumulative = 0;
    let nextIdx = 0;
    for (let j = 0; j < scaledRow.length; j++) {
      cumulative += scaledRow[j] ?? 0;
      if (r < cumulative) {
        nextIdx = j;
        break;
      }
      // If we haven't broken, pick the last state
      nextIdx = j;
    }
    result.push(chain.states[nextIdx] ?? 0);
    currentIdx = nextIdx;
  }

  return Object.freeze(result);
}

/**
 * Count n-grams of pitch-class sequences.
 *
 * @param events - Note events (sorted by onset internally).
 * @param n - N-gram size (>= 1).
 * @returns ReadonlyMap from n-gram string keys (e.g., "0,4,7") to counts.
 * @throws {RangeError} If events is empty or n < 1.
 */
export function ngramCounts(
  events: readonly NoteEvent[],
  n: number,
): ReadonlyMap<string, number> {
  validateEvents(events);
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`n must be a positive integer (got ${n})`);
  }

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const pcs = sorted.map(e => e.pitch.pitchClass);

  const counts = new Map<string, number>();
  for (let i = 0; i <= pcs.length - n; i++) {
    const gram = pcs.slice(i, i + n).join(',');
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  return counts;
}

/**
 * Normalized pitch-class frequency distribution.
 *
 * Returns a 12-element array where each index corresponds to a pitch class
 * (0 = C, 1 = C#, … 11 = B). Values sum to 1.0.
 *
 * @param events - Note events to analyze.
 * @returns Frozen 12-element array of normalized frequencies.
 * @throws {RangeError} If events is empty.
 */
export function pitchDistribution(events: readonly NoteEvent[]): readonly number[] {
  validateEvents(events);

  const counts = new Array<number>(12).fill(0);
  for (const e of events) {
    counts[e.pitch.pitchClass] = (counts[e.pitch.pitchClass] ?? 0) + 1;
  }

  const total = events.length;
  const dist: number[] = [];
  for (let i = 0; i < 12; i++) {
    dist.push((counts[i] ?? 0) / total);
  }

  return Object.freeze(dist);
}

/**
 * Distribution of signed melodic intervals between successive notes.
 *
 * Events are sorted by onset; the signed MIDI interval (next.midi - prev.midi)
 * between each consecutive pair is counted.
 *
 * @param events - Note events to analyze.
 * @returns ReadonlyMap from signed interval to count.
 * @throws {RangeError} If events is empty.
 */
export function intervalDistribution(events: readonly NoteEvent[]): ReadonlyMap<number, number> {
  validateEvents(events);

  if (events.length < 2) return new Map<number, number>();

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const counts = new Map<number, number>();
  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i]!.pitch.midi - sorted[i - 1]!.pitch.midi;
    counts.set(interval, (counts.get(interval) ?? 0) + 1);
  }

  return counts;
}

/**
 * Distribution of note duration values.
 *
 * Counts the frequency of each distinct duration value in the event set.
 *
 * @param events - Note events to analyze.
 * @returns ReadonlyMap from duration to count.
 * @throws {RangeError} If events is empty.
 */
export function durationDistribution(events: readonly NoteEvent[]): ReadonlyMap<number, number> {
  validateEvents(events);

  const counts = new Map<number, number>();
  for (const e of events) {
    counts.set(e.duration, (counts.get(e.duration) ?? 0) + 1);
  }

  return counts;
}

/**
 * Distribution of chord types across a score.
 *
 * Uses {@link harmonicRhythm} to sample chords at regular intervals,
 * then counts occurrences of each chord symbol.
 *
 * @param score - The score to analyze.
 * @param windowSize - Sample interval in ticks (default: ticksPerQuarter).
 * @returns ReadonlyMap from chord symbol (e.g. "Cmaj") to count.
 */
export function chordTypeDistribution(
  score: Score,
  windowSize?: number,
): ReadonlyMap<string, number> {
  const events = harmonicRhythm(score, windowSize);
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event.label) {
      const key = event.label.symbol;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Compute a multi-dimensional style fingerprint from note events.
 *
 * Combines pitch distribution, interval distribution, duration distribution,
 * Shannon entropy, rhythmic entropy, and Zipf exponent into a single object.
 *
 * @param events - Note events to analyze.
 * @returns Frozen StyleFingerprint.
 * @throws {RangeError} If events is empty.
 */
export function styleFingerprint(events: readonly NoteEvent[]): StyleFingerprint {
  validateEvents(events);

  const pd = pitchDistribution(events);
  const id = intervalDistribution(events);
  const dd = durationDistribution(events);
  const pe = shannonEntropy(events);
  const re = rhythmicEntropy(events);
  const zd = zipfDistribution(events);

  return Object.freeze({
    pitchDistribution: pd,
    intervalDistribution: id,
    durationDistribution: dd,
    pitchEntropy: pe,
    rhythmicEntropy: re,
    zipfExponent: zd.exponent,
  });
}

/**
 * Cosine similarity between two style fingerprints.
 *
 * Compares the 12-dimensional pitch distribution vectors.
 * Returns a value in [0, 1] where 1 means identical distributions.
 *
 * @param a - First style fingerprint.
 * @param b - Second style fingerprint.
 * @returns Cosine similarity in [0, 1].
 */
export function styleSimilarity(a: StyleFingerprint, b: StyleFingerprint): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < 12; i++) {
    const va = a.pitchDistribution[i] ?? 0;
    const vb = b.pitchDistribution[i] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;

  return dot / denom;
}
