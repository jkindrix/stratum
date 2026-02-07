import { describe, it, expect } from 'vitest';
import { scoreToLilyPond } from '../src/io/lilypond.js';
import { createScore, addPart, addNote } from '../src/core/score.js';

function makeSimpleScore(): ReturnType<typeof createScore> {
  const score = createScore({ title: 'Test', composer: 'Tester' });
  const part = addPart(score, { name: 'Piano' });
  // C major scale: C D E F G A B C
  const notes = [60, 62, 64, 65, 67, 69, 71, 72];
  for (let i = 0; i < notes.length; i++) {
    addNote(score, part, { midi: notes[i]!, onset: i * 480, duration: 480 });
  }
  score.keyCenters.push({ tonic: 0, mode: 'major', atTick: 0 });
  return score;
}

describe('scoreToLilyPond', () => {
  it('exports a simple melody with version and pitch names', () => {
    const score = makeSimpleScore();
    const ly = scoreToLilyPond(score);

    expect(ly).toContain('\\version "2.24.0"');
    expect(ly).toContain("c'");
    expect(ly).toContain("d'");
    expect(ly).toContain("e'");
    expect(ly).toContain("f'");
  });

  it('includes header block with title and composer', () => {
    const score = makeSimpleScore();
    const ly = scoreToLilyPond(score);

    expect(ly).toContain('\\header');
    expect(ly).toContain('title = "Test"');
    expect(ly).toContain('composer = "Tester"');
  });

  it('includes key and time directives', () => {
    const score = makeSimpleScore();
    const ly = scoreToLilyPond(score);

    expect(ly).toContain('\\key c \\major');
    expect(ly).toContain('\\time 4/4');
  });

  it('handles sharp pitch spelling (cis)', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 61, onset: 0, duration: 480 }); // C#
    score.keyCenters.push({ tonic: 9, mode: 'major', atTick: 0 }); // A major

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('cis');
  });

  it('handles flat pitch spelling (ees)', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 63, onset: 0, duration: 480 }); // Eb
    score.keyCenters.push({ tonic: 5, mode: 'major', atTick: 0 }); // F major (has Bb)

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('ees');
  });

  it('uses correct octave markers', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 60, onset: 0, duration: 480 }); // C4 = c'
    addNote(score, part, { midi: 72, onset: 480, duration: 480 }); // C5 = c''
    addNote(score, part, { midi: 48, onset: 960, duration: 480 }); // C3 = c (no marker)
    addNote(score, part, { midi: 36, onset: 1440, duration: 480 }); // C2 = c,

    const ly = scoreToLilyPond(score);
    expect(ly).toContain("c'"); // C4
    expect(ly).toContain("c''"); // C5
  });

  it('handles dotted notes', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 60, onset: 0, duration: 720 }); // dotted quarter

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('4.');
  });

  it('inserts rests for gaps', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 60, onset: 0, duration: 480 });
    addNote(score, part, { midi: 64, onset: 960, duration: 480 }); // gap of 480

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('r');
  });

  it('handles multi-voice export with voiceOne/voiceTwo', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 72, onset: 0, duration: 480, voice: 0 });
    addNote(score, part, { midi: 60, onset: 0, duration: 480, voice: 1 });

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('\\voiceOne');
    expect(ly).toContain('\\voiceTwo');
    expect(ly).toContain('<<');
    expect(ly).toContain('\\\\');
  });

  it('includes dynamics based on velocity', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 60, onset: 0, duration: 480, velocity: 96 });

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('\\f');
  });

  it('includes articulations', () => {
    const score = createScore();
    const part = addPart(score, { name: 'P1' });
    addNote(score, part, { midi: 60, onset: 0, duration: 480, articulation: 'staccato' });
    addNote(score, part, { midi: 62, onset: 480, duration: 480, articulation: 'tenuto' });
    addNote(score, part, { midi: 64, onset: 960, duration: 480, articulation: 'accent' });

    const ly = scoreToLilyPond(score);
    expect(ly).toContain('-.');
    expect(ly).toContain('--');
    expect(ly).toContain('->');
  });

  it('exports multi-part score with multiple Staff blocks', () => {
    const score = createScore();
    addPart(score, { name: 'Violin' });
    addPart(score, { name: 'Cello' });
    addNote(score, score.parts[0]!, { midi: 76, onset: 0, duration: 480 });
    addNote(score, score.parts[1]!, { midi: 48, onset: 0, duration: 480 });

    const ly = scoreToLilyPond(score);
    const staffCount = (ly.match(/\\new Staff/g) ?? []).length;
    expect(staffCount).toBe(2);
  });

  it('handles empty score', () => {
    const score = createScore();
    const ly = scoreToLilyPond(score);

    expect(ly).toContain('\\version');
    expect(ly).toContain('\\score');
  });

  it('does not mutate the score', () => {
    const score = makeSimpleScore();
    const eventCountBefore = score.parts[0]!.events.length;
    scoreToLilyPond(score);
    expect(score.parts[0]!.events.length).toBe(eventCountBefore);
  });

  it('exports C major scale with correct pitch sequence', () => {
    const score = makeSimpleScore();
    const ly = scoreToLilyPond(score);

    // Verify output contains the correct LilyPond pitch sequence
    expect(ly).toContain("c'");
    expect(ly).toContain("d'");
    expect(ly).toContain("e'");
    expect(ly).toContain("f'");
    expect(ly).toContain("g'");
    expect(ly).toContain("a'");
    expect(ly).toContain("b'");
    expect(ly).toContain("c''");
  });

  it('uses custom version string', () => {
    const score = createScore();
    const ly = scoreToLilyPond(score, { version: '2.22.0' });
    expect(ly).toContain('\\version "2.22.0"');
  });
});
