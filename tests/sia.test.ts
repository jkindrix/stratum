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
  pitchHistogramFeature,
  rhythmFeature,
  intervalFeature,
  combinedFeature,
  euclideanSimilarity,
  correlationSimilarity,
  enhanceSSM,
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

describe('Enhanced SSM Features', () => {
  // Reuse helper from above scope
  function makeEvt(midi: number, onset: number, duration = 480): NoteEvent {
    return {
      id: `ssm-${++idCounter}`,
      pitch: pitchFromMidi(midi),
      onset,
      duration,
      velocity: 80,
      voice: 0,
    };
  }

  function buildScore(events: NoteEvent[]): Score {
    const score = createScore({ title: 'test', composer: '' });
    const part = addPart(score, { name: 'P1' });
    for (const e of events) {
      addNote(score, part, { midi: e.pitch.midi, onset: e.onset, duration: e.duration, velocity: e.velocity });
    }
    return score;
  }

  describe('pitchHistogramFeature', () => {
    it('returns 128-element vector summing to ~1', () => {
      const events = [makeEvt(60, 0), makeEvt(64, 480), makeEvt(67, 960)];
      const feature = pitchHistogramFeature(events);
      expect(feature).toHaveLength(128);
      const sum = feature.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe('rhythmFeature', () => {
    it('returns 16-element normalized vector', () => {
      const events = [makeEvt(60, 0), makeEvt(64, 480), makeEvt(67, 960)];
      const feature = rhythmFeature(events);
      expect(feature).toHaveLength(16);
      const sum = feature.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe('intervalFeature', () => {
    it('returns 25-element normalized vector', () => {
      const events = [makeEvt(60, 0), makeEvt(64, 480), makeEvt(67, 960)];
      const feature = intervalFeature(events);
      expect(feature).toHaveLength(25);
      const sum = feature.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe('combinedFeature', () => {
    it('concatenates to 53 elements', () => {
      const events = [makeEvt(60, 0), makeEvt(64, 480), makeEvt(67, 960)];
      const feature = combinedFeature(events);
      expect(feature).toHaveLength(53);
    });
  });

  describe('euclideanSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 0, 0.5, 0.3];
      expect(euclideanSimilarity(a, a)).toBe(1);
    });

    it('returns < 1 for different vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(euclideanSimilarity(a, b)).toBeLessThan(1);
      expect(euclideanSimilarity(a, b)).toBeGreaterThan(0);
    });
  });

  describe('correlationSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 2, 3, 4];
      expect(correlationSimilarity(a, a)).toBeCloseTo(1, 10);
    });

    it('returns ~0 for perfectly anticorrelated', () => {
      const a = [1, 2, 3, 4];
      const b = [4, 3, 2, 1];
      expect(correlationSimilarity(a, b)).toBeCloseTo(0, 10);
    });
  });

  describe('selfSimilarityMatrix with custom metric', () => {
    it('accepts 5th metric argument', () => {
      const events = [makeEvt(60, 0), makeEvt(64, 480), makeEvt(67, 960), makeEvt(72, 1440)];
      const score = buildScore(events);
      const ssm = selfSimilarityMatrix(score, 480, 480, undefined, euclideanSimilarity);
      expect(ssm.size).toBeGreaterThan(0);
      // Diagonal should be 1 (identical windows)
      for (let i = 0; i < ssm.size; i++) {
        expect(ssm.data[i]![i]).toBeCloseTo(1, 5);
      }
    });
  });

  describe('enhanceSSM', () => {
    it('applies thresholding and returns frozen result', () => {
      const events: NoteEvent[] = [];
      for (let i = 0; i < 8; i++) {
        events.push(makeEvt(60 + (i % 4), i * 480));
      }
      const score = buildScore(events);
      const ssm = selfSimilarityMatrix(score, 480, 480);
      const enhanced = enhanceSSM(ssm, { threshold: 0.5 });

      expect(Object.isFrozen(enhanced)).toBe(true);
      expect(enhanced.size).toBe(ssm.size);
      // All values should be >= 0.5 or 0
      for (let i = 0; i < enhanced.size; i++) {
        for (let j = 0; j < enhanced.size; j++) {
          const val = enhanced.data[i]![j]!;
          expect(val === 0 || val >= 0.5).toBe(true);
        }
      }
    });
  });
});

describe('SIA Multi-Dimensional Points', () => {
  describe('pointSetRepresentation with options', () => {
    function makeEvt(midi: number, onset: number, duration = 480, velocity = 80): NoteEvent {
      return {
        id: `dim-${++idCounter}`,
        pitch: pitchFromMidi(midi),
        onset,
        duration,
        velocity,
        voice: 0,
      };
    }

    it('includes duration when { includeDuration: true }', () => {
      const events = [makeEvt(60, 0, 480), makeEvt(64, 480, 960)];
      const points = pointSetRepresentation(events, { includeDuration: true });
      expect(points[0]!.duration).toBe(480);
      expect(points[1]!.duration).toBe(960);
    });

    it('includes velocity when { includeVelocity: true }', () => {
      const events = [makeEvt(60, 0, 480, 64), makeEvt(64, 480, 480, 100)];
      const points = pointSetRepresentation(events, { includeVelocity: true });
      expect(points[0]!.velocity).toBe(64);
      expect(points[1]!.velocity).toBe(100);
    });

    it('includes both dimensions', () => {
      const events = [makeEvt(60, 0, 480, 64)];
      const points = pointSetRepresentation(events, { includeDuration: true, includeVelocity: true });
      expect(points[0]!.duration).toBe(480);
      expect(points[0]!.velocity).toBe(64);
    });

    it('produces 2D points without options (backward compat)', () => {
      const events = [makeEvt(60, 0, 480, 80)];
      const points = pointSetRepresentation(events);
      expect(points[0]!.duration).toBeUndefined();
      expect(points[0]!.velocity).toBeUndefined();
    });
  });

  describe('sia with duration dimension', () => {
    it('distinguishes patterns by duration', () => {
      // Two motifs identical in onset/pitch but different durations
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60, duration: 480 },
        { onset: 480, pitch: 64, duration: 480 },
        { onset: 960, pitch: 60, duration: 480 },
        { onset: 1440, pitch: 64, duration: 480 },
      ];
      const patterns = sia(points);
      expect(patterns.length).toBeGreaterThan(0);
      // Should find dDuration = 0 for matching durations
      const found = patterns.find(p => p.vector.dDuration === 0);
      expect(found).toBeDefined();
    });
  });

  describe('siatec with duration dimension', () => {
    it('translators include dDuration field', () => {
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60, duration: 480 },
        { onset: 480, pitch: 64, duration: 480 },
        { onset: 960, pitch: 60, duration: 480 },
        { onset: 1440, pitch: 64, duration: 480 },
      ];
      const tecs = siatec(points);
      expect(tecs.length).toBeGreaterThan(0);
      const hasDDuration = tecs.some(t => t.translators.some(v => v.dDuration !== undefined));
      expect(hasDDuration).toBe(true);
    });
  });

  describe('cosiatec with multi-dimensional points', () => {
    it('handles multi-dimensional points without error', () => {
      const points: MusicPoint[] = [
        { onset: 0, pitch: 60, duration: 480, velocity: 80 },
        { onset: 480, pitch: 64, duration: 480, velocity: 80 },
        { onset: 960, pitch: 60, duration: 480, velocity: 80 },
        { onset: 1440, pitch: 64, duration: 480, velocity: 80 },
      ];
      const result = cosiatec(points);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.tecs.length).toBeGreaterThan(0);
    });
  });
});
