import { describe, it, expect } from 'vitest';
import { separateVoices, pitchFromMidi } from '../src/index.js';
import type { NoteEvent } from '../src/index.js';

function makeNote(midi: number, onset: number, duration: number, voice = 0): NoteEvent {
  return {
    id: `n_${onset}_${midi}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice,
  };
}

describe('Voice Separation', () => {
  // ---------- Edge cases ----------

  it('returns empty result for empty input', () => {
    const result = separateVoices([]);
    expect(result.voices).toHaveLength(0);
    expect(result.labeledEvents).toHaveLength(0);
  });

  it('assigns a single event to one voice', () => {
    const events = [makeNote(60, 0, 480)];
    const result = separateVoices(events);
    expect(result.voices).toHaveLength(1);
    expect(result.voices[0]!.events).toHaveLength(1);
    expect(result.labeledEvents[0]!.assignedVoice).toBe(0);
  });

  it('assigns sequential stepwise notes to one voice', () => {
    // C4 D4 E4 F4 — stepwise ascending, should stay in one voice
    const events = [
      makeNote(60, 0, 480),
      makeNote(62, 480, 480),
      makeNote(64, 960, 480),
      makeNote(65, 1440, 480),
    ];
    const result = separateVoices(events);
    expect(result.voices).toHaveLength(1);
    expect(result.voices[0]!.events).toHaveLength(4);
  });

  // ---------- Two non-overlapping voices correctly separated ----------

  it('separates two register-distinct melodies', () => {
    // High voice: C5 D5 E5 (midi 72, 74, 76) — alternating with
    // Low voice:  C3 D3 E3 (midi 48, 50, 52)
    const events = [
      makeNote(72, 0, 480),
      makeNote(48, 0, 480),
      makeNote(74, 480, 480),
      makeNote(50, 480, 480),
      makeNote(76, 960, 480),
      makeNote(52, 960, 480),
    ];
    const result = separateVoices(events);
    expect(result.voices.length).toBeGreaterThanOrEqual(2);

    // Verify events are grouped by register
    const voiceAvgPitch = result.voices.map((v) => {
      const sum = v.events.reduce((s, e) => s + e.pitch.midi, 0);
      return sum / v.events.length;
    });
    // The two voices should have distinct average pitches
    const sortedAvg = [...voiceAvgPitch].sort((a, b) => a - b);
    expect(sortedAvg[sortedAvg.length - 1]! - sortedAvg[0]!).toBeGreaterThan(10);
  });

  it('separates soprano and bass in a chorale-like texture', () => {
    // Soprano: E5(76), F5(77), G5(79)
    // Bass: C3(48), B2(47), A2(45)
    const events = [
      makeNote(76, 0, 480),
      makeNote(48, 0, 480),
      makeNote(77, 480, 480),
      makeNote(47, 480, 480),
      makeNote(79, 960, 480),
      makeNote(45, 960, 480),
    ];
    const result = separateVoices(events);
    expect(result.voices.length).toBeGreaterThanOrEqual(2);

    // All 6 events should be assigned
    expect(result.labeledEvents).toHaveLength(6);
  });

  // ---------- Voice crossing handled ----------

  it('handles voice crossing where voices swap registers', () => {
    // Voice A starts high, moves low; Voice B starts low, moves high
    // t=0: A=72, B=48  t=480: A=70, B=50  t=960: A=50, B=70
    const events = [
      makeNote(72, 0, 480),
      makeNote(48, 0, 480),
      makeNote(70, 480, 480),
      makeNote(50, 480, 480),
      makeNote(52, 960, 480),  // was high voice, now low
      makeNote(68, 960, 480),  // was low voice, now high
    ];
    const result = separateVoices(events);
    // Should produce voices that follow proximity
    expect(result.voices.length).toBeGreaterThanOrEqual(2);
    expect(result.labeledEvents).toHaveLength(6);
  });

  // ---------- Chordal texture: simultaneous notes → different voices ----------

  it('assigns simultaneous notes to different voices', () => {
    // C major chord: C4, E4, G4 all at onset 0
    const events = [
      makeNote(60, 0, 480),
      makeNote(64, 0, 480),
      makeNote(67, 0, 480),
    ];
    const result = separateVoices(events);
    // With default maxVoices=4 and distant pitches, should get multiple voices
    expect(result.voices.length).toBeGreaterThanOrEqual(2);
  });

  it('assigns four-part chord to four voices', () => {
    // SATB chord: S=79, A=72, T=67, B=60
    const events = [
      makeNote(60, 0, 480),
      makeNote(67, 0, 480),
      makeNote(72, 0, 480),
      makeNote(79, 0, 480),
    ];
    const result = separateVoices(events, { maxVoices: 4 });
    expect(result.voices.length).toBeGreaterThanOrEqual(3);
  });

  // ---------- Options ----------

  it('respects maxVoices=1 by putting everything in one voice', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(72, 0, 480),
      makeNote(84, 0, 480),
    ];
    const result = separateVoices(events, { maxVoices: 1 });
    expect(result.voices).toHaveLength(1);
    expect(result.voices[0]!.events).toHaveLength(3);
  });

  it('respects maxVoices=2 limit', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(72, 0, 480),
      makeNote(84, 0, 480),
      makeNote(48, 0, 480),
    ];
    const result = separateVoices(events, { maxVoices: 2 });
    expect(result.voices.length).toBeLessThanOrEqual(2);
  });

  it('throws RangeError for maxVoices < 1', () => {
    expect(() => separateVoices([], { maxVoices: 0 })).toThrow(RangeError);
  });

  it('throws RangeError for gapThreshold <= 0', () => {
    expect(() => separateVoices([makeNote(60, 0, 480)], { gapThreshold: 0 })).toThrow(RangeError);
  });

  // ---------- Result structure ----------

  it('returns frozen result', () => {
    const events = [makeNote(60, 0, 480), makeNote(72, 480, 480)];
    const result = separateVoices(events);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.voices)).toBe(true);
    expect(Object.isFrozen(result.labeledEvents)).toBe(true);
  });

  it('labeled events total equals input count', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(72, 0, 480),
      makeNote(62, 480, 480),
      makeNote(74, 480, 480),
    ];
    const result = separateVoices(events);
    expect(result.labeledEvents).toHaveLength(4);
    // Sum of all voice events should also equal 4
    const total = result.voices.reduce((s, v) => s + v.events.length, 0);
    expect(total).toBe(4);
  });

  it('voiceIndex matches position in voices array', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(84, 0, 480),
    ];
    const result = separateVoices(events);
    for (let i = 0; i < result.voices.length; i++) {
      expect(result.voices[i]!.voiceIndex).toBe(i);
    }
  });

  // ---------- Temporal gap handling ----------

  it('reuses voices after a long gap', () => {
    // Two events far apart in time with close pitch — second should reuse voice 0
    const events = [
      makeNote(60, 0, 480),
      makeNote(62, 5000, 480), // 5000 ticks later, well past default gap threshold
    ];
    const result = separateVoices(events);
    // Voice is free (not busy), and cost should be low for close pitch
    // so it should reuse the same voice rather than creating a new one
    expect(result.labeledEvents[1]!.assignedVoice).toBe(0);
  });

  it('creates new voice for closely-spaced distant pitch', () => {
    // Simultaneous events with large pitch gap
    const events = [
      makeNote(36, 0, 480), // C2
      makeNote(96, 0, 480), // C7
    ];
    const result = separateVoices(events);
    expect(result.voices.length).toBeGreaterThanOrEqual(2);
  });

  // ---------- Pitch-based continuity ----------

  it('keeps a descending scale in one voice', () => {
    const events = [
      makeNote(72, 0, 480),
      makeNote(71, 480, 480),
      makeNote(69, 960, 480),
      makeNote(67, 1440, 480),
      makeNote(65, 1920, 480),
    ];
    const result = separateVoices(events);
    expect(result.voices).toHaveLength(1);
  });

  it('separates interleaved ascending and descending lines', () => {
    // Ascending: 60, 62, 64 and Descending: 84, 82, 80
    const events = [
      makeNote(60, 0, 480),
      makeNote(84, 0, 480),
      makeNote(62, 480, 480),
      makeNote(82, 480, 480),
      makeNote(64, 960, 480),
      makeNote(80, 960, 480),
    ];
    const result = separateVoices(events);
    expect(result.voices.length).toBeGreaterThanOrEqual(2);
  });

  // ---------- Custom weights ----------

  it('uses custom pitchWeight', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(72, 480, 480),
    ];
    // With very low pitch weight, even distant pitch should stay in one voice
    const result = separateVoices(events, { pitchWeight: 0.01 });
    expect(result.voices).toHaveLength(1);
  });

  it('uses custom gapThreshold', () => {
    const events = [
      makeNote(60, 0, 480),
      makeNote(62, 600, 480), // gap of 120 ticks
    ];
    // With a very small gap threshold, temporal cost is high
    const resultSmallGap = separateVoices(events, { gapThreshold: 100 });
    // With a large gap threshold, temporal cost is low
    const resultLargeGap = separateVoices(events, { gapThreshold: 10000 });
    // Both should work; large gap should favor single voice
    expect(resultLargeGap.voices).toHaveLength(1);
    expect(resultSmallGap.labeledEvents).toHaveLength(2);
  });

  // ---------- Complex scenario ----------

  it('handles a SATB chorale progression', () => {
    // Beat 1: S=72, A=67, T=64, B=60
    // Beat 2: S=74, A=69, T=65, B=57
    // Beat 3: S=76, A=72, T=67, B=55
    const events = [
      makeNote(72, 0, 480), makeNote(67, 0, 480), makeNote(64, 0, 480), makeNote(60, 0, 480),
      makeNote(74, 480, 480), makeNote(69, 480, 480), makeNote(65, 480, 480), makeNote(57, 480, 480),
      makeNote(76, 960, 480), makeNote(72, 960, 480), makeNote(67, 960, 480), makeNote(55, 960, 480),
    ];
    const result = separateVoices(events, { maxVoices: 4 });
    expect(result.voices.length).toBeGreaterThanOrEqual(3);
    expect(result.labeledEvents).toHaveLength(12);
  });
});
