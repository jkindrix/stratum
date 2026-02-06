// ---------------------------------------------------------------------------
// Stratum — Score Construction, Query, and Manipulation
// ---------------------------------------------------------------------------

import type { Score, Part, NoteEvent, Pitch, Articulation } from './types.js';

// ---------------------------------------------------------------------------
// Validation helpers (internal)
// ---------------------------------------------------------------------------

function assertMidi(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 127 || value !== Math.floor(value)) {
    throw new RangeError(`${label} must be an integer 0-127 (got ${value})`);
  }
}

function assertVelocity(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 127 || value !== Math.floor(value)) {
    throw new RangeError(`velocity must be an integer 0-127 (got ${value})`);
  }
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be > 0 (got ${value})`);
  }
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be >= 0 (got ${value})`);
  }
}

function assertPowerOfTwo(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || (value & (value - 1)) !== 0) {
    throw new RangeError(`${label} must be a positive power of 2 (got ${value})`);
  }
}


// ---------------------------------------------------------------------------
// ID generation (scoped per score, not global)
// ---------------------------------------------------------------------------

/**
 * Event ID counter map keyed by score identity.
 * Uses a WeakMap so scores can be garbage-collected.
 */
const scoreIdCounters = new WeakMap<Score, number>();

function nextEventId(score: Score): string {
  const n = (scoreIdCounters.get(score) ?? 0) + 1;
  scoreIdCounters.set(score, n);
  return `e_${n}`;
}

function nextPartId(score: Score): string {
  return `part_${score.parts.length + 1}`;
}

// ---------------------------------------------------------------------------
// Pitch construction (validated)
// ---------------------------------------------------------------------------

/**
 * Create a Pitch from a MIDI note number.
 * @param midi — MIDI note number (0-127).
 * @param centsDeviation — Optional microtonal offset in cents (default 0).
 * @throws {RangeError} If midi is outside 0-127.
 */
export function pitchFromMidi(midi: number, centsDeviation?: number): Pitch {
  assertMidi(midi, 'midi');
  const pitch: Pitch = {
    midi,
    pitchClass: midi % 12,
    octave: Math.floor(midi / 12) - 1,
  };
  if (centsDeviation !== undefined) {
    pitch.centsDeviation = centsDeviation;
  }
  return pitch;
}

// ---------------------------------------------------------------------------
// Score creation
// ---------------------------------------------------------------------------

/**
 * Create a new empty score with sensible defaults.
 *
 * @param options.title — Score title (default '').
 * @param options.composer — Composer name (default '').
 * @param options.ticksPerQuarter — Resolution in ticks per quarter note (default 480).
 * @param options.tuningHz — A4 reference frequency (default 440).
 * @param options.timeSignature — Initial time signature (default 4/4).
 * @param options.tempo — Initial tempo in BPM (default 120).
 * @throws {RangeError} If any numeric parameter is out of range.
 */
export function createScore(options?: {
  title?: string;
  composer?: string;
  ticksPerQuarter?: number;
  tuningHz?: number;
  timeSignature?: { numerator: number; denominator: number };
  tempo?: number;
}): Score {
  const o = options ?? {};

  const tpq = o.ticksPerQuarter ?? 480;
  assertPositive(tpq, 'ticksPerQuarter');
  if (!Number.isInteger(tpq)) {
    throw new RangeError(`ticksPerQuarter must be a positive integer (got ${tpq})`);
  }

  const tuningHz = o.tuningHz ?? 440;
  assertPositive(tuningHz, 'tuningHz');

  const tsNum = o.timeSignature?.numerator ?? 4;
  const tsDen = o.timeSignature?.denominator ?? 4;
  assertPositive(tsNum, 'timeSignature.numerator');
  assertPowerOfTwo(tsDen, 'timeSignature.denominator');

  const tempo = o.tempo ?? 120;
  assertPositive(tempo, 'tempo');

  return {
    metadata: {
      title: o.title ?? '',
      composer: o.composer ?? '',
    },
    settings: {
      ticksPerQuarter: tpq,
      tuningHz,
    },
    parts: [],
    timeSignatures: [{ numerator: tsNum, denominator: tsDen, atTick: 0 }],
    tempoChanges: [{ bpm: tempo, atTick: 0 }],
    keyCenters: [],
  };
}

// ---------------------------------------------------------------------------
// Part operations
// ---------------------------------------------------------------------------

/**
 * Add a part to the score.
 * @returns The created Part (also appended to score.parts).
 */
export function addPart(score: Score, options: {
  name: string;
  midiProgram?: number;
  midiChannel?: number;
}): Part {
  const prog = options.midiProgram ?? 0;
  assertMidi(prog, 'midiProgram');
  const ch = options.midiChannel ?? score.parts.length;
  if (!Number.isInteger(ch) || ch < 0 || ch > 15) {
    throw new RangeError(`midiChannel must be an integer 0-15 (got ${ch})`);
  }

  const part: Part = {
    id: nextPartId(score),
    name: options.name,
    midiProgram: prog,
    midiChannel: ch,
    events: [],
  };
  score.parts.push(part);
  return part;
}

/**
 * Remove a part from the score by its ID.
 * @returns The removed Part, or undefined if not found.
 */
export function removePart(score: Score, partId: string): Part | undefined {
  const idx = score.parts.findIndex(p => p.id === partId);
  if (idx < 0) return undefined;
  return score.parts.splice(idx, 1)[0];
}

// ---------------------------------------------------------------------------
// Note operations
// ---------------------------------------------------------------------------

/**
 * Add a note event to a part.
 * @returns The created NoteEvent (also appended to part.events).
 * @throws {RangeError} If any numeric parameter is out of range.
 */
export function addNote(score: Score, part: Part, options: {
  midi: number;
  onset: number;
  duration: number;
  velocity?: number;
  voice?: number;
  centsDeviation?: number;
  articulation?: Articulation;
}): NoteEvent {
  assertMidi(options.midi, 'midi');
  assertNonNegative(options.onset, 'onset');
  assertPositive(options.duration, 'duration');

  const velocity = options.velocity ?? 80;
  assertVelocity(velocity);

  const voice = options.voice ?? 0;
  assertNonNegative(voice, 'voice');

  const event: NoteEvent = {
    id: nextEventId(score),
    pitch: pitchFromMidi(options.midi, options.centsDeviation),
    onset: options.onset,
    duration: options.duration,
    velocity,
    voice,
  };
  if (options.articulation !== undefined) {
    event.articulation = options.articulation;
  }

  part.events.push(event);
  part.events.sort((a, b) => a.onset - b.onset);
  return event;
}

/**
 * Remove a note from a part by its event ID.
 * @returns The removed NoteEvent, or undefined if not found.
 */
export function removeNote(part: Part, noteId: string): NoteEvent | undefined {
  const idx = part.events.findIndex(e => e.id === noteId);
  if (idx < 0) return undefined;
  return part.events.splice(idx, 1)[0];
}

// ---------------------------------------------------------------------------
// Event queries
// ---------------------------------------------------------------------------

/**
 * Get all events across all parts, sorted by onset.
 * @param score - The score to query.
 * @returns All note events from all parts, sorted by onset tick.
 */
export function getAllEvents(score: Score): NoteEvent[] {
  return score.parts
    .flatMap(p => p.events)
    .sort((a, b) => a.onset - b.onset);
}

/**
 * Get events sounding at a specific tick.
 * @param score - The score to query.
 * @param tick - The tick position to check.
 * @returns Events whose onset-to-end range includes the given tick.
 */
export function getEventsAtTick(score: Score, tick: number): NoteEvent[] {
  return score.parts
    .flatMap(p => p.events)
    .filter(e => e.onset <= tick && e.onset + e.duration > tick);
}

/**
 * Get events whose onset falls within [startTick, endTick).
 * @param score - The score to query.
 * @param startTick - Inclusive start of the range.
 * @param endTick - Exclusive end of the range.
 * @returns Events with onsets in range, sorted by onset.
 */
export function getEventsInRange(score: Score, startTick: number, endTick: number): NoteEvent[] {
  return score.parts
    .flatMap(p => p.events)
    .filter(e => e.onset >= startTick && e.onset < endTick)
    .sort((a, b) => a.onset - b.onset);
}

// ---------------------------------------------------------------------------
// Timing conversions
// ---------------------------------------------------------------------------

/**
 * Convert a tick position to seconds using the score's tempo map.
 * Handles multiple tempo changes correctly.
 * @param score - The score whose tempo map to use.
 * @param tick - The tick position to convert.
 * @returns Time in seconds.
 */
export function tickToSeconds(score: Score, tick: number): number {
  const tpq = score.settings.ticksPerQuarter;
  let seconds = 0;
  let prevTick = 0;
  let bpm = score.tempoChanges[0]?.bpm ?? 120;

  for (const tc of score.tempoChanges) {
    if (tc.atTick >= tick) break;
    seconds += ((tc.atTick - prevTick) / tpq) * (60 / bpm);
    prevTick = tc.atTick;
    bpm = tc.bpm;
  }
  seconds += ((tick - prevTick) / tpq) * (60 / bpm);
  return seconds;
}

/**
 * Convert a time in seconds to the corresponding tick position
 * using the score's tempo map.
 * @param score - The score whose tempo map to use.
 * @param seconds - The time in seconds to convert.
 * @returns Tick position.
 */
export function secondsToTick(score: Score, seconds: number): number {
  const tpq = score.settings.ticksPerQuarter;
  let elapsed = 0;
  let prevTick = 0;
  let bpm = score.tempoChanges[0]?.bpm ?? 120;

  for (const tc of score.tempoChanges) {
    const segmentSeconds = ((tc.atTick - prevTick) / tpq) * (60 / bpm);
    if (elapsed + segmentSeconds >= seconds) {
      break;
    }
    elapsed += segmentSeconds;
    prevTick = tc.atTick;
    bpm = tc.bpm;
  }

  const remainingSeconds = seconds - elapsed;
  const ticksPerSecond = tpq * (bpm / 60);
  return prevTick + remainingSeconds * ticksPerSecond;
}

/**
 * Get the total duration of the score.
 * @returns Object with `ticks` (last event offset + duration) and `seconds`.
 */
export function getScoreDuration(score: Score): { ticks: number; seconds: number } {
  const allEvents = getAllEvents(score);
  if (allEvents.length === 0) return { ticks: 0, seconds: 0 };

  let maxTick = 0;
  for (const e of allEvents) {
    const end = e.onset + e.duration;
    if (end > maxTick) maxTick = end;
  }

  return { ticks: maxTick, seconds: tickToSeconds(score, maxTick) };
}

// ---------------------------------------------------------------------------
// Score-level operations
// ---------------------------------------------------------------------------

/**
 * Create a deep copy of a score. All nested objects are cloned.
 * @param score - The score to clone.
 * @returns A new Score with all parts, events, and metadata deeply copied.
 */
export function cloneScore(score: Score): Score {
  const clone: Score = {
    metadata: { ...score.metadata },
    settings: { ...score.settings },
    parts: score.parts.map(p => ({
      ...p,
      events: p.events.map(e => ({
        ...e,
        pitch: { ...e.pitch },
      })),
    })),
    timeSignatures: score.timeSignatures.map(ts => ({ ...ts })),
    tempoChanges: score.tempoChanges.map(tc => ({ ...tc })),
    keyCenters: score.keyCenters.map(kc => ({ ...kc })),
  };
  return clone;
}

/**
 * Merge multiple scores into a single score.
 *
 * Takes settings (TPQ, tuning, time signatures, tempos) from the first score.
 * Parts from all scores are concatenated. Event timings are preserved as-is
 * (no offset applied — all scores assumed to start at tick 0).
 * @param scores - Array of scores to merge.
 * @returns A new Score combining all parts from all input scores.
 */
export function mergeScores(scores: Score[]): Score {
  if (scores.length === 0) {
    return createScore();
  }

  const base = cloneScore(scores[0]!);

  for (let i = 1; i < scores.length; i++) {
    const s = scores[i]!;
    for (const part of s.parts) {
      const clonedPart: Part = {
        id: nextPartId(base),
        name: part.name,
        midiProgram: part.midiProgram,
        midiChannel: part.midiChannel,
        events: part.events.map(e => ({
          ...e,
          id: nextEventId(base),
          pitch: { ...e.pitch },
        })),
      };
      base.parts.push(clonedPart);
    }

    // Merge key centers from subsequent scores
    for (const kc of s.keyCenters) {
      base.keyCenters.push({ ...kc });
    }
  }

  // Sort key centers by tick
  base.keyCenters.sort((a, b) => a.atTick - b.atTick);

  return base;
}
