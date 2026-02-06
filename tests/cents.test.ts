import { describe, it, expect } from 'vitest';
import {
  centsBetween,
  centsToRatio,
  ratioToCents,
  edoStepToCents,
  centsToEdoStep,
  ratioToEdoStep,
} from '../src/index.js';

describe('Cent/Ratio/EDO Conversion Utilities', () => {
  describe('centsBetween', () => {
    it('octave (2:1) = 1200 cents', () => {
      expect(centsBetween(440, 880)).toBeCloseTo(1200);
    });

    it('just perfect fifth (3:2) = ~701.955 cents', () => {
      expect(centsBetween(440, 660)).toBeCloseTo(701.955, 2);
    });

    it('unison = 0 cents', () => {
      expect(centsBetween(440, 440)).toBeCloseTo(0);
    });

    it('descending interval is negative', () => {
      expect(centsBetween(880, 440)).toBeCloseTo(-1200);
    });

    it('throws on non-positive frequency', () => {
      expect(() => centsBetween(0, 440)).toThrow('positive');
      expect(() => centsBetween(440, -1)).toThrow('positive');
      expect(() => centsBetween(Infinity, 440)).toThrow('positive');
    });
  });

  describe('centsToRatio', () => {
    it('1200 cents = ratio 2.0', () => {
      expect(centsToRatio(1200)).toBeCloseTo(2.0);
    });

    it('0 cents = ratio 1.0', () => {
      expect(centsToRatio(0)).toBeCloseTo(1.0);
    });

    it('700 cents = 12-TET fifth ratio', () => {
      expect(centsToRatio(700)).toBeCloseTo(Math.pow(2, 7 / 12));
    });

    it('-1200 cents = ratio 0.5', () => {
      expect(centsToRatio(-1200)).toBeCloseTo(0.5);
    });

    it('throws on non-finite', () => {
      expect(() => centsToRatio(Infinity)).toThrow('finite');
    });
  });

  describe('ratioToCents', () => {
    it('ratio 2 = 1200 cents', () => {
      expect(ratioToCents(2)).toBeCloseTo(1200);
    });

    it('ratio 3/2 = ~701.955 cents', () => {
      expect(ratioToCents(3 / 2)).toBeCloseTo(701.955, 2);
    });

    it('ratio 5/4 = ~386.314 cents', () => {
      expect(ratioToCents(5 / 4)).toBeCloseTo(386.314, 2);
    });

    it('ratio 1 = 0 cents', () => {
      expect(ratioToCents(1)).toBeCloseTo(0);
    });

    it('throws on non-positive ratio', () => {
      expect(() => ratioToCents(0)).toThrow('positive');
      expect(() => ratioToCents(-1)).toThrow('positive');
    });
  });

  describe('round-trip consistency', () => {
    it('cents → ratio → cents preserves value', () => {
      const original = 386.314;
      const ratio = centsToRatio(original);
      const roundTrip = ratioToCents(ratio);
      expect(roundTrip).toBeCloseTo(original, 6);
    });

    it('ratio → cents → ratio preserves value', () => {
      const original = 5 / 4;
      const cents = ratioToCents(original);
      const roundTrip = centsToRatio(cents);
      expect(roundTrip).toBeCloseTo(original, 10);
    });
  });

  describe('edoStepToCents', () => {
    it('step 7 of 12-EDO = 700 cents', () => {
      expect(edoStepToCents(7, 12)).toBeCloseTo(700);
    });

    it('step 0 = 0 cents', () => {
      expect(edoStepToCents(0, 12)).toBeCloseTo(0);
    });

    it('step 12 of 12-EDO = 1200 cents (octave)', () => {
      expect(edoStepToCents(12, 12)).toBeCloseTo(1200);
    });

    it('step 11 of 19-EDO = ~694.737 cents', () => {
      expect(edoStepToCents(11, 19)).toBeCloseTo(694.737, 2);
    });

    it('throws on non-integer divisions', () => {
      expect(() => edoStepToCents(7, 12.5)).toThrow('positive integer');
    });

    it('throws on zero divisions', () => {
      expect(() => edoStepToCents(7, 0)).toThrow('positive integer');
    });
  });

  describe('centsToEdoStep', () => {
    it('702 cents in 12-EDO → step 7', () => {
      expect(centsToEdoStep(702, 12)).toBe(7);
    });

    it('386 cents in 12-EDO → step 4 (nearest major third)', () => {
      expect(centsToEdoStep(386, 12)).toBe(4);
    });

    it('0 cents → step 0', () => {
      expect(centsToEdoStep(0, 12)).toBe(0);
    });

    it('1200 cents → step N (octave)', () => {
      expect(centsToEdoStep(1200, 12)).toBe(12);
      expect(centsToEdoStep(1200, 19)).toBe(19);
    });
  });

  describe('ratioToEdoStep', () => {
    it('3/2 in 12-EDO → step 7', () => {
      expect(ratioToEdoStep(3 / 2, 12)).toBe(7);
    });

    it('5/4 in 12-EDO → step 4', () => {
      expect(ratioToEdoStep(5 / 4, 12)).toBe(4);
    });

    it('3/2 in 19-EDO → step 11', () => {
      expect(ratioToEdoStep(3 / 2, 19)).toBe(11);
    });

    it('2/1 in any EDO → N steps', () => {
      expect(ratioToEdoStep(2, 12)).toBe(12);
      expect(ratioToEdoStep(2, 31)).toBe(31);
    });
  });
});
