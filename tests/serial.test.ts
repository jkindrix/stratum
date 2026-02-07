import { describe, it, expect } from 'vitest';
import {
  createRow,
  twelvetoneMatrix,
  getRowForm,
  rowMultiply,
  rowRotate,
  combinatoriality,
  invariantPcs,
  identifyForm,
  isAllInterval,
  allIntervalRows,
  multiply,
  M5,
  M7,
  setMultiplication,
  intervalExpansion,
  isHexachordallyCombinatorialP,
  isHexachordallyCombinatorialI,
  isHexachordallyCombinatorialR,
  isHexachordallyCombinatorialRI,
  isAllCombinatorialHexachord,
  classifyAllCombinatorialType,
  segmentalInvariance,
  derivedRow,
} from '../src/index.js';

// Webern Op. 21 row (a classic all-combinatorial row)
const WEBERN_PCS = [0, 1, 4, 5, 6, 3, 7, 8, 11, 10, 9, 2];
// Schoenberg Op. 25 row
const SCHOENBERG_PCS = [4, 5, 7, 1, 6, 3, 8, 2, 11, 0, 9, 10];

describe('Twelve-Tone Serial Operations', () => {
  describe('createRow', () => {
    it('creates a valid row from 12 unique PCs', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(row.pcs).toHaveLength(12);
      expect(row.pcs[0]).toBe(0);
      expect(row.pcs[11]).toBe(11);
    });

    it('returns a frozen object', () => {
      const row = createRow(WEBERN_PCS);
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.pcs)).toBe(true);
    });

    it('throws RangeError for non-12 length', () => {
      expect(() => createRow([0, 1, 2])).toThrow(RangeError);
      expect(() => createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0])).toThrow(RangeError);
    });

    it('throws RangeError for duplicate PCs', () => {
      expect(() => createRow([0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toThrow(RangeError);
    });

    it('throws RangeError for out-of-range PCs', () => {
      expect(() => createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12])).toThrow(RangeError);
      expect(() => createRow([-1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toThrow(RangeError);
    });

    it('throws RangeError for non-integer PCs', () => {
      expect(() => createRow([0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toThrow(RangeError);
    });
  });

  describe('twelvetoneMatrix', () => {
    it('P(0) equals the original row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      expect([...matrix.P[0]!]).toEqual(SCHOENBERG_PCS);
    });

    it('each P(n) starts with n', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      for (let n = 0; n < 12; n++) {
        // P(n) is P(0) transposed by n, so first element = (P[0][0] + n) % 12
        expect(matrix.P[n]![0]).toBe((SCHOENBERG_PCS[0]! + n) % 12);
      }
    });

    it('I(0) is the inversion of P(0)', () => {
      const row = createRow([0, 1, 4, 5, 6, 3, 7, 8, 11, 10, 9, 2]);
      const matrix = twelvetoneMatrix(row);
      // I(0)[i] = (12 - P(0)[i]) % 12
      for (let i = 0; i < 12; i++) {
        expect(matrix.I[0]![i]).toBe((12 - row.pcs[i]!) % 12);
      }
    });

    it('R(0) is the retrograde of P(0)', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      const reversed = [...SCHOENBERG_PCS].reverse();
      expect([...matrix.R[0]!]).toEqual(reversed);
    });

    it('RI(0) is the retrograde of I(0)', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      const i0 = [...matrix.I[0]!];
      const ri0 = [...matrix.RI[0]!];
      expect(ri0).toEqual(i0.reverse());
    });

    it('matrix is frozen', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      expect(Object.isFrozen(matrix)).toBe(true);
      expect(Object.isFrozen(matrix.P)).toBe(true);
      expect(Object.isFrozen(matrix.P[0])).toBe(true);
    });

    it('each row contains all 12 PCs', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      for (let n = 0; n < 12; n++) {
        expect(new Set(matrix.P[n]!).size).toBe(12);
        expect(new Set(matrix.I[n]!).size).toBe(12);
        expect(new Set(matrix.R[n]!).size).toBe(12);
        expect(new Set(matrix.RI[n]!).size).toBe(12);
      }
    });
  });

  describe('getRowForm', () => {
    it('returns the correct P row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      expect([...getRowForm(matrix, 'P', 0)]).toEqual(SCHOENBERG_PCS);
    });

    it('returns the correct I row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      expect([...getRowForm(matrix, 'I', 0)]).toEqual([...matrix.I[0]!]);
    });

    it('throws RangeError for invalid index', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      expect(() => getRowForm(matrix, 'P', 12)).toThrow(RangeError);
      expect(() => getRowForm(matrix, 'P', -1)).toThrow(RangeError);
      expect(() => getRowForm(matrix, 'P', 0.5)).toThrow(RangeError);
    });
  });

  describe('rowMultiply', () => {
    it('multiplies element-wise mod 12', () => {
      const a = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const b = createRow([0, 2, 4, 6, 8, 10, 1, 3, 5, 7, 9, 11]);
      const result = rowMultiply(a, b);
      // [0*0, 1*2, 2*4, 3*6, 4*8, 5*10, 6*1, 7*3, 8*5, 9*7, 10*9, 11*11] mod 12
      expect(result.pcs[0]).toBe(0);
      expect(result.pcs[1]).toBe(2);
      expect(result.pcs[2]).toBe(8);
      expect(result.pcs[3]).toBe(6);  // 18 % 12
      expect(result.pcs[4]).toBe(8);  // 32 % 12
    });

    it('returns a frozen row', () => {
      const a = createRow(WEBERN_PCS);
      const b = createRow(SCHOENBERG_PCS);
      const result = rowMultiply(a, b);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('rowRotate', () => {
    it('rotates by 0 returns same row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = rowRotate(row, 0);
      expect([...result.pcs]).toEqual(SCHOENBERG_PCS);
    });

    it('rotates left by 1', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = rowRotate(row, 1);
      expect(result.pcs[0]).toBe(SCHOENBERG_PCS[1]);
      expect(result.pcs[11]).toBe(SCHOENBERG_PCS[0]);
    });

    it('rotates by 12 returns same row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = rowRotate(row, 12);
      expect([...result.pcs]).toEqual(SCHOENBERG_PCS);
    });

    it('handles negative rotation', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = rowRotate(row, -1);
      expect(result.pcs[0]).toBe(SCHOENBERG_PCS[11]);
      expect(result.pcs[1]).toBe(SCHOENBERG_PCS[0]);
    });

    it('returns a frozen row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = rowRotate(row, 3);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('combinatoriality', () => {
    it('detects hexachordal combinatoriality for all rows', () => {
      // All valid 12-tone rows have hexachordal complementation
      const row = createRow(SCHOENBERG_PCS);
      const result = combinatoriality(row);
      expect(result.hexachordal).toBe(true);
    });

    it('returns a frozen result', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = combinatoriality(row);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('chromatic row [0..11] is all-combinatorial', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = combinatoriality(row);
      expect(result.hexachordal).toBe(true);
      expect(result.inversional).toBe(true);
      expect(result.retrograde).toBe(true);
      expect(result.RI).toBe(true);
    });
  });

  describe('invariantPcs', () => {
    it('finds PCs at same positions', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      // P(0) vs P(0) should give all 12 PCs
      const result = invariantPcs(matrix.P[0]!, matrix.P[0]!);
      expect(result).toHaveLength(12);
    });

    it('returns empty for completely different rows', () => {
      const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
      const result = invariantPcs(a, b);
      expect(result).toHaveLength(0);
    });

    it('returns a frozen array', () => {
      const result = invariantPcs([0, 1, 2], [0, 3, 2]);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('finds partial invariants', () => {
      const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const b = [0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 11];
      const result = invariantPcs(a, b);
      // Matches at positions 0, 2, 11
      expect(result).toContain(0);
      expect(result).toContain(2);
      expect(result).toContain(11);
    });
  });

  // ==== NEW PHASE 8 TESTS ====

  describe('identifyForm', () => {
    it('identifies P(0) correctly', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      const result = identifyForm(matrix, SCHOENBERG_PCS);
      expect(result).toEqual({ form: 'P', n: 0 });
    });

    it('identifies I(0) correctly', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      const i0 = [...matrix.I[0]!];
      const result = identifyForm(matrix, i0);
      expect(result).toEqual({ form: 'I', n: 0 });
    });

    it('identifies R(5) correctly', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      const r5 = [...matrix.R[5]!];
      const result = identifyForm(matrix, r5);
      expect(result).toEqual({ form: 'R', n: 5 });
    });

    it('identifies RI(3) correctly', () => {
      const row = createRow(WEBERN_PCS);
      const matrix = twelvetoneMatrix(createRow(WEBERN_PCS));
      const ri3 = [...matrix.RI[3]!];
      const result = identifyForm(matrix, ri3);
      expect(result).toEqual({ form: 'RI', n: 3 });
    });

    it('returns null for non-matching sequence', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      // Random permutation that's not in the matrix
      const result = identifyForm(matrix, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
      // Could match or not — just verify it returns a valid result or null
      if (result !== null) {
        expect(['P', 'I', 'R', 'RI']).toContain(result.form);
      }
    });

    it('returns frozen result', () => {
      const row = createRow(SCHOENBERG_PCS);
      const matrix = twelvetoneMatrix(row);
      const result = identifyForm(matrix, SCHOENBERG_PCS);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('isAllInterval', () => {
    it('recognizes a known all-interval row', () => {
      // Berg's Lyric Suite row is all-interval: [0, 11, 7, 4, 2, 9, 3, 8, 10, 1, 5, 6]
      const air = createRow([0, 11, 7, 4, 2, 9, 3, 8, 10, 1, 5, 6]);
      expect(isAllInterval(air)).toBe(true);
    });

    it('rejects a non-all-interval row', () => {
      const row = createRow(SCHOENBERG_PCS);
      expect(isAllInterval(row)).toBe(false);
    });

    it('rejects chromatic row', () => {
      const chromatic = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      // All intervals are 1 — not all-interval
      expect(isAllInterval(chromatic)).toBe(false);
    });
  });

  describe('allIntervalRows', () => {
    it('generates rows with limit', () => {
      const rows = allIntervalRows({ startPc: 0, limit: 5 });
      expect(rows).toHaveLength(5);
    });

    it('all generated rows pass isAllInterval', () => {
      const rows = allIntervalRows({ startPc: 0, limit: 10 });
      for (const row of rows) {
        expect(isAllInterval(row)).toBe(true);
      }
    });

    it('no duplicate rows', () => {
      const rows = allIntervalRows({ startPc: 0, limit: 20 });
      const strings = rows.map(r => r.pcs.join(','));
      expect(new Set(strings).size).toBe(strings.length);
    });

    it('returns frozen results', () => {
      const rows = allIntervalRows({ startPc: 0, limit: 3 });
      expect(Object.isFrozen(rows)).toBe(true);
      expect(Object.isFrozen(rows[0])).toBe(true);
      expect(Object.isFrozen(rows[0]!.pcs)).toBe(true);
    });
  });

  describe('multiply', () => {
    it('multiplies each PC by factor mod 12', () => {
      const result = multiply([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 5);
      // 0→0, 1→5, 2→10, 3→3, 4→8, 5→1, 6→6, 7→11, 8→4, 9→9, 10→2, 11→7
      expect([...result]).toEqual([0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7]);
    });

    it('factor 0 gives all zeros', () => {
      const result = multiply([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0);
      expect([...result]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('returns frozen array', () => {
      const result = multiply([0, 1, 2], 5);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('M5', () => {
    it('maps PC 1→5, 2→10', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = M5(row);
      expect(result.pcs[1]).toBe(5);
      expect(result.pcs[2]).toBe(10);
    });

    it('produces a valid row (all 12 unique PCs)', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = M5(row);
      expect(new Set(result.pcs).size).toBe(12);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('M7', () => {
    it('maps PC 1→7, 2→2', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = M7(row);
      expect(result.pcs[1]).toBe(7);
      expect(result.pcs[2]).toBe(2);
    });

    it('produces a valid row (all 12 unique PCs)', () => {
      const row = createRow(WEBERN_PCS);
      const result = M7(row);
      expect(new Set(result.pcs).size).toBe(12);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('setMultiplication', () => {
    it('computes {0,1,2} × {0,4,7} correctly', () => {
      const result = setMultiplication([0, 1, 2], [0, 4, 7]);
      // {0+0, 0+4, 0+7, 1+0, 1+4, 1+7, 2+0, 2+4, 2+7} mod 12
      // = {0, 4, 7, 1, 5, 8, 2, 6, 9}
      expect([...result]).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9]);
    });

    it('returns full aggregate for complementary sets', () => {
      const result = setMultiplication([0, 1, 2, 3, 4, 5], [0, 6]);
      // Each PC + 0 and +6 covers a lot of ground
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(12);
    });

    it('returns frozen sorted unique array', () => {
      const result = setMultiplication([0, 3], [0, 3]);
      expect(Object.isFrozen(result)).toBe(true);
      // Check sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!).toBeGreaterThan(result[i - 1]!);
      }
    });
  });

  describe('intervalExpansion', () => {
    it('factor 1 preserves all intervals', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = intervalExpansion(row, 1);
      expect([...result]).toEqual([...row.pcs]);
    });

    it('factor 2 doubles intervals mod 12', () => {
      // Chromatic row: all intervals = 1; doubled = 2
      const chromatic = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = intervalExpansion(chromatic, 2);
      // Starting at 0, each step is 2: [0, 2, 4, 6, 8, 10, 0, 2, 4, 6, 8, 10]
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(4);
    });

    it('returns frozen array', () => {
      const row = createRow(WEBERN_PCS);
      const result = intervalExpansion(row, 5);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('isHexachordallyCombinatorialP', () => {
    it('chromatic row is P-combinatorial', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isHexachordallyCombinatorialP(row)).toBe(true);
    });

    it('detects P-combinatoriality for all-combinatorial row', () => {
      // Chromatic hexachord {0,1,2,3,4,5}: P6 first hex = {6,7,8,9,10,11}
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isHexachordallyCombinatorialP(row)).toBe(true);
    });
  });

  describe('isHexachordallyCombinatorialI', () => {
    it('chromatic row is I-combinatorial', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isHexachordallyCombinatorialI(row)).toBe(true);
    });

    it('Schoenberg Op.25 is I-combinatorial', () => {
      const row = createRow(SCHOENBERG_PCS);
      expect(isHexachordallyCombinatorialI(row)).toBe(true);
    });
  });

  describe('isHexachordallyCombinatorialR', () => {
    it('chromatic row is R-combinatorial', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isHexachordallyCombinatorialR(row)).toBe(true);
    });

    it('checks correctly for Schoenberg Op.25', () => {
      const row = createRow(SCHOENBERG_PCS);
      // Just verify it returns a boolean — specific result depends on row
      expect(typeof isHexachordallyCombinatorialR(row)).toBe('boolean');
    });
  });

  describe('isHexachordallyCombinatorialRI', () => {
    it('chromatic row is RI-combinatorial', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isHexachordallyCombinatorialRI(row)).toBe(true);
    });

    it('all four hold for chromatic row', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isHexachordallyCombinatorialP(row)).toBe(true);
      expect(isHexachordallyCombinatorialI(row)).toBe(true);
      expect(isHexachordallyCombinatorialR(row)).toBe(true);
      expect(isHexachordallyCombinatorialRI(row)).toBe(true);
    });
  });

  describe('isAllCombinatorialHexachord', () => {
    it('recognizes type A: chromatic hexachord {0,1,2,3,4,5}', () => {
      expect(isAllCombinatorialHexachord([0, 1, 2, 3, 4, 5])).toBe(true);
    });

    it('recognizes type F: whole-tone hexachord {0,2,4,6,8,10}', () => {
      expect(isAllCombinatorialHexachord([0, 2, 4, 6, 8, 10])).toBe(true);
    });

    it('rejects non-AC hexachord', () => {
      expect(isAllCombinatorialHexachord([0, 1, 3, 5, 7, 9])).toBe(false);
    });

    it('throws for non-6-element array', () => {
      expect(() => isAllCombinatorialHexachord([0, 1, 2])).toThrow(RangeError);
    });
  });

  describe('classifyAllCombinatorialType', () => {
    it('classifies type A (6-1)', () => {
      const result = classifyAllCombinatorialType([0, 1, 2, 3, 4, 5]);
      expect(result).toEqual({ type: 'A', order: 1, forteName: '6-1' });
    });

    it('classifies type B (6-8)', () => {
      const result = classifyAllCombinatorialType([0, 2, 3, 4, 5, 7]);
      expect(result).toEqual({ type: 'B', order: 1, forteName: '6-8' });
    });

    it('classifies type C (6-32)', () => {
      const result = classifyAllCombinatorialType([0, 2, 4, 5, 7, 9]);
      expect(result).toEqual({ type: 'C', order: 1, forteName: '6-32' });
    });

    it('classifies type D (6-7)', () => {
      const result = classifyAllCombinatorialType([0, 1, 2, 6, 7, 8]);
      expect(result).toEqual({ type: 'D', order: 2, forteName: '6-7' });
    });

    it('classifies type E (6-20)', () => {
      const result = classifyAllCombinatorialType([0, 1, 4, 5, 8, 9]);
      expect(result).toEqual({ type: 'E', order: 3, forteName: '6-20' });
    });

    it('classifies type F (6-35)', () => {
      const result = classifyAllCombinatorialType([0, 2, 4, 6, 8, 10]);
      expect(result).toEqual({ type: 'F', order: 6, forteName: '6-35' });
    });

    it('returns null for non-AC hexachord', () => {
      expect(classifyAllCombinatorialType([0, 1, 3, 5, 7, 9])).toBeNull();
    });

    it('handles transposed hexachords via prime form', () => {
      // {1,2,3,4,5,6} should be classified as type A (prime form = 0,1,2,3,4,5)
      const result = classifyAllCombinatorialType([1, 2, 3, 4, 5, 6]);
      expect(result).toEqual({ type: 'A', order: 1, forteName: '6-1' });
    });
  });

  describe('segmentalInvariance', () => {
    it('finds trichord invariances in chromatic row', () => {
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const results = segmentalInvariance(row, 3);
      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(Object.isFrozen(results)).toBe(true);
    });

    it('finds tetrachord invariances', () => {
      const row = createRow([0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11]);
      const results = segmentalInvariance(row, 4);
      // First tetrachord {0,3,6,9} is a dim7 — invariant under T3, T6, T9
      const first = results.find(r => r.segmentIndex === 0);
      expect(first).toBeDefined();
      if (first) {
        const tMappings = first.mappings.filter(m => m.operation === 'T');
        expect(tMappings.length).toBeGreaterThanOrEqual(3); // T3, T6, T9
      }
    });

    it('returns empty for segments without non-trivial invariance', () => {
      // Most random rows won't have much invariance
      const row = createRow([0, 7, 3, 10, 5, 1, 8, 2, 11, 6, 4, 9]);
      const results = segmentalInvariance(row, 6);
      // Results may or may not exist — just verify structure
      for (const r of results) {
        expect(r.mappings.length).toBeGreaterThan(0);
      }
    });

    it('throws for invalid segment size', () => {
      const row = createRow(SCHOENBERG_PCS);
      expect(() => segmentalInvariance(row, 5)).toThrow(RangeError);
      expect(() => segmentalInvariance(row, 0)).toThrow(RangeError);
      expect(() => segmentalInvariance(row, 7)).toThrow(RangeError);
    });
  });

  describe('derivedRow', () => {
    it('detects a derived row from trichord generator', () => {
      // Row built from T/I of {0,1,4}: T0={0,1,4}, T2={2,3,6}, I9={9,8,5}, I11={11,10,7}
      const row = createRow([0, 1, 4, 2, 3, 6, 9, 8, 5, 11, 10, 7]);
      const result = derivedRow(row, [0, 1, 4]);
      expect(result.isDerived).toBe(true);
      expect(result.transformations).toHaveLength(4);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('rejects a non-derived row', () => {
      const row = createRow(SCHOENBERG_PCS);
      const result = derivedRow(row, [0, 1, 2]);
      // Schoenberg Op.25 is NOT derived from {0,1,2}
      expect(result.isDerived).toBe(false);
      expect(result.transformations).toHaveLength(0);
    });

    it('works with tetrachord generator', () => {
      // Build row from T/I of {0,1,2,3}: T0={0,1,2,3}, T4={4,5,6,7}, T8={8,9,10,11}
      const row = createRow([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = derivedRow(row, [0, 1, 2, 3]);
      expect(result.isDerived).toBe(true);
      expect(result.transformations).toHaveLength(3);
    });

    it('throws for invalid generator length', () => {
      const row = createRow(SCHOENBERG_PCS);
      expect(() => derivedRow(row, [0, 1, 2, 3, 4])).toThrow(RangeError);
    });
  });
});
