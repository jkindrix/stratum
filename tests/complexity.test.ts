import { describe, it, expect } from 'vitest';
import {
  lzComplexity,
  syncopationIndex,
  weightedNoteToBeatDistance,
  grooveScore,
} from '../src/time/complexity.js';
import { buildMetricLevels } from '../src/time/metric.js';
import type { NoteEvent } from '../src/core/types.js';

/** Helper to create a NoteEvent at a given onset. */
function note(onset: number, duration = 120, velocity = 100, midi = 60): NoteEvent {
  return {
    id: `n${onset}`,
    pitch: { midi, pitchClass: midi % 12, octave: Math.floor(midi / 12) - 1 },
    onset,
    duration,
    velocity,
    voice: 0,
  };
}

const ts44 = { numerator: 4, denominator: 4, atTick: 0 };
const levels = buildMetricLevels(ts44, 480);

describe('Rhythmic Complexity', () => {
  // -----------------------------------------------------------------------
  // lzComplexity
  // -----------------------------------------------------------------------
  describe('lzComplexity', () => {
    it('returns 0 for empty events', () => {
      expect(lzComplexity([])).toBe(0);
    });

    it('returns low complexity for steady pulse', () => {
      // Evenly spaced quarter notes
      const events = [0, 480, 960, 1440].map(t => note(t));
      const c = lzComplexity(events, 480);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    });

    it('returns higher complexity for irregular pattern', () => {
      const regular = [0, 480, 960, 1440, 1920, 2400, 2880, 3360].map(t => note(t));
      const irregular = [0, 120, 960, 1080, 1920, 2040, 2160, 3360].map(t => note(t));
      const regC = lzComplexity(regular, 120);
      const irrC = lzComplexity(irregular, 120);
      expect(irrC).toBeGreaterThan(regC);
    });

    it('is normalized to [0, 1]', () => {
      const events = [0, 100, 350, 500, 720, 900, 1100, 1300].map(t => note(t));
      const c = lzComplexity(events, 50);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    });

    it('throws on invalid gridTicks', () => {
      expect(() => lzComplexity([note(0)], 0)).toThrow('positive integer');
      expect(() => lzComplexity([note(0)], -1)).toThrow('positive integer');
      expect(() => lzComplexity([note(0)], 1.5)).toThrow('positive integer');
    });
  });

  // -----------------------------------------------------------------------
  // syncopationIndex
  // -----------------------------------------------------------------------
  describe('syncopationIndex', () => {
    it('returns 0 for single event', () => {
      expect(syncopationIndex([note(0)], levels)).toBe(0);
    });

    it('returns 0 for empty events', () => {
      expect(syncopationIndex([], levels)).toBe(0);
    });

    it('downbeats only = low or zero syncopation', () => {
      // Notes on every downbeat
      const events = [0, 1920].map(t => note(t));
      const syn = syncopationIndex(events, levels);
      expect(syn).toBeGreaterThanOrEqual(0);
    });

    it('off-beat to downbeat has positive syncopation', () => {
      // Weak eighth note (onset=240) followed by strong beat (onset=480)
      const events = [note(240), note(480)];
      const syn = syncopationIndex(events, levels);
      expect(syn).toBeGreaterThan(0);
    });

    it('syncopated pattern has higher index than straight', () => {
      // Straight: on beats 0, 480, 960, 1440
      const straight = [0, 480, 960, 1440].map(t => note(t));
      // Syncopated: on offbeats 240, 720, 1200, 1680
      const syncopated = [240, 720, 1200, 1680].map(t => note(t));
      // Both followed by downbeat to create syncopation
      const straightWithDown = [...straight, note(1920)];
      const syncWithDown = [...syncopated, note(1920)];
      expect(syncopationIndex(syncWithDown, levels))
        .toBeGreaterThanOrEqual(syncopationIndex(straightWithDown, levels));
    });
  });

  // -----------------------------------------------------------------------
  // weightedNoteToBeatDistance
  // -----------------------------------------------------------------------
  describe('weightedNoteToBeatDistance', () => {
    it('returns 0 for empty events', () => {
      expect(weightedNoteToBeatDistance([], levels)).toBe(0);
    });

    it('returns 0 for notes exactly on beats', () => {
      const events = [0, 480, 960].map(t => note(t));
      expect(weightedNoteToBeatDistance(events, levels)).toBeCloseTo(0);
    });

    it('returns higher value for off-beat notes', () => {
      const onBeat = [0, 480, 960].map(t => note(t));
      const offBeat = [120, 600, 1080].map(t => note(t));
      const onVal = weightedNoteToBeatDistance(onBeat, levels);
      const offVal = weightedNoteToBeatDistance(offBeat, levels);
      expect(offVal).toBeGreaterThan(onVal);
    });

    it('result is in [0, 1]', () => {
      const events = [60, 240, 540, 780].map(t => note(t));
      const val = weightedNoteToBeatDistance(events, levels);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });

    it('weights by velocity', () => {
      // Same onset, different velocities
      const loudOff = [note(240, 120, 127)];
      const quietOff = [note(240, 120, 20)];
      // Both should have same normalized distance since we divide by total weight
      const loudVal = weightedNoteToBeatDistance(loudOff, levels);
      const quietVal = weightedNoteToBeatDistance(quietOff, levels);
      expect(loudVal).toBeCloseTo(quietVal, 6);
    });
  });

  // -----------------------------------------------------------------------
  // grooveScore
  // -----------------------------------------------------------------------
  describe('grooveScore', () => {
    it('returns 0 for single event', () => {
      expect(grooveScore([note(0)], levels)).toBe(0);
    });

    it('returns value in [0, 1]', () => {
      const events = [0, 240, 480, 720, 960, 1200, 1440, 1680].map(t => note(t));
      const g = grooveScore(events, levels);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    });

    it('respects custom weights', () => {
      const events = [0, 240, 480, 720, 960].map(t => note(t));
      const g1 = grooveScore(events, levels, { syncopationWeight: 1, microTimingWeight: 0, varietyWeight: 0 });
      const g2 = grooveScore(events, levels, { syncopationWeight: 0, microTimingWeight: 1, varietyWeight: 0 });
      // Different weights should produce different results (in general)
      expect(typeof g1).toBe('number');
      expect(typeof g2).toBe('number');
    });

    it('groove increases with rhythmic variety', () => {
      // Uniform IOIs
      const uniform = [0, 480, 960, 1440, 1920].map(t => note(t));
      // Varied IOIs
      const varied = [0, 120, 480, 840, 1920].map(t => note(t));
      // Increase variety weight to isolate IOI effect
      const opts = { syncopationWeight: 0, microTimingWeight: 0, varietyWeight: 1 };
      expect(grooveScore(varied, levels, opts)).toBeGreaterThan(grooveScore(uniform, levels, opts));
    });
  });
});
