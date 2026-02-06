import { normalizePc } from './pitch-class.js';
import { FORTE_CATALOG } from './forte-catalog.js';
import type { ForteEntry } from './forte-catalog.js';

/**
 * A set of pitch classes with analytical operations.
 * Supports transposition, inversion, prime form, interval vector, and Forte lookup.
 */
export class PitchClassSet {
  /** Sorted, deduplicated pitch classes (0-11) */
  readonly pcs: readonly number[];

  constructor(pcs: Iterable<number>) {
    const normalized = [...new Set([...pcs].map(normalizePc))].sort((a, b) => a - b);
    this.pcs = Object.freeze(normalized);
  }

  /**
   * Number of pitch classes in the set.
   * @returns The cardinality of the set.
   */
  get size(): number {
    return this.pcs.length;
  }

  /**
   * Check if a pitch class is a member of this set.
   * @param pc - Pitch class to check (will be normalized to 0-11).
   * @returns True if the pitch class is in the set.
   */
  has(pc: number): boolean {
    return this.pcs.includes(normalizePc(pc));
  }

  /**
   * Transpose all pitch classes by n semitones.
   * @param n - Number of semitones to transpose.
   * @returns A new transposed PitchClassSet.
   */
  transpose(n: number): PitchClassSet {
    return new PitchClassSet(this.pcs.map(pc => pc + n));
  }

  /**
   * Invert around 0 (each pc becomes 12 - pc).
   * @returns A new inverted PitchClassSet.
   */
  invert(): PitchClassSet {
    return new PitchClassSet(this.pcs.map(pc => 12 - pc));
  }

  /**
   * All pitch classes NOT in this set.
   * @returns A new PitchClassSet containing the complement.
   */
  complement(): PitchClassSet {
    return new PitchClassSet(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(pc => !this.has(pc)),
    );
  }

  /**
   * Normal form: the most compact cyclic ordering.
   * Finds the rotation with the smallest outer interval,
   * breaking ties by comparing inner intervals left-to-right.
   * @returns The normal form as a sorted array of pitch classes.
   */
  normalForm(): readonly number[] {
    const n = this.pcs.length;
    if (n <= 1) return this.pcs;

    const sorted = [...this.pcs];

    // Generate all rotations
    const rotations: number[][] = [];
    for (let i = 0; i < n; i++) {
      const rotation: number[] = [];
      for (let j = 0; j < n; j++) {
        rotation.push(sorted[(i + j) % n]!);
      }
      rotations.push(rotation);
    }

    // Compute span for each rotation (last - first, mod 12)
    let minSpan = 13;
    let candidates: number[][] = [];
    for (const rot of rotations) {
      const span = (rot[n - 1]! - rot[0]! + 12) % 12;
      if (span < minSpan) {
        minSpan = span;
        candidates = [rot];
      } else if (span === minSpan) {
        candidates.push(rot);
      }
    }

    if (candidates.length === 1) return candidates[0]!;

    // Break ties: compare intervals from the first element, left to right
    candidates.sort((a, b) => {
      for (let i = 1; i < n; i++) {
        const intA = (a[i]! - a[0]! + 12) % 12;
        const intB = (b[i]! - b[0]! + 12) % 12;
        if (intA !== intB) return intA - intB;
      }
      return 0;
    });

    return candidates[0]!;
  }

  /**
   * Prime form: the most compact representation, starting from 0.
   * Compares normal form with normal form of inversion, picks the smaller.
   * @returns The prime form as a sorted array starting at 0.
   */
  primeForm(): readonly number[] {
    if (this.pcs.length === 0) return [];

    const normal = this.normalForm();
    const t0 = normal.map(pc => (pc - normal[0]! + 12) % 12);

    const invNormal = this.invert().normalForm();
    const t0inv = invNormal.map(pc => (pc - invNormal[0]! + 12) % 12);

    // Return lexicographically smaller
    for (let i = 0; i < t0.length; i++) {
      if (t0[i]! < t0inv[i]!) return t0;
      if (t0[i]! > t0inv[i]!) return t0inv;
    }
    return t0;
  }

  /**
   * Interval vector: count of each interval class 1-6.
   * @returns A 6-element tuple [ic1, ic2, ic3, ic4, ic5, ic6].
   */
  intervalVector(): [number, number, number, number, number, number] {
    const vector: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

    for (let i = 0; i < this.pcs.length; i++) {
      for (let j = i + 1; j < this.pcs.length; j++) {
        const diff = (this.pcs[j]! - this.pcs[i]! + 12) % 12;
        const ic = diff <= 6 ? diff : 12 - diff;
        if (ic >= 1 && ic <= 6) {
          vector[ic - 1]!++;
        }
      }
    }

    return vector;
  }

  /**
   * Interval structure: semitone gaps between adjacent members (wrapping).
   * @returns Array of intervals between consecutive pitch classes, including the wrap-around.
   */
  intervalStructure(): number[] {
    const n = this.pcs.length;
    if (n < 2) return [];

    const intervals: number[] = [];
    for (let i = 1; i < n; i++) {
      intervals.push((this.pcs[i]! - this.pcs[i - 1]! + 12) % 12);
    }
    // Wrap-around interval
    intervals.push((this.pcs[0]! + 12 - this.pcs[n - 1]!) % 12);
    return intervals;
  }

  /**
   * Forte set-class name (e.g. '3-11'), or null if not in catalog.
   * @returns The Forte name string, or null for trivial/unlisted sets.
   */
  forteName(): string | null {
    const key = this.primeForm().join(',');
    return FORTE_CATALOG[key]?.name ?? null;
  }

  /**
   * Full Forte catalog entry (name + interval vector), or null if not in catalog.
   * @returns The ForteEntry with name and interval vector, or null.
   */
  forteEntry(): ForteEntry | null {
    const key = this.primeForm().join(',');
    return FORTE_CATALOG[key] ?? null;
  }

  /**
   * Check equality (same pitch classes).
   * @param other - The set to compare with.
   * @returns True if both sets contain the same pitch classes.
   */
  equals(other: PitchClassSet): boolean {
    if (this.pcs.length !== other.pcs.length) return false;
    return this.pcs.every((pc, i) => pc === other.pcs[i]);
  }

  /**
   * Union of two sets.
   * @param other - The set to union with.
   * @returns A new PitchClassSet containing all pitch classes from both sets.
   */
  union(other: PitchClassSet): PitchClassSet {
    return new PitchClassSet([...this.pcs, ...other.pcs]);
  }

  /**
   * Intersection of two sets.
   * @param other - The set to intersect with.
   * @returns A new PitchClassSet containing only pitch classes present in both sets.
   */
  intersection(other: PitchClassSet): PitchClassSet {
    return new PitchClassSet(this.pcs.filter(pc => other.has(pc)));
  }

  /**
   * Set difference: pitch classes in this set but not in other.
   * @param other - The set to subtract.
   * @returns A new PitchClassSet containing pitch classes in this but not in other.
   */
  difference(other: PitchClassSet): PitchClassSet {
    return new PitchClassSet(this.pcs.filter(pc => !other.has(pc)));
  }

  /**
   * Symmetric difference: pitch classes in one set but not both.
   * @param other - The set to compare with.
   * @returns A new PitchClassSet containing pitch classes in exactly one of the two sets.
   */
  symmetricDifference(other: PitchClassSet): PitchClassSet {
    return new PitchClassSet([
      ...this.pcs.filter(pc => !other.has(pc)),
      ...other.pcs.filter(pc => !this.has(pc)),
    ]);
  }

  /**
   * Test if this set is a subset of other (every element in this is also in other).
   * @param other - The potential superset to test against.
   * @returns True if every pitch class in this set is also in other.
   */
  isSubsetOf(other: PitchClassSet): boolean {
    return this.pcs.every(pc => other.has(pc));
  }

  /**
   * Test if this set is a superset of other (every element in other is also in this).
   * @param other - The potential subset to test against.
   * @returns True if every pitch class in other is also in this set.
   */
  isSupersetOf(other: PitchClassSet): boolean {
    return other.pcs.every(pc => this.has(pc));
  }

  /**
   * String representation of the set, e.g. `{0,4,7}`.
   * @returns Brace-enclosed comma-separated pitch classes.
   */
  toString(): string {
    return `{${this.pcs.join(',')}}`;
  }

  /**
   * Human-readable note names representation, e.g. `{C, E, G}`.
   * @returns Brace-enclosed comma-separated note names using sharps.
   */
  toNoteNames(): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `{${this.pcs.map(pc => names[pc]!).join(', ')}}`;
  }
}

// Catalog imported from forte-catalog.ts
