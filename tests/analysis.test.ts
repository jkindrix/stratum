import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  pitchFromMidi,
  identifyChord,
  identifyScale,
  harmonicRhythm,
  romanNumeralAnalysis,
  contour,
  range,
  meanPitch,
  intervalHistogram,
  stepLeapRatio,
  segmentByRests,
  eventDensityCurve,
  registralEnvelope,
  chromaticFeature,
  selfSimilarityMatrix,
  noveltyDetection,
  noveltyPeaks,
} from '../src/index.js';
import type { NoteEvent } from '../src/index.js';

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

describe('Chord Identification', () => {
  it('identifies C major triad from {60, 64, 67}', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 0, 480), makeNote(67, 0, 480)];
    const result = identifyChord(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('major');
  });

  it('identifies C minor triad from {60, 63, 67}', () => {
    const events = [makeNote(60, 0, 480), makeNote(63, 0, 480), makeNote(67, 0, 480)];
    const result = identifyChord(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('minor');
  });

  it('identifies diminished triad from {60, 63, 66}', () => {
    const events = [makeNote(60, 0, 480), makeNote(63, 0, 480), makeNote(66, 0, 480)];
    const result = identifyChord(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('diminished');
  });

  it('identifies augmented triad from {60, 64, 68}', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 0, 480), makeNote(68, 0, 480)];
    const result = identifyChord(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('augmented');
  });

  it('identifies dominant 7th from {60, 64, 67, 70}', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 0, 480), makeNote(67, 0, 480), makeNote(70, 0, 480)];
    const result = identifyChord(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('dominant 7th');
  });

  it('identifies major 7th from {60, 64, 67, 71}', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 0, 480), makeNote(67, 0, 480), makeNote(71, 0, 480)];
    const result = identifyChord(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('major 7th');
  });

  it('returns null for single note', () => {
    const events = [makeNote(60, 0, 480)];
    expect(identifyChord(events)).toBeNull();
  });
});

describe('Scale Identification', () => {
  it('identifies C major scale', () => {
    // C D E F G A B — all 7 notes of C major
    const events = [
      makeNote(60, 0, 480), makeNote(62, 480, 480), makeNote(64, 960, 480),
      makeNote(65, 1440, 480), makeNote(67, 1920, 480), makeNote(69, 2400, 480),
      makeNote(71, 2880, 480),
    ];
    const result = identifyScale(events);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Ionian');
  });

  it('returns null for fewer than 3 notes', () => {
    const events = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
    expect(identifyScale(events)).toBeNull();
  });
});

describe('Harmonic Rhythm', () => {
  it('detects chord changes over a score', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    // C major chord for 2 beats
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 0, duration: 960 });
    addNote(score, p, { midi: 67, onset: 0, duration: 960 });

    const rhythm = harmonicRhythm(score, 480);
    expect(rhythm.length).toBeGreaterThan(0);
    expect(rhythm[0]!.label).not.toBeNull();
  });
});

describe('Roman Numeral Analysis', () => {
  it('labels I chord in C major', () => {
    const chords = [{ name: 'Major', symbol: 'maj', root: 0, pcs: [0, 4, 7] }];
    const result = romanNumeralAnalysis(chords, { tonic: 0, mode: 'major' });
    expect(result[0]!.numeral).toBe('I');
  });

  it('labels V chord in C major', () => {
    const chords = [{ name: 'Major', symbol: 'maj', root: 7, pcs: [7, 11, 2] }];
    const result = romanNumeralAnalysis(chords, { tonic: 0, mode: 'major' });
    expect(result[0]!.numeral).toBe('V');
  });
});

describe('Melodic Analysis', () => {
  it('computes ascending contour', () => {
    const events = [makeNote(60, 0, 480), makeNote(62, 480, 480), makeNote(64, 960, 480)];
    expect(contour(events)).toEqual(['up', 'up']);
  });

  it('computes descending contour', () => {
    const events = [makeNote(67, 0, 480), makeNote(64, 480, 480), makeNote(60, 960, 480)];
    expect(contour(events)).toEqual(['down', 'down']);
  });

  it('computes arch contour', () => {
    const events = [makeNote(60, 0, 480), makeNote(67, 480, 480), makeNote(60, 960, 480)];
    expect(contour(events)).toEqual(['up', 'down']);
  });

  it('computes correct range', () => {
    const events = [makeNote(48, 0, 480), makeNote(72, 480, 480), makeNote(60, 960, 480)];
    const r = range(events);
    expect(r.lowest).toBe(48);
    expect(r.highest).toBe(72);
    expect(r.semitones).toBe(24);
  });

  it('computes mean pitch', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 480, 480), makeNote(67, 960, 480)];
    expect(meanPitch(events)).toBeCloseTo(63.67, 1);
  });

  it('computes interval histogram', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 480, 480), makeNote(67, 960, 480)];
    const hist = intervalHistogram(events);
    expect(hist.get(4)).toBe(1); // +4 (C to E)
    expect(hist.get(3)).toBe(1); // +3 (E to G)
  });

  it('computes step-leap ratio', () => {
    // All steps: C D E (steps of 2)
    const stepwise = [makeNote(60, 0, 480), makeNote(62, 480, 480), makeNote(64, 960, 480)];
    expect(stepLeapRatio(stepwise)).toBe(1.0);

    // All leaps: C G C' (leaps of 7 and 5)
    const leaps = [makeNote(60, 0, 480), makeNote(67, 480, 480), makeNote(72, 960, 480)];
    expect(stepLeapRatio(leaps)).toBe(0);
  });
});

describe('Structural Analysis', () => {
  it('segments by rests', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(64, 480, 480),
      // gap of 960 ticks
      makeNote(67, 1920, 480),
      makeNote(72, 2400, 480),
    ];
    const segments = segmentByRests(events, 480);
    expect(segments.length).toBe(2);
    expect(segments[0]!.length).toBe(2);
    expect(segments[1]!.length).toBe(2);
  });

  it('no segmentation when events are contiguous', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(64, 480, 480),
      makeNote(67, 960, 480),
    ];
    const segments = segmentByRests(events, 480);
    expect(segments.length).toBe(1);
  });

  it('computes event density curve', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 960 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });

    const curve = eventDensityCurve(score, 480);
    expect(curve.length).toBeGreaterThan(0);
    expect(curve[0]!.value).toBeGreaterThanOrEqual(0);
  });

  it('computes registral envelope', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 48, onset: 0, duration: 960 });
    addNote(score, p, { midi: 72, onset: 0, duration: 960 });

    const env = registralEnvelope(score, 480);
    expect(env.length).toBeGreaterThan(0);
    expect(env[0]!.low).toBe(48);
    expect(env[0]!.high).toBe(72);
  });
});

describe('Self-Similarity Matrix & Novelty Detection', () => {
  it('chromaticFeature returns 12-element normalized vector', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 0, 480), makeNote(67, 0, 480)];
    const feature = chromaticFeature(events);
    expect(feature).toHaveLength(12);
    // Should be normalized
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += feature[i]!;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('chromaticFeature returns zeros for empty events', () => {
    const feature = chromaticFeature([]);
    expect(feature).toHaveLength(12);
    expect(feature.every(v => v === 0)).toBe(true);
  });

  it('selfSimilarityMatrix builds a square matrix', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    // 4 quarter notes
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });
    addNote(score, p, { midi: 67, onset: 960, duration: 480 });
    addNote(score, p, { midi: 60, onset: 1440, duration: 480 });

    const ssm = selfSimilarityMatrix(score, 480, 480);
    expect(ssm.size).toBeGreaterThan(0);
    expect(ssm.data).toHaveLength(ssm.size);
    for (const row of ssm.data) {
      expect(row).toHaveLength(ssm.size);
    }
  });

  it('diagonal of SSM is all 1s (self-similarity)', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });
    addNote(score, p, { midi: 67, onset: 960, duration: 480 });

    const ssm = selfSimilarityMatrix(score, 480, 480);
    for (let i = 0; i < ssm.size; i++) {
      expect(ssm.data[i]![i]).toBeCloseTo(1.0, 5);
    }
  });

  it('SSM values are between 0 and 1', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 72, onset: 480, duration: 480 });

    const ssm = selfSimilarityMatrix(score, 480, 480);
    for (const row of ssm.data) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('SSM is frozen', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });

    const ssm = selfSimilarityMatrix(score, 480, 480);
    expect(Object.isFrozen(ssm)).toBe(true);
    expect(Object.isFrozen(ssm.data)).toBe(true);
  });

  it('throws RangeError for invalid windowSize/hopSize', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });

    expect(() => selfSimilarityMatrix(score, 0, 480)).toThrow(RangeError);
    expect(() => selfSimilarityMatrix(score, 480, -1)).toThrow(RangeError);
  });

  it('returns empty SSM for empty score', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    addPart(score, { name: 'Piano' });
    const ssm = selfSimilarityMatrix(score, 480, 480);
    expect(ssm.size).toBe(0);
    expect(ssm.data).toHaveLength(0);
  });

  it('noveltyDetection produces a curve from SSM', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    // Section A: C major chords
    for (let i = 0; i < 4; i++) {
      addNote(score, p, { midi: 60, onset: i * 480, duration: 480 });
      addNote(score, p, { midi: 64, onset: i * 480, duration: 480 });
      addNote(score, p, { midi: 67, onset: i * 480, duration: 480 });
    }
    // Section B: different chords
    for (let i = 4; i < 8; i++) {
      addNote(score, p, { midi: 65, onset: i * 480, duration: 480 });
      addNote(score, p, { midi: 69, onset: i * 480, duration: 480 });
      addNote(score, p, { midi: 72, onset: i * 480, duration: 480 });
    }

    const ssm = selfSimilarityMatrix(score, 480, 480);
    const novelty = noveltyDetection(ssm, 2);
    expect(novelty.length).toBe(ssm.size);
    expect(novelty[0]!.tick).toBe(0);
  });

  it('noveltyDetection returns frozen array', () => {
    const score = createScore({ ticksPerQuarter: 480 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480 });
    addNote(score, p, { midi: 64, onset: 480, duration: 480 });

    const ssm = selfSimilarityMatrix(score, 480, 480);
    const novelty = noveltyDetection(ssm);
    expect(Object.isFrozen(novelty)).toBe(true);
  });

  it('noveltyPeaks finds local maxima above threshold', () => {
    // Create synthetic novelty curve
    const curve = [
      { tick: 0, value: 0.1 },
      { tick: 480, value: 0.5 },
      { tick: 960, value: 0.2 },
      { tick: 1440, value: 0.9 },
      { tick: 1920, value: 0.3 },
    ].map(p => Object.freeze(p));

    const peaks = noveltyPeaks(curve, 0.3);
    // Should find peaks at tick 480 (0.5 > 0.1 and > 0.2) and tick 1440 (0.9 > 0.2 and > 0.3)
    expect(peaks.length).toBe(2);
    expect(peaks[0]!.tick).toBe(480);
    expect(peaks[1]!.tick).toBe(1440);
  });

  it('noveltyPeaks returns frozen array', () => {
    const curve = [
      Object.freeze({ tick: 0, value: 0.1 }),
      Object.freeze({ tick: 480, value: 0.5 }),
      Object.freeze({ tick: 960, value: 0.2 }),
    ];
    const peaks = noveltyPeaks(curve, 0.3);
    expect(Object.isFrozen(peaks)).toBe(true);
  });

  it('noveltyPeaks returns empty for empty input', () => {
    expect(noveltyPeaks([])).toHaveLength(0);
  });
});
