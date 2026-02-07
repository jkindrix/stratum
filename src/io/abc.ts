// ---------------------------------------------------------------------------
// Stratum — ABC Notation Import
// ---------------------------------------------------------------------------

import type { Score, Articulation } from '../core/types.js';
import { createScore, addPart, addNote } from '../core/score.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A warning generated during ABC import for non-fatal issues. */
export interface AbcWarning {
  readonly line: number;
  readonly message: string;
}

/** Result of importing an ABC notation file. */
export interface AbcImportResult {
  readonly score: Score;
  readonly warnings: readonly AbcWarning[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TPQ = 480;

/** Letter → pitch class. */
const LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Mode suffix → mode string. */
const MODE_MAP: Record<string, string> = {
  '': 'major',
  'maj': 'major',
  'major': 'major',
  'm': 'minor',
  'min': 'minor',
  'minor': 'minor',
  'mix': 'mixolydian',
  'mixolydian': 'mixolydian',
  'dor': 'dorian',
  'dorian': 'dorian',
  'phr': 'phrygian',
  'phrygian': 'phrygian',
  'lyd': 'lydian',
  'lydian': 'lydian',
  'loc': 'locrian',
  'locrian': 'locrian',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface VoiceState {
  part: ReturnType<typeof addPart>;
  currentTick: number;
  pendingTies: Map<number, { onset: number; duration: number }>;
}

/**
 * Parse ABC key field value (e.g., "D", "Gm", "Amix", "C#m", "Bb").
 */
function parseAbcKey(keyStr: string): { tonic: number; mode: string } | null {
  const trimmed = keyStr.trim();
  if (!trimmed) return null;

  // Match: letter + optional # or b + optional mode suffix
  const match = trimmed.match(/^([A-Ga-g])([#b]?)(\w*)$/);
  if (!match) return null;

  const letter = match[1]!.toUpperCase();
  const accidental = match[2] ?? '';
  const modeSuffix = (match[3] ?? '').toLowerCase();

  const basePc = LETTER_PC[letter];
  if (basePc === undefined) return null;

  let tonic = basePc;
  if (accidental === '#') tonic = (tonic + 1) % 12;
  else if (accidental === 'b') tonic = (tonic + 11) % 12;

  const mode = MODE_MAP[modeSuffix] ?? 'major';

  return { tonic, mode };
}

/**
 * Parse ABC meter field value (e.g., "4/4", "6/8", "C", "C|").
 */
function parseAbcMeter(meterStr: string): { numerator: number; denominator: number } | null {
  const trimmed = meterStr.trim();
  if (trimmed === 'C') return { numerator: 4, denominator: 4 };
  if (trimmed === 'C|') return { numerator: 2, denominator: 2 };

  const match = trimmed.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;

  return {
    numerator: parseInt(match[1]!, 10),
    denominator: parseInt(match[2]!, 10),
  };
}

/**
 * Parse ABC default note length (e.g., "1/8", "1/4").
 * Returns ticks.
 */
function parseAbcLength(lenStr: string): number | null {
  const trimmed = lenStr.trim();
  const match = trimmed.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;

  const num = parseInt(match[1]!, 10);
  const den = parseInt(match[2]!, 10);
  if (den === 0) return null;

  return Math.round((TPQ * 4 * num) / den);
}

/**
 * Parse an ABC note from a character stream.
 * Returns { midi, ticks, endIdx, isTied } or null.
 */
function parseAbcNote(
  body: string,
  startIdx: number,
  defaultTicks: number,
): {
  midi: number;
  ticks: number;
  endIdx: number;
  isTied: boolean;
  articulation?: Articulation;
} | null {
  let i = startIdx;

  // Parse accidentals before the note letter
  let accOffset = 0;
  let hasExplicitAccidental = false;
  while (i < body.length) {
    if (body[i] === '^') {
      accOffset++;
      hasExplicitAccidental = true;
      i++;
    } else if (body[i] === '_') {
      accOffset--;
      hasExplicitAccidental = true;
      i++;
    } else if (body[i] === '=') {
      accOffset = 0;
      hasExplicitAccidental = true;
      i++;
    } else {
      break;
    }
  }

  if (i >= body.length) return null;

  // Note letter
  const ch = body[i]!;
  const upper = ch.toUpperCase();
  const basePc = LETTER_PC[upper];
  if (basePc === undefined) return null;

  const isLower = ch >= 'a' && ch <= 'z';
  let octave = isLower ? 5 : 4; // c-b = octave 5, C-B = octave 4
  i++;

  // Octave modifiers
  while (i < body.length) {
    if (body[i] === "'") { octave++; i++; }
    else if (body[i] === ',') { octave--; i++; }
    else break;
  }

  // MIDI calculation
  let midi = (octave + 1) * 12 + basePc;
  if (hasExplicitAccidental) midi += accOffset;
  midi = Math.max(0, Math.min(127, midi));

  // Duration modifiers
  let ticks = defaultTicks;

  // Check for numeric multiplier or fraction
  let numStr = '';
  while (i < body.length && body[i]! >= '0' && body[i]! <= '9') {
    numStr += body[i]!;
    i++;
  }

  if (i < body.length && body[i] === '/') {
    // Fraction: N/M or /M or /
    i++;
    let denStr = '';
    while (i < body.length && body[i]! >= '0' && body[i]! <= '9') {
      denStr += body[i]!;
      i++;
    }
    const num = numStr ? parseInt(numStr, 10) : 1;
    const den = denStr ? parseInt(denStr, 10) : 2;
    if (den > 0) {
      ticks = Math.round((defaultTicks * num) / den);
    }
  } else if (numStr) {
    // Simple multiplier
    ticks = defaultTicks * parseInt(numStr, 10);
  }

  // Check for tie (dash after note)
  let isTied = false;
  if (i < body.length && body[i] === '-') {
    isTied = true;
    i++;
  }

  return { midi, ticks, endIdx: i, isTied };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an ABC notation file into a Score.
 *
 * Supports:
 * - Header fields: X (reference), T (title), M (meter), L (default length),
 *   K (key), Q (tempo), V (voice definition)
 * - Notes with pitch letters, accidentals (^, _, =), octave modifiers (', ,)
 * - Duration modifiers (numeric multipliers, fractions)
 * - Rests (z, Z)
 * - Chords [CEG]
 * - Ties (-)
 * - Multi-voice (V:)
 * - Barlines (|, ||, |], etc.)
 * - Common time (C) and cut time (C|)
 * - Inline fields [M:3/4]
 *
 * @param text - ABC notation source string.
 * @returns Import result with score and any warnings.
 */
export function abcToScore(text: string): AbcImportResult {
  const lines = text.split(/\r?\n/);
  const warnings: AbcWarning[] = [];

  let title = '';
  let meter = { numerator: 4, denominator: 4 };
  let defaultTicks = TPQ; // default 1/8 note = 240 ticks
  let keyInfo: { tonic: number; mode: string } | null = null;
  let tempo = 120;
  let headerDone = false;
  let defaultLengthSet = false;

  const score = createScore({ ticksPerQuarter: TPQ });
  score.timeSignatures.length = 0;
  score.tempoChanges.length = 0;
  score.keyCenters.length = 0;

  // Voice states
  const voiceStates = new Map<string, VoiceState>();
  let currentVoiceId = '1';

  function getVoice(id: string): VoiceState {
    let state = voiceStates.get(id);
    if (!state) {
      state = {
        part: addPart(score, { name: `Voice ${id}` }),
        currentTick: 0,
        pendingTies: new Map(),
      };
      voiceStates.set(id, state);
    }
    return state;
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const lineNum = lineIdx + 1;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('%')) continue;

    // Header fields (before body)
    if (!headerDone) {
      // Check if this is a header field
      const headerMatch = trimmed.match(/^([A-Za-z]):\s*(.*)$/);
      if (headerMatch) {
        const field = headerMatch[1]!;
        const value = headerMatch[2]!.trim();

        switch (field.toUpperCase()) {
          case 'X': // Reference number — metadata only
            break;
          case 'T':
            title = value;
            break;
          case 'M': {
            const m = parseAbcMeter(value);
            if (m) meter = m;
            break;
          }
          case 'L': {
            const l = parseAbcLength(value);
            if (l !== null) {
              defaultTicks = l;
              defaultLengthSet = true;
            }
            break;
          }
          case 'Q': {
            // Tempo: "1/4=120" or just "120"
            const qMatch = value.match(/=\s*(\d+)/);
            if (qMatch) {
              tempo = parseInt(qMatch[1]!, 10);
            } else {
              const plain = parseInt(value, 10);
              if (!Number.isNaN(plain) && plain > 0) tempo = plain;
            }
            break;
          }
          case 'K': {
            // Key — last header field, signals body start
            keyInfo = parseAbcKey(value);
            headerDone = true;
            break;
          }
          case 'V': {
            // Voice definition
            const vMatch = value.match(/^(\S+)/);
            if (vMatch) currentVoiceId = vMatch[1]!;
            break;
          }
          default:
            // Other fields: skip silently
            break;
        }
        continue;
      }
    }

    // If we haven't hit K: yet, check for inline body start
    if (!headerDone) {
      // If no K: field, treat as body anyway
      headerDone = true;
    }

    // Infer default note length from meter if not explicitly set
    if (!defaultLengthSet) {
      const meterRatio = meter.numerator / meter.denominator;
      defaultTicks = meterRatio < 0.75 ? TPQ / 2 : TPQ; // < 3/4 → 1/16, else 1/8
      // Actually: ABC standard says if meter < 0.75, default L is 1/16
      // Otherwise 1/8
      if (meterRatio < 0.75) {
        defaultTicks = TPQ / 4; // 1/16 = 120 ticks at 480 TPQ
      } else {
        defaultTicks = TPQ / 2; // 1/8 = 240 ticks
      }
      defaultLengthSet = true;
    }

    // Parse body line
    const voice = getVoice(currentVoiceId);
    let i = 0;
    const bodyLine = trimmed;

    while (i < bodyLine.length) {
      const ch = bodyLine[i]!;

      // Check for header field in body (continuation or inline voice)
      if (i === 0 && /^[A-Za-z]:/.test(bodyLine) && bodyLine.length > 2) {
        const field = bodyLine[0]!.toUpperCase();
        const value = bodyLine.substring(2).trim();
        if (field === 'V') {
          const vMatch = value.match(/^(\S+)/);
          if (vMatch) currentVoiceId = vMatch[1]!;
          break; // rest of line is voice definition
        }
        // If W: or w: (lyrics), skip
        if (field === 'W') break;
      }

      // Inline fields: [M:3/4]
      if (ch === '[' && i + 2 < bodyLine.length && bodyLine[i + 2] === ':') {
        const endBracket = bodyLine.indexOf(']', i);
        if (endBracket > i) {
          const inlineField = bodyLine[i + 1]!.toUpperCase();
          const inlineValue = bodyLine.substring(i + 3, endBracket).trim();

          if (inlineField === 'M') {
            const m = parseAbcMeter(inlineValue);
            if (m) {
              score.timeSignatures.push({
                numerator: m.numerator,
                denominator: m.denominator,
                atTick: voice.currentTick,
              });
            }
          } else if (inlineField === 'K') {
            const k = parseAbcKey(inlineValue);
            if (k) {
              score.keyCenters.push({
                tonic: k.tonic,
                mode: k.mode,
                atTick: voice.currentTick,
              });
            }
          } else if (inlineField === 'L') {
            const l = parseAbcLength(inlineValue);
            if (l !== null) defaultTicks = l;
          }

          i = endBracket + 1;
          continue;
        }
      }

      // Chord: [CEG]
      if (ch === '[') {
        const endBracket = bodyLine.indexOf(']', i + 1);
        if (endBracket > i) {
          const chordContent = bodyLine.substring(i + 1, endBracket);
          const chordOnset = voice.currentTick;
          let chordDuration = 0;
          let ci = 0;
          while (ci < chordContent.length) {
            const noteResult = parseAbcNote(chordContent, ci, defaultTicks);
            if (noteResult) {
              // Use chordOnset for all notes, don't advance tick per note
              processChordNote(score, voice, noteResult.midi, noteResult.ticks, noteResult.isTied, chordOnset);
              if (noteResult.ticks > chordDuration) chordDuration = noteResult.ticks;
              ci = noteResult.endIdx;
            } else {
              ci++;
            }
          }
          // Advance tick once for the entire chord
          voice.currentTick = chordOnset + chordDuration;
          i = endBracket + 1;

          // Check for tie after chord
          if (i < bodyLine.length && bodyLine[i] === '-') {
            i++;
          }
          continue;
        }
      }

      // Barlines
      if (ch === '|' || ch === ':') {
        // Skip barline characters
        while (i < bodyLine.length && (bodyLine[i] === '|' || bodyLine[i] === ':' || bodyLine[i] === '[' || bodyLine[i] === ']')) {
          i++;
        }
        continue;
      }

      // Rest: z or Z
      if (ch === 'z') {
        i++;
        // Parse duration modifiers
        let ticks = defaultTicks;
        let numStr = '';
        while (i < bodyLine.length && bodyLine[i]! >= '0' && bodyLine[i]! <= '9') {
          numStr += bodyLine[i]!;
          i++;
        }
        if (i < bodyLine.length && bodyLine[i] === '/') {
          i++;
          let denStr = '';
          while (i < bodyLine.length && bodyLine[i]! >= '0' && bodyLine[i]! <= '9') {
            denStr += bodyLine[i]!;
            i++;
          }
          const num = numStr ? parseInt(numStr, 10) : 1;
          const den = denStr ? parseInt(denStr, 10) : 2;
          if (den > 0) ticks = Math.round((defaultTicks * num) / den);
        } else if (numStr) {
          ticks = defaultTicks * parseInt(numStr, 10);
        }
        voice.currentTick += ticks;
        continue;
      }
      if (ch === 'Z') {
        i++;
        // Whole-measure rest
        const measureTicks = Math.round((TPQ * 4 * meter.numerator) / meter.denominator);
        voice.currentTick += measureTicks;
        continue;
      }

      // Notes: check if it's a note letter (with possible preceding accidentals)
      if (ch === '^' || ch === '_' || ch === '=' ||
          (ch >= 'A' && ch <= 'G') || (ch >= 'a' && ch <= 'g')) {
        const noteResult = parseAbcNote(bodyLine, i, defaultTicks);
        if (noteResult) {
          processNote(score, voice, noteResult.midi, noteResult.ticks, noteResult.isTied, warnings, lineNum);
          i = noteResult.endIdx;
          continue;
        }
      }

      // Decorations: !...!
      if (ch === '!') {
        const endDecor = bodyLine.indexOf('!', i + 1);
        if (endDecor > i) {
          i = endDecor + 1;
          continue;
        }
      }

      // Spaces, line continuations, and other ignored chars
      i++;
    }
  }

  // Set metadata
  score.metadata.title = title;

  // Set key
  if (keyInfo) {
    score.keyCenters.push({ tonic: keyInfo.tonic, mode: keyInfo.mode, atTick: 0 });
  }

  // Set time signature
  score.timeSignatures.push({
    numerator: meter.numerator,
    denominator: meter.denominator,
    atTick: 0,
  });

  // Set tempo
  score.tempoChanges.push({ bpm: tempo, atTick: 0 });

  // Flush pending ties
  for (const [voiceId, voice] of voiceStates) {
    for (const [midi, pending] of voice.pendingTies) {
      warnings.push({
        line: lines.length,
        message: `Unterminated tie for MIDI ${midi} in voice ${voiceId}`,
      });
      addNote(score, voice.part, {
        midi,
        onset: pending.onset,
        duration: Math.max(1, pending.duration),
        velocity: 80,
        voice: 0,
      });
    }
  }

  // Ensure at least one voice part exists
  if (voiceStates.size === 0) {
    addPart(score, { name: 'Voice 1' });
  }

  return Object.freeze({
    score,
    warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
  });
}

/**
 * Process a parsed note, handling ties.
 */
function processNote(
  score: Score,
  voice: VoiceState,
  midi: number,
  ticks: number,
  isTied: boolean,
  warnings: AbcWarning[],
  lineNum: number,
): void {
  const pendingTie = voice.pendingTies.get(midi);

  if (pendingTie) {
    // Continuing a tie
    pendingTie.duration += ticks;
    if (!isTied) {
      // End of tie chain — create merged note
      addNote(score, voice.part, {
        midi,
        onset: pendingTie.onset,
        duration: Math.max(1, pendingTie.duration),
        velocity: 80,
        voice: 0,
      });
      voice.pendingTies.delete(midi);
    }
  } else if (isTied) {
    // Start of tie
    voice.pendingTies.set(midi, {
      onset: voice.currentTick,
      duration: ticks,
    });
  } else {
    // Regular note
    addNote(score, voice.part, {
      midi,
      onset: voice.currentTick,
      duration: ticks,
      velocity: 80,
      voice: 0,
    });
  }

  voice.currentTick += ticks;
}

/**
 * Process a chord note at a fixed onset (no tick advancement).
 */
function processChordNote(
  score: Score,
  voice: VoiceState,
  midi: number,
  ticks: number,
  isTied: boolean,
  onset: number,
): void {
  if (isTied) {
    voice.pendingTies.set(midi, { onset, duration: ticks });
  } else {
    addNote(score, voice.part, {
      midi,
      onset,
      duration: ticks,
      velocity: 80,
      voice: 0,
    });
  }
}
