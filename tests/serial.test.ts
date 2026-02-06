import { describe, it, expect } from 'vitest';
import {
  createRow,
  twelvetoneMatrix,
  getRowForm,
  rowMultiply,
  rowRotate,
  combinatoriality,
  invariantPcs,
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
});
