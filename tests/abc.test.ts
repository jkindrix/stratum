import { describe, it, expect } from 'vitest';
import { abcToScore } from '../src/io/abc.js';

describe('abcToScore', () => {
  it('parses a simple folk melody (Twinkle Twinkle)', () => {
    const abc = [
      'X:1',
      'T:Twinkle Twinkle',
      'M:4/4',
      'L:1/4',
      'K:C',
      'CCGG|AAG2|',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.parts.length).toBeGreaterThanOrEqual(1);

    const events = score.parts[0]!.events;
    expect(events.length).toBe(7); // C C G G A A G(half)
    expect(events[0]!.pitch.midi).toBe(60); // C4
  });

  it('parses header fields (T, M, L, K, Q)', () => {
    const abc = [
      'X:1',
      'T:Test Song',
      'M:3/4',
      'L:1/8',
      'Q:1/4=140',
      'K:G',
      'GAB|',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.metadata.title).toBe('Test Song');
    expect(score.timeSignatures[0]!.numerator).toBe(3);
    expect(score.timeSignatures[0]!.denominator).toBe(4);
    expect(score.tempoChanges[0]!.bpm).toBe(140);
    expect(score.keyCenters[0]!.tonic).toBe(7); // G
  });

  it('handles octave modifiers (\' and ,)', () => {
    const abc = [
      'X:1',
      'K:C',
      "c c' c,, C C,",
    ].join('\n');

    const { score } = abcToScore(abc);
    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis[0]).toBe(72); // c = C5
    expect(midis[1]).toBe(84); // c' = C6
    expect(midis[2]).toBe(48); // c,, = C3
    expect(midis[3]).toBe(60); // C = C4
    expect(midis[4]).toBe(48); // C, = C3
  });

  it('handles accidentals (^, _, =)', () => {
    const abc = [
      'X:1',
      'K:C',
      '^C _E =F',
    ].join('\n');

    const { score } = abcToScore(abc);
    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis[0]).toBe(61); // C# = 61
    expect(midis[1]).toBe(63); // Eb = 63
    expect(midis[2]).toBe(65); // F natural = 65
  });

  it('handles duration modifiers (2, /2, 3/2)', () => {
    const abc = [
      'X:1',
      'L:1/4',
      'K:C',
      'C2 D/2 E3/2',
    ].join('\n');

    const { score } = abcToScore(abc);
    const events = score.parts[0]!.events;
    expect(events[0]!.duration).toBe(960); // C * 2 = half
    expect(events[1]!.duration).toBe(240); // D / 2 = eighth
    expect(events[2]!.duration).toBe(720); // E * 3/2 = dotted quarter
  });

  it('handles rests (z and Z)', () => {
    const abc = [
      'X:1',
      'M:4/4',
      'L:1/4',
      'K:C',
      'C z D z2',
    ].join('\n');

    const { score } = abcToScore(abc);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2); // C and D
    expect(events[0]!.onset).toBe(0);
    expect(events[1]!.onset).toBe(960); // C(480) + z(480)
  });

  it('handles chords [CEG]', () => {
    const abc = [
      'X:1',
      'L:1/4',
      'K:C',
      '[CEG]',
    ].join('\n');

    const { score } = abcToScore(abc);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(3);
    // All at same onset
    const onsets = events.map(e => e.onset);
    expect(new Set(onsets).size).toBe(1);
    const midis = events.map(e => e.pitch.midi).sort((a, b) => a - b);
    expect(midis).toEqual([60, 64, 67]); // C E G
  });

  it('handles ties (-)', () => {
    const abc = [
      'X:1',
      'L:1/4',
      'K:C',
      'C-C D',
    ].join('\n');

    const { score } = abcToScore(abc);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2); // tied C + D
    expect(events[0]!.duration).toBe(960); // two quarters tied
    expect(events[0]!.pitch.midi).toBe(60);
    expect(events[1]!.pitch.midi).toBe(62);
  });

  it('handles multi-voice V:', () => {
    const abc = [
      'X:1',
      'L:1/4',
      'K:C',
      'V:1',
      'CDEF|',
      'V:2',
      'EFGA|',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.parts.length).toBe(2);
  });

  it('handles barlines without crashing', () => {
    const abc = [
      'X:1',
      'L:1/4',
      'K:C',
      'C D|E F||G A|]',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.parts[0]!.events.length).toBe(6);
  });

  it('applies default note length from L: field', () => {
    const abc = [
      'X:1',
      'L:1/8',
      'K:C',
      'C D E F',
    ].join('\n');

    const { score } = abcToScore(abc);
    const events = score.parts[0]!.events;
    expect(events[0]!.duration).toBe(240); // 1/8 note = 240 ticks at 480 TPQ
  });

  it('parses key with mode (Dm, Amix)', () => {
    const abc = [
      'X:1',
      'K:Dm',
      'D E F G',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.keyCenters[0]!.tonic).toBe(2); // D
    expect(score.keyCenters[0]!.mode).toBe('minor');
  });

  it('parses common time M:C', () => {
    const abc = [
      'X:1',
      'M:C',
      'K:C',
      'C D E F',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.timeSignatures[0]!.numerator).toBe(4);
    expect(score.timeSignatures[0]!.denominator).toBe(4);
  });

  it('parses cut time M:C|', () => {
    const abc = [
      'X:1',
      'M:C|',
      'K:C',
      'C D E F',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.timeSignatures[0]!.numerator).toBe(2);
    expect(score.timeSignatures[0]!.denominator).toBe(2);
  });

  it('returns frozen result', () => {
    const abc = [
      'X:1',
      'K:C',
      'CDEF',
    ].join('\n');

    const result = abcToScore(abc);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.warnings)).toBe(true);
  });

  it('handles empty input', () => {
    const { score } = abcToScore('');
    expect(score.parts.length).toBeGreaterThanOrEqual(0);
  });

  it('handles double sharp ^^', () => {
    const abc = [
      'X:1',
      'K:C',
      '^^C',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.parts[0]!.events[0]!.pitch.midi).toBe(62); // C## = D
  });

  it('handles double flat __', () => {
    const abc = [
      'X:1',
      'K:C',
      '__E',
    ].join('\n');

    const { score } = abcToScore(abc);
    expect(score.parts[0]!.events[0]!.pitch.midi).toBe(62); // Ebb = D
  });

  it('handles whole-measure rest Z', () => {
    const abc = [
      'X:1',
      'M:4/4',
      'L:1/4',
      'K:C',
      'C D E F|',
      'Z',
      'G A B c|',
    ].join('\n');

    const { score } = abcToScore(abc);
    const events = score.parts[0]!.events;
    // First 4 notes, then a whole measure rest, then 4 more
    const secondGroupOnset = events[4]?.onset ?? 0;
    expect(secondGroupOnset).toBe(3840); // 4 quarters + 4 quarters of rest
  });
});
