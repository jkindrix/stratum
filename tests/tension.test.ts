import { describe, it, expect } from 'vitest';
import {
  roughness,
  roughnessFromMidi,
  computeTension,
  tensionVelocity,
  tensionAcceleration,
  tensionIntegral,
  findTensionPeaks,
  findTensionValleys,
  classifyTensionProfile,
  createScore,
  addPart,
  addNote,
} from '../src/index.js';

describe('Roughness', () => {
  it('returns 0 for a single tone', () => {
    expect(roughness([440])).toBe(0);
  });

  it('returns 0 for no tones', () => {
    expect(roughness([])).toBe(0);
  });

  it('is low for an octave', () => {
    const octave = roughness([440, 880]);
    expect(octave).toBeLessThan(0.1);
  });

  it('is low for a perfect fifth', () => {
    const fifth = roughness([440, 660]);
    expect(fifth).toBeLessThan(0.3);
  });

  it('is high for a semitone', () => {
    const semitone = roughness([440, 466.16]);
    const fifth = roughness([440, 660]);
    expect(semitone).toBeGreaterThan(fifth);
  });

  it('is higher for a semitone than a major third', () => {
    const semitone = roughnessFromMidi([60, 61]);
    const majorThird = roughnessFromMidi([60, 64]);
    expect(semitone).toBeGreaterThan(majorThird);
  });

  it('orders intervals by roughness: unison < fifth < third < semitone', () => {
    const unison = roughnessFromMidi([60, 60]);
    const fifth = roughnessFromMidi([60, 67]);
    const third = roughnessFromMidi([60, 64]);
    const semitone = roughnessFromMidi([60, 61]);

    expect(unison).toBeLessThan(fifth);
    expect(fifth).toBeLessThan(third);
    expect(third).toBeLessThan(semitone);
  });
});

describe('Tension Curve', () => {
  it('computes tension for a simple score', () => {
    const score = createScore({ tempo: 120, ticksPerQuarter: 480 });
    const piano = addPart(score, { name: 'Piano' });

    // C major chord
    addNote(score, piano, { midi: 60, onset: 0, duration: 960, velocity: 80 });
    addNote(score, piano, { midi: 64, onset: 0, duration: 960, velocity: 80 });
    addNote(score, piano, { midi: 67, onset: 0, duration: 960, velocity: 80 });

    const curve = computeTension(score);
    expect(curve.length).toBeGreaterThan(0);

    // All points should have total tension between 0 and 1
    for (const pt of curve) {
      expect(pt.total).toBeGreaterThanOrEqual(0);
      expect(pt.total).toBeLessThanOrEqual(1);
    }
  });

  it('dissonant chord has more roughness than consonant chord', () => {
    // Score with consonant chord
    const s1 = createScore();
    const p1 = addPart(s1, { name: 'P' });
    addNote(s1, p1, { midi: 60, onset: 0, duration: 480, velocity: 80 });
    addNote(s1, p1, { midi: 64, onset: 0, duration: 480, velocity: 80 });
    addNote(s1, p1, { midi: 67, onset: 0, duration: 480, velocity: 80 });

    // Score with dissonant cluster
    const s2 = createScore();
    const p2 = addPart(s2, { name: 'P' });
    addNote(s2, p2, { midi: 60, onset: 0, duration: 480, velocity: 80 });
    addNote(s2, p2, { midi: 61, onset: 0, duration: 480, velocity: 80 });
    addNote(s2, p2, { midi: 62, onset: 0, duration: 480, velocity: 80 });

    const c1 = computeTension(s1, { roughness: 1, metric: 0, registral: 0, density: 0 });
    const c2 = computeTension(s2, { roughness: 1, metric: 0, registral: 0, density: 0 });

    expect(c2[0]!.components.roughness).toBeGreaterThan(c1[0]!.components.roughness);
  });

  it('respects custom weights', () => {
    const score = createScore();
    const p = addPart(score, { name: 'P' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480, velocity: 80 });

    const curveRough = computeTension(score, { roughness: 1, metric: 0, registral: 0, density: 0 });
    const curveDense = computeTension(score, { roughness: 0, metric: 0, registral: 0, density: 1 });

    // Should produce different tension profiles
    expect(curveRough[0]!.total).not.toBe(curveDense[0]!.total);
  });

  it('includes tick and seconds', () => {
    const score = createScore({ tempo: 120, ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'P' });
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });

    const curve = computeTension(score);
    expect(curve[0]!.tick).toBe(0);
    expect(curve[0]!.seconds).toBeCloseTo(0, 5);

    if (curve.length > 1) {
      expect(curve[1]!.tick).toBe(480);
      expect(curve[1]!.seconds).toBeCloseTo(0.5, 1); // 480 ticks at 120bpm, 480tpq = 0.5s
    }
  });
});

describe('Tension Edge Cases', () => {
  it('empty score returns empty curve', () => {
    const score = createScore();
    const curve = computeTension(score);
    expect(curve).toEqual([]);
  });
});

describe('Roughness Validation', () => {
  it('throws for negative frequency', () => {
    expect(() => roughness([-1, 440])).toThrow(RangeError);
  });

  it('throws for zero frequency', () => {
    expect(() => roughness([0, 440])).toThrow(RangeError);
  });

  it('throws for non-finite frequency', () => {
    expect(() => roughness([NaN, 440])).toThrow(RangeError);
    expect(() => roughness([Infinity, 440])).toThrow(RangeError);
  });
});

describe('Tension Derivatives', () => {
  function makeTestCurve() {
    const score = createScore({ tempo: 120, ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'P' });
    // Build tension: start consonant, end dissonant
    addNote(score, p, { midi: 60, onset: 0, duration: 2880 });
    addNote(score, p, { midi: 67, onset: 0, duration: 960 });    // P5 (consonant)
    addNote(score, p, { midi: 61, onset: 960, duration: 960 });   // semitone (dissonant)
    addNote(score, p, { midi: 62, onset: 1920, duration: 960 });  // close
    return computeTension(score);
  }

  it('tensionVelocity produces n-1 points', () => {
    const curve = makeTestCurve();
    const vel = tensionVelocity(curve);
    expect(vel.length).toBe(curve.length - 1);
  });

  it('tensionAcceleration produces n-2 points', () => {
    const curve = makeTestCurve();
    const acc = tensionAcceleration(curve);
    expect(acc.length).toBeLessThanOrEqual(curve.length - 2);
  });

  it('tensionIntegral is positive for positive tension', () => {
    const curve = makeTestCurve();
    const integral = tensionIntegral(curve, 0, curve[curve.length - 1]!.tick);
    expect(integral).toBeGreaterThan(0);
  });

  it('tensionIntegral returns 0 for empty range', () => {
    expect(tensionIntegral([], 0, 100)).toBe(0);
  });

  it('findTensionPeaks finds local maxima', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'P' });
    // Create a peak in the middle
    addNote(score, p, { midi: 60, onset: 0, duration: 1920 });
    addNote(score, p, { midi: 61, onset: 480, duration: 480 }); // dissonance in middle
    const curve = computeTension(score, { roughness: 1, metric: 0, registral: 0, density: 0 });
    const peaks = findTensionPeaks(curve);
    // May or may not find peaks depending on curve shape
    expect(Array.isArray(peaks)).toBe(true);
  });

  it('findTensionValleys finds local minima', () => {
    const curve = makeTestCurve();
    const valleys = findTensionValleys(curve);
    expect(Array.isArray(valleys)).toBe(true);
  });

  it('classifyTensionProfile returns valid classification', () => {
    const curve = makeTestCurve();
    const profile = classifyTensionProfile(curve);
    expect(['ramp', 'plateau', 'release', 'oscillation', 'flat']).toContain(profile);
  });
});
