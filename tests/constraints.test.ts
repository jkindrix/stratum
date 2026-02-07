import { describe, it, expect } from 'vitest';
import {
  checkParallelFifths,
  checkParallelOctaves,
  checkVoiceCrossing,
  isInRange,
  checkLeapResolution,
  pitchFromMidi,
} from '../src/index.js';
import type { NoteEvent } from '../src/index.js';

function makeNote(midi: number, onset: number, duration: number = 480): NoteEvent {
  return {
    id: `n_${onset}_${midi}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice: 0,
  };
}

describe('checkParallelFifths', () => {
  it('detects parallel fifths C-G → D-A', () => {
    // Voice 1: C4→D4, Voice 2: G4→A4 (both a fifth apart, parallel motion)
    const v1 = [makeNote(60, 0), makeNote(62, 480)];
    const v2 = [makeNote(67, 0), makeNote(69, 480)];
    const violations = checkParallelFifths(v1, v2);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.interval).toBe(7);
    expect(violations[0]!.tick).toBe(480);
  });

  it('does not flag non-parallel fifths', () => {
    // Voice 1: C4→D4, Voice 2: G4→B4 (fifth → sixth, not parallel)
    const v1 = [makeNote(60, 0), makeNote(62, 480)];
    const v2 = [makeNote(67, 0), makeNote(71, 480)];
    expect(checkParallelFifths(v1, v2)).toHaveLength(0);
  });

  it('does not flag oblique motion to fifths', () => {
    // Voice 1 stays, Voice 2 moves → oblique, not parallel
    const v1 = [makeNote(60, 0), makeNote(60, 480)];
    const v2 = [makeNote(67, 0), makeNote(67, 480)];
    expect(checkParallelFifths(v1, v2)).toHaveLength(0);
  });

  it('returns frozen array', () => {
    const v1 = [makeNote(60, 0), makeNote(62, 480)];
    const v2 = [makeNote(67, 0), makeNote(69, 480)];
    expect(Object.isFrozen(checkParallelFifths(v1, v2))).toBe(true);
  });

  it('returns empty for single-note voices', () => {
    expect(checkParallelFifths([makeNote(60, 0)], [makeNote(67, 0)])).toHaveLength(0);
  });
});

describe('checkParallelOctaves', () => {
  it('detects parallel octaves C4-C5 → D4-D5', () => {
    const v1 = [makeNote(60, 0), makeNote(62, 480)];
    const v2 = [makeNote(72, 0), makeNote(74, 480)];
    const violations = checkParallelOctaves(v1, v2);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.interval).toBe(0);
  });

  it('detects parallel unisons', () => {
    const v1 = [makeNote(60, 0), makeNote(62, 480)];
    const v2 = [makeNote(60, 0), makeNote(62, 480)];
    const violations = checkParallelOctaves(v1, v2);
    expect(violations).toHaveLength(1);
  });

  it('does not flag non-parallel octaves', () => {
    const v1 = [makeNote(60, 0), makeNote(62, 480)];
    const v2 = [makeNote(72, 0), makeNote(73, 480)];
    expect(checkParallelOctaves(v1, v2)).toHaveLength(0);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(checkParallelOctaves([], []))).toBe(true);
  });
});

describe('checkVoiceCrossing', () => {
  it('detects crossing when lower voice goes above upper', () => {
    const upper = [makeNote(60, 0)]; // C4
    const lower = [makeNote(72, 0)]; // C5 — higher than upper!
    const violations = checkVoiceCrossing([upper, lower]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.voiceA).toBe(0);
    expect(violations[0]!.voiceB).toBe(1);
  });

  it('returns empty when voices are properly ordered', () => {
    const upper = [makeNote(72, 0)]; // C5
    const lower = [makeNote(60, 0)]; // C4
    expect(checkVoiceCrossing([upper, lower])).toHaveLength(0);
  });

  it('returns empty for fewer than 2 voices', () => {
    expect(checkVoiceCrossing([])).toHaveLength(0);
    expect(checkVoiceCrossing([[makeNote(60, 0)]])).toHaveLength(0);
  });

  it('checks multiple voice pairs', () => {
    const soprano = [makeNote(72, 0)];
    const alto = [makeNote(67, 0)];
    const bass = [makeNote(79, 0)]; // MIDI 79 > alto's 67 → crossing
    const violations = checkVoiceCrossing([soprano, alto, bass]);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(checkVoiceCrossing([]))).toBe(true);
  });
});

describe('isInRange', () => {
  it('returns true when all notes in range', () => {
    const events = [makeNote(60, 0), makeNote(72, 480)];
    expect(isInRange(events, 48, 84)).toBe(true);
  });

  it('returns false when note below range', () => {
    const events = [makeNote(30, 0), makeNote(60, 480)];
    expect(isInRange(events, 48, 84)).toBe(false);
  });

  it('returns false when note above range', () => {
    const events = [makeNote(90, 0)];
    expect(isInRange(events, 48, 84)).toBe(false);
  });

  it('returns true for empty events', () => {
    expect(isInRange([], 0, 127)).toBe(true);
  });

  it('includes boundary values', () => {
    expect(isInRange([makeNote(48, 0), makeNote(84, 480)], 48, 84)).toBe(true);
  });

  it('throws on low > high', () => {
    expect(() => isInRange([], 100, 50)).toThrow(RangeError);
  });
});

describe('checkLeapResolution', () => {
  it('flags unresolved upward leap', () => {
    // C4 → A4 (leap of 9) → B4 (continues up, not resolved)
    const events = [makeNote(60, 0), makeNote(69, 480), makeNote(71, 960)];
    const violations = checkLeapResolution(events);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.leapSize).toBe(9);
  });

  it('does not flag resolved leap', () => {
    // C4 → A4 (leap of 9) → G4 (step down, resolved)
    const events = [makeNote(60, 0), makeNote(69, 480), makeNote(67, 960)];
    expect(checkLeapResolution(events)).toHaveLength(0);
  });

  it('does not flag small intervals', () => {
    // C4 → E4 (4 semitones, not a leap > P4)
    const events = [makeNote(60, 0), makeNote(64, 480), makeNote(72, 960)];
    expect(checkLeapResolution(events)).toHaveLength(0);
  });

  it('returns empty for fewer than 3 notes', () => {
    expect(checkLeapResolution([])).toHaveLength(0);
    expect(checkLeapResolution([makeNote(60, 0)])).toHaveLength(0);
    expect(checkLeapResolution([makeNote(60, 0), makeNote(72, 480)])).toHaveLength(0);
  });

  it('flags downward unresolved leap', () => {
    // A4 → C4 (leap of -9) → B3 (continues down, not resolved)
    const events = [makeNote(69, 0), makeNote(60, 480), makeNote(59, 960)];
    const violations = checkLeapResolution(events);
    expect(violations).toHaveLength(1);
  });

  it('returns frozen array', () => {
    expect(Object.isFrozen(checkLeapResolution([]))).toBe(true);
  });
});
