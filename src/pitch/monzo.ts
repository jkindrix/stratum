// ---------------------------------------------------------------------------
// Stratum — Monzo (Prime Exponent Vector) Arithmetic
// ---------------------------------------------------------------------------

/** Prime exponent vector [e₂, e₃, e₅, e₇, ...] representing a JI interval. */
export type Monzo = readonly number[];

/**
 * First 11 primes, sufficient for 31-limit JI.
 * @internal
 */
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as const;

/**
 * Return the slice of PRIMES up to and including `limit`.
 * @internal
 */
function primesUpTo(limit: number): readonly number[] {
  return PRIMES.filter(p => p <= limit);
}

/**
 * Convert a monzo to cents.
 *
 * @param monzo - Prime exponent vector.
 * @returns Interval size in cents.
 * @throws {RangeError} If monzo is empty.
 *
 * @example
 * ```ts
 * monzoToCents([1]);       // 1200 (octave: 2^1)
 * monzoToCents([-1, 1]);   // ~701.955 (3/2 perfect fifth)
 * ```
 */
export function monzoToCents(monzo: Monzo): number {
  if (monzo.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  let log2 = 0;
  for (let i = 0; i < monzo.length; i++) {
    const prime = PRIMES[i];
    const exp = monzo[i];
    if (prime === undefined || exp === undefined) break;
    log2 += exp * Math.log2(prime);
  }
  return 1200 * log2;
}

/**
 * Convert a monzo to a frequency ratio.
 *
 * @param monzo - Prime exponent vector.
 * @returns Frequency ratio.
 * @throws {RangeError} If monzo is empty.
 *
 * @example
 * ```ts
 * monzoToRatio([-1, 1]);   // 1.5 (3/2)
 * monzoToRatio([2, 0, -1]); // 0.8 (4/5)
 * ```
 */
export function monzoToRatio(monzo: Monzo): number {
  if (monzo.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  let ratio = 1;
  for (let i = 0; i < monzo.length; i++) {
    const prime = PRIMES[i];
    const exp = monzo[i];
    if (prime === undefined || exp === undefined) break;
    ratio *= Math.pow(prime, exp);
  }
  return ratio;
}

/**
 * Convert a rational interval (numerator/denominator) to a monzo.
 *
 * @param num - Numerator (positive integer).
 * @param den - Denominator (positive integer).
 * @param primeLimit - Highest prime to factor against (default 7).
 * @returns Frozen monzo.
 * @throws {RangeError} If num/den are not positive integers, or if unfactorable within the prime limit.
 *
 * @example
 * ```ts
 * ratioToMonzo(3, 2);    // [-1, 1]  (3/2 = 2^-1 · 3^1)
 * ratioToMonzo(5, 4);    // [-2, 0, 1] (5/4 = 2^-2 · 5^1)
 * ratioToMonzo(7, 4, 7); // [-2, 0, 0, 1]
 * ```
 */
export function ratioToMonzo(num: number, den: number, primeLimit = 7): Monzo {
  if (!Number.isInteger(num) || num < 1) {
    throw new RangeError(`Numerator must be a positive integer (got ${num})`);
  }
  if (!Number.isInteger(den) || den < 1) {
    throw new RangeError(`Denominator must be a positive integer (got ${den})`);
  }

  const primes = primesUpTo(primeLimit);
  if (primes.length === 0) {
    throw new RangeError(`No primes up to limit ${primeLimit}`);
  }

  const exponents: number[] = new Array(primes.length).fill(0) as number[];

  let n = num;
  let d = den;

  for (let i = 0; i < primes.length; i++) {
    const p = primes[i]!;
    while (n % p === 0) {
      exponents[i]!++;
      n /= p;
    }
    while (d % p === 0) {
      exponents[i]!--;
      d /= p;
    }
  }

  if (n !== 1 || d !== 1) {
    throw new RangeError(
      `Ratio ${num}/${den} has prime factors beyond ${primeLimit}-limit`,
    );
  }

  // Trim trailing zeros
  while (exponents.length > 1 && exponents[exponents.length - 1] === 0) {
    exponents.pop();
  }

  return Object.freeze(exponents);
}

/**
 * Add two monzos element-wise (interval stacking).
 *
 * @param a - First monzo.
 * @param b - Second monzo.
 * @returns Frozen monzo representing the sum.
 * @throws {RangeError} If either monzo is empty.
 *
 * @example
 * ```ts
 * monzoAdd([-1, 1], [-1, 1]); // [-2, 2] (two stacked fifths)
 * ```
 */
export function monzoAdd(a: Monzo, b: Monzo): Monzo {
  if (a.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  if (b.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  const len = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    result.push((a[i] ?? 0) + (b[i] ?? 0));
  }
  return Object.freeze(result);
}

/**
 * Subtract monzo b from monzo a element-wise.
 *
 * @param a - First monzo.
 * @param b - Monzo to subtract.
 * @returns Frozen monzo representing the difference.
 * @throws {RangeError} If either monzo is empty.
 *
 * @example
 * ```ts
 * monzoSubtract([-1, 1], [2]); // [-3, 1]
 * ```
 */
export function monzoSubtract(a: Monzo, b: Monzo): Monzo {
  if (a.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  if (b.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  const len = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    result.push((a[i] ?? 0) - (b[i] ?? 0));
  }
  return Object.freeze(result);
}

/**
 * Scale a monzo by an integer factor.
 *
 * @param monzo - The monzo to scale.
 * @param n - Integer scale factor.
 * @returns Frozen monzo with each exponent multiplied by n.
 * @throws {RangeError} If monzo is empty or n is not an integer.
 *
 * @example
 * ```ts
 * monzoScale([-1, 1], 3); // [-3, 3] (three stacked fifths)
 * ```
 */
export function monzoScale(monzo: Monzo, n: number): Monzo {
  if (monzo.length === 0) {
    throw new RangeError('Monzo must not be empty');
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`Scale factor must be an integer (got ${n})`);
  }
  // `+ 0` converts -0 to +0 (JS: -1 * 0 === -0)
  return Object.freeze(monzo.map(e => e * n + 0));
}
