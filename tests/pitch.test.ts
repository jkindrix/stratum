import { describe, it, expect } from 'vitest';
import {
  normalizePc,
  pitchFromMidi,
  pitchFromPcOctave,
  pitchToFrequency,
  frequencyToPitch,
  pitchClassName,
  pitchClassFlatName,
  pitchName,
  parsePitchName,
  directedInterval,
  intervalClass,
  intervalClassName,
  PitchClassSet,
  FORTE_CATALOG,
  FORTE_BY_NAME,
  voiceLeadingDistance,
  smoothestVoiceLeading,
  SCALE_CATALOG,
  CHORD_CATALOG,
  scaleFromPcs,
  modeRotation,
  chordFromPcs,
  chordFromName,
  equalTemperament,
  TET_12,
  TET_19,
  JUST_5_LIMIT,
  frequencyFromTuning,
  centsDeviation,
} from '../src/index.js';

describe('Pitch Class', () => {
  it('normalizes pitch classes to 0-11', () => {
    expect(normalizePc(0)).toBe(0);
    expect(normalizePc(12)).toBe(0);
    expect(normalizePc(-1)).toBe(11);
    expect(normalizePc(15)).toBe(3);
  });

  it('creates pitch from MIDI number', () => {
    const c4 = pitchFromMidi(60);
    expect(c4.midi).toBe(60);
    expect(c4.pitchClass).toBe(0);
    expect(c4.octave).toBe(4);

    const a4 = pitchFromMidi(69);
    expect(a4.pitchClass).toBe(9);
    expect(a4.octave).toBe(4);
  });

  it('creates pitch from pc and octave', () => {
    const p = pitchFromPcOctave(7, 3); // G3
    expect(p.midi).toBe(55);
    expect(p.pitchClass).toBe(7);
    expect(p.octave).toBe(3);
  });

  it('computes frequency', () => {
    const a4 = pitchFromMidi(69);
    expect(pitchToFrequency(a4)).toBeCloseTo(440, 1);

    const a5 = pitchFromMidi(81);
    expect(pitchToFrequency(a5)).toBeCloseTo(880, 1);
  });

  it('returns pitch class names', () => {
    expect(pitchClassName(0)).toBe('C');
    expect(pitchClassName(1)).toBe('C#');
    expect(pitchClassName(6)).toBe('F#');
    expect(pitchClassName(11)).toBe('B');

    expect(pitchClassFlatName(1)).toBe('Db');
    expect(pitchClassFlatName(3)).toBe('Eb');
  });

  it('formats pitch names', () => {
    expect(pitchName(pitchFromMidi(60))).toBe('C4');
    expect(pitchName(pitchFromMidi(69))).toBe('A4');
  });

  it('parses pitch names', () => {
    expect(parsePitchName('C4').midi).toBe(60);
    expect(parsePitchName('A4').midi).toBe(69);
    expect(parsePitchName('F#5').midi).toBe(78);
    expect(parsePitchName('Bb3').midi).toBe(58);
  });
});

describe('Intervals', () => {
  it('computes directed intervals', () => {
    expect(directedInterval(0, 7)).toBe(7);  // C to G
    expect(directedInterval(7, 0)).toBe(5);  // G to C (ascending)
    expect(directedInterval(0, 0)).toBe(0);
  });

  it('computes interval classes', () => {
    expect(intervalClass(0, 7)).toBe(5);  // P5 = IC 5
    expect(intervalClass(0, 5)).toBe(5);  // P4 = IC 5
    expect(intervalClass(0, 6)).toBe(6);  // tritone
    expect(intervalClass(0, 1)).toBe(1);  // semitone
    expect(intervalClass(0, 4)).toBe(4);  // major third
  });

  it('names interval classes', () => {
    expect(intervalClassName(0)).toBe('unison');
    expect(intervalClassName(5)).toBe('perfect fourth/fifth');
    expect(intervalClassName(6)).toBe('tritone');
  });
});

describe('PitchClassSet', () => {
  it('constructs and normalizes', () => {
    const s = new PitchClassSet([0, 4, 7]);
    expect(s.pcs).toEqual([0, 4, 7]);
    expect(s.size).toBe(3);

    // Deduplication
    const s2 = new PitchClassSet([0, 0, 4, 7, 12]);
    expect(s2.pcs).toEqual([0, 4, 7]);
  });

  it('checks membership', () => {
    const s = new PitchClassSet([0, 4, 7]);
    expect(s.has(0)).toBe(true);
    expect(s.has(4)).toBe(true);
    expect(s.has(3)).toBe(false);
    expect(s.has(12)).toBe(true); // 12 mod 12 = 0
  });

  it('transposes', () => {
    const cMaj = new PitchClassSet([0, 4, 7]);
    const gMaj = cMaj.transpose(7);
    expect(gMaj.pcs).toEqual([2, 7, 11]);
  });

  it('inverts', () => {
    const cMaj = new PitchClassSet([0, 4, 7]);
    const inv = cMaj.invert();
    expect(inv.pcs).toEqual([0, 5, 8]);
  });

  it('computes complement', () => {
    const cMaj = new PitchClassSet([0, 4, 7]);
    const comp = cMaj.complement();
    expect(comp.size).toBe(9);
    expect(comp.has(0)).toBe(false);
    expect(comp.has(1)).toBe(true);
  });

  it('computes interval vector', () => {
    const cMaj = new PitchClassSet([0, 4, 7]);
    // Major triad: IC3=1, IC4=1, IC5=1
    expect(cMaj.intervalVector()).toEqual([0, 0, 1, 1, 1, 0]);

    const aug = new PitchClassSet([0, 4, 8]);
    // Augmented triad: 3 major thirds (IC4)
    expect(aug.intervalVector()).toEqual([0, 0, 0, 3, 0, 0]);

    const dim = new PitchClassSet([0, 3, 6]);
    // Diminished: IC3=2, IC6=1
    expect(dim.intervalVector()).toEqual([0, 0, 2, 0, 0, 1]);
  });

  it('computes interval structure', () => {
    const major = new PitchClassSet([0, 4, 7]);
    expect(major.intervalStructure()).toEqual([4, 3, 5]); // 4+3+5 = 12
  });

  it('computes prime form for major triad', () => {
    const cMaj = new PitchClassSet([0, 4, 7]);
    expect(cMaj.primeForm()).toEqual([0, 3, 7]);

    // Minor triad should have same prime form (inversionally equivalent)
    const cMin = new PitchClassSet([0, 3, 7]);
    expect(cMin.primeForm()).toEqual([0, 3, 7]);
  });

  it('computes prime form for augmented triad', () => {
    const aug = new PitchClassSet([0, 4, 8]);
    expect(aug.primeForm()).toEqual([0, 4, 8]);
  });

  it('finds Forte names', () => {
    const cMaj = new PitchClassSet([0, 4, 7]);
    expect(cMaj.forteName()).toBe('3-11');

    const aug = new PitchClassSet([0, 4, 8]);
    expect(aug.forteName()).toBe('3-12');

    const dim = new PitchClassSet([0, 3, 6]);
    expect(dim.forteName()).toBe('3-10');

    const dimSeventh = new PitchClassSet([0, 3, 6, 9]);
    expect(dimSeventh.forteName()).toBe('4-28');
  });

  it('finds Forte name for diatonic scale', () => {
    const diatonic = new PitchClassSet([0, 2, 4, 5, 7, 9, 11]);
    expect(diatonic.forteName()).toBe('7-35');
  });

  it('finds Forte name for pentatonic scale', () => {
    const pent = new PitchClassSet([0, 2, 4, 7, 9]);
    expect(pent.forteName()).toBe('5-35');
  });

  it('finds Forte name for whole-tone scale', () => {
    const wt = new PitchClassSet([0, 2, 4, 6, 8, 10]);
    expect(wt.forteName()).toBe('6-35');
  });

  it('computes union and intersection', () => {
    const a = new PitchClassSet([0, 4, 7]);
    const b = new PitchClassSet([0, 3, 7]);

    const u = a.union(b);
    expect(u.pcs).toEqual([0, 3, 4, 7]);

    const i = a.intersection(b);
    expect(i.pcs).toEqual([0, 7]);
  });

  it('transposes to any key and maintains prime form', () => {
    // Major triads in all 12 keys should have the same prime form
    for (let t = 0; t < 12; t++) {
      const triad = new PitchClassSet([0, 4, 7]).transpose(t);
      expect(triad.primeForm()).toEqual([0, 3, 7]);
    }
  });

  it('toString', () => {
    expect(new PitchClassSet([0, 4, 7]).toString()).toBe('{0,4,7}');
  });
});

describe('Voice Leading', () => {
  it('computes voice-leading distance', () => {
    // C major to F major: 0→0(0), 4→5(1), 7→9(2) = 3
    expect(voiceLeadingDistance([0, 4, 7], [0, 5, 9])).toBe(3);
  });

  it('finds optimal assignment', () => {
    // C major to C minor: 0→0(0), 4→3(1), 7→7(0) = 1
    expect(voiceLeadingDistance([0, 4, 7], [0, 3, 7])).toBe(1);
  });

  it('handles unison', () => {
    expect(voiceLeadingDistance([0, 4, 7], [0, 4, 7])).toBe(0);
  });

  it('smoothest voice leading returns pairs', () => {
    const pairs = smoothestVoiceLeading([0, 4, 7], [0, 3, 7]);
    expect(pairs.length).toBe(3);
    // Total distance should be 1
    const totalDist = pairs.reduce((s, [from, to]) => {
      const d = (to - from + 12) % 12;
      return s + Math.min(d, 12 - d);
    }, 0);
    expect(totalDist).toBe(1);
  });

  it('throws for mismatched sizes', () => {
    expect(() => voiceLeadingDistance([0, 4], [0, 4, 7])).toThrow();
  });

  it('handles empty sets', () => {
    expect(voiceLeadingDistance([], [])).toBe(0);
  });

  it('handles single note', () => {
    expect(voiceLeadingDistance([0], [7])).toBe(5); // IC(0,7) = 5
  });

  it('exercises greedy fallback for n=9', () => {
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const dist = voiceLeadingDistance(a, b);
    expect(dist).toBe(9); // Each moves by 1
  });
});

describe('Pitch — Extended', () => {
  it('pitchFromMidi: boundary values', () => {
    const low = pitchFromMidi(0);
    expect(low.midi).toBe(0);
    expect(low.pitchClass).toBe(0);
    expect(low.octave).toBe(-1);

    const high = pitchFromMidi(127);
    expect(high.midi).toBe(127);
    expect(high.pitchClass).toBe(7);
    expect(high.octave).toBe(9);
  });

  it('frequencyToPitch round-trips with pitchToFrequency', () => {
    const a4 = pitchFromMidi(69);
    const freq = pitchToFrequency(a4);
    const roundTrip = frequencyToPitch(freq);
    expect(roundTrip.midi).toBe(69);
  });

  it('pitchToFrequency: C4 is ~261.63', () => {
    const c4 = pitchFromMidi(60);
    expect(pitchToFrequency(c4)).toBeCloseTo(261.63, 0);
  });

  it('parsePitchName: invalid input throws', () => {
    expect(() => parsePitchName('XY')).toThrow();
  });

  it('normalizePc: large values', () => {
    expect(normalizePc(24)).toBe(0);
    expect(normalizePc(100)).toBe(4);
  });
});

describe('PitchClassSet — Extended', () => {
  it('empty set operations', () => {
    const empty = new PitchClassSet([]);
    expect(empty.size).toBe(0);
    expect(empty.normalForm()).toEqual([]);
    expect(empty.primeForm()).toEqual([]);
  });

  it('single-element set', () => {
    const single = new PitchClassSet([5]);
    expect(single.size).toBe(1);
    expect(single.primeForm()).toEqual([0]);
  });

  it('full chromatic set (all 12)', () => {
    const all = new PitchClassSet([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(all.size).toBe(12);
  });

  it('major and minor produce same prime form (inversional equivalence)', () => {
    const major = new PitchClassSet([0, 4, 7]);
    const minor = new PitchClassSet([0, 3, 7]);
    expect(major.primeForm()).toEqual(minor.primeForm());
  });

  it('all 12 transpositions produce same prime form', () => {
    for (let t = 0; t < 12; t++) {
      const triad = new PitchClassSet([0, 4, 7]).transpose(t);
      expect(triad.primeForm()).toEqual([0, 3, 7]);
    }
  });

  it('difference and symmetricDifference', () => {
    const a = new PitchClassSet([0, 2, 4, 7]);
    const b = new PitchClassSet([0, 4, 7, 9]);
    const diff = a.difference(b);
    expect(diff.pcs).toEqual([2]);
    const symDiff = a.symmetricDifference(b);
    expect(symDiff.pcs).toEqual([2, 9]);
  });

  it('isSubsetOf and isSupersetOf', () => {
    const triad = new PitchClassSet([0, 4, 7]);
    const scale = new PitchClassSet([0, 2, 4, 5, 7, 9, 11]);
    expect(triad.isSubsetOf(scale)).toBe(true);
    expect(scale.isSupersetOf(triad)).toBe(true);
    expect(scale.isSubsetOf(triad)).toBe(false);
  });
});

describe('Forte Catalog', () => {
  it('spot-check trichords', () => {
    expect(FORTE_CATALOG['0,1,2']!.name).toBe('3-1');
    expect(FORTE_CATALOG['0,1,3']!.name).toBe('3-2');
    expect(FORTE_CATALOG['0,1,4']!.name).toBe('3-3');
    expect(FORTE_CATALOG['0,3,7']!.name).toBe('3-11');
    expect(FORTE_CATALOG['0,4,8']!.name).toBe('3-12');
  });

  it('spot-check tetrachords', () => {
    expect(FORTE_CATALOG['0,1,2,3']!.name).toBe('4-1');
    expect(FORTE_CATALOG['0,1,3,4']!.name).toBe('4-3');
    expect(FORTE_CATALOG['0,3,6,9']!.name).toBe('4-28');
  });

  it('spot-check pentachords', () => {
    expect(FORTE_CATALOG['0,2,4,7,9']!.name).toBe('5-35');
  });

  it('spot-check hexachords', () => {
    expect(FORTE_CATALOG['0,2,4,6,8,10']!.name).toBe('6-35');
  });

  it('spot-check heptachords', () => {
    expect(FORTE_CATALOG['0,1,3,5,6,8,10']!.name).toBe('7-35');
  });

  it('spot-check octachords', () => {
    expect(FORTE_CATALOG['0,1,2,3,4,5,6,7']!.name).toBe('8-1');
    expect(FORTE_CATALOG['0,1,3,4,6,7,9,10']!.name).toBe('8-28');
  });

  it('spot-check nonachords', () => {
    expect(FORTE_CATALOG['0,1,2,3,4,5,6,7,8']!.name).toBe('9-1');
    expect(FORTE_CATALOG['0,1,2,4,5,6,8,9,10']!.name).toBe('9-12');
  });

  it('reverse lookup matches forward lookup', () => {
    for (const [key, entry] of Object.entries(FORTE_CATALOG)) {
      const reverseResult = FORTE_BY_NAME[entry.name];
      expect(reverseResult).toBeDefined();
      expect(reverseResult!.join(',')).toBe(key);
    }
  });
});

describe('Scales and Chords', () => {
  it('major scale has correct pitch classes', () => {
    const major = SCALE_CATALOG.find(s => s.name === 'Ionian');
    expect(major).toBeDefined();
    expect(major!.pcs.pcs).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('all 7 diatonic modes are rotations', () => {
    const major = SCALE_CATALOG.find(s => s.name === 'Ionian')!;
    for (let d = 1; d <= 6; d++) {
      const mode = modeRotation(major, d);
      expect(mode.pcs.size).toBe(7);
    }
  });

  it('chord identification: major triad', () => {
    const pcs = new PitchClassSet([0, 4, 7]);
    const result = chordFromPcs(pcs);
    expect(result).not.toBeNull();
    expect(result!.chord.name).toBe('major');
  });

  it('chord identification: minor triad', () => {
    const pcs = new PitchClassSet([0, 3, 7]);
    const result = chordFromPcs(pcs);
    expect(result).not.toBeNull();
    expect(result!.chord.name).toBe('minor');
  });

  it('chord from name', () => {
    const result = chordFromName('Cmaj7');
    expect(result).toBeDefined();
  });
});

describe('Tuning Systems', () => {
  it('12-TET matches standard A4=440', () => {
    expect(frequencyFromTuning(TET_12, 9, 4)).toBeCloseTo(440, 1);
  });

  it('12-TET: octave is exactly 2:1', () => {
    const a4 = frequencyFromTuning(TET_12, 9, 4);
    const a5 = frequencyFromTuning(TET_12, 9, 5);
    expect(a5 / a4).toBeCloseTo(2.0, 10);
  });

  it('19-TET produces 19 steps per octave', () => {
    expect(TET_19.stepsPerOctave).toBe(19);
  });

  it('just intonation: perfect fifth is 3:2 ratio', () => {
    const root = frequencyFromTuning(JUST_5_LIMIT, 0, 4);
    const fifth = frequencyFromTuning(JUST_5_LIMIT, 7, 4);
    expect(fifth / root).toBeCloseTo(1.5, 3);
  });

  it('centsDeviation: 12-TET has 0 deviation', () => {
    for (let step = 0; step < 12; step++) {
      expect(Math.abs(centsDeviation(TET_12, step))).toBeLessThan(0.01);
    }
  });
});
