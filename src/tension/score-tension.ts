// ---------------------------------------------------------------------------
// Stratum — Score-Level Tension Curves
// ---------------------------------------------------------------------------
//
// Combines three tension models (TPS, Spiral Array, TIV) into composite
// score-level tension curves. Each model is windowed independently and then
// fused via a weighted sum.

import type { Score, NoteEvent } from '../core/types.js';
import type { CurvePoint } from '../analysis/structural.js';
import type { TPSKey } from './tps.js';
import { basicSpace, tpsDistance } from './tps.js';
import { centerOfEffect, tensileStrain } from './spiral-array.js';
import { chromaVector, tiv, tivConsonance } from './tiv.js';
import { detectKey } from '../analysis/key-detection.js';

/** A tension measurement at a specific tick using multiple models. */
export interface ScoreTensionPoint {
  /** Tick position. */
  readonly tick: number;
  /** TPS distance from local context. */
  readonly tps: number;
  /** Spiral Array tensile strain. */
  readonly spiral: number;
  /** TIV-based tension (1 - normalized consonance). */
  readonly tiv: number;
  /** Weighted composite tension. */
  readonly composite: number;
}

/** Options for score-level tension analysis. */
export interface ScoreTensionOptions {
  /** Ticks per analysis window (default: ticksPerQuarter). */
  readonly windowSize?: number;
  /** Hop between windows (default: windowSize). */
  readonly hopSize?: number;
  /** Weights for each model in the composite. */
  readonly weights?: {
    readonly tps?: number;
    readonly spiral?: number;
    readonly tiv?: number;
  };
  /** Key context. Auto-detected if not provided. */
  readonly key?: { readonly tonic: number; readonly mode: 'major' | 'minor' };
}

// ---- Internal helpers ----

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function keyScalePcs(key: TPSKey): number[] {
  const template = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  return template.map(d => (d + key.tonic) % 12);
}

function getWindowEvents(allEvents: NoteEvent[], start: number, end: number): NoteEvent[] {
  return allEvents.filter(e => e.onset < end && e.onset + e.duration > start);
}

function windowChroma(events: NoteEvent[]): number[] {
  return chromaVector(events);
}

function windowPcs(events: NoteEvent[]): number[] {
  const set = new Set<number>();
  for (const e of events) {
    set.add(e.pitch.pitchClass);
  }
  return [...set];
}

function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  let max = 0;
  for (const v of values) {
    if (v > max) max = v;
  }
  if (max === 0) return values.map(() => 0);
  return values.map(v => v / max);
}

// ---- Public API ----

/**
 * Compute a TPS-only tension curve over the score.
 *
 * Measures TPS distance between adjacent windows. The first window has
 * tension 0 (no prior context to compare against).
 *
 * @param score - The score to analyze.
 * @param key - Key context.
 * @param windowSize - Ticks per window (default: ticksPerQuarter).
 * @returns Frozen array of CurvePoints.
 */
export function tpsTensionCurve(
  score: Score,
  key: TPSKey,
  windowSize?: number,
): readonly CurvePoint[] {
  const tpq = score.settings.ticksPerQuarter;
  const ws = windowSize ?? tpq;
  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) return Object.freeze([]);

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const results: CurvePoint[] = [];

  let prevChord: { root: number; pcs: readonly number[] } | null = null;

  for (let start = 0; start < maxTick; start += ws) {
    const end = start + ws;
    const events = getWindowEvents(allEvents, start, end);
    const pcs = windowPcs(events);

    if (pcs.length === 0) {
      results.push(Object.freeze({ tick: start, value: 0 }));
      prevChord = null;
      continue;
    }

    const chord = { root: pcs[0]!, pcs };

    if (prevChord === null) {
      results.push(Object.freeze({ tick: start, value: 0 }));
    } else {
      const dist = tpsDistance(
        { root: prevChord.root, pcs: prevChord.pcs },
        key,
        { root: chord.root, pcs: chord.pcs },
        key,
      );
      results.push(Object.freeze({ tick: start, value: dist }));
    }

    prevChord = chord;
  }

  return Object.freeze(results);
}

/**
 * Compute a Spiral Array tensile strain curve over the score.
 *
 * Measures the distance between each window's centroid and the key's centroid.
 *
 * @param score - The score to analyze.
 * @param key - Key context.
 * @param windowSize - Ticks per window (default: ticksPerQuarter).
 * @returns Frozen array of CurvePoints.
 */
export function spiralTensionCurve(
  score: Score,
  key: TPSKey,
  windowSize?: number,
): readonly CurvePoint[] {
  const tpq = score.settings.ticksPerQuarter;
  const ws = windowSize ?? tpq;
  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) return Object.freeze([]);

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const keyPcs = keyScalePcs(key);
  const results: CurvePoint[] = [];

  for (let start = 0; start < maxTick; start += ws) {
    const end = start + ws;
    const events = getWindowEvents(allEvents, start, end);
    const pcs = windowPcs(events);

    if (pcs.length === 0) {
      results.push(Object.freeze({ tick: start, value: 0 }));
      continue;
    }

    const strain = tensileStrain(pcs, keyPcs);
    results.push(Object.freeze({ tick: start, value: strain }));
  }

  return Object.freeze(results);
}

/**
 * Compute a TIV-based tension curve over the score.
 *
 * TIV tension = 1 - (consonance / maxConsonance). Higher values mean more
 * dissonant. maxConsonance is the maximum observed across all windows,
 * ensuring the curve is normalized to [0, 1].
 *
 * @param score - The score to analyze.
 * @param windowSize - Ticks per window (default: ticksPerQuarter).
 * @returns Frozen array of CurvePoints.
 */
export function tivTensionCurve(
  score: Score,
  windowSize?: number,
): readonly CurvePoint[] {
  const tpq = score.settings.ticksPerQuarter;
  const ws = windowSize ?? tpq;
  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) return Object.freeze([]);

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const consonances: number[] = [];
  const ticks: number[] = [];

  for (let start = 0; start < maxTick; start += ws) {
    const end = start + ws;
    const events = getWindowEvents(allEvents, start, end);
    const chroma = windowChroma(events);

    const cons = tivConsonance(chroma);
    consonances.push(cons);
    ticks.push(start);
  }

  // Normalize: find max consonance
  let maxCons = 0;
  for (const c of consonances) {
    if (c > maxCons) maxCons = c;
  }

  const results: CurvePoint[] = [];
  for (let i = 0; i < consonances.length; i++) {
    const tension = maxCons > 0 ? 1 - (consonances[i] ?? 0) / maxCons : 0;
    results.push(Object.freeze({ tick: ticks[i]!, value: tension }));
  }

  return Object.freeze(results);
}

/**
 * Compute a composite score-level tension curve using all three models.
 *
 * Each model's values are normalized to [0, 1] and then combined with
 * configurable weights (default: TPS=0.4, Spiral=0.3, TIV=0.3).
 *
 * @param score - The score to analyze.
 * @param options - Configuration for window size, hop, weights, and key.
 * @returns Frozen array of ScoreTensionPoints.
 */
export function scoreTension(
  score: Score,
  options?: ScoreTensionOptions,
): readonly ScoreTensionPoint[] {
  const tpq = score.settings.ticksPerQuarter;
  const ws = options?.windowSize ?? tpq;
  const hop = options?.hopSize ?? ws;
  const wTps = options?.weights?.tps ?? 0.4;
  const wSpiral = options?.weights?.spiral ?? 0.3;
  const wTiv = options?.weights?.tiv ?? 0.3;

  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) return Object.freeze([]);

  // Detect or use provided key
  let key: TPSKey;
  if (options?.key) {
    key = options.key;
  } else {
    const detected = detectKey(score);
    key = { tonic: detected.best.tonic, mode: detected.best.mode };
  }

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const keyPcs = keyScalePcs(key);

  // Collect raw values per window
  const tpsRaw: number[] = [];
  const spiralRaw: number[] = [];
  const tivRaw: number[] = [];
  const windowTicks: number[] = [];

  let prevChord: { root: number; pcs: readonly number[] } | null = null;

  for (let start = 0; start < maxTick; start += hop) {
    const end = start + ws;
    const events = getWindowEvents(allEvents, start, end);
    const pcs = windowPcs(events);
    const chroma = windowChroma(events);

    windowTicks.push(start);

    // TPS: distance between adjacent windows
    if (pcs.length === 0) {
      tpsRaw.push(0);
      spiralRaw.push(0);
      tivRaw.push(0);
      prevChord = null;
      continue;
    }

    const chord = { root: pcs[0]!, pcs };

    if (prevChord === null) {
      tpsRaw.push(0);
    } else {
      tpsRaw.push(tpsDistance(
        { root: prevChord.root, pcs: prevChord.pcs },
        key,
        { root: chord.root, pcs: chord.pcs },
        key,
      ));
    }
    prevChord = chord;

    // Spiral: tensile strain
    spiralRaw.push(tensileStrain(pcs, keyPcs));

    // TIV: consonance (inverted later)
    tivRaw.push(tivConsonance(chroma));
  }

  // Normalize each dimension
  const tpsNorm = normalize(tpsRaw);
  const spiralNorm = normalize(spiralRaw);

  // TIV: invert consonance → tension
  let maxCons = 0;
  for (const c of tivRaw) {
    if (c > maxCons) maxCons = c;
  }
  const tivNorm = tivRaw.map(c => maxCons > 0 ? 1 - c / maxCons : 0);

  // Build composite
  const results: ScoreTensionPoint[] = [];
  for (let i = 0; i < windowTicks.length; i++) {
    const t = tpsNorm[i] ?? 0;
    const s = spiralNorm[i] ?? 0;
    const v = tivNorm[i] ?? 0;
    const composite = wTps * t + wSpiral * s + wTiv * v;

    results.push(Object.freeze({
      tick: windowTicks[i]!,
      tps: t,
      spiral: s,
      tiv: v,
      composite,
    }));
  }

  return Object.freeze(results);
}
