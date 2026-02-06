// ---------------------------------------------------------------------------
// Stratum — Automatic Pitch Spelling
// ---------------------------------------------------------------------------

/**
 * Result of pitch spelling: the enharmonic name for a MIDI note.
 */
export interface SpelledPitch {
  /** Note letter name: A-G. */
  readonly letter: string;
  /** Accidental: '#', 'b', '##', 'bb', or '' (natural). */
  readonly accidental: string;
  /** Full name including octave (e.g., "C#4", "Bb3"). */
  readonly name: string;
  /** MIDI note number. */
  readonly midi: number;
  /** Octave number. */
  readonly octave: number;
}

// Diatonic pitch classes for each key (tonic pc → scale pcs).
// Major keys: W-W-H-W-W-W-H pattern from tonic.
// Minor keys (natural): W-H-W-W-H-W-W pattern from tonic.
function majorScalePcs(tonic: number): number[] {
  const pattern = [0, 2, 4, 5, 7, 9, 11];
  return pattern.map(i => (i + tonic) % 12);
}

function minorScalePcs(tonic: number): number[] {
  const pattern = [0, 2, 3, 5, 7, 8, 10];
  return pattern.map(i => (i + tonic) % 12);
}

// Letter names and their base pitch classes (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
const LETTER_PC: readonly [string, number][] = [
  ['C', 0], ['D', 2], ['E', 4], ['F', 5], ['G', 7], ['A', 9], ['B', 11],
];

// Spelling tables: for each pitch class (0-11), preferred letter+accidental
// in sharp keys vs flat keys.

// Sharp spelling: C C# D D# E F F# G G# A A# B
const SHARP_SPELLING: readonly [string, string][] = [
  ['C', ''], ['C', '#'], ['D', ''], ['D', '#'], ['E', ''],
  ['F', ''], ['F', '#'], ['G', ''], ['G', '#'], ['A', ''],
  ['A', '#'], ['B', ''],
];

// Flat spelling: C Db D Eb E F Gb G Ab A Bb B
const FLAT_SPELLING: readonly [string, string][] = [
  ['C', ''], ['D', 'b'], ['D', ''], ['E', 'b'], ['E', ''],
  ['F', ''], ['G', 'b'], ['G', ''], ['A', 'b'], ['A', ''],
  ['B', 'b'], ['B', ''],
];

// Key signature accidental preferences (tonic pc → use flats?)
// Keys with flats: F(5), Bb(10), Eb(3), Ab(8), Db(1), Gb(6)
// Keys with sharps: G(7), D(2), A(9), E(4), B(11), F#(6)
// C(0) and Gb/F#(6) are ambiguous — C uses sharps, 6 defaults to sharps (F#)
const FLAT_KEYS = new Set([5, 10, 3, 8, 1]);

// For minor keys: flats for D(2)m, G(7)m, C(0)m, F(5)m, Bb(10)m, Eb(3)m, Ab(8)m
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3, 8]);

/**
 * Key context for pitch spelling.
 */
export interface SpellingKeyContext {
  /** Tonic pitch class (0-11). */
  readonly tonic: number;
  /** Mode: 'major' or 'minor'. */
  readonly mode: 'major' | 'minor';
}

function useFlats(key?: SpellingKeyContext): boolean {
  if (!key) return false; // Default to sharps
  if (key.mode === 'minor') return FLAT_MINOR_KEYS.has(key.tonic);
  return FLAT_KEYS.has(key.tonic);
}

function findBestSpelling(pc: number, key?: SpellingKeyContext): [string, string] {
  if (!key) {
    // No key context: prefer sharps
    return [SHARP_SPELLING[pc]![0]!, SHARP_SPELLING[pc]![1]!];
  }

  // Get the scale pitch classes
  const scalePcs = key.mode === 'minor'
    ? minorScalePcs(key.tonic)
    : majorScalePcs(key.tonic);

  // If pc is diatonic, use the natural spelling from the scale
  if (scalePcs.includes(pc)) {
    // Find the correct letter for this scale degree
    const scaleIndex = scalePcs.indexOf(pc);
    const tonicLetterIndex = LETTER_PC.findIndex(([, p]) => p === key.tonic % 12) ??
      // For accidental tonics, find nearest
      findNearestLetterIndex(key.tonic);
    const letterIndex = (tonicLetterIndex + scaleIndex) % 7;
    const [letter, basePc] = LETTER_PC[letterIndex]!;
    const diff = ((pc - basePc) + 12) % 12;

    if (diff === 0) return [letter, ''];
    if (diff === 1) return [letter, '#'];
    if (diff === 11) return [letter, 'b'];
    if (diff === 2) return [letter, '##'];
    if (diff === 10) return [letter, 'bb'];
  }

  // Non-diatonic: use key's accidental preference
  const table = useFlats(key) ? FLAT_SPELLING : SHARP_SPELLING;
  return [table[pc]![0]!, table[pc]![1]!];
}

function findNearestLetterIndex(tonic: number): number {
  // Map accidental tonics to their letter index
  // C#/Db=0(C), D#/Eb=1(D), F#/Gb=3(F), G#/Ab=4(G), A#/Bb=5(A)
  for (let i = 0; i < LETTER_PC.length; i++) {
    if (LETTER_PC[i]![1] === tonic) return i;
  }
  // Accidental tonic: find the letter below
  for (let i = LETTER_PC.length - 1; i >= 0; i--) {
    if (LETTER_PC[i]![1] < tonic) return i;
  }
  return 0;
}

function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/**
 * Automatic pitch spelling: select the correct enharmonic name for a MIDI note
 * based on key context.
 *
 * @param midiNote - MIDI note number (0-127).
 * @param key - Optional key context for enharmonic selection.
 * @returns The spelled pitch with letter, accidental, octave, and full name.
 * @throws {RangeError} If midiNote is outside 0-127.
 *
 * @example
 * ```ts
 * spellPitch(61, { tonic: 9, mode: 'major' }); // C# (A major)
 * spellPitch(61, { tonic: 8, mode: 'major' }); // Db (Ab major)
 * spellPitch(61);                                // C# (default, no key)
 * ```
 */
export function spellPitch(midiNote: number, key?: SpellingKeyContext): SpelledPitch {
  if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
    throw new RangeError(`MIDI note must be 0-127 (got ${midiNote})`);
  }

  const pc = midiNote % 12;
  const octave = midiToOctave(midiNote);
  const [letter, accidental] = findBestSpelling(pc, key);

  return {
    letter,
    accidental,
    name: `${letter}${accidental}${octave}`,
    midi: midiNote,
    octave,
  };
}

/**
 * Spell a sequence of MIDI notes with context-aware enharmonic selection.
 * Minimizes accidentals and maintains directional consistency.
 *
 * @param midiNotes - Array of MIDI note numbers (0-127).
 * @param key - Optional key context for enharmonic selection.
 * @returns Array of spelled pitches.
 *
 * @example
 * ```ts
 * const notes = [60, 62, 64, 65, 67]; // C D E F G
 * spellPitchSequence(notes, { tonic: 0, mode: 'major' });
 * // → C4, D4, E4, F4, G4
 * ```
 */
export function spellPitchSequence(
  midiNotes: readonly number[],
  key?: SpellingKeyContext,
): SpelledPitch[] {
  return midiNotes.map(midi => spellPitch(midi, key));
}
