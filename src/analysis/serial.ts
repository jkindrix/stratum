// ---------------------------------------------------------------------------
// Stratum — Twelve-Tone Matrix & Serial Operations
// ---------------------------------------------------------------------------

import { PitchClassSet } from '../pitch/pitch-class-set.js';

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

/** Result of identifying which form/transposition a sequence represents. */
export interface RowFormIdentification {
  readonly form: RowForm;
  readonly n: number;
}

/** Babbitt all-combinatorial hexachord type. */
export type AllCombinatorialType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** Classification result for an all-combinatorial hexachord. */
export interface AllCombinatorialClassification {
  readonly type: AllCombinatorialType;
  readonly order: 1 | 2 | 3 | 6;
  readonly forteName: string;
}

/** Options for generating all-interval rows. */
export interface AllIntervalRowOptions {
  readonly limit?: number;
  readonly startPc?: number;
}

/** A segment that maps to itself under some T/I operation. */
export interface SegmentalInvarianceResult {
  readonly segmentIndex: number;
  readonly segment: readonly number[];
  readonly mappings: readonly SegmentMapping[];
}

/** A single T or I mapping that preserves a segment's unordered PC content. */
export interface SegmentMapping {
  readonly operation: 'T' | 'I';
  readonly n: number;
}

/** Result of testing whether a row is derived from a generator. */
export interface DerivedRowResult {
  readonly isDerived: boolean;
  readonly generator: readonly number[];
  readonly transformations: readonly DerivedRowTransformation[];
}

/** A T/I transformation applied to a generator to produce one row segment. */
export interface DerivedRowTransformation {
  readonly segmentIndex: number;
  readonly operation: 'T' | 'I';
  readonly n: number;
}

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

function validatePcSequence(seq: readonly number[]): void {
  for (let i = 0; i < seq.length; i++) {
    const pc = seq[i]!;
    if (!Number.isInteger(pc) || pc < 0 || pc > 11) {
      throw new RangeError(`pitch class must be an integer 0-11 (got ${pc})`);
    }
  }
}

/** All-combinatorial hexachord lookup: prime form string → classification. */
const AC_HEXACHORDS: ReadonlyMap<string, AllCombinatorialClassification> = new Map<string, AllCombinatorialClassification>([
  ['0,1,2,3,4,5', Object.freeze({ type: 'A' as const, order: 1 as const, forteName: '6-1' })],
  ['0,2,3,4,5,7', Object.freeze({ type: 'B' as const, order: 1 as const, forteName: '6-8' })],
  ['0,2,4,5,7,9', Object.freeze({ type: 'C' as const, order: 1 as const, forteName: '6-32' })],
  ['0,1,2,6,7,8', Object.freeze({ type: 'D' as const, order: 2 as const, forteName: '6-7' })],
  ['0,1,4,5,8,9', Object.freeze({ type: 'E' as const, order: 3 as const, forteName: '6-20' })],
  ['0,2,4,6,8,10', Object.freeze({ type: 'F' as const, order: 6 as const, forteName: '6-35' })],
]);

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

// ---- Row Analysis (Section 7.7.1) ----

/**
 * Identify which row form and transposition level a sequence represents.
 *
 * @param matrix - A TwelveToneMatrix.
 * @param sequence - An ordered sequence of 12 pitch classes to identify.
 * @returns The form and transposition, or null if the sequence is not in the matrix.
 * @throws {RangeError} If sequence is not a valid 12-PC sequence.
 */
export function identifyForm(
  matrix: TwelveToneMatrix,
  sequence: readonly number[],
): RowFormIdentification | null {
  validateRow(sequence);
  const forms: RowForm[] = ['P', 'I', 'R', 'RI'];
  for (const form of forms) {
    for (let n = 0; n < 12; n++) {
      const candidate = matrix[form][n]!;
      let match = true;
      for (let i = 0; i < 12; i++) {
        if (candidate[i] !== sequence[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return Object.freeze({ form, n });
      }
    }
  }
  return null;
}

/**
 * Test whether a row is an all-interval row.
 *
 * An all-interval row has 11 successive directed intervals that form
 * a permutation of {1, 2, ..., 11}.
 *
 * @param row - A twelve-tone row.
 * @returns True if the row is an all-interval row.
 */
export function isAllInterval(row: TwelveToneRow): boolean {
  const seen = new Set<number>();
  for (let i = 0; i < 11; i++) {
    const interval = (((row.pcs[i + 1] ?? 0) - (row.pcs[i] ?? 0)) % 12 + 12) % 12;
    if (interval === 0 || seen.has(interval)) return false;
    seen.add(interval);
  }
  return seen.size === 11;
}

/**
 * Generate all-interval rows via backtracking search.
 *
 * @param options - Optional: startPc (default 0), limit (default unlimited).
 * @returns Frozen array of all-interval TwelveToneRows.
 */
export function allIntervalRows(options?: AllIntervalRowOptions): readonly TwelveToneRow[] {
  const startPc = options?.startPc ?? 0;
  const limit = options?.limit;
  if (!Number.isInteger(startPc) || startPc < 0 || startPc > 11) {
    throw new RangeError(`startPc must be an integer 0-11 (got ${startPc})`);
  }

  const results: TwelveToneRow[] = [];
  const pcs: number[] = [startPc];
  const usedPcs: boolean[] = Array.from({ length: 12 }, () => false);
  const usedIntervals: boolean[] = Array.from({ length: 12 }, () => false);
  usedPcs[startPc] = true;

  function backtrack(): void {
    if (limit !== undefined && results.length >= limit) return;
    if (pcs.length === 12) {
      results.push(Object.freeze({ pcs: Object.freeze([...pcs]) }));
      return;
    }
    for (let pc = 0; pc < 12; pc++) {
      if (usedPcs[pc]) continue;
      const interval = ((pc - (pcs[pcs.length - 1] ?? 0)) % 12 + 12) % 12;
      if (interval === 0 || usedIntervals[interval]) continue;
      pcs.push(pc);
      usedPcs[pc] = true;
      usedIntervals[interval] = true;
      backtrack();
      pcs.pop();
      usedPcs[pc] = false;
      usedIntervals[interval] = false;
    }
  }

  backtrack();
  return Object.freeze(results);
}

// ---- Serial Operations (Section 7.7.3) ----

/**
 * Multiply each pitch class in a sequence by a factor (mod 12).
 *
 * @param sequence - Array of pitch classes (0-11).
 * @param factor - Multiplication factor.
 * @returns Frozen array of multiplied PCs. May contain duplicates for non-coprime factors.
 */
export function multiply(sequence: readonly number[], factor: number): readonly number[] {
  validatePcSequence(sequence);
  const result: number[] = [];
  for (let i = 0; i < sequence.length; i++) {
    result.push((((sequence[i] ?? 0) * factor) % 12 + 12) % 12);
  }
  return Object.freeze(result);
}

/**
 * Apply M5 multiplication to a row (multiply each PC by 5 mod 12).
 * Since 5 is coprime to 12, the result is always a valid row.
 *
 * @param row - A twelve-tone row.
 * @returns A new TwelveToneRow with PCs multiplied by 5 mod 12.
 */
export function M5(row: TwelveToneRow): TwelveToneRow {
  const pcs = multiply(row.pcs, 5);
  return Object.freeze({ pcs });
}

/**
 * Apply M7 multiplication to a row (multiply each PC by 7 mod 12).
 * Since 7 is coprime to 12, the result is always a valid row.
 *
 * @param row - A twelve-tone row.
 * @returns A new TwelveToneRow with PCs multiplied by 7 mod 12.
 */
export function M7(row: TwelveToneRow): TwelveToneRow {
  const pcs = multiply(row.pcs, 7);
  return Object.freeze({ pcs });
}

/**
 * Boulez set multiplication (frequency multiplication).
 *
 * Computes {(a + b) mod 12 : a ∈ setA, b ∈ setB}, returning unique sorted PCs.
 *
 * @param setA - First set of pitch classes.
 * @param setB - Second set of pitch classes.
 * @returns Frozen sorted array of unique resulting PCs.
 */
export function setMultiplication(
  setA: readonly number[],
  setB: readonly number[],
): readonly number[] {
  validatePcSequence(setA);
  validatePcSequence(setB);
  const resultSet = new Set<number>();
  for (let i = 0; i < setA.length; i++) {
    for (let j = 0; j < setB.length; j++) {
      resultSet.add(((setA[i] ?? 0) + (setB[j] ?? 0)) % 12);
    }
  }
  const sorted = [...resultSet].sort((a, b) => a - b);
  return Object.freeze(sorted);
}

/**
 * Interval expansion: multiply successive intervals by a factor and reconstruct.
 *
 * @param row - A twelve-tone row.
 * @param factor - Factor to multiply each successive interval by (mod 12).
 * @returns Frozen array of resulting PCs (may contain duplicates).
 */
export function intervalExpansion(
  row: TwelveToneRow,
  factor: number,
): readonly number[] {
  const result: number[] = [row.pcs[0] ?? 0];
  for (let i = 0; i < 11; i++) {
    const interval = (((row.pcs[i + 1] ?? 0) - (row.pcs[i] ?? 0)) % 12 + 12) % 12;
    const expanded = (interval * factor % 12 + 12) % 12;
    const prev = result[result.length - 1] ?? 0;
    result.push((prev + expanded) % 12);
  }
  return Object.freeze(result);
}

// ---- Combinatoriality (Section 7.7.2) ----

/** Helper: check if first hexachord of P(0) and first hexachord of form(n) are complementary. */
function hexCombinatorialCheck(
  row: TwelveToneRow,
  formType: RowForm,
): boolean {
  const matrix = twelvetoneMatrix(row);
  const h1 = new Set(row.pcs.slice(0, 6));
  for (let n = 0; n < 12; n++) {
    const formHex = new Set(matrix[formType][n]!.slice(0, 6));
    const union = new Set([...h1, ...formHex]);
    if (union.size === 12) return true;
  }
  return false;
}

/**
 * Test P-combinatoriality: ∃n where first hexachord of P(0) ∪ first hexachord of P(n) = aggregate.
 */
export function isHexachordallyCombinatorialP(row: TwelveToneRow): boolean {
  return hexCombinatorialCheck(row, 'P');
}

/**
 * Test I-combinatoriality: ∃n where first hexachord of P(0) ∪ first hexachord of I(n) = aggregate.
 */
export function isHexachordallyCombinatorialI(row: TwelveToneRow): boolean {
  return hexCombinatorialCheck(row, 'I');
}

/**
 * Test R-combinatoriality: ∃n where first hexachord of P(0) ∪ first hexachord of R(n) = aggregate.
 */
export function isHexachordallyCombinatorialR(row: TwelveToneRow): boolean {
  return hexCombinatorialCheck(row, 'R');
}

/**
 * Test RI-combinatoriality: ∃n where first hexachord of P(0) ∪ first hexachord of RI(n) = aggregate.
 */
export function isHexachordallyCombinatorialRI(row: TwelveToneRow): boolean {
  return hexCombinatorialCheck(row, 'RI');
}

/**
 * Test whether a hexachord is one of the 6 all-combinatorial hexachords (Babbitt).
 *
 * @param hexachord - Array of 6 pitch classes.
 * @returns True if the hexachord's prime form matches a known all-combinatorial type.
 * @throws {RangeError} If hexachord does not contain exactly 6 PCs.
 */
export function isAllCombinatorialHexachord(hexachord: readonly number[]): boolean {
  if (hexachord.length !== 6) {
    throw new RangeError(`hexachord must contain exactly 6 pitch classes (got ${hexachord.length})`);
  }
  validatePcSequence(hexachord);
  const pf = new PitchClassSet([...hexachord]).primeForm().join(',');
  return AC_HEXACHORDS.has(pf);
}

/**
 * Classify an all-combinatorial hexachord by Babbitt type (A–F).
 *
 * @param hexachord - Array of 6 pitch classes.
 * @returns Classification with type, order, and Forte name, or null if not all-combinatorial.
 * @throws {RangeError} If hexachord does not contain exactly 6 PCs.
 */
export function classifyAllCombinatorialType(
  hexachord: readonly number[],
): AllCombinatorialClassification | null {
  if (hexachord.length !== 6) {
    throw new RangeError(`hexachord must contain exactly 6 pitch classes (got ${hexachord.length})`);
  }
  validatePcSequence(hexachord);
  const pf = new PitchClassSet([...hexachord]).primeForm().join(',');
  return AC_HEXACHORDS.get(pf) ?? null;
}

// ---- Row Invariance (Section 7.7.4) ----

/**
 * Find segmental invariances under T and I operations.
 *
 * @param row - A twelve-tone row.
 * @param segmentSize - Segment size (must divide 12: 1, 2, 3, 4, 6, or 12).
 * @returns Frozen array of segments with non-trivial invariances.
 * @throws {RangeError} If segmentSize doesn't divide 12.
 */
export function segmentalInvariance(
  row: TwelveToneRow,
  segmentSize: number,
): readonly SegmentalInvarianceResult[] {
  if (!Number.isInteger(segmentSize) || segmentSize < 1 || segmentSize > 12 || 12 % segmentSize !== 0) {
    throw new RangeError(`segmentSize must divide 12 (got ${segmentSize})`);
  }

  const numSegments = 12 / segmentSize;
  const results: SegmentalInvarianceResult[] = [];

  for (let s = 0; s < numSegments; s++) {
    const segment = row.pcs.slice(s * segmentSize, (s + 1) * segmentSize);
    const segSet = new Set(segment);
    const mappings: SegmentMapping[] = [];

    // Test transpositions T0-T11
    for (let n = 0; n < 12; n++) {
      const transformed = new Set<number>();
      for (const pc of segment) {
        transformed.add((pc + n) % 12);
      }
      if (transformed.size === segSet.size && [...transformed].every(pc => segSet.has(pc))) {
        // Skip T0 (trivial identity)
        if (n !== 0) {
          mappings.push(Object.freeze({ operation: 'T' as const, n }));
        }
      }
    }

    // Test inversions I0-I11: pc -> (n - pc + 12) % 12
    for (let n = 0; n < 12; n++) {
      const transformed = new Set<number>();
      for (const pc of segment) {
        transformed.add((n - pc + 12) % 12);
      }
      if (transformed.size === segSet.size && [...transformed].every(pc => segSet.has(pc))) {
        mappings.push(Object.freeze({ operation: 'I' as const, n }));
      }
    }

    if (mappings.length > 0) {
      results.push(Object.freeze({
        segmentIndex: s,
        segment: Object.freeze([...segment]),
        mappings: Object.freeze(mappings),
      }));
    }
  }

  return Object.freeze(results);
}

/**
 * Test whether a row is derived from a generator set under T and I operations.
 *
 * @param row - A twelve-tone row.
 * @param generator - The generator set (length must divide 12, typically 3 or 4).
 * @returns Result indicating whether the row is derived, with transformations.
 * @throws {RangeError} If generator length doesn't divide 12.
 */
export function derivedRow(
  row: TwelveToneRow,
  generator: readonly number[],
): DerivedRowResult {
  const genLen = generator.length;
  if (!Number.isInteger(genLen) || genLen < 1 || genLen > 12 || 12 % genLen !== 0) {
    throw new RangeError(`generator length must divide 12 (got ${genLen})`);
  }
  validatePcSequence(generator);

  const genSet = new Set(generator);
  const numSegments = 12 / genLen;
  const transformations: DerivedRowTransformation[] = [];
  let isDerived = true;

  for (let s = 0; s < numSegments; s++) {
    const segment = row.pcs.slice(s * genLen, (s + 1) * genLen);
    const segSet = new Set(segment);
    let found = false;

    // Try transpositions
    for (let n = 0; n < 12; n++) {
      const transformed = new Set<number>();
      for (const pc of generator) {
        transformed.add((pc + n) % 12);
      }
      if (transformed.size === segSet.size && [...transformed].every(pc => segSet.has(pc))) {
        transformations.push(Object.freeze({ segmentIndex: s, operation: 'T' as const, n }));
        found = true;
        break;
      }
    }

    if (!found) {
      // Try inversions: pc -> (n - pc + 12) % 12
      for (let n = 0; n < 12; n++) {
        const transformed = new Set<number>();
        for (const pc of generator) {
          transformed.add((n - pc + 12) % 12);
        }
        if (transformed.size === segSet.size && [...transformed].every(pc => segSet.has(pc))) {
          transformations.push(Object.freeze({ segmentIndex: s, operation: 'I' as const, n }));
          found = true;
          break;
        }
      }
    }

    if (!found) {
      isDerived = false;
      break;
    }
  }

  return Object.freeze({
    isDerived,
    generator: Object.freeze([...generator]),
    transformations: Object.freeze(isDerived ? transformations : []),
  });
}
