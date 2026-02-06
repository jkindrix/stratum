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
} from '../src/index.js';
import type { Triad, NRTOperation } from '../src/index.js';

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
