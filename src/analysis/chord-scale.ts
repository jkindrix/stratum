// ---------------------------------------------------------------------------
// Stratum — Chord-Scale Theory
// ---------------------------------------------------------------------------

import type { Scale } from '../pitch/scales.js';
import { SCALE_CATALOG } from '../pitch/scales.js';
import { normalizePc } from '../pitch/pitch-class.js';
import type { ChordLabel } from './harmonic.js';
import type { NoteEvent } from '../core/types.js';

/** Classification of a scale tone relative to a chord. */
export type ToneClassification = 'chord' | 'tension' | 'avoid';

/** A single tone in a chord-scale relationship. */
export interface ScaleTone {
  /** Pitch class (0-11). */
  readonly pc: number;
  /** Scale degree (1-based). */
  readonly degree: number;
  /** Classification relative to the chord. */
  readonly classification: ToneClassification;
}

/** A chord-scale match result with compatibility score. */
export interface ChordScaleMatch {
  /** The matching scale. */
  readonly scale: Scale;
  /** Root pitch class of the scale. */
  readonly root: number;
  /** Classification of each scale tone. */
  readonly tones: readonly ScaleTone[];
  /** Compatibility score (0-1). Higher = better fit. */
  readonly compatibility: number;
}

// ---- Internal helpers ----

function getChordPcs(chord: ChordLabel): Set<number> {
  return new Set(chord.pcs.map(pc => normalizePc(pc)));
}

function scaleDegreePcs(scale: Scale, root: number): number[] {
  const pcs: number[] = [normalizePc(root)];
  let acc = 0;
  for (let i = 0; i < scale.intervals.length - 1; i++) {
    acc += scale.intervals[i]!;
    pcs.push(normalizePc(root + acc));
  }
  return pcs;
}

function isHalfStepAboveAny(pc: number, chordTones: Set<number>): boolean {
  for (const ct of chordTones) {
    if (normalizePc(ct + 1) === pc) {
      return true;
    }
  }
  return false;
}

function isWholeStepAboveAny(pc: number, chordTones: Set<number>): boolean {
  for (const ct of chordTones) {
    if (normalizePc(ct + 2) === pc) {
      return true;
    }
  }
  return false;
}

// ---- Public API ----

/**
 * Classify each tone of a scale relative to a chord.
 *
 * - **chord**: The tone is a chord tone.
 * - **tension**: A diatonic extension (whole step above a chord tone, e.g., 9, 11, 13).
 * - **avoid**: A scale tone a half step above a chord tone (creates dissonance).
 *
 * @param chord - The chord to classify against.
 * @param scale - The scale to classify.
 * @param scaleRoot - Root pitch class of the scale (0-11).
 * @returns Frozen array of ScaleTone classifications.
 */
export function classifyTones(
  chord: ChordLabel,
  scale: Scale,
  scaleRoot: number,
): readonly ScaleTone[] {
  const chordTones = getChordPcs(chord);
  const degreePcs = scaleDegreePcs(scale, scaleRoot);

  const result: ScaleTone[] = [];
  for (let i = 0; i < degreePcs.length; i++) {
    const pc = degreePcs[i]!;
    let classification: ToneClassification;

    if (chordTones.has(pc)) {
      classification = 'chord';
    } else if (isHalfStepAboveAny(pc, chordTones)) {
      classification = 'avoid';
    } else if (isWholeStepAboveAny(pc, chordTones)) {
      classification = 'tension';
    } else {
      // Scale tones that aren't chord tones, half-step above, or whole-step above
      // are classified as tensions by default (safe extensions)
      classification = 'tension';
    }

    result.push(Object.freeze({ pc, degree: i + 1, classification }));
  }

  return Object.freeze(result);
}

/**
 * Find available tensions: scale tones that are safe extensions over a chord.
 *
 * @param chord - The chord to analyze.
 * @param scale - The scale context.
 * @param scaleRoot - Root pitch class of the scale (0-11).
 * @returns Frozen array of pitch classes classified as tensions.
 */
export function availableTensions(
  chord: ChordLabel,
  scale: Scale,
  scaleRoot: number,
): readonly number[] {
  const tones = classifyTones(chord, scale, scaleRoot);
  const result: number[] = [];
  for (const tone of tones) {
    if (tone.classification === 'tension') {
      result.push(tone.pc);
    }
  }
  return Object.freeze(result);
}

/**
 * Find avoid notes: scale tones that create dissonance with chord tones.
 *
 * @param chord - The chord to analyze.
 * @param scale - The scale context.
 * @param scaleRoot - Root pitch class of the scale (0-11).
 * @returns Frozen array of pitch classes classified as avoid notes.
 */
export function avoidNotes(
  chord: ChordLabel,
  scale: Scale,
  scaleRoot: number,
): readonly number[] {
  const tones = classifyTones(chord, scale, scaleRoot);
  const result: number[] = [];
  for (const tone of tones) {
    if (tone.classification === 'avoid') {
      result.push(tone.pc);
    }
  }
  return Object.freeze(result);
}

/**
 * Find all compatible scales for a chord, ranked by compatibility.
 *
 * Compatibility = (chord tones present in scale) / (total chord tones),
 * penalized if avoid notes are present.
 *
 * @param chord - The chord to match scales for.
 * @param root - Optional root pitch class to constrain scale root (0-11).
 * @returns Frozen array of ChordScaleMatch sorted by compatibility descending.
 */
export function chordScaleMatch(
  chord: ChordLabel,
  root?: number,
): readonly ChordScaleMatch[] {
  const chordTones = getChordPcs(chord);
  const roots = root !== undefined ? [normalizePc(root)] : Array.from({ length: 12 }, (_, i) => i);

  const matches: ChordScaleMatch[] = [];

  for (const scale of SCALE_CATALOG) {
    for (const r of roots) {
      const degreePcs = scaleDegreePcs(scale, r);
      const scalePcSet = new Set(degreePcs);

      // Count chord tones in scale
      let chordTonesInScale = 0;
      for (const ct of chordTones) {
        if (scalePcSet.has(ct)) {
          chordTonesInScale++;
        }
      }

      // Skip scales that don't contain all chord tones
      if (chordTonesInScale < chordTones.size) continue;

      const tones = classifyTones(chord, scale, r);
      const avoidCount = tones.filter(t => t.classification === 'avoid').length;

      // Compatibility: base = chord tone coverage, penalized by avoid notes
      const base = chordTonesInScale / chordTones.size;
      const penalty = avoidCount * 0.1;
      const compatibility = Math.max(0, base - penalty);

      matches.push(Object.freeze({
        scale,
        root: r,
        tones,
        compatibility,
      }));
    }
  }

  // Sort by compatibility descending
  matches.sort((a, b) => b.compatibility - a.compatibility);

  return Object.freeze(matches);
}

// ---- Extended chord-scale analysis ----

/** Classification of a note event in a harmonic context. */
export interface NoteHarmonyClassification {
  /** The classified note event. */
  readonly event: NoteEvent;
  /** Classification relative to the active chord. */
  readonly classification: ToneClassification;
}

/**
 * Compute a duration-weighted Harmonic Pitch-Class Profile from note events.
 *
 * Returns a 12-element array normalized to sum=1. If events is empty,
 * returns all zeros.
 *
 * @param events - Note events to analyze.
 * @returns Frozen 12-element pitch-class profile.
 */
export function hpcp(events: readonly NoteEvent[]): readonly number[] {
  const profile = new Array<number>(12).fill(0);
  let total = 0;

  for (const e of events) {
    const pc = e.pitch.pitchClass;
    profile[pc] = (profile[pc] ?? 0) + e.duration;
    total += e.duration;
  }

  if (total > 0) {
    for (let i = 0; i < 12; i++) {
      profile[i] = (profile[i] ?? 0) / total;
    }
  }

  return Object.freeze(profile);
}

/**
 * Compute cosine similarity between an observed HPCP and a binary scale template.
 *
 * @param profile - 12-element pitch-class profile.
 * @param scale - Scale to compare against.
 * @param root - Root pitch class (0-11).
 * @returns Cosine similarity in [0, 1].
 * @throws {RangeError} If profile.length !== 12.
 */
export function chordScaleScore(profile: readonly number[], scale: Scale, root: number): number {
  if (profile.length !== 12) {
    throw new RangeError(`profile must have 12 elements (got ${profile.length})`);
  }

  const pcs = scaleDegreePcs(scale, root);
  const template = new Array<number>(12).fill(0);
  for (const pc of pcs) {
    template[pc] = 1;
  }

  // Cosine similarity
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 12; i++) {
    const a = profile[i] ?? 0;
    const b = template[i] ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the best chord-scale match for a chord, ranked by observed HPCP similarity.
 *
 * Gets compatible scales via `chordScaleMatch`, then re-ranks them by cosine
 * similarity with the given pitch-class profile.
 *
 * @param profile - 12-element pitch-class profile.
 * @param chord - The chord to find scales for.
 * @param root - Optional root pitch class constraint (0-11).
 * @returns Best match, or null if no compatible scales found.
 * @throws {RangeError} If profile.length !== 12.
 */
export function bestChordScale(
  profile: readonly number[],
  chord: ChordLabel,
  root?: number,
): ChordScaleMatch | null {
  if (profile.length !== 12) {
    throw new RangeError(`profile must have 12 elements (got ${profile.length})`);
  }

  const matches = chordScaleMatch(chord, root);
  if (matches.length === 0) return null;

  let best = matches[0]!;
  let bestScore = chordScaleScore(profile, best.scale, best.root);

  for (let i = 1; i < matches.length; i++) {
    const m = matches[i]!;
    const s = chordScaleScore(profile, m.scale, m.root);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }

  return best;
}

/**
 * Classify each note event's pitch class relative to the active chord in a harmonic context.
 *
 * For each event, finds the chord active at that onset and classifies the note
 * via `classifyTones`. If no chord is active or the PC is not in the scale,
 * defaults to 'tension'.
 *
 * @param events - Note events to classify.
 * @param chords - Chords with onset and duration times.
 * @param scale - Scale context for classification.
 * @param scaleRoot - Root pitch class of the scale (0-11).
 * @returns Frozen array of NoteHarmonyClassification.
 */
export function analyzeOverHarmony(
  events: readonly NoteEvent[],
  chords: readonly { readonly chord: ChordLabel; readonly onset: number; readonly duration: number }[],
  scale: Scale,
  scaleRoot: number,
): readonly NoteHarmonyClassification[] {
  const results: NoteHarmonyClassification[] = [];

  for (const event of events) {
    // Find the chord active at this event's onset
    const activeChord = chords.find(
      c => event.onset >= c.onset && event.onset < c.onset + c.duration,
    );

    let classification: ToneClassification = 'tension'; // default

    if (activeChord) {
      const tones = classifyTones(activeChord.chord, scale, scaleRoot);
      const pc = normalizePc(event.pitch.pitchClass);
      const match = tones.find(t => t.pc === pc);
      if (match) {
        classification = match.classification;
      }
    }

    results.push(Object.freeze({ event, classification }));
  }

  return Object.freeze(results);
}
