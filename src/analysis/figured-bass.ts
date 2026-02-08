// ---------------------------------------------------------------------------
// Stratum — Figured Bass Realization & Analysis
// ---------------------------------------------------------------------------

import type { Score } from '../core/types.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type FBAccidental = '#' | 'b' | 'n';

export interface FBInterval {
  readonly interval: number;
  readonly accidental: FBAccidental | null;
}

export interface ParsedFiguredBass {
  readonly raw: string;
  readonly intervals: readonly FBInterval[];
}

export interface FiguredBassKey {
  readonly tonic: number;
  readonly mode: 'major' | 'minor';
}

export interface RealizedChord {
  readonly midi: readonly number[];
  readonly pitchClasses: readonly number[];
}

export interface FiguredBassAnalysisOptions {
  readonly key?: FiguredBassKey;
  readonly windowSize?: number;
}

export interface FiguredBassEvent {
  readonly tick: number;
  readonly bassMidi: number;
  readonly bassPc: number;
  readonly figures: string;
  readonly intervals: readonly FBInterval[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAJOR_SCALE: readonly number[] = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE: readonly number[] = [0, 2, 3, 5, 7, 8, 10];

/** Canonical abbreviation → expanded generic intervals (descending order) */
const ABBREVIATION_TABLE = new Map<string, readonly number[]>([
  ['', [5, 3]],
  ['5', [5, 3]],
  ['5/3', [5, 3]],
  ['6', [6, 3]],
  ['6/3', [6, 3]],
  ['6/4', [6, 4]],
  ['7', [7, 5, 3]],
  ['7/5/3', [7, 5, 3]],
  ['6/5', [6, 5, 3]],
  ['6/5/3', [6, 5, 3]],
  ['4/3', [6, 4, 3]],
  ['6/4/3', [6, 4, 3]],
  ['4/2', [6, 4, 2]],
  ['6/4/2', [6, 4, 2]],
  ['2', [6, 4, 2]],
]);

/**
 * Reverse table: sorted interval key → shortest figured bass abbreviation.
 * Used by figuredBassAnalysis to label detected chords.
 */
const REVERSE_TABLE = new Map<string, string>([
  ['3,5', ''],
  ['3,6', '6'],
  ['4,6', '6/4'],
  ['3,5,7', '7'],
  ['3,5,6', '6/5'],
  ['3,4,6', '4/3'],
  ['2,4,6', '4/2'],
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function buildDiatonicScale(tonic: number, mode: 'major' | 'minor'): readonly number[] {
  const template = mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  return template.map(s => (s + tonic) % 12);
}

function findScaleDegreeIndex(pc: number, scale: readonly number[]): number {
  const exact = scale.indexOf(pc);
  if (exact !== -1) return exact;
  // nearest by minimal semitone distance
  let best = 0;
  let bestDist = 12;
  for (let i = 0; i < scale.length; i++) {
    const s = scale[i] ?? 0;
    const d = Math.min(((pc - s) % 12 + 12) % 12, ((s - pc) % 12 + 12) % 12);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function diatonicPcAbove(bassDegreeIndex: number, genericInterval: number, scale: readonly number[]): number {
  const targetDegree = (bassDegreeIndex + genericInterval - 1) % 7;
  return scale[targetDegree] ?? 0;
}

function isAccidental(ch: string): ch is FBAccidental {
  return ch === '#' || ch === 'b' || ch === 'n';
}

function parseToken(token: string): FBInterval {
  let accidental: FBAccidental | null = null;
  let numStr = token;

  if (numStr.length > 0 && isAccidental(numStr[0]!)) {
    accidental = numStr[0] as FBAccidental;
    numStr = numStr.slice(1);
  }

  // Bare accidental without number → applies to 3rd
  if (numStr === '') {
    return { interval: 3, accidental };
  }

  const n = Number(numStr);
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`Invalid figured bass token: "${token}"`);
  }

  return { interval: n, accidental };
}

function intervalsToFigures(intervals: readonly FBInterval[]): string {
  const nums = intervals.map(i => i.interval).sort((a, b) => a - b);
  const key = nums.join(',');
  return REVERSE_TABLE.get(key) ?? nums.join('/');
}

// ── Public Functions ───────────────────────────────────────────────────────

/**
 * Parse a figured bass string into structured interval data.
 *
 * Supports standard abbreviations:
 * - `""` or `"5/3"` → root position [5,3]
 * - `"6"` → first inversion [6,3]
 * - `"6/4"` → second inversion [6,4]
 * - `"7"` → seventh root position [7,5,3]
 * - `"6/5"` → seventh 1st inversion [6,5,3]
 * - `"4/3"` → seventh 2nd inversion [6,4,3]
 * - `"4/2"` or `"2"` → seventh 3rd inversion [6,4,2]
 * - Accidentals: `"#6"`, `"b"`, `"#"` modify intervals
 *
 * @param figures - Figured bass string to parse (e.g. "", "6", "7", "#6/4")
 * @returns Parsed representation with raw input and structured intervals
 * @throws {RangeError} If a token contains an invalid interval number.
 */
export function parseFiguredBass(figures: string): ParsedFiguredBass {
  const raw = figures.trim();

  // Extract accidentals from tokens, build a clean lookup key
  if (raw === '') {
    const ints = ABBREVIATION_TABLE.get('')!;
    return Object.freeze({
      raw,
      intervals: Object.freeze(ints.map(n => Object.freeze({ interval: n, accidental: null }))),
    });
  }

  // Split on '/'
  const tokens = raw.split('/');
  const parsed = tokens.map(t => parseToken(t.trim()));

  // Build a lookup key from just the numbers (without accidentals)
  const numericKey = parsed.map(p => p.interval).join('/');

  // Check if the numeric key (or raw) matches an abbreviation
  const expanded = ABBREVIATION_TABLE.get(numericKey) ?? ABBREVIATION_TABLE.get(raw);

  if (expanded) {
    // Map accidentals from parsed tokens onto expanded intervals
    const accMap = new Map<number, FBAccidental | null>();
    for (const p of parsed) {
      if (p.accidental !== null) {
        accMap.set(p.interval, p.accidental);
      }
    }
    const intervals = expanded.map(n =>
      Object.freeze({ interval: n, accidental: accMap.get(n) ?? null }),
    );
    return Object.freeze({ raw, intervals: Object.freeze(intervals) });
  }

  // Not an abbreviation — use tokens as-is, sorted descending
  const sorted = [...parsed].sort((a, b) => b.interval - a.interval);
  return Object.freeze({
    raw,
    intervals: Object.freeze(sorted.map(i => Object.freeze({ ...i }))),
  });
}

/**
 * Realize a figured bass notation into concrete MIDI pitches.
 *
 * @param bass - MIDI note number of the bass note (0-127)
 * @param figures - Figured bass string (e.g. "", "6", "7", "6/4")
 * @param key - Optional key context (defaults to C major)
 * @returns Realized chord with bass first, upper voices ascending
 */
export function realizeFiguredBass(
  bass: number,
  figures: string,
  key?: FiguredBassKey,
): RealizedChord {
  if (!Number.isInteger(bass) || bass < 0 || bass > 127) {
    throw new RangeError(`Bass MIDI must be integer 0-127, got ${bass}`);
  }

  const k = key ?? { tonic: 0, mode: 'major' as const };
  const scale = buildDiatonicScale(k.tonic, k.mode);
  const bassPc = bass % 12;
  const bassDegree = findScaleDegreeIndex(bassPc, scale);

  const parsed = parseFiguredBass(figures);
  const upperPcs: number[] = [];

  for (const fb of parsed.intervals) {
    let pc = diatonicPcAbove(bassDegree, fb.interval, scale);

    // Apply accidental
    if (fb.accidental === '#') pc = (pc + 1) % 12;
    else if (fb.accidental === 'b') pc = (pc - 1 + 12) % 12;
    // 'n' = natural, no modification beyond diatonic

    upperPcs.push(pc);
  }

  // Place upper notes above bass MIDI, ascending
  const midi: number[] = [bass];
  let lastMidi = bass;

  // Sort upper PCs for ascending placement
  const placedMidis: number[] = [];
  for (const pc of upperPcs) {
    // Find nearest pitch of this PC above lastMidi
    const baseOctaveMidi = Math.floor(lastMidi / 12) * 12 + pc;
    let m = baseOctaveMidi;
    if (m <= lastMidi) m += 12;
    // Clamp to MIDI range
    if (m > 127) m -= 12;
    placedMidis.push(m);
  }

  // Sort ascending and add
  placedMidis.sort((a, b) => a - b);
  midi.push(...placedMidis);

  const pitchClasses = midi.map(m => m % 12);

  return Object.freeze({
    midi: Object.freeze(midi),
    pitchClasses: Object.freeze(pitchClasses),
  });
}

/**
 * Analyze a score to extract figured bass events.
 *
 * Groups simultaneous notes, identifies bass, and infers figured bass
 * notation from the diatonic intervals of upper voices above the bass.
 *
 * @param score - The score to analyze
 * @param options - Optional key and window size
 * @returns Array of figured bass events
 */
export function figuredBassAnalysis(
  score: Score,
  options?: FiguredBassAnalysisOptions,
): readonly FiguredBassEvent[] {
  // Determine key
  let fbKey: FiguredBassKey;
  if (options?.key) {
    fbKey = options.key;
  } else if (score.keyCenters.length > 0) {
    const kc = score.keyCenters[0]!;
    fbKey = {
      tonic: kc.tonic,
      mode: kc.mode === 'minor' ? 'minor' : 'major',
    };
  } else {
    fbKey = { tonic: 0, mode: 'major' };
  }

  const scale = buildDiatonicScale(fbKey.tonic, fbKey.mode);
  const windowSize = options?.windowSize ?? 0;

  // Flatten all events
  const allEvents = score.parts.flatMap(p => p.events);
  if (allEvents.length === 0) return Object.freeze([]);

  // Sort by onset
  const sorted = [...allEvents].sort((a, b) => a.onset - b.onset);

  // Group by onset (within windowSize tolerance)
  const groups: { onset: number; events: typeof sorted }[] = [];
  let currentGroup: { onset: number; events: typeof sorted } | null = null;

  for (const ev of sorted) {
    if (currentGroup === null || ev.onset - currentGroup.onset > windowSize) {
      currentGroup = { onset: ev.onset, events: [ev] };
      groups.push(currentGroup);
    } else {
      currentGroup.events.push(ev);
    }
  }

  // Analyze each group
  const results: FiguredBassEvent[] = [];

  for (const group of groups) {
    if (group.events.length < 2) continue;

    // Find bass (lowest MIDI)
    const basEv = group.events.reduce((lo, ev) =>
      ev.pitch.midi < lo.pitch.midi ? ev : lo,
    );
    const bassMidi = basEv.pitch.midi;
    const bassPc = bassMidi % 12;
    const bassDegree = findScaleDegreeIndex(bassPc, scale);

    // Compute diatonic intervals of upper notes
    const upperEvents = group.events.filter(ev => ev !== basEv);
    const fbIntervals: FBInterval[] = [];

    for (const ev of upperEvents) {
      const upperPc = ev.pitch.pitchClass;
      const upperDegree = findScaleDegreeIndex(upperPc, scale);

      // Generic interval (1-based diatonic distance)
      let generic = ((upperDegree - bassDegree) % 7 + 7) % 7;
      if (generic === 0) generic = 7; // unison → octave above
      generic += 1; // convert 0-based offset to 1-based interval

      // Check for accidentals: compare actual PC to expected diatonic PC
      const expectedPc = diatonicPcAbove(bassDegree, generic, scale);
      let accidental: FBAccidental | null = null;
      if (upperPc !== expectedPc) {
        const diff = ((upperPc - expectedPc) % 12 + 12) % 12;
        if (diff === 1) accidental = '#';
        else if (diff === 11) accidental = 'b';
      }

      fbIntervals.push(Object.freeze({ interval: generic, accidental }));
    }

    // Sort intervals ascending for reverse lookup
    const sortedIntervals = [...fbIntervals].sort((a, b) => a.interval - b.interval);
    const figures = intervalsToFigures(sortedIntervals);

    results.push(Object.freeze({
      tick: group.onset,
      bassMidi,
      bassPc,
      figures,
      intervals: Object.freeze(sortedIntervals),
    }));
  }

  return Object.freeze(results);
}
