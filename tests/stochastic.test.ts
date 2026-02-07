import { describe, it, expect } from 'vitest';
import {
  poissonOnsets,
  gaussianPitches,
  uniformRhythm,
  exponentialDurations,
  cauchyPitches,
  weightedChoice,
} from '../src/index.js';

describe('poissonOnsets', () => {
  it('generates onsets within duration', () => {
    const onsets = poissonOnsets(1, 100, 42);
    for (const t of onsets) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(100);
    }
  });

  it('returns frozen array', () => {
    const onsets = poissonOnsets(2, 50, 42);
    expect(Object.isFrozen(onsets)).toBe(true);
  });

  it('is deterministic with same seed', () => {
    const a = poissonOnsets(1.5, 100, 123);
    const b = poissonOnsets(1.5, 100, 123);
    expect(a).toEqual(b);
  });

  it('throws on rate <= 0', () => {
    expect(() => poissonOnsets(0, 100)).toThrow(RangeError);
    expect(() => poissonOnsets(-1, 100)).toThrow(RangeError);
  });

  it('throws on duration <= 0', () => {
    expect(() => poissonOnsets(1, 0)).toThrow(RangeError);
  });
});

describe('gaussianPitches', () => {
  it('generates the correct count', () => {
    const pitches = gaussianPitches(60, 5, 20, 42);
    expect(pitches).toHaveLength(20);
  });

  it('returns rounded integers', () => {
    const pitches = gaussianPitches(60, 10, 50, 42);
    for (const p of pitches) {
      expect(p).toBe(Math.round(p));
    }
  });

  it('is deterministic with same seed', () => {
    const a = gaussianPitches(60, 5, 10, 99);
    const b = gaussianPitches(60, 5, 10, 99);
    expect(a).toEqual(b);
  });

  it('mean is roughly correct over large sample', () => {
    const pitches = gaussianPitches(60, 3, 1000, 42);
    const mean = pitches.reduce((s, p) => s + p, 0) / pitches.length;
    expect(mean).toBeCloseTo(60, 0); // within 1 of target
  });

  it('throws on invalid stdDev', () => {
    expect(() => gaussianPitches(60, 0, 10)).toThrow(RangeError);
  });

  it('throws on invalid count', () => {
    expect(() => gaussianPitches(60, 5, 0)).toThrow(RangeError);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(gaussianPitches(60, 5, 5, 1))).toBe(true);
  });
});

describe('uniformRhythm', () => {
  it('generates values in [min, max]', () => {
    const durations = uniformRhythm(120, 480, 100, 42);
    for (const d of durations) {
      expect(d).toBeGreaterThanOrEqual(120);
      expect(d).toBeLessThanOrEqual(480);
    }
  });

  it('generates the correct count', () => {
    expect(uniformRhythm(1, 10, 5, 42)).toHaveLength(5);
  });

  it('is deterministic with same seed', () => {
    const a = uniformRhythm(100, 500, 20, 7);
    const b = uniformRhythm(100, 500, 20, 7);
    expect(a).toEqual(b);
  });

  it('throws on min > max', () => {
    expect(() => uniformRhythm(500, 100, 10)).toThrow(RangeError);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(uniformRhythm(1, 10, 3, 1))).toBe(true);
  });
});

describe('exponentialDurations', () => {
  it('generates positive values', () => {
    const durations = exponentialDurations(0.01, 50, 42);
    for (const d of durations) {
      expect(d).toBeGreaterThan(0);
    }
  });

  it('generates the correct count', () => {
    expect(exponentialDurations(1, 10, 42)).toHaveLength(10);
  });

  it('throws on rate <= 0', () => {
    expect(() => exponentialDurations(0, 10)).toThrow(RangeError);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(exponentialDurations(1, 5, 1))).toBe(true);
  });
});

describe('cauchyPitches', () => {
  it('generates the correct count', () => {
    const pitches = cauchyPitches(60, 2, 20, 42);
    expect(pitches).toHaveLength(20);
  });

  it('returns rounded integers', () => {
    const pitches = cauchyPitches(60, 3, 10, 42);
    for (const p of pitches) {
      expect(p).toBe(Math.round(p));
    }
  });

  it('is deterministic with same seed', () => {
    const a = cauchyPitches(60, 2, 10, 55);
    const b = cauchyPitches(60, 2, 10, 55);
    expect(a).toEqual(b);
  });

  it('throws on scale <= 0', () => {
    expect(() => cauchyPitches(60, 0, 10)).toThrow(RangeError);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(cauchyPitches(60, 2, 5, 1))).toBe(true);
  });
});

describe('weightedChoice', () => {
  it('selects from weighted options', () => {
    const opts = [
      { value: 'A', weight: 10 },
      { value: 'B', weight: 0 },
    ];
    const result = weightedChoice(opts, 5, 42);
    expect(result).toHaveLength(5);
    for (const v of result) {
      expect(v).toBe('A'); // B has weight 0
    }
  });

  it('respects weights over large sample', () => {
    const opts = [
      { value: 'A', weight: 9 },
      { value: 'B', weight: 1 },
    ];
    const result = weightedChoice(opts, 1000, 42);
    const aCount = result.filter(v => v === 'A').length;
    expect(aCount).toBeGreaterThan(800); // roughly 90%
  });

  it('is deterministic with same seed', () => {
    const opts = [
      { value: 1, weight: 3 },
      { value: 2, weight: 7 },
    ];
    const a = weightedChoice(opts, 10, 42);
    const b = weightedChoice(opts, 10, 42);
    expect(a).toEqual(b);
  });

  it('throws on empty options', () => {
    expect(() => weightedChoice([], 1)).toThrow(RangeError);
  });

  it('throws on negative weight', () => {
    expect(() => weightedChoice([{ value: 'A', weight: -1 }], 1)).toThrow(RangeError);
  });

  it('throws on all-zero weights', () => {
    expect(() =>
      weightedChoice([{ value: 'A', weight: 0 }, { value: 'B', weight: 0 }], 1),
    ).toThrow(RangeError);
  });

  it('returns frozen array', () => {
    const opts = [{ value: 'X', weight: 1 }];
    expect(Object.isFrozen(weightedChoice(opts, 3, 1))).toBe(true);
  });
});
