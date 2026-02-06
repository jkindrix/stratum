import { describe, it, expect } from 'vitest';
import {
  chordScaleMatch,
  classifyTones,
  availableTensions,
  avoidNotes,
  SCALE_CATALOG,
} from '../src/index.js';
import type { ChordLabel } from '../src/index.js';

// Helper: create a ChordLabel
function chord(name: string, symbol: string, root: number, pcs: number[]): ChordLabel {
  return { name, symbol, root, pcs };
}

const Cmaj = chord('major', 'maj', 0, [0, 4, 7]);
const Cmin = chord('minor', 'min', 0, [0, 3, 7]);
const G7 = chord('dominant 7th', '7', 7, [7, 11, 2, 5]);
const Dm7 = chord('minor 7th', 'min7', 2, [2, 5, 9, 0]);

describe('Chord-Scale Theory', () => {
  describe('classifyTones', () => {
    it('classifies C major scale tones over C major chord', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const tones = classifyTones(Cmaj, ionian, 0);

      // C (chord), D (tension), E (chord), F (avoid: half-step above E), G (chord),
      // A (tension), B (tension)
      expect(tones).toHaveLength(7);
      expect(tones[0]!.classification).toBe('chord'); // C
      expect(tones[1]!.classification).toBe('tension'); // D (whole step above C)
      expect(tones[2]!.classification).toBe('chord'); // E
      expect(tones[3]!.classification).toBe('avoid');  // F (half step above E)
      expect(tones[4]!.classification).toBe('chord'); // G
      expect(tones[5]!.classification).toBe('tension'); // A (whole step above G)
      expect(tones[6]!.classification).toBe('tension'); // B
    });

    it('returns frozen result', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const tones = classifyTones(Cmaj, ionian, 0);
      expect(Object.isFrozen(tones)).toBe(true);
      expect(Object.isFrozen(tones[0])).toBe(true);
    });

    it('assigns correct degree numbers', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const tones = classifyTones(Cmaj, ionian, 0);
      for (let i = 0; i < tones.length; i++) {
        expect(tones[i]!.degree).toBe(i + 1);
      }
    });

    it('classifies Dorian over minor chord', () => {
      const dorian = SCALE_CATALOG.find(s => s.name === 'Dorian')!;
      const tones = classifyTones(Cmin, dorian, 0);

      // C (chord), D (tension), Eb (chord), F (tension), G (chord), A (tension), Bb (tension)
      expect(tones[0]!.classification).toBe('chord'); // C
      expect(tones[2]!.classification).toBe('chord'); // Eb
      expect(tones[4]!.classification).toBe('chord'); // G
    });
  });

  describe('availableTensions', () => {
    it('finds tensions for C major with Ionian', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const tensions = availableTensions(Cmaj, ionian, 0);
      // D=2, A=9, B=11 are tensions
      expect(tensions).toContain(2);  // D
      expect(tensions).toContain(9);  // A
      expect(tensions).toContain(11); // B
    });

    it('does not include chord tones or avoid notes', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const tensions = availableTensions(Cmaj, ionian, 0);
      // Should not contain C(0), E(4), G(7) (chord tones) or F(5) (avoid)
      expect(tensions).not.toContain(0);
      expect(tensions).not.toContain(4);
      expect(tensions).not.toContain(7);
      expect(tensions).not.toContain(5);
    });

    it('returns frozen result', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const result = availableTensions(Cmaj, ionian, 0);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('avoidNotes', () => {
    it('finds F as avoid note for C major with Ionian', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const avoids = avoidNotes(Cmaj, ionian, 0);
      expect(avoids).toContain(5); // F
    });

    it('returns frozen result', () => {
      const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
      const result = avoidNotes(Cmaj, ionian, 0);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('chordScaleMatch', () => {
    it('returns compatible scales for C major chord', () => {
      const matches = chordScaleMatch(Cmaj);
      expect(matches.length).toBeGreaterThan(0);
      // Ionian at root 0 should be among top matches
      const ionianMatch = matches.find(m => m.scale.name === 'Ionian' && m.root === 0);
      expect(ionianMatch).toBeDefined();
    });

    it('results are sorted by compatibility descending', () => {
      const matches = chordScaleMatch(Cmaj);
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i]!.compatibility).toBeLessThanOrEqual(matches[i - 1]!.compatibility);
      }
    });

    it('all matches contain all chord tones', () => {
      const matches = chordScaleMatch(Cmaj);
      for (const match of matches) {
        const scalePcs = new Set(match.tones.map(t => t.pc));
        for (const ct of Cmaj.pcs) {
          expect(scalePcs.has(ct % 12)).toBe(true);
        }
      }
    });

    it('constrains by root when specified', () => {
      const matches = chordScaleMatch(Cmaj, 0);
      for (const match of matches) {
        expect(match.root).toBe(0);
      }
    });

    it('finds scales for dominant 7th chord', () => {
      const matches = chordScaleMatch(G7);
      expect(matches.length).toBeGreaterThan(0);
      // Mixolydian at G (root=7) should be compatible
      const mixoMatch = matches.find(m => m.scale.name === 'Mixolydian' && m.root === 7);
      expect(mixoMatch).toBeDefined();
    });

    it('returns frozen result', () => {
      const matches = chordScaleMatch(Cmaj);
      expect(Object.isFrozen(matches)).toBe(true);
      if (matches.length > 0) {
        expect(Object.isFrozen(matches[0])).toBe(true);
      }
    });

    it('compatibility is between 0 and 1', () => {
      const matches = chordScaleMatch(Dm7);
      for (const match of matches) {
        expect(match.compatibility).toBeGreaterThanOrEqual(0);
        expect(match.compatibility).toBeLessThanOrEqual(1);
      }
    });
  });
});
