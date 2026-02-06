import type { NoteEvent } from '../core/types.js';

/** Direction of melodic motion between consecutive notes. */
export type ContourDirection = 'up' | 'down' | 'same';

/** Pitch range statistics for a passage. */
export interface PitchRange {
  /** Lowest MIDI pitch */
  lowest: number;
  /** Highest MIDI pitch */
  highest: number;
  /** Range in semitones */
  semitones: number;
}

/**
 * Compute the melodic contour as a sequence of up/down/same directions.
 * Events are compared pairwise in order: for n events, returns n-1 directions.
 *
 * @param events - Note events in sequential order.
 * @returns Array of contour directions between consecutive notes.
 */
export function contour(events: NoteEvent[]): ContourDirection[] {
  if (events.length < 2) return [];

  const result: ContourDirection[] = [];
  for (let i = 1; i < events.length; i++) {
    const diff = events[i]!.pitch.midi - events[i - 1]!.pitch.midi;
    if (diff > 0) result.push('up');
    else if (diff < 0) result.push('down');
    else result.push('same');
  }

  return result;
}

/**
 * Compute the pitch range of a passage.
 * Returns the lowest, highest, and total range in semitones.
 *
 * @param events - Note events to analyze.
 * @returns Pitch range with lowest, highest, and semitone span.
 */
export function range(events: NoteEvent[]): PitchRange {
  if (events.length === 0) return { lowest: 0, highest: 0, semitones: 0 };

  let lowest = events[0]!.pitch.midi;
  let highest = events[0]!.pitch.midi;

  for (const e of events) {
    if (e.pitch.midi < lowest) lowest = e.pitch.midi;
    if (e.pitch.midi > highest) highest = e.pitch.midi;
  }

  return { lowest, highest, semitones: highest - lowest };
}

/**
 * Compute the mean MIDI pitch of a passage.
 *
 * @param events - Note events to average.
 * @returns The arithmetic mean of MIDI pitches, or 0 for empty input.
 */
export function meanPitch(events: NoteEvent[]): number {
  if (events.length === 0) return 0;
  return events.reduce((sum, e) => sum + e.pitch.midi, 0) / events.length;
}

/**
 * Compute a histogram of melodic intervals (between consecutive notes).
 * Returns a Map from interval (in semitones, signed) to occurrence count.
 *
 * @param events - Note events in sequential order.
 * @returns Map from signed interval (semitones) to count.
 */
export function intervalHistogram(events: NoteEvent[]): Map<number, number> {
  const hist = new Map<number, number>();
  if (events.length < 2) return hist;

  for (let i = 1; i < events.length; i++) {
    const interval = events[i]!.pitch.midi - events[i - 1]!.pitch.midi;
    hist.set(interval, (hist.get(interval) ?? 0) + 1);
  }

  return hist;
}

/**
 * Compute the ratio of stepwise motion (intervals of 1-2 semitones) to
 * leaping motion (intervals > 2 semitones).
 *
 * Returns a value in [0, 1]: 1.0 = all stepwise, 0.0 = all leaps.
 * Returns 0 if fewer than 2 events.
 *
 * @param events - Note events in sequential order.
 * @returns Ratio of stepwise motion (0-1), where 1.0 = all stepwise.
 */
export function stepLeapRatio(events: NoteEvent[]): number {
  if (events.length < 2) return 0;

  let steps = 0;
  let total = 0;

  for (let i = 1; i < events.length; i++) {
    const abs = Math.abs(events[i]!.pitch.midi - events[i - 1]!.pitch.midi);
    if (abs <= 2) steps++;
    total++;
  }

  return steps / total;
}
