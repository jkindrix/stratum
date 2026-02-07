import { describe, it, expect } from 'vitest';
import {
  mosScale,
  mosStepPattern,
  isMos,
  mosTree,
  patentVal,
  valMapping,
  temperamentError,
  isBadlyBroken,
  MEANTONE,
  SUPERPYTH,
  FLATTONE,
  MAVILA,
} from '../src/pitch/temperament.js';
import { ratioToMonzo } from '../src/pitch/monzo.js';

describe('Temperament Module', () => {
  // -----------------------------------------------------------------------
  // MOS Scale Functions
  // -----------------------------------------------------------------------
  describe('mosScale', () => {
    it('generates a 7-note scale from 1200¢ period and 700¢ generator', () => {
      const scale = mosScale(1200, 700, 7);
      expect(scale[0]).toBe(0);
      expect(scale[scale.length - 1]).toBe(1200);
      // 7 notes + closing period = 8 entries
      expect(scale.length).toBe(8);
    });

    it('generates a 5-note pentatonic from 700¢ generator', () => {
      const scale = mosScale(1200, 700, 5);
      expect(scale[0]).toBe(0);
      expect(scale[scale.length - 1]).toBe(1200);
      expect(scale.length).toBe(6); // 5 notes + period
    });

    it('notes are sorted ascending', () => {
      const scale = mosScale(1200, 700, 7);
      for (let i = 1; i < scale.length; i++) {
        expect((scale[i] ?? 0)).toBeGreaterThanOrEqual(scale[i - 1] ?? 0);
      }
    });

    it('returns frozen array', () => {
      expect(Object.isFrozen(mosScale(1200, 700, 5))).toBe(true);
    });

    it('throws on non-positive period', () => {
      expect(() => mosScale(0, 700, 5)).toThrow('positive');
      expect(() => mosScale(-1200, 700, 5)).toThrow('positive');
    });

    it('throws on non-finite generator', () => {
      expect(() => mosScale(1200, Infinity, 5)).toThrow('finite');
    });

    it('throws on size < 2', () => {
      expect(() => mosScale(1200, 700, 1)).toThrow('>= 2');
    });

    it('works with meantone generator', () => {
      const scale = mosScale(1200, MEANTONE.generator, 7);
      expect(scale.length).toBe(8);
      expect(scale[0]).toBe(0);
    });
  });

  describe('mosStepPattern', () => {
    it('12-TET diatonic: 5L 2s', () => {
      const pattern = mosStepPattern(1200, 700, 7);
      expect(pattern).toBe('5L 2s');
    });

    it('12-TET pentatonic: 2L 3s', () => {
      const pattern = mosStepPattern(1200, 700, 5);
      expect(pattern).toBe('2L 3s');
    });
  });

  describe('isMos', () => {
    it('returns true for a valid MOS scale', () => {
      const scale = mosScale(1200, 700, 7);
      expect(isMos(scale)).toBe(true);
    });

    it('returns true for pentatonic MOS', () => {
      const scale = mosScale(1200, 700, 5);
      expect(isMos(scale)).toBe(true);
    });

    it('returns false for chromatic scale (1 step size)', () => {
      // Equal-tempered chromatic = 1 step size
      const scale = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
      expect(isMos(scale)).toBe(false);
    });

    it('returns false for scale with 3 step sizes', () => {
      const scale = [0, 100, 300, 350, 600, 900, 1200];
      expect(isMos(scale)).toBe(false);
    });

    it('returns false for too-short scale', () => {
      expect(isMos([0, 1200])).toBe(false);
    });
  });

  describe('mosTree', () => {
    it('finds multiple MOS sizes for 700¢ generator', () => {
      const tree = mosTree(1200, 700, 12);
      expect(tree.length).toBeGreaterThan(0);
      // Should include at least size 5 and 7
      const sizes = tree.map(e => e.size);
      expect(sizes).toContain(5);
      expect(sizes).toContain(7);
    });

    it('returns frozen result', () => {
      const tree = mosTree(1200, 700, 12);
      expect(Object.isFrozen(tree)).toBe(true);
    });

    it('each entry has scale, pattern, size', () => {
      const tree = mosTree(1200, 700, 12);
      for (const entry of tree) {
        expect(entry.size).toBeGreaterThanOrEqual(2);
        expect(entry.pattern).toContain('L');
        expect(entry.scale.length).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Val Functions
  // -----------------------------------------------------------------------
  describe('patentVal', () => {
    it('12-EDO patent val is [12, 19, 28, 34]', () => {
      expect(patentVal(12, 7)).toEqual([12, 19, 28, 34]);
    });

    it('19-EDO patent val is [19, 30, 44, 53]', () => {
      expect(patentVal(19, 7)).toEqual([19, 30, 44, 53]);
    });

    it('31-EDO patent val is [31, 49, 72, 87]', () => {
      expect(patentVal(31, 7)).toEqual([31, 49, 72, 87]);
    });

    it('5-limit val omits 7', () => {
      const v = patentVal(12, 5);
      expect(v).toEqual([12, 19, 28]);
    });

    it('returns frozen val', () => {
      expect(Object.isFrozen(patentVal(12))).toBe(true);
    });

    it('throws on divisions < 1', () => {
      expect(() => patentVal(0)).toThrow('positive integer');
      expect(() => patentVal(-5)).toThrow('positive integer');
    });
  });

  describe('valMapping', () => {
    it('maps 3/2 monzo through 12-EDO val = 7 steps', () => {
      const v = patentVal(12, 7);
      const m = ratioToMonzo(3, 2); // [-1, 1]
      expect(valMapping(v, m)).toBe(7);
    });

    it('maps 5/4 monzo through 12-EDO val = 4 steps', () => {
      const v = patentVal(12, 7);
      const m = ratioToMonzo(5, 4); // [-2, 0, 1]
      expect(valMapping(v, m)).toBe(4);
    });

    it('maps octave [1, 0, 0, 0] = 12 steps in 12-EDO', () => {
      const v = patentVal(12, 7);
      expect(valMapping(v, [1, 0, 0, 0])).toBe(12);
    });

    it('handles mismatched lengths (pads shorter)', () => {
      const v = patentVal(12, 7); // length 4
      const m = [1]; // length 1
      expect(valMapping(v, m)).toBe(12);
    });
  });

  describe('temperamentError', () => {
    it('12-EDO has moderate error', () => {
      const v = patentVal(12, 7);
      const err = temperamentError(v, 7);
      expect(err).toBeGreaterThan(0);
      expect(err).toBeLessThan(20); // Should be around 10-15 cents RMS
    });

    it('19-EDO has lower 5-limit error than 12-EDO', () => {
      const v12 = patentVal(12, 5);
      const v19 = patentVal(19, 5);
      expect(temperamentError(v19, 5)).toBeLessThan(temperamentError(v12, 5));
    });

    it('31-EDO has low 7-limit error', () => {
      const v = patentVal(31, 7);
      expect(temperamentError(v, 7)).toBeLessThan(10);
    });

    it('throws on empty val', () => {
      expect(() => temperamentError([])).toThrow('empty');
    });

    it('throws on zero octave mapping', () => {
      expect(() => temperamentError([0, 1, 2])).toThrow('octave');
    });
  });

  describe('isBadlyBroken', () => {
    it('returns false for standard 12-EDO val', () => {
      expect(isBadlyBroken(patentVal(12, 7))).toBe(false);
    });

    it('returns true if any prime maps to 0', () => {
      expect(isBadlyBroken([12, 0, 28, 34])).toBe(true);
    });

    it('returns true if any prime maps to negative', () => {
      expect(isBadlyBroken([12, -1, 28, 34])).toBe(true);
    });

    it('returns true if 3/2 maps to negative steps', () => {
      // val[1] - val[0] should be positive; here val[1]=5 < val[0]=12
      expect(isBadlyBroken([12, 5, 28, 34])).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Presets
  // -----------------------------------------------------------------------
  describe('Presets', () => {
    it('MEANTONE has period 1200 and generator ~696.578', () => {
      expect(MEANTONE.period).toBe(1200);
      expect(MEANTONE.generator).toBeCloseTo(696.578, 2);
    });

    it('SUPERPYTH has wider fifth than 12-TET', () => {
      expect(SUPERPYTH.generator).toBeGreaterThan(700);
    });

    it('FLATTONE has narrower fifth than meantone', () => {
      expect(FLATTONE.generator).toBeLessThan(MEANTONE.generator);
    });

    it('MAVILA has generator ≈ 521.5', () => {
      expect(MAVILA.generator).toBeCloseTo(521.5, 1);
    });

    it('all presets are frozen', () => {
      expect(Object.isFrozen(MEANTONE)).toBe(true);
      expect(Object.isFrozen(SUPERPYTH)).toBe(true);
      expect(Object.isFrozen(FLATTONE)).toBe(true);
      expect(Object.isFrozen(MAVILA)).toBe(true);
    });

    it('meantone 7-note MOS is valid', () => {
      const scale = mosScale(MEANTONE.period, MEANTONE.generator, 7);
      expect(isMos(scale)).toBe(true);
    });
  });
});
