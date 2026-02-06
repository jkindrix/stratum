// ---------------------------------------------------------------------------
// Stratum — Neo-Riemannian Transforms (PLR operations on triads)
// ---------------------------------------------------------------------------

/** A major or minor triad identified by root pitch class and quality. */
export interface Triad {
  /** Root pitch class (0-11). */
  readonly root: number;
  /** Triad quality. */
  readonly quality: 'major' | 'minor';
}

/** A single Neo-Riemannian operation. */
export type NRTOperation = 'P' | 'L' | 'R';

// ---- Pitch-class name helpers ----

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function triadName(t: Triad): string {
  return `${PC_NAMES[t.root]!} ${t.quality}`;
}

// ---- Core transforms ----

/**
 * Apply a single Neo-Riemannian operation (P, L, or R) to a triad.
 *
 * - **P (Parallel):** Same root, flip quality (C major ↔ C minor).
 * - **L (Leading-tone exchange):** Major(r) → Minor((r+4)%12), Minor(r) → Major((r+8)%12).
 * - **R (Relative):** Major(r) → Minor((r+9)%12), Minor(r) → Major((r+3)%12).
 *
 * All operations are involutions: applying twice returns the original triad.
 *
 * @param triad - The input triad.
 * @param operation - 'P', 'L', or 'R'.
 * @returns The transformed triad.
 */
export function nrtTransform(triad: Triad, operation: NRTOperation): Triad {
  const { root, quality } = triad;

  switch (operation) {
    case 'P':
      return { root, quality: quality === 'major' ? 'minor' : 'major' };

    case 'L':
      if (quality === 'major') {
        // Root moves down semitone → minor triad on (root+4)%12
        return { root: (root + 4) % 12, quality: 'minor' };
      }
      // Fifth moves up semitone → major triad on (root+8)%12
      return { root: (root + 8) % 12, quality: 'major' };

    case 'R':
      if (quality === 'major') {
        // Fifth moves up whole step → minor triad on (root+9)%12
        return { root: (root + 9) % 12, quality: 'minor' };
      }
      // Root moves down whole step → major triad on (root+3)%12
      return { root: (root + 3) % 12, quality: 'major' };
  }
}

/**
 * Classify which single NRT operation (P, L, or R) transforms one triad to another.
 *
 * @param from - Source triad.
 * @param to - Target triad.
 * @returns The operation, or null if no single PLR operation connects them.
 */
export function classifyNRT(from: Triad, to: Triad): NRTOperation | null {
  const ops: NRTOperation[] = ['P', 'L', 'R'];
  for (const op of ops) {
    const result = nrtTransform(from, op);
    if (result.root === to.root && result.quality === to.quality) {
      return op;
    }
  }
  return null;
}

/**
 * Apply a compound transformation string (e.g., "PL", "LPR", "PLPLPL") to a triad.
 *
 * Operations are applied left-to-right.
 *
 * @param triad - The starting triad.
 * @param operations - String of P, L, and R characters.
 * @returns The resulting triad after all operations.
 * @throws {Error} If the string contains invalid characters.
 */
export function nrtCompound(triad: Triad, operations: string): Triad {
  let current = triad;
  for (const ch of operations) {
    if (ch !== 'P' && ch !== 'L' && ch !== 'R') {
      throw new Error(`Invalid NRT operation '${ch}' (expected P, L, or R)`);
    }
    current = nrtTransform(current, ch);
  }
  return current;
}

// ---- BFS shortest path ----

function triadKey(t: Triad): string {
  return `${t.root}_${t.quality}`;
}

/**
 * Find the shortest sequence of PLR operations connecting two triads.
 *
 * Uses breadth-first search on the 24-node Tonnetz graph where each triad
 * has exactly three neighbors (one per operation).
 *
 * @param from - Source triad.
 * @param to - Target triad.
 * @returns Array of operations forming the shortest path (empty if from === to).
 */
export function nrtPath(from: Triad, to: Triad): NRTOperation[] {
  const toKey = triadKey(to);
  if (triadKey(from) === toKey) return [];

  const ops: NRTOperation[] = ['P', 'L', 'R'];
  const visited = new Set<string>();
  const queue: { triad: Triad; path: NRTOperation[] }[] = [{ triad: from, path: [] }];
  visited.add(triadKey(from));

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const op of ops) {
      const next = nrtTransform(current.triad, op);
      const key = triadKey(next);

      if (key === toKey) {
        return [...current.path, op];
      }

      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ triad: next, path: [...current.path, op] });
      }
    }
  }

  // Should never reach here — all 24 triads are connected
  return [];
}

// ---- Cycles ----

/**
 * Generate a hexatonic cycle starting from the given triad.
 *
 * Alternates P and L operations: PLPLPL, producing 6 triads that return
 * to the starting point. These 6 triads share a hexatonic scale.
 *
 * @param startTriad - Starting triad (major or minor).
 * @returns Array of 6 triads forming the hexatonic cycle.
 */
export function hexatonicCycle(startTriad: Triad): Triad[] {
  const cycle: Triad[] = [startTriad];
  let current = startTriad;

  for (let i = 0; i < 5; i++) {
    const op: NRTOperation = i % 2 === 0 ? 'P' : 'L';
    current = nrtTransform(current, op);
    cycle.push(current);
  }

  return cycle;
}

/**
 * Generate an octatonic cycle starting from the given triad.
 *
 * Alternates P and R operations: PRPRPRPR, producing 8 triads that return
 * to the starting point. These 8 triads span an octatonic (diminished) scale.
 *
 * @param startTriad - Starting triad (major or minor).
 * @returns Array of 8 triads forming the octatonic cycle.
 */
export function octatonicCycle(startTriad: Triad): Triad[] {
  const cycle: Triad[] = [startTriad];
  let current = startTriad;

  for (let i = 0; i < 7; i++) {
    const op: NRTOperation = i % 2 === 0 ? 'P' : 'R';
    current = nrtTransform(current, op);
    cycle.push(current);
  }

  return cycle;
}

/**
 * Return the hexatonic pole of a triad: the maximally distant triad in its
 * hexatonic cycle (3 alternating P/L operations away).
 *
 * For C major → Ab minor. For A minor → E major.
 *
 * @param triad - The input triad.
 * @returns The hexatonic pole triad.
 */
export function hexatonicPole(triad: Triad): Triad {
  return nrtCompound(triad, 'PLP');
}

// ---- Weitzmann Region ----

/**
 * Return the 6 triads connected to an augmented triad by single semitone moves.
 *
 * An augmented triad has 3 pitch classes. Moving any one up or down by a semitone
 * yields a major or minor triad. The 6 resulting triads form a Weitzmann region.
 *
 * @param augTriad - Array of 3 pitch classes forming an augmented triad (e.g., [0, 4, 8]).
 * @returns Array of 6 triads in the Weitzmann region.
 * @throws {Error} If input is not a valid augmented triad (3 PCs, each 4 semitones apart).
 */
export function weitzmannRegion(augTriad: readonly number[]): Triad[] {
  if (augTriad.length !== 3) {
    throw new Error('Augmented triad must contain exactly 3 pitch classes');
  }

  // Validate augmented triad: each adjacent pair should be 4 semitones apart
  const sorted = [...augTriad].sort((a, b) => a - b);
  const d1 = (sorted[1]! - sorted[0]! + 12) % 12;
  const d2 = (sorted[2]! - sorted[1]! + 12) % 12;
  const d3 = (sorted[0]! - sorted[2]! + 12) % 12;
  if (d1 !== 4 || d2 !== 4 || d3 !== 4) {
    throw new Error('Not a valid augmented triad (intervals must be 4-4-4 semitones)');
  }

  const triads: Triad[] = [];

  for (const pc of augTriad) {
    // Move this PC up a semitone
    const up = (pc + 1) % 12;
    const upSet = augTriad.map(p => (p === pc ? up : p));
    const upTriad = identifyTriadFromPcs(upSet);
    if (upTriad) triads.push(upTriad);

    // Move this PC down a semitone
    const down = (pc - 1 + 12) % 12;
    const downSet = augTriad.map(p => (p === pc ? down : p));
    const downTriad = identifyTriadFromPcs(downSet);
    if (downTriad) triads.push(downTriad);
  }

  return triads;
}

/**
 * Identify a major or minor triad from 3 pitch classes.
 * Returns null if the PCs don't form a major or minor triad.
 */
function identifyTriadFromPcs(pcs: number[]): Triad | null {
  if (pcs.length !== 3) return null;

  // Try each PC as potential root
  for (let ri = 0; ri < 3; ri++) {
    const root = pcs[ri]!;
    const ints: number[] = [];
    for (let j = 0; j < 3; j++) {
      if (j !== ri) ints.push((pcs[j]! - root + 12) % 12);
    }
    ints.sort((a, b) => a - b);

    if (ints[0] === 4 && ints[1] === 7) {
      return { root, quality: 'major' };
    }
    if (ints[0] === 3 && ints[1] === 7) {
      return { root, quality: 'minor' };
    }
  }

  return null;
}

/**
 * Get the pitch classes of a triad.
 *
 * @param triad - The triad.
 * @returns Array of 3 pitch classes [root, third, fifth].
 */
export function triadPitchClasses(triad: Triad): readonly [number, number, number] {
  const third = triad.quality === 'major' ? 4 : 3;
  return [triad.root, (triad.root + third) % 12, (triad.root + 7) % 12];
}
