import { describe, it, expect } from 'vitest';
import {
  metricalPreference,
  groupingBoundaries,
  hierarchicalMeter,
} from '../src/time/gttm.js';
import { createScore, addPart, addNote } from '../src/core/score.js';
import type { NoteEvent, Score } from '../src/core/types.js';

/** Helper to create a NoteEvent. */
function note(onset: number, duration = 480, velocity = 100, midi = 60): NoteEvent {
  return {
    id: `n${onset}`,
    pitch: { midi, pitchClass: midi % 12, octave: Math.floor(midi / 12) - 1 },
    onset,
    duration,
    velocity,
    voice: 0,
  };
}

/** Build a simple test score with the given events. */
function makeScore(events: Array<{ midi: number; onset: number; duration: number; velocity: number }>): Score {
  const score = createScore({ title: 'Test', composer: '' });
  const part = addPart(score, { name: 'Piano', midiProgram: 0, midiChannel: 0 });
  for (const e of events) {
    addNote(score, part, e);
  }
  return score;
}

describe('GTTM Preference Rules', () => {
  // -----------------------------------------------------------------------
  // metricalPreference
  // -----------------------------------------------------------------------
  describe('metricalPreference', () => {
    it('returns empty for empty score', () => {
      const score = createScore({ title: 'Empty', composer: '' });
      addPart(score, { name: 'P', midiProgram: 0, midiChannel: 0 });
      expect(metricalPreference(score)).toEqual([]);
    });

    it('returns results for a score with events', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
        { midi: 64, onset: 480, duration: 480, velocity: 80 },
        { midi: 67, onset: 960, duration: 480, velocity: 90 },
      ]);
      const result = metricalPreference(score);
      expect(result.length).toBeGreaterThan(0);
    });

    it('each result has tick, score, and contributions', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
        { midi: 64, onset: 480, duration: 480, velocity: 80 },
      ]);
      const result = metricalPreference(score);
      for (const r of result) {
        expect(typeof r.tick).toBe('number');
        expect(typeof r.score).toBe('number');
        expect(typeof r.contributions.onset).toBe('number');
        expect(typeof r.contributions.duration).toBe('number');
        expect(typeof r.contributions.bass).toBe('number');
        expect(typeof r.contributions.harmony).toBe('number');
      }
    });

    it('onset density is higher where more notes begin', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
        { midi: 64, onset: 0, duration: 480, velocity: 100 },
        { midi: 67, onset: 0, duration: 480, velocity: 100 },
        { midi: 72, onset: 480, duration: 480, velocity: 100 },
      ]);
      const result = metricalPreference(score);
      const tick0 = result.find(r => r.tick === 0);
      const tick480 = result.find(r => r.tick === 480);
      expect(tick0).toBeDefined();
      expect(tick480).toBeDefined();
      expect(tick0!.contributions.onset).toBeGreaterThan(tick480!.contributions.onset);
    });

    it('respects custom gridTicks', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 960, velocity: 100 },
      ]);
      const result = metricalPreference(score, { gridTicks: 240 });
      // With gridTicks=240, we should have more grid points
      const defaultResult = metricalPreference(score);
      expect(result.length).toBeGreaterThanOrEqual(defaultResult.length);
    });

    it('bass register notes contribute to bass score', () => {
      const score = makeScore([
        { midi: 36, onset: 0, duration: 480, velocity: 100 }, // C2 (bass)
        { midi: 84, onset: 480, duration: 480, velocity: 100 }, // C6 (treble)
      ]);
      const result = metricalPreference(score);
      const tick0 = result.find(r => r.tick === 0);
      const tick480 = result.find(r => r.tick === 480);
      expect(tick0!.contributions.bass).toBeGreaterThan(tick480!.contributions.bass);
    });

    it('results are frozen', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
      ]);
      const result = metricalPreference(score);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // groupingBoundaries
  // -----------------------------------------------------------------------
  describe('groupingBoundaries', () => {
    it('returns empty for single event', () => {
      expect(groupingBoundaries([note(0)])).toEqual([]);
    });

    it('returns empty for empty events', () => {
      expect(groupingBoundaries([])).toEqual([]);
    });

    it('detects boundary at large gap', () => {
      // Group 1: notes at 0, 480; Group 2: notes at 3840, 4320 (large gap)
      const events = [note(0), note(480), note(3840), note(4320)];
      const boundaries = groupingBoundaries(events);
      expect(boundaries.length).toBeGreaterThan(0);
      expect(boundaries.some(b => b.rules.includes('proximity'))).toBe(true);
    });

    it('detects boundary at large pitch change', () => {
      // C2 → C6 = 48 semitones
      const events = [
        note(0, 480, 100, 36),
        note(480, 480, 100, 84),
      ];
      const boundaries = groupingBoundaries(events);
      expect(boundaries.some(b => b.rules.includes('change'))).toBe(true);
    });

    it('boundary strength is positive', () => {
      const events = [note(0), note(480), note(3840)];
      const boundaries = groupingBoundaries(events);
      for (const b of boundaries) {
        expect(b.strength).toBeGreaterThan(0);
      }
    });

    it('results are frozen', () => {
      const events = [note(0), note(480), note(3840)];
      const boundaries = groupingBoundaries(events);
      expect(Object.isFrozen(boundaries)).toBe(true);
    });

    it('respects custom proximity ratio', () => {
      const events = [note(0), note(480), note(1440), note(1920)];
      // Higher ratio = fewer boundaries detected
      const strict = groupingBoundaries(events, { proximityRatio: 3.0 });
      const relaxed = groupingBoundaries(events, { proximityRatio: 1.1 });
      expect(relaxed.length).toBeGreaterThanOrEqual(strict.length);
    });
  });

  // -----------------------------------------------------------------------
  // hierarchicalMeter
  // -----------------------------------------------------------------------
  describe('hierarchicalMeter', () => {
    it('returns empty for empty score', () => {
      const score = createScore({ title: 'Empty', composer: '' });
      addPart(score, { name: 'P', midiProgram: 0, midiChannel: 0 });
      expect(hierarchicalMeter(score)).toEqual([]);
    });

    it('assigns levels 0-3', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
        { midi: 64, onset: 480, duration: 480, velocity: 80 },
        { midi: 67, onset: 960, duration: 480, velocity: 90 },
        { midi: 60, onset: 1440, duration: 480, velocity: 100 },
        { midi: 64, onset: 1920, duration: 480, velocity: 80 },
      ]);
      const grid = hierarchicalMeter(score);
      expect(grid.length).toBeGreaterThan(0);
      const levels = new Set(grid.map(g => g.level));
      for (const l of levels) {
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(3);
      }
    });

    it('each entry has tick, strength, level', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
        { midi: 64, onset: 480, duration: 480, velocity: 80 },
      ]);
      const grid = hierarchicalMeter(score);
      for (const entry of grid) {
        expect(typeof entry.tick).toBe('number');
        expect(typeof entry.strength).toBe('number');
        expect(typeof entry.level).toBe('number');
      }
    });

    it('results are frozen', () => {
      const score = makeScore([
        { midi: 60, onset: 0, duration: 480, velocity: 100 },
      ]);
      const grid = hierarchicalMeter(score);
      expect(Object.isFrozen(grid)).toBe(true);
    });
  });
});
