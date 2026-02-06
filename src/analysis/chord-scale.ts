// ---------------------------------------------------------------------------
// Stratum — Chord-Scale Theory
// ---------------------------------------------------------------------------

import type { Scale } from '../pitch/scales.js';
import { SCALE_CATALOG, CHORD_CATALOG } from '../pitch/scales.js';
import { normalizePc } from '../pitch/pitch-class.js';
import type { ChordLabel } from './harmonic.js';

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
