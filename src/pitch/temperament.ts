// ---------------------------------------------------------------------------
// Stratum — Rank-2 Temperaments, MOS Scales, and Val Computation
// ---------------------------------------------------------------------------

import { ratioToCents } from './cents.js';
import type { Monzo } from './monzo.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A rank-2 regular temperament defined by period and generator in cents. */
export interface Rank2Temperament {
  readonly name: string;
  /** Period in cents (usually 1200 for octave-based temperaments). */
  readonly period: number;
  /** Generator in cents. */
  readonly generator: number;
}

/** Mapping from JI primes to tempered steps (patent val). */
export type Val = readonly number[];

/** An entry in the MOS tree. */
export interface MosEntry {
  readonly size: number;
  readonly pattern: string;
  readonly scale: readonly number[];
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as const;

function primesUpTo(limit: number): readonly number[] {
  return PRIMES.filter(p => p <= limit);
}

// ---------------------------------------------------------------------------
// MOS Scale Functions
// ---------------------------------------------------------------------------

/**
 * Generate a Moment of Symmetry (MOS) scale by stacking a generator.
 *
 * @param period - Period in cents (e.g. 1200).
 * @param generator - Generator in cents.
 * @param size - Number of notes (excluding the closing period).
 * @returns Sorted scale from 0 to period (inclusive), frozen.
 * @throws {RangeError} If period/generator are not positive/finite, or size < 2.
 *
 * @example
 * ```ts
 * mosScale(1200, 700, 7); // [0, 100, 200, 400, 500, 700, 900, 1200] — close to diatonic
 * ```
 */
export function mosScale(
  period: number,
  generator: number,
  size: number,
): readonly number[] {
  if (!Number.isFinite(period) || period <= 0) {
    throw new RangeError(`Period must be positive (got ${period})`);
  }
  if (!Number.isFinite(generator)) {
    throw new RangeError(`Generator must be finite (got ${generator})`);
  }
  if (!Number.isInteger(size) || size < 2) {
    throw new RangeError(`Size must be an integer >= 2 (got ${size})`);
  }

  const notes: number[] = [];
  for (let i = 0; i < size; i++) {
    notes.push(((i * generator) % period + period) % period);
  }
  notes.sort((a, b) => a - b);

  // Prepend 0 if not already present and append period
  const TOL = 0.001;
  if (notes.length === 0 || (notes[0] ?? 0) > TOL) {
    notes.unshift(0);
  }
  notes.push(period);

  return Object.freeze(notes);
}

/**
 * Compute the step pattern string for a MOS scale (e.g. "5L 2s").
 *
 * @param period - Period in cents.
 * @param generator - Generator in cents.
 * @param size - Number of notes.
 * @returns Pattern string like "5L 2s".
 * @throws {RangeError} If inputs are invalid.
 */
export function mosStepPattern(
  period: number,
  generator: number,
  size: number,
): string {
  const scale = mosScale(period, generator, size);
  const steps: number[] = [];
  for (let i = 1; i < scale.length; i++) {
    steps.push((scale[i] ?? 0) - (scale[i - 1] ?? 0));
  }

  // Group steps by size with tolerance
  const TOL = 0.01;
  const groups = new Map<number, number>();
  for (const s of steps) {
    let found = false;
    for (const [key, count] of groups) {
      if (Math.abs(s - key) < TOL) {
        groups.set(key, count + 1);
        found = true;
        break;
      }
    }
    if (!found) {
      groups.set(s, 1);
    }
  }

  // Sort groups by step size (descending: L first, s second)
  const sorted = [...groups.entries()].sort((a, b) => b[0] - a[0]);
  const labels = ['L', 's', 'm'];
  return sorted
    .map(([, count], i) => `${count}${labels[i] ?? `x${i}`}`)
    .join(' ');
}

/**
 * Test whether a scale has exactly 2 distinct step sizes (MOS property).
 *
 * @param scale - Ascending scale in cents (first element should be 0, last the period).
 * @returns True if exactly 2 distinct step sizes exist.
 */
export function isMos(scale: readonly number[]): boolean {
  if (scale.length < 3) return false;

  const steps: number[] = [];
  for (let i = 1; i < scale.length; i++) {
    steps.push((scale[i] ?? 0) - (scale[i - 1] ?? 0));
  }

  const TOL = 0.01;
  const distinct: number[] = [];
  for (const s of steps) {
    if (!distinct.some(d => Math.abs(d - s) < TOL)) {
      distinct.push(s);
    }
  }

  return distinct.length === 2;
}

/**
 * Generate a MOS tree: all valid MOS sizes from 2 to maxSize.
 *
 * @param period - Period in cents.
 * @param generator - Generator in cents.
 * @param maxSize - Maximum number of notes to try (default 12).
 * @returns Frozen array of MOS entries.
 */
export function mosTree(
  period: number,
  generator: number,
  maxSize = 12,
): readonly MosEntry[] {
  const entries: MosEntry[] = [];
  for (let n = 2; n <= maxSize; n++) {
    const scale = mosScale(period, generator, n);
    if (isMos(scale)) {
      entries.push(
        Object.freeze({
          size: n,
          pattern: mosStepPattern(period, generator, n),
          scale,
        }),
      );
    }
  }
  return Object.freeze(entries);
}

// ---------------------------------------------------------------------------
// Val Functions
// ---------------------------------------------------------------------------

/**
 * Compute the patent val for an EDO.
 *
 * The patent val maps each prime to the nearest integer number of EDO steps.
 *
 * @param divisions - Number of equal divisions of the octave.
 * @param primeLimit - Highest prime to include (default 7).
 * @returns Frozen val.
 * @throws {RangeError} If divisions < 1.
 *
 * @example
 * ```ts
 * patentVal(12, 7);  // [12, 19, 28, 34]
 * patentVal(19, 7);  // [19, 30, 44, 53]
 * ```
 */
export function patentVal(divisions: number, primeLimit = 7): Val {
  if (!Number.isInteger(divisions) || divisions < 1) {
    throw new RangeError(`Divisions must be a positive integer (got ${divisions})`);
  }

  const primes = primesUpTo(primeLimit);
  const val = primes.map(p => Math.round(divisions * Math.log2(p)));
  return Object.freeze(val);
}

/**
 * Apply a val mapping to a monzo (dot product).
 *
 * @param val - The val (tempered step mapping).
 * @param monzo - The monzo (prime exponent vector).
 * @returns Number of tempered steps.
 */
export function valMapping(val: Val, monzo: Monzo): number {
  const len = Math.min(val.length, monzo.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += (val[i] ?? 0) * (monzo[i] ?? 0);
  }
  return sum;
}

/**
 * Compute the temperament error (RMS) of a val in cents.
 *
 * Measures how far the tempered primes deviate from their JI values.
 *
 * @param val - The val to evaluate.
 * @param primeLimit - Highest prime to include (default 7).
 * @returns RMS error in cents.
 * @throws {RangeError} If val is empty or val[0] is zero.
 */
export function temperamentError(val: Val, primeLimit = 7): number {
  if (val.length === 0) {
    throw new RangeError('Val must not be empty');
  }
  const octaveSteps = val[0] ?? 0;
  if (octaveSteps === 0) {
    throw new RangeError('Val must map the octave to > 0 steps');
  }

  const primes = primesUpTo(primeLimit);
  const len = Math.min(val.length, primes.length);
  let sumSq = 0;
  let count = 0;

  for (let i = 1; i < len; i++) {
    const temperedCents = ((val[i] ?? 0) * 1200) / octaveSteps;
    const trueCents = ratioToCents(primes[i] ?? 2);
    const error = temperedCents - trueCents;
    sumSq += error * error;
    count++;
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0;
}

/**
 * Check if a val is "badly broken" — maps any prime to ≤ 0, or maps 3/2 to ≤ 0 steps.
 *
 * @param val - The val to check.
 * @returns True if badly broken.
 */
export function isBadlyBroken(val: Val): boolean {
  // Check each prime mapping is > 0
  for (const v of val) {
    if (v <= 0) return true;
  }

  // Check 3/2 maps to positive steps: val(3/2) = val[1] - val[0]
  if (val.length >= 2) {
    const fifthSteps = (val[1] ?? 0) - (val[0] ?? 0);
    if (fifthSteps <= 0) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Quarter-comma meantone: pure major thirds (5/4). */
export const MEANTONE: Rank2Temperament = Object.freeze({
  name: 'Meantone',
  period: 1200,
  generator: 696.578,
});

/** Superpyth: wide fifths for better 7-limit. */
export const SUPERPYTH: Rank2Temperament = Object.freeze({
  name: 'Superpyth',
  period: 1200,
  generator: 710.5,
});

/** Flattone: narrower fifths than meantone. */
export const FLATTONE: Rank2Temperament = Object.freeze({
  name: 'Flattone',
  period: 1200,
  generator: 693.6,
});

/** Mavila: generator ≈ 4/3 inverted (anti-diatonic). */
export const MAVILA: Rank2Temperament = Object.freeze({
  name: 'Mavila',
  period: 1200,
  generator: 521.5,
});
