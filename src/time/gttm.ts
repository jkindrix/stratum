// ---------------------------------------------------------------------------
// Stratum — GTTM-Inspired Preference Rules
// ---------------------------------------------------------------------------

import type { Score, NoteEvent } from '../core/types.js';
import { getAllEvents } from '../core/score.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Weights for Metrical Preference Rules (MPRs). */
export interface MPRWeights {
  /** Weight for onset density (default 1.0). */
  readonly onset?: number;
  /** Weight for duration emphasis (default 0.5). */
  readonly duration?: number;
  /** Weight for bass register (default 0.3). */
  readonly bass?: number;
  /** Weight for harmonic change (default 0.4). */
  readonly harmony?: number;
}

/** Result of metrical preference analysis at a single grid tick. */
export interface MetricalPreferenceResult {
  /** Tick position. */
  readonly tick: number;
  /** Total preference score at this tick. */
  readonly score: number;
  /** Individual contributions from each rule. */
  readonly contributions: {
    readonly onset: number;
    readonly duration: number;
    readonly bass: number;
    readonly harmony: number;
  };
}

/** Options for metrical preference analysis. */
export interface MetricalPreferenceOptions {
  /** Weights for preference rules. */
  readonly weights?: MPRWeights;
  /** Grid resolution in ticks (default: score's ticksPerQuarter). */
  readonly gridTicks?: number;
}

/** A grouping boundary detected between musical events. */
export interface GroupingBoundary {
  /** Tick position of the boundary. */
  readonly tick: number;
  /** Strength of the boundary (higher = stronger). */
  readonly strength: number;
  /** Names of rules that fired. */
  readonly rules: readonly string[];
}

/** Options for grouping boundary detection. */
export interface GroupingOptions {
  /** IOI ratio threshold for proximity rule (default 1.5). */
  readonly proximityRatio?: number;
  /** MIDI pitch change threshold for change rule (default 7). */
  readonly changeThreshold?: number;
  /** Weight for proximity rule (default 0.5). */
  readonly proximityWeight?: number;
  /** Weight for change rule (default 0.3). */
  readonly changeWeight?: number;
  /** Weight for symmetry rule (default 0.2). */
  readonly symmetryWeight?: number;
}

/** An entry in the hierarchical metrical grid. */
export interface MetricalGridEntry {
  /** Tick position. */
  readonly tick: number;
  /** Preference strength. */
  readonly strength: number;
  /** Hierarchical level (0 = weakest, higher = stronger). */
  readonly level: number;
}

// ---------------------------------------------------------------------------
// Metrical Preference Rules
// ---------------------------------------------------------------------------

/**
 * Compute metrical preference scores for a score using GTTM-inspired rules.
 *
 * Evaluates each grid position on:
 * - **Onset density:** How many notes begin at this position.
 * - **Duration:** Whether long notes begin here.
 * - **Bass:** Whether bass-register notes begin here.
 * - **Harmony:** Whether the pitch-class content changes here.
 *
 * @param score - The score to analyze.
 * @param options - Weights and grid resolution.
 * @returns Frozen array of MetricalPreferenceResult, one per grid tick.
 */
export function metricalPreference(
  score: Score,
  options?: MetricalPreferenceOptions,
): readonly MetricalPreferenceResult[] {
  const events = getAllEvents(score);
  if (events.length === 0) return Object.freeze([]);

  const grid = options?.gridTicks ?? score.settings.ticksPerQuarter;
  const weights: Required<MPRWeights> = {
    onset: options?.weights?.onset ?? 1.0,
    duration: options?.weights?.duration ?? 0.5,
    bass: options?.weights?.bass ?? 0.3,
    harmony: options?.weights?.harmony ?? 0.4,
  };

  // Find extent
  let maxTick = 0;
  for (const e of events) {
    const end = e.onset + e.duration;
    if (end > maxTick) maxTick = end;
  }

  const numTicks = Math.ceil(maxTick / grid);
  if (numTicks === 0) return Object.freeze([]);

  // Precompute: events at each grid tick
  const onsetsAt = new Map<number, NoteEvent[]>();
  for (const e of events) {
    const gridIdx = Math.round(e.onset / grid);
    const arr = onsetsAt.get(gridIdx);
    if (arr) {
      arr.push(e);
    } else {
      onsetsAt.set(gridIdx, [e]);
    }
  }

  // Find normalization factors
  let maxOnsetCount = 0;
  let maxDuration = 0;
  for (const e of events) {
    if (e.duration > maxDuration) maxDuration = e.duration;
  }
  for (const [, arr] of onsetsAt) {
    if (arr.length > maxOnsetCount) maxOnsetCount = arr.length;
  }
  if (maxOnsetCount === 0) maxOnsetCount = 1;
  if (maxDuration === 0) maxDuration = 1;

  // Previous pitch-class set for harmony change detection
  let prevPcs = new Set<number>();
  const results: MetricalPreferenceResult[] = [];

  for (let i = 0; i <= numTicks; i++) {
    const tick = i * grid;
    const onsets = onsetsAt.get(i) ?? [];

    // MPR 1: Onset density
    const onsetScore = onsets.length / maxOnsetCount;

    // MPR 2: Duration emphasis (normalized by max duration)
    let durationScore = 0;
    for (const e of onsets) {
      durationScore = Math.max(durationScore, e.duration / maxDuration);
    }

    // MPR 3: Bass register (lower MIDI = stronger)
    let bassScore = 0;
    for (const e of onsets) {
      // MIDI < 48 (below C3) gets full bass credit, linearly decreasing to 0 at 72
      const bassCredit = Math.max(0, (72 - e.pitch.midi) / 72);
      bassScore = Math.max(bassScore, bassCredit);
    }

    // MPR 4: Harmonic change
    const currPcs = new Set(onsets.map(e => e.pitch.pitchClass));
    let harmonyScore = 0;
    if (currPcs.size > 0 && prevPcs.size > 0) {
      // Count pitch classes that differ
      let changed = 0;
      for (const pc of currPcs) {
        if (!prevPcs.has(pc)) changed++;
      }
      harmonyScore = currPcs.size > 0 ? changed / currPcs.size : 0;
    }
    if (currPcs.size > 0) prevPcs = currPcs;

    const score =
      weights.onset * onsetScore +
      weights.duration * durationScore +
      weights.bass * bassScore +
      weights.harmony * harmonyScore;

    results.push(
      Object.freeze({
        tick,
        score,
        contributions: Object.freeze({
          onset: onsetScore,
          duration: durationScore,
          bass: bassScore,
          harmony: harmonyScore,
        }),
      }),
    );
  }

  return Object.freeze(results);
}

// ---------------------------------------------------------------------------
// Grouping Boundaries
// ---------------------------------------------------------------------------

/**
 * Detect grouping boundaries between events using GTTM-inspired rules.
 *
 * - **Proximity:** Large IOI gap suggests boundary.
 * - **Change:** Large pitch interval suggests boundary.
 * - **Symmetry:** Boundaries that create roughly equal-sized groups score higher.
 *
 * @param events - Note events (will be sorted by onset).
 * @param options - Rule thresholds and weights.
 * @returns Frozen array of GroupingBoundary sorted by tick.
 */
export function groupingBoundaries(
  events: readonly NoteEvent[],
  options?: GroupingOptions,
): readonly GroupingBoundary[] {
  if (events.length < 2) return Object.freeze([]);

  const sorted = [...events].sort((a, b) => a.onset - b.onset);
  const proxRatio = options?.proximityRatio ?? 1.5;
  const changeThr = options?.changeThreshold ?? 7;
  const proxW = options?.proximityWeight ?? 0.5;
  const changeW = options?.changeWeight ?? 0.3;
  const symW = options?.symmetryWeight ?? 0.2;

  // Compute IOIs
  const iois: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    iois.push((sorted[i]?.onset ?? 0) - (sorted[i - 1]?.onset ?? 0));
  }

  // Mean IOI for proximity threshold
  const meanIoi = iois.reduce((s, v) => s + v, 0) / iois.length;

  const boundaries: GroupingBoundary[] = [];

  for (let i = 0; i < iois.length; i++) {
    const ioi = iois[i] ?? 0;
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;
    const rules: string[] = [];
    let strength = 0;

    // GPR 2: Proximity (large IOI gap)
    if (meanIoi > 0 && ioi > meanIoi * proxRatio) {
      rules.push('proximity');
      strength += proxW * (ioi / (meanIoi * proxRatio));
    }

    // GPR 3: Change (large pitch interval)
    const pitchDiff = Math.abs(next.pitch.midi - curr.pitch.midi);
    if (pitchDiff >= changeThr) {
      rules.push('change');
      strength += changeW * (pitchDiff / 12);
    }

    // GPR 5: Symmetry (boundary creates balanced groups)
    if (rules.length > 0) {
      const leftSize = i + 1;
      const rightSize = sorted.length - i - 1;
      const balance = 1 - Math.abs(leftSize - rightSize) / sorted.length;
      strength += symW * balance;
      if (balance > 0.7) rules.push('symmetry');
    }

    if (rules.length > 0) {
      // Boundary tick is at the end of current event (or midpoint of gap)
      const boundaryTick = curr.onset + curr.duration;
      boundaries.push(
        Object.freeze({
          tick: boundaryTick,
          strength,
          rules: Object.freeze(rules),
        }),
      );
    }
  }

  return Object.freeze(boundaries);
}

// ---------------------------------------------------------------------------
// Hierarchical Meter
// ---------------------------------------------------------------------------

/**
 * Derive a hierarchical metrical grid from preference scores.
 *
 * Uses quantile-based thresholds to assign level 0 (weakest), 1, 2, 3 (strongest)
 * to each grid position based on metricalPreference scores.
 *
 * @param score - The score to analyze.
 * @returns Frozen array of MetricalGridEntry.
 */
export function hierarchicalMeter(score: Score): readonly MetricalGridEntry[] {
  const prefs = metricalPreference(score);
  if (prefs.length === 0) return Object.freeze([]);

  // Compute quantile thresholds from non-zero scores
  const scores = prefs.map(p => p.score).filter(s => s > 0);
  if (scores.length === 0) {
    return Object.freeze(
      prefs.map(p =>
        Object.freeze({ tick: p.tick, strength: p.score, level: 0 }),
      ),
    );
  }

  scores.sort((a, b) => a - b);
  const q25 = scores[Math.floor(scores.length * 0.25)] ?? 0;
  const q50 = scores[Math.floor(scores.length * 0.5)] ?? 0;
  const q75 = scores[Math.floor(scores.length * 0.75)] ?? 0;

  const entries: MetricalGridEntry[] = prefs.map(p => {
    let level: number;
    if (p.score >= q75) level = 3;
    else if (p.score >= q50) level = 2;
    else if (p.score >= q25) level = 1;
    else level = 0;

    return Object.freeze({ tick: p.tick, strength: p.score, level });
  });

  return Object.freeze(entries);
}
