// ---------------------------------------------------------------------------
// Stratum — Xenakis Sieve (Residual Class Theory)
// ---------------------------------------------------------------------------

/** Expression tree node for sieve algebra. */
type SieveNode =
  | { readonly kind: 'elementary'; readonly modulus: number; readonly residue: number }
  | { readonly kind: 'union'; readonly left: SieveNode; readonly right: SieveNode }
  | { readonly kind: 'intersection'; readonly left: SieveNode; readonly right: SieveNode }
  | { readonly kind: 'complement'; readonly child: SieveNode };

/** Recursively evaluate a sieve expression tree at integer n. */
function evalNode(node: SieveNode, n: number): boolean {
  switch (node.kind) {
    case 'elementary':
      return ((n % node.modulus) + node.modulus) % node.modulus === node.residue;
    case 'union':
      return evalNode(node.left, n) || evalNode(node.right, n);
    case 'intersection':
      return evalNode(node.left, n) && evalNode(node.right, n);
    case 'complement':
      return !evalNode(node.child, n);
  }
}

/**
 * Xenakis Sieve — generates pitch/time sets from residual class algebra.
 *
 * A sieve is defined by modular congruences combined with set operations
 * (union, intersection, complement). The `realize` method generates all
 * integers in a range that satisfy the sieve expression.
 *
 * @example
 * ```ts
 * const s = sieve(3, 0).union(sieve(4, 0));
 * s.realize(0, 12); // [0, 3, 4, 6, 8, 9, 12]
 * ```
 */
export class Sieve {
  /** @internal */
  private readonly node: SieveNode;

  /** @internal */
  constructor(node: SieveNode) {
    this.node = node;
  }

  /**
   * Test whether integer n passes the sieve.
   *
   * @param n - Integer to test.
   * @returns True if n is in the sieve's set.
   */
  test(n: number): boolean {
    return evalNode(this.node, n);
  }

  /**
   * Union of this sieve with another (logical OR).
   *
   * @param other - Another sieve.
   * @returns New sieve representing the union.
   */
  union(other: Sieve): Sieve {
    return new Sieve({ kind: 'union', left: this.node, right: other.node });
  }

  /**
   * Intersection of this sieve with another (logical AND).
   *
   * @param other - Another sieve.
   * @returns New sieve representing the intersection.
   */
  intersection(other: Sieve): Sieve {
    return new Sieve({ kind: 'intersection', left: this.node, right: other.node });
  }

  /**
   * Complement of this sieve (logical NOT).
   *
   * @returns New sieve representing the complement.
   */
  complement(): Sieve {
    return new Sieve({ kind: 'complement', child: this.node });
  }

  /**
   * Realize the sieve as a sorted list of integers in [low, high].
   *
   * @param low - Lower bound (inclusive).
   * @param high - Upper bound (inclusive).
   * @returns Frozen sorted array of integers passing the sieve.
   * @throws {RangeError} If low > high.
   */
  realize(low: number, high: number): readonly number[] {
    if (low > high) {
      throw new RangeError(`low must be <= high (got ${low} > ${high})`);
    }

    const result: number[] = [];
    for (let n = low; n <= high; n++) {
      if (evalNode(this.node, n)) {
        result.push(n);
      }
    }
    return Object.freeze(result);
  }

  /**
   * Realize the sieve as pitch classes (mod 12), deduplicated and sorted.
   *
   * Realizes over [0, 11] then reduces mod 12.
   *
   * @returns Frozen sorted array of unique pitch classes (0-11).
   */
  toPitchClasses(): readonly number[] {
    const pcs = new Set<number>();
    for (let n = 0; n < 12; n++) {
      if (evalNode(this.node, n)) {
        pcs.add(n);
      }
    }
    return Object.freeze([...pcs].sort((a, b) => a - b));
  }

  /**
   * Realize the sieve as scale degrees mod octaveSize, deduplicated and sorted.
   *
   * @param octaveSize - Size of the octave (default 12).
   * @returns Frozen sorted array of unique scale degrees.
   * @throws {RangeError} If octaveSize < 1.
   */
  toScale(octaveSize: number = 12): readonly number[] {
    if (!Number.isInteger(octaveSize) || octaveSize < 1) {
      throw new RangeError(`octaveSize must be a positive integer (got ${octaveSize})`);
    }

    const degrees = new Set<number>();
    for (let n = 0; n < octaveSize; n++) {
      if (evalNode(this.node, n)) {
        degrees.add(n);
      }
    }
    return Object.freeze([...degrees].sort((a, b) => a - b));
  }
}

/**
 * Create an elementary sieve for the residual class (modulus, residue).
 *
 * The elementary sieve passes all integers n where n ≡ residue (mod modulus).
 *
 * @param modulus - Modulus (must be ≥ 1).
 * @param residue - Residue (must be in [0, modulus)).
 * @returns A new Sieve instance.
 * @throws {RangeError} If modulus < 1 or residue out of range.
 */
export function sieve(modulus: number, residue: number): Sieve {
  if (!Number.isInteger(modulus) || modulus < 1) {
    throw new RangeError(`modulus must be a positive integer (got ${modulus})`);
  }
  if (!Number.isInteger(residue) || residue < 0 || residue >= modulus) {
    throw new RangeError(`residue must be in [0, ${modulus}) (got ${residue})`);
  }
  return new Sieve({ kind: 'elementary', modulus, residue });
}
