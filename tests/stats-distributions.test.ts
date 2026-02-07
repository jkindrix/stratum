import { describe, it, expect } from 'vitest';
import {
  pitchFromMidi,
  createScore,
  addPart,
  addNote,
  pitchDistribution,
  intervalDistribution,
  durationDistribution,
  chordTypeDistribution,
  styleFingerprint,
  styleSimilarity,
} from '../src/index.js';
import type { NoteEvent, Score } from '../src/index.js';

function makeNote(midi: number, onset: number, duration: number): NoteEvent {
  return {
    id: `n_${onset}_${midi}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice: 0,
  };
}

function buildChordScore(): Score {
  const score = createScore();
  const part = addPart(score, 'Piano');
  // C major chord (C4, E4, G4) at tick 0
  addNote(score, part, { midi: 60, onset: 0, duration: 480, velocity: 80 });
  addNote(score, part, { midi: 64, onset: 0, duration: 480, velocity: 80 });
  addNote(score, part, { midi: 67, onset: 0, duration: 480, velocity: 80 });
  // F major chord (F4, A4, C5) at tick 480
  addNote(score, part, { midi: 65, onset: 480, duration: 480, velocity: 80 });
  addNote(score, part, { midi: 69, onset: 480, duration: 480, velocity: 80 });
  addNote(score, part, { midi: 72, onset: 480, duration: 480, velocity: 80 });
  // G major chord (G4, B4, D5) at tick 960
  addNote(score, part, { midi: 67, onset: 960, duration: 480, velocity: 80 });
  addNote(score, part, { midi: 71, onset: 960, duration: 480, velocity: 80 });
  addNote(score, part, { midi: 74, onset: 960, duration: 480, velocity: 80 });
  return score;
}

describe('Statistical Distributions', () => {
  describe('pitchDistribution', () => {
    it('returns 12-element array summing to 1.0', () => {
      const events = [
        makeNote(60, 0, 480),   // C
        makeNote(62, 480, 480), // D
        makeNote(64, 960, 480), // E
      ];
      const dist = pitchDistribution(events);
      expect(dist).toHaveLength(12);
      const sum = dist.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('puts highest weight on most frequent PC', () => {
      const events = [
        makeNote(60, 0, 480),   // C
        makeNote(60, 480, 480), // C
        makeNote(60, 960, 480), // C
        makeNote(64, 1440, 480), // E
      ];
      const dist = pitchDistribution(events);
      // C (PC 0) should be 3/4 = 0.75
      expect(dist[0]).toBeCloseTo(0.75, 10);
      // E (PC 4) should be 1/4 = 0.25
      expect(dist[4]).toBeCloseTo(0.25, 10);
    });

    it('C-major scale has highest bins at C, E, G', () => {
      // C major scale: C D E F G A B
      const scale = [60, 62, 64, 65, 67, 69, 71];
      const events = scale.map((midi, i) => makeNote(midi, i * 480, 480));
      const dist = pitchDistribution(events);
      // Each note appears once out of 7; all should be ~0.143
      for (const midi of scale) {
        const pc = midi % 12;
        expect(dist[pc]).toBeCloseTo(1 / 7, 10);
      }
      // Non-scale notes should be 0
      expect(dist[1]).toBe(0);  // C#
      expect(dist[3]).toBe(0);  // Eb
    });

    it('returns frozen array', () => {
      const events = [makeNote(60, 0, 480)];
      const dist = pitchDistribution(events);
      expect(Object.isFrozen(dist)).toBe(true);
    });

    it('throws RangeError for empty events', () => {
      expect(() => pitchDistribution([])).toThrow(RangeError);
    });
  });

  describe('intervalDistribution', () => {
    it('counts signed intervals between successive notes', () => {
      const events = [
        makeNote(60, 0, 480),   // C4
        makeNote(64, 480, 480), // E4 → +4
        makeNote(67, 960, 480), // G4 → +3
        makeNote(60, 1440, 480), // C4 → -7
      ];
      const dist = intervalDistribution(events);
      expect(dist.get(4)).toBe(1);  // +4
      expect(dist.get(3)).toBe(1);  // +3
      expect(dist.get(-7)).toBe(1); // -7
    });

    it('returns empty map for single event', () => {
      const events = [makeNote(60, 0, 480)];
      const dist = intervalDistribution(events);
      expect(dist.size).toBe(0);
    });

    it('counts repeated intervals', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),   // +2
        makeNote(64, 960, 480),   // +2
        makeNote(66, 1440, 480),  // +2
      ];
      const dist = intervalDistribution(events);
      expect(dist.get(2)).toBe(3);
    });

    it('throws RangeError for empty events', () => {
      expect(() => intervalDistribution([])).toThrow(RangeError);
    });
  });

  describe('durationDistribution', () => {
    it('counts frequency of each duration value', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(64, 960, 240),
        makeNote(65, 1200, 240),
      ];
      const dist = durationDistribution(events);
      expect(dist.get(480)).toBe(2);
      expect(dist.get(240)).toBe(2);
    });

    it('handles single duration', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
      ];
      const dist = durationDistribution(events);
      expect(dist.size).toBe(1);
      expect(dist.get(480)).toBe(2);
    });

    it('throws RangeError for empty events', () => {
      expect(() => durationDistribution([])).toThrow(RangeError);
    });
  });

  describe('chordTypeDistribution', () => {
    it('counts chord symbols from a score', () => {
      const score = buildChordScore();
      const dist = chordTypeDistribution(score);
      // Should have at least some entries
      expect(dist.size).toBeGreaterThan(0);
    });

    it('returns empty map for score with no chords', () => {
      const score = createScore();
      const part = addPart(score, 'Solo');
      addNote(score, part, { midi: 60, onset: 0, duration: 480, velocity: 80 });
      const dist = chordTypeDistribution(score);
      // Single note can't form a chord
      expect(dist.size).toBe(0);
    });
  });

  describe('styleFingerprint', () => {
    it('combines all sub-distributions', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(64, 480, 480),
        makeNote(67, 960, 480),
        makeNote(60, 1440, 480),
      ];
      const fp = styleFingerprint(events);
      expect(fp.pitchDistribution).toHaveLength(12);
      expect(fp.pitchEntropy).toBeGreaterThan(0);
      expect(fp.rhythmicEntropy).toBe(0); // uniform IOIs
      expect(fp.zipfExponent).toBeGreaterThanOrEqual(0);
      expect(fp.intervalDistribution.size).toBeGreaterThan(0);
      expect(fp.durationDistribution.size).toBe(1);
    });

    it('returns frozen result', () => {
      const events = [makeNote(60, 0, 480), makeNote(64, 480, 480)];
      const fp = styleFingerprint(events);
      expect(Object.isFrozen(fp)).toBe(true);
    });

    it('throws RangeError for empty events', () => {
      expect(() => styleFingerprint([])).toThrow(RangeError);
    });
  });

  describe('styleSimilarity', () => {
    it('returns 1.0 for identical fingerprints', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(64, 480, 480),
        makeNote(67, 960, 480),
      ];
      const fp = styleFingerprint(events);
      expect(styleSimilarity(fp, fp)).toBeCloseTo(1.0, 10);
    });

    it('returns value between 0 and 1', () => {
      const eventsA = [
        makeNote(60, 0, 480), // C
        makeNote(64, 480, 480), // E
        makeNote(67, 960, 480), // G
      ];
      const eventsB = [
        makeNote(61, 0, 480), // C#
        makeNote(65, 480, 480), // F
        makeNote(68, 960, 480), // G#
      ];
      const fpA = styleFingerprint(eventsA);
      const fpB = styleFingerprint(eventsB);
      const sim = styleSimilarity(fpA, fpB);
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
    });

    it('returns 0 for completely disjoint distributions', () => {
      const eventsA = [makeNote(60, 0, 480)]; // only C
      const eventsB = [makeNote(66, 0, 480)]; // only F#
      const fpA = styleFingerprint(eventsA);
      const fpB = styleFingerprint(eventsB);
      expect(styleSimilarity(fpA, fpB)).toBe(0);
    });
  });
});
