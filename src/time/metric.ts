import type { TimeSignature } from '../core/types.js';

/** A level in the metric hierarchy */
export interface MetricLevel {
  /** Name of this level */
  name: string;
  /** Period in ticks */
  periodTicks: number;
  /** Relative weight (higher = metrically stronger) */
  weight: number;
}

/** Options for building metric levels with irregular meters */
export interface MetricOptions {
  /** For irregular meters, specify beat grouping (e.g., [2,2,3] for 7/8) */
  beatGrouping?: number[];
}

/**
 * Detect if a time signature represents compound meter.
 * Compound meters have a numerator divisible by 3 (but not 3 itself, which is simple triple).
 * Examples: 6/8, 9/8, 12/8 are compound; 3/4, 3/8 are simple triple.
 */
function isCompound(timeSig: TimeSignature): boolean {
  return timeSig.numerator > 3 && timeSig.numerator % 3 === 0;
}

/**
 * Build a metric hierarchy from a time signature.
 * Returns levels from finest (subdivision) to coarsest (hypermeter).
 *
 * Properly handles:
 * - Simple meters (2/4, 3/4, 4/4)
 * - Compound meters (6/8, 9/8, 12/8) with dotted-note beat grouping
 * - Irregular/asymmetric meters (5/4, 7/8) when beatGrouping is provided
 *
 * @param timeSig - The time signature to derive the hierarchy from.
 * @param ticksPerQuarter - Resolution in ticks per quarter note.
 * @param options - Optional settings for irregular meters.
 * @returns Array of metric levels from finest (subdivision) to coarsest (hypermeter).
 */
export function buildMetricLevels(
  timeSig: TimeSignature,
  ticksPerQuarter: number,
  options?: MetricOptions,
): MetricLevel[] {
  const noteValueTicks = (4 / timeSig.denominator) * ticksPerQuarter;
  const barTicks = noteValueTicks * timeSig.numerator;

  if (options?.beatGrouping) {
    // Irregular/asymmetric meter with explicit beat grouping
    return buildIrregularLevels(noteValueTicks, barTicks, options.beatGrouping);
  }

  if (isCompound(timeSig)) {
    // Compound meter: beats group in 3s
    const beatsPerBar = timeSig.numerator / 3;
    const beatTicks = noteValueTicks * 3; // dotted note beat
    const subdivisionTicks = noteValueTicks; // each note value is a subdivision

    return [
      { name: 'subdivision', periodTicks: subdivisionTicks, weight: 1 },
      { name: 'beat', periodTicks: beatTicks, weight: 2 },
      { name: 'bar', periodTicks: barTicks, weight: 3 },
      { name: 'hypermeter', periodTicks: barTicks * (beatsPerBar <= 2 ? 4 : 2), weight: 4 },
    ];
  }

  // Simple meter
  const beatTicks = noteValueTicks;
  const subdivisionTicks = beatTicks / 2;

  return [
    { name: 'subdivision', periodTicks: subdivisionTicks, weight: 1 },
    { name: 'beat', periodTicks: beatTicks, weight: 2 },
    { name: 'bar', periodTicks: barTicks, weight: 3 },
    { name: 'hypermeter', periodTicks: barTicks * 4, weight: 4 },
  ];
}

/**
 * Build metric levels for irregular meters with explicit beat grouping.
 * The grouping defines how many base note values per beat (e.g., [2,2,3] for 7/8).
 */
function buildIrregularLevels(
  noteValueTicks: number,
  barTicks: number,
  beatGrouping: number[],
): MetricLevel[] {
  // For irregular meters, beats are uneven — use smallest grouping for subdivision
  const minGroup = Math.min(...beatGrouping);
  const subdivisionTicks = noteValueTicks;
  const shortBeatTicks = noteValueTicks * minGroup;

  return [
    { name: 'subdivision', periodTicks: subdivisionTicks, weight: 1 },
    { name: 'beat', periodTicks: shortBeatTicks, weight: 2 },
    { name: 'bar', periodTicks: barTicks, weight: 3 },
    { name: 'hypermeter', periodTicks: barTicks * 4, weight: 4 },
  ];
}

/**
 * Compute metric strength at a given tick position.
 * Higher values = metrically stronger positions.
 * A tick that falls on the downbeat of a 4-bar phrase has maximum strength.
 *
 * @param tick - Tick position to evaluate.
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @returns Cumulative metric strength (sum of matching level weights).
 */
export function beatStrength(tick: number, levels: MetricLevel[]): number {
  let strength = 0;
  for (const level of levels) {
    // Use small epsilon for floating-point tolerance
    const remainder = tick % level.periodTicks;
    if (remainder < 0.5 || level.periodTicks - remainder < 0.5) {
      strength += level.weight;
    }
  }
  return strength;
}

/**
 * Maximum possible beat strength for a given metric hierarchy.
 *
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @returns Sum of all level weights.
 */
export function maxBeatStrength(levels: MetricLevel[]): number {
  return levels.reduce((sum, l) => sum + l.weight, 0);
}

/**
 * Compute syncopation for an event based on its velocity/salience
 * versus its metric position strength.
 * High salience on weak beats = high syncopation.
 *
 * @param eventTick - Tick position of the event.
 * @param velocity - MIDI velocity (0-127) representing event salience.
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @returns Syncopation value (0-1), where higher means more syncopated.
 */
export function syncopation(
  eventTick: number,
  velocity: number,
  levels: MetricLevel[],
): number {
  const strength = beatStrength(eventTick, levels);
  const maxStr = maxBeatStrength(levels);
  const normalizedStrength = strength / maxStr;
  const normalizedVelocity = velocity / 127;

  // Syncopation = high salience * low metric weight
  return normalizedVelocity * (1 - normalizedStrength);
}

/**
 * Determine which metric level boundaries a tick aligns with.
 * Returns an array of level names that the tick falls on.
 * For example, a downbeat of a bar returns ['subdivision', 'beat', 'bar'].
 *
 * @param tick - Tick position to evaluate.
 * @param levels - Metric hierarchy from `buildMetricLevels`.
 * @returns Array of metric level names that align with this tick.
 */
export function metricPosition(tick: number, levels: MetricLevel[]): string[] {
  const result: string[] = [];
  for (const level of levels) {
    const remainder = tick % level.periodTicks;
    if (remainder < 0.5 || level.periodTicks - remainder < 0.5) {
      result.push(level.name);
    }
  }
  return result;
}
