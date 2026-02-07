import { describe, it, expect } from 'vitest';
import {
  parseFiguredBass,
  realizeFiguredBass,
  figuredBassAnalysis,
  createScore,
  addPart,
  addNote,
} from '../src/index.js';

describe('Figured Bass', () => {
  // ── parseFiguredBass ───────────────────────────────────────────────────

  describe('parseFiguredBass', () => {
    it('empty string → root position [5, 3]', () => {
      const result = parseFiguredBass('');
      expect(result.intervals).toHaveLength(2);
      expect(result.intervals[0]!.interval).toBe(5);
      expect(result.intervals[1]!.interval).toBe(3);
    });

    it('"6" → first inversion [6, 3]', () => {
      const result = parseFiguredBass('6');
      expect(result.intervals).toHaveLength(2);
      expect(result.intervals[0]!.interval).toBe(6);
      expect(result.intervals[1]!.interval).toBe(3);
    });

    it('"6/4" → second inversion [6, 4]', () => {
      const result = parseFiguredBass('6/4');
      expect(result.intervals).toHaveLength(2);
      expect(result.intervals[0]!.interval).toBe(6);
      expect(result.intervals[1]!.interval).toBe(4);
    });

    it('"7" → seventh root position [7, 5, 3]', () => {
      const result = parseFiguredBass('7');
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals[0]!.interval).toBe(7);
      expect(result.intervals[1]!.interval).toBe(5);
      expect(result.intervals[2]!.interval).toBe(3);
    });

    it('"6/5" → seventh 1st inversion [6, 5, 3]', () => {
      const result = parseFiguredBass('6/5');
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals[0]!.interval).toBe(6);
      expect(result.intervals[1]!.interval).toBe(5);
      expect(result.intervals[2]!.interval).toBe(3);
    });

    it('"4/3" → seventh 2nd inversion [6, 4, 3]', () => {
      const result = parseFiguredBass('4/3');
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals[0]!.interval).toBe(6);
      expect(result.intervals[1]!.interval).toBe(4);
      expect(result.intervals[2]!.interval).toBe(3);
    });

    it('"4/2" → seventh 3rd inversion [6, 4, 2]', () => {
      const result = parseFiguredBass('4/2');
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals[0]!.interval).toBe(6);
      expect(result.intervals[1]!.interval).toBe(4);
      expect(result.intervals[2]!.interval).toBe(2);
    });

    it('"2" → shorthand for 4/2 → [6, 4, 2]', () => {
      const result = parseFiguredBass('2');
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals[0]!.interval).toBe(6);
      expect(result.intervals[1]!.interval).toBe(4);
      expect(result.intervals[2]!.interval).toBe(2);
    });

    it('"#6" → raised sixth with accidental', () => {
      const result = parseFiguredBass('#6');
      // Expands to first inversion [6, 3] with # on 6
      expect(result.intervals.some(i => i.interval === 6 && i.accidental === '#')).toBe(true);
      expect(result.intervals.some(i => i.interval === 3)).toBe(true);
    });

    it('"b" → flat third (bare accidental)', () => {
      const result = parseFiguredBass('b');
      // Bare accidental applies to 3rd
      expect(result.intervals.some(i => i.interval === 3 && i.accidental === 'b')).toBe(true);
    });

    it('"#" → raised third (bare accidental)', () => {
      const result = parseFiguredBass('#');
      expect(result.intervals.some(i => i.interval === 3 && i.accidental === '#')).toBe(true);
    });

    it('returns frozen result', () => {
      const result = parseFiguredBass('6');
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.intervals)).toBe(true);
    });

    it('throws RangeError for invalid token', () => {
      expect(() => parseFiguredBass('x')).toThrow(RangeError);
      expect(() => parseFiguredBass('6/x')).toThrow(RangeError);
    });
  });

  // ── realizeFiguredBass ─────────────────────────────────────────────────

  describe('realizeFiguredBass', () => {
    it('C + "" in C major → C-E-G', () => {
      const chord = realizeFiguredBass(48, ''); // C3
      // PCs should be C(0), E(4), G(7)
      expect(chord.pitchClasses).toContain(0);
      expect(chord.pitchClasses).toContain(4);
      expect(chord.pitchClasses).toContain(7);
      expect(chord.midi[0]).toBe(48); // bass stays
    });

    it('C + "7" in C major → C-E-G-B', () => {
      const chord = realizeFiguredBass(48, '7');
      expect(chord.pitchClasses).toContain(0);  // C
      expect(chord.pitchClasses).toContain(4);  // E
      expect(chord.pitchClasses).toContain(7);  // G
      expect(chord.pitchClasses).toContain(11); // B
      expect(chord.midi).toHaveLength(4);
    });

    it('C + "6" in C major → includes A (pc 9)', () => {
      const chord = realizeFiguredBass(48, '6');
      expect(chord.pitchClasses).toContain(0);  // C (bass)
      expect(chord.pitchClasses).toContain(4);  // E (3rd above)
      expect(chord.pitchClasses).toContain(9);  // A (6th above)
    });

    it('D + "6" in C major → D-F-B', () => {
      const chord = realizeFiguredBass(50, '6'); // D3
      expect(chord.pitchClasses).toContain(2);  // D
      expect(chord.pitchClasses).toContain(5);  // F
      expect(chord.pitchClasses).toContain(11); // B
    });

    it('A + "" in A minor → A-C-E', () => {
      const chord = realizeFiguredBass(57, '', { tonic: 9, mode: 'minor' }); // A3
      expect(chord.pitchClasses).toContain(9);  // A
      expect(chord.pitchClasses).toContain(0);  // C
      expect(chord.pitchClasses).toContain(4);  // E
    });

    it('"#6" raises sixth by one semitone', () => {
      // In C major, C + 6th = A (pc 9), #6 = A# (pc 10)
      const chord = realizeFiguredBass(48, '#6');
      expect(chord.pitchClasses).toContain(10); // A# instead of A
    });

    it('returns frozen result', () => {
      const chord = realizeFiguredBass(48, '');
      expect(Object.isFrozen(chord)).toBe(true);
      expect(Object.isFrozen(chord.midi)).toBe(true);
      expect(Object.isFrozen(chord.pitchClasses)).toBe(true);
    });

    it('throws RangeError for invalid bass', () => {
      expect(() => realizeFiguredBass(-1, '')).toThrow(RangeError);
      expect(() => realizeFiguredBass(128, '')).toThrow(RangeError);
      expect(() => realizeFiguredBass(60.5, '')).toThrow(RangeError);
    });
  });

  // ── figuredBassAnalysis ────────────────────────────────────────────────

  describe('figuredBassAnalysis', () => {
    function makeScore() {
      const s = createScore({ title: 'FB Test', composer: 'Test' });
      const p = addPart(s, 'P1', 'Piano', 0, 0);
      return { s, p };
    }

    it('identifies root position triad', () => {
      const { s, p } = makeScore();
      // C3, E3, G3 at tick 0
      addNote(s, p, { midi: 48, onset: 0, duration: 480, velocity: 80 });
      addNote(s, p, { midi: 52, onset: 0, duration: 480, velocity: 80 });
      addNote(s, p, { midi: 55, onset: 0, duration: 480, velocity: 80 });

      const events = figuredBassAnalysis(s);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.bassMidi).toBe(48);
      expect(events[0]!.figures).toBe(''); // root position
    });

    it('identifies first inversion', () => {
      const { s, p } = makeScore();
      // E3, G3, C4 = first inversion C major
      addNote(s, p, { midi: 52, onset: 0, duration: 480, velocity: 80 });
      addNote(s, p, { midi: 55, onset: 0, duration: 480, velocity: 80 });
      addNote(s, p, { midi: 60, onset: 0, duration: 480, velocity: 80 });

      const events = figuredBassAnalysis(s);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.bassMidi).toBe(52);
      expect(events[0]!.figures).toBe('6');
    });

    it('returns frozen result', () => {
      const { s, p } = makeScore();
      addNote(s, p, { midi: 48, onset: 0, duration: 480, velocity: 80 });
      addNote(s, p, { midi: 52, onset: 0, duration: 480, velocity: 80 });
      addNote(s, p, { midi: 55, onset: 0, duration: 480, velocity: 80 });

      const events = figuredBassAnalysis(s);
      expect(Object.isFrozen(events)).toBe(true);
      if (events.length > 0) {
        expect(Object.isFrozen(events[0])).toBe(true);
      }
    });
  });
});
