import type { NoteEvent } from '../core/types.js';

/** A detected repeating pattern */
export interface Pattern {
  /** Pitch intervals between successive notes */
  intervals: number[];
  /** Duration ratios relative to first note */
  durations: number[];
  /** Starting indices where this pattern occurs */
  occurrences: number[];
  /** Number of events in the pattern */
  length: number;
}

/** Options for pattern detection */
export interface PatternOptions {
  /** Minimum pattern length (default 3) */
  minLength?: number;
  /** Maximum pattern length (default 16) */
  maxLength?: number;
  /** Fuzzy matching tolerance for duration ratios (0 = exact, default 0) */
  tolerance?: number;
  /** If true, detect transposed recurrences (same intervals, any starting pitch) */
  matchTranspositions?: boolean;
}

/**
 * Find repeating patterns in a sequence of note events.
 * Matches by intervallic profile (pitch intervals) and durational profile (duration ratios).
 *
 * @param events — Note events to search.
 * @param minLengthOrOptions — Either minimum length (number) or options object.
 * @param maxLength — Maximum length (only used if first arg is a number).
 * @returns Array of detected patterns with their intervals, durations, and occurrence indices.
 */
export function findPatterns(
  events: NoteEvent[],
  minLengthOrOptions?: number | PatternOptions,
  maxLength?: number,
): Pattern[] {
  let opts: PatternOptions;
  if (typeof minLengthOrOptions === 'number') {
    opts = { minLength: minLengthOrOptions, maxLength: maxLength ?? 16 };
  } else {
    opts = minLengthOrOptions ?? {};
  }

  const minLen = opts.minLength ?? 3;
  const maxLen = opts.maxLength ?? 16;
  const tolerance = opts.tolerance ?? 0;
  const matchTranspositions = opts.matchTranspositions ?? false;

  if (events.length < minLen * 2) return [];

  const patterns: Pattern[] = [];
  const effectiveMax = Math.min(maxLen, Math.floor(events.length / 2));

  for (let len = minLen; len <= effectiveMax; len++) {
    const profiles = new Map<string, number[]>();

    for (let i = 0; i <= events.length - len; i++) {
      const slice = events.slice(i, i + len);
      const key = matchTranspositions
        ? intervalsOnlyKey(slice, tolerance)
        : profileKey(slice, tolerance);

      const indices = profiles.get(key);
      if (indices) {
        indices.push(i);
      } else {
        profiles.set(key, [i]);
      }
    }

    for (const [key, indices] of profiles) {
      if (indices.length < 2) continue;

      const nonOverlapping = filterNonOverlapping(indices, len);
      if (nonOverlapping.length < 2) continue;

      const parsed = parseKey(key);
      patterns.push({
        intervals: parsed.intervals,
        durations: parsed.durations,
        occurrences: nonOverlapping,
        length: len,
      });
    }
  }

  return patterns;
}

function profileKey(events: NoteEvent[], tolerance: number): string {
  const intervals: number[] = [];
  const durations: number[] = [];
  const refDur = events[0]!.duration || 1;

  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i]!.pitch.midi - events[i - 1]!.pitch.midi);
    const ratio = events[i]!.duration / refDur;
    durations.push(tolerance > 0
      ? Math.round(ratio / tolerance) * tolerance
      : Math.round(ratio * 100) / 100);
  }

  return `${intervals.join(',')}|${durations.join(',')}`;
}

function intervalsOnlyKey(events: NoteEvent[], tolerance: number): string {
  const intervals: number[] = [];
  const durations: number[] = [];
  const refDur = events[0]!.duration || 1;

  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i]!.pitch.midi - events[i - 1]!.pitch.midi);
    const ratio = events[i]!.duration / refDur;
    durations.push(tolerance > 0
      ? Math.round(ratio / tolerance) * tolerance
      : Math.round(ratio * 100) / 100);
  }

  // For transposition matching, intervals are relative so the key is the same
  // regardless of starting pitch — which is exactly what we compute here
  return `${intervals.join(',')}|${durations.join(',')}`;
}

function parseKey(key: string): { intervals: number[]; durations: number[] } {
  const [intStr, durStr] = key.split('|');
  return {
    intervals: intStr ? intStr.split(',').map(Number) : [],
    durations: durStr ? durStr.split(',').map(Number) : [],
  };
}

function filterNonOverlapping(indices: number[], length: number): number[] {
  if (indices.length === 0) return [];
  const result: number[] = [indices[0]!];
  for (let i = 1; i < indices.length; i++) {
    if (indices[i]! >= result[result.length - 1]! + length) {
      result.push(indices[i]!);
    }
  }
  return result;
}
