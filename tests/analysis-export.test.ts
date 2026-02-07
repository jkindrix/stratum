import { describe, it, expect } from 'vitest';
import { toJAMS, toRomanText, fromRomanText } from '../src/io/analysis-export.js';

describe('toJAMS', () => {
  it('creates a valid JamsDocument structure', () => {
    const doc = toJAMS([{
      namespace: 'chord',
      data: [{ time: 0, duration: 2, value: 'C:maj', confidence: 1 }],
    }]);

    expect(doc.file_metadata).toBeDefined();
    expect(doc.annotations).toBeDefined();
    expect(doc.annotations.length).toBe(1);
    expect(doc.annotations[0]!.namespace).toBe('chord');
    expect(doc.annotations[0]!.data.length).toBe(1);
  });

  it('includes metadata when provided', () => {
    const doc = toJAMS([], { title: 'My Song', duration: 180 });

    expect(doc.file_metadata.title).toBe('My Song');
    expect(doc.file_metadata.duration).toBe(180);
  });

  it('handles multiple annotations', () => {
    const doc = toJAMS([
      { namespace: 'chord', data: [{ time: 0, duration: 1, value: 'C:maj', confidence: 1 }] },
      { namespace: 'beat', data: [{ time: 0, duration: 0, value: '1', confidence: 0.9 }] },
      { namespace: 'key', data: [{ time: 0, duration: 10, value: 'C:major', confidence: 0.8 }] },
    ]);

    expect(doc.annotations.length).toBe(3);
    expect(doc.annotations[0]!.namespace).toBe('chord');
    expect(doc.annotations[1]!.namespace).toBe('beat');
    expect(doc.annotations[2]!.namespace).toBe('key');
  });

  it('preserves chord namespace observations', () => {
    const doc = toJAMS([{
      namespace: 'chord',
      data: [
        { time: 0, duration: 2, value: 'C:maj', confidence: 1 },
        { time: 2, duration: 2, value: 'G:maj', confidence: 0.9 },
      ],
    }]);

    expect(doc.annotations[0]!.data.length).toBe(2);
    expect(doc.annotations[0]!.data[0]!.value).toBe('C:maj');
    expect(doc.annotations[0]!.data[1]!.value).toBe('G:maj');
  });

  it('returns a frozen document', () => {
    const doc = toJAMS([{
      namespace: 'chord',
      data: [{ time: 0, duration: 1, value: 'C:maj', confidence: 1 }],
    }]);

    expect(Object.isFrozen(doc)).toBe(true);
    expect(Object.isFrozen(doc.file_metadata)).toBe(true);
    expect(Object.isFrozen(doc.annotations)).toBe(true);
  });

  it('includes annotation_metadata when provided', () => {
    const doc = toJAMS([{
      namespace: 'chord',
      data: [],
      annotation_metadata: {
        corpus: 'test_corpus',
        annotator: { name: 'John' },
      },
    }]);

    expect(doc.annotations[0]!.annotation_metadata?.corpus).toBe('test_corpus');
    expect(doc.annotations[0]!.annotation_metadata?.annotator?.name).toBe('John');
  });
});

describe('toRomanText', () => {
  it('serializes basic analysis', () => {
    const text = toRomanText({
      metadata: { composer: 'Bach', title: 'Prelude' },
      measures: [
        { measure: 1, chords: [{ roman: 'I' }] },
        { measure: 2, chords: [{ roman: 'V' }] },
      ],
    });

    expect(text).toContain('Composer: Bach');
    expect(text).toContain('Title: Prelude');
    expect(text).toContain('m1 I');
    expect(text).toContain('m2 V');
  });

  it('includes key changes in measure lines', () => {
    const text = toRomanText({
      metadata: {},
      measures: [
        { measure: 1, key: 'C:', chords: [{ roman: 'I' }] },
        { measure: 5, key: 'G:', chords: [{ roman: 'I' }] },
      ],
    });

    expect(text).toContain('m1 C: I');
    expect(text).toContain('m5 G: I');
  });

  it('includes beat positions', () => {
    const text = toRomanText({
      metadata: {},
      measures: [
        { measure: 3, chords: [
          { roman: 'I' },
          { beat: 3, roman: 'IV' },
          { beat: 4, roman: 'V' },
        ]},
      ],
    });

    expect(text).toContain('m3 I b3 IV b4 V');
  });

  it('includes full metadata', () => {
    const text = toRomanText({
      metadata: { composer: 'Mozart', title: 'Sonata', analyst: 'Jane', timeSignature: '4/4' },
      measures: [],
    });

    expect(text).toContain('Composer: Mozart');
    expect(text).toContain('Title: Sonata');
    expect(text).toContain('Analyst: Jane');
    expect(text).toContain('Time Signature: 4/4');
  });
});

describe('fromRomanText', () => {
  it('parses basic header and measures', () => {
    const text = 'Composer: Bach\nTitle: Prelude\n\nm1 I\nm2 V\n';
    const analysis = fromRomanText(text);

    expect(analysis.metadata.composer).toBe('Bach');
    expect(analysis.metadata.title).toBe('Prelude');
    expect(analysis.measures.length).toBe(2);
    expect(analysis.measures[0]!.measure).toBe(1);
    expect(analysis.measures[0]!.chords[0]!.roman).toBe('I');
  });

  it('parses key changes', () => {
    const text = 'm1 C: I\nm5 G: I V\n';
    const analysis = fromRomanText(text);

    expect(analysis.measures[0]!.key).toBe('C:');
    expect(analysis.measures[1]!.key).toBe('G:');
  });

  it('parses beat positions', () => {
    const text = 'm3 I b3 IV b4 V\n';
    const analysis = fromRomanText(text);

    const chords = analysis.measures[0]!.chords;
    expect(chords.length).toBe(3);
    expect(chords[0]!.roman).toBe('I');
    expect(chords[1]!.beat).toBe(3);
    expect(chords[1]!.roman).toBe('IV');
    expect(chords[2]!.beat).toBe(4);
    expect(chords[2]!.roman).toBe('V');
  });

  it('parses multiple measures', () => {
    const text = 'm1 I\nm2 IV\nm3 V\nm4 I\n';
    const analysis = fromRomanText(text);
    expect(analysis.measures.length).toBe(4);
  });

  it('round-trips: toRomanText → fromRomanText preserves structure', () => {
    const original = {
      metadata: { composer: 'Bach', title: 'Test', analyst: 'AI', timeSignature: '3/4' },
      measures: [
        { measure: 1, key: 'C:', chords: [{ roman: 'I' }, { beat: 3, roman: 'V' }] },
        { measure: 2, chords: [{ roman: 'IV' }, { beat: 3, roman: 'I' }] },
      ],
    } as const;

    const text = toRomanText(original);
    const parsed = fromRomanText(text);

    expect(parsed.metadata.composer).toBe('Bach');
    expect(parsed.metadata.title).toBe('Test');
    expect(parsed.measures.length).toBe(2);
    expect(parsed.measures[0]!.key).toBe('C:');
    expect(parsed.measures[0]!.chords.length).toBe(2);
    expect(parsed.measures[0]!.chords[0]!.roman).toBe('I');
    expect(parsed.measures[0]!.chords[1]!.roman).toBe('V');
    expect(parsed.measures[0]!.chords[1]!.beat).toBe(3);
  });

  it('returns frozen result', () => {
    const analysis = fromRomanText('m1 I\n');
    expect(Object.isFrozen(analysis)).toBe(true);
    expect(Object.isFrozen(analysis.metadata)).toBe(true);
    expect(Object.isFrozen(analysis.measures)).toBe(true);
  });

  it('handles empty input', () => {
    const analysis = fromRomanText('');
    expect(analysis.measures.length).toBe(0);
  });

  it('skips comment lines', () => {
    const text = '% This is a comment\nm1 I\n% Another comment\nm2 V\n';
    const analysis = fromRomanText(text);
    expect(analysis.measures.length).toBe(2);
  });
});
