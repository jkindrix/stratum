import { describe, it, expect } from 'vitest';
import {
  buildMetricLevels,
  beatStrength,
  maxBeatStrength,
  syncopation,
  metricPosition,
  findPatterns,
  quantize,
  swing,
  durationName,
  durationTicks,
  pitchFromMidi,
} from '../src/index.js';
import type { NoteEvent } from '../src/index.js';

const TPQ = 480; // ticks per quarter

function makeNote(midi: number, onset: number, duration: number): NoteEvent {
  return {
    id: `n_${onset}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice: 0,
  };
}

describe('Metric Hierarchy', () => {
  it('builds levels for 4/4', () => {
    const levels = buildMetricLevels(
      { numerator: 4, denominator: 4, atTick: 0 },
      TPQ,
    );

    expect(levels).toHaveLength(4);
    expect(levels[0]!.name).toBe('subdivision');
    expect(levels[0]!.periodTicks).toBe(240); // eighth note
    expect(levels[1]!.name).toBe('beat');
    expect(levels[1]!.periodTicks).toBe(480); // quarter note
    expect(levels[2]!.name).toBe('bar');
    expect(levels[2]!.periodTicks).toBe(1920); // whole bar
    expect(levels[3]!.name).toBe('hypermeter');
    expect(levels[3]!.periodTicks).toBe(7680); // 4 bars
  });

  it('builds levels for 3/4', () => {
    const levels = buildMetricLevels(
      { numerator: 3, denominator: 4, atTick: 0 },
      TPQ,
    );

    expect(levels[2]!.periodTicks).toBe(1440); // 3 quarter notes
  });

  it('builds levels for 6/8 (compound meter)', () => {
    const levels = buildMetricLevels(
      { numerator: 6, denominator: 8, atTick: 0 },
      TPQ,
    );

    // In compound 6/8: subdivision = eighth note, beat = dotted quarter (3 eighths)
    expect(levels[0]!.periodTicks).toBe(240); // eighth note subdivision
    expect(levels[1]!.periodTicks).toBe(720); // dotted quarter beat (3 × 240)
    expect(levels[2]!.periodTicks).toBe(1440); // bar (6 eighth notes)
  });

  it('builds levels for 5/4', () => {
    const levels = buildMetricLevels(
      { numerator: 5, denominator: 4, atTick: 0 },
      TPQ,
    );

    expect(levels[1]!.periodTicks).toBe(480); // quarter note beat
    expect(levels[2]!.periodTicks).toBe(2400); // bar (5 quarter notes)
  });

  it('builds levels for 7/8', () => {
    const levels = buildMetricLevels(
      { numerator: 7, denominator: 8, atTick: 0 },
      TPQ,
    );

    expect(levels[0]!.periodTicks).toBe(120); // sixteenth note subdivision
    expect(levels[2]!.periodTicks).toBe(1680); // bar (7 eighth notes)
  });
});

describe('Beat Strength', () => {
  it('downbeat of bar is strongest', () => {
    const levels = buildMetricLevels(
      { numerator: 4, denominator: 4, atTick: 0 },
      TPQ,
    );

    const downbeat = beatStrength(0, levels);
    const beat2 = beatStrength(480, levels);
    const offbeat = beatStrength(240, levels);

    expect(downbeat).toBeGreaterThan(beat2);
    expect(beat2).toBeGreaterThan(offbeat);
  });

  it('beat 1 aligns with all levels at tick 0', () => {
    const levels = buildMetricLevels(
      { numerator: 4, denominator: 4, atTick: 0 },
      TPQ,
    );

    const strength = beatStrength(0, levels);
    const max = maxBeatStrength(levels);
    expect(strength).toBe(max);
  });
});

describe('Syncopation', () => {
  it('is zero for loud event on downbeat', () => {
    const levels = buildMetricLevels(
      { numerator: 4, denominator: 4, atTick: 0 },
      TPQ,
    );

    const sync = syncopation(0, 127, levels);
    expect(sync).toBeCloseTo(0, 1);
  });

  it('is high for loud event on weak beat', () => {
    const levels = buildMetricLevels(
      { numerator: 4, denominator: 4, atTick: 0 },
      TPQ,
    );

    // 16th-note position (not on any beat)
    const sync = syncopation(120, 127, levels);
    expect(sync).toBeGreaterThan(0.5);
  });
});

describe('Pattern Detection', () => {
  it('finds a repeated 3-note pattern', () => {
    // C-E-G repeated twice
    const events = [
      makeNote(60, 0, 480),
      makeNote(64, 480, 480),
      makeNote(67, 960, 480),
      makeNote(60, 1440, 480),
      makeNote(64, 1920, 480),
      makeNote(67, 2400, 480),
    ];

    const patterns = findPatterns(events, 3, 3);
    expect(patterns.length).toBeGreaterThanOrEqual(1);

    const match = patterns.find(p => p.intervals.join(',') === '4,3');
    expect(match).toBeDefined();
    expect(match!.occurrences).toHaveLength(2);
  });

  it('returns empty for non-repeating sequence', () => {
    const events2 = [
      makeNote(60, 0, 480),
      makeNote(62, 480, 480),
      makeNote(65, 960, 480),
      makeNote(72, 1440, 480),
      makeNote(73, 1920, 480),
      makeNote(74, 2400, 480),
    ];
    const patterns2 = findPatterns(events2, 3, 3);
    const match = patterns2.find(p => p.intervals.join(',') === '2,3');
    // [2,3] only occurs once, [7,1] and [1,1] are different
    expect(match).toBeUndefined();
  });

  it('returns empty when events < minLength * 2', () => {
    const events = [makeNote(60, 0, 480), makeNote(64, 480, 480)];
    expect(findPatterns(events, 3, 3)).toEqual([]);
  });
});

describe('Quantize', () => {
  it('snaps onsets to grid', () => {
    const events: NoteEvent[] = [
      makeNote(60, 5, 480),
      makeNote(64, 495, 480),
    ];
    const q = quantize(events, 480);
    expect(q[0]!.onset).toBe(0);
    expect(q[1]!.onset).toBe(480);
  });
});

describe('Swing', () => {
  it('applies swing ratio', () => {
    const events: NoteEvent[] = [
      makeNote(60, 0, 240),
      makeNote(64, 240, 240),
      makeNote(67, 480, 240),
      makeNote(72, 720, 240),
    ];
    const swung = swing(events, 0.67, 240);
    // First in each pair stays, second shifts forward
    expect(swung[0]!.onset).toBe(0);
    expect(swung[1]!.onset).toBeGreaterThan(240);
    expect(swung[2]!.onset).toBe(480);
  });
});

describe('Duration Names', () => {
  it('names standard durations', () => {
    expect(durationName(1920)).toBe('whole');
    expect(durationName(960)).toBe('half');
    expect(durationName(480)).toBe('quarter');
    expect(durationName(240)).toBe('eighth');
    expect(durationName(120)).toBe('sixteenth');
  });

  it('converts name to ticks', () => {
    expect(durationTicks('quarter')).toBe(480);
    expect(durationTicks('eighth')).toBe(240);
    expect(durationTicks('whole')).toBe(1920);
  });

  it('round-trips name ↔ ticks', () => {
    for (const name of ['whole', 'half', 'quarter', 'eighth', 'sixteenth']) {
      const ticks = durationTicks(name);
      expect(durationName(ticks)).toBe(name);
    }
  });
});

describe('Metric Position', () => {
  it('returns level names at tick 0', () => {
    const levels = buildMetricLevels(
      { numerator: 4, denominator: 4, atTick: 0 },
      TPQ,
    );
    const pos = metricPosition(0, levels);
    expect(pos).toContain('bar');
    expect(pos).toContain('beat');
  });
});
