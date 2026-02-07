// ---------------------------------------------------------------------------
// Stratum — MEI 5.0 Import
// ---------------------------------------------------------------------------

import type { Score, Articulation } from '../core/types.js';
import { createScore, addPart, addNote } from '../core/score.js';
import { parseXml, findChild, findChildren, textContent } from './xml.js';
import type { XmlElement } from './xml.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A warning generated during MEI import for non-fatal issues. */
export interface MeiWarning {
  readonly line: number;
  readonly message: string;
}

/** Result of importing an MEI file. */
export interface MeiImportResult {
  readonly score: Score;
  readonly warnings: readonly MeiWarning[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TPQ = 480;

/** Pitch name → semitone offset from C. */
const PNAME_SEMITONE: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

/** Accidental string → semitone offset. */
const ACCID_SEMITONE: Record<string, number> = {
  s: 1, f: -1, n: 0, ss: 2, x: 2, ff: -2, su: 1.5, sd: 0.5, fu: -0.5, fd: -1.5,
};

/** Articulation string → Articulation type. */
const ARTIC_MAP: Record<string, Articulation> = {
  stacc: 'staccato',
  ten: 'tenuto',
  acc: 'accent',
  marc: 'marcato',
  fermata: 'fermata',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse @key.sig attribute (e.g., "0", "1s", "2f", "3s") to fifths count.
 */
function parseKeySig(keySig: string): number {
  const match = keySig.match(/^(\d+)([sf]?)$/);
  if (!match) return 0;
  const count = parseInt(match[1]!, 10);
  const type = match[2] ?? '';
  if (type === 'f') return -count;
  return count; // sharps or 0
}

/**
 * Convert duration reciprocal + dots to ticks.
 */
function durToTicks(dur: number, dots: number, tupletRatio?: { num: number; numbase: number }): number {
  if (dur <= 0) return TPQ;
  let baseTicks = (TPQ * 4) / dur;

  // Apply dots
  let total = baseTicks;
  let add = baseTicks;
  for (let i = 0; i < dots; i++) {
    add /= 2;
    total += add;
  }

  // Apply tuplet ratio
  if (tupletRatio && tupletRatio.num > 0) {
    total = total * tupletRatio.numbase / tupletRatio.num;
  }

  return Math.round(total);
}

/**
 * Get accidental from a note element (from @accid or child <accid>).
 */
function getAccid(noteEl: XmlElement): string | undefined {
  const accidAttr = noteEl.attrs['accid'];
  if (accidAttr) return accidAttr;

  // Check for <accid> child element
  const accidEl = findChild(noteEl, 'accid');
  if (accidEl) return accidEl.attrs['accid'];

  // Check accid.ges (gestural accidental, not displayed)
  const accidGes = noteEl.attrs['accid.ges'];
  if (accidGes) return accidGes;

  return undefined;
}

/**
 * Get articulation from a note/chord element.
 */
function getArticulation(el: XmlElement): Articulation | undefined {
  // @artic attribute
  const articAttr = el.attrs['artic'];
  if (articAttr) {
    const mapped = ARTIC_MAP[articAttr];
    if (mapped) return mapped;
  }

  // <artic> child element
  const articEl = findChild(el, 'artic');
  if (articEl) {
    const articName = articEl.attrs['artic'];
    if (articName) {
      const mapped = ARTIC_MAP[articName];
      if (mapped) return mapped;
    }
  }

  return undefined;
}

/**
 * Convert a note element to MIDI number.
 */
function noteToMidi(noteEl: XmlElement): number | null {
  const pname = noteEl.attrs['pname'];
  const octStr = noteEl.attrs['oct'];
  if (!pname || !octStr) return null;

  const baseSemitone = PNAME_SEMITONE[pname];
  if (baseSemitone === undefined) return null;

  const oct = parseInt(octStr, 10);
  if (Number.isNaN(oct)) return null;

  let accidOffset = 0;
  const accid = getAccid(noteEl);
  if (accid) {
    const offset = ACCID_SEMITONE[accid];
    if (offset !== undefined) accidOffset = Math.round(offset);
  }

  const midi = (oct + 1) * 12 + baseSemitone + accidOffset;
  return Math.max(0, Math.min(127, midi));
}

/**
 * Deep-search for an element by tag name in the tree.
 */
function findDeep(el: XmlElement, tag: string): XmlElement | undefined {
  for (const ch of el.children) {
    if (typeof ch === 'string') continue;
    if (ch.tag === tag) return ch;
    const found = findDeep(ch, tag);
    if (found) return found;
  }
  return undefined;
}

/**
 * Deep-search for all elements by tag name.
 */
function findAllDeep(el: XmlElement, tag: string): XmlElement[] {
  const results: XmlElement[] = [];
  for (const ch of el.children) {
    if (typeof ch === 'string') continue;
    if (ch.tag === tag) results.push(ch);
    results.push(...findAllDeep(ch, tag));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an MEI 5.0 file into a Score.
 *
 * Supports:
 * - `<scoreDef>` with `<staffDef>` (key.sig, meter.count, meter.unit)
 * - `<section>/<measure>/<staff>/<layer>` structure
 * - Notes (`<note>`) with pname, oct, dur, dots, accid
 * - Rests (`<rest>`, `<mRest>`)
 * - Chords (`<chord>`)
 * - Ties (`@tie` attribute)
 * - Tuplets (`<tuplet>`)
 * - Articulations (`@artic`, `<artic>`)
 * - Spaces (`<space>`)
 * - Critical apparatus (`<app>/<lem>` — takes lemma reading)
 * - Beams (`<beam>` — transparent traversal)
 * - Metadata from `<meiHead>`
 *
 * @param text - MEI XML source string.
 * @returns Import result with score and any warnings.
 * @throws {RangeError} If root element is not `<mei>`.
 */
export function meiToScore(text: string): MeiImportResult {
  const root = parseXml(text);
  const warnings: MeiWarning[] = [];

  if (root.tag !== 'mei') {
    throw new RangeError(`Expected <mei> root element, got <${root.tag}>`);
  }

  // --- Metadata ---
  let title = '';
  let composer = '';

  const meiHead = findChild(root, 'meiHead');
  if (meiHead) {
    // Title: look in fileDesc/titleStmt/title
    const fileDesc = findChild(meiHead, 'fileDesc');
    if (fileDesc) {
      const titleStmt = findChild(fileDesc, 'titleStmt');
      if (titleStmt) {
        const titleEl = findChild(titleStmt, 'title');
        if (titleEl) title = textContent(titleEl).trim();

        // Composer: <persName role="composer"> or <respStmt>/<persName>
        const respStmt = findChild(titleStmt, 'respStmt');
        if (respStmt) {
          for (const ch of respStmt.children) {
            if (typeof ch === 'string') continue;
            if (ch.tag === 'persName') {
              const role = ch.attrs['role'];
              if (role === 'composer' || !role) {
                composer = textContent(ch).trim();
                break;
              }
            }
          }
        }
      }
    }
  }

  // --- Navigate to score element ---
  const music = findChild(root, 'music');
  if (!music) {
    return Object.freeze({
      score: createScore({ title, composer, ticksPerQuarter: TPQ }),
      warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
    });
  }

  const body = findChild(music, 'body');
  if (!body) {
    return Object.freeze({
      score: createScore({ title, composer, ticksPerQuarter: TPQ }),
      warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
    });
  }

  const mdiv = findChild(body, 'mdiv');
  const scoreEl = mdiv ? findChild(mdiv, 'score') : null;
  if (!scoreEl) {
    return Object.freeze({
      score: createScore({ title, composer, ticksPerQuarter: TPQ }),
      warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
    });
  }

  // --- Create Score ---
  const score = createScore({ title, composer, ticksPerQuarter: TPQ });
  score.timeSignatures.length = 0;
  score.tempoChanges.length = 0;
  score.keyCenters.length = 0;

  // --- Parse scoreDef ---
  const scoreDef = findChild(scoreEl, 'scoreDef');
  const staffDefs: XmlElement[] = [];
  if (scoreDef) {
    staffDefs.push(...findAllDeep(scoreDef, 'staffDef'));
  }

  // Create parts from staffDefs
  const staffParts = new Map<string, ReturnType<typeof addPart>>();
  for (const sd of staffDefs) {
    const staffN = sd.attrs['n'] ?? String(staffParts.size + 1);
    const label = sd.attrs['label'] ?? `Staff ${staffN}`;
    const part = addPart(score, { name: label });
    staffParts.set(staffN, part);

    // Key signature
    const keySig = sd.attrs['key.sig'];
    if (keySig) {
      const fifths = parseKeySig(keySig);
      const majorTonic = ((fifths * 7) % 12 + 12) % 12;
      const keyMode = sd.attrs['key.mode'] ?? 'major';
      const tonic = keyMode === 'minor' ? (majorTonic + 9) % 12 : majorTonic;
      score.keyCenters.push({ tonic, mode: keyMode, atTick: 0 });
    }

    // Time signature
    const mCount = sd.attrs['meter.count'];
    const mUnit = sd.attrs['meter.unit'];
    if (mCount && mUnit) {
      const num = parseInt(mCount, 10);
      const den = parseInt(mUnit, 10);
      if (!Number.isNaN(num) && !Number.isNaN(den)) {
        if (!score.timeSignatures.some(ts => ts.atTick === 0 && ts.numerator === num && ts.denominator === den)) {
          score.timeSignatures.push({ numerator: num, denominator: den, atTick: 0 });
        }
      }
    }
  }

  // If no staffDefs, create a default part
  if (staffParts.size === 0) {
    staffParts.set('1', addPart(score, { name: 'Staff 1' }));
  }

  // Ensure defaults
  if (score.timeSignatures.length === 0) {
    score.timeSignatures.push({ numerator: 4, denominator: 4, atTick: 0 });
  }
  if (score.tempoChanges.length === 0) {
    score.tempoChanges.push({ bpm: 120, atTick: 0 });
  }

  // --- Process sections/measures ---
  const sections = findChildren(scoreEl, 'section');
  if (sections.length === 0) {
    // Try direct measures
    sections.push(scoreEl);
  }

  // Per-staff tick tracking
  const staffTicks = new Map<string, number>();
  for (const staffN of staffParts.keys()) {
    staffTicks.set(staffN, 0);
  }

  // Tie tracking per staff: `${staffN}:${layerN}:${midi}` → pending
  interface PendingTie {
    onset: number;
    duration: number;
    velocity: number;
    voice: number;
    articulation?: Articulation;
  }
  const pendingTies = new Map<string, PendingTie>();

  for (const section of sections) {
    const measures = findChildren(section, 'measure');

    for (const measure of measures) {
      const staves = findChildren(measure, 'staff');

      for (const staff of staves) {
        const staffN = staff.attrs['n'] ?? '1';
        const part = staffParts.get(staffN);
        if (!part) {
          // Create part on-the-fly
          const newPart = addPart(score, { name: `Staff ${staffN}` });
          staffParts.set(staffN, newPart);
          staffTicks.set(staffN, 0);
        }
        const currentPart = staffParts.get(staffN)!;

        const layers = findChildren(staff, 'layer');
        for (const layer of layers) {
          const layerN = layer.attrs['n'] ?? '1';
          const voice = parseInt(layerN, 10) - 1;
          let currentTick = staffTicks.get(staffN) ?? 0;

          // Process layer children
          processLayerChildren(
            layer.children, score, currentPart, staffN, layerN,
            voice, currentTick, undefined, warnings, pendingTies,
            (newTick: number) => { currentTick = newTick; },
          );

          // Update staff tick to max
          const existingTick = staffTicks.get(staffN) ?? 0;
          if (currentTick > existingTick) {
            staffTicks.set(staffN, currentTick);
          }
        }

        // If no layers, process direct children
        if (layers.length === 0) {
          let currentTick = staffTicks.get(staffN) ?? 0;
          processLayerChildren(
            staff.children, score, currentPart, staffN, '1',
            0, currentTick, undefined, warnings, pendingTies,
            (newTick: number) => { currentTick = newTick; },
          );
          const existingTick = staffTicks.get(staffN) ?? 0;
          if (currentTick > existingTick) {
            staffTicks.set(staffN, currentTick);
          }
        }
      }

      // If no staves in measure, advance ticks by one measure
      if (staves.length === 0) {
        const ts = score.timeSignatures[0] ?? { numerator: 4, denominator: 4 };
        const measureTicks = Math.round((TPQ * 4 * ts.numerator) / ts.denominator);
        for (const [staffN, tick] of staffTicks) {
          staffTicks.set(staffN, tick + measureTicks);
        }
      }
    }
  }

  // Flush pending ties
  for (const [tieKey, pending] of pendingTies) {
    const parts = tieKey.split(':');
    const staffN = parts[0] ?? '1';
    const midi = parseInt(parts[2] ?? '60', 10);
    const part = staffParts.get(staffN);
    if (part) {
      warnings.push({ line: 0, message: `Unterminated tie for MIDI ${midi} in staff ${staffN}` });
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

  // Sort
  score.keyCenters.sort((a, b) => a.atTick - b.atTick);
  score.timeSignatures.sort((a, b) => a.atTick - b.atTick);

  return Object.freeze({
    score,
    warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
  });
}

/**
 * Process children of a layer (or beam, tuplet, etc.) recursively.
 */
function processLayerChildren(
  children: readonly (XmlElement | string)[],
  score: Score,
  part: ReturnType<typeof addPart>,
  staffN: string,
  layerN: string,
  voice: number,
  currentTick: number,
  tupletRatio: { num: number; numbase: number } | undefined,
  warnings: MeiWarning[],
  pendingTies: Map<string, { onset: number; duration: number; velocity: number; voice: number; articulation?: Articulation }>,
  setTick: (tick: number) => void,
): void {
  for (const child of children) {
    if (typeof child === 'string') continue;

    // Beam: transparent container, process children
    if (child.tag === 'beam') {
      processLayerChildren(
        child.children, score, part, staffN, layerN,
        voice, currentTick, tupletRatio, warnings, pendingTies,
        (newTick) => { currentTick = newTick; },
      );
      setTick(currentTick);
      continue;
    }

    // Tuplet
    if (child.tag === 'tuplet') {
      const num = parseInt(child.attrs['num'] ?? '3', 10);
      const numbase = parseInt(child.attrs['numbase'] ?? '2', 10);
      const ratio = { num, numbase };
      processLayerChildren(
        child.children, score, part, staffN, layerN,
        voice, currentTick, ratio, warnings, pendingTies,
        (newTick) => { currentTick = newTick; },
      );
      setTick(currentTick);
      continue;
    }

    // Critical apparatus: take lemma
    if (child.tag === 'app') {
      const lem = findChild(child, 'lem');
      if (lem) {
        processLayerChildren(
          lem.children, score, part, staffN, layerN,
          voice, currentTick, tupletRatio, warnings, pendingTies,
          (newTick) => { currentTick = newTick; },
        );
        setTick(currentTick);
      }
      continue;
    }

    // Note
    if (child.tag === 'note') {
      const midi = noteToMidi(child);
      const dur = parseInt(child.attrs['dur'] ?? '4', 10);
      const dots = parseInt(child.attrs['dots'] ?? '0', 10);
      const ticks = durToTicks(dur, dots, tupletRatio);
      const articulation = getArticulation(child);

      if (midi !== null) {
        const tieAttr = child.attrs['tie'];
        const tieKey = `${staffN}:${layerN}:${midi}`;

        if (tieAttr === 'm' || tieAttr === 't') {
          // Medial or terminal tie: extend pending
          const pending = pendingTies.get(tieKey);
          if (pending) {
            pending.duration += ticks;
            if (tieAttr === 't') {
              // Terminal: create merged note
              addNote(score, part, {
                midi,
                onset: pending.onset,
                duration: Math.max(1, pending.duration),
                velocity: pending.velocity,
                voice: pending.voice,
                articulation: pending.articulation,
              });
              pendingTies.delete(tieKey);
            }
          } else {
            // No pending tie — create note anyway
            warnings.push({ line: 0, message: `Tie ${tieAttr} without matching start for MIDI ${midi}` });
            addNote(score, part, {
              midi, onset: currentTick, duration: ticks,
              velocity: 80, voice, articulation,
            });
          }
        } else if (tieAttr === 'i') {
          // Initial tie
          pendingTies.set(tieKey, {
            onset: currentTick, duration: ticks,
            velocity: 80, voice, articulation,
          });
        } else {
          // No tie — regular note
          addNote(score, part, {
            midi, onset: currentTick, duration: ticks,
            velocity: 80, voice, articulation,
          });
        }
      }

      currentTick += ticks;
      setTick(currentTick);
      continue;
    }

    // Chord: all notes at same onset
    if (child.tag === 'chord') {
      const dur = parseInt(child.attrs['dur'] ?? '4', 10);
      const dots = parseInt(child.attrs['dots'] ?? '0', 10);
      const ticks = durToTicks(dur, dots, tupletRatio);
      const chordArticulation = getArticulation(child);

      const notes = findChildren(child, 'note');
      for (const noteEl of notes) {
        const midi = noteToMidi(noteEl);
        if (midi === null) continue;

        const noteArticulation = getArticulation(noteEl) ?? chordArticulation;
        const tieAttr = noteEl.attrs['tie'];
        const tieKey = `${staffN}:${layerN}:${midi}`;

        if (tieAttr === 'm' || tieAttr === 't') {
          const pending = pendingTies.get(tieKey);
          if (pending) {
            pending.duration += ticks;
            if (tieAttr === 't') {
              addNote(score, part, {
                midi, onset: pending.onset,
                duration: Math.max(1, pending.duration),
                velocity: pending.velocity, voice: pending.voice,
                articulation: pending.articulation,
              });
              pendingTies.delete(tieKey);
            }
          } else {
            addNote(score, part, {
              midi, onset: currentTick, duration: ticks,
              velocity: 80, voice, articulation: noteArticulation,
            });
          }
        } else if (tieAttr === 'i') {
          pendingTies.set(tieKey, {
            onset: currentTick, duration: ticks,
            velocity: 80, voice, articulation: noteArticulation,
          });
        } else {
          addNote(score, part, {
            midi, onset: currentTick, duration: ticks,
            velocity: 80, voice, articulation: noteArticulation,
          });
        }
      }

      currentTick += ticks;
      setTick(currentTick);
      continue;
    }

    // Rest
    if (child.tag === 'rest') {
      const dur = parseInt(child.attrs['dur'] ?? '4', 10);
      const dots = parseInt(child.attrs['dots'] ?? '0', 10);
      const ticks = durToTicks(dur, dots, tupletRatio);
      currentTick += ticks;
      setTick(currentTick);
      continue;
    }

    // Measure rest
    if (child.tag === 'mRest') {
      const ts = score.timeSignatures[score.timeSignatures.length - 1] ??
        { numerator: 4, denominator: 4 };
      const measureTicks = Math.round((TPQ * 4 * ts.numerator) / ts.denominator);
      currentTick += measureTicks;
      setTick(currentTick);
      continue;
    }

    // Space: advance tick without creating event
    if (child.tag === 'space') {
      const dur = parseInt(child.attrs['dur'] ?? '4', 10);
      const dots = parseInt(child.attrs['dots'] ?? '0', 10);
      const ticks = durToTicks(dur, dots, tupletRatio);
      currentTick += ticks;
      setTick(currentTick);
      continue;
    }
  }
}
