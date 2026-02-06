import { describe, it, expect } from 'vitest';
import { spellPitch, spellPitchSequence } from '../src/index.js';

describe('Pitch Spelling', () => {
  describe('spellPitch', () => {
    it('spells natural notes without accidentals', () => {
      const c4 = spellPitch(60);
      expect(c4.letter).toBe('C');
      expect(c4.accidental).toBe('');
      expect(c4.name).toBe('C4');
      expect(c4.octave).toBe(4);
    });

    it('defaults to sharp spelling without key context', () => {
      const cs = spellPitch(61);
      expect(cs.letter).toBe('C');
      expect(cs.accidental).toBe('#');
      expect(cs.name).toBe('C#4');
    });

    it('MIDI 61 in A major → C#', () => {
      const result = spellPitch(61, { tonic: 9, mode: 'major' });
      expect(result.letter).toBe('C');
      expect(result.accidental).toBe('#');
    });

    it('MIDI 61 in Ab major → Db', () => {
      const result = spellPitch(61, { tonic: 8, mode: 'major' });
      expect(result.letter).toBe('D');
      expect(result.accidental).toBe('b');
    });

    it('spells diatonic notes naturally in C major', () => {
      const key = { tonic: 0, mode: 'major' as const };
      expect(spellPitch(60, key).name).toBe('C4');
      expect(spellPitch(62, key).name).toBe('D4');
      expect(spellPitch(64, key).name).toBe('E4');
      expect(spellPitch(65, key).name).toBe('F4');
      expect(spellPitch(67, key).name).toBe('G4');
      expect(spellPitch(69, key).name).toBe('A4');
      expect(spellPitch(71, key).name).toBe('B4');
    });

    it('handles octave boundaries', () => {
      const c0 = spellPitch(0);
      expect(c0.octave).toBe(-1);
      expect(c0.name).toBe('C-1');

      const g9 = spellPitch(127);
      expect(g9.octave).toBe(9);
    });

    it('handles Bb in F major (flat key)', () => {
      const result = spellPitch(70, { tonic: 5, mode: 'major' });
      expect(result.letter).toBe('B');
      expect(result.accidental).toBe('b');
    });

    it('handles F# in G major (sharp key)', () => {
      const result = spellPitch(66, { tonic: 7, mode: 'major' });
      expect(result.letter).toBe('F');
      expect(result.accidental).toBe('#');
    });

    it('minor keys: Eb in C minor', () => {
      const result = spellPitch(63, { tonic: 0, mode: 'minor' });
      expect(result.accidental).toBe('b');
    });

    it('throws on out-of-range MIDI', () => {
      expect(() => spellPitch(-1)).toThrow('0-127');
      expect(() => spellPitch(128)).toThrow('0-127');
      expect(() => spellPitch(60.5)).toThrow('0-127');
    });
  });

  describe('spellPitchSequence', () => {
    it('spells C major scale correctly', () => {
      const notes = [60, 62, 64, 65, 67, 69, 71];
      const result = spellPitchSequence(notes, { tonic: 0, mode: 'major' });
      expect(result).toHaveLength(7);
      expect(result.map(r => r.letter)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
      expect(result.every(r => r.accidental === '')).toBe(true);
    });

    it('spells G major scale with F#', () => {
      const notes = [67, 69, 71, 72, 74, 76, 78];
      const result = spellPitchSequence(notes, { tonic: 7, mode: 'major' });
      const fSharp = result.find(r => r.midi === 78);
      expect(fSharp?.letter).toBe('F');
      expect(fSharp?.accidental).toBe('#');
    });

    it('handles empty sequence', () => {
      expect(spellPitchSequence([])).toEqual([]);
    });

    it('defaults to sharps without key context', () => {
      const result = spellPitchSequence([61, 63, 66, 68, 70]);
      // All should use sharp spellings
      expect(result[0]!.accidental).toBe('#'); // C#
    });
  });
});
