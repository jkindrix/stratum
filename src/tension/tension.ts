import type { Score } from '../core/types.js';
import { roughness } from './roughness.js';
import { pitchToFrequency } from '../pitch/pitch-class.js';
import { buildMetricLevels, beatStrength, maxBeatStrength } from '../time/metric.js';
import { tickToSeconds } from '../core/score.js';

/** Weights for each tension component (0-1). */
export interface TensionWeights {
  /** Weight for psychoacoustic roughness (sensory dissonance). */
  roughness: number;
  /** Weight for metric displacement (inverse beat strength). */
  metric: number;
  /** Weight for registral extremity (distance from pitch center). */
  registral: number;
  /** Weight for event density (number of simultaneous events). */
  density: number;
}

/** Options for `computeTension`. */
export interface TensionOptions {
  /** Component weights (default: roughness 0.3, metric 0.3, registral 0.2, density 0.2). */
  weights?: Partial<TensionWeights>;
  /** Tick interval between samples (default: ticksPerQuarter). */
  sampleInterval?: number;
  /** Window size in ticks for density calculation (default: ticksPerQuarter). */
  densityWindow?: number;
  /** Normalization range in semitones for registral extremity (default: 48 = 4 octaves). */
  registralRange?: number;
  /** Number of harmonics for roughness calculation (default: 6). */
  numHarmonics?: number;
}

/** A single sample on the tension curve */
export interface TensionPoint {
  /** Tick position within the score */
  tick: number;
  /** Time position in seconds */
  seconds: number;
  /** Weighted sum of all tension components (0-1) */
  total: number;
  /** Individual tension component values (each 0-1) */
  components: {
    roughness: number;
    metric: number;
    registral: number;
    density: number;
  };
}

/** An array of tension samples forming a continuous tension curve over time. */
export type TensionCurve = TensionPoint[];

const DEFAULT_WEIGHTS: TensionWeights = {
  roughness: 0.3,
  metric: 0.3,
  registral: 0.2,
  density: 0.2,
};

/**
 * Compute a tension curve for a score.
 *
 * Samples at regular tick intervals and computes multi-component tension:
 * - **Roughness:** Plomp-Levelt sensory roughness of simultaneous pitches
 * - **Metric:** mismatch between event salience and beat position (weak-beat events = high tension)
 * - **Registral:** distance from the pitch center of the piece
 * - **Density:** number of simultaneous events in a time window
 *
 * @param score — The score to analyze.
 * @param optionsOrWeights — Either a `TensionOptions` object or a legacy `Partial<TensionWeights>`.
 * @param sampleIntervalTicks — (Legacy) Sample interval. Use `options.sampleInterval` instead.
 */
export function computeTension(
  score: Score,
  optionsOrWeights?: Partial<TensionWeights> | TensionOptions,
  sampleIntervalTicks?: number,
): TensionCurve {
  // Normalize arguments: support both legacy (weights, sampleInterval) and new options object
  let opts: TensionOptions;
  if (optionsOrWeights && 'weights' in optionsOrWeights) {
    opts = optionsOrWeights as TensionOptions;
  } else {
    opts = {
      weights: optionsOrWeights as Partial<TensionWeights> | undefined,
      sampleInterval: sampleIntervalTicks,
    };
  }

  const w = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const tpq = score.settings.ticksPerQuarter;
  const interval = opts.sampleInterval ?? tpq;
  const densityWindow = opts.densityWindow ?? tpq;
  const registralRange = opts.registralRange ?? 48;
  const numHarmonics = opts.numHarmonics ?? 6;

  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) return [];

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));

  // Metric hierarchy from first time signature
  const timeSig = score.timeSignatures[0] ?? { numerator: 4, denominator: 4, atTick: 0 };
  const levels = buildMetricLevels(timeSig, tpq);
  const maxStr = maxBeatStrength(levels);

  // Registral center (mean MIDI pitch)
  const meanMidi = allEvents.reduce((s, e) => s + e.pitch.midi, 0) / allEvents.length;

  const curve: TensionCurve = [];

  for (let tick = 0; tick <= maxTick; tick += interval) {
    // Events sounding at this tick
    const sounding = allEvents.filter(
      e => e.onset <= tick && e.onset + e.duration > tick,
    );

    // 1. Roughness
    let roughnessVal = 0;
    if (sounding.length >= 2) {
      const freqs = sounding.map(e => pitchToFrequency(e.pitch, score.settings.tuningHz));
      // Normalize: typical roughness for a semitone dyad is ~0.3-0.5
      roughnessVal = Math.min(1, roughness(freqs, numHarmonics) / 2);
    }

    // 2. Metric tension
    // Events on weak beats create more tension than events on strong beats
    let metricVal = 0;
    const onsetEvents = sounding.filter(e => Math.abs(e.onset - tick) < interval / 2);
    if (onsetEvents.length > 0) {
      const strength = beatStrength(tick, levels) / maxStr;
      // Invert: weak position = high metric tension
      metricVal = 1 - strength;
    }

    // 3. Registral extremity
    let registralVal = 0;
    if (sounding.length > 0) {
      const avgMidi = sounding.reduce((s, e) => s + e.pitch.midi, 0) / sounding.length;
      registralVal = Math.min(1, Math.abs(avgMidi - meanMidi) / registralRange);
    }

    // 4. Density
    const nearbyEvents = allEvents.filter(
      e => e.onset >= tick - densityWindow / 2 && e.onset < tick + densityWindow / 2,
    );
    const densityVal = Math.min(1, nearbyEvents.length / 12);

    // Weighted sum
    const total =
      w.roughness * roughnessVal +
      w.metric * metricVal +
      w.registral * registralVal +
      w.density * densityVal;

    curve.push({
      tick,
      seconds: tickToSeconds(score, tick),
      total: Math.min(1, total),
      components: {
        roughness: roughnessVal,
        metric: metricVal,
        registral: registralVal,
        density: densityVal,
      },
    });
  }

  return curve;
}

// ---------------------------------------------------------------------------
// Tension derivatives and analysis
// ---------------------------------------------------------------------------

/**
 * First derivative of a tension curve: rate of tension change (T'(t)).
 * Each output point represents the slope between consecutive samples.
 * Returns n-1 points for a curve of n points.
 *
 * @param curve - The tension curve to differentiate.
 * @returns A new curve where each point's `total` is the slope (dT/dt).
 */
export function tensionVelocity(curve: TensionCurve): TensionCurve {
  if (curve.length < 2) return [];

  const result: TensionCurve = [];
  for (let i = 1; i < curve.length; i++) {
    const dt = curve[i]!.tick - curve[i - 1]!.tick;
    if (dt === 0) continue;
    const slope = (curve[i]!.total - curve[i - 1]!.total) / dt;

    result.push({
      tick: curve[i]!.tick,
      seconds: curve[i]!.seconds,
      total: slope,
      components: {
        roughness: (curve[i]!.components.roughness - curve[i - 1]!.components.roughness) / dt,
        metric: (curve[i]!.components.metric - curve[i - 1]!.components.metric) / dt,
        registral: (curve[i]!.components.registral - curve[i - 1]!.components.registral) / dt,
        density: (curve[i]!.components.density - curve[i - 1]!.components.density) / dt,
      },
    });
  }

  return result;
}

/**
 * Second derivative of a tension curve: acceleration of tension change (T''(t)).
 * Returns n-2 points for a curve of n points.
 *
 * @param curve - The tension curve to double-differentiate.
 * @returns A new curve where each point's `total` is the second derivative.
 */
export function tensionAcceleration(curve: TensionCurve): TensionCurve {
  return tensionVelocity(tensionVelocity(curve));
}

/**
 * Cumulative tension integral over a tick range using the trapezoidal rule.
 * Returns the area under the tension curve between `startTick` and `endTick`.
 *
 * @param curve - The tension curve to integrate.
 * @param startTick - Start of the integration range (inclusive).
 * @param endTick - End of the integration range (inclusive).
 * @returns The area under the tension curve in tick-tension units.
 */
export function tensionIntegral(
  curve: TensionCurve,
  startTick: number,
  endTick: number,
): number {
  if (curve.length < 2 || startTick >= endTick) return 0;

  // Filter points in range (inclusive boundaries)
  const inRange = curve.filter(pt => pt.tick >= startTick && pt.tick <= endTick);
  if (inRange.length < 2) return 0;

  let sum = 0;
  for (let i = 1; i < inRange.length; i++) {
    const dt = inRange[i]!.tick - inRange[i - 1]!.tick;
    // Trapezoidal rule: average of two endpoints * width
    sum += (inRange[i]!.total + inRange[i - 1]!.total) / 2 * dt;
  }

  return sum;
}

/**
 * Find local maxima (tension peaks) in a tension curve.
 * A peak is a point where tension is higher than both its neighbors.
 *
 * @param curve - The tension curve to search.
 * @returns Array of tension points at local maxima.
 */
export function findTensionPeaks(curve: TensionCurve): TensionPoint[] {
  if (curve.length < 3) return [];

  const peaks: TensionPoint[] = [];
  for (let i = 1; i < curve.length - 1; i++) {
    if (
      curve[i]!.total > curve[i - 1]!.total &&
      curve[i]!.total > curve[i + 1]!.total
    ) {
      peaks.push(curve[i]!);
    }
  }

  return peaks;
}

/**
 * Find local minima (tension valleys) in a tension curve.
 * A valley is a point where tension is lower than both its neighbors.
 *
 * @param curve - The tension curve to search.
 * @returns Array of tension points at local minima.
 */
export function findTensionValleys(curve: TensionCurve): TensionPoint[] {
  if (curve.length < 3) return [];

  const valleys: TensionPoint[] = [];
  for (let i = 1; i < curve.length - 1; i++) {
    if (
      curve[i]!.total < curve[i - 1]!.total &&
      curve[i]!.total < curve[i + 1]!.total
    ) {
      valleys.push(curve[i]!);
    }
  }

  return valleys;
}

/** Profile classifications for a tension curve segment. */
export type TensionProfile = 'ramp' | 'plateau' | 'release' | 'oscillation' | 'flat';

/**
 * Classify the overall shape of a tension curve.
 *
 * - **ramp**: Tension predominantly increases (net positive slope).
 * - **release**: Tension predominantly decreases (net negative slope).
 * - **plateau**: Tension stays roughly constant at a high level (mean > 0.5, low variance).
 * - **flat**: Tension stays roughly constant at a low level (mean <= 0.5, low variance).
 * - **oscillation**: Tension alternates direction frequently (many sign changes in derivative).
 *
 * @param curve - The tension curve to classify.
 * @returns A profile label describing the curve's overall shape.
 */
export function classifyTensionProfile(curve: TensionCurve): TensionProfile {
  if (curve.length < 2) return 'flat';

  const totalRange = curve[curve.length - 1]!.total - curve[0]!.total;
  const mean = curve.reduce((s, pt) => s + pt.total, 0) / curve.length;

  // Compute variance
  const variance = curve.reduce((s, pt) => s + (pt.total - mean) ** 2, 0) / curve.length;
  const stdDev = Math.sqrt(variance);

  // Count direction changes in the derivative
  let signChanges = 0;
  let prevSlope = 0;
  for (let i = 1; i < curve.length; i++) {
    const slope = curve[i]!.total - curve[i - 1]!.total;
    if (slope !== 0 && prevSlope !== 0 && Math.sign(slope) !== Math.sign(prevSlope)) {
      signChanges++;
    }
    if (slope !== 0) prevSlope = slope;
  }

  const changeRate = signChanges / Math.max(1, curve.length - 2);

  // Classification thresholds
  const VARIANCE_THRESHOLD = 0.01; // Low variance = relatively constant
  const CHANGE_RATE_THRESHOLD = 0.4; // >40% direction changes = oscillation
  const SLOPE_THRESHOLD = 0.05; // Minimum net slope for ramp/release

  // High oscillation overrides other classifications
  if (changeRate > CHANGE_RATE_THRESHOLD && stdDev > 0.05) {
    return 'oscillation';
  }

  // Low variance = constant (plateau or flat depending on level)
  if (variance < VARIANCE_THRESHOLD) {
    return mean > 0.5 ? 'plateau' : 'flat';
  }

  // Net slope determines ramp vs release
  if (totalRange > SLOPE_THRESHOLD) return 'ramp';
  if (totalRange < -SLOPE_THRESHOLD) return 'release';

  // Fallback: high mean with moderate variance = plateau
  return mean > 0.5 ? 'plateau' : 'flat';
}
