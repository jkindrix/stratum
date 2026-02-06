import { describe, it, expect } from 'vitest';
import {
  spiralArrayPosition,
  centerOfEffect,
  cloudDiameter,
  cloudMomentum,
  tensileStrain,
} from '../src/index.js';

describe('Spiral Array Tension Model', () => {
  describe('spiralArrayPosition', () => {
    it('each pitch class maps to a distinct 3D point', () => {
      const points = Array.from({ length: 12 }, (_, i) => spiralArrayPosition(i));
      // All 12 points should be unique
      const keys = new Set(points.map(p => `${p.x.toFixed(6)}_${p.y.toFixed(6)}_${p.z.toFixed(6)}`));
      expect(keys.size).toBe(12);
    });

    it('C (pc=0) is on the helix', () => {
      const p = spiralArrayPosition(0);
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(typeof p.z).toBe('number');
    });

    it('fifths-related pitches are close in z (height)', () => {
      // C and G are a fifth apart — adjacent on the line of fifths
      const c = spiralArrayPosition(0);
      const g = spiralArrayPosition(7);
      const dz = Math.abs(c.z - g.z);
      // C is at fifth position 0, G at position 1 → dz = 0.5
      expect(dz).toBeCloseTo(0.5);
    });
  });

  describe('centerOfEffect', () => {
    it('single pitch class returns its helix position', () => {
      const ce = centerOfEffect([0]);
      const pos = spiralArrayPosition(0);
      expect(ce.x).toBeCloseTo(pos.x);
      expect(ce.y).toBeCloseTo(pos.y);
      expect(ce.z).toBeCloseTo(pos.z);
    });

    it('with equal weights, center is unweighted mean', () => {
      const ce1 = centerOfEffect([0, 7]);
      const ce2 = centerOfEffect([0, 7], [1, 1]);
      expect(ce1.x).toBeCloseTo(ce2.x);
      expect(ce1.y).toBeCloseTo(ce2.y);
      expect(ce1.z).toBeCloseTo(ce2.z);
    });

    it('unequal weights shift center toward heavier PC', () => {
      const posC = spiralArrayPosition(0);
      const posG = spiralArrayPosition(7);
      const ce = centerOfEffect([0, 7], [10, 1]);
      // Should be closer to C than to G
      const distToC = Math.sqrt((ce.x - posC.x) ** 2 + (ce.y - posC.y) ** 2 + (ce.z - posC.z) ** 2);
      const distToG = Math.sqrt((ce.x - posG.x) ** 2 + (ce.y - posG.y) ** 2 + (ce.z - posG.z) ** 2);
      expect(distToC).toBeLessThan(distToG);
    });
  });

  describe('cloudDiameter', () => {
    it('single PC → diameter 0', () => {
      expect(cloudDiameter([0])).toBe(0);
    });

    it('empty → diameter 0', () => {
      expect(cloudDiameter([])).toBe(0);
    });

    it('major triad has positive diameter', () => {
      const d = cloudDiameter([0, 4, 7]); // C E G
      expect(d).toBeGreaterThan(0);
    });

    it('major triad < diminished 7th (more spread)', () => {
      const major = cloudDiameter([0, 4, 7]);          // C E G
      const dim7 = cloudDiameter([0, 3, 6, 9]);        // C Eb Gb A
      expect(major).toBeLessThan(dim7);
    });

    it('unison (repeated PC) → diameter 0', () => {
      expect(cloudDiameter([0, 0, 0])).toBe(0);
    });

    it('tritone pair has large diameter', () => {
      const tritone = cloudDiameter([0, 6]); // C and F#
      const fifth = cloudDiameter([0, 7]);   // C and G
      expect(tritone).toBeGreaterThan(fifth);
    });
  });

  describe('cloudMomentum', () => {
    it('empty sequence → empty result', () => {
      expect(cloudMomentum([])).toEqual([]);
    });

    it('single chord → empty result', () => {
      expect(cloudMomentum([[0, 4, 7]])).toEqual([]);
    });

    it('two identical chords → zero distance', () => {
      const m = cloudMomentum([[0, 4, 7], [0, 4, 7]]);
      expect(m).toHaveLength(1);
      expect(m[0]).toBeCloseTo(0);
    });

    it('different chords → positive distances', () => {
      const m = cloudMomentum([[0, 4, 7], [2, 6, 9]]);
      expect(m).toHaveLength(1);
      expect(m[0]).toBeGreaterThan(0);
    });

    it('returns n-1 distances for n chords', () => {
      const m = cloudMomentum([[0, 4, 7], [5, 9, 0], [7, 11, 2]]);
      expect(m).toHaveLength(2);
    });

    it('I→V distance < I→bII distance (closely related vs distant)', () => {
      const seq1 = [[0, 4, 7], [7, 11, 2]]; // C major → G major
      const seq2 = [[0, 4, 7], [1, 5, 8]];  // C major → Db major
      const m1 = cloudMomentum(seq1);
      const m2 = cloudMomentum(seq2);
      expect(m1[0]).toBeLessThan(m2[0]!);
    });
  });

  describe('tensileStrain', () => {
    it('tonic triad in own key has low strain', () => {
      const cMajScale = [0, 2, 4, 5, 7, 9, 11]; // C major diatonic
      const cMajTriad = [0, 4, 7];
      const strain = tensileStrain(cMajTriad, cMajScale);
      expect(strain).toBeLessThan(2); // Close to key center
    });

    it('distant chord has higher strain', () => {
      const cMajScale = [0, 2, 4, 5, 7, 9, 11];
      const cMajTriad = [0, 4, 7];
      const fSharpMajTriad = [6, 10, 1]; // F# major
      const strainTonic = tensileStrain(cMajTriad, cMajScale);
      const strainDistant = tensileStrain(fSharpMajTriad, cMajScale);
      expect(strainDistant).toBeGreaterThan(strainTonic);
    });

    it('dominant triad is closer to key than bII', () => {
      const cMajScale = [0, 2, 4, 5, 7, 9, 11];
      const dominant = [7, 11, 2]; // G major
      const neapolitan = [1, 5, 8]; // Db major
      const strainV = tensileStrain(dominant, cMajScale);
      const strainBII = tensileStrain(neapolitan, cMajScale);
      expect(strainV).toBeLessThan(strainBII);
    });

    it('same chord for both yields 0', () => {
      expect(tensileStrain([0, 4, 7], [0, 4, 7])).toBeCloseTo(0);
    });
  });
});
