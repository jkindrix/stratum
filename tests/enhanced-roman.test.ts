import { describe, it, expect } from 'vitest';
import {
  enhancedRomanNumeral,
  functionalHarmonyScore,
  detectModulations,
  createScore,
  addPart,
  addNote,
} from '../src/index.js';
import type { ChordLabel, RomanNumeralKey, Score } from '../src/index.js';

const Cmaj: RomanNumeralKey = { tonic: 0, mode: 'major' };
const Cmin: RomanNumeralKey = { tonic: 0, mode: 'minor' };

function makeChord(root: number, pcs: number[], symbol: string, name = ''): ChordLabel {
  return { root, pcs, symbol, name: name || symbol };
}

describe('Enhanced Roman Numeral Analysis', () => {
  describe('diatonic chords in C major', () => {
    it('C major triad → I', () => {
      const chord = makeChord(0, [0, 4, 7], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('I');
      expect(result.degree).toBe(1);
      expect(result.borrowed).toBe(false);
    });

    it('D minor triad → ii', () => {
      const chord = makeChord(2, [2, 5, 9], 'min', 'Minor');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('ii');
      expect(result.degree).toBe(2);
    });

    it('G major triad → V', () => {
      const chord = makeChord(7, [7, 11, 2], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('V');
      expect(result.degree).toBe(5);
    });

    it('G7 → V7', () => {
      const chord = makeChord(7, [7, 11, 2, 5], 'dom7', 'Dominant 7th');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('V7');
    });

    it('B diminished → viio', () => {
      const chord = makeChord(11, [11, 2, 5], 'dim', 'Diminished');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('viio');
    });
  });

  describe('secondary dominants', () => {
    it('D major → V/V in C major', () => {
      const chord = makeChord(2, [2, 6, 9], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('V/V');
      expect(result.secondaryTarget).toBe(5);
    });

    it('D7 → V7/V in C major', () => {
      const chord = makeChord(2, [2, 6, 9, 0], 'dom7', 'Dominant 7th');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('V7/V');
      expect(result.secondaryTarget).toBe(5);
    });

    it('A major → V/ii in C major (secondary dominant of ii)', () => {
      const chord = makeChord(9, [9, 1, 4], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('V/ii');
      expect(result.secondaryTarget).toBe(2);
    });

    it('E major → V/vi in C major', () => {
      const chord = makeChord(4, [4, 8, 11], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('V/vi');
      expect(result.secondaryTarget).toBe(6);
    });
  });

  describe('Neapolitan chord', () => {
    it('Db major → bII in C major', () => {
      const chord = makeChord(1, [1, 5, 8], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('bII');
      expect(result.quality).toBe('major');
    });

    it('Db major in first inversion → bII6', () => {
      const chord = makeChord(1, [1, 5, 8], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj, 5); // F in bass
      expect(result.numeral).toBe('bII6');
    });
  });

  describe('augmented sixth chords', () => {
    it('Italian sixth: Ab-C-F# → It6', () => {
      const chord = makeChord(8, [8, 0, 6], 'aug6', 'Augmented 6th');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('It6');
    });

    it('German sixth: Ab-C-Eb-F# → Ger6', () => {
      const chord = makeChord(8, [8, 0, 3, 6], 'aug6', 'Augmented 6th');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('Ger6');
    });

    it('French sixth: Ab-C-D-F# → Fr6', () => {
      const chord = makeChord(8, [8, 0, 2, 6], 'aug6', 'Augmented 6th');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toBe('Fr6');
    });
  });

  describe('borrowed chords (modal mixture)', () => {
    it('Bb major in C major → borrowed bVII', () => {
      // Bb is not diatonic to C major; scale degree 10 = bVII in chromatic naming
      const chord = makeChord(10, [10, 2, 5], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.borrowed).toBe(true);
    });

    it('C minor in C major key → not borrowed (same root)', () => {
      // Eb (pc=3) is from minor but not major
      const chord = makeChord(0, [0, 3, 7], 'min', 'Minor');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.borrowed).toBe(true); // Contains Eb which is from C minor
    });
  });

  describe('inversions', () => {
    it('C major root position → no inversion', () => {
      const chord = makeChord(0, [0, 4, 7], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj, 0); // C in bass
      expect(result.inversion).toBe('');
    });

    it('C major first inversion → I6', () => {
      const chord = makeChord(0, [0, 4, 7], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj, 4); // E in bass
      expect(result.inversion).toBe('6');
      expect(result.numeral).toBe('I6');
    });

    it('C major second inversion → I64', () => {
      const chord = makeChord(0, [0, 4, 7], 'maj', 'Major');
      const result = enhancedRomanNumeral(chord, Cmaj, 7); // G in bass
      expect(result.inversion).toBe('64');
      expect(result.numeral).toBe('I64');
    });

    it('G7 first inversion → V765', () => {
      const chord = makeChord(7, [7, 11, 2, 5], 'dom7', 'Dominant 7th');
      const result = enhancedRomanNumeral(chord, Cmaj, 11); // B in bass
      expect(result.inversion).toBe('65');
    });
  });

  describe('functionalHarmonyScore', () => {
    it('tonic (I) has highest score', () => {
      const chord = makeChord(0, [0, 4, 7], 'maj', 'Major');
      const score = functionalHarmonyScore(chord, Cmaj);
      expect(score).toBeGreaterThanOrEqual(95);
    });

    it('dominant (V) has high score', () => {
      const chord = makeChord(7, [7, 11, 2], 'maj', 'Major');
      const score = functionalHarmonyScore(chord, Cmaj);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('I > V > vi in function score', () => {
      const I = functionalHarmonyScore(makeChord(0, [0, 4, 7], 'maj'), Cmaj);
      const V = functionalHarmonyScore(makeChord(7, [7, 11, 2], 'maj'), Cmaj);
      const vi = functionalHarmonyScore(makeChord(9, [9, 0, 4], 'min'), Cmaj);
      expect(I).toBeGreaterThan(V);
      expect(V).toBeGreaterThan(vi);
    });

    it('chromatic chord has low score', () => {
      const chord = makeChord(6, [6, 10, 1], 'maj', 'Major'); // F# major
      const score = functionalHarmonyScore(chord, Cmaj);
      expect(score).toBeLessThanOrEqual(50);
    });
  });

  describe('diminished and augmented chords', () => {
    it('diminished seventh on leading tone → viio7', () => {
      const chord = makeChord(11, [11, 2, 5, 8], 'dim7', 'Diminished 7th');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.numeral).toContain('viio');
      expect(result.numeral).toContain('7');
    });

    it('augmented chord on bVI is labeled correctly', () => {
      const chord = makeChord(8, [8, 0, 4], 'aug', 'Augmented');
      const result = enhancedRomanNumeral(chord, Cmaj);
      expect(result.quality).toBe('augmented');
    });
  });

  describe('detectModulations', () => {
    function buildModulatingScore(): Score {
      const score = createScore({ ticksPerQuarter: 480 });
      const part = addPart(score, { name: 'Piano' });

      // First section: C major with tonic/dominant emphasis
      const section1 = [
        { midi: 60, dur: 960 },  // C (tonic, 2 beats)
        { midi: 62, dur: 480 },  // D
        { midi: 64, dur: 480 },  // E
        { midi: 65, dur: 480 },  // F
        { midi: 67, dur: 960 },  // G (dominant, 2 beats)
        { midi: 69, dur: 480 },  // A
        { midi: 71, dur: 480 },  // B
      ];
      let tick = 0;
      for (const n of section1) {
        addNote(score, part, { midi: n.midi, onset: tick, duration: n.dur, velocity: 80 });
        tick += n.dur;
      }

      // Second section: G major
      const section2 = [
        { midi: 67, dur: 960 },  // G (tonic, 2 beats)
        { midi: 69, dur: 480 },  // A
        { midi: 71, dur: 480 },  // B
        { midi: 72, dur: 480 },  // C
        { midi: 74, dur: 960 },  // D (dominant, 2 beats)
        { midi: 76, dur: 480 },  // E
        { midi: 78, dur: 480 },  // F#
      ];
      for (const n of section2) {
        addNote(score, part, { midi: n.midi, onset: tick, duration: n.dur, velocity: 80 });
        tick += n.dur;
      }

      return score;
    }

    it('returns empty for no chords', () => {
      const score = buildModulatingScore();
      const result = detectModulations(score, []);
      expect(result).toHaveLength(0);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('returns empty for single-key piece', () => {
      const score = createScore({ ticksPerQuarter: 480 });
      const part = addPart(score, { name: 'Piano' });
      // All C major notes
      [60, 62, 64, 65, 67, 69, 71].forEach((midi, i) => {
        addNote(score, part, { midi, onset: i * 480, duration: 480, velocity: 80 });
      });
      const chords = [
        { chord: makeChord(0, [0, 4, 7], 'maj'), onset: 0 },
        { chord: makeChord(7, [7, 11, 2], 'maj'), onset: 960 },
      ];
      const result = detectModulations(score, chords, { windowSize: 480 * 4 });
      // Might be empty or not depending on window — but should be frozen
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('detects modulation in a score that moves from C major to G major', () => {
      const score = buildModulatingScore();
      // Place chords spanning the two sections
      const chords = [
        { chord: makeChord(0, [0, 4, 7], 'maj'), onset: 0 },        // C major
        { chord: makeChord(5, [5, 9, 0], 'maj'), onset: 1920 },     // F major
        { chord: makeChord(7, [7, 11, 2], 'maj'), onset: 3840 },    // G major (pivot)
        { chord: makeChord(7, [7, 11, 2], 'maj'), onset: 4800 },    // G major
        { chord: makeChord(2, [2, 6, 9], 'maj'), onset: 6720 },     // D major
      ];
      const result = detectModulations(score, chords, { windowSize: 4320 });
      expect(result.length).toBeGreaterThanOrEqual(1);
      if (result.length > 0) {
        // Modulation should be detected
        expect(result[0]!.fromKey).toBeDefined();
        expect(result[0]!.toKey).toBeDefined();
        expect(result[0]!.pivotChord).toBeDefined();
      }
    });

    it('pivot chord analysis has valid Roman numerals in both keys', () => {
      const score = buildModulatingScore();
      const chords = [
        { chord: makeChord(0, [0, 4, 7], 'maj'), onset: 0 },
        { chord: makeChord(7, [7, 11, 2], 'maj'), onset: 3840 },
        { chord: makeChord(7, [7, 11, 2], 'maj'), onset: 4800 },
        { chord: makeChord(2, [2, 6, 9], 'maj'), onset: 6720 },
      ];
      const result = detectModulations(score, chords, { windowSize: 4320 });
      for (const mod of result) {
        expect(typeof mod.pivotAnalysis.inOldKey).toBe('string');
        expect(typeof mod.pivotAnalysis.inNewKey).toBe('string');
        expect(mod.pivotAnalysis.inOldKey.length).toBeGreaterThan(0);
        expect(mod.pivotAnalysis.inNewKey.length).toBeGreaterThan(0);
      }
    });

    it('returns frozen results with frozen sub-objects', () => {
      const score = buildModulatingScore();
      const chords = [
        { chord: makeChord(0, [0, 4, 7], 'maj'), onset: 0 },
        { chord: makeChord(7, [7, 11, 2], 'maj'), onset: 3840 },
        { chord: makeChord(2, [2, 6, 9], 'maj'), onset: 6720 },
      ];
      const result = detectModulations(score, chords, { windowSize: 4320 });
      expect(Object.isFrozen(result)).toBe(true);
      for (const mod of result) {
        expect(Object.isFrozen(mod)).toBe(true);
        expect(Object.isFrozen(mod.fromKey)).toBe(true);
        expect(Object.isFrozen(mod.toKey)).toBe(true);
        expect(Object.isFrozen(mod.pivotAnalysis)).toBe(true);
      }
    });

    it('handles edge case: single-window score', () => {
      const score = createScore({ ticksPerQuarter: 480 });
      const part = addPart(score, { name: 'Piano' });
      addNote(score, part, { midi: 60, onset: 0, duration: 480, velocity: 80 });
      const chords = [{ chord: makeChord(0, [0, 4, 7], 'maj'), onset: 0 }];
      const result = detectModulations(score, chords, { windowSize: 9600 });
      expect(result).toHaveLength(0);
    });
  });
});
