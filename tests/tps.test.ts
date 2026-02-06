import { describe, it, expect } from 'vitest';
import {
  basicSpace,
  tpsDistance,
  surfaceDissonance,
  melodicAttraction,
} from '../src/index.js';
import type { TPSKey, TPSChord } from '../src/index.js';

const Cmaj: TPSKey = { tonic: 0, mode: 'major' };

const I: TPSChord = { root: 0, pcs: [0, 4, 7] };     // C major
const V: TPSChord = { root: 7, pcs: [7, 11, 2] };     // G major
const IV: TPSChord = { root: 5, pcs: [5, 9, 0] };     // F major
const bVI: TPSChord = { root: 8, pcs: [8, 0, 3] };    // Ab major
const bII: TPSChord = { root: 1, pcs: [1, 5, 8] };    // Db major (Neapolitan)

describe('Tonal Pitch Space (Lerdahl)', () => {
  describe('basicSpace', () => {
    it('returns 12-element array', () => {
      const space = basicSpace(I, Cmaj);
      expect(space).toHaveLength(12);
    });

    it('root has level 5', () => {
      const space = basicSpace(I, Cmaj);
      expect(space[0]).toBe(5); // C is root of I
    });

    it('fifth has level 4', () => {
      const space = basicSpace(I, Cmaj);
      expect(space[7]).toBe(4); // G is fifth of C major triad
    });

    it('chord tone (not root/fifth) has level 3', () => {
      const space = basicSpace(I, Cmaj);
      expect(space[4]).toBe(3); // E is third of C major triad
    });

    it('diatonic non-chord tone has level 2', () => {
      const space = basicSpace(I, Cmaj);
      expect(space[2]).toBe(2); // D is diatonic but not in C major triad
    });

    it('chromatic tone has level 1', () => {
      const space = basicSpace(I, Cmaj);
      expect(space[1]).toBe(1); // C# is chromatic in C major
    });
  });

  describe('tpsDistance', () => {
    it('identical chord in same key → 0', () => {
      expect(tpsDistance(I, Cmaj, I, Cmaj)).toBe(0);
    });

    it('I → V distance < I → bVI distance', () => {
      const dV = tpsDistance(I, Cmaj, V, Cmaj);
      const dBVI = tpsDistance(I, Cmaj, bVI, Cmaj);
      expect(dV).toBeLessThan(dBVI);
    });

    it('I → IV is close (diatonic neighbor)', () => {
      const d = tpsDistance(I, Cmaj, IV, Cmaj);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(20);
    });

    it('I → bII (Neapolitan) is distant', () => {
      const dBII = tpsDistance(I, Cmaj, bII, Cmaj);
      const dV = tpsDistance(I, Cmaj, V, Cmaj);
      expect(dBII).toBeGreaterThan(dV);
    });

    it('modulation increases distance (same chord, different key)', () => {
      const Gmaj: TPSKey = { tonic: 7, mode: 'major' };
      const sameKey = tpsDistance(V, Cmaj, V, Cmaj);
      const diffKey = tpsDistance(V, Cmaj, V, Gmaj);
      expect(diffKey).toBeGreaterThanOrEqual(sameKey);
    });
  });

  describe('surfaceDissonance', () => {
    it('all chord tones → 0 dissonance', () => {
      expect(surfaceDissonance([0, 4, 7], I)).toBe(0);
    });

    it('non-chord tone adds dissonance', () => {
      // D (pc=2) over C major chord
      expect(surfaceDissonance([0, 2, 4, 7], I)).toBeGreaterThan(0);
    });

    it('chromatic non-chord tone adds more dissonance than diatonic', () => {
      // F (pc=5) is 1 semitone from E — close neighbor
      const diatonicDissonance = surfaceDissonance([5], I);
      // F# (pc=6) is 1 from G but 2 from E — less close
      const chromaticDissonance = surfaceDissonance([6], I);
      // Both should be positive
      expect(diatonicDissonance).toBeGreaterThan(0);
      expect(chromaticDissonance).toBeGreaterThan(0);
    });

    it('multiple non-chord tones accumulate', () => {
      const one = surfaceDissonance([1], I);   // C#
      const two = surfaceDissonance([1, 6], I); // C# and F#
      expect(two).toBeGreaterThan(one);
    });

    it('empty events → 0', () => {
      expect(surfaceDissonance([], I)).toBe(0);
    });
  });

  describe('melodicAttraction', () => {
    it('no attraction to self (distance 0)', () => {
      expect(melodicAttraction(0, 0, Cmaj)).toBe(0);
    });

    it('semitone neighbor has stronger attraction than whole-tone neighbor', () => {
      // B→C (semitone) vs A→C (whole tone) in C major
      const semiAttr = melodicAttraction(11, 0, Cmaj);  // B→C
      const wholeAttr = melodicAttraction(9, 0, Cmaj);   // A→C
      expect(semiAttr).toBeGreaterThan(wholeAttr);
    });

    it('attraction to tonic is strong', () => {
      // E→C attraction should be positive
      const attr = melodicAttraction(4, 0, Cmaj);
      expect(attr).toBeGreaterThan(0);
    });

    it('attraction decreases with distance', () => {
      const attr1 = melodicAttraction(11, 0, Cmaj);  // semitone
      const attr3 = melodicAttraction(9, 0, Cmaj);   // whole tone
      expect(attr1).toBeGreaterThan(attr3);
    });
  });
});
