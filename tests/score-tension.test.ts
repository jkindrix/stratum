import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  scoreTension,
  tpsTensionCurve,
  spiralTensionCurve,
  tivTensionCurve,
} from '../src/index.js';
import type { TPSKey } from '../src/index.js';

function buildSimpleScore() {
  const score = createScore({ ticksPerQuarter: 480 });
  const p = addPart(score, { name: 'Piano' });
  // C major chord
  addNote(score, p, { midi: 60, onset: 0, duration: 480 });
  addNote(score, p, { midi: 64, onset: 0, duration: 480 });
  addNote(score, p, { midi: 67, onset: 0, duration: 480 });
  // F major chord
  addNote(score, p, { midi: 65, onset: 480, duration: 480 });
  addNote(score, p, { midi: 69, onset: 480, duration: 480 });
  addNote(score, p, { midi: 72, onset: 480, duration: 480 });
  // G major chord
  addNote(score, p, { midi: 67, onset: 960, duration: 480 });
  addNote(score, p, { midi: 71, onset: 960, duration: 480 });
  addNote(score, p, { midi: 74, onset: 960, duration: 480 });
  // C major chord (return)
  addNote(score, p, { midi: 60, onset: 1440, duration: 480 });
  addNote(score, p, { midi: 64, onset: 1440, duration: 480 });
  addNote(score, p, { midi: 67, onset: 1440, duration: 480 });
  return score;
}

const cMajorKey: TPSKey = { tonic: 0, mode: 'major' };

describe('Score-Level Tension Curves', () => {
  describe('tpsTensionCurve', () => {
    it('returns a curve with correct number of points', () => {
      const score = buildSimpleScore();
      const curve = tpsTensionCurve(score, cMajorKey, 480);
      expect(curve.length).toBe(4); // 4 windows
    });

    it('first window has tension 0 (no prior context)', () => {
      const score = buildSimpleScore();
      const curve = tpsTensionCurve(score, cMajorKey, 480);
      expect(curve[0]!.value).toBe(0);
    });

    it('subsequent windows have non-negative tension', () => {
      const score = buildSimpleScore();
      const curve = tpsTensionCurve(score, cMajorKey, 480);
      for (const point of curve) {
        expect(point.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns empty for empty score', () => {
      const score = createScore({ ticksPerQuarter: 480 });
      addPart(score, { name: 'Piano' });
      const curve = tpsTensionCurve(score, cMajorKey, 480);
      expect(curve).toHaveLength(0);
    });

    it('returns frozen result', () => {
      const score = buildSimpleScore();
      const curve = tpsTensionCurve(score, cMajorKey, 480);
      expect(Object.isFrozen(curve)).toBe(true);
      expect(Object.isFrozen(curve[0])).toBe(true);
    });
  });

  describe('spiralTensionCurve', () => {
    it('returns a curve with correct number of points', () => {
      const score = buildSimpleScore();
      const curve = spiralTensionCurve(score, cMajorKey, 480);
      expect(curve.length).toBe(4);
    });

    it('all values are non-negative', () => {
      const score = buildSimpleScore();
      const curve = spiralTensionCurve(score, cMajorKey, 480);
      for (const point of curve) {
        expect(point.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns frozen result', () => {
      const score = buildSimpleScore();
      const curve = spiralTensionCurve(score, cMajorKey, 480);
      expect(Object.isFrozen(curve)).toBe(true);
    });
  });

  describe('tivTensionCurve', () => {
    it('returns a curve with correct number of points', () => {
      const score = buildSimpleScore();
      const curve = tivTensionCurve(score, 480);
      expect(curve.length).toBe(4);
    });

    it('values are in [0, 1]', () => {
      const score = buildSimpleScore();
      const curve = tivTensionCurve(score, 480);
      for (const point of curve) {
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.value).toBeLessThanOrEqual(1.001); // small float tolerance
      }
    });

    it('returns frozen result', () => {
      const score = buildSimpleScore();
      const curve = tivTensionCurve(score, 480);
      expect(Object.isFrozen(curve)).toBe(true);
    });
  });

  describe('scoreTension', () => {
    it('returns composite tension with all fields', () => {
      const score = buildSimpleScore();
      const curve = scoreTension(score, { key: cMajorKey, windowSize: 480 });
      expect(curve.length).toBe(4);
      for (const point of curve) {
        expect(point.tick).toBeGreaterThanOrEqual(0);
        expect(typeof point.tps).toBe('number');
        expect(typeof point.spiral).toBe('number');
        expect(typeof point.tiv).toBe('number');
        expect(typeof point.composite).toBe('number');
      }
    });

    it('composite is weighted sum of components', () => {
      const score = buildSimpleScore();
      const curve = scoreTension(score, {
        key: cMajorKey,
        windowSize: 480,
        weights: { tps: 0.5, spiral: 0.3, tiv: 0.2 },
      });
      for (const point of curve) {
        const expected = 0.5 * point.tps + 0.3 * point.spiral + 0.2 * point.tiv;
        expect(point.composite).toBeCloseTo(expected, 10);
      }
    });

    it('auto-detects key when not provided', () => {
      const score = buildSimpleScore();
      // Should not throw
      const curve = scoreTension(score, { windowSize: 480 });
      expect(curve.length).toBeGreaterThan(0);
    });

    it('respects custom hop size', () => {
      const score = buildSimpleScore();
      const curve = scoreTension(score, { key: cMajorKey, windowSize: 480, hopSize: 240 });
      // With hop=240 and maxTick=1920, we get ~8 windows
      expect(curve.length).toBeGreaterThan(4);
    });

    it('first window has tps=0', () => {
      const score = buildSimpleScore();
      const curve = scoreTension(score, { key: cMajorKey, windowSize: 480 });
      expect(curve[0]!.tps).toBe(0);
    });

    it('returns frozen result', () => {
      const score = buildSimpleScore();
      const curve = scoreTension(score, { key: cMajorKey, windowSize: 480 });
      expect(Object.isFrozen(curve)).toBe(true);
      expect(Object.isFrozen(curve[0])).toBe(true);
    });

    it('returns empty for empty score', () => {
      const score = createScore({ ticksPerQuarter: 480 });
      addPart(score, { name: 'Piano' });
      const curve = scoreTension(score, { key: cMajorKey });
      expect(curve).toHaveLength(0);
    });

    it('uses default weights of 0.4/0.3/0.3', () => {
      const score = buildSimpleScore();
      const curve = scoreTension(score, { key: cMajorKey, windowSize: 480 });
      for (const point of curve) {
        const expected = 0.4 * point.tps + 0.3 * point.spiral + 0.3 * point.tiv;
        expect(point.composite).toBeCloseTo(expected, 10);
      }
    });
  });
});
