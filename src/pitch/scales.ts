// ---------------------------------------------------------------------------
// Stratum — Scales, Modes, and Chords
// ---------------------------------------------------------------------------

import { normalizePc } from './pitch-class.js';
import { PitchClassSet } from './pitch-class-set.js';

// ---- Scale Types ----

/** A named scale defined by its interval pattern and pitch-class set */
export interface Scale {
  /** Human-readable scale name (e.g., 'Major', 'Dorian') */
  readonly name: string;
  /** Intervals between consecutive degrees in semitones (e.g., [2,2,1,2,2,2,1] for major) */
  readonly intervals: readonly number[];
  /** Pitch-class set representing the scale rooted at 0 */
  readonly pcs: PitchClassSet;
}

/** A named chord defined by its intervals from the root */
export interface Chord {
  /** Human-readable chord name (e.g., 'major', 'minor 7th') */
  readonly name: string;
  /** Short symbol (e.g., 'maj', 'min7', 'dim') */
  readonly symbol: string;
  /** Intervals from root in semitones (e.g., [0, 4, 7] for major triad) */
  readonly intervals: readonly number[];
  /** Pitch-class set representing the chord rooted at 0 */
  readonly pcs: PitchClassSet;
}

// ---- Scale Construction Helpers ----

function buildScaleFromIntervals(name: string, intervals: number[]): Scale {
  const pcs: number[] = [0];
  let acc = 0;
  for (let i = 0; i < intervals.length - 1; i++) {
    acc += intervals[i]!;
    pcs.push(acc);
  }
  return { name, intervals, pcs: new PitchClassSet(pcs) };
}

function buildChord(name: string, symbol: string, intervals: number[]): Chord {
  return { name, symbol, intervals, pcs: new PitchClassSet(intervals) };
}

// ---- Built-in Scale Catalog ----

// Diatonic modes (rotations of the major scale)
const MAJOR_INTERVALS = [2, 2, 1, 2, 2, 2, 1];

function rotateModeIntervals(intervals: readonly number[], steps: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < intervals.length; i++) {
    result.push(intervals[(i + steps) % intervals.length]!);
  }
  return result;
}

const DIATONIC_MODE_NAMES = [
  'Ionian',     // 0 - Major
  'Dorian',     // 1
  'Phrygian',   // 2
  'Lydian',     // 3
  'Mixolydian', // 4
  'Aeolian',    // 5 - Natural Minor
  'Locrian',    // 6
] as const;

const DIATONIC_MODES: Scale[] = DIATONIC_MODE_NAMES.map((name, i) =>
  buildScaleFromIntervals(name, rotateModeIntervals(MAJOR_INTERVALS, i)),
);

// Harmonic minor modes
const HARMONIC_MINOR_INTERVALS = [2, 1, 2, 2, 1, 3, 1];

const HARMONIC_MINOR_MODE_NAMES = [
  'Harmonic Minor',
  'Locrian #6',
  'Ionian Augmented',
  'Dorian #4',
  'Phrygian Dominant',
  'Lydian #2',
  'Super Locrian Diminished',
] as const;

const HARMONIC_MINOR_MODES: Scale[] = HARMONIC_MINOR_MODE_NAMES.map((name, i) =>
  buildScaleFromIntervals(name, rotateModeIntervals(HARMONIC_MINOR_INTERVALS, i)),
);

// Melodic minor (ascending) modes
const MELODIC_MINOR_INTERVALS = [2, 1, 2, 2, 2, 2, 1];

const MELODIC_MINOR_MODE_NAMES = [
  'Melodic Minor',
  'Dorian b2',
  'Lydian Augmented',
  'Lydian Dominant',
  'Mixolydian b6',
  'Aeolian b5',
  'Altered',
] as const;

const MELODIC_MINOR_MODES: Scale[] = MELODIC_MINOR_MODE_NAMES.map((name, i) =>
  buildScaleFromIntervals(name, rotateModeIntervals(MELODIC_MINOR_INTERVALS, i)),
);

// Other scales
const OTHER_SCALES: Scale[] = [
  buildScaleFromIntervals('Pentatonic Major', [2, 2, 3, 2, 3]),
  buildScaleFromIntervals('Pentatonic Minor', [3, 2, 2, 3, 2]),
  buildScaleFromIntervals('Blues', [3, 2, 1, 1, 3, 2]),
  buildScaleFromIntervals('Whole Tone', [2, 2, 2, 2, 2, 2]),
  buildScaleFromIntervals('Octatonic Half-Whole', [1, 2, 1, 2, 1, 2, 1, 2]),
  buildScaleFromIntervals('Octatonic Whole-Half', [2, 1, 2, 1, 2, 1, 2, 1]),
  buildScaleFromIntervals('Chromatic', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
];

/** Complete catalog of built-in scales */
export const SCALE_CATALOG: readonly Scale[] = [
  ...DIATONIC_MODES,
  ...HARMONIC_MINOR_MODES,
  ...MELODIC_MINOR_MODES,
  ...OTHER_SCALES,
];

// ---- Built-in Chord Catalog ----

/** Complete catalog of built-in chord types */
export const CHORD_CATALOG: readonly Chord[] = [
  // Triads
  buildChord('major', 'maj', [0, 4, 7]),
  buildChord('minor', 'min', [0, 3, 7]),
  buildChord('diminished', 'dim', [0, 3, 6]),
  buildChord('augmented', 'aug', [0, 4, 8]),

  // Seventh chords
  buildChord('dominant 7th', '7', [0, 4, 7, 10]),
  buildChord('major 7th', 'maj7', [0, 4, 7, 11]),
  buildChord('minor 7th', 'min7', [0, 3, 7, 10]),
  buildChord('half-diminished 7th', 'm7b5', [0, 3, 6, 10]),
  buildChord('diminished 7th', 'dim7', [0, 3, 6, 9]),
  buildChord('minor-major 7th', 'mMaj7', [0, 3, 7, 11]),
  buildChord('augmented-major 7th', 'augMaj7', [0, 4, 8, 11]),

  // Extended chords
  buildChord('dominant 9th', '9', [0, 4, 7, 10, 14]),
  buildChord('major 9th', 'maj9', [0, 4, 7, 11, 14]),
  buildChord('minor 9th', 'min9', [0, 3, 7, 10, 14]),
  buildChord('dominant 11th', '11', [0, 4, 7, 10, 14, 17]),
  buildChord('major 11th', 'maj11', [0, 4, 7, 11, 14, 17]),
  buildChord('minor 11th', 'min11', [0, 3, 7, 10, 14, 17]),
  buildChord('dominant 13th', '13', [0, 4, 7, 10, 14, 17, 21]),
  buildChord('major 13th', 'maj13', [0, 4, 7, 11, 14, 17, 21]),
  buildChord('minor 13th', 'min13', [0, 3, 7, 10, 14, 17, 21]),

  // Suspended
  buildChord('suspended 2nd', 'sus2', [0, 2, 7]),
  buildChord('suspended 4th', 'sus4', [0, 5, 7]),

  // Added-tone
  buildChord('add 9', 'add9', [0, 4, 7, 14]),
  buildChord('add 11', 'add11', [0, 4, 7, 17]),
  buildChord('6th', '6', [0, 4, 7, 9]),
  buildChord('6/9', '6/9', [0, 4, 7, 9, 14]),

  // Power chord
  buildChord('power chord', '5', [0, 7]),
];

// ---- Scale Functions ----

/**
 * Identify a scale from a pitch-class set.
 * Compares by prime form equivalence, so any transposition or mode rotation will match.
 * @param pcs - The pitch-class set to identify.
 * @returns The matching Scale from the catalog (rooted at 0), or null if not found.
 */
export function scaleFromPcs(pcs: PitchClassSet): Scale | null {
  const primeKey = pcs.primeForm().join(',');
  for (const scale of SCALE_CATALOG) {
    if (scale.pcs.primeForm().join(',') === primeKey) {
      return scale;
    }
  }
  return null;
}

/**
 * Build a scale from an interval pattern.
 * @param name — Name for the resulting scale.
 * @param intervals — Step sizes in semitones (e.g., [2,2,1,2,2,2,1]).
 */
export function scaleFromIntervals(name: string, intervals: number[]): Scale {
  if (intervals.length === 0) {
    throw new Error('Scale must have at least one interval');
  }
  return buildScaleFromIntervals(name, intervals);
}

/**
 * Rotate a scale to produce a mode.
 * @param scale — The base scale.
 * @param degree — 0-based mode degree (0 = same scale, 1 = start from 2nd degree, etc.).
 */
export function modeRotation(scale: Scale, degree: number): Scale {
  const n = scale.intervals.length;
  const d = ((degree % n) + n) % n;
  const rotated = rotateModeIntervals(scale.intervals, d);
  return buildScaleFromIntervals(`${scale.name} mode ${d}`, rotated);
}

// ---- Chord Functions ----

/**
 * Identify a chord from pitch classes.
 * Tries all transpositions to match against the catalog.
 * @param pcs — The pitch-class set to identify.
 * @param root — Optional root pitch class to constrain the search.
 * @returns The matching Chord and detected root, or null.
 */
export function chordFromPcs(
  pcs: PitchClassSet,
  root?: number,
): { chord: Chord; root: number } | null {
  const members = [...pcs.pcs];
  if (members.length === 0) return null;

  // If root is specified, only try that transposition
  const roots = root !== undefined ? [normalizePc(root)] : members;

  for (const r of roots) {
    const transposed = new PitchClassSet(members.map(pc => pc - r));
    const transKey = transposed.pcs.join(',');

    for (const chord of CHORD_CATALOG) {
      if (chord.pcs.pcs.join(',') === transKey) {
        return { chord, root: r };
      }
    }
  }

  return null;
}

/**
 * Build a chord from a name string (e.g., "Cmaj7", "F#min", "Bb7").
 * @param name — Chord name starting with root note.
 * @throws {Error} If the name can't be parsed or the quality is unknown.
 */
export function chordFromName(name: string): { chord: Chord; root: number } {
  const match = name.match(/^([A-Ga-g])(#|b)?(.*)$/);
  if (!match) throw new Error(`Invalid chord name: ${name}`);

  const letter = match[1]!.toUpperCase();
  const accidental = match[2] ?? '';
  const quality = match[3] || 'maj';

  const letterMap: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let root = letterMap[letter];
  if (root === undefined) throw new Error(`Invalid note letter: ${letter}`);
  if (accidental === '#') root = normalizePc(root + 1);
  if (accidental === 'b') root = normalizePc(root - 1);

  // Find chord by symbol
  const chord = CHORD_CATALOG.find(c => c.symbol === quality);
  if (!chord) throw new Error(`Unknown chord quality: ${quality}`);

  return { chord, root };
}

/**
 * Build a chord from a root pitch class and intervals.
 * @param root — Root pitch class (0-11).
 * @param intervals — Intervals from root in semitones.
 */
export function chordFromIntervals(root: number, intervals: number[]): PitchClassSet {
  return new PitchClassSet(intervals.map(i => root + i));
}
