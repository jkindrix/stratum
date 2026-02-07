// ---------------------------------------------------------------------------
// Stratum — Stochastic Generators (Seeded PRNG + Distributions)
// ---------------------------------------------------------------------------

/** A value-weight pair for weighted random selection. */
export interface WeightedOption<T> {
  readonly value: T;
  readonly weight: number;
}

// ---- Internal helpers ----

/**
 * Mulberry32: fast, deterministic 32-bit PRNG.
 * Returns a function that yields [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Return a seeded PRNG if seed is provided, otherwise Math.random. */
function getRng(seed?: number): () => number {
  return seed !== undefined ? mulberry32(seed) : Math.random;
}

// ---- Public API ----

/**
 * Generate Poisson-distributed onset times.
 *
 * Uses exponential inter-arrival times: -ln(U) / rate.
 * Accumulates onsets until exceeding `duration`.
 *
 * @param rate - Average events per unit time (must be > 0).
 * @param duration - Maximum time span (must be > 0).
 * @param seed - Optional PRNG seed for reproducibility.
 * @returns Frozen array of onset times in [0, duration).
 * @throws {RangeError} If rate ≤ 0 or duration ≤ 0.
 */
export function poissonOnsets(
  rate: number,
  duration: number,
  seed?: number,
): readonly number[] {
  if (rate <= 0) throw new RangeError(`rate must be > 0 (got ${rate})`);
  if (duration <= 0) throw new RangeError(`duration must be > 0 (got ${duration})`);

  const rng = getRng(seed);
  const onsets: number[] = [];
  let t = 0;
  for (;;) {
    const u = rng();
    // Avoid log(0)
    const interval = -Math.log(u === 0 ? Number.MIN_VALUE : u) / rate;
    t += interval;
    if (t >= duration) break;
    onsets.push(t);
  }
  return Object.freeze(onsets);
}

/**
 * Generate Gaussian-distributed pitch values (MIDI-scale).
 *
 * Uses the Box-Muller transform to produce normally distributed values.
 *
 * @param mean - Mean pitch value (e.g. 60 for middle C).
 * @param stdDev - Standard deviation (must be > 0).
 * @param count - Number of values to generate (must be ≥ 1).
 * @param seed - Optional PRNG seed for reproducibility.
 * @returns Frozen array of rounded pitch values.
 * @throws {RangeError} If stdDev ≤ 0 or count < 1.
 */
export function gaussianPitches(
  mean: number,
  stdDev: number,
  count: number,
  seed?: number,
): readonly number[] {
  if (stdDev <= 0) throw new RangeError(`stdDev must be > 0 (got ${stdDev})`);
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer (got ${count})`);
  }

  const rng = getRng(seed);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    // Box-Muller transform
    const u1 = rng() || Number.MIN_VALUE;
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    result.push(Math.round(mean + stdDev * z));
  }
  return Object.freeze(result);
}

/**
 * Generate uniform random integer durations.
 *
 * @param min - Minimum duration in ticks (inclusive, must be ≥ 0).
 * @param max - Maximum duration in ticks (inclusive, must be ≥ min).
 * @param count - Number of values to generate (must be ≥ 1).
 * @param seed - Optional PRNG seed for reproducibility.
 * @returns Frozen array of integer durations in [min, max].
 * @throws {RangeError} If min > max, min < 0, or count < 1.
 */
export function uniformRhythm(
  min: number,
  max: number,
  count: number,
  seed?: number,
): readonly number[] {
  if (!Number.isInteger(min) || min < 0) {
    throw new RangeError(`min must be a non-negative integer (got ${min})`);
  }
  if (!Number.isInteger(max) || max < min) {
    throw new RangeError(`max must be an integer >= min (got ${max})`);
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer (got ${count})`);
  }

  const rng = getRng(seed);
  const range = max - min + 1;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(min + Math.floor(rng() * range));
  }
  return Object.freeze(result);
}

/**
 * Generate exponentially distributed durations.
 *
 * Uses inverse CDF: -ln(U) / rate.
 *
 * @param rate - Rate parameter λ (must be > 0). Mean = 1/λ.
 * @param count - Number of values to generate (must be ≥ 1).
 * @param seed - Optional PRNG seed for reproducibility.
 * @returns Frozen array of positive duration values.
 * @throws {RangeError} If rate ≤ 0 or count < 1.
 */
export function exponentialDurations(
  rate: number,
  count: number,
  seed?: number,
): readonly number[] {
  if (rate <= 0) throw new RangeError(`rate must be > 0 (got ${rate})`);
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer (got ${count})`);
  }

  const rng = getRng(seed);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = rng() || Number.MIN_VALUE;
    result.push(-Math.log(u) / rate);
  }
  return Object.freeze(result);
}

/**
 * Generate Cauchy-distributed pitch values.
 *
 * Inverse CDF: location + scale * tan(π(u - 0.5)).
 * Cauchy distribution has heavy tails — useful for occasional extreme leaps.
 *
 * @param location - Center of the distribution (e.g. MIDI 60).
 * @param scale - Scale parameter γ (must be > 0).
 * @param count - Number of values to generate (must be ≥ 1).
 * @param seed - Optional PRNG seed for reproducibility.
 * @returns Frozen array of rounded pitch values.
 * @throws {RangeError} If scale ≤ 0 or count < 1.
 */
export function cauchyPitches(
  location: number,
  scale: number,
  count: number,
  seed?: number,
): readonly number[] {
  if (scale <= 0) throw new RangeError(`scale must be > 0 (got ${scale})`);
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer (got ${count})`);
  }

  const rng = getRng(seed);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    let u = rng();
    // Avoid tan(±π/2) singularity
    while (u === 0 || u === 1) u = rng();
    result.push(Math.round(location + scale * Math.tan(Math.PI * (u - 0.5))));
  }
  return Object.freeze(result);
}

/**
 * Select items by weighted random sampling.
 *
 * Constructs a normalized CDF and uses binary search for selection.
 *
 * @param options - Items to choose from.
 * @param count - Number of selections (default 1, must be ≥ 1).
 * @param seed - Optional PRNG seed for reproducibility.
 * @returns Frozen array of selected values.
 * @throws {RangeError} If options is empty, any weight < 0, all weights 0, or count < 1.
 */
export function weightedChoice<T>(
  options: readonly WeightedOption<T>[],
  count: number = 1,
  seed?: number,
): readonly T[] {
  if (options.length === 0) {
    throw new RangeError('options must not be empty');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer (got ${count})`);
  }

  let totalWeight = 0;
  for (const opt of options) {
    if (opt.weight < 0) {
      throw new RangeError(`weight must be >= 0 (got ${opt.weight})`);
    }
    totalWeight += opt.weight;
  }
  if (totalWeight === 0) {
    throw new RangeError('total weight must be > 0');
  }

  // Build CDF
  const cdf: number[] = [];
  let cumulative = 0;
  for (const opt of options) {
    cumulative += opt.weight / totalWeight;
    cdf.push(cumulative);
  }

  const rng = getRng(seed);
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng();
    // Binary search in CDF
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((cdf[mid] ?? 0) <= r) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    result.push(options[lo]!.value);
  }
  return Object.freeze(result);
}
