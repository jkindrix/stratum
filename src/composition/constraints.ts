// ---------------------------------------------------------------------------
// Stratum — Composition Constraint Helpers
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

/** A parallel motion violation (parallel fifths or octaves). */
export interface ParallelViolation {
  /** Tick where the violation begins. */
  readonly tick: number;
  /** The parallel interval in semitones mod 12. */
  readonly interval: number;
  /** Human-readable description. */
  readonly description: string;
}

/** A voice crossing violation. */
export interface CrossingViolation {
  /** Tick where the crossing occurs. */
  readonly tick: number;
  /** Index of the higher-numbered voice that crossed above. */
  readonly voiceA: number;
  /** Index of the lower-numbered voice that crossed below. */
  readonly voiceB: number;
  /** Human-readable description. */
  readonly description: string;
}

/** A range violation (note outside permitted MIDI range). */
export interface RangeViolation {
  /** Tick of the offending note. */
  readonly tick: number;
  /** MIDI note number that is out of range. */
  readonly midi: number;
  /** Human-readable description. */
  readonly description: string;
}

/** A leap resolution violation (large leap not resolved by step). */
export interface LeapViolation {
  /** Tick of the unresolved leap. */
  readonly tick: number;
  /** Absolute size of the leap in semitones. */
  readonly leapSize: number;
  /** Human-readable description. */
  readonly description: string;
}

// ---- Internal helpers ----

/** Align two voices by onset tick, returning pairs of simultaneous notes. */
function alignVoices(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
): readonly { tick: number; midi1: number; midi2: number }[] {
  // Build onset → midi maps
  const map1 = new Map<number, number>();
  for (const e of voice1) {
    // Last note at this onset wins (same behavior as counterpoint)
    map1.set(e.onset, e.pitch.midi);
  }
  const map2 = new Map<number, number>();
  for (const e of voice2) {
    map2.set(e.onset, e.pitch.midi);
  }

  // Find common ticks, sorted
  const ticks: number[] = [];
  for (const t of map1.keys()) {
    if (map2.has(t)) ticks.push(t);
  }
  ticks.sort((a, b) => a - b);

  return ticks.map(tick =>
    Object.freeze({
      tick,
      midi1: map1.get(tick)!,
      midi2: map2.get(tick)!,
    }),
  );
}

// ---- Public API ----

/**
 * Detect parallel perfect fifths (interval 7 mod 12) between two voices.
 *
 * Checks successive beat pairs for parallel motion to/from a perfect fifth.
 *
 * @param voice1 - First voice (note events).
 * @param voice2 - Second voice (note events).
 * @returns Frozen array of ParallelViolation objects.
 */
export function checkParallelFifths(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
): readonly ParallelViolation[] {
  const pairs = alignVoices(voice1, voice2);
  const violations: ParallelViolation[] = [];

  for (let i = 1; i < pairs.length; i++) {
    const prev = pairs[i - 1]!;
    const curr = pairs[i]!;
    const prevInterval = ((Math.abs(prev.midi1 - prev.midi2)) % 12 + 12) % 12;
    const currInterval = ((Math.abs(curr.midi1 - curr.midi2)) % 12 + 12) % 12;

    if (prevInterval === 7 && currInterval === 7) {
      // Verify both voices moved (not oblique motion to a fifth)
      if (prev.midi1 !== curr.midi1 && prev.midi2 !== curr.midi2) {
        violations.push(
          Object.freeze({
            tick: curr.tick,
            interval: 7,
            description: `Parallel fifth at tick ${curr.tick}`,
          }),
        );
      }
    }
  }

  return Object.freeze(violations);
}

/**
 * Detect parallel perfect octaves/unisons (interval 0 mod 12) between two voices.
 *
 * Checks successive beat pairs for parallel motion to/from a perfect octave or unison.
 *
 * @param voice1 - First voice (note events).
 * @param voice2 - Second voice (note events).
 * @returns Frozen array of ParallelViolation objects.
 */
export function checkParallelOctaves(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
): readonly ParallelViolation[] {
  const pairs = alignVoices(voice1, voice2);
  const violations: ParallelViolation[] = [];

  for (let i = 1; i < pairs.length; i++) {
    const prev = pairs[i - 1]!;
    const curr = pairs[i]!;
    const prevInterval = ((Math.abs(prev.midi1 - prev.midi2)) % 12 + 12) % 12;
    const currInterval = ((Math.abs(curr.midi1 - curr.midi2)) % 12 + 12) % 12;

    if (prevInterval === 0 && currInterval === 0) {
      // Verify both voices moved
      if (prev.midi1 !== curr.midi1 && prev.midi2 !== curr.midi2) {
        violations.push(
          Object.freeze({
            tick: curr.tick,
            interval: 0,
            description: `Parallel octave/unison at tick ${curr.tick}`,
          }),
        );
      }
    }
  }

  return Object.freeze(violations);
}

/**
 * Detect voice crossing violations.
 *
 * Voices are expected to be ordered from highest (index 0) to lowest
 * (last index). A crossing occurs when a lower voice sounds higher than
 * an adjacent upper voice at the same onset.
 *
 * @param voices - Array of voice note-event arrays, ordered high to low.
 * @returns Frozen array of CrossingViolation objects.
 */
export function checkVoiceCrossing(
  voices: readonly (readonly NoteEvent[])[],
): readonly CrossingViolation[] {
  if (voices.length < 2) return Object.freeze([]);

  const violations: CrossingViolation[] = [];

  // Build onset→midi maps for each voice
  const maps: Map<number, number>[] = [];
  const allTicks = new Set<number>();
  for (const voice of voices) {
    const m = new Map<number, number>();
    for (const e of voice) {
      m.set(e.onset, e.pitch.midi);
      allTicks.add(e.onset);
    }
    maps.push(m);
  }

  const sortedTicks = [...allTicks].sort((a, b) => a - b);

  for (const tick of sortedTicks) {
    // Check adjacent voice pairs
    for (let i = 0; i < maps.length - 1; i++) {
      const upperMidi = maps[i]?.get(tick);
      const lowerMidi = maps[i + 1]?.get(tick);

      if (upperMidi !== undefined && lowerMidi !== undefined) {
        if (lowerMidi > upperMidi) {
          violations.push(
            Object.freeze({
              tick,
              voiceA: i,
              voiceB: i + 1,
              description: `Voice crossing at tick ${tick}: voice ${i + 1} (MIDI ${lowerMidi}) above voice ${i} (MIDI ${upperMidi})`,
            }),
          );
        }
      }
    }
  }

  return Object.freeze(violations);
}

/**
 * Check whether all events in a set fall within a MIDI range.
 *
 * @param events - Note events to check.
 * @param low - Lowest acceptable MIDI note (inclusive).
 * @param high - Highest acceptable MIDI note (inclusive).
 * @returns True if all events are within [low, high].
 * @throws {RangeError} If low > high.
 */
export function isInRange(
  events: readonly NoteEvent[],
  low: number,
  high: number,
): boolean {
  if (low > high) {
    throw new RangeError(`low must be <= high (got ${low} > ${high})`);
  }

  for (const e of events) {
    if (e.pitch.midi < low || e.pitch.midi > high) {
      return false;
    }
  }
  return true;
}

/**
 * Detect unresolved leaps (intervals > perfect fourth = 5 semitones).
 *
 * A leap should be resolved by stepwise motion (≤ 2 semitones) in the
 * opposite direction. Events are sorted by onset internally.
 *
 * @param events - Note events (a single voice).
 * @returns Frozen array of LeapViolation objects.
 */
export function checkLeapResolution(
  events: readonly NoteEvent[],
): readonly LeapViolation[] {
  if (events.length < 3) return Object.freeze([]);

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const violations: LeapViolation[] = [];

  for (let i = 0; i < sorted.length - 2; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;
    const resolution = sorted[i + 2]!;

    const leap = next.pitch.midi - curr.pitch.midi;
    const absLeap = Math.abs(leap);

    // Only flag leaps > perfect fourth (5 semitones)
    if (absLeap > 5) {
      const resolutionInterval = resolution.pitch.midi - next.pitch.midi;

      // Resolution must be step (≤ 2 semitones) in opposite direction
      const isOpposite = (leap > 0 && resolutionInterval < 0) ||
                         (leap < 0 && resolutionInterval > 0);
      const isStep = Math.abs(resolutionInterval) <= 2;

      if (!isOpposite || !isStep) {
        violations.push(
          Object.freeze({
            tick: next.onset,
            leapSize: absLeap,
            description: `Unresolved leap of ${absLeap} semitones at tick ${next.onset}`,
          }),
        );
      }
    }
  }

  return Object.freeze(violations);
}
