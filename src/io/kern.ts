// ---------------------------------------------------------------------------
// Stratum — Humdrum **kern Import
// ---------------------------------------------------------------------------

import type { Score, Articulation } from '../core/types.js';
import { createScore, addPart, addNote } from '../core/score.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A warning generated during **kern import for non-fatal issues. */
export interface KernWarning {
  readonly line: number;
  readonly message: string;
}

/** Result of importing a Humdrum **kern file. */
export interface KernImportResult {
  readonly score: Score;
  readonly warnings: readonly KernWarning[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default ticks-per-quarter for kern scores. */
const TPQ = 480;

/** Map key signature accidental count (sharps positive, flats negative) to tonic PC. */
const FIFTHS_TO_TONIC: Record<number, number> = {
  '-7': 11, '-6': 6, '-5': 1, '-4': 8, '-3': 3, '-2': 10, '-1': 5,
  '0': 0, '1': 7, '2': 2, '3': 9, '4': 4, '5': 11, '6': 6, '7': 1,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface SpineState {
  type: string;
  key: { tonic: number; mode: string } | null;
}

/**
 * Parse a kern pitch token (letter + accidentals) to MIDI.
 * Lowercase: a=A4(69), aa=A5(81), aaa=A6(93) — each repeat adds octave
 * Uppercase: A=A3(57), AA=A2(45), AAA=A1(33) — each repeat subtracts octave
 */
function parsePitch(token: string): number | null {
  // Extract pitch letters
  const pitchMatch = token.match(/([a-gA-G]+)/);
  if (!pitchMatch) return null;

  const letters = pitchMatch[1]!;
  const firstChar = letters[0]!;
  const isLower = firstChar >= 'a' && firstChar <= 'g';
  const baseLetter = firstChar.toUpperCase();

  // Base MIDI for each letter at octave 4 (middle octave)
  const letterMidi: Record<string, number> = {
    C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71,
  };
  const base = letterMidi[baseLetter];
  if (base === undefined) return null;

  let midi: number;
  if (isLower) {
    // Lowercase: first letter = octave 4, each additional = +12
    midi = base + (letters.length - 1) * 12;
  } else {
    // Uppercase: first letter = octave 3, each additional = -12
    midi = (base - 12) - (letters.length - 1) * 12;
  }

  // Count accidentals
  let accidentalOffset = 0;
  for (const ch of token) {
    if (ch === '#') accidentalOffset++;
    else if (ch === '-') accidentalOffset--;
  }
  midi += accidentalOffset;

  return Math.max(0, Math.min(127, midi));
}

/**
 * Parse kern duration token to ticks.
 * Leading digits = reciprocal (4=quarter, 8=eighth, etc.)
 * Dots augment duration.
 * 0 = breve (2× whole), 00 = long (4× whole)
 */
function parseDuration(token: string): number {
  // Match leading digits
  const durMatch = token.match(/(\d+)/);
  if (!durMatch) return TPQ; // default quarter

  const recipStr = durMatch[1]!;
  let baseTicks: number;

  if (recipStr === '00') {
    // Long = 4× whole
    baseTicks = TPQ * 16;
  } else if (recipStr === '0') {
    // Breve = 2× whole
    baseTicks = TPQ * 8;
  } else {
    const recip = parseInt(recipStr, 10);
    if (recip <= 0) return TPQ;
    baseTicks = (TPQ * 4) / recip;
  }

  // Count dots
  let dots = 0;
  for (const ch of token) {
    if (ch === '.') dots++;
  }

  // Apply dots
  let total = baseTicks;
  let add = baseTicks;
  for (let i = 0; i < dots; i++) {
    add /= 2;
    total += add;
  }

  return Math.round(total);
}

/**
 * Extract articulations from a kern token.
 */
function parseArticulation(token: string): Articulation | undefined {
  if (token.includes(';')) return 'fermata';
  if (token.includes("'")) return 'staccato';
  if (token.includes('~')) return 'tenuto';
  if (token.includes('^')) return 'accent';
  return undefined;
}

/**
 * Count sharps and flats in a key signature like `*k[f#c#]`.
 */
function parseKeySig(content: string): number {
  let sharps = 0;
  let flats = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '#') sharps++;
    if (content[i] === '-') flats++;
  }
  return sharps - flats;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Humdrum **kern file into a Score.
 *
 * Supports:
 * - Multi-spine (multi-voice) files
 * - Key signatures (`*k[...]`), meter (`*M...`), mode (`*major`/`*minor`)
 * - Notes with pitch, duration, accidentals, dots
 * - Rests (`r`), ties (`[`, `_`, `]`), chords (space-separated sub-tokens)
 * - Articulations (`;` fermata, `'` staccato, `~` tenuto)
 * - Spine path operators (`*^` split, `*v` merge, `*-` terminate, `*+` add, `*x` swap)
 * - Metadata (`!!!COM:`, `!!!OTL:`)
 * - Barlines (`=`)
 *
 * @param text - Humdrum **kern source string.
 * @returns Import result with score and any warnings.
 */
export function kernToScore(text: string): KernImportResult {
  const lines = text.split(/\r?\n/);
  const warnings: KernWarning[] = [];

  let title = '';
  let composer = '';
  let meterNum = 4;
  let meterDen = 4;
  let mode = 'major';
  let keySigFifths = 0;
  let foundMeter = false;

  const spines: SpineState[] = [];
  // Per-spine tick tracking and pending ties
  let spineTicks: number[] = [];
  const pendingTies: Map<string, { onset: number; duration: number; voice: number; velocity: number; articulation?: Articulation }>[] = [];

  const score = createScore({ ticksPerQuarter: TPQ });
  score.timeSignatures.length = 0;
  score.tempoChanges.length = 0;
  score.keyCenters.length = 0;

  // Parts created per spine
  const spineParts: (ReturnType<typeof addPart> | null)[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const lineNum = lineIdx + 1;

    // Skip empty lines
    if (line.trim() === '') continue;

    // Global reference records: !!!key: value
    if (line.startsWith('!!!')) {
      const refMatch = line.match(/^!!!(\w+):\s*(.*)$/);
      if (refMatch) {
        const key = refMatch[1]!;
        const value = refMatch[2]!.trim();
        if (key === 'COM') composer = value;
        if (key === 'OTL') title = value;
      }
      continue;
    }

    // Global comments (!! but not !!!)
    if (line.startsWith('!!')) continue;

    // Local comments (single !)
    if (line.startsWith('!') && !line.startsWith('**') && !line.startsWith('*')) {
      // Check if it's actually a tandem interpretation or exclusive
      if (!line.includes('\t') || line.split('\t').every(t => t.startsWith('!'))) {
        continue;
      }
    }

    // Split by tab
    const tokens = line.split('\t');

    // Exclusive interpretations (**kern, **dynam, etc.)
    if (tokens.some(t => t.startsWith('**'))) {
      spines.length = 0;
      spineTicks = [];
      pendingTies.length = 0;
      spineParts.length = 0;

      for (const t of tokens) {
        const type = t.startsWith('**') ? t : 'unknown';
        spines.push({ type, key: null });
        spineTicks.push(0);
        pendingTies.push(new Map());
        if (type === '**kern') {
          spineParts.push(addPart(score, { name: `Spine ${spineParts.length + 1}` }));
        } else {
          spineParts.push(null);
        }
      }
      continue;
    }

    // Barlines (start with =)
    if (tokens.length > 0 && (tokens[0] ?? '').startsWith('=')) {
      // Barlines don't change state, just mark measure boundaries
      continue;
    }

    // Tandem interpretations (start with * but not **)
    if (tokens.length > 0 && (tokens[0] ?? '').startsWith('*') && !(tokens[0] ?? '').startsWith('**')) {
      // Check for spine path operators first
      const hasSpineOps = tokens.some(t =>
        t === '*^' || t === '*v' || t === '*-' || t === '*+' || t === '*x'
      );

      if (hasSpineOps) {
        const newSpines: SpineState[] = [];
        const newTicks: number[] = [];
        const newTies: Map<string, { onset: number; duration: number; voice: number; velocity: number; articulation?: Articulation }>[] = [];
        const newParts: (ReturnType<typeof addPart> | null)[] = [];

        let si = 0;
        for (let ti = 0; ti < tokens.length; ti++) {
          const tok = tokens[ti] ?? '*';
          if (tok === '*^') {
            // Split: duplicate spine
            const state = spines[si] ?? { type: '**kern', key: null };
            const tick = spineTicks[si] ?? 0;
            const part = spineParts[si] ?? null;
            newSpines.push({ ...state });
            newSpines.push({ ...state });
            newTicks.push(tick);
            newTicks.push(tick);
            newTies.push(new Map(pendingTies[si]));
            newTies.push(new Map());
            newParts.push(part);
            // Create a new part for split
            if (state.type === '**kern') {
              newParts.push(addPart(score, { name: `Spine ${score.parts.length + 1}` }));
            } else {
              newParts.push(null);
            }
            si++;
          } else if (tok === '*v') {
            // Merge: combine with next *v token
            const state = spines[si] ?? { type: '**kern', key: null };
            const tick = spineTicks[si] ?? 0;
            const part = spineParts[si] ?? null;
            newSpines.push({ ...state });
            newTicks.push(tick);
            newTies.push(pendingTies[si] ?? new Map());
            newParts.push(part);
            // Skip the next token if it's also *v (merge pair)
            if (ti + 1 < tokens.length && tokens[ti + 1] === '*v') {
              si++; // consumed the paired spine
              ti++; // skip the next *v token
            }
            si++;
          } else if (tok === '*-') {
            // Terminate spine
            // Flush pending ties for this spine
            const ties = pendingTies[si];
            const part = spineParts[si];
            if (ties && part) {
              for (const [tieKey, pending] of ties) {
                const midi = parseInt(tieKey.split(':')[1] ?? '60', 10);
                warnings.push({ line: lineNum, message: `Unterminated tie for MIDI ${midi} in terminated spine` });
                addNote(score, part, {
                  midi,
                  onset: pending.onset,
                  duration: Math.max(1, pending.duration),
                  velocity: pending.velocity,
                  voice: pending.voice,
                  articulation: pending.articulation,
                });
              }
            }
            si++;
          } else if (tok === '*+') {
            // Add new spine
            newSpines.push(spines[si] ?? { type: '**kern', key: null });
            newTicks.push(spineTicks[si] ?? 0);
            newTies.push(pendingTies[si] ?? new Map());
            newParts.push(spineParts[si] ?? null);
            // Also add a fresh spine
            newSpines.push({ type: '**kern', key: null });
            newTicks.push(0);
            newTies.push(new Map());
            newParts.push(addPart(score, { name: `Spine ${score.parts.length + 1}` }));
            si++;
          } else if (tok === '*x') {
            // Exchange: swap with next spine
            if (si + 1 < spines.length && ti + 1 < tokens.length && tokens[ti + 1] === '*x') {
              newSpines.push(spines[si + 1] ?? { type: '**kern', key: null });
              newSpines.push(spines[si] ?? { type: '**kern', key: null });
              newTicks.push(spineTicks[si + 1] ?? 0);
              newTicks.push(spineTicks[si] ?? 0);
              newTies.push(pendingTies[si + 1] ?? new Map());
              newTies.push(pendingTies[si] ?? new Map());
              newParts.push(spineParts[si + 1] ?? null);
              newParts.push(spineParts[si] ?? null);
              si += 2;
              ti++; // skip paired *x
            } else {
              newSpines.push(spines[si] ?? { type: '**kern', key: null });
              newTicks.push(spineTicks[si] ?? 0);
              newTies.push(pendingTies[si] ?? new Map());
              newParts.push(spineParts[si] ?? null);
              si++;
            }
          } else {
            // Regular tandem for this spine
            newSpines.push(spines[si] ?? { type: '**kern', key: null });
            newTicks.push(spineTicks[si] ?? 0);
            newTies.push(pendingTies[si] ?? new Map());
            newParts.push(spineParts[si] ?? null);
            si++;
          }
        }

        spines.length = 0;
        spineTicks.length = 0;
        pendingTies.length = 0;
        spineParts.length = 0;
        for (let i = 0; i < newSpines.length; i++) {
          spines.push(newSpines[i]!);
          spineTicks.push(newTicks[i] ?? 0);
          pendingTies.push(newTies[i] ?? new Map());
          spineParts.push(newParts[i] ?? null);
        }
        continue;
      }

      // Regular tandem interpretations
      for (let si = 0; si < tokens.length && si < spines.length; si++) {
        const tok = (tokens[si] ?? '').trim();

        // Key signature: *k[f#c#]
        const keySigMatch = tok.match(/^\*k\[(.*?)\]$/);
        if (keySigMatch) {
          keySigFifths = parseKeySig(keySigMatch[1] ?? '');
          continue;
        }

        // Mode
        if (tok === '*major') { mode = 'major'; continue; }
        if (tok === '*minor') { mode = 'minor'; continue; }

        // Meter: *M4/4
        const meterMatch = tok.match(/^\*M(\d+)\/(\d+)$/);
        if (meterMatch) {
          meterNum = parseInt(meterMatch[1]!, 10);
          meterDen = parseInt(meterMatch[2]!, 10);
          foundMeter = true;
          continue;
        }

        // Tempo: *MM120
        const tempoMatch = tok.match(/^\*MM(\d+)/);
        if (tempoMatch) {
          const bpm = parseInt(tempoMatch[1]!, 10);
          if (bpm > 0) {
            score.tempoChanges.push({ bpm, atTick: spineTicks[si] ?? 0 });
          }
        }
      }
      continue;
    }

    // Local comments (lines where all tokens start with !)
    if (tokens.every(t => t.startsWith('!'))) continue;

    // Data records
    for (let si = 0; si < tokens.length && si < spines.length; si++) {
      const spine = spines[si]!;
      if (spine.type !== '**kern') continue;

      const token = (tokens[si] ?? '').trim();
      if (!token || token === '.') continue; // null token

      const part = spineParts[si];
      if (!part) continue;

      // Handle chords (space-separated sub-tokens)
      const subTokens = token.split(' ').filter(t => t.length > 0);
      const chordOnset = spineTicks[si] ?? 0;
      let chordDuration = 0;

      for (let sti = 0; sti < subTokens.length; sti++) {
        const subToken = subTokens[sti]!;
        // Rest
        if (subToken.includes('r')) {
          const dur = parseDuration(subToken);
          if (sti === 0) chordDuration = dur;
          continue;
        }

        const midi = parsePitch(subToken);
        if (midi === null) {
          warnings.push({ line: lineNum, message: `Unable to parse pitch from token: ${subToken}` });
          continue;
        }

        const dur = parseDuration(subToken);
        const articulation = parseArticulation(subToken);
        const tieKey = `${si}:${midi}`;
        const ties = pendingTies[si]!;
        if (sti === 0) chordDuration = dur;

        // Tie handling
        const hasTieStart = subToken.includes('[');
        const hasTieCont = subToken.includes('_');
        const hasTieEnd = subToken.includes(']');

        if (hasTieCont) {
          // Continuation: extend pending tie duration
          const pending = ties.get(tieKey);
          if (pending) {
            pending.duration += dur;
          } else {
            warnings.push({ line: lineNum, message: `Tie continuation without start for MIDI ${midi}` });
            addNote(score, part, {
              midi, onset: chordOnset, duration: dur,
              velocity: 80, voice: 0, articulation,
            });
          }
        } else if (hasTieEnd) {
          // End: finalize tied note
          const pending = ties.get(tieKey);
          if (pending) {
            pending.duration += dur;
            addNote(score, part, {
              midi, onset: pending.onset,
              duration: Math.max(1, pending.duration),
              velocity: pending.velocity, voice: pending.voice,
              articulation: pending.articulation,
            });
            ties.delete(tieKey);
          } else {
            warnings.push({ line: lineNum, message: `Tie end without start for MIDI ${midi}` });
            addNote(score, part, {
              midi, onset: chordOnset, duration: dur,
              velocity: 80, voice: 0, articulation,
            });
          }
        } else if (hasTieStart) {
          // Start: store pending
          ties.set(tieKey, {
            onset: chordOnset, duration: dur,
            velocity: 80, voice: 0, articulation,
          });
        } else {
          // Regular note
          addNote(score, part, {
            midi, onset: chordOnset, duration: dur,
            velocity: 80, voice: 0, articulation,
          });
        }
      }

      // Advance tick once for the entire chord token
      spineTicks[si] = chordOnset + chordDuration;
    }
  }

  // Set metadata
  score.metadata.title = title;
  score.metadata.composer = composer;

  // Set key center from collected key signature info
  const tonic = FIFTHS_TO_TONIC[String(keySigFifths) as unknown as number];
  if (tonic !== undefined) {
    const finalTonic = mode === 'minor' ? (tonic + 9) % 12 : tonic;
    score.keyCenters.push({ tonic: finalTonic, mode, atTick: 0 });
  }

  // Set time signature
  if (foundMeter) {
    score.timeSignatures.push({ numerator: meterNum, denominator: meterDen, atTick: 0 });
  }

  // Defaults
  if (score.timeSignatures.length === 0) {
    score.timeSignatures.push({ numerator: 4, denominator: 4, atTick: 0 });
  }
  if (score.tempoChanges.length === 0) {
    score.tempoChanges.push({ bpm: 120, atTick: 0 });
  }

  // Flush remaining pending ties
  for (let si = 0; si < spines.length; si++) {
    const ties = pendingTies[si];
    const part = spineParts[si];
    if (!ties || !part) continue;
    for (const [tieKey, pending] of ties) {
      const midi = parseInt(tieKey.split(':')[1] ?? '60', 10);
      warnings.push({ line: lines.length, message: `Unterminated tie for MIDI ${midi}` });
      addNote(score, part, {
        midi, onset: pending.onset,
        duration: Math.max(1, pending.duration),
        velocity: pending.velocity, voice: pending.voice,
        articulation: pending.articulation,
      });
    }
  }

  return Object.freeze({
    score,
    warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
  });
}
