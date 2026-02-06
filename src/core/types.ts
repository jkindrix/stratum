// ---------------------------------------------------------------------------
// Stratum — Core Types
// ---------------------------------------------------------------------------

/** Articulation markings that modify how a note is performed. */
export type Articulation =
  | 'staccato'
  | 'tenuto'
  | 'accent'
  | 'marcato'
  | 'legato'
  | 'fermata';

/**
 * Mapping between a symbolic dynamic marking and its typical velocity.
 * Used as a reference table, not stored on individual events.
 */
export interface DynamicMarking {
  /** Symbolic label (pp, p, mp, mf, f, ff, etc.) */
  label: string;
  /** Typical MIDI velocity for this dynamic level (0-127) */
  velocity: number;
}

/**
 * Pitch with multiple reference frames.
 *
 * Every pitch carries its MIDI note number, pitch class (0-11),
 * and octave. An optional `centsDeviation` field supports microtonal
 * offsets from 12-TET.
 */
export interface Pitch {
  /** MIDI note number (0-127). Middle C = 60. */
  midi: number;
  /** Pitch class (0-11). 0 = C, 1 = C♯, 2 = D, … 11 = B */
  pitchClass: number;
  /** Octave number. Middle C = octave 4. */
  octave: number;
  /**
   * Deviation from 12-TET in cents.
   * Positive = sharp of equal temperament, negative = flat.
   * Defaults to 0 when omitted.
   */
  centsDeviation?: number;
}

/** A note event in the score. */
export interface NoteEvent {
  /** Unique event identifier */
  id: string;
  /** Pitch of the note */
  pitch: Pitch;
  /** Onset time in ticks from score start (≥ 0) */
  onset: number;
  /** Duration in ticks (> 0) */
  duration: number;
  /** Velocity (0-127) */
  velocity: number;
  /** Voice index within a part (0-based) */
  voice: number;
  /** Optional articulation marking */
  articulation?: Articulation;
}

/** Time signature at a specific point in the score. */
export interface TimeSignature {
  /** Beats per measure */
  numerator: number;
  /** Beat unit denominator (4 = quarter, 8 = eighth). Must be a power of 2. */
  denominator: number;
  /** Tick where this time signature takes effect */
  atTick: number;
}

/** Tempo marking at a specific point in the score. */
export interface TempoMark {
  /** Beats per minute (> 0) */
  bpm: number;
  /** Tick where this tempo takes effect */
  atTick: number;
}

/** Key center at a specific point in the score. */
export interface KeyCenter {
  /** Tonic pitch class (0-11). 0 = C, 2 = D, etc. */
  tonic: number;
  /** Mode or scale name (e.g. 'major', 'minor', 'dorian'). */
  mode: string;
  /** Tick where this key center takes effect */
  atTick: number;
}

/** An instrument part in the score. */
export interface Part {
  /** Part identifier */
  id: string;
  /** Display name */
  name: string;
  /** MIDI program number (0-127) */
  midiProgram: number;
  /** MIDI channel (0-15) */
  midiChannel: number;
  /** Note events, sorted by onset */
  events: NoteEvent[];
}

/**
 * A tuning system defines how pitch steps map to frequencies.
 *
 * The interface is deliberately generic: it covers equal temperaments
 * (N-TET), just intonation, and arbitrary temperaments.
 */
export interface TuningSystem {
  /** Human-readable name (e.g. "12-TET", "5-limit JI"). */
  name: string;
  /** Number of pitch steps per octave (12 for standard). */
  stepsPerOctave: number;
  /**
   * Return the frequency in Hz for a given step and octave.
   * @param step — Step index within the octave (0-based).
   * @param octave — Octave number (4 = middle octave).
   * @param refHz — Reference frequency for A4 (default 440).
   */
  frequencyAt(step: number, octave: number, refHz?: number): number;
}

/** Score-wide settings. */
export interface ScoreSettings {
  /** Ticks per quarter note (> 0) */
  ticksPerQuarter: number;
  /** A4 reference frequency in Hz (> 0) */
  tuningHz: number;
  /** Optional tuning system. When omitted, 12-TET is assumed. */
  tuningSystem?: TuningSystem;
}

/** Complete score. */
export interface Score {
  metadata: {
    title: string;
    composer: string;
  };
  settings: ScoreSettings;
  parts: Part[];
  timeSignatures: TimeSignature[];
  tempoChanges: TempoMark[];
  /** Key centers over time. Empty array if unspecified. */
  keyCenters: KeyCenter[];
}
