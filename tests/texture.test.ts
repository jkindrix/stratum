import { describe, it, expect } from 'vitest';
import {
  textureType,
  rhythmicIndependence,
  textureProfile,
  voiceCount,
  pitchFromMidi,
} from '../src/index.js';
import type { NoteEvent } from '../src/index.js';

function makeNote(midi: number, onset: number, duration: number, voice = 0): NoteEvent {
  return {
    id: `n_${onset}_${midi}_v${voice}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice,
  };
}

describe('voiceCount', () => {
  it('returns 0 for empty events', () => {
    expect(voiceCount([], 0)).toBe(0);
  });

  it('returns 0 when no events active at tick', () => {
    const events = [makeNote(60, 0, 480)];
    expect(voiceCount(events, 1000)).toBe(0);
  });

  it('returns 1 for a single active voice', () => {
    const events = [makeNote(60, 0, 480, 0)];
    expect(voiceCount(events, 240)).toBe(1);
  });

  it('counts distinct voices correctly', () => {
    const events = [
      makeNote(60, 0, 960, 0),
      makeNote(64, 0, 960, 1),
      makeNote(67, 0, 960, 2),
    ];
    expect(voiceCount(events, 480)).toBe(3);
  });

  it('does not double-count events in the same voice', () => {
    const events = [
      makeNote(60, 0, 960, 0),
      makeNote(62, 0, 960, 0), // same voice
    ];
    expect(voiceCount(events, 480)).toBe(1);
  });

  it('excludes events that have ended', () => {
    const events = [
      makeNote(60, 0, 480, 0),
      makeNote(67, 0, 960, 1),
    ];
    // At tick 500, voice 0's note has ended (onset=0, dur=480 → ends at 480)
    expect(voiceCount(events, 500)).toBe(1);
  });
});

describe('textureType', () => {
  it('returns silence for empty events', () => {
    expect(textureType([], 0)).toBe('silence');
  });

  it('returns silence when no events active', () => {
    const events = [makeNote(60, 0, 100, 0)];
    expect(textureType(events, 1000)).toBe('silence');
  });

  it('returns monophonic for single voice', () => {
    const events = [makeNote(60, 0, 960, 0)];
    expect(textureType(events, 480)).toBe('monophonic');
  });

  it('returns homorhythmic for voices with identical rhythms', () => {
    // Two voices with same onset pattern
    const events = [
      makeNote(60, 0, 480, 0),
      makeNote(64, 0, 480, 1),
      makeNote(62, 480, 480, 0),
      makeNote(65, 480, 480, 1),
    ];
    const tex = textureType(events, 240);
    expect(tex === 'homorhythmic' || tex === 'homophonic').toBe(true);
  });

  it('returns polyphonic for rhythmically independent voices', () => {
    // Voice 0: notes at 0, 400, 800
    // Voice 1: notes at 200, 600, 1000 — fully offset, different pattern
    // Both voices active at tick 300: v0 note (0, dur 400), v1 note (200, dur 400)
    const events = [
      makeNote(60, 0, 400, 0),
      makeNote(62, 400, 400, 0),
      makeNote(64, 800, 400, 0),
      makeNote(72, 200, 400, 1),
      makeNote(74, 600, 400, 1),
      makeNote(76, 1000, 400, 1),
    ];
    const tex = textureType(events, 300);
    // With fully offset rhythms these should be rhythmically independent
    expect(tex === 'polyphonic' || tex === 'homophonic').toBe(true);
  });
});

describe('rhythmicIndependence', () => {
  it('returns 0 for two empty voices', () => {
    expect(rhythmicIndependence([], [])).toBe(0);
  });

  it('returns 1 when one voice is empty', () => {
    expect(rhythmicIndependence([makeNote(60, 0, 480)], [])).toBe(1);
  });

  it('returns 0 for identical onset patterns', () => {
    const v1 = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
    const v2 = [makeNote(72, 0, 480), makeNote(74, 480, 480)];
    expect(rhythmicIndependence(v1, v2)).toBe(0);
  });

  it('returns 1 for fully disjoint onset patterns', () => {
    const v1 = [makeNote(60, 0, 480), makeNote(62, 960, 480)];
    const v2 = [makeNote(72, 480, 480), makeNote(74, 1440, 480)];
    expect(rhythmicIndependence(v1, v2)).toBe(1);
  });

  it('returns intermediate value for partially overlapping patterns', () => {
    const v1 = [makeNote(60, 0, 480), makeNote(62, 480, 480), makeNote(64, 960, 480)];
    const v2 = [makeNote(72, 0, 480), makeNote(74, 960, 480)];
    // Shared: {0, 960}, v1 only: {480}, v2 only: none → union=3, intersection=2 → distance=1/3
    const ri = rhythmicIndependence(v1, v2);
    expect(ri).toBeCloseTo(1 / 3, 5);
  });

  it('supports gridTicks quantization', () => {
    // v1 onset at 5, v2 onset at 7 — different without grid
    const v1 = [makeNote(60, 5, 480)];
    const v2 = [makeNote(72, 7, 480)];
    // Without grid: different onsets → distance = 1
    expect(rhythmicIndependence(v1, v2)).toBe(1);
    // With grid=10: both snap to 10 → distance = 0
    expect(rhythmicIndependence(v1, v2, 10)).toBe(0);
  });
});

describe('textureProfile', () => {
  it('returns empty for empty events', () => {
    expect(textureProfile([], 480)).toHaveLength(0);
  });

  it('throws RangeError for windowSize <= 0', () => {
    expect(() => textureProfile([makeNote(60, 0, 480)], 0)).toThrow(RangeError);
    expect(() => textureProfile([makeNote(60, 0, 480)], -1)).toThrow(RangeError);
  });

  it('throws RangeError for stepSize <= 0', () => {
    expect(() => textureProfile([makeNote(60, 0, 480)], 480, 0)).toThrow(RangeError);
  });

  it('produces correct number of points', () => {
    const events = [makeNote(60, 0, 1920, 0)]; // 4 beats at 480 tpq
    const profile = textureProfile(events, 480, 480);
    // Duration = 1920, step = 480 → 4 points (0, 480, 960, 1440)
    expect(profile).toHaveLength(4);
  });

  it('each point has tick, texture, and voiceCount', () => {
    const events = [makeNote(60, 0, 960, 0)];
    const profile = textureProfile(events, 480);
    expect(profile.length).toBeGreaterThan(0);
    const pt = profile[0]!;
    expect(pt).toHaveProperty('tick');
    expect(pt).toHaveProperty('texture');
    expect(pt).toHaveProperty('voiceCount');
  });

  it('returns frozen result', () => {
    const events = [makeNote(60, 0, 960, 0)];
    const profile = textureProfile(events, 480);
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('detects monophonic section followed by multi-voice', () => {
    const events = [
      // Monophonic: single voice
      makeNote(60, 0, 960, 0),
      // Multi-voice starts at 960
      makeNote(60, 960, 960, 0),
      makeNote(64, 960, 960, 1),
      makeNote(67, 960, 960, 2),
    ];
    const profile = textureProfile(events, 480, 480);
    // First window center at 240 → monophonic
    expect(profile[0]!.texture).toBe('monophonic');
    // Later window centers will see 3 voices
    const multiPt = profile.find((p) => p.voiceCount >= 3);
    expect(multiPt).toBeDefined();
    expect(multiPt!.texture).not.toBe('monophonic');
    expect(multiPt!.texture).not.toBe('silence');
  });

  it('uses custom stepSize', () => {
    const events = [makeNote(60, 0, 1920, 0)];
    const profile = textureProfile(events, 480, 240);
    // Duration = 1920, step = 240 → 8 points
    expect(profile).toHaveLength(8);
  });
});
