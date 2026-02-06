import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  detectKey,
  detectKeyWindowed,
  detectKeyTIV,
} from '../src/index.js';
import type { Score } from '../src/index.js';

function buildScaleScore(midiNotes: number[], ticksPerNote = 480): Score {
  const score = createScore({ ticksPerQuarter: 480 });
  const part = addPart(score, { name: 'Piano' });
  for (let i = 0; i < midiNotes.length; i++) {
    addNote(score, part, {
      midi: midiNotes[i]!,
      onset: i * ticksPerNote,
      duration: ticksPerNote,
      velocity: 80,
    });
  }
  return score;
}

describe('Key Detection', () => {
  describe('detectKey', () => {
    it('detects C major from C major scale', () => {
      // C D E F G A B
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKey(score);
      expect(result.best.tonic).toBe(0);
      expect(result.best.mode).toBe('major');
      expect(result.best.name).toBe('C major');
      expect(result.best.correlation).toBeGreaterThan(0.7);
    });

    it('detects A minor from A minor melody', () => {
      // A-weighted melody: tonic emphasis disambiguates from relative major (C)
      // A B C D E F G A A (tonic repeated for weight)
      const score = buildScaleScore([69, 71, 72, 74, 76, 77, 79, 69, 69]);
      const result = detectKey(score);
      expect(result.best.tonic).toBe(9);
      expect(result.best.mode).toBe('minor');
      expect(result.best.name).toBe('A minor');
    });

    it('detects G major from G major scale', () => {
      // G A B C D E F#
      const score = buildScaleScore([67, 69, 71, 72, 74, 76, 78]);
      const result = detectKey(score);
      expect(result.best.tonic).toBe(7);
      expect(result.best.mode).toBe('major');
      expect(result.best.name).toBe('G major');
    });

    it('detects D minor from D minor melody', () => {
      // D-weighted melody: tonic emphasis disambiguates from relative major (F)
      // D E F G A Bb C D D (tonic repeated for weight)
      const score = buildScaleScore([62, 64, 65, 67, 69, 70, 72, 62, 62]);
      const result = detectKey(score);
      expect(result.best.tonic).toBe(2);
      expect(result.best.mode).toBe('minor');
    });

    it('returns 24 candidates sorted by correlation', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKey(score);
      expect(result.candidates).toHaveLength(24);
      // Verify sorted descending
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i]!.correlation)
          .toBeLessThanOrEqual(result.candidates[i - 1]!.correlation);
      }
    });

    it('chromatic passage produces low confidence', () => {
      // All 12 pitch classes equally
      const score = buildScaleScore([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71]);
      const result = detectKey(score);
      // Correlation should be near 0 for chromatic scale
      expect(Math.abs(result.best.correlation)).toBeLessThan(0.5);
    });

    it('works with Temperley profile', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKey(score, { profile: 'temperley' });
      expect(result.best.tonic).toBe(0);
      expect(result.best.mode).toBe('major');
    });

    it('supports custom key profile', () => {
      const customProfile = {
        major: [10, 0, 5, 0, 7, 3, 0, 8, 0, 4, 0, 6],
        minor: [10, 0, 5, 7, 0, 3, 0, 8, 4, 0, 6, 0],
      };
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKey(score, { profile: customProfile });
      expect(result.candidates).toHaveLength(24);
    });

    it('supports count-based weighting (no duration)', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKey(score, { weightByDuration: false });
      expect(result.best.tonic).toBe(0);
      expect(result.best.mode).toBe('major');
    });

    it('throws on empty score', () => {
      const score = createScore();
      addPart(score, { name: 'Empty' });
      expect(() => detectKey(score)).toThrow('no note events');
    });

    it('detects Eb major', () => {
      // Eb F G Ab Bb C D
      const score = buildScaleScore([63, 65, 67, 68, 70, 72, 74]);
      const result = detectKey(score);
      expect(result.best.tonic).toBe(3);
      expect(result.best.mode).toBe('major');
      expect(result.best.name).toBe('Eb major');
    });
  });

  describe('detectKeyWindowed', () => {
    it('detects key changes in a modulating piece', () => {
      const score = createScore({ ticksPerQuarter: 480 });
      const part = addPart(score, { name: 'Piano' });

      // First section: C major with tonic/dominant emphasis
      // C(long) D E F G(long) A B — 5280 ticks
      const section1 = [
        { midi: 60, dur: 960 },  // C (tonic, 2 beats)
        { midi: 62, dur: 480 },  // D
        { midi: 64, dur: 480 },  // E
        { midi: 65, dur: 480 },  // F
        { midi: 67, dur: 960 },  // G (dominant, 2 beats)
        { midi: 69, dur: 480 },  // A
        { midi: 71, dur: 480 },  // B
      ];
      let tick = 0;
      for (const n of section1) {
        addNote(score, part, { midi: n.midi, onset: tick, duration: n.dur, velocity: 80 });
        tick += n.dur;
      }

      // Second section: A major with tonic/dominant emphasis (distant from C)
      // A(long) B C# D E(long) F# G#
      const offset = tick;
      const section2 = [
        { midi: 69, dur: 960 },  // A (tonic, 2 beats)
        { midi: 71, dur: 480 },  // B
        { midi: 73, dur: 480 },  // C#
        { midi: 74, dur: 480 },  // D
        { midi: 76, dur: 960 },  // E (dominant, 2 beats)
        { midi: 78, dur: 480 },  // F#
        { midi: 80, dur: 480 },  // G#
      ];
      tick = offset;
      for (const n of section2) {
        addNote(score, part, { midi: n.midi, onset: tick, duration: n.dur, velocity: 80 });
        tick += n.dur;
      }

      // Each section is 4320 ticks; use matching window size
      const results = detectKeyWindowed(score, 4320);
      expect(results.length).toBeGreaterThanOrEqual(2);

      // First window should detect C major
      expect(results[0]!.result.best.tonic).toBe(0);
      expect(results[0]!.result.best.mode).toBe('major');

      // Second window should detect A major
      const last = results[results.length - 1]!;
      expect(last.result.best.tonic).toBe(9);
      expect(last.result.best.mode).toBe('major');
    });

    it('returns proper window boundaries', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const results = detectKeyWindowed(score, 960);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.startTick).toBe(0);
      expect(results[0]!.endTick).toBe(960);
    });

    it('throws on non-positive window size', () => {
      const score = buildScaleScore([60, 62, 64]);
      expect(() => detectKeyWindowed(score, 0)).toThrow('positive');
      expect(() => detectKeyWindowed(score, -100)).toThrow('positive');
    });

    it('throws on empty score', () => {
      const score = createScore();
      addPart(score, { name: 'Empty' });
      expect(() => detectKeyWindowed(score, 960)).toThrow('no note events');
    });
  });

  describe('detectKeyTIV', () => {
    it('detects C major from C major scale', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKeyTIV(score);
      expect(result.best.tonic).toBe(0);
      expect(result.best.mode).toBe('major');
      expect(result.best.name).toBe('C major');
    });

    it('detects A minor from A minor melody (tonic-weighted)', () => {
      // A B C D E F G A A (tonic repeated for weight)
      const score = buildScaleScore([69, 71, 72, 74, 76, 77, 79, 69, 69]);
      const result = detectKeyTIV(score);
      expect(result.best.tonic).toBe(9);
      expect(result.best.mode).toBe('minor');
    });

    it('detects G major from G major scale', () => {
      const score = buildScaleScore([67, 69, 71, 72, 74, 76, 78]);
      const result = detectKeyTIV(score);
      expect(result.best.tonic).toBe(7);
      expect(result.best.mode).toBe('major');
    });

    it('returns 24 candidates sorted descending', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKeyTIV(score);
      expect(result.candidates).toHaveLength(24);
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i]!.correlation)
          .toBeLessThanOrEqual(result.candidates[i - 1]!.correlation);
      }
    });

    it('correlation values in [0, 1]', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKeyTIV(score);
      for (const c of result.candidates) {
        expect(c.correlation).toBeGreaterThanOrEqual(0);
        expect(c.correlation).toBeLessThanOrEqual(1);
      }
    });

    it('throws on empty score', () => {
      const score = createScore();
      addPart(score, { name: 'Empty' });
      expect(() => detectKeyTIV(score)).toThrow('no note events');
    });

    it('works with Temperley profile', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKeyTIV(score, { profile: 'temperley' });
      expect(result.best.tonic).toBe(0);
      expect(result.best.mode).toBe('major');
    });

    it('supports weightByDuration option', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKeyTIV(score, { weightByDuration: false });
      // With equal durations, TIV may prefer relative minor — just verify it runs
      // and produces a valid result in the correct key family (C major or A minor)
      expect(result.candidates).toHaveLength(24);
      const bestTonic = result.best.tonic;
      const bestMode = result.best.mode;
      // C major (0) or A minor (9) are both valid for equal-weight C major scale
      expect([0, 9]).toContain(bestTonic);
      if (bestTonic === 0) expect(bestMode).toBe('major');
      if (bestTonic === 9) expect(bestMode).toBe('minor');
    });

    it('returns frozen result', () => {
      const score = buildScaleScore([60, 62, 64, 65, 67, 69, 71]);
      const result = detectKeyTIV(score);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.candidates)).toBe(true);
    });
  });
});
