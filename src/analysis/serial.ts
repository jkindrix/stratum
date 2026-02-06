// ---------------------------------------------------------------------------
// Stratum — Twelve-Tone Matrix & Serial Operations
// ---------------------------------------------------------------------------

/** A twelve-tone row: an ordered sequence of all 12 pitch classes. */
export interface TwelveToneRow {
  readonly pcs: readonly number[];
}

/** The complete 12×12 matrix of prime, inversion, retrograde, and RI forms. */
export interface TwelveToneMatrix {
  readonly P: readonly (readonly number[])[];
  readonly I: readonly (readonly number[])[];
  readonly R: readonly (readonly number[])[];
  readonly RI: readonly (readonly number[])[];
}

/** Row form identifier. */
export type RowForm = 'P' | 'I' | 'R' | 'RI';

// ---- Validation ----

function validateRow(pcs: readonly number[]): void {
  if (pcs.length !== 12) {
    throw new RangeError(`row must contain exactly 12 pitch classes (got ${pcs.length})`);
  }
  const seen = new Set<number>();
  for (let i = 0; i < 12; i++) {
    const pc = pcs[i]!;
    if (!Number.isInteger(pc) || pc < 0 || pc > 11) {
      throw new RangeError(`pitch class must be an integer 0-11 (got ${pc})`);
    }
    if (seen.has(pc)) {
      throw new RangeError(`duplicate pitch class ${pc} in row`);
    }
    seen.add(pc);
  }
}

function validateIndex(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n > 11) {
    throw new RangeError(`row index must be an integer 0-11 (got ${n})`);
  }
}

// ---- Public API ----

/**
 * Create a validated twelve-tone row from an array of pitch classes.
 *
 * @param pcs - Array of 12 unique pitch classes (0-11).
 * @returns Frozen TwelveToneRow.
 * @throws {RangeError} If pcs.length !== 12, duplicates exist, or values out of range.
 */
export function createRow(pcs: number[]): TwelveToneRow {
  validateRow(pcs);
  return Object.freeze({ pcs: Object.freeze([...pcs]) });
}

/**
 * Build the 12×12 twelve-tone matrix from a row.
 *
 * P(0) is the original row. P(n) transposes P(0) by n semitones.
 * I(0) inverts P(0). R(n) is the retrograde of P(n). RI(n) is the retrograde of I(n).
 *
 * @param row - A valid TwelveToneRow.
 * @returns Frozen TwelveToneMatrix with P, I, R, RI arrays.
 */
export function twelvetoneMatrix(row: TwelveToneRow): TwelveToneMatrix {
  const p0 = row.pcs;

  // Build P: P[n][i] = (P[0][i] + n) % 12
  const P: (readonly number[])[] = [];
  for (let n = 0; n < 12; n++) {
    const r: number[] = [];
    for (let i = 0; i < 12; i++) {
      r.push(((p0[i] ?? 0) + n) % 12);
    }
    P.push(Object.freeze(r));
  }

  // Build I: I[0][i] = (12 - P[0][i]) % 12, then I[n] transposes I[0]
  const i0: number[] = [];
  for (let i = 0; i < 12; i++) {
    i0.push((12 - (p0[i] ?? 0)) % 12);
  }
  const I: (readonly number[])[] = [];
  for (let n = 0; n < 12; n++) {
    const r: number[] = [];
    for (let i = 0; i < 12; i++) {
      r.push(((i0[i] ?? 0) + n) % 12);
    }
    I.push(Object.freeze(r));
  }

  // Build R: R[n] = reverse of P[n]
  const R: (readonly number[])[] = [];
  for (let n = 0; n < 12; n++) {
    R.push(Object.freeze([...(P[n] ?? [])].reverse()));
  }

  // Build RI: RI[n] = reverse of I[n]
  const RI: (readonly number[])[] = [];
  for (let n = 0; n < 12; n++) {
    RI.push(Object.freeze([...(I[n] ?? [])].reverse()));
  }

  return Object.freeze({
    P: Object.freeze(P),
    I: Object.freeze(I),
    R: Object.freeze(R),
    RI: Object.freeze(RI),
  });
}

/**
 * Retrieve a specific row form from the matrix.
 *
 * @param matrix - A TwelveToneMatrix.
 * @param form - 'P', 'I', 'R', or 'RI'.
 * @param n - Transposition level (0-11).
 * @returns The requested row as a frozen array of pitch classes.
 * @throws {RangeError} If n is not an integer 0-11.
 */
export function getRowForm(
  matrix: TwelveToneMatrix,
  form: RowForm,
  n: number,
): readonly number[] {
  validateIndex(n);
  return matrix[form][n]!;
}

/**
 * Boulez pitch-class multiplication of two rows.
 *
 * For each element a[i] in the first row, computes (a[i] * b[i]) mod 12.
 *
 * @param a - First twelve-tone row.
 * @param b - Second twelve-tone row.
 * @returns A new TwelveToneRow with the product.
 */
export function rowMultiply(a: TwelveToneRow, b: TwelveToneRow): TwelveToneRow {
  const result: number[] = [];
  for (let i = 0; i < 12; i++) {
    result.push(((a.pcs[i] ?? 0) * (b.pcs[i] ?? 0)) % 12);
  }
  return Object.freeze({ pcs: Object.freeze(result) });
}

/**
 * Circular rotation of a twelve-tone row.
 *
 * @param row - The row to rotate.
 * @param n - Number of positions to rotate (positive = left rotation).
 * @returns A new TwelveToneRow rotated by n positions.
 */
export function rowRotate(row: TwelveToneRow, n: number): TwelveToneRow {
  const len = row.pcs.length;
  const shift = ((n % len) + len) % len;
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    result.push(row.pcs[(i + shift) % len] ?? 0);
  }
  return Object.freeze({ pcs: Object.freeze(result) });
}

/**
 * Test combinatoriality properties of a twelve-tone row.
 *
 * Hexachordal combinatoriality: the first hexachord of P(0) and the first
 * hexachord of some I(n) together form the complete chromatic aggregate.
 *
 * @param row - A twelve-tone row.
 * @returns Object indicating which combinatorial properties hold.
 */
export function combinatoriality(row: TwelveToneRow): {
  hexachordal: boolean;
  inversional: boolean;
  retrograde: boolean;
  RI: boolean;
} {
  const matrix = twelvetoneMatrix(row);
  const h1 = new Set(row.pcs.slice(0, 6));

  // Hexachordal: first 6 PCs of P(0) and last 6 of P(0) are complementary
  // (always true by definition for valid rows, but check anyway)
  const h2 = new Set(row.pcs.slice(6));
  const hexachordal = h1.size === 6 && h2.size === 6 &&
    [...h1].every(pc => !h2.has(pc));

  // Inversional: exists n where first 6 of I(n) ∪ first 6 of P(0) = all 12
  let inversional = false;
  for (let n = 0; n < 12; n++) {
    const ih = new Set(matrix.I[n]!.slice(0, 6));
    const union = new Set([...h1, ...ih]);
    if (union.size === 12) {
      inversional = true;
      break;
    }
  }

  // Retrograde: exists n where first 6 of R(n) ∪ first 6 of P(0) = all 12
  let retrograde = false;
  for (let n = 0; n < 12; n++) {
    const rh = new Set(matrix.R[n]!.slice(0, 6));
    const union = new Set([...h1, ...rh]);
    if (union.size === 12) {
      retrograde = true;
      break;
    }
  }

  // RI: exists n where first 6 of RI(n) ∪ first 6 of P(0) = all 12
  let ri = false;
  for (let n = 0; n < 12; n++) {
    const rih = new Set(matrix.RI[n]!.slice(0, 6));
    const union = new Set([...h1, ...rih]);
    if (union.size === 12) {
      ri = true;
      break;
    }
  }

  return Object.freeze({ hexachordal, inversional, retrograde, RI: ri });
}

/**
 * Find pitch classes that appear at the same order positions in two row forms.
 *
 * @param rowA - First row form (array of 12 pitch classes).
 * @param rowB - Second row form (array of 12 pitch classes).
 * @returns Frozen array of pitch classes that coincide at the same positions.
 */
export function invariantPcs(
  rowA: readonly number[],
  rowB: readonly number[],
): readonly number[] {
  const result: number[] = [];
  const len = Math.min(rowA.length, rowB.length);
  for (let i = 0; i < len; i++) {
    if (rowA[i] === rowB[i]) {
      result.push(rowA[i]!);
    }
  }
  return Object.freeze(result);
}
