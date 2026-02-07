// ---------------------------------------------------------------------------
// Stratum — Information-Theoretic Expectation (IDyOM-inspired)
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

/**
 * A viewpoint function: maps a NoteEvent (with preceding context) to a
 * categorical symbol string.
 */
export type Viewpoint = (event: NoteEvent, context: readonly NoteEvent[]) => string;

/** Built-in viewpoint: pitch class (0-11). */
export const VIEWPOINT_PITCH: Viewpoint = (event: NoteEvent) =>
  String(event.pitch.pitchClass);

/** Built-in viewpoint: MIDI pitch. */
export const VIEWPOINT_MIDI: Viewpoint = (event: NoteEvent) =>
  String(event.pitch.midi);

/** Built-in viewpoint: melodic interval in semitones from previous note. */
export const VIEWPOINT_INTERVAL: Viewpoint = (
  event: NoteEvent,
  context: readonly NoteEvent[],
) => {
  if (context.length === 0) return '0';
  const prev = context[context.length - 1]!;
  return String(event.pitch.midi - prev.pitch.midi);
};

/** Built-in viewpoint: contour direction (up/down/same). */
export const VIEWPOINT_CONTOUR: Viewpoint = (
  event: NoteEvent,
  context: readonly NoteEvent[],
) => {
  if (context.length === 0) return 'same';
  const prev = context[context.length - 1]!;
  const diff = event.pitch.midi - prev.pitch.midi;
  if (diff > 0) return 'up';
  if (diff < 0) return 'down';
  return 'same';
};

/**
 * Built-in viewpoint: quantized duration category.
 * short < quarter, medium = quarter-half, long = half-whole, vlong > whole.
 * Uses a reference quarter = 480 ticks.
 */
export const VIEWPOINT_DURATION: Viewpoint = (event: NoteEvent) => {
  const quarter = 480;
  if (event.duration < quarter) return 'short';
  if (event.duration < quarter * 2) return 'medium';
  if (event.duration <= quarter * 4) return 'long';
  return 'vlong';
};

/**
 * Factory: create a scale degree viewpoint relative to a tonic.
 *
 * @param tonic - Tonic pitch class (0-11).
 * @returns Viewpoint that returns the scale degree (interval from tonic mod 12).
 */
export function viewpointScaleDegree(tonic: number): Viewpoint {
  return (event: NoteEvent) =>
    String(((event.pitch.pitchClass - tonic) % 12 + 12) % 12);
}

// ---------------------------------------------------------------------------
// Variable-order Markov Model
// ---------------------------------------------------------------------------

/** Variable-order Markov model with n-gram count tables. */
export interface MarkovModel {
  readonly maxOrder: number;
  readonly viewpoint: Viewpoint;
  readonly alphabet: readonly string[];
  readonly counts: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

/** Information content at a specific event. */
export interface ICPoint {
  readonly index: number;
  readonly symbol: string;
  readonly ic: number;
}

/** Entropy at a specific context position. */
export interface EntropyPoint {
  readonly index: number;
  readonly entropy: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 0.001;

function log2Safe(x: number): number {
  return x > 0 ? Math.log2(x) : 0;
}

/**
 * Build a context key from a symbol sequence.
 * Empty context = empty string.
 */
function contextKey(symbols: readonly string[], start: number, end: number): string {
  if (start >= end) return '';
  const parts: string[] = [];
  for (let i = start; i < end; i++) {
    parts.push(symbols[i] ?? '');
  }
  return parts.join(',');
}

/**
 * PPM-style probability estimation with escape to shorter contexts.
 * Uses add-epsilon smoothing at each level.
 */
function estimateProbability(
  symbol: string,
  contextStr: string,
  model: MarkovModel,
): number {
  // Try from longest context down to order-0
  const contextParts = contextStr.length > 0 ? contextStr.split(',') : [];

  for (let order = contextParts.length; order >= 0; order--) {
    const ctx = order > 0 ? contextParts.slice(contextParts.length - order).join(',') : '';
    const countMap = model.counts.get(ctx);

    if (countMap && countMap.size > 0) {
      const symbolCount = (countMap.get(symbol) ?? 0) + EPSILON;
      let totalCount = 0;
      for (const c of countMap.values()) {
        totalCount += c;
      }
      // Add epsilon for each alphabet symbol for smoothing
      totalCount += EPSILON * model.alphabet.length;
      return symbolCount / totalCount;
    }
  }

  // Fallback: uniform over alphabet
  return model.alphabet.length > 0 ? 1 / model.alphabet.length : 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a variable-order Markov model from note events using a viewpoint.
 *
 * For each order k from 0 to maxOrder, counts occurrences of each symbol
 * given the preceding k symbols as context.
 *
 * @param events - Note events (analyzed in order).
 * @param options - Optional viewpoint and max order.
 * @returns Frozen MarkovModel.
 * @throws {RangeError} If maxOrder < 1 or > 10.
 */
export function buildMarkovModel(
  events: readonly NoteEvent[],
  options?: {
    viewpoint?: Viewpoint;
    maxOrder?: number;
  },
): MarkovModel {
  const viewpoint = options?.viewpoint ?? VIEWPOINT_PITCH;
  const maxOrder = options?.maxOrder ?? 5;

  if (!Number.isInteger(maxOrder) || maxOrder < 1 || maxOrder > 10) {
    throw new RangeError(`maxOrder must be between 1 and 10 (got ${maxOrder})`);
  }

  // Convert events to symbols
  const symbols: string[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const ctx = events.slice(0, i);
    symbols.push(viewpoint(event, ctx));
  }

  // Collect alphabet
  const alphabetSet = new Set<string>();
  for (const s of symbols) {
    alphabetSet.add(s);
  }
  const alphabet = [...alphabetSet].sort();

  // Build count tables for each order
  const counts = new Map<string, Map<string, number>>();

  for (let order = 0; order <= maxOrder; order++) {
    for (let i = order; i < symbols.length; i++) {
      const sym = symbols[i]!;
      const ctx = contextKey(symbols, i - order, i);

      if (!counts.has(ctx)) {
        counts.set(ctx, new Map<string, number>());
      }
      const ctxMap = counts.get(ctx)!;
      ctxMap.set(sym, (ctxMap.get(sym) ?? 0) + 1);
    }
  }

  // Freeze the count maps
  const frozenCounts = new Map<string, ReadonlyMap<string, number>>();
  for (const [ctx, ctxMap] of counts) {
    frozenCounts.set(ctx, ctxMap);
  }

  return Object.freeze({
    maxOrder,
    viewpoint,
    alphabet: Object.freeze(alphabet),
    counts: frozenCounts,
  });
}

/**
 * Compute the information content (surprise) of a single event given
 * a model and preceding context.
 *
 * IC = -log2(P(symbol|context))
 *
 * @param event - The note event.
 * @param model - A MarkovModel.
 * @param context - Preceding note events.
 * @returns Information content in bits (non-negative).
 */
export function informationContent(
  event: NoteEvent,
  model: MarkovModel,
  context: readonly NoteEvent[],
): number {
  const symbol = model.viewpoint(event, context);

  // Build context string from preceding events
  const contextSymbols: string[] = [];
  for (let i = 0; i < context.length; i++) {
    const ctx = context.slice(0, i);
    contextSymbols.push(model.viewpoint(context[i]!, ctx));
  }

  const maxCtxLen = Math.min(contextSymbols.length, model.maxOrder);
  const ctxStr = maxCtxLen > 0
    ? contextSymbols.slice(contextSymbols.length - maxCtxLen).join(',')
    : '';

  const prob = estimateProbability(symbol, ctxStr, model);
  return -log2Safe(prob);
}

/**
 * Compute the Shannon entropy of the predictive distribution at a context
 * position.
 *
 * H = -Σ P(s|context) log2 P(s|context) for all symbols s in the alphabet.
 *
 * @param model - A MarkovModel.
 * @param context - Preceding note events.
 * @returns Entropy in bits (non-negative).
 */
export function contextEntropy(
  model: MarkovModel,
  context: readonly NoteEvent[],
): number {
  // Build context string
  const contextSymbols: string[] = [];
  for (let i = 0; i < context.length; i++) {
    const ctx = context.slice(0, i);
    contextSymbols.push(model.viewpoint(context[i]!, ctx));
  }

  const maxCtxLen = Math.min(contextSymbols.length, model.maxOrder);
  const ctxStr = maxCtxLen > 0
    ? contextSymbols.slice(contextSymbols.length - maxCtxLen).join(',')
    : '';

  let entropy = 0;
  for (const symbol of model.alphabet) {
    const prob = estimateProbability(symbol, ctxStr, model);
    if (prob > 0) {
      entropy -= prob * log2Safe(prob);
    }
  }

  return entropy;
}

/**
 * Compute a surprise curve: information content at each event position.
 *
 * @param events - Note events in sequence.
 * @param model - A MarkovModel.
 * @returns Frozen array of ICPoint.
 */
export function surpriseCurve(
  events: readonly NoteEvent[],
  model: MarkovModel,
): readonly ICPoint[] {
  if (events.length === 0) return Object.freeze([]);

  const result: ICPoint[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const ctx = events.slice(0, i);
    const symbol = model.viewpoint(event, ctx);
    const ic = informationContent(event, model, ctx);
    result.push(Object.freeze({ index: i, symbol, ic }));
  }

  return Object.freeze(result);
}

/**
 * Compute an entropy curve: predictive entropy at each context position.
 *
 * @param events - Note events in sequence.
 * @param model - A MarkovModel.
 * @returns Frozen array of EntropyPoint.
 */
export function entropyCurve(
  events: readonly NoteEvent[],
  model: MarkovModel,
): readonly EntropyPoint[] {
  if (events.length === 0) return Object.freeze([]);

  const result: EntropyPoint[] = [];
  for (let i = 0; i < events.length; i++) {
    const ctx = events.slice(0, i);
    const entropy = contextEntropy(model, ctx);
    result.push(Object.freeze({ index: i, entropy }));
  }

  return Object.freeze(result);
}

/**
 * Combine two models (short-term and long-term) via weighted geometric mean
 * of their predictive distributions.
 *
 * The combined model approximates P_combined ∝ P_stm^w × P_ltm^(1-w).
 * Merged count tables are synthesized to approximate this distribution.
 *
 * @param stm - Short-term model.
 * @param ltm - Long-term model.
 * @param weight - Weight for STM (0-1, default 0.5).
 * @returns Frozen combined MarkovModel.
 * @throws {RangeError} If weight is not in [0, 1].
 */
export function combineModels(
  stm: MarkovModel,
  ltm: MarkovModel,
  weight: number = 0.5,
): MarkovModel {
  if (weight < 0 || weight > 1) {
    throw new RangeError(`weight must be in [0, 1] (got ${weight})`);
  }

  // Merged alphabet
  const alphabetSet = new Set<string>();
  for (const s of stm.alphabet) alphabetSet.add(s);
  for (const s of ltm.alphabet) alphabetSet.add(s);
  const alphabet = [...alphabetSet].sort();

  // Use the higher maxOrder
  const maxOrder = Math.max(stm.maxOrder, ltm.maxOrder);

  // Use STM's viewpoint (they should use the same viewpoint; STM takes priority)
  const viewpoint = stm.viewpoint;

  // Merge count tables: for each context in either model, combine probabilities
  const allContexts = new Set<string>();
  for (const ctx of stm.counts.keys()) allContexts.add(ctx);
  for (const ctx of ltm.counts.keys()) allContexts.add(ctx);

  const mergedCounts = new Map<string, Map<string, number>>();

  for (const ctx of allContexts) {
    const stmCounts = stm.counts.get(ctx);
    const ltmCounts = ltm.counts.get(ctx);

    // Compute total counts for normalization
    let stmTotal = 0;
    let ltmTotal = 0;
    if (stmCounts) {
      for (const c of stmCounts.values()) stmTotal += c;
    }
    if (ltmCounts) {
      for (const c of ltmCounts.values()) ltmTotal += c;
    }

    const merged = new Map<string, number>();
    const scale = 1000; // scale factor for synthetic counts

    for (const sym of alphabet) {
      // Estimate probabilities from each model (with smoothing)
      const stmProb = stmTotal > 0
        ? ((stmCounts?.get(sym) ?? 0) + EPSILON) / (stmTotal + EPSILON * alphabet.length)
        : 1 / alphabet.length;
      const ltmProb = ltmTotal > 0
        ? ((ltmCounts?.get(sym) ?? 0) + EPSILON) / (ltmTotal + EPSILON * alphabet.length)
        : 1 / alphabet.length;

      // Geometric mean with weights
      const combinedProb = Math.pow(stmProb, weight) * Math.pow(ltmProb, 1 - weight);
      merged.set(sym, Math.round(combinedProb * scale));
    }

    mergedCounts.set(ctx, merged);
  }

  // Freeze
  const frozenCounts = new Map<string, ReadonlyMap<string, number>>();
  for (const [ctx, ctxMap] of mergedCounts) {
    frozenCounts.set(ctx, ctxMap);
  }

  return Object.freeze({
    maxOrder,
    viewpoint,
    alphabet: Object.freeze(alphabet),
    counts: frozenCounts,
  });
}
