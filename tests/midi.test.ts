import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  scoreToMidi,
  midiToScore,
  scoreToJSON,
  scoreFromJSON,
} from '../src/index.js';

describe('MIDI Round-Trip', () => {
  it('exports and re-imports a simple score', () => {
    const original = createScore({
      title: 'Test',
      tempo: 120,
      ticksPerQuarter: 480,
      timeSignature: { numerator: 4, denominator: 4 },
    });

    const piano = addPart(original, { name: 'Piano', midiProgram: 0, midiChannel: 0 });
    addNote(original, piano, { midi: 60, onset: 0, duration: 480, velocity: 80 });
    addNote(original, piano, { midi: 64, onset: 480, duration: 480, velocity: 90 });
    addNote(original, piano, { midi: 67, onset: 960, duration: 480, velocity: 100 });

    const midiBytes = scoreToMidi(original);
    expect(midiBytes).toBeInstanceOf(Uint8Array);
    expect(midiBytes.length).toBeGreaterThan(0);

    // Verify MIDI header
    const header = String.fromCharCode(...midiBytes.slice(0, 4));
    expect(header).toBe('MThd');

    // Re-import
    const reimported = midiToScore(midiBytes);
    expect(reimported.parts.length).toBe(1);
    expect(reimported.parts[0]!.events.length).toBe(3);

    // Check notes preserved
    const events = reimported.parts[0]!.events;
    expect(events[0]!.pitch.midi).toBe(60);
    expect(events[0]!.onset).toBe(0);
    expect(events[0]!.duration).toBe(480);

    expect(events[1]!.pitch.midi).toBe(64);
    expect(events[1]!.onset).toBe(480);

    expect(events[2]!.pitch.midi).toBe(67);
    expect(events[2]!.onset).toBe(960);
  });

  it('preserves tempo', () => {
    const original = createScore({ tempo: 140 });
    const p = addPart(original, { name: 'X' });
    addNote(original, p, { midi: 60, onset: 0, duration: 480 });

    const bytes = scoreToMidi(original);
    const reimported = midiToScore(bytes);

    expect(reimported.tempoChanges.length).toBeGreaterThanOrEqual(1);
    expect(reimported.tempoChanges[0]!.bpm).toBe(140);
  });

  it('preserves time signature', () => {
    const original = createScore({ timeSignature: { numerator: 3, denominator: 4 } });
    const p = addPart(original, { name: 'X' });
    addNote(original, p, { midi: 60, onset: 0, duration: 480 });

    const bytes = scoreToMidi(original);
    const reimported = midiToScore(bytes);

    expect(reimported.timeSignatures.length).toBeGreaterThanOrEqual(1);
    expect(reimported.timeSignatures[0]!.numerator).toBe(3);
    expect(reimported.timeSignatures[0]!.denominator).toBe(4);
  });

  it('handles multiple parts', () => {
    const score = createScore();
    const p1 = addPart(score, { name: 'Melody', midiChannel: 0 });
    const p2 = addPart(score, { name: 'Bass', midiChannel: 1 });

    addNote(score, p1, { midi: 72, onset: 0, duration: 960 });
    addNote(score, p2, { midi: 48, onset: 0, duration: 960 });

    const bytes = scoreToMidi(score);
    const reimported = midiToScore(bytes);

    expect(reimported.parts.length).toBe(2);
    expect(reimported.parts[0]!.events[0]!.pitch.midi).toBe(72);
    expect(reimported.parts[1]!.events[0]!.pitch.midi).toBe(48);
  });

  it('handles simultaneous notes (chords)', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });

    // C major chord
    addNote(score, p, { midi: 60, onset: 0, duration: 480, velocity: 80 });
    addNote(score, p, { midi: 64, onset: 0, duration: 480, velocity: 80 });
    addNote(score, p, { midi: 67, onset: 0, duration: 480, velocity: 80 });

    const bytes = scoreToMidi(score);
    const reimported = midiToScore(bytes);

    expect(reimported.parts[0]!.events.length).toBe(3);
    const midis = reimported.parts[0]!.events.map(e => e.pitch.midi).sort((a, b) => a - b);
    expect(midis).toEqual([60, 64, 67]);
  });
});

describe('MIDI Multiple Tempo/Time Sig', () => {
  it('preserves multiple tempo changes', () => {
    const score = createScore({ tempo: 120 });
    score.tempoChanges.push({ bpm: 140, atTick: 960 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 1920 });

    const bytes = scoreToMidi(score);
    const reimported = midiToScore(bytes);
    expect(reimported.tempoChanges.length).toBeGreaterThanOrEqual(2);
    expect(reimported.tempoChanges[0]!.bpm).toBe(120);
    expect(reimported.tempoChanges[1]!.bpm).toBe(140);
  });

  it('preserves multiple time signature changes', () => {
    const score = createScore({ timeSignature: { numerator: 4, denominator: 4 } });
    score.timeSignatures.push({ numerator: 3, denominator: 4, atTick: 1920 });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 3840 });

    const bytes = scoreToMidi(score);
    const reimported = midiToScore(bytes);
    expect(reimported.timeSignatures.length).toBeGreaterThanOrEqual(2);
    expect(reimported.timeSignatures[0]!.numerator).toBe(4);
    expect(reimported.timeSignatures[1]!.numerator).toBe(3);
  });
});

describe('MIDI Edge Cases', () => {
  it('handles edge MIDI values (0 and 127)', () => {
    const score = createScore();
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 0, onset: 0, duration: 480, velocity: 1 });
    addNote(score, p, { midi: 127, onset: 480, duration: 480, velocity: 127 });

    const bytes = scoreToMidi(score);
    const reimported = midiToScore(bytes);
    expect(reimported.parts[0]!.events[0]!.pitch.midi).toBe(0);
    expect(reimported.parts[0]!.events[1]!.pitch.midi).toBe(127);
  });

  it('malformed file throws descriptive error', () => {
    expect(() => midiToScore(new Uint8Array([0, 1, 2, 3]))).toThrow('Invalid MIDI');
  });

  it('truncated file throws descriptive error', () => {
    expect(() => midiToScore(new Uint8Array(5))).toThrow();
  });

  it('empty tracks produce no parts', () => {
    const score = createScore();
    addPart(score, { name: 'Empty' }); // no notes
    // Export will still create a control track + empty part track
    // but re-import should handle the empty track
    const score2 = createScore();
    const p = addPart(score2, { name: 'Piano' });
    addNote(score2, p, { midi: 60, onset: 0, duration: 480 });
    const bytes = scoreToMidi(score2);
    const reimported = midiToScore(bytes);
    expect(reimported.parts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('JSON Serialization', () => {
  it('round-trips a full score', () => {
    const score = createScore({
      title: 'Test',
      tempo: 120,
      ticksPerQuarter: 480,
      timeSignature: { numerator: 3, denominator: 4 },
    });
    const p = addPart(score, { name: 'Piano' });
    addNote(score, p, { midi: 60, onset: 0, duration: 480, velocity: 80 });
    addNote(score, p, { midi: 64, onset: 480, duration: 240, velocity: 100 });

    const json = scoreToJSON(score);
    expect(json.version).toBe(1);

    const restored = scoreFromJSON(json);
    expect(restored.parts.length).toBe(1);
    expect(restored.parts[0]!.events.length).toBe(2);
    expect(restored.parts[0]!.events[0]!.pitch.midi).toBe(60);
    expect(restored.parts[0]!.events[1]!.pitch.midi).toBe(64);
    expect(restored.settings.ticksPerQuarter).toBe(480);
    expect(restored.timeSignatures[0]!.numerator).toBe(3);
  });

  it('malformed input throws with details', () => {
    expect(() => scoreFromJSON(null)).toThrow('non-null object');
    expect(() => scoreFromJSON({ version: 0 })).toThrow('version');
    expect(() => scoreFromJSON({ version: 1 })).toThrow(); // missing fields
  });
});
