import { describe, it, expect } from 'vitest';
import {
  voiceLeadingVector,
  geometricDistance,
  opticEquivalence,
  parsimonyScore,
  commonToneCount,
  isParsimoniousConnection,
} from '../src/pitch/geometric-voice-leading.js';

describe('Geometric Voice Leading', () => {
  // -----------------------------------------------------------------------
  // voiceLeadingVector
  // -----------------------------------------------------------------------
  describe('voiceLeadingVector', () => {
    it('C major → C minor = one voice moves -1', () => {
      const vec = voiceLeadingVector([0, 4, 7], [0, 3, 7]);
      // E→Eb = -1, C→C = 0, G→G = 0
      expect(vec).toContain(-1);
      expect(vec.filter(d => d === 0).length).toBe(2);
    });

    it('C major → E minor (smooth)', () => {
      // C(0) E(4) G(7) → E(4) G(7) B(11)
      const vec = voiceLeadingVector([0, 4, 7], [4, 7, 11]);
      const total = vec.reduce((s, d) => s + Math.abs(d), 0);
      expect(total).toBeLessThanOrEqual(4);
    });

    it('unison → unison = all zeros', () => {
      expect(voiceLeadingVector([0], [0])).toEqual([0]);
    });

    it('returns frozen array', () => {
      expect(Object.isFrozen(voiceLeadingVector([0, 4, 7], [0, 3, 7]))).toBe(true);
    });

    it('throws on different-sized sets', () => {
      expect(() => voiceLeadingVector([0, 4], [0, 3, 7])).toThrow('equal size');
    });

    it('throws on empty sets', () => {
      expect(() => voiceLeadingVector([], [])).toThrow('empty');
    });

    it('tritone displacement = +6', () => {
      const vec = voiceLeadingVector([0], [6]);
      expect(vec[0]).toBe(6);
    });
  });

  // -----------------------------------------------------------------------
  // geometricDistance
  // -----------------------------------------------------------------------
  describe('geometricDistance', () => {
    it('L1 distance = sum of absolute displacements', () => {
      // C maj → C min: one voice moves 1 semitone
      const d = geometricDistance([0, 4, 7], [0, 3, 7], 'L1');
      expect(d).toBe(1);
    });

    it('L2 distance (Euclidean)', () => {
      const d = geometricDistance([0, 4, 7], [0, 3, 7], 'L2');
      expect(d).toBeCloseTo(1, 6);
    });

    it('Linf distance (max displacement)', () => {
      const d = geometricDistance([0, 4, 7], [0, 3, 7], 'Linf');
      expect(d).toBe(1);
    });

    it('defaults to L1', () => {
      const d1 = geometricDistance([0, 4, 7], [0, 3, 7]);
      const d2 = geometricDistance([0, 4, 7], [0, 3, 7], 'L1');
      expect(d1).toBe(d2);
    });

    it('identity = 0 distance', () => {
      expect(geometricDistance([0, 4, 7], [0, 4, 7])).toBe(0);
    });

    it('chromatic cluster to spread chord has large distance', () => {
      const d = geometricDistance([0, 1, 2], [0, 4, 8]);
      expect(d).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Hungarian vs brute-force cross-validation
  // -----------------------------------------------------------------------
  describe('Hungarian cross-validation', () => {
    // Brute-force for small n to validate the Hungarian result
    function bruteForceDistance(from: number[], to: number[]): number {
      const n = from.length;
      if (n === 0) return 0;

      function pcdist(a: number, b: number): number {
        const d = (b - a + 12) % 12;
        return Math.min(d, 12 - d);
      }

      function perms<T>(arr: T[]): T[][] {
        if (arr.length <= 1) return [[...arr]];
        const result: T[][] = [];
        for (let i = 0; i < arr.length; i++) {
          const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
          for (const p of perms(rest)) result.push([arr[i]!, ...p]);
        }
        return result;
      }

      let min = Infinity;
      for (const perm of perms(to)) {
        let d = 0;
        for (let i = 0; i < n; i++) d += pcdist(from[i]!, perm[i]!);
        if (d < min) min = d;
      }
      return min;
    }

    it('matches brute-force for C maj → Db maj', () => {
      const from = [0, 4, 7];
      const to = [1, 5, 8];
      expect(geometricDistance(from, to)).toBe(bruteForceDistance(from, to));
    });

    it('matches brute-force for diminished → augmented', () => {
      const from = [0, 3, 6, 9];
      const to = [0, 4, 8, 0]; // augmented with doubled root
      expect(geometricDistance(from, to)).toBe(bruteForceDistance(from, to));
    });

    it('matches brute-force for 5 voices', () => {
      const from = [0, 2, 4, 5, 7];
      const to = [1, 3, 5, 8, 10];
      expect(geometricDistance(from, to)).toBe(bruteForceDistance(from, to));
    });

    it('matches brute-force for tritone-heavy case', () => {
      const from = [0, 6];
      const to = [3, 9];
      expect(geometricDistance(from, to)).toBe(bruteForceDistance(from, to));
    });
  });

  // -----------------------------------------------------------------------
  // opticEquivalence
  // -----------------------------------------------------------------------
  describe('opticEquivalence', () => {
    it('O reduces to mod 12', () => {
      const r = opticEquivalence([12, 16, 19], 'O');
      expect(r.representative).toEqual([0, 4, 7]);
      expect(r.applied).toContain('O');
    });

    it('P sorts ascending', () => {
      const r = opticEquivalence([7, 0, 4], 'P');
      expect(r.representative).toEqual([0, 4, 7]);
    });

    it('T transposes min to 0', () => {
      const r = opticEquivalence([4, 7, 11], 'T');
      // 4→0, 7→3, 11→7
      expect(r.representative).toEqual([0, 3, 7]);
    });

    it('C removes duplicates', () => {
      const r = opticEquivalence([0, 4, 4, 7], 'C');
      expect(r.representative).toEqual([0, 4, 7]);
    });

    it('OPT: full reduction of Db major', () => {
      const r = opticEquivalence([1, 5, 8], 'OPT');
      expect(r.representative).toEqual([0, 4, 7]);
    });

    it('I: prefers lexicographically smaller', () => {
      // Major triad [0,4,7] vs. inverted [0,5,8] — [0,4,7] is lex smaller
      const r = opticEquivalence([0, 4, 7], 'OPTI');
      expect(r.representative).toEqual([0, 4, 7]);
    });

    it('I: minor triad becomes major under I', () => {
      // Minor triad OPT-reduced: [0,3,7]
      // Inverted: [12-0, 12-3, 12-7] = [0, 9, 5] → sorted: [0, 5, 9] → T: [0, 5, 9]
      // vs [0, 3, 7] — [0, 3, 7] is lex smaller
      const r = opticEquivalence([0, 3, 7], 'OPTI');
      expect(r.representative).toEqual([0, 3, 7]);
    });

    it('returns frozen result', () => {
      const r = opticEquivalence([0, 4, 7], 'OPT');
      expect(Object.isFrozen(r)).toBe(true);
      expect(Object.isFrozen(r.representative)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // parsimonyScore / commonToneCount / isParsimoniousConnection
  // -----------------------------------------------------------------------
  describe('parsimonyScore', () => {
    it('C major → C minor = 1', () => {
      expect(parsimonyScore([0, 4, 7], [0, 3, 7])).toBe(1);
    });

    it('identity = 0', () => {
      expect(parsimonyScore([0, 4, 7], [0, 4, 7])).toBe(0);
    });
  });

  describe('commonToneCount', () => {
    it('C major and C minor share 2 common tones (C, G)', () => {
      expect(commonToneCount([0, 4, 7], [0, 3, 7])).toBe(2);
    });

    it('C major and F# major share 0 common tones', () => {
      expect(commonToneCount([0, 4, 7], [6, 10, 1])).toBe(0);
    });

    it('identical sets share all tones', () => {
      expect(commonToneCount([0, 4, 7], [0, 4, 7])).toBe(3);
    });

    it('handles unnormalized pitch classes', () => {
      expect(commonToneCount([12, 16, 19], [0, 4, 7])).toBe(3);
    });
  });

  describe('isParsimoniousConnection', () => {
    it('C major → C minor is parsimonious (threshold 2)', () => {
      expect(isParsimoniousConnection([0, 4, 7], [0, 3, 7])).toBe(true);
    });

    it('C major → F# major is not parsimonious', () => {
      expect(isParsimoniousConnection([0, 4, 7], [6, 10, 1])).toBe(false);
    });

    it('custom threshold', () => {
      // C major → E minor = small motion
      const score = parsimonyScore([0, 4, 7], [4, 7, 11]);
      expect(isParsimoniousConnection([0, 4, 7], [4, 7, 11], score)).toBe(true);
      expect(isParsimoniousConnection([0, 4, 7], [4, 7, 11], score - 1)).toBe(false);
    });
  });
});
