import { describe, it, expect } from 'vitest';
import { meiToScore } from '../src/io/mei.js';

function simpleMEI(bodyContent: string, scoreDef = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mei>
  <meiHead>
    <fileDesc>
      <titleStmt>
        <title>Test</title>
      </titleStmt>
    </fileDesc>
  </meiHead>
  <music>
    <body>
      <mdiv>
        <score>
          ${scoreDef || '<scoreDef><staffGrp><staffDef n="1" lines="5" meter.count="4" meter.unit="4"/></staffGrp></scoreDef>'}
          <section>
            ${bodyContent}
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`;
}

describe('meiToScore', () => {
  it('parses a simple MEI document with notes', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4"/>
            <note pname="d" oct="4" dur="4"/>
            <note pname="e" oct="4" dur="4"/>
            <note pname="f" oct="4" dur="4"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    expect(score.parts.length).toBe(1);
    expect(score.parts[0]!.events.length).toBe(4);
    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis).toEqual([60, 62, 64, 65]);
  });

  it('handles multi-staff scores', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4"/>
          </layer>
        </staff>
        <staff n="2">
          <layer n="1">
            <note pname="c" oct="3" dur="4"/>
          </layer>
        </staff>
      </measure>
    `, `<scoreDef>
      <staffGrp>
        <staffDef n="1" lines="5" meter.count="4" meter.unit="4"/>
        <staffDef n="2" lines="5" meter.count="4" meter.unit="4"/>
      </staffGrp>
    </scoreDef>`);

    const { score } = meiToScore(mei);
    expect(score.parts.length).toBe(2);
  });

  it('handles multi-layer (voice)', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="5" dur="2"/>
          </layer>
          <layer n="2">
            <note pname="e" oct="4" dur="2"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    expect(score.parts[0]!.events.length).toBe(2);
    const voices = score.parts[0]!.events.map(e => e.voice);
    expect(voices).toContain(0);
    expect(voices).toContain(1);
  });

  it('extracts key signature from staffDef', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="d" oct="4" dur="4"/>
          </layer>
        </staff>
      </measure>
    `, `<scoreDef>
      <staffGrp>
        <staffDef n="1" lines="5" key.sig="2s" meter.count="4" meter.unit="4"/>
      </staffGrp>
    </scoreDef>`);

    const { score } = meiToScore(mei);
    expect(score.keyCenters.length).toBe(1);
    expect(score.keyCenters[0]!.tonic).toBe(2); // D major
  });

  it('extracts time signature', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4"/>
          </layer>
        </staff>
      </measure>
    `, `<scoreDef>
      <staffGrp>
        <staffDef n="1" lines="5" meter.count="3" meter.unit="4"/>
      </staffGrp>
    </scoreDef>`);

    const { score } = meiToScore(mei);
    expect(score.timeSignatures[0]!.numerator).toBe(3);
    expect(score.timeSignatures[0]!.denominator).toBe(4);
  });

  it('handles accidentals', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4" accid="s"/>
            <note pname="e" oct="4" dur="4" accid="f"/>
            <note pname="f" oct="4" dur="4" accid="ss"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    const midis = score.parts[0]!.events.map(e => e.pitch.midi);
    expect(midis[0]).toBe(61); // C#
    expect(midis[1]).toBe(63); // Eb
    expect(midis[2]).toBe(67); // F## = G
  });

  it('handles rests', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4"/>
            <rest dur="4"/>
            <note pname="e" oct="4" dur="4"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2);
    expect(events[0]!.onset).toBe(0);
    expect(events[1]!.onset).toBe(960); // after quarter + quarter rest
  });

  it('handles ties', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4" tie="i"/>
            <note pname="c" oct="4" dur="4" tie="t"/>
            <note pname="d" oct="4" dur="4"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(2);
    expect(events[0]!.duration).toBe(960); // tied quarter + quarter
    expect(events[0]!.pitch.midi).toBe(60);
    expect(events[1]!.pitch.midi).toBe(62);
  });

  it('handles chords <chord>', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <chord dur="4">
              <note pname="c" oct="4"/>
              <note pname="e" oct="4"/>
              <note pname="g" oct="4"/>
            </chord>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    const events = score.parts[0]!.events;
    expect(events.length).toBe(3);
    const midis = events.map(e => e.pitch.midi).sort((a, b) => a - b);
    expect(midis).toEqual([60, 64, 67]);
    // All at same onset
    expect(events[0]!.onset).toBe(events[1]!.onset);
  });

  it('handles critical apparatus <app>/<lem>', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <app>
              <lem>
                <note pname="c" oct="4" dur="4"/>
              </lem>
              <rdg>
                <note pname="d" oct="4" dur="4"/>
              </rdg>
            </app>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    expect(score.parts[0]!.events.length).toBe(1);
    expect(score.parts[0]!.events[0]!.pitch.midi).toBe(60); // Takes lem (C), not rdg (D)
  });

  it('handles articulations', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4" artic="stacc"/>
            <note pname="d" oct="4" dur="4" artic="fermata"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    expect(score.parts[0]!.events[0]!.articulation).toBe('staccato');
    expect(score.parts[0]!.events[1]!.articulation).toBe('fermata');
  });

  it('throws on invalid root element', () => {
    expect(() => meiToScore('<foo/>')).toThrow(RangeError);
  });

  it('handles graceful partial/empty file', () => {
    const mei = `<?xml version="1.0"?><mei><music><body></body></music></mei>`;
    const { score, warnings } = meiToScore(mei);
    expect(score.parts.length).toBe(0);
  });

  it('returns frozen result', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4"/>
          </layer>
        </staff>
      </measure>
    `);

    const result = meiToScore(mei);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.warnings)).toBe(true);
  });

  it('handles dotted notes', () => {
    const mei = simpleMEI(`
      <measure n="1">
        <staff n="1">
          <layer n="1">
            <note pname="c" oct="4" dur="4" dots="1"/>
            <note pname="d" oct="4" dur="8"/>
          </layer>
        </staff>
      </measure>
    `);

    const { score } = meiToScore(mei);
    const events = score.parts[0]!.events;
    expect(events[0]!.duration).toBe(720); // dotted quarter
    expect(events[1]!.duration).toBe(240); // eighth
  });

  it('extracts metadata from meiHead', () => {
    const mei = `<?xml version="1.0"?>
<mei>
  <meiHead>
    <fileDesc>
      <titleStmt>
        <title>Symphony No. 5</title>
        <respStmt>
          <persName role="composer">Beethoven</persName>
        </respStmt>
      </titleStmt>
    </fileDesc>
  </meiHead>
  <music><body><mdiv><score>
    <scoreDef><staffGrp><staffDef n="1" lines="5" meter.count="4" meter.unit="4"/></staffGrp></scoreDef>
    <section>
      <measure n="1"><staff n="1"><layer n="1"><note pname="c" oct="4" dur="4"/></layer></staff></measure>
    </section>
  </score></mdiv></body></music>
</mei>`;

    const { score } = meiToScore(mei);
    expect(score.metadata.title).toBe('Symphony No. 5');
    expect(score.metadata.composer).toBe('Beethoven');
  });
});
