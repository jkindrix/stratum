import { describe, it, expect } from 'vitest';
import {
  enhancedRomanNumeral,
  functionalHarmonyScore,
} from '../src/index.js';
import type { ChordLabel, RomanNumeralKey } from '../src/index.js';

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
});
