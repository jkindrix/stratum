import { describe, it, expect } from 'vitest';
import {
  PitchClassSet,
  icvsim,
  angleSimilarity,
  pcSetCosine,
  zRelation,
  earthMoversDistance,
} from '../src/index.js';

describe('PCS Similarity', () => {
  describe('icvsim', () => {
    it('identical sets yield 1.0', () => {
      const a = new PitchClassSet([0, 4, 7]); // major triad
      expect(icvsim(a, a)).toBeCloseTo(1.0);
    });

    it('similar sets yield high score', () => {
      const major = new PitchClassSet([0, 4, 7]);
      const minor = new PitchClassSet([0, 3, 7]);
      expect(icvsim(major, minor)).toBeGreaterThan(0.3);
    });

    it('maximally different sets yield low score', () => {
      const a = new PitchClassSet([0, 1, 2]); // chromatic cluster
      const b = new PitchClassSet([0, 4, 8]); // augmented triad
      const sim = icvsim(a, b);
      expect(sim).toBeLessThan(0.8);
    });

    it('handles single-element sets gracefully', () => {
      const a = new PitchClassSet([0]);
      const b = new PitchClassSet([7]);
      // Single elements have all-zero ICV → correlation is 0
      expect(icvsim(a, b)).toBe(0);
    });
  });

  describe('angleSimilarity', () => {
    it('identical sets yield angle 0', () => {
      const a = new PitchClassSet([0, 4, 7]);
      expect(angleSimilarity(a, a)).toBeCloseTo(0);
    });

    it('different sets yield positive angle', () => {
      const a = new PitchClassSet([0, 4, 7]);
      const b = new PitchClassSet([0, 1, 2]);
      expect(angleSimilarity(a, b)).toBeGreaterThan(0);
    });

    it('angle is symmetric', () => {
      const a = new PitchClassSet([0, 3, 7]);
      const b = new PitchClassSet([0, 4, 8]);
      expect(angleSimilarity(a, b)).toBeCloseTo(angleSimilarity(b, a));
    });
  });

  describe('pcSetCosine', () => {
    it('identical sets yield 1.0', () => {
      const a = new PitchClassSet([0, 4, 7]);
      expect(pcSetCosine(a, a)).toBeCloseTo(1.0);
    });

    it('disjoint sets yield 0.0', () => {
      const a = new PitchClassSet([0, 2, 4]);    // C, D, E
      const b = new PitchClassSet([1, 3, 5]);    // Db, Eb, F
      expect(pcSetCosine(a, b)).toBeCloseTo(0);
    });

    it('overlapping sets yield intermediate value', () => {
      const a = new PitchClassSet([0, 4, 7]);    // C, E, G
      const b = new PitchClassSet([0, 3, 7]);    // C, Eb, G
      const sim = pcSetCosine(a, b);
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });

    it('is symmetric', () => {
      const a = new PitchClassSet([0, 4, 7]);
      const b = new PitchClassSet([0, 3, 7]);
      expect(pcSetCosine(a, b)).toBeCloseTo(pcSetCosine(b, a));
    });
  });

  describe('zRelation', () => {
    it('detects known Z-pair: 4-Z15 and 4-Z29', () => {
      const z15 = new PitchClassSet([0, 1, 4, 6]); // 4-Z15
      const z29 = new PitchClassSet([0, 1, 3, 7]); // 4-Z29
      expect(zRelation(z15, z29)).toBe(true);
    });

    it('identical sets are not Z-related', () => {
      const a = new PitchClassSet([0, 4, 7]);
      expect(zRelation(a, a)).toBe(false);
    });

    it('non-Z-related sets with different ICVs are not Z-related', () => {
      const a = new PitchClassSet([0, 4, 7]);    // major triad
      const b = new PitchClassSet([0, 1, 2]);    // chromatic cluster
      expect(zRelation(a, b)).toBe(false);
    });

    it('transpositions are not Z-related', () => {
      const a = new PitchClassSet([0, 4, 7]);
      const b = new PitchClassSet([2, 6, 9]); // transposition of major
      // Same prime form → not Z-related
      expect(zRelation(a, b)).toBe(false);
    });
  });
});

describe('Earth Movers Distance', () => {
  it('identical distributions yield 0', () => {
    const dist = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
    expect(earthMoversDistance(dist, dist)).toBeCloseTo(0);
  });

  it('maximally different distributions yield large value', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // all on C
    const b = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]; // all on F#
    const emd = earthMoversDistance(a, b);
    expect(emd).toBeGreaterThan(0);
  });

  it('single semitone shift yields small value', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // all on C
    const b = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // all on C#
    const emd = earthMoversDistance(a, b);
    expect(emd).toBeGreaterThan(0);
    // Should be less than maximally distant
    const cToFs = earthMoversDistance(
      a,
      [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    );
    expect(emd).toBeLessThan(cToFs);
  });

  it('is symmetric', () => {
    const a = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
    const b = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0];
    expect(earthMoversDistance(a, b)).toBeCloseTo(earthMoversDistance(b, a));
  });

  it('closely related keys have small distance', () => {
    const cMaj = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // C D E F G A B
    const gMaj = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1]; // C D E F# G A B
    const cMin = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0]; // C D Eb F G Ab Bb
    // C major ↔ G major (1 note difference) should be closer than C major ↔ C minor
    const cg = earthMoversDistance(cMaj, gMaj);
    const cm = earthMoversDistance(cMaj, cMin);
    expect(cg).toBeLessThanOrEqual(cm);
  });

  it('throws on wrong-length arrays', () => {
    expect(() => earthMoversDistance([1, 2, 3], [1, 2, 3])).toThrow('12 elements');
  });

  it('throws on negative values', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1];
    const b = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(() => earthMoversDistance(a, b)).toThrow('non-negative');
  });

  describe('custom ground distance', () => {
    it('no groundDistance matches existing behavior', () => {
      const a = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const b = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
      const defaultResult = earthMoversDistance(a, b);
      expect(defaultResult).toBeGreaterThan(0);
      // Calling without 3rd arg should be the same as always
      expect(earthMoversDistance(a, b)).toBeCloseTo(defaultResult);
    });

    it('circle-of-fifths distance changes ranking', () => {
      // C→G is 1 fifth step; C→F# is 6 fifth steps
      const fifthsDist = (from: number, to: number) => {
        const a = ((from * 7) % 12 + 12) % 12;
        const b = ((to * 7) % 12 + 12) % 12;
        const diff = Math.abs(a - b);
        return Math.min(diff, 12 - diff);
      };

      const allC = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const allG = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]; // G = pc 7
      const allFs = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]; // F# = pc 6

      const cToG = earthMoversDistance(allC, allG, fifthsDist);
      const cToFs = earthMoversDistance(allC, allFs, fifthsDist);
      // C→G is 1 step on circle of fifths, C→F# is 6 steps
      expect(cToG).toBeLessThan(cToFs);
    });

    it('custom uniform distance d(i,j)=1 if i≠j gives known value', () => {
      // With uniform distance, EMD = total mass that needs to move (any move costs 1)
      const allC = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // all on C
      const allG = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]; // all on G
      const uniform = (from: number, to: number) => from === to ? 0 : 1;
      // Move 1 unit of mass from C to G, cost = 1 * 1 = 1
      expect(earthMoversDistance(allC, allG, uniform)).toBeCloseTo(1);
    });

    it('custom zero distance returns 0', () => {
      const a = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const b = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
      const zeroDist = () => 0;
      expect(earthMoversDistance(a, b, zeroDist)).toBeCloseTo(0);
    });

    it('symmetry with custom distance', () => {
      const fifthsDist = (from: number, to: number) => {
        const a = ((from * 7) % 12 + 12) % 12;
        const b = ((to * 7) % 12 + 12) % 12;
        const diff = Math.abs(a - b);
        return Math.min(diff, 12 - diff);
      };
      const a = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // C major
      const b = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1]; // G major
      expect(earthMoversDistance(a, b, fifthsDist))
        .toBeCloseTo(earthMoversDistance(b, a, fifthsDist));
    });

    it('custom distance called with correct args', () => {
      const calls: [number, number][] = [];
      const tracker = (from: number, to: number) => {
        calls.push([from, to]);
        const diff = Math.abs(from - to);
        return Math.min(diff, 12 - diff);
      };
      const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const b = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      earthMoversDistance(a, b, tracker);
      // Cost matrix built with all 144 pairs (0..11)×(0..11)
      expect(calls.length).toBe(144);
      // Verify some specific calls
      expect(calls).toContainEqual([0, 0]);
      expect(calls).toContainEqual([0, 1]);
      expect(calls).toContainEqual([11, 11]);
    });
  });
});
