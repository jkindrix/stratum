// ---------------------------------------------------------------------------
// Stratum — Textural Analysis
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Texture classification at a point in time. */
export type TextureClass = 'monophonic' | 'homophonic' | 'polyphonic' | 'homorhythmic' | 'silence';

/** Texture at a specific time point. */
export interface TexturePoint {
  readonly tick: number;
  readonly texture: TextureClass;
  readonly voiceCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Count the number of simultaneously sounding voices at a given tick.
 *
 * @param events — Note events to inspect.
 * @param tick — The time point to query.
 * @returns Number of distinct voices sounding at `tick`.
 */
export function voiceCount(events: readonly NoteEvent[], tick: number): number {
  const activeVoices = new Set<number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.onset <= tick && e.onset + e.duration > tick) {
      activeVoices.add(e.voice);
    }
  }
  return activeVoices.size;
}

/**
 * Classify the texture at a specific time point.
 *
 * Classification logic:
 * - 0 active voices → `silence`
 * - 1 active voice → `monophonic`
 * - Multiple voices → determined by `rhythmicIndependence` of active events
 *
 * For multi-voice texture, events sounding at the tick are grouped by voice
 * and rhythmic independence is evaluated. Low independence with shared onsets
 * → `homorhythmic`; moderate independence → `homophonic`; high → `polyphonic`.
 *
 * @param events — Note events (should include voice assignments).
 * @param tick — The time point to classify.
 * @returns The texture class at the given tick.
 */
export function textureType(events: readonly NoteEvent[], tick: number): TextureClass {
  // Gather events active at tick, grouped by voice
  const voiceGroups = new Map<number, NoteEvent[]>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.onset <= tick && e.onset + e.duration > tick) {
      const group = voiceGroups.get(e.voice);
      if (group) {
        group.push(e);
      } else {
        voiceGroups.set(e.voice, [e]);
      }
    }
  }

  const numVoices = voiceGroups.size;

  if (numVoices === 0) return 'silence';
  if (numVoices === 1) return 'monophonic';

  // For multi-voice: look at a window around the tick to assess rhythmic independence
  // Use a window of events that overlap [tick - windowHalf, tick + windowHalf]
  const windowHalf = 480; // quarter note window
  const windowStart = tick - windowHalf;
  const windowEnd = tick + windowHalf;

  // Collect onset sets per voice within the window
  const voiceOnsets = new Map<number, Set<number>>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.onset >= windowStart && e.onset < windowEnd) {
      const set = voiceOnsets.get(e.voice);
      if (set) {
        set.add(e.onset);
      } else {
        voiceOnsets.set(e.voice, new Set([e.onset]));
      }
    }
  }

  // If only one voice has onsets in the window, can't compute independence
  const voiceKeys = [...voiceOnsets.keys()];
  if (voiceKeys.length < 2) return 'homophonic';

  // Calculate pairwise rhythmic independence
  let totalIndep = 0;
  let pairCount = 0;

  for (let a = 0; a < voiceKeys.length; a++) {
    for (let b = a + 1; b < voiceKeys.length; b++) {
      const setA = voiceOnsets.get(voiceKeys[a]!)!;
      const setB = voiceOnsets.get(voiceKeys[b]!)!;
      totalIndep += jaccard(setA, setB);
      pairCount++;
    }
  }

  const meanIndep = pairCount > 0 ? totalIndep / pairCount : 0;

  // Check if all voices share the same onsets (homorhythmic)
  if (meanIndep < 0.2) return 'homorhythmic';
  if (meanIndep < 0.4) return 'homophonic';
  return 'polyphonic';
}

/**
 * Compute rhythmic independence between two voices as a Jaccard distance
 * of their onset sets.
 *
 * Returns 0 when onset patterns are identical and 1 when fully independent
 * (no shared onsets).
 *
 * @param voice1 — Events of the first voice.
 * @param voice2 — Events of the second voice.
 * @param gridTicks — Optional quantization grid size. When provided, onsets
 *   are snapped to the nearest grid position before comparison.
 * @returns Jaccard distance in [0, 1].
 */
export function rhythmicIndependence(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
  gridTicks?: number,
): number {
  if (voice1.length === 0 && voice2.length === 0) return 0;
  if (voice1.length === 0 || voice2.length === 0) return 1;

  const snap = (onset: number): number => {
    if (gridTicks === undefined || gridTicks <= 0) return onset;
    return Math.round(onset / gridTicks) * gridTicks;
  };

  const setA = new Set(voice1.map((e) => snap(e.onset)));
  const setB = new Set(voice2.map((e) => snap(e.onset)));

  return jaccard(setA, setB);
}

/**
 * Produce a texture classification curve over the score duration.
 *
 * @param events — Note events (with voice assignments).
 * @param windowSize — Size of the analysis window in ticks.
 * @param stepSize — Step between successive analysis points (default = windowSize).
 * @returns Array of texture points at each window position.
 */
export function textureProfile(
  events: readonly NoteEvent[],
  windowSize: number,
  stepSize?: number,
): readonly TexturePoint[] {
  if (events.length === 0) return Object.freeze([]);
  if (windowSize <= 0) {
    throw new RangeError(`windowSize must be > 0 (got ${windowSize})`);
  }

  const step = stepSize ?? windowSize;
  if (step <= 0) {
    throw new RangeError(`stepSize must be > 0 (got ${step})`);
  }

  // Find score extent
  let maxEnd = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const end = e.onset + e.duration;
    if (end > maxEnd) maxEnd = end;
  }

  const points: TexturePoint[] = [];

  for (let tick = 0; tick < maxEnd; tick += step) {
    const midTick = tick + Math.floor(windowSize / 2);
    const texture = textureType(events, midTick);
    const vc = voiceCount(events, midTick);
    points.push(Object.freeze({ tick, texture, voiceCount: vc }));
  }

  return Object.freeze(points);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Jaccard distance between two sets: 1 - |A∩B| / |A∪B|. */
function jaccard(setA: Set<number>, setB: Set<number>): number {
  let intersection = 0;
  for (const val of setA) {
    if (setB.has(val)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return 1 - intersection / union;
}
