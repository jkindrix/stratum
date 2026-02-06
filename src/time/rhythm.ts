// ---------------------------------------------------------------------------
// Stratum — Rhythmic Utilities
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

/**
 * Quantize note onsets to the nearest grid point.
 * @param events — Array of note events to quantize (modified in place).
 * @param gridTicks — Grid resolution in ticks (e.g., 120 for sixteenth notes at 480 TPQ).
 * @returns The modified events array.
 */
export function quantize(events: NoteEvent[], gridTicks: number): NoteEvent[] {
  if (gridTicks <= 0) throw new RangeError(`gridTicks must be > 0 (got ${gridTicks})`);

  for (const event of events) {
    const quantized = Math.round(event.onset / gridTicks) * gridTicks;
    (event as { onset: number }).onset = quantized;
  }
  return events;
}

/**
 * Apply swing feel to events by delaying every other subdivision.
 * @param events — Array of note events (modified in place).
 * @param ratio — Swing ratio (0.5 = straight, 0.67 = typical swing, 0.75 = heavy shuffle).
 * @param gridTicks — Grid resolution for the straight subdivisions.
 * @returns The modified events array.
 */
export function swing(events: NoteEvent[], ratio: number, gridTicks: number): NoteEvent[] {
  if (ratio < 0 || ratio > 1) throw new RangeError(`ratio must be 0-1 (got ${ratio})`);
  if (gridTicks <= 0) throw new RangeError(`gridTicks must be > 0 (got ${gridTicks})`);

  const pairTicks = gridTicks * 2; // two subdivisions make a pair

  for (const event of events) {
    const pairStart = Math.floor(event.onset / pairTicks) * pairTicks;
    const posInPair = event.onset - pairStart;

    // Is this on the second subdivision of a pair?
    if (Math.abs(posInPair - gridTicks) < 0.5) {
      // Move it: ratio determines where the "and" falls within the pair
      const newPos = pairStart + Math.round(pairTicks * ratio);
      (event as { onset: number }).onset = newPos;
    }
  }
  return events;
}

/** Duration name → multiplier of quarter note (relative to ticksPerQuarter) */
const DURATION_MAP: ReadonlyArray<[string, number]> = [
  ['double whole', 8],
  ['dotted whole', 6],
  ['whole', 4],
  ['dotted half', 3],
  ['half', 2],
  ['dotted quarter', 1.5],
  ['quarter', 1],
  ['dotted eighth', 0.75],
  ['eighth', 0.5],
  ['dotted sixteenth', 0.375],
  ['sixteenth', 0.25],
  ['thirty-second', 0.125],
  ['sixty-fourth', 0.0625],
];

/**
 * Get symbolic duration name for a tick value.
 * Returns the closest standard duration name, or null for non-standard durations.
 * @param ticks — Duration in ticks.
 * @param ticksPerQuarter — Ticks per quarter note (default 480).
 * @returns The standard duration name (e.g., 'quarter', 'dotted eighth'), or null if non-standard.
 */
export function durationName(ticks: number, ticksPerQuarter = 480): string | null {
  if (ticks <= 0) return null;
  const ratio = ticks / ticksPerQuarter;

  for (const [name, mult] of DURATION_MAP) {
    if (Math.abs(ratio - mult) < 0.01) return name;
  }

  // Check for tuplets
  const tripletQuarter = 2 / 3;
  if (Math.abs(ratio - tripletQuarter) < 0.01) return 'triplet quarter';
  const tripletEighth = 1 / 3;
  if (Math.abs(ratio - tripletEighth) < 0.01) return 'triplet eighth';
  const tripletSixteenth = 1 / 6;
  if (Math.abs(ratio - tripletSixteenth) < 0.01) return 'triplet sixteenth';

  return null;
}

/**
 * Convert a symbolic duration name to ticks.
 * @param name — Duration name (e.g., 'quarter', 'dotted eighth', 'triplet quarter').
 * @param ticksPerQuarter — Ticks per quarter note (default 480).
 * @returns Duration in ticks.
 * @throws {Error} If name is not recognized.
 */
export function durationTicks(name: string, ticksPerQuarter = 480): number {
  const lower = name.toLowerCase().trim();

  for (const [dName, mult] of DURATION_MAP) {
    if (lower === dName) return Math.round(ticksPerQuarter * mult);
  }

  // Tuplets
  if (lower === 'triplet quarter') return Math.round(ticksPerQuarter * 2 / 3);
  if (lower === 'triplet eighth') return Math.round(ticksPerQuarter / 3);
  if (lower === 'triplet sixteenth') return Math.round(ticksPerQuarter / 6);

  throw new Error(`Unknown duration name: ${name}`);
}
