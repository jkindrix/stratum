// ---------------------------------------------------------------------------
// Stratum — Cellular Automaton Generators
// ---------------------------------------------------------------------------

/** A 2D grid of cells. Each inner array is a row. */
export type CellGrid = readonly (readonly number[])[];

/** Mapping options for converting CA grids to musical events. */
export interface CAMapping {
  /** Starting tick for the first row (default 0). */
  readonly startTick?: number;
  /** Ticks per row/generation (default 480). */
  readonly ticksPerRow?: number;
  /** Base MIDI note for column 0 (default 60). */
  readonly baseMidi?: number;
  /** MIDI step per column (default 1). */
  readonly midiStep?: number;
  /** Duration of each generated event in ticks (default ticksPerRow). */
  readonly duration?: number;
  /** Velocity for generated events (default 80). */
  readonly velocity?: number;
}

/** A musical event derived from a CA cell. */
export interface CAEvent {
  /** MIDI note number. */
  readonly midi: number;
  /** Onset time in ticks. */
  readonly onset: number;
  /** Duration in ticks. */
  readonly duration: number;
  /** Velocity (0-127). */
  readonly velocity: number;
}

/**
 * Generate a 1D elementary cellular automaton.
 *
 * Uses Wolfram's numbering scheme (rules 0-255). The rule number's binary
 * representation determines the output for each 3-cell neighborhood.
 * Boundary conditions are toroidal (wrap around).
 *
 * @param rule - Wolfram rule number (0-255).
 * @param width - Number of cells per row (must be ≥ 1).
 * @param steps - Number of generations to compute (must be ≥ 1).
 * @param initial - Optional initial row. Defaults to a single center cell.
 * @returns Frozen CellGrid with `steps` rows (including initial state).
 * @throws {RangeError} If rule not in [0,255], width < 1, steps < 1, or initial width mismatch.
 */
export function elementaryCA(
  rule: number,
  width: number,
  steps: number,
  initial?: readonly number[],
): CellGrid {
  if (!Number.isInteger(rule) || rule < 0 || rule > 255) {
    throw new RangeError(`rule must be an integer in [0, 255] (got ${rule})`);
  }
  if (!Number.isInteger(width) || width < 1) {
    throw new RangeError(`width must be a positive integer (got ${width})`);
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`steps must be a positive integer (got ${steps})`);
  }

  // Initialize first row
  let row: number[];
  if (initial !== undefined) {
    if (initial.length !== width) {
      throw new RangeError(
        `initial length must match width (got ${initial.length}, expected ${width})`,
      );
    }
    row = [...initial];
  } else {
    row = new Array<number>(width).fill(0);
    row[Math.floor(width / 2)] = 1;
  }

  const grid: (readonly number[])[] = [Object.freeze([...row])];

  for (let s = 1; s < steps; s++) {
    const next = new Array<number>(width).fill(0);
    for (let i = 0; i < width; i++) {
      const left = row[((i - 1) + width) % width] ?? 0;
      const center = row[i] ?? 0;
      const right = row[(i + 1) % width] ?? 0;
      const index = (left << 2) | (center << 1) | right;
      next[i] = (rule >> index) & 1;
    }
    row = next;
    grid.push(Object.freeze([...row]));
  }

  return Object.freeze(grid);
}

/**
 * Run Conway's Game of Life on a 2D grid.
 *
 * Rules: B3/S23 (birth on 3 neighbors, survival on 2-3 neighbors).
 * Boundary conditions are toroidal (wrap around in both dimensions).
 *
 * @param initial - Initial 2D grid (rows of 0/1 values).
 * @param steps - Number of generations to simulate (must be ≥ 1).
 * @returns Frozen array of CellGrids (all generations including initial).
 * @throws {RangeError} If initial is empty, rows have inconsistent widths, or steps < 1.
 */
export function gameOfLife(
  initial: CellGrid,
  steps: number,
): readonly CellGrid[] {
  if (initial.length === 0) {
    throw new RangeError('initial grid must not be empty');
  }
  const height = initial.length;
  const width = initial[0]!.length;
  if (width === 0) {
    throw new RangeError('initial grid rows must not be empty');
  }
  for (let r = 0; r < height; r++) {
    if ((initial[r]?.length ?? 0) !== width) {
      throw new RangeError(`all rows must have the same width (row ${r} has ${initial[r]?.length ?? 0}, expected ${width})`);
    }
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`steps must be a positive integer (got ${steps})`);
  }

  // Deep-freeze initial
  const frozenInitial: readonly (readonly number[])[] = initial.map(row =>
    Object.freeze([...row]),
  );

  const generations: CellGrid[] = [Object.freeze(frozenInitial)];
  let current = initial;

  for (let s = 0; s < steps; s++) {
    const next: number[][] = [];
    for (let r = 0; r < height; r++) {
      const newRow = new Array<number>(width).fill(0);
      for (let c = 0; c < width; c++) {
        // Count Moore neighborhood (toroidal)
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = ((r + dr) + height) % height;
            const nc = ((c + dc) + width) % width;
            neighbors += current[nr]?.[nc] ?? 0;
          }
        }

        const alive = current[r]?.[c] ?? 0;
        if (alive === 1) {
          // Survival: exactly 2 or 3 neighbors
          newRow[c] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
        } else {
          // Birth: exactly 3 neighbors
          newRow[c] = neighbors === 3 ? 1 : 0;
        }
      }
      next.push(newRow);
    }

    const frozenNext: readonly (readonly number[])[] = next.map(row =>
      Object.freeze(row),
    );
    generations.push(Object.freeze(frozenNext));
    current = next;
  }

  return Object.freeze(generations);
}

/**
 * Convert a CA cell grid to musical events.
 *
 * Each row maps to a time step and each active cell (value 1) in a row
 * generates an event. Row index = time, column index = pitch.
 *
 * @param grid - A CellGrid (rows × columns of 0/1 values).
 * @param mapping - Optional mapping parameters.
 * @returns Frozen array of CAEvent objects.
 */
export function caToEvents(
  grid: CellGrid,
  mapping?: CAMapping,
): readonly CAEvent[] {
  const startTick = mapping?.startTick ?? 0;
  const ticksPerRow = mapping?.ticksPerRow ?? 480;
  const baseMidi = mapping?.baseMidi ?? 60;
  const midiStep = mapping?.midiStep ?? 1;
  const dur = mapping?.duration ?? ticksPerRow;
  const vel = mapping?.velocity ?? 80;

  const events: CAEvent[] = [];

  for (let row = 0; row < grid.length; row++) {
    const cells = grid[row]!;
    for (let col = 0; col < cells.length; col++) {
      if ((cells[col] ?? 0) === 1) {
        events.push(
          Object.freeze({
            midi: baseMidi + col * midiStep,
            onset: startTick + row * ticksPerRow,
            duration: dur,
            velocity: vel,
          }),
        );
      }
    }
  }

  return Object.freeze(events);
}
