import { describe, it, expect } from 'vitest';
import {
  nrtTransform,
  classifyNRT,
  nrtCompound,
  nrtPath,
  hexatonicCycle,
  octatonicCycle,
  hexatonicPole,
  weitzmannRegion,
  triadPitchClasses,
  seventhChordPitchClasses,
  nrt7Transform,
  classifyNRT7,
  nrt7Compound,
  nrt7Path,
} from '../src/index.js';
import type { Triad, NRTOperation, SeventhChord, SeventhChordQuality, NRT7Operation } from '../src/index.js';

const Cmaj: Triad = { root: 0, quality: 'major' };
const Cmin: Triad = { root: 0, quality: 'minor' };
const Amin: Triad = { root: 9, quality: 'minor' };
const Emin: Triad = { root: 4, quality: 'minor' };
const Abmaj: Triad = { root: 8, quality: 'major' };
const Gmaj: Triad = { root: 7, quality: 'major' };

function triadsEqual(a: Triad, b: Triad): boolean {
  return a.root === b.root && a.quality === b.quality;
}

describe('Neo-Riemannian Transforms', () => {
  describe('nrtTransform — P (Parallel)', () => {
    it('C major → C minor', () => {
      const result = nrtTransform(Cmaj, 'P');
      expect(result.root).toBe(0);
      expect(result.quality).toBe('minor');
    });

    it('C minor → C major', () => {
      const result = nrtTransform(Cmin, 'P');
      expect(result.root).toBe(0);
      expect(result.quality).toBe('major');
    });

    it('is an involution (P∘P = identity)', () => {
      const result = nrtTransform(nrtTransform(Cmaj, 'P'), 'P');
      expect(triadsEqual(result, Cmaj)).toBe(true);
    });
  });

  describe('nrtTransform — L (Leading-tone exchange)', () => {
    it('C major → E minor', () => {
      const result = nrtTransform(Cmaj, 'L');
      expect(result.root).toBe(4);
      expect(result.quality).toBe('minor');
    });

    it('A minor → F major', () => {
      const result = nrtTransform(Amin, 'L');
      expect(result.root).toBe(5);
      expect(result.quality).toBe('major');
    });

    it('is an involution (L∘L = identity)', () => {
      const result = nrtTransform(nrtTransform(Cmaj, 'L'), 'L');
      expect(triadsEqual(result, Cmaj)).toBe(true);
    });
  });

  describe('nrtTransform — R (Relative)', () => {
    it('C major → A minor', () => {
      const result = nrtTransform(Cmaj, 'R');
      expect(result.root).toBe(9);
      expect(result.quality).toBe('minor');
    });

    it('A minor → C major', () => {
      const result = nrtTransform(Amin, 'R');
      expect(result.root).toBe(0);
      expect(result.quality).toBe('major');
    });

    it('is an involution (R∘R = identity)', () => {
      const result = nrtTransform(nrtTransform(Gmaj, 'R'), 'R');
      expect(triadsEqual(result, Gmaj)).toBe(true);
    });
  });

  describe('classifyNRT', () => {
    it('C major → C minor = P', () => {
      expect(classifyNRT(Cmaj, Cmin)).toBe('P');
    });

    it('C major → E minor = L', () => {
      expect(classifyNRT(Cmaj, Emin)).toBe('L');
    });

    it('C major → A minor = R', () => {
      expect(classifyNRT(Cmaj, Amin)).toBe('R');
    });

    it('non-adjacent triads return null', () => {
      expect(classifyNRT(Cmaj, Abmaj)).toBeNull();
    });
  });

  describe('nrtCompound', () => {
    it('PL from C major → Ab major', () => {
      const result = nrtCompound(Cmaj, 'PL');
      expect(result.root).toBe(8);
      expect(result.quality).toBe('major');
    });

    it('RL from C major → F major', () => {
      // C major → R → A minor → L → F major
      const result = nrtCompound(Cmaj, 'RL');
      expect(result.root).toBe(5);
      expect(result.quality).toBe('major');
    });

    it('empty string returns same triad', () => {
      const result = nrtCompound(Cmaj, '');
      expect(triadsEqual(result, Cmaj)).toBe(true);
    });

    it('throws on invalid character', () => {
      expect(() => nrtCompound(Cmaj, 'PXL')).toThrow('Invalid NRT operation');
    });
  });

  describe('nrtPath', () => {
    it('identity path is empty', () => {
      expect(nrtPath(Cmaj, Cmaj)).toEqual([]);
    });

    it('direct neighbor: C major → C minor (P)', () => {
      const path = nrtPath(Cmaj, Cmin);
      expect(path).toEqual(['P']);
    });

    it('C major → A minor (R)', () => {
      const path = nrtPath(Cmaj, Amin);
      expect(path).toEqual(['R']);
    });

    it('C major → Ab major requires 2 steps (PL)', () => {
      const path = nrtPath(Cmaj, Abmaj);
      expect(path).toHaveLength(2);
      // Verify the path actually works
      let t: Triad = Cmaj;
      for (const op of path) {
        t = nrtTransform(t, op);
      }
      expect(triadsEqual(t, Abmaj)).toBe(true);
    });

    it('finds path between distant triads', () => {
      const fSharpMin: Triad = { root: 6, quality: 'minor' };
      const path = nrtPath(Cmaj, fSharpMin);
      expect(path.length).toBeGreaterThan(0);
      expect(path.length).toBeLessThanOrEqual(6); // max distance in PLR graph
      // Verify the path works
      let t: Triad = Cmaj;
      for (const op of path) {
        t = nrtTransform(t, op);
      }
      expect(triadsEqual(t, fSharpMin)).toBe(true);
    });

    it('path is shortest (never longer than 4 for any pair)', () => {
      // The PLR graph has diameter 4
      const Dbmaj: Triad = { root: 1, quality: 'major' };
      const path = nrtPath(Cmaj, Dbmaj);
      expect(path.length).toBeLessThanOrEqual(4);
    });
  });

  describe('hexatonicCycle', () => {
    it('produces 6 triads', () => {
      const cycle = hexatonicCycle(Cmaj);
      expect(cycle).toHaveLength(6);
    });

    it('starts with input triad', () => {
      const cycle = hexatonicCycle(Cmaj);
      expect(triadsEqual(cycle[0]!, Cmaj)).toBe(true);
    });

    it('alternates quality (major/minor)', () => {
      const cycle = hexatonicCycle(Cmaj);
      for (let i = 0; i < cycle.length; i++) {
        expect(cycle[i]!.quality).toBe(i % 2 === 0 ? 'major' : 'minor');
      }
    });

    it('C major cycle: C maj, C min, Ab maj, Ab min, E maj, E min', () => {
      const cycle = hexatonicCycle(Cmaj);
      expect(cycle[0]!.root).toBe(0);   // C major
      expect(cycle[1]!.root).toBe(0);   // C minor
      expect(cycle[2]!.root).toBe(8);   // Ab major
      expect(cycle[3]!.root).toBe(8);   // Ab minor
      expect(cycle[4]!.root).toBe(4);   // E major
      expect(cycle[5]!.root).toBe(4);   // E minor
    });

    it('PLPLPL returns to start', () => {
      const result = nrtCompound(Cmaj, 'PLPLPL');
      expect(triadsEqual(result, Cmaj)).toBe(true);
    });
  });

  describe('octatonicCycle', () => {
    it('produces 8 triads', () => {
      const cycle = octatonicCycle(Cmaj);
      expect(cycle).toHaveLength(8);
    });

    it('starts with input triad', () => {
      const cycle = octatonicCycle(Cmaj);
      expect(triadsEqual(cycle[0]!, Cmaj)).toBe(true);
    });

    it('PRPRPRPR returns to start', () => {
      const result = nrtCompound(Cmaj, 'PRPRPRPR');
      expect(triadsEqual(result, Cmaj)).toBe(true);
    });

    it('C major cycle roots: C, C, Eb, Eb, Gb, Gb, A, A', () => {
      const cycle = octatonicCycle(Cmaj);
      // PR generates: C maj → P → C min → R → Eb maj → P → Eb min → R → Gb maj → ...
      expect(cycle[0]!.root).toBe(0);   // C major
      expect(cycle[1]!.root).toBe(0);   // C minor
      expect(cycle[2]!.root).toBe(3);   // Eb major
      expect(cycle[3]!.root).toBe(3);   // Eb minor
      expect(cycle[4]!.root).toBe(6);   // Gb major
      expect(cycle[5]!.root).toBe(6);   // Gb minor
      expect(cycle[6]!.root).toBe(9);   // A major
      expect(cycle[7]!.root).toBe(9);   // A minor
    });
  });

  describe('hexatonicPole', () => {
    it('C major → Ab minor', () => {
      const pole = hexatonicPole(Cmaj);
      expect(pole.root).toBe(8);
      expect(pole.quality).toBe('minor');
    });

    it('E minor → Ab major', () => {
      // Cycle: E min → P → E maj → L → Ab min → P → Ab maj
      const pole = hexatonicPole(Emin);
      expect(pole.root).toBe(8);
      expect(pole.quality).toBe('major');
    });

    it('is an involution (double application returns to start)', () => {
      const pole1 = hexatonicPole(Cmaj);
      const pole2 = hexatonicPole(pole1);
      expect(triadsEqual(pole2, Cmaj)).toBe(true);
    });
  });

  describe('weitzmannRegion', () => {
    it('C augmented [0,4,8] yields 6 triads', () => {
      const region = weitzmannRegion([0, 4, 8]);
      expect(region).toHaveLength(6);
    });

    it('contains C major (move G# down to G)', () => {
      const region = weitzmannRegion([0, 4, 8]);
      const hasCmaj = region.some(t => t.root === 0 && t.quality === 'major');
      expect(hasCmaj).toBe(true);
    });

    it('contains E major (move C down to B)', () => {
      const region = weitzmannRegion([0, 4, 8]);
      const hasEmaj = region.some(t => t.root === 4 && t.quality === 'major');
      expect(hasEmaj).toBe(true);
    });

    it('contains Ab major (move E down to Eb)', () => {
      const region = weitzmannRegion([0, 4, 8]);
      const hasAbmaj = region.some(t => t.root === 8 && t.quality === 'major');
      expect(hasAbmaj).toBe(true);
    });

    it('contains 3 major and 3 minor triads', () => {
      const region = weitzmannRegion([0, 4, 8]);
      const majors = region.filter(t => t.quality === 'major');
      const minors = region.filter(t => t.quality === 'minor');
      expect(majors).toHaveLength(3);
      expect(minors).toHaveLength(3);
    });

    it('throws on non-augmented input', () => {
      expect(() => weitzmannRegion([0, 4, 7])).toThrow('augmented');
    });

    it('throws on wrong number of PCs', () => {
      expect(() => weitzmannRegion([0, 4])).toThrow('3 pitch classes');
    });
  });

  describe('triadPitchClasses', () => {
    it('C major → [0, 4, 7]', () => {
      expect(triadPitchClasses(Cmaj)).toEqual([0, 4, 7]);
    });

    it('C minor → [0, 3, 7]', () => {
      expect(triadPitchClasses(Cmin)).toEqual([0, 3, 7]);
    });

    it('A minor → [9, 0, 4]', () => {
      expect(triadPitchClasses(Amin)).toEqual([9, 0, 4]);
    });
  });
});

// ---------------------------------------------------------------------------
// Seventh-Chord NRT Tests
// ---------------------------------------------------------------------------

const ALL_7TH_QUALITIES: SeventhChordQuality[] = ['maj7', 'min7', 'dom7', 'hdim7', 'dim7', 'minMaj7'];

function seventh(root: number, quality: SeventhChordQuality): SeventhChord {
  return { root, quality };
}

describe('Seventh-Chord NRT', () => {
  // ---- seventhChordPitchClasses ----

  describe('seventhChordPitchClasses', () => {
    it('C maj7 → [0, 4, 7, 11]', () => {
      expect(seventhChordPitchClasses(seventh(0, 'maj7'))).toEqual([0, 4, 7, 11]);
    });

    it('C min7 → [0, 3, 7, 10]', () => {
      expect(seventhChordPitchClasses(seventh(0, 'min7'))).toEqual([0, 3, 7, 10]);
    });

    it('C dom7 → [0, 4, 7, 10]', () => {
      expect(seventhChordPitchClasses(seventh(0, 'dom7'))).toEqual([0, 4, 7, 10]);
    });

    it('C hdim7 → [0, 3, 6, 10]', () => {
      expect(seventhChordPitchClasses(seventh(0, 'hdim7'))).toEqual([0, 3, 6, 10]);
    });

    it('C dim7 → [0, 3, 6, 9]', () => {
      expect(seventhChordPitchClasses(seventh(0, 'dim7'))).toEqual([0, 3, 6, 9]);
    });

    it('C minMaj7 → [0, 3, 7, 11]', () => {
      expect(seventhChordPitchClasses(seventh(0, 'minMaj7'))).toEqual([0, 3, 7, 11]);
    });

    it('non-zero root wraps correctly (G dom7 → [7, 11, 2, 5])', () => {
      expect(seventhChordPitchClasses(seventh(7, 'dom7'))).toEqual([7, 11, 2, 5]);
    });

    it('throws RangeError for root out of range', () => {
      expect(() => seventhChordPitchClasses(seventh(-1, 'maj7'))).toThrow(RangeError);
      expect(() => seventhChordPitchClasses(seventh(12, 'maj7'))).toThrow(RangeError);
    });
  });

  // ---- nrt7Transform — P7 ----

  describe('nrt7Transform — P7', () => {
    it('dom7 → min7', () => {
      const result = nrt7Transform(seventh(0, 'dom7'), 'P7');
      expect(result).toEqual({ root: 0, quality: 'min7' });
    });

    it('min7 → dom7', () => {
      const result = nrt7Transform(seventh(0, 'min7'), 'P7');
      expect(result).toEqual({ root: 0, quality: 'dom7' });
    });

    it('maj7 → minMaj7', () => {
      const result = nrt7Transform(seventh(0, 'maj7'), 'P7');
      expect(result).toEqual({ root: 0, quality: 'minMaj7' });
    });

    it('minMaj7 → maj7', () => {
      const result = nrt7Transform(seventh(0, 'minMaj7'), 'P7');
      expect(result).toEqual({ root: 0, quality: 'maj7' });
    });

    it('returns null for hdim7', () => {
      expect(nrt7Transform(seventh(0, 'hdim7'), 'P7')).toBeNull();
    });

    it('returns null for dim7', () => {
      expect(nrt7Transform(seventh(0, 'dim7'), 'P7')).toBeNull();
    });
  });

  // ---- nrt7Transform — L7 ----

  describe('nrt7Transform — L7', () => {
    it('dom7 → maj7', () => {
      const result = nrt7Transform(seventh(0, 'dom7'), 'L7');
      expect(result).toEqual({ root: 0, quality: 'maj7' });
    });

    it('maj7 → dom7', () => {
      const result = nrt7Transform(seventh(0, 'maj7'), 'L7');
      expect(result).toEqual({ root: 0, quality: 'dom7' });
    });

    it('min7 → minMaj7', () => {
      const result = nrt7Transform(seventh(0, 'min7'), 'L7');
      expect(result).toEqual({ root: 0, quality: 'minMaj7' });
    });

    it('minMaj7 → min7', () => {
      const result = nrt7Transform(seventh(0, 'minMaj7'), 'L7');
      expect(result).toEqual({ root: 0, quality: 'min7' });
    });

    it('hdim7 → dim7', () => {
      const result = nrt7Transform(seventh(0, 'hdim7'), 'L7');
      expect(result).toEqual({ root: 0, quality: 'dim7' });
    });

    it('dim7 → hdim7', () => {
      const result = nrt7Transform(seventh(0, 'dim7'), 'L7');
      expect(result).toEqual({ root: 0, quality: 'hdim7' });
    });
  });

  // ---- nrt7Transform — R7 ----

  describe('nrt7Transform — R7', () => {
    it('min7 → hdim7', () => {
      const result = nrt7Transform(seventh(0, 'min7'), 'R7');
      expect(result).toEqual({ root: 0, quality: 'hdim7' });
    });

    it('hdim7 → min7', () => {
      const result = nrt7Transform(seventh(0, 'hdim7'), 'R7');
      expect(result).toEqual({ root: 0, quality: 'min7' });
    });

    it('returns null for dom7', () => {
      expect(nrt7Transform(seventh(0, 'dom7'), 'R7')).toBeNull();
    });

    it('returns null for maj7', () => {
      expect(nrt7Transform(seventh(0, 'maj7'), 'R7')).toBeNull();
    });
  });

  // ---- nrt7Transform — properties ----

  describe('nrt7Transform — properties', () => {
    it('P7 is an involution', () => {
      const start = seventh(5, 'dom7');
      const mid = nrt7Transform(start, 'P7')!;
      const back = nrt7Transform(mid, 'P7')!;
      expect(back.root).toBe(start.root);
      expect(back.quality).toBe(start.quality);
    });

    it('L7 is an involution', () => {
      const start = seventh(3, 'min7');
      const mid = nrt7Transform(start, 'L7')!;
      const back = nrt7Transform(mid, 'L7')!;
      expect(back.root).toBe(start.root);
      expect(back.quality).toBe(start.quality);
    });

    it('R7 is an involution', () => {
      const start = seventh(9, 'min7');
      const mid = nrt7Transform(start, 'R7')!;
      const back = nrt7Transform(mid, 'R7')!;
      expect(back.root).toBe(start.root);
      expect(back.quality).toBe(start.quality);
    });

    it('result is frozen', () => {
      const result = nrt7Transform(seventh(0, 'dom7'), 'P7')!;
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  // ---- classifyNRT7 ----

  describe('classifyNRT7', () => {
    it('dom7 → min7 = P7', () => {
      expect(classifyNRT7(seventh(0, 'dom7'), seventh(0, 'min7'))).toBe('P7');
    });

    it('dom7 → maj7 = L7', () => {
      expect(classifyNRT7(seventh(0, 'dom7'), seventh(0, 'maj7'))).toBe('L7');
    });

    it('min7 → hdim7 = R7', () => {
      expect(classifyNRT7(seventh(0, 'min7'), seventh(0, 'hdim7'))).toBe('R7');
    });

    it('non-adjacent same root returns null', () => {
      expect(classifyNRT7(seventh(0, 'dom7'), seventh(0, 'dim7'))).toBeNull();
    });

    it('different roots returns null', () => {
      expect(classifyNRT7(seventh(0, 'dom7'), seventh(5, 'dom7'))).toBeNull();
    });
  });

  // ---- nrt7Compound ----

  describe('nrt7Compound', () => {
    it('P7L7 chain: dom7 → min7 → minMaj7', () => {
      const result = nrt7Compound(seventh(0, 'dom7'), 'P7L7');
      expect(result).toEqual({ root: 0, quality: 'minMaj7' });
    });

    it('empty string returns input chord unchanged', () => {
      const input = seventh(0, 'dom7');
      const result = nrt7Compound(input, '');
      expect(result).toEqual(input);
    });

    it('returns null when a step is undefined', () => {
      // dom7 → R7 is undefined
      const result = nrt7Compound(seventh(0, 'dom7'), 'R7');
      expect(result).toBeNull();
    });

    it('throws Error on invalid token', () => {
      expect(() => nrt7Compound(seventh(0, 'dom7'), 'P7XL7')).toThrow(Error);
    });

    it('multi-step chain: dom7 → P7 → min7 → R7 → hdim7 → L7 → dim7', () => {
      const result = nrt7Compound(seventh(0, 'dom7'), 'P7R7L7');
      expect(result).toEqual({ root: 0, quality: 'dim7' });
    });

    it('throws on bare P/L/R without 7 suffix', () => {
      expect(() => nrt7Compound(seventh(0, 'dom7'), 'PL')).toThrow(Error);
    });
  });

  // ---- nrt7Path ----

  describe('nrt7Path', () => {
    it('identical chords → empty array', () => {
      expect(nrt7Path(seventh(0, 'dom7'), seventh(0, 'dom7'))).toEqual([]);
    });

    it('direct P7 neighbor: dom7 → min7', () => {
      const path = nrt7Path(seventh(0, 'dom7'), seventh(0, 'min7'));
      expect(path).toEqual(['P7']);
    });

    it('direct L7 neighbor: dom7 → maj7', () => {
      const path = nrt7Path(seventh(0, 'dom7'), seventh(0, 'maj7'));
      expect(path).toEqual(['L7']);
    });

    it('direct R7 neighbor: min7 → hdim7', () => {
      const path = nrt7Path(seventh(0, 'min7'), seventh(0, 'hdim7'));
      expect(path).toEqual(['R7']);
    });

    it('2-step path: dom7 → minMaj7 (P7L7)', () => {
      const path = nrt7Path(seventh(0, 'dom7'), seventh(0, 'minMaj7'));
      expect(path).toHaveLength(2);
      // Verify path works
      const result = nrt7Compound(seventh(0, 'dom7'), path.join(''));
      expect(result).toEqual({ root: 0, quality: 'minMaj7' });
    });

    it('max distance ≤ 4 for any pair within same root', () => {
      for (const q1 of ALL_7TH_QUALITIES) {
        for (const q2 of ALL_7TH_QUALITIES) {
          const path = nrt7Path(seventh(0, q1), seventh(0, q2));
          expect(path.length).toBeLessThanOrEqual(4);
        }
      }
    });

    it('different roots → empty array', () => {
      expect(nrt7Path(seventh(0, 'dom7'), seventh(5, 'dom7'))).toEqual([]);
    });

    it('non-C root works correctly', () => {
      const path = nrt7Path(seventh(7, 'dom7'), seventh(7, 'min7'));
      expect(path).toEqual(['P7']);
    });
  });

  // ---- Exhaustive reachability ----

  describe('exhaustive reachability', () => {
    it('all 30 quality pairs at root 0 are reachable via nrt7Path + nrt7Compound', () => {
      for (const q1 of ALL_7TH_QUALITIES) {
        for (const q2 of ALL_7TH_QUALITIES) {
          if (q1 === q2) continue;
          const from = seventh(0, q1);
          const to = seventh(0, q2);
          const path = nrt7Path(from, to);
          expect(path.length).toBeGreaterThan(0);
          const result = nrt7Compound(from, path.join(''));
          expect(result).toEqual({ root: 0, quality: q2 });
        }
      }
    });
  });
});
