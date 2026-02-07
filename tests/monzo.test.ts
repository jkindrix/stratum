import { describe, it, expect } from 'vitest';
import {
  monzoToCents,
  monzoToRatio,
  ratioToMonzo,
  monzoAdd,
  monzoSubtract,
  monzoScale,
} from '../src/pitch/monzo.js';

describe('Monzo Arithmetic', () => {
  describe('monzoToCents', () => {
    it('octave [1] = 1200 cents', () => {
      expect(monzoToCents([1])).toBeCloseTo(1200, 6);
    });

    it('perfect fifth [-1, 1] = ~701.955 cents', () => {
      expect(monzoToCents([-1, 1])).toBeCloseTo(701.955, 2);
    });

    it('major third [-2, 0, 1] = ~386.314 cents', () => {
      expect(monzoToCents([-2, 0, 1])).toBeCloseTo(386.314, 2);
    });

    it('harmonic seventh [-2, 0, 0, 1] = ~968.826 cents', () => {
      expect(monzoToCents([-2, 0, 0, 1])).toBeCloseTo(968.826, 2);
    });

    it('syntonic comma [-4, 4, -1] = ~21.506 cents', () => {
      expect(monzoToCents([-4, 4, -1])).toBeCloseTo(21.506, 2);
    });

    it('unison [0] = 0 cents', () => {
      expect(monzoToCents([0])).toBeCloseTo(0);
    });

    it('throws on empty monzo', () => {
      expect(() => monzoToCents([])).toThrow('empty');
    });
  });

  describe('monzoToRatio', () => {
    it('[-1, 1] = 1.5 (3/2)', () => {
      expect(monzoToRatio([-1, 1])).toBeCloseTo(1.5, 10);
    });

    it('[-2, 0, 1] = 1.25 (5/4)', () => {
      expect(monzoToRatio([-2, 0, 1])).toBeCloseTo(1.25, 10);
    });

    it('[1] = 2.0 (octave)', () => {
      expect(monzoToRatio([1])).toBeCloseTo(2.0, 10);
    });

    it('[0] = 1.0 (unison)', () => {
      expect(monzoToRatio([0])).toBeCloseTo(1.0, 10);
    });

    it('[-2, 0, 0, 1] = 1.75 (7/4)', () => {
      expect(monzoToRatio([-2, 0, 0, 1])).toBeCloseTo(1.75, 10);
    });

    it('throws on empty monzo', () => {
      expect(() => monzoToRatio([])).toThrow('empty');
    });
  });

  describe('ratioToMonzo', () => {
    it('3/2 = [-1, 1]', () => {
      expect(ratioToMonzo(3, 2)).toEqual([-1, 1]);
    });

    it('5/4 = [-2, 0, 1]', () => {
      expect(ratioToMonzo(5, 4)).toEqual([-2, 0, 1]);
    });

    it('2/1 = [1]', () => {
      expect(ratioToMonzo(2, 1)).toEqual([1]);
    });

    it('7/4 with primeLimit=7 = [-2, 0, 0, 1]', () => {
      expect(ratioToMonzo(7, 4, 7)).toEqual([-2, 0, 0, 1]);
    });

    it('81/80 (syntonic comma) = [-4, 4, -1]', () => {
      expect(ratioToMonzo(81, 80)).toEqual([-4, 4, -1]);
    });

    it('returns frozen monzos', () => {
      const m = ratioToMonzo(3, 2);
      expect(Object.isFrozen(m)).toBe(true);
    });

    it('throws if ratio exceeds prime limit', () => {
      expect(() => ratioToMonzo(11, 8, 7)).toThrow('prime factors beyond');
    });

    it('throws on non-positive numerator', () => {
      expect(() => ratioToMonzo(0, 1)).toThrow('positive integer');
      expect(() => ratioToMonzo(-3, 2)).toThrow('positive integer');
    });

    it('throws on non-positive denominator', () => {
      expect(() => ratioToMonzo(3, 0)).toThrow('positive integer');
    });

    it('throws on non-integer inputs', () => {
      expect(() => ratioToMonzo(3.5, 2)).toThrow('positive integer');
    });
  });

  describe('monzoAdd', () => {
    it('adds two equal-length monzos', () => {
      expect(monzoAdd([-1, 1], [-1, 1])).toEqual([-2, 2]);
    });

    it('pads shorter monzo with zeros', () => {
      expect(monzoAdd([1], [-1, 1])).toEqual([0, 1]);
    });

    it('stacking two fifths: [-1,1] + [-1,1] = [-2,2]', () => {
      const fifth = [-1, 1] as const;
      const result = monzoAdd(fifth, fifth);
      expect(monzoToRatio(result)).toBeCloseTo(2.25, 8); // 9/4
    });

    it('throws on empty monzo', () => {
      expect(() => monzoAdd([], [1])).toThrow('empty');
      expect(() => monzoAdd([1], [])).toThrow('empty');
    });
  });

  describe('monzoSubtract', () => {
    it('subtracts two monzos', () => {
      expect(monzoSubtract([-1, 1], [1])).toEqual([-2, 1]);
    });

    it('fifth minus third: [-1,1] - [-2,0,1] = [1,1,-1]', () => {
      const result = monzoSubtract([-1, 1], [-2, 0, 1]);
      // 3/2 / 5/4 = 6/5
      expect(monzoToRatio(result)).toBeCloseTo(1.2, 8);
    });

    it('throws on empty monzo', () => {
      expect(() => monzoSubtract([], [1])).toThrow('empty');
    });
  });

  describe('monzoScale', () => {
    it('scales by positive integer', () => {
      expect(monzoScale([-1, 1], 3)).toEqual([-3, 3]);
    });

    it('scales by zero', () => {
      expect(monzoScale([-1, 1], 0)).toEqual([0, 0]);
    });

    it('scales by negative integer', () => {
      expect(monzoScale([-1, 1], -1)).toEqual([1, -1]);
    });

    it('returns frozen monzo', () => {
      expect(Object.isFrozen(monzoScale([1], 2))).toBe(true);
    });

    it('throws on non-integer scale', () => {
      expect(() => monzoScale([1], 1.5)).toThrow('integer');
    });

    it('throws on empty monzo', () => {
      expect(() => monzoScale([], 2)).toThrow('empty');
    });
  });

  describe('round-trip consistency', () => {
    it('ratio → monzo → ratio preserves value', () => {
      const m = ratioToMonzo(15, 8); // 15/8 = 2^-3 · 3^1 · 5^1
      expect(monzoToRatio(m)).toBeCloseTo(15 / 8, 10);
    });

    it('ratio → monzo → cents matches direct ratioToCents', () => {
      const m = ratioToMonzo(3, 2);
      expect(monzoToCents(m)).toBeCloseTo(1200 * Math.log2(3 / 2), 6);
    });
  });
});
