// ---------------------------------------------------------------------------
// Stratum — Pitch Class Operations
// ---------------------------------------------------------------------------

import type { Pitch } from '../core/types.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/**
 * Normalize a pitch class to the 0-11 range. Handles negative values.
 * @param pc - Any integer representing a pitch class.
 * @returns The pitch class normalized to 0-11.
 */
export function normalizePc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

/**
 * Create a Pitch from pitch class and octave.
 * @param pc — Pitch class (will be normalized to 0-11).
 * @param octave — Octave number (4 = middle octave).
 * @throws {RangeError} If resulting MIDI value is outside 0-127.
 */
export function pitchFromPcOctave(pc: number, octave: number): Pitch {
  const normalized = normalizePc(pc);
  const midi = (octave + 1) * 12 + normalized;
  if (midi < 0 || midi > 127) {
    throw new RangeError(
      `Pitch class ${normalized} in octave ${octave} yields MIDI ${midi}, which is outside 0-127`,
    );
  }
  return { midi, pitchClass: normalized, octave };
}

/**
 * Get frequency in Hz for a pitch using 12-TET tuning.
 * @param pitch — The Pitch to convert.
 * @param tuningHz — A4 reference frequency (default 440).
 */
export function pitchToFrequency(pitch: Pitch, tuningHz = 440): number {
  const cents = pitch.centsDeviation ?? 0;
  return tuningHz * Math.pow(2, (pitch.midi - 69 + cents / 100) / 12);
}

/**
 * Get the nearest Pitch for a given frequency.
 * @param freq — Frequency in Hz (must be > 0).
 * @param tuningHz — A4 reference frequency (default 440).
 * @throws {RangeError} If freq is not positive.
 */
export function frequencyToPitch(freq: number, tuningHz = 440): Pitch {
  if (!Number.isFinite(freq) || freq <= 0) {
    throw new RangeError(`frequency must be > 0 (got ${freq})`);
  }
  const midiExact = 69 + 12 * Math.log2(freq / tuningHz);
  const midi = Math.round(midiExact);
  const clamped = Math.max(0, Math.min(127, midi));
  const centsDeviation = Math.round((midiExact - clamped) * 100);
  return {
    midi: clamped,
    pitchClass: clamped % 12,
    octave: Math.floor(clamped / 12) - 1,
    ...(Math.abs(centsDeviation) > 0.5 ? { centsDeviation } : {}),
  };
}

/**
 * Get sharp name for a pitch class: C, C#, D, ... B.
 * @param pc - Pitch class (will be normalized to 0-11).
 * @returns Sharp note name string.
 */
export function pitchClassName(pc: number): string {
  return NOTE_NAMES[normalizePc(pc)]!;
}

/**
 * Get flat name for a pitch class: C, Db, D, ... B.
 * @param pc - Pitch class (will be normalized to 0-11).
 * @returns Flat note name string.
 */
export function pitchClassFlatName(pc: number): string {
  return FLAT_NAMES[normalizePc(pc)]!;
}

/**
 * Get full pitch name with octave: C4, F#5, etc.
 * @param pitch - The Pitch to name.
 * @returns Note name with octave (e.g. 'C4', 'F#5').
 */
export function pitchName(pitch: Pitch): string {
  return `${pitchClassName(pitch.pitchClass)}${pitch.octave}`;
}

/**
 * Parse a pitch name like "C4", "F#5", "Bb3" into a Pitch.
 * @throws {Error} If name doesn't match expected format.
 * @throws {RangeError} If resulting MIDI value is outside 0-127.
 */
export function parsePitchName(name: string): Pitch {
  const match = name.match(/^([A-Ga-g])(#|b)?(-?\d+)$/);
  if (!match) throw new Error(`Invalid pitch name: ${name}`);

  const letter = match[1]!.toUpperCase();
  const accidental = match[2] ?? '';
  const octave = parseInt(match[3]!, 10);

  const letterMap: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let pc = letterMap[letter];
  if (pc === undefined) throw new Error(`Invalid note letter: ${letter}`);
  if (accidental === '#') pc++;
  if (accidental === 'b') pc--;

  return pitchFromPcOctave(pc, octave);
}
