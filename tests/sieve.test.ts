import { describe, it, expect } from 'vitest';
import { Sieve, sieve } from '../src/index.js';

describe('sieve factory', () => {
  it('creates an elementary sieve', () => {
    const s = sieve(3, 0);
    expect(s).toBeInstanceOf(Sieve);
  });

  it('throws on modulus < 1', () => {
    expect(() => sieve(0, 0)).toThrow(RangeError);
  });

  it('throws on negative residue', () => {
    expect(() => sieve(3, -1)).toThrow(RangeError);
  });

  it('throws on residue >= modulus', () => {
    expect(() => sieve(3, 3)).toThrow(RangeError);
  });
});

describe('Sieve.test', () => {
  it('tests elementary sieve correctly', () => {
    const s = sieve(3, 0); // 0, 3, 6, 9, ...
    expect(s.test(0)).toBe(true);
    expect(s.test(3)).toBe(true);
    expect(s.test(6)).toBe(true);
    expect(s.test(1)).toBe(false);
    expect(s.test(2)).toBe(false);
  });

  it('handles negative numbers', () => {
    const s = sieve(3, 0);
    expect(s.test(-3)).toBe(true);
    expect(s.test(-6)).toBe(true);
    expect(s.test(-1)).toBe(false);
  });
});

describe('Sieve.realize', () => {
  it('realizes elementary sieve over range', () => {
    const s = sieve(3, 0);
    expect(s.realize(0, 12)).toEqual([0, 3, 6, 9, 12]);
  });

  it('returns frozen array', () => {
    const result = sieve(2, 0).realize(0, 10);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws on low > high', () => {
    expect(() => sieve(2, 0).realize(10, 5)).toThrow(RangeError);
  });

  it('handles single-point range', () => {
    const s = sieve(5, 0);
    expect(s.realize(5, 5)).toEqual([5]);
    expect(s.realize(3, 3)).toEqual([]);
  });
});

describe('Sieve.union', () => {
  it('computes union of two sieves', () => {
    // (3,0) ∪ (4,0) = multiples of 3 or 4
    const s = sieve(3, 0).union(sieve(4, 0));
    expect(s.realize(0, 12)).toEqual([0, 3, 4, 6, 8, 9, 12]);
  });
});

describe('Sieve.intersection', () => {
  it('computes intersection of two sieves', () => {
    // (3,0) ∩ (4,0) = multiples of 12 (LCM of 3 and 4)
    const s = sieve(3, 0).intersection(sieve(4, 0));
    expect(s.realize(0, 24)).toEqual([0, 12, 24]);
  });
});

describe('Sieve.complement', () => {
  it('computes complement of a sieve', () => {
    // ¬(2,0) = odd numbers
    const s = sieve(2, 0).complement();
    expect(s.realize(0, 6)).toEqual([1, 3, 5]);
  });
});

describe('Sieve.toPitchClasses', () => {
  it('returns pitch classes mod 12', () => {
    // Whole-tone scale: (2,0) over 0-11
    const s = sieve(2, 0);
    expect(s.toPitchClasses()).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('returns deduplicated sorted results', () => {
    const s = sieve(12, 0); // only 0 in 0-11
    expect(s.toPitchClasses()).toEqual([0]);
  });
});

describe('Sieve.toScale', () => {
  it('returns scale degrees for default octaveSize 12', () => {
    const s = sieve(3, 0);
    expect(s.toScale()).toEqual([0, 3, 6, 9]);
  });

  it('supports custom octaveSize', () => {
    const s = sieve(2, 0);
    expect(s.toScale(7)).toEqual([0, 2, 4, 6]);
  });

  it('throws on invalid octaveSize', () => {
    expect(() => sieve(2, 0).toScale(0)).toThrow(RangeError);
  });
});

describe('Complex sieve expressions', () => {
  it('Xenakis-style complex sieve', () => {
    // (3,0) ∪ ((4,0) ∩ ¬(6,0)) = multiples of 3, or (multiples of 4 that aren't multiples of 6)
    const s = sieve(3, 0).union(
      sieve(4, 0).intersection(sieve(6, 0).complement()),
    );
    const result = s.realize(0, 24);
    // Manually: 0(3&4), 3, 4(4 not 6), 6(3), 8(4 not 6), 9, 12(3&4), 15, 16(4 not 6), 18(3), 20(4 not 6), 21, 24(3&4)
    expect(result).toEqual([0, 3, 4, 6, 8, 9, 12, 15, 16, 18, 20, 21, 24]);
  });

  it('double complement returns original', () => {
    const s = sieve(3, 1);
    const dbl = s.complement().complement();
    for (let n = 0; n < 20; n++) {
      expect(dbl.test(n)).toBe(s.test(n));
    }
  });
});
