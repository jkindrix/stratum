import { describe, it, expect } from 'vitest';
import {
  buildKNet,
  kNetIsography,
  buildGIS,
  gisInterval,
  pitchClassGIS,
  pitchGIS,
  durationGIS,
} from '../src/index.js';

describe('Klumpenhouwer Networks', () => {
  // ── buildKNet ──────────────────────────────────────────────────────────

  describe('buildKNet', () => {
    it('creates valid trichord with T-arrows', () => {
      // C(0), E(4), G(7): T4 from 0→4, T3 from 4→7
      const knet = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'T', n: 3 },
      ]);
      expect(knet.nodes).toEqual([0, 4, 7]);
      expect(knet.arrows).toHaveLength(2);
    });

    it('creates valid K-net with I-arrows', () => {
      // C(0), E(4): I4 maps 0→4 since (4-0+12)%12 = 4
      const knet = buildKNet([0, 4], [
        { from: 0, to: 1, type: 'I', n: 4 },
      ]);
      expect(knet.nodes).toEqual([0, 4]);
      expect(knet.arrows[0]!.type).toBe('I');
    });

    it('creates valid K-net with mixed T and I arrows', () => {
      // nodes: 0, 4, 7
      // T4: 0→4, I11: 4→7 since (11-4+12)%12 = 7
      const knet = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 11 },
      ]);
      expect(knet.nodes).toHaveLength(3);
      expect(knet.arrows).toHaveLength(2);
    });

    it('returns frozen result', () => {
      const knet = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
      ]);
      expect(Object.isFrozen(knet)).toBe(true);
      expect(Object.isFrozen(knet.nodes)).toBe(true);
      expect(Object.isFrozen(knet.arrows)).toBe(true);
    });

    it('throws for out-of-range PC', () => {
      expect(() => buildKNet([0, 13], [])).toThrow(RangeError);
      expect(() => buildKNet([-1, 4], [])).toThrow(RangeError);
    });

    it('throws for invalid arrow index', () => {
      expect(() => buildKNet([0, 4], [
        { from: 0, to: 5, type: 'T', n: 4 },
      ])).toThrow(RangeError);
    });

    it('throws for inconsistent T-arrow', () => {
      // T4 from 0 should go to 4, not 7
      expect(() => buildKNet([0, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
      ])).toThrow(RangeError);
    });

    it('throws for inconsistent I-arrow', () => {
      // I4 from 0 should be (4-0)%12 = 4, not 7
      expect(() => buildKNet([0, 7], [
        { from: 0, to: 1, type: 'I', n: 4 },
      ])).toThrow(RangeError);
    });
  });

  // ── kNetIsography ──────────────────────────────────────────────────────

  describe('kNetIsography', () => {
    it('detects positive isography', () => {
      // K-net A: nodes [0, 4, 7], T4: 0→1, I11: 1→2
      const a = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 11 },
      ]);
      // K-net B: transposed by 2: [2, 6, 9], T4: 2→6, I13%12=1: 6→9 since (13-6+12)%12=7...
      // Actually: T4: (2+4)%12=6 ✓, I13→I1: (1-6+12)%12=7... no, (13-6+12)%12 = 19%12=7? No, n=13%12=1, (1-6+12)%12=7.
      // We need (n-6+12)%12 = 9. So n = (9+6)%12 = 3. Diff from a's I(11) = (3-11+12)%12 = 4.
      // Try: nodes [2,6,9], T4 from 0→1 (2+4=6 ✓), I with n=15%12=3 from 1→2 ((3-6+12)%12=9 ✓)
      const b = buildKNet([2, 6, 9], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 3 },
      ]);

      const result = kNetIsography(a, b);
      expect(result.positive).toBe(true);
      // T-labels same (4=4), I-label diff = (3-11+12)%12 = 4
      expect(result.positiveN).toBe(4);
    });

    it('detects strong isography (n=0)', () => {
      // Two identical K-nets = strong isography
      const a = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 11 },
      ]);
      const b = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 11 },
      ]);

      const result = kNetIsography(a, b);
      expect(result.strong).toBe(true);
      expect(result.positive).toBe(true);
      expect(result.positiveN).toBe(0);
    });

    it('detects negative isography', () => {
      // K-net A: T4, I11
      const a = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 11 },
      ]);
      // Negative: T-labels complementary → T8 (since (4+8)%12=0)
      // I-label sums constant: want (11 + b_I) % 12 = c for some constant
      // Need nodes consistent with T8: from node x, T8(x) = (x+8)%12
      // Let node0 = 0, then node1 = (0+8)%12 = 8
      // For I-arrow from 1→2: need n such that (n-8+12)%12 = node2
      // Let I-label sum = (11 + n) % 12 = c. Pick n=1, then c=0, node2 = (1-8+12)%12 = 5
      const b = buildKNet([0, 8, 5], [
        { from: 0, to: 1, type: 'T', n: 8 },
        { from: 1, to: 2, type: 'I', n: 1 },
      ]);

      const result = kNetIsography(a, b);
      expect(result.negative).toBe(true);
      expect(result.negativeN).toBe(0); // (11+1)%12 = 0
    });

    it('returns none for non-isographic K-nets', () => {
      const a = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'I', n: 11 },
      ]);
      // Different T-labels and non-complementary
      // T5 from 0→5, I with n: (n-5+12)%12 = 2 → n = 7
      const b = buildKNet([0, 5, 2], [
        { from: 0, to: 1, type: 'T', n: 5 },
        { from: 1, to: 2, type: 'I', n: 7 },
      ]);

      const result = kNetIsography(a, b);
      expect(result.positive).toBe(false);
      // (4+5)%12 = 9 ≠ 0, so not negative either
      expect(result.negative).toBe(false);
    });

    it('reports correct positiveN value', () => {
      // Two K-nets with only I-arrows
      const a = buildKNet([0, 4], [
        { from: 0, to: 1, type: 'I', n: 4 },
      ]);
      // I6: (6-0+12)%12 = 6... need node1=6
      const b = buildKNet([0, 6], [
        { from: 0, to: 1, type: 'I', n: 6 },
      ]);

      const result = kNetIsography(a, b);
      expect(result.positive).toBe(true);
      expect(result.positiveN).toBe(2); // (6-4+12)%12 = 2
    });

    it('reports correct negativeN value', () => {
      const a = buildKNet([0, 4], [
        { from: 0, to: 1, type: 'I', n: 4 },
      ]);
      const b = buildKNet([0, 8], [
        { from: 0, to: 1, type: 'I', n: 8 },
      ]);

      const result = kNetIsography(a, b);
      expect(result.negativeN).toBe(0); // (4+8)%12 = 0
    });

    it('returns frozen result', () => {
      const a = buildKNet([0, 4], [{ from: 0, to: 1, type: 'T', n: 4 }]);
      const b = buildKNet([0, 4], [{ from: 0, to: 1, type: 'T', n: 4 }]);
      const result = kNetIsography(a, b);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('throws for structural mismatch', () => {
      const a = buildKNet([0, 4], [{ from: 0, to: 1, type: 'T', n: 4 }]);
      const b = buildKNet([0, 4, 7], [
        { from: 0, to: 1, type: 'T', n: 4 },
        { from: 1, to: 2, type: 'T', n: 3 },
      ]);
      expect(() => kNetIsography(a, b)).toThrow(RangeError);
    });
  });
});

describe('Generalized Interval Systems', () => {
  // ── buildGIS ───────────────────────────────────────────────────────────

  describe('buildGIS', () => {
    it('creates GIS with elements and intervalFn', () => {
      const gis = buildGIS([1, 2, 3], (a, b) => b - a);
      expect(gis.elements).toEqual([1, 2, 3]);
      expect(gis.intervalFn(1, 3)).toBe(2);
    });

    it('returns frozen result', () => {
      const gis = buildGIS([1, 2], (a, b) => b - a);
      expect(Object.isFrozen(gis)).toBe(true);
      expect(Object.isFrozen(gis.elements)).toBe(true);
    });

    it('throws for empty elements', () => {
      expect(() => buildGIS([], (a, b) => b - a)).toThrow(RangeError);
    });
  });

  // ── gisInterval ────────────────────────────────────────────────────────

  describe('gisInterval', () => {
    it('PC GIS: C→E = 4', () => {
      const gis = pitchClassGIS();
      expect(gisInterval(gis, 0, 4)).toBe(4);
    });

    it('PC GIS: E→C = 8', () => {
      const gis = pitchClassGIS();
      expect(gisInterval(gis, 4, 0)).toBe(8);
    });

    it('pitch GIS: 60→64 = 4', () => {
      const gis = pitchGIS(0, 127);
      expect(gisInterval(gis, 60, 64)).toBe(4);
    });

    it('duration GIS: 1→2 = 2', () => {
      const gis = durationGIS([1, 2, 4]);
      expect(gisInterval(gis, 1, 2)).toBe(2);
    });
  });

  // ── pitchClassGIS ──────────────────────────────────────────────────────

  describe('pitchClassGIS', () => {
    it('has 12 elements', () => {
      const gis = pitchClassGIS();
      expect(gis.elements).toHaveLength(12);
      expect(gis.elements[0]).toBe(0);
      expect(gis.elements[11]).toBe(11);
    });

    it('satisfies transitivity: int(a,b) + int(b,c) ≡ int(a,c) mod 12', () => {
      const gis = pitchClassGIS();
      const a = 2, b = 7, c = 10;
      const ab = gisInterval(gis, a, b);
      const bc = gisInterval(gis, b, c);
      const ac = gisInterval(gis, a, c);
      expect((ab + bc) % 12).toBe(ac);
    });
  });

  // ── pitchGIS ───────────────────────────────────────────────────────────

  describe('pitchGIS', () => {
    it('creates over integer range', () => {
      const gis = pitchGIS(60, 72);
      expect(gis.elements).toHaveLength(13); // 60..72 inclusive
      expect(gis.elements[0]).toBe(60);
      expect(gis.elements[12]).toBe(72);
    });

    it('throws for low > high', () => {
      expect(() => pitchGIS(72, 60)).toThrow(RangeError);
    });
  });

  // ── durationGIS ────────────────────────────────────────────────────────

  describe('durationGIS', () => {
    it('creates over positive durations', () => {
      const gis = durationGIS([0.5, 1, 2, 4]);
      expect(gis.elements).toHaveLength(4);
      expect(gisInterval(gis, 0.5, 2)).toBe(4); // 2/0.5 = 4
    });

    it('throws for non-positive duration', () => {
      expect(() => durationGIS([1, 0, 2])).toThrow(RangeError);
      expect(() => durationGIS([-1, 2])).toThrow(RangeError);
    });
  });
});
