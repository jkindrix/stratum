// ---------------------------------------------------------------------------
// Stratum — Klumpenhouwer Networks (K-nets) & Generalized Interval Systems
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export type KNetArrowType = 'T' | 'I';

export interface KNetArrow {
  readonly from: number;
  readonly to: number;
  readonly type: KNetArrowType;
  readonly n: number;
}

export interface KNet {
  readonly nodes: readonly number[];
  readonly arrows: readonly KNetArrow[];
}

export interface IsographyResult {
  readonly positive: boolean;
  readonly negative: boolean;
  readonly strong: boolean;
  readonly positiveN: number | null;
  readonly negativeN: number | null;
}

export interface GIS<S = number> {
  readonly elements: readonly S[];
  readonly intervalFn: (a: S, b: S) => number;
}

// ── K-net Functions ────────────────────────────────────────────────────────

/**
 * Build a validated Klumpenhouwer Network.
 *
 * Validates that all nodes are pitch classes 0-11, arrow indices reference
 * valid nodes, and T/I operations are consistent with the node values.
 *
 * T-arrow consistency: `(nodes[from] + n) % 12 === nodes[to]`
 * I-arrow consistency: `(n - nodes[from] + 12) % 12 === nodes[to]`
 *
 * @param nodes - Array of pitch classes (integers 0-11) forming the network nodes
 * @param arrows - Array of T/I arrows connecting the nodes
 * @returns Frozen K-net with validated nodes and arrows
 * @throws {RangeError} If nodes are outside 0-11, arrow indices are out of range, or T/I operations are inconsistent.
 */
export function buildKNet(
  nodes: readonly number[],
  arrows: readonly KNetArrow[],
): KNet {
  // Validate nodes
  for (let i = 0; i < nodes.length; i++) {
    const pc = nodes[i];
    if (pc === undefined || !Number.isInteger(pc) || pc < 0 || pc > 11) {
      throw new RangeError(`Node ${i} must be integer 0-11, got ${pc}`);
    }
  }

  // Validate arrows
  for (const arrow of arrows) {
    if (arrow.from < 0 || arrow.from >= nodes.length) {
      throw new RangeError(`Arrow from index ${arrow.from} out of range`);
    }
    if (arrow.to < 0 || arrow.to >= nodes.length) {
      throw new RangeError(`Arrow to index ${arrow.to} out of range`);
    }
    if (arrow.type !== 'T' && arrow.type !== 'I') {
      throw new RangeError(`Arrow type must be 'T' or 'I', got '${arrow.type}'`);
    }
    if (!Number.isInteger(arrow.n) || arrow.n < 0 || arrow.n > 11) {
      throw new RangeError(`Arrow n must be integer 0-11, got ${arrow.n}`);
    }

    const fromPc = nodes[arrow.from]!;
    const toPc = nodes[arrow.to]!;

    if (arrow.type === 'T') {
      const expected = (fromPc + arrow.n) % 12;
      if (expected !== toPc) {
        throw new RangeError(
          `T${arrow.n} arrow inconsistent: T${arrow.n}(${fromPc}) = ${expected}, not ${toPc}`,
        );
      }
    } else {
      const expected = (arrow.n - fromPc + 12) % 12;
      if (expected !== toPc) {
        throw new RangeError(
          `I${arrow.n} arrow inconsistent: I${arrow.n}(${fromPc}) = ${expected}, not ${toPc}`,
        );
      }
    }
  }

  return Object.freeze({
    nodes: Object.freeze([...nodes]),
    arrows: Object.freeze(arrows.map(a => Object.freeze({ ...a }))),
  });
}

/**
 * Test isography relations between two Klumpenhouwer Networks.
 *
 * - **Positive isography**: all T-labels identical; all I-label differences
 *   `(b.n - a.n + 12) % 12` are a constant.
 * - **Strong isography**: positive isography with constant = 0.
 * - **Negative isography**: all T-labels complementary `(a.n + b.n) % 12 === 0`;
 *   all I-label sums `(a.n + b.n) % 12` are a constant.
 *
 * @param a - First K-net
 * @param b - Second K-net (must share the same graph topology as a)
 * @returns Isography result indicating positive, negative, and strong relations
 * @throws {RangeError} If the two K-nets differ in node count, arrow count, or graph topology.
 */
export function kNetIsography(a: KNet, b: KNet): IsographyResult {
  if (a.nodes.length !== b.nodes.length) {
    throw new RangeError('K-nets must have the same number of nodes');
  }
  if (a.arrows.length !== b.arrows.length) {
    throw new RangeError('K-nets must have the same number of arrows');
  }

  // Verify same topology
  for (let i = 0; i < a.arrows.length; i++) {
    const aa = a.arrows[i]!;
    const ba = b.arrows[i]!;
    if (aa.from !== ba.from || aa.to !== ba.to || aa.type !== ba.type) {
      throw new RangeError(`Arrow ${i} topology mismatch: K-nets must share the same graph structure`);
    }
  }

  // Positive isography check
  let positive = true;
  let positiveConstant: number | null = null;

  for (let i = 0; i < a.arrows.length; i++) {
    const aa = a.arrows[i]!;
    const ba = b.arrows[i]!;

    if (aa.type === 'T') {
      if (aa.n !== ba.n) {
        positive = false;
        break;
      }
    } else {
      // I-arrow: difference must be constant
      const diff = (ba.n - aa.n + 12) % 12;
      if (positiveConstant === null) {
        positiveConstant = diff;
      } else if (diff !== positiveConstant) {
        positive = false;
        break;
      }
    }
  }

  // If no I-arrows found but all T-arrows match, it's still positive (trivially)
  if (positive && positiveConstant === null) {
    positiveConstant = 0;
  }

  const strong = positive && positiveConstant === 0;

  // Negative isography check
  let negative = true;
  let negativeConstant: number | null = null;

  for (let i = 0; i < a.arrows.length; i++) {
    const aa = a.arrows[i]!;
    const ba = b.arrows[i]!;

    if (aa.type === 'T') {
      if ((aa.n + ba.n) % 12 !== 0) {
        negative = false;
        break;
      }
    } else {
      // I-arrow: sum must be constant
      const sum = (aa.n + ba.n) % 12;
      if (negativeConstant === null) {
        negativeConstant = sum;
      } else if (sum !== negativeConstant) {
        negative = false;
        break;
      }
    }
  }

  if (negative && negativeConstant === null) {
    negativeConstant = 0;
  }

  return Object.freeze({
    positive,
    negative,
    strong,
    positiveN: positive ? (positiveConstant ?? 0) : null,
    negativeN: negative ? (negativeConstant ?? 0) : null,
  });
}

// ── GIS Functions ──────────────────────────────────────────────────────────

/**
 * Build a Generalized Interval System.
 *
 * A GIS consists of a set of elements and an interval function that maps
 * pairs of elements to an interval group.
 *
 * @param elements - The set of elements in the GIS
 * @param intervalFn - Function computing the interval between two elements
 * @returns Frozen GIS instance
 * @throws {RangeError} If elements is empty.
 */
export function buildGIS<S>(
  elements: readonly S[],
  intervalFn: (a: S, b: S) => number,
): GIS<S> {
  if (elements.length === 0) {
    throw new RangeError('GIS must have at least one element');
  }

  return Object.freeze({
    elements: Object.freeze([...elements]),
    intervalFn,
  });
}

/**
 * Compute the interval between two elements in a GIS.
 *
 * @param gis - The generalized interval system to use
 * @param a - Source element
 * @param b - Target element
 * @returns The interval from a to b as defined by the GIS interval function
 */
export function gisInterval<S>(gis: GIS<S>, a: S, b: S): number {
  return gis.intervalFn(a, b);
}

/**
 * Create a standard pitch-class GIS (Z12).
 *
 * Elements: [0, 1, ..., 11]
 * Interval: `(b - a + 12) % 12`
 *
 * @returns Frozen pitch-class GIS with mod-12 interval function
 */
export function pitchClassGIS(): GIS<number> {
  const elements = Array.from({ length: 12 }, (_, i) => i);
  return buildGIS(elements, (a, b) => ((b - a) % 12 + 12) % 12);
}

/**
 * Create a pitch GIS over a MIDI range.
 *
 * Elements: integers from `low` to `high` (inclusive)
 * Interval: `b - a` (signed directed interval in semitones)
 *
 * @param low - Lower bound of MIDI range (default 0)
 * @param high - Upper bound of MIDI range (default 127)
 * @returns Frozen pitch GIS with signed semitone interval function
 * @throws {RangeError} If low or high are not integers, or low exceeds high.
 */
export function pitchGIS(low = 0, high = 127): GIS<number> {
  if (!Number.isInteger(low) || !Number.isInteger(high)) {
    throw new RangeError('Low and high must be integers');
  }
  if (low > high) {
    throw new RangeError(`Low (${low}) must be <= high (${high})`);
  }

  const elements = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  return buildGIS(elements, (a, b) => b - a);
}

/**
 * Create a duration GIS over a set of duration values.
 *
 * Elements: the provided durations
 * Interval: `b / a` (ratio)
 *
 * @param durations - Array of positive duration values
 * @returns Frozen duration GIS with ratio-based interval function
 * @throws {RangeError} If any duration is not positive.
 */
export function durationGIS(durations: readonly number[]): GIS<number> {
  for (let i = 0; i < durations.length; i++) {
    const d = durations[i];
    if (d === undefined || d <= 0) {
      throw new RangeError(`Duration at index ${i} must be positive, got ${d}`);
    }
  }

  return buildGIS(durations, (a, b) => b / a);
}
