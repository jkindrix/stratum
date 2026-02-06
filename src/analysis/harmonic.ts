import type { Score, NoteEvent } from '../core/types.js';
import { PitchClassSet } from '../pitch/pitch-class-set.js';
import { chordFromPcs, scaleFromPcs, SCALE_CATALOG } from '../pitch/scales.js';

/** Result of a chord identification */
export interface ChordLabel {
  /** Chord name (e.g. "Major", "Minor 7th") */
  name: string;
  /** Chord symbol (e.g. "maj", "min7") */
  symbol: string;
  /** Root pitch class (0-11) */
  root: number;
  /** Pitch classes present */
  pcs: number[];
}

/** A chord change at a specific tick */
export interface HarmonicEvent {
  /** Tick position in the score */
  tick: number;
  /** Identified chord at this position, or null if no chord detected */
  label: ChordLabel | null;
  /** Note events sounding at this tick */
  events: NoteEvent[];
}

/** Roman numeral label for a chord in context */
export interface RomanNumeral {
  /** Degree string (e.g. "I", "iv", "V7", "viio") */
  numeral: string;
  /** Scale degree (1-7) */
  degree: number;
  /** Quality string (e.g. "maj", "min", "dim") */
  quality: string;
}

const DEGREE_NAMES_MAJOR = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const DEGREE_NAMES_MINOR = ['i', 'bii', 'ii', 'biii', 'III', 'iv', '#iv', 'v', 'bvi', 'VI', 'bvii', 'VII'];

/**
 * Identify the chord formed by simultaneous note events.
 * Returns the best matching chord label, or null if no match.
 *
 * @param events - Simultaneous note events (at least 2 required for chord identification).
 * @returns The identified chord label, or null if fewer than 2 events or no match found.
 */
export function identifyChord(events: NoteEvent[]): ChordLabel | null {
  if (events.length < 2) return null;

  const pcs = events.map(e => e.pitch.pitchClass);
  const pcsSet = new PitchClassSet(pcs);

  const result = chordFromPcs(pcsSet);
  if (!result) return null;

  return {
    name: result.chord.name,
    symbol: result.chord.symbol,
    root: result.root,
    pcs: [...pcsSet.pcs],
  };
}

/**
 * Identify the most likely scale/mode from a passage of note events.
 * Compares the aggregate pitch-class content against built-in scale catalog
 * across all 12 transpositions. Returns the best match with overlap >= 70%.
 *
 * @param events - Note events representing a passage (at least 3 required).
 * @returns The best-matching scale with name, root pitch class, and pitch classes, or null.
 */
export function identifyScale(
  events: NoteEvent[],
): { name: string; root: number; pcs: number[] } | null {
  if (events.length < 3) return null;

  const pcs = events.map(e => e.pitch.pitchClass);
  const uniquePcs = [...new Set(pcs)];
  const pcsSet = new PitchClassSet(uniquePcs);

  // Try direct match first
  const directMatch = scaleFromPcs(pcsSet);
  if (directMatch) {
    return { name: directMatch.name, root: 0, pcs: [...pcsSet.pcs] };
  }

  // Try all 12 transpositions against catalog
  let bestMatch: { name: string; root: number; pcs: number[]; score: number } | null = null;

  for (let root = 0; root < 12; root++) {
    for (const scale of SCALE_CATALOG) {
      const transposed = new PitchClassSet(scale.pcs.pcs.map(pc => (pc + root) % 12));
      const overlap = uniquePcs.filter(pc => transposed.has(pc)).length;
      const matchScore = overlap / Math.max(uniquePcs.length, transposed.pcs.length);

      if (!bestMatch || matchScore > bestMatch.score) {
        bestMatch = { name: scale.name, root, pcs: [...transposed.pcs], score: matchScore };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.7) {
    return { name: bestMatch.name, root: bestMatch.root, pcs: bestMatch.pcs };
  }

  return null;
}

/**
 * Detect harmonic rhythm: the rate of chord changes over the score.
 * Samples sounding notes at regular intervals and identifies chords.
 *
 * @param score — The score to analyze.
 * @param windowSize — Sample interval in ticks (default: ticksPerQuarter).
 * @returns Array of harmonic events sampled at each window position.
 */
export function harmonicRhythm(score: Score, windowSize?: number): HarmonicEvent[] {
  const tpq = score.settings.ticksPerQuarter;
  const window = windowSize ?? tpq;
  const allEvents = score.parts.flatMap(p => p.events);

  if (allEvents.length === 0) return [];

  const maxTick = Math.max(...allEvents.map(e => e.onset + e.duration));
  const result: HarmonicEvent[] = [];

  for (let tick = 0; tick <= maxTick; tick += window) {
    const sounding = allEvents.filter(
      e => e.onset <= tick && e.onset + e.duration > tick,
    );

    if (sounding.length < 2) {
      result.push({ tick, label: null, events: sounding });
      continue;
    }

    const label = identifyChord(sounding);
    result.push({ tick, label, events: sounding });
  }

  return result;
}

/**
 * Label chords with Roman numerals relative to a key center.
 *
 * @param chords — Chord labels to analyze.
 * @param key — Key center (tonic pitch class and mode).
 * @returns Array of Roman numeral labels, one per input chord.
 */
export function romanNumeralAnalysis(
  chords: ChordLabel[],
  key: { tonic: number; mode: string },
): RomanNumeral[] {
  const isMinor = key.mode === 'minor' || key.mode === 'aeolian';
  const degreeNames = isMinor ? DEGREE_NAMES_MINOR : DEGREE_NAMES_MAJOR;

  return chords.map(chord => {
    const interval = ((chord.root - key.tonic) % 12 + 12) % 12;
    const baseName = degreeNames[interval] ?? String(interval);

    // Determine quality suffix
    let quality = '';
    const sym = chord.symbol.toLowerCase();
    if (sym.includes('dim')) quality = 'dim';
    else if (sym.includes('aug')) quality = 'aug';
    else if (sym.includes('min')) quality = 'min';
    else quality = 'maj';

    // Build numeral string
    let numeral = baseName;
    if (quality === 'dim') numeral += 'o';
    else if (quality === 'aug') numeral += '+';

    // Add extension indicators
    if (sym.includes('7')) numeral += '7';
    if (sym.includes('9')) numeral += '9';

    return {
      numeral,
      degree: (interval % 12) + 1,
      quality,
    };
  });
}
