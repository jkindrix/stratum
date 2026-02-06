import type { Score, NoteEvent } from '../core/types.js';
import { findPatterns } from '../time/pattern.js';

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
