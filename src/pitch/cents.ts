// ---------------------------------------------------------------------------
// Stratum — Cent, Ratio, and EDO Step Conversion Utilities
// ---------------------------------------------------------------------------

/**
 * Compute the interval size in cents between two frequencies.
 *
 * @param freqA - First frequency in Hz (> 0).
 * @param freqB - Second frequency in Hz (> 0).
 * @returns Interval in cents. Positive if freqB > freqA.
 * @throws {RangeError} If either frequency is not positive and finite.
 *
 * @example
 * ```ts
 * centsBetween(440, 880); // 1200 (one octave)
 * centsBetween(440, 660); // ~701.955 (perfect fifth in JI)
 * ```
 */
export function centsBetween(freqA: number, freqB: number): number {
  if (!Number.isFinite(freqA) || freqA <= 0) {
    throw new RangeError(`freqA must be positive (got ${freqA})`);
  }
  if (!Number.isFinite(freqB) || freqB <= 0) {
    throw new RangeError(`freqB must be positive (got ${freqB})`);
  }
  return 1200 * Math.log2(freqB / freqA);
}

/**
 * Convert an interval in cents to a frequency ratio.
 *
 * @param cents - Interval size in cents.
 * @returns The frequency ratio (e.g., 1200 cents → 2.0).
 * @throws {RangeError} If cents is not finite.
 *
 * @example
 * ```ts
 * centsToRatio(1200); // 2.0
 * centsToRatio(700);  // ~1.4983 (12-TET fifth)
 * ```
 */
export function centsToRatio(cents: number): number {
  if (!Number.isFinite(cents)) {
    throw new RangeError(`cents must be finite (got ${cents})`);
  }
  return Math.pow(2, cents / 1200);
}

/**
 * Convert a frequency ratio to cents.
 *
 * @param ratio - Frequency ratio (> 0).
 * @returns Interval size in cents. Negative if ratio < 1.
 * @throws {RangeError} If ratio is not positive and finite.
 *
 * @example
 * ```ts
 * ratioToCents(2);     // 1200
 * ratioToCents(3 / 2); // ~701.955
 * ratioToCents(5 / 4); // ~386.314
 * ```
 */
export function ratioToCents(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(`ratio must be positive (got ${ratio})`);
  }
  return 1200 * Math.log2(ratio);
}

/**
 * Convert an EDO step number to cents.
 *
 * @param step - Step number (0-based).
 * @param divisions - Number of equal divisions of the octave (> 0).
 * @returns The interval in cents for that step.
 * @throws {RangeError} If divisions is not a positive integer.
 *
 * @example
 * ```ts
 * edoStepToCents(7, 12);  // 700 (perfect fifth in 12-EDO)
 * edoStepToCents(11, 19); // ~694.737 (fifth in 19-EDO)
 * ```
 */
export function edoStepToCents(step: number, divisions: number): number {
  if (!Number.isInteger(divisions) || divisions < 1) {
    throw new RangeError(`divisions must be a positive integer (got ${divisions})`);
  }
  return (step * 1200) / divisions;
}

/**
 * Find the nearest EDO step for a given cent value.
 *
 * @param cents - Interval size in cents.
 * @param divisions - Number of equal divisions of the octave (> 0).
 * @returns The nearest step number (may be negative or exceed divisions).
 * @throws {RangeError} If divisions is not a positive integer.
 *
 * @example
 * ```ts
 * centsToEdoStep(702, 12);  // 7 (nearest 12-EDO step to a just fifth)
 * centsToEdoStep(386, 12);  // 4 (nearest 12-EDO step to a just major third)
 * ```
 */
export function centsToEdoStep(cents: number, divisions: number): number {
  if (!Number.isInteger(divisions) || divisions < 1) {
    throw new RangeError(`divisions must be a positive integer (got ${divisions})`);
  }
  return Math.round((cents * divisions) / 1200);
}

/**
 * Find the nearest EDO step for a just ratio.
 *
 * @param ratio - Frequency ratio (> 0).
 * @param divisions - Number of equal divisions of the octave (> 0).
 * @returns The nearest step number.
 * @throws {RangeError} If ratio is not positive or divisions is not a positive integer.
 *
 * @example
 * ```ts
 * ratioToEdoStep(3 / 2, 12); // 7 (perfect fifth)
 * ratioToEdoStep(5 / 4, 12); // 4 (major third)
 * ratioToEdoStep(3 / 2, 19); // 11 (fifth in 19-EDO)
 * ```
 */
export function ratioToEdoStep(ratio: number, divisions: number): number {
  return centsToEdoStep(ratioToCents(ratio), divisions);
}
