import { describe, it, expect } from 'vitest';
import { kernToScore } from '../src/io/kern.js';

describe('kernToScore', () => {
  it('parses a simple C major scale', () => {
    const kern = [
      '**kern',
      '4c',
      '4d',
      '4e',
      '4f',
      '4g',
      '4a',
      '4b',
      '4cc',
      '*-',
    ].join('\n');

    const { score, warnings } = kernToScore(kern);
    expect(score.parts.length).toBe(1);
    expect(score.parts[0]!.events.length).toBe(8);

    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('parses multi-spine (multi-voice) files', () => {
    const kern = [
      '**kern\t**kern',
      '4c\t4e',
      '4d\t4f',
      '*-\t*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.parts.length).toBe(2);
    expect(score.parts[0]!.events.length).toBe(2);
    expect(score.parts[1]!.events.length).toBe(2);
  });

  it('parses key signature *k[f#c#]', () => {
    const kern = [
      '**kern',
      '*k[f#c#]',
      '*major',
      '4d',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.keyCenters.length).toBe(1);
    expect(score.keyCenters[0]!.tonic).toBe(2); // D major
    expect(score.keyCenters[0]!.mode).toBe('major');
  });

  it('parses meter *M3/4', () => {
    const kern = [
      '**kern',
      '*M3/4',
      '4c',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.timeSignatures.length).toBe(1);
    expect(score.timeSignatures[0]!.numerator).toBe(3);
    expect(score.timeSignatures[0]!.denominator).toBe(4);
  });

  it('parses dotted notes', () => {
    const kern = [
      '**kern',
      '4.c',
      '8d',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2);
    // Dotted quarter = 480 * 1.5 = 720
    expect(events[0]!.duration).toBe(720);
    // Eighth = 240
    expect(events[1]!.duration).toBe(240);
  });

  it('parses accidentals (sharps and flats)', () => {
    const kern = [
      '**kern',
      '4c#',
      '4d-',
      '4e##',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis[0]).toBe(61); // C#
    expect(midis[1]).toBe(61); // Db
    expect(midis[2]).toBe(66); // E## = F#
  });

  it('handles rests (gaps in onset timeline)', () => {
    const kern = [
      '**kern',
      '4c',
      '4r',
      '4e',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2);
    expect(events[0]!.onset).toBe(0);
    expect(events[1]!.onset).toBe(960); // after quarter + quarter rest
  });

  it('handles ties [ ] _', () => {
    const kern = [
      '**kern',
      '4c[',
      '4c]',
      '4d',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2); // tied C + D
    expect(events[0]!.duration).toBe(960); // two quarters tied
    expect(events[0]!.pitch.midi).toBe(60);
    expect(events[1]!.pitch.midi).toBe(62);
  });

  it('handles chords (space-separated)', () => {
    const kern = [
      '**kern',
      '4c 4e 4g',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(3);
    // All at same onset
    expect(events[0]!.onset).toBe(events[1]!.onset);
    expect(events[1]!.onset).toBe(events[2]!.onset);
    const midis = events.map(e => e.pitch.midi).sort((a, b) => a - b);
    expect(midis).toEqual([60, 64, 67]);
  });

  it('parses spine split *^ and merge *v', () => {
    const kern = [
      '**kern',
      '4c',
      '*^',
      '4d\t4e',
      '*v\t*v',
      '4f',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    // Should have 2 parts (original + split)
    expect(score.parts.length).toBe(2);
  });

  it('parses barlines without crashing', () => {
    const kern = [
      '**kern',
      '4c',
      '=1',
      '4d',
      '=2',
      '4e',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.parts[0]!.events.length).toBe(3);
  });

  it('parses articulations (; fermata, \' staccato)', () => {
    const kern = [
      '**kern',
      '4c;',
      "4d'",
      '4e~',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const events = score.parts[0]!.events;
    expect(events[0]!.articulation).toBe('fermata');
    expect(events[1]!.articulation).toBe('staccato');
    expect(events[2]!.articulation).toBe('tenuto');
  });

  it('extracts metadata !!!COM: and !!!OTL:', () => {
    const kern = [
      '!!!COM: Bach, Johann Sebastian',
      '!!!OTL: Prelude in C',
      '**kern',
      '4c',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.metadata.composer).toBe('Bach, Johann Sebastian');
    expect(score.metadata.title).toBe('Prelude in C');
  });

  it('handles empty/comment-only input', () => {
    const kern = [
      '!! Global comment',
      '!! Another comment',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.parts.length).toBe(0);
  });

  it('handles invalid tokens with warnings', () => {
    const kern = [
      '**kern',
      '4c',
      '4xyz',
      '4e',
      '*-',
    ].join('\n');

    const { score, warnings } = kernToScore(kern);
    expect(score.parts[0]!.events.length).toBe(2);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('returns frozen result', () => {
    const kern = [
      '**kern',
      '4c',
      '*-',
    ].join('\n');

    const result = kernToScore(kern);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.warnings)).toBe(true);
  });

  it('handles uppercase pitch letters (lower octaves)', () => {
    const kern = [
      '**kern',
      '4C',
      '4CC',
      '4GG',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis[0]).toBe(48); // C3
    expect(midis[1]).toBe(36); // C2
    expect(midis[2]).toBe(43); // G2
  });

  it('parses breve (0) and whole (1) durations', () => {
    const kern = [
      '**kern',
      '1c',
      '0d',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    const events = score.parts[0]!.events;
    expect(events[0]!.duration).toBe(1920); // whole = 4 quarters
    expect(events[1]!.duration).toBe(3840); // breve = 8 quarters
  });

  it('parses minor key', () => {
    const kern = [
      '**kern',
      '*k[]',
      '*minor',
      '4c',
      '*-',
    ].join('\n');

    const { score } = kernToScore(kern);
    expect(score.keyCenters.length).toBe(1);
    expect(score.keyCenters[0]!.tonic).toBe(9); // A minor (relative of C major)
    expect(score.keyCenters[0]!.mode).toBe('minor');
  });
});
