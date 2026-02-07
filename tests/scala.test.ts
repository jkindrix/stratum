import { describe, it, expect } from 'vitest';
import {
  parseScl,
  parseKbm,
  tuningFromScl,
  sclToString,
  kbmToString,
} from '../src/index.js';

// Standard 12-TET .scl file
const SCL_12TET = `! 12-TET.scl
!
12-tone equal temperament
12
100.000000
200.000000
300.000000
400.000000
500.000000
600.000000
700.000000
800.000000
900.000000
1000.000000
1100.000000
1200.000000
`;

// Just intonation with ratio notation
const SCL_JI = `! Just Intonation
!
5-limit JI (12 notes)
7
9/8
5/4
4/3
3/2
5/3
15/8
2
`;

// Standard .kbm file
const KBM_STANDARD = `! Standard mapping
12
0
127
60
69
440.000000
12
0
1
2
3
4
5
6
7
8
9
10
11
`;

describe('Scala .scl/.kbm Support', () => {
  describe('parseScl', () => {
    it('parses 12-TET file', () => {
      const scl = parseScl(SCL_12TET);
      expect(scl.description).toBe('12-tone equal temperament');
      expect(scl.noteCount).toBe(12);
      expect(scl.degrees).toHaveLength(12);
      expect(scl.degrees[0]!.cents).toBeCloseTo(100, 3);
      expect(scl.degrees[11]!.cents).toBeCloseTo(1200, 3);
    });

    it('parses ratio notation (JI)', () => {
      const scl = parseScl(SCL_JI);
      expect(scl.description).toBe('5-limit JI (12 notes)');
      expect(scl.noteCount).toBe(7);
      expect(scl.degrees).toHaveLength(7);
      // 3/2 = 701.955 cents
      expect(scl.degrees[3]!.cents).toBeCloseTo(701.955, 1);
      expect(scl.degrees[3]!.ratio).toEqual([3, 2]);
    });

    it('treats octave (2/1) as last degree', () => {
      const scl = parseScl(SCL_JI);
      const lastDeg = scl.degrees[scl.noteCount - 1]!;
      expect(lastDeg.cents).toBeCloseTo(1200, 3);
      expect(lastDeg.ratio).toEqual([2, 1]);
    });

    it('returns frozen result', () => {
      const scl = parseScl(SCL_12TET);
      expect(Object.isFrozen(scl)).toBe(true);
      expect(Object.isFrozen(scl.degrees)).toBe(true);
      expect(Object.isFrozen(scl.degrees[0])).toBe(true);
    });

    it('throws on empty file', () => {
      expect(() => parseScl('')).toThrow(RangeError);
    });

    it('throws on mismatched note count', () => {
      const bad = `! bad\nBad file\n5\n100.0\n200.0\n`;
      expect(() => parseScl(bad)).toThrow(RangeError);
    });

    it('throws on invalid ratio (zero denominator)', () => {
      const bad = `! bad\nBad ratio\n1\n3/0\n`;
      expect(() => parseScl(bad)).toThrow(RangeError);
    });

    it('skips comment lines', () => {
      const scl = `! This is a comment
! Another comment
Test scale
3
! Inline comment
100.000000
200.000000
300.000000
`;
      const result = parseScl(scl);
      expect(result.description).toBe('Test scale');
      expect(result.noteCount).toBe(3);
      expect(result.degrees).toHaveLength(3);
    });
  });

  describe('parseKbm', () => {
    it('parses standard mapping', () => {
      const kbm = parseKbm(KBM_STANDARD);
      expect(kbm.mapSize).toBe(12);
      expect(kbm.firstNote).toBe(0);
      expect(kbm.lastNote).toBe(127);
      expect(kbm.middleNote).toBe(60);
      expect(kbm.referenceNote).toBe(69);
      expect(kbm.referenceFreq).toBeCloseTo(440, 3);
      expect(kbm.octaveDegree).toBe(12);
      expect(kbm.mapping).toHaveLength(12);
    });

    it('handles unmapped entries', () => {
      const kbm = `! Mapping with unmapped
4
0
127
60
69
440.000000
4
0
x
2
x
`;
      const result = parseKbm(kbm);
      expect(result.mapping[0]).toBe(0);
      expect(result.mapping[1]).toBeNull();
      expect(result.mapping[2]).toBe(2);
      expect(result.mapping[3]).toBeNull();
    });

    it('returns frozen result', () => {
      const kbm = parseKbm(KBM_STANDARD);
      expect(Object.isFrozen(kbm)).toBe(true);
      expect(Object.isFrozen(kbm.mapping)).toBe(true);
    });

    it('throws on too few lines', () => {
      expect(() => parseKbm('12\n0\n127\n')).toThrow(RangeError);
    });

    it('throws on invalid reference frequency', () => {
      const bad = `! Bad
12
0
127
60
69
-100
12
`;
      expect(() => parseKbm(bad)).toThrow(RangeError);
    });
  });

  describe('tuningFromScl', () => {
    it('creates tuning from 12-TET', () => {
      const scl = parseScl(SCL_12TET);
      const tuning = tuningFromScl(scl);
      expect(tuning.stepsPerOctave).toBe(12);
      expect(tuning.name).toBe('12-tone equal temperament');
      // A4 (step 9, octave 4, mapping: 69 = refNote) should be 440 Hz
      const a4 = tuning.frequencyAt(9, 5, 440);
      expect(a4).toBeCloseTo(440, 0);
    });

    it('creates tuning from JI', () => {
      const scl = parseScl(SCL_JI);
      const tuning = tuningFromScl(scl);
      expect(tuning.stepsPerOctave).toBe(7);
    });

    it('respects KBM reference', () => {
      const scl = parseScl(SCL_12TET);
      const kbm = parseKbm(KBM_STANDARD);
      const tuning = tuningFromScl(scl, kbm);
      // With standard KBM: MIDI 69 = A4 = 440 Hz
      // step 9, octave 5 in 12-step system = note 69
      const a4 = tuning.frequencyAt(9, 5, 440);
      expect(a4).toBeCloseTo(440, 0);
    });

    it('octave doubles frequency', () => {
      const scl = parseScl(SCL_12TET);
      const tuning = tuningFromScl(scl);
      const f1 = tuning.frequencyAt(0, 4, 440);
      const f2 = tuning.frequencyAt(0, 5, 440);
      expect(f2 / f1).toBeCloseTo(2, 3);
    });

    it('handles steps below the reference note', () => {
      const scl = parseScl(SCL_12TET);
      const tuning = tuningFromScl(scl);
      // Reference is MIDI 69 (A4) = step 9, octave 5. Go one octave below.
      const a4 = tuning.frequencyAt(9, 5, 440);
      const a3 = tuning.frequencyAt(9, 4, 440);
      expect(a4 / a3).toBeCloseTo(2, 3);
      // Middle C (MIDI 60) = step 0, octave 5 → should be ~261.63 Hz
      const c4 = tuning.frequencyAt(0, 5, 440);
      expect(c4).toBeCloseTo(261.63, 0);
    });
  });

  describe('sclToString', () => {
    it('round-trips cent-based SCL', () => {
      const original = parseScl(SCL_12TET);
      const text = sclToString(original);
      const parsed = parseScl(text);
      expect(parsed.noteCount).toBe(original.noteCount);
      expect(parsed.description).toBe(original.description);
      for (let i = 0; i < original.noteCount; i++) {
        expect(parsed.degrees[i]!.cents).toBeCloseTo(original.degrees[i]!.cents, 3);
      }
    });

    it('round-trips ratio-based SCL', () => {
      const original = parseScl(SCL_JI);
      const text = sclToString(original);
      const parsed = parseScl(text);
      expect(parsed.noteCount).toBe(original.noteCount);
      for (let i = 0; i < original.noteCount; i++) {
        if (original.degrees[i]!.ratio) {
          expect(parsed.degrees[i]!.ratio).toEqual(original.degrees[i]!.ratio);
        }
        expect(parsed.degrees[i]!.cents).toBeCloseTo(original.degrees[i]!.cents, 3);
      }
    });
  });

  describe('kbmToString', () => {
    it('round-trips standard mapping', () => {
      const original = parseKbm(KBM_STANDARD);
      const text = kbmToString(original);
      const parsed = parseKbm(text);
      expect(parsed.mapSize).toBe(original.mapSize);
      expect(parsed.firstNote).toBe(original.firstNote);
      expect(parsed.lastNote).toBe(original.lastNote);
      expect(parsed.middleNote).toBe(original.middleNote);
      expect(parsed.referenceNote).toBe(original.referenceNote);
      expect(parsed.referenceFreq).toBeCloseTo(original.referenceFreq, 3);
      expect(parsed.octaveDegree).toBe(original.octaveDegree);
      expect(parsed.mapping).toEqual(original.mapping);
    });
  });
});
