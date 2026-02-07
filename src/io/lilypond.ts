// ---------------------------------------------------------------------------
// Stratum — LilyPond 2.24+ Export
// ---------------------------------------------------------------------------

import type { Score, NoteEvent, Articulation } from '../core/types.js';
import { spellPitch } from '../pitch/spelling.js';
import type { SpellingKeyContext } from '../pitch/spelling.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for LilyPond export. */
export interface LilyPondExportOptions {
  /** LilyPond version string (default '2.24.0'). */
  readonly version?: string;
  /** Spaces per indent level (default 2). */
  readonly indent?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map accidental string → LilyPond suffix. */
const ACCID_SUFFIX: Record<string, string> = {
  '#': 'is',
  'b': 'es',
  '##': 'isis',
  'bb': 'eses',
  '': '',
};

/** Velocity → LilyPond dynamic. */
const VELOCITY_DYNAMICS: readonly [number, string][] = [
  [24, '\\ppp'],
  [40, '\\pp'],
  [56, '\\p'],
  [72, '\\mp'],
  [88, '\\mf'],
  [104, '\\f'],
  [120, '\\ff'],
  [128, '\\fff'],
];

/** Articulation → LilyPond suffix. */
const ARTIC_SUFFIX: Record<string, string> = {
  staccato: '-.',
  tenuto: '--',
  accent: '->',
  marcato: '-^',
  fermata: '\\fermata',
};

/** Note type ticks (at 480 TPQ) → LilyPond duration number. */
const DURATION_MAP: readonly [number, string][] = [
  [480 * 8, '\\longa'],
  [480 * 4, '1'],
  [480 * 2, '2'],
  [480, '4'],
  [240, '8'],
  [120, '16'],
  [60, '32'],
  [30, '64'],
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert ticks to LilyPond duration string (e.g., "4", "8.", "2..").
 */
function ticksToDuration(ticks: number, tpq: number): string {
  // Normalize to 480 TPQ
  const normalized = (ticks * 480) / tpq;

  for (const [baseTicks, durStr] of DURATION_MAP) {
    if (Math.abs(normalized - baseTicks) < 1) return durStr;
    // Single dot
    const dotted1 = baseTicks * 1.5;
    if (Math.abs(normalized - dotted1) < 1) return `${durStr}.`;
    // Double dot
    const dotted2 = baseTicks * 1.75;
    if (Math.abs(normalized - dotted2) < 1) return `${durStr}..`;
  }

  // Fallback: find closest
  let closest = '4';
  let minDiff = Infinity;
  for (const [baseTicks, durStr] of DURATION_MAP) {
    const diff = Math.abs(normalized - baseTicks);
    if (diff < minDiff) {
      minDiff = diff;
      closest = durStr;
    }
  }
  return closest;
}

/**
 * Convert MIDI note to LilyPond pitch string (e.g., "c'", "fis''", "bes,").
 */
function midiToLilyPitch(midi: number, keyCtx?: SpellingKeyContext): string {
  const spelled = spellPitch(midi, keyCtx);

  // Letter: lowercase in LilyPond
  let letter = spelled.letter.toLowerCase();
  // Special case: in LilyPond, "es" can be confused with E-flat; E-flat = ees, A-flat = aes
  // The spellPitch already gives us the correct letter

  // Accidental suffix
  const accidSuffix = ACCID_SUFFIX[spelled.accidental] ?? '';
  const pitch = `${letter}${accidSuffix}`;

  // Octave markers: LilyPond c' = C4 (MIDI 60)
  // c (no marker) = C3, c' = C4, c'' = C5
  // c, = C2, c,, = C1
  const octave = spelled.octave;
  let octaveMarker = '';
  if (octave >= 4) {
    octaveMarker = "'".repeat(octave - 3);
  } else if (octave <= 2) {
    octaveMarker = ','.repeat(3 - octave);
  }
  // octave 3 = no marker

  return `${pitch}${octaveMarker}`;
}

/**
 * Get velocity dynamic string.
 */
function velocityToDynamic(velocity: number): string {
  for (const [threshold, dyn] of VELOCITY_DYNAMICS) {
    if (velocity <= threshold) return dyn;
  }
  return '\\fff';
}

/**
 * Get the articulation suffix for LilyPond.
 */
function articulationSuffix(art: Articulation | undefined): string {
  if (!art) return '';
  return ARTIC_SUFFIX[art] ?? '';
}

/**
 * Compute median MIDI pitch for a set of events.
 */
function medianPitch(events: readonly NoteEvent[]): number {
  if (events.length === 0) return 60;
  const sorted = events.map(e => e.pitch.midi).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid] ?? 60;
}

/**
 * Map tonic PC to LilyPond key name.
 */
function tonicToLily(tonic: number): string {
  const names: Record<number, string> = {
    0: 'c', 1: 'cis', 2: 'd', 3: 'ees', 4: 'e', 5: 'f',
    6: 'fis', 7: 'g', 8: 'aes', 9: 'a', 10: 'bes', 11: 'b',
  };
  return names[tonic] ?? 'c';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export a Score to a LilyPond 2.24+ string.
 *
 * Generates:
 * - `\version` header
 * - `\header` block with title and composer
 * - `\score` block containing one `\new Staff` per Part
 * - Key signature (`\key`), time signature (`\time`), clef
 * - Notes with correct pitch spelling, octave markers, and durations
 * - Rests for gaps between notes
 * - Articulations (staccato, tenuto, accent, marcato, fermata)
 * - Dynamics based on velocity changes
 * - Multi-voice layout using `<< \\\\ >>` when voices are present
 * - Barlines at measure boundaries
 *
 * @param score - The score to export.
 * @param options - Export options.
 * @returns LilyPond source string.
 */
export function scoreToLilyPond(score: Score, options?: LilyPondExportOptions): string {
  const version = options?.version ?? '2.24.0';
  const indentSize = options?.indent ?? 2;
  const ind = (level: number) => ' '.repeat(indentSize * level);

  const tpq = score.settings.ticksPerQuarter;
  const lines: string[] = [];

  // Version
  lines.push(`\\version "${version}"`);
  lines.push('');

  // Header
  if (score.metadata.title || score.metadata.composer) {
    lines.push('\\header {');
    if (score.metadata.title) {
      lines.push(`${ind(1)}title = "${score.metadata.title}"`);
    }
    if (score.metadata.composer) {
      lines.push(`${ind(1)}composer = "${score.metadata.composer}"`);
    }
    lines.push('}');
    lines.push('');
  }

  // Score block
  lines.push('\\score {');

  if (score.parts.length === 0) {
    // Empty score
    lines.push(`${ind(1)}\\new Staff { s1 }`);
  } else if (score.parts.length === 1) {
    // Single part
    const partLines = renderPart(score, score.parts[0]!, tpq, indentSize, 1);
    lines.push(...partLines);
  } else {
    // Multiple parts
    lines.push(`${ind(1)}<<`);
    for (const part of score.parts) {
      const partLines = renderPart(score, part, tpq, indentSize, 2);
      lines.push(...partLines);
    }
    lines.push(`${ind(1)}>>`);
  }

  lines.push('}');

  return lines.join('\n') + '\n';
}

/**
 * Render a single Part as a \new Staff block.
 */
function renderPart(
  score: Score,
  part: typeof score.parts[0],
  tpq: number,
  indentSize: number,
  baseIndent: number,
): string[] {
  const ind = (level: number) => ' '.repeat(indentSize * level);
  const lines: string[] = [];

  // Key context for spelling
  const keyCenter = score.keyCenters[0];
  const keyCtx: SpellingKeyContext | undefined = keyCenter
    ? { tonic: keyCenter.tonic, mode: keyCenter.mode as 'major' | 'minor' }
    : undefined;

  // Clef: bass if median pitch < 55, treble otherwise
  const median = medianPitch(part.events);
  const clef = median < 55 ? 'bass' : 'treble';

  // Group events by voice
  const voiceMap = new Map<number, NoteEvent[]>();
  for (const evt of part.events) {
    let arr = voiceMap.get(evt.voice);
    if (!arr) {
      arr = [];
      voiceMap.set(evt.voice, arr);
    }
    arr.push(evt);
  }
  const voiceKeys = Array.from(voiceMap.keys()).sort((a, b) => a - b);

  const hasMultipleVoices = voiceKeys.length > 1;

  lines.push(`${ind(baseIndent)}\\new Staff {`);

  // Clef
  lines.push(`${ind(baseIndent + 1)}\\clef ${clef}`);

  // Key
  if (keyCenter) {
    const lilyTonic = tonicToLily(keyCenter.tonic);
    const lilyMode = keyCenter.mode === 'minor' ? '\\minor' : '\\major';
    lines.push(`${ind(baseIndent + 1)}\\key ${lilyTonic} ${lilyMode}`);
  }

  // Time signature
  const timeSig = score.timeSignatures[0];
  if (timeSig) {
    lines.push(`${ind(baseIndent + 1)}\\time ${timeSig.numerator}/${timeSig.denominator}`);
  }

  if (hasMultipleVoices) {
    lines.push(`${ind(baseIndent + 1)}<<`);
    for (let vi = 0; vi < voiceKeys.length; vi++) {
      const voiceIdx = voiceKeys[vi]!;
      const events = voiceMap.get(voiceIdx)!;
      const voiceName = vi === 0 ? '\\voiceOne' : '\\voiceTwo';

      const noteStr = renderVoiceEvents(events, tpq, score, keyCtx);
      lines.push(`${ind(baseIndent + 2)}{ ${voiceName} ${noteStr} }`);

      if (vi < voiceKeys.length - 1) {
        lines.push(`${ind(baseIndent + 1)}\\\\`);
      }
    }
    lines.push(`${ind(baseIndent + 1)}>>`);
  } else {
    const events = voiceKeys.length > 0 ? (voiceMap.get(voiceKeys[0]!) ?? []) : [];
    const noteStr = renderVoiceEvents(events, tpq, score, keyCtx);
    lines.push(`${ind(baseIndent + 1)}${noteStr}`);
  }

  lines.push(`${ind(baseIndent)}}`);

  return lines;
}

/**
 * Render a sequence of events to LilyPond note string.
 */
function renderVoiceEvents(
  events: readonly NoteEvent[],
  tpq: number,
  score: Score,
  keyCtx?: SpellingKeyContext,
): string {
  if (events.length === 0) return 's1';

  const sorted = [...events].sort((a, b) => a.onset - b.onset || a.pitch.midi - b.pitch.midi);
  const tokens: string[] = [];
  let cursor = 0;
  let lastDynamic = '';

  // Compute measure boundaries for barlines
  const ts = score.timeSignatures[0] ?? { numerator: 4, denominator: 4 };
  const measureTicks = Math.round((tpq * 4 * ts.numerator) / ts.denominator);
  let nextBarline = measureTicks;

  let i = 0;
  while (i < sorted.length) {
    const evt = sorted[i]!;

    // Insert rests for gaps
    if (evt.onset > cursor) {
      const gap = evt.onset - cursor;

      // Check for barlines in the gap
      while (nextBarline <= cursor) nextBarline += measureTicks;
      while (nextBarline < evt.onset) {
        const restBefore = nextBarline - cursor;
        if (restBefore > 0) {
          tokens.push(`r${ticksToDuration(restBefore, tpq)}`);
          cursor = nextBarline;
        }
        tokens.push('|');
        nextBarline += measureTicks;
      }

      const remainingGap = evt.onset - cursor;
      if (remainingGap > 0) {
        tokens.push(`r${ticksToDuration(remainingGap, tpq)}`);
        cursor = evt.onset;
      }
    }

    // Check for barline at event onset
    while (nextBarline <= evt.onset) {
      if (nextBarline === evt.onset && tokens.length > 0) {
        tokens.push('|');
      }
      nextBarline += measureTicks;
    }

    // Dynamics
    const dyn = velocityToDynamic(evt.velocity);
    const dynStr = dyn !== lastDynamic ? dyn : '';
    lastDynamic = dyn;

    // Collect simultaneous notes (chord)
    const chordNotes: NoteEvent[] = [evt];
    while (i + 1 < sorted.length && sorted[i + 1]!.onset === evt.onset) {
      i++;
      chordNotes.push(sorted[i]!);
    }

    const dur = ticksToDuration(evt.duration, tpq);
    const artic = articulationSuffix(chordNotes[0]?.articulation);

    if (chordNotes.length === 1) {
      // Single note
      const pitch = midiToLilyPitch(evt.pitch.midi, keyCtx);
      tokens.push(`${pitch}${dur}${artic}${dynStr}`);
    } else {
      // Chord
      const pitches = chordNotes.map(n => midiToLilyPitch(n.pitch.midi, keyCtx));
      tokens.push(`<${pitches.join(' ')}>${dur}${artic}${dynStr}`);
    }

    cursor = evt.onset + evt.duration;
    i++;
  }

  return tokens.join(' ');
}
