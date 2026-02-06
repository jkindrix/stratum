// ---------------------------------------------------------------------------
// Stratum — Tonal Interval Vectors via DFT
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

/**
 * A Tonal Interval Vector: 6 complex DFT coefficients representing
 * harmonic properties of a pitch-class distribution.
 */
export interface TonalIntervalVector {
  /** The 6 complex DFT coefficients as [real, imaginary] pairs. */
  readonly coefficients: readonly (readonly [number, number])[];
  /** Magnitudes of the 6 coefficients. */
  readonly magnitudes: readonly number[];
  /** Total magnitude (Euclidean norm of the TIV). */
  readonly energy: number;
}

/**
 * Named DFT coefficient indices and their musical interpretations.
 */
export interface DFTComponents {
  /** f1: chromaticity — semitone-related content. */
  readonly chromaticity: number;
  /** f2: diadicity — whole-tone and tritone content. */
  readonly diadicity: number;
  /** f3: triadicity — augmented triad / major-third content. */
  readonly triadicity: number;
  /** f4: octatonicity — minor-third / diminished content. */
  readonly octatonicity: number;
  /** f5: diatonicity — diatonic / perfect-fourth content. */
  readonly diatonicity: number;
  /** f6: whole-tone quality — tritone opposition. */
  readonly wholeTone: number;
}

// ---- Public API ----

/**
 * Compute a 12-element pitch-class distribution (chroma vector) from note events.
 * Each bin accumulates the total duration of events with that pitch class.
 *
 * @param events - Note events to analyze.
 * @returns 12-element array where index i = total duration of pitch class i.
 *
 * @example
 * ```ts
 * const chroma = chromaVector(score.parts[0].events);
 * // chroma[0] = total duration of all C notes
 * ```
 */
export function chromaVector(events: readonly NoteEvent[]): number[] {
  const chroma = new Array<number>(12).fill(0);
  for (const e of events) {
    chroma[e.pitch.pitchClass] = (chroma[e.pitch.pitchClass] ?? 0) + e.duration;
  }
  return chroma;
}

/**
 * Compute the Tonal Interval Vector from a 12-element chroma distribution.
 *
 * Applies a 12-point DFT and returns the 6 unique complex coefficients
 * (f1 through f6; f0 is the DC component / total energy, excluded).
 *
 * @param chroma - 12-element pitch-class distribution (non-negative values).
 * @returns TonalIntervalVector with coefficients, magnitudes, and total energy.
 * @throws {Error} If chroma is not a 12-element array.
 *
 * @example
 * ```ts
 * const cMajor = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // C major scale
 * const v = tiv(cMajor);
 * console.log(v.magnitudes); // [f1..f6 magnitudes]
 * ```
 */
export function tiv(chroma: readonly number[]): TonalIntervalVector {
  if (chroma.length !== 12) {
    throw new RangeError(`chroma must have 12 elements (got ${chroma.length})`);
  }
  for (let i = 0; i < 12; i++) {
    const v = chroma[i]!;
    if (!Number.isFinite(v) || v < 0) {
      throw new RangeError(`chroma values must be finite and non-negative (got ${v} at index ${i})`);
    }
  }

  const coefficients: [number, number][] = [];
  const magnitudes: number[] = [];

  // Compute DFT coefficients f1 through f6
  for (let k = 1; k <= 6; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < 12; n++) {
      const angle = (2 * Math.PI * k * n) / 12;
      re += chroma[n]! * Math.cos(angle);
      im -= chroma[n]! * Math.sin(angle);
    }
    coefficients.push([re, im]);
    magnitudes.push(Math.sqrt(re * re + im * im));
  }

  // Total energy = Euclidean norm of all magnitudes
  let energySq = 0;
  for (const m of magnitudes) {
    energySq += m * m;
  }
  const energy = Math.sqrt(energySq);

  return {
    coefficients: Object.freeze(coefficients.map(c => Object.freeze(c) as readonly [number, number])),
    magnitudes: Object.freeze(magnitudes),
    energy,
  };
}

/**
 * Euclidean distance between two Tonal Interval Vectors.
 * Measures harmonic dissimilarity: larger distance = more different.
 *
 * @param a - First TIV.
 * @param b - Second TIV.
 * @returns Non-negative Euclidean distance.
 *
 * @example
 * ```ts
 * const cMaj = tiv([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]);
 * const cMin = tiv([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0]);
 * tivDistance(cMaj, cMin); // moderate distance
 * ```
 */
export function tivDistance(a: TonalIntervalVector, b: TonalIntervalVector): number {
  let sumSq = 0;
  for (let i = 0; i < 6; i++) {
    const dRe = a.coefficients[i]![0] - b.coefficients[i]![0];
    const dIm = a.coefficients[i]![1] - b.coefficients[i]![1];
    sumSq += dRe * dRe + dIm * dIm;
  }
  return Math.sqrt(sumSq);
}

/**
 * TIV-based consonance measure.
 * Returns the total magnitude (energy) of the TIV, which correlates
 * with the perceptual consonance of the pitch-class distribution.
 * Higher energy = more tonal / consonant.
 *
 * @param chroma - 12-element pitch-class distribution.
 * @returns Non-negative consonance value.
 *
 * @example
 * ```ts
 * const majorTriad = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]; // C-E-G
 * const cluster = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];     // C-C#-D
 * tivConsonance(majorTriad) > tivConsonance(cluster); // true
 * ```
 */
export function tivConsonance(chroma: readonly number[]): number {
  return tiv(chroma).energy;
}

/**
 * Individual DFT coefficient magnitudes with musical interpretations.
 *
 * Each coefficient captures a specific type of intervallic content:
 * - f1: chromaticity (semitone relations)
 * - f2: diadicity (whole-tone, tritone)
 * - f3: triadicity (augmented triad, major thirds)
 * - f4: octatonicity (minor thirds, diminished)
 * - f5: diatonicity (perfect fourths/fifths, diatonic content)
 * - f6: whole-tone quality (tritone opposition)
 *
 * @param chroma - 12-element pitch-class distribution.
 * @returns Named DFT component magnitudes.
 * @throws {Error} If chroma is not a 12-element array.
 *
 * @example
 * ```ts
 * const cMajorScale = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
 * const components = dftCoefficients(cMajorScale);
 * // components.diatonicity will be high (strong diatonic content)
 * ```
 */
export function dftCoefficients(chroma: readonly number[]): DFTComponents {
  const v = tiv(chroma);
  return {
    chromaticity: v.magnitudes[0]!,
    diadicity: v.magnitudes[1]!,
    triadicity: v.magnitudes[2]!,
    octatonicity: v.magnitudes[3]!,
    diatonicity: v.magnitudes[4]!,
    wholeTone: v.magnitudes[5]!,
  };
}
