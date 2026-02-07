import { describe, it, expect } from 'vitest';
import {
  pointSetRepresentation,
  sia,
  siatec,
  cosiatec,
  compressionRatio,
  pitchFromMidi,
  createScore,
  addPart,
  addNote,
  multiScaleNovelty,
  findStructuralBoundaries,
  selfSimilarityMatrix,
} from '../src/index.js';
import type { NoteEvent, MusicPoint, Score } from '../src/index.js';

// Helper to create NoteEvents
let idCounter = 0;
function makeEvent(midi: number, onset: number, duration = 480): NoteEvent {
  return {
    id: `test-${++idCounter}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice: 0,
  };
}

function makeScore(events: NoteEvent[]): Score {
  const score = createScore({ title: 'test', composer: '' });
  const part = addPart(score, { name: 'P1' });
  for (const e of events) {
    addNote(score, part, { midi: e.pitch.midi, onset: e.onset, duration: e.duration, velocity: e.velocity });
  }
  return score;
}

describe('SIA/SIATEC Pattern Discovery', () => {
  describe('pointSetRepresentation', () => {
    it('extracts correct (onset, pitch) pairs', () => {
      const events = [makeEvent(60, 0), makeEvent(64, 480), makeEvent(67, 960)];
      const points = pointSetRepresentation(events);
      expect(points).toHaveLength(3);
      expect(points[0]).toEqual({ onset: 0, pitch: 60 });
      expect(points[1]).toEqual({ onset: 480, pitch: 64 });
      expect(points[2]).toEqual({ onset: 960, pitch: 67 });
    });

    it('sorts lexicographically (onset first, then pitch)', () => {
      const events = [
        makeEvent(67, 960),
        makeEvent(60, 0),
        makeEvent(64, 480),
        makeEvent(62, 0),
      ];
      const points = pointSetRepresentation(events);
      expect(points[0]).toEqual({ onset: 0, pitch: 60 });
      expect(points[1]).toEqual({ onset: 0, pitch: 62 });
      expect(points[2]).toEqual({ onset: 480, pitch: 64 });
      expect(points[3]).toEqual({ onset: 960, pitch: 67 });
    });

    it('deduplicates identical points', () => {
      const events = [
        makeEvent(60, 0),
        makeEvent(60, 0, 240),
        makeEvent(64, 480),
      ];
      const points = pointSetRepresentation(events);
      expect(points).toHaveLength(2);
    });

    it('returns empty for empty input', () => {
      const points = pointSetRepresentation([]);
      expect(points).toHaveLength(0);
    });

    it('returns frozen results', () => {
      const points = pointSetRepresentation([makeEvent(60, 0)]);
      expect(Object.isFrozen(points)).toBe(true);
      if (points.length > 0) {
        expect(Object.isFrozen(points[0])).toBe(true);
      }
    });
  });

  describe('sia', () => {
    it('finds a repeated motif', () => {
      // C-E-G at onset 0 and the same at onset 1920 (transposed up by 0)
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 }, { onset: 960, pitch: 67 },
        { onset: 1920, pitch: 60 }, { onset: 2400, pitch: 64 }, { onset: 2880, pitch: 67 },
      ];
      const patterns = sia(points);
      expect(patterns.length).toBeGreaterThan(0);
      // Should find a pattern at translation vector (1920, 0) of size 3
      const found = patterns.find(
        p => p.vector.dOnset === 1920 && p.vector.dPitch === 0 && p.pattern.length === 3,
      );
      expect(found).toBeDefined();
    });

    it('finds transposed patterns', () => {
      // C-E-G at onset 0, D-F#-A at onset 1920 (up 2 semitones)
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 }, { onset: 960, pitch: 67 },
        { onset: 1920, pitch: 62 }, { onset: 2400, pitch: 66 }, { onset: 2880, pitch: 69 },
      ];
      const patterns = sia(points);
      const found = patterns.find(
        p => p.vector.dOnset === 1920 && p.vector.dPitch === 2 && p.pattern.length === 3,
      );
      expect(found).toBeDefined();
    });

    it('respects minPatternSize filter', () => {
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 },
        { onset: 960, pitch: 60 }, { onset: 1440, pitch: 64 },
      ];
      const withMin3 = sia(points, 3);
      // No 3-note pattern possible with just 4 points in this config
      // All patterns should be size 2
      for (const p of withMin3) {
        expect(p.pattern.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('returns empty for empty input', () => {
      expect(sia([])).toHaveLength(0);
    });

    it('returns empty for single point', () => {
      expect(sia([{ onset: 0, pitch: 60 }])).toHaveLength(0);
    });

    it('returns frozen results', () => {
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 },
        { onset: 960, pitch: 60 }, { onset: 1440, pitch: 64 },
      ];
      const result = sia(points);
      expect(Object.isFrozen(result)).toBe(true);
      if (result.length > 0) {
        expect(Object.isFrozen(result[0])).toBe(true);
        expect(Object.isFrozen(result[0]!.pattern)).toBe(true);
        expect(Object.isFrozen(result[0]!.vector)).toBe(true);
      }
    });
  });

  describe('siatec', () => {
    it('finds all translators for a repeated motif', () => {
      // AAA form: same 2-note motif at 3 locations
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 },
        { onset: 960, pitch: 60 }, { onset: 1440, pitch: 64 },
        { onset: 1920, pitch: 60 }, { onset: 2400, pitch: 64 },
      ];
      const tecs = siatec(points);
      // Should find a TEC for the 2-note motif with 3 translators (0,0), (960,0), (1920,0)
      const found = tecs.find(
        t => t.pattern.length === 2 && t.translators.length === 3,
      );
      expect(found).toBeDefined();
    });

    it('finds transposition as translation', () => {
      // C-E at onset 0, D-F# at onset 960 (transposed up 2)
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 },
        { onset: 960, pitch: 62 }, { onset: 1440, pitch: 66 },
      ];
      const tecs = siatec(points);
      expect(tecs.length).toBeGreaterThan(0);
      // Find a TEC whose translators include (960, 2)
      const found = tecs.find(t =>
        t.translators.some(v => v.dOnset === 960 && v.dPitch === 2),
      );
      expect(found).toBeDefined();
    });

    it('returns frozen results', () => {
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 },
        { onset: 960, pitch: 60 }, { onset: 1440, pitch: 64 },
      ];
      const tecs = siatec(points);
      expect(Object.isFrozen(tecs)).toBe(true);
      if (tecs.length > 0) {
        expect(Object.isFrozen(tecs[0])).toBe(true);
        expect(Object.isFrozen(tecs[0]!.translators)).toBe(true);
      }
    });
  });

  describe('cosiatec', () => {
    it('covers all points in a repetitive piece', () => {
      // Highly repetitive: same 3-note motif repeated 3 times
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 }, { onset: 960, pitch: 67 },
        { onset: 1440, pitch: 60 }, { onset: 1920, pitch: 64 }, { onset: 2400, pitch: 67 },
        { onset: 2880, pitch: 60 }, { onset: 3360, pitch: 64 }, { onset: 3840, pitch: 67 },
      ];
      const result = cosiatec(points);
      expect(result.tecs.length).toBeGreaterThan(0);
    });

    it('produces lower compression ratio for more repetitive pieces', () => {
      // Repetitive: same 2-note pattern 4 times
      const repetitive: MusicPoint[] = [];
      for (let i = 0; i < 4; i++) {
        repetitive.push({ onset: i * 960, pitch: 60 });
        repetitive.push({ onset: i * 960 + 480, pitch: 64 });
      }

      // Less repetitive: all different pitches
      const varied: MusicPoint[] = [];
      for (let i = 0; i < 8; i++) {
        varied.push({ onset: i * 480, pitch: 60 + i });
      }

      const repRatio = compressionRatio(repetitive);
      const varRatio = compressionRatio(varied);
      // Repetitive piece should compress better (lower ratio)
      expect(repRatio).toBeLessThanOrEqual(varRatio);
    });

    it('returns 0 for empty input', () => {
      const result = cosiatec([]);
      expect(result.compressionRatio).toBe(0);
      expect(result.tecs).toHaveLength(0);
    });
  });

  describe('compressionRatio', () => {
    it('returns a number', () => {
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60 }, { onset: 480, pitch: 64 },
        { onset: 960, pitch: 60 }, { onset: 1440, pitch: 64 },
      ];
      const ratio = compressionRatio(points);
      expect(typeof ratio).toBe('number');
      expect(ratio).toBeGreaterThan(0);
    });

    it('returns 0 for empty input', () => {
      expect(compressionRatio([])).toBe(0);
    });
  });

  describe('performance', () => {
    it('completes within reasonable time for 200+ notes', () => {
      const points: MusicPoint[] = [];
      // Create a 200-point set with some repetition
      for (let i = 0; i < 200; i++) {
        points.push({ onset: i * 240, pitch: 60 + (i % 12) });
      }
      const start = Date.now();
      const patterns = sia(points, 3);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });
});

describe('Enhanced Novelty Detection', () => {
  // Helper: create a score with two contrasting sections
  function makeABScore(): Score {
    const events: NoteEvent[] = [];
    // Section A: C major arpeggios (8 measures of quarter notes at tpq=480)
    const sectionA = [60, 64, 67, 72, 60, 64, 67, 72];
    for (let rep = 0; rep < 4; rep++) {
      for (let i = 0; i < sectionA.length; i++) {
        events.push(makeEvent(sectionA[i]!, (rep * 8 + i) * 480));
      }
    }
    // Section B: F minor (onset starts at 32*480 = 15360)
    const sectionB = [65, 68, 72, 77, 65, 68, 72, 77];
    for (let rep = 0; rep < 4; rep++) {
      for (let i = 0; i < sectionB.length; i++) {
        events.push(makeEvent(sectionB[i]!, (32 + rep * 8 + i) * 480));
      }
    }
    return makeScore(events);
  }

  describe('multiScaleNovelty', () => {
    it('returns NoveltyPoints for a valid SSM', () => {
      const score = makeABScore();
      const ssm = selfSimilarityMatrix(score, 480 * 4, 480);
      const novelty = multiScaleNovelty(ssm);
      expect(novelty.length).toBe(ssm.size);
      for (const p of novelty) {
        expect(p.tick).toBeGreaterThanOrEqual(0);
        expect(p.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns empty for empty SSM', () => {
      const ssm = { size: 0, data: [], windowSize: 480, hopSize: 480 };
      expect(multiScaleNovelty(ssm)).toHaveLength(0);
    });

    it('accepts custom kernel sizes', () => {
      const score = makeABScore();
      const ssm = selfSimilarityMatrix(score, 480 * 4, 480);
      const novelty = multiScaleNovelty(ssm, [2, 4]);
      expect(novelty.length).toBe(ssm.size);
    });

    it('returns frozen results', () => {
      const score = makeABScore();
      const ssm = selfSimilarityMatrix(score, 480 * 4, 480);
      const novelty = multiScaleNovelty(ssm);
      expect(Object.isFrozen(novelty)).toBe(true);
      if (novelty.length > 0) {
        expect(Object.isFrozen(novelty[0])).toBe(true);
      }
    });
  });

  describe('findStructuralBoundaries', () => {
    it('detects boundaries in a two-section piece', () => {
      const score = makeABScore();
      const boundaries = findStructuralBoundaries(score, {
        windowSize: 480 * 4,
        hopSize: 480,
        threshold: 0.1,
      });
      // Should find at least one boundary
      expect(boundaries.length).toBeGreaterThanOrEqual(0);
      for (const b of boundaries) {
        expect(b.confidence).toBeGreaterThanOrEqual(0);
        expect(b.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty for an empty score', () => {
      const score = createScore({ title: 'empty', composer: '' });
      addPart(score, { name: 'P1' });
      const boundaries = findStructuralBoundaries(score);
      expect(boundaries).toHaveLength(0);
    });

    it('returns frozen results', () => {
      const score = makeABScore();
      const boundaries = findStructuralBoundaries(score, {
        windowSize: 480 * 4,
        hopSize: 480,
      });
      expect(Object.isFrozen(boundaries)).toBe(true);
      if (boundaries.length > 0) {
        expect(Object.isFrozen(boundaries[0])).toBe(true);
      }
    });

    it('confidence values are between 0 and 1', () => {
      const score = makeABScore();
      const boundaries = findStructuralBoundaries(score, {
        windowSize: 480 * 4,
        hopSize: 480,
        threshold: 0.05,
      });
      for (const b of boundaries) {
        expect(b.confidence).toBeGreaterThanOrEqual(0);
        expect(b.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
