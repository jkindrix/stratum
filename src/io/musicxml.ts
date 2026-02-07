// ---------------------------------------------------------------------------
// Stratum — MusicXML 4.0 Import & Export
// ---------------------------------------------------------------------------

import type { Score, Part, Articulation, KeyCenter } from '../core/types.js';
import { createScore, addPart, addNote } from '../core/score.js';
import { spellPitch } from '../pitch/spelling.js';
import type { XmlElement } from './xml.js';
import {
  parseXml,
  serializeXml,
  createElement,
  findChild,
  findChildren,
  textContent,
  childText,
  childInt,
} from './xml.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A warning generated during MusicXML import for non-fatal issues. */
export interface MusicXmlWarning {
  readonly measure: number;
  readonly partId: string;
  readonly message: string;
}

/** Result of importing a MusicXML file. */
export interface MusicXmlImportResult {
  readonly score: Score;
  readonly warnings: readonly MusicXmlWarning[];
}

/** Options for MusicXML export. */
export interface MusicXmlExportOptions {
  /** Software name in the identification element (default: 'stratum-kit'). */
  readonly software?: string;
  /** Pretty-print with indentation (default: true). */
  readonly indent?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Semitone offset for each diatonic step from C. */
const STEP_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Dynamic marking tag → MIDI velocity. */
const DYNAMICS_VELOCITY: Record<string, number> = {
  ppp: 16, pp: 33, p: 49, mp: 64, mf: 80, f: 96, ff: 112, fff: 127,
};

/** MusicXML articulation tag → Articulation type. */
const ARTICULATION_MAP: Record<string, Articulation> = {
  'staccato': 'staccato',
  'tenuto': 'tenuto',
  'accent': 'accent',
  'strong-accent': 'marcato',
};

/** Pitch class → number of fifths (sharps/flats) for key signature export. */
const PC_TO_FIFTHS: Record<number, number> = {
  0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6,
  5: -1, 10: -2, 3: -3, 8: -4, 1: -5,
};

/** Note type name → quarter-note multiples. */
const NOTE_TYPE_QUARTERS: readonly [string, number][] = [
  ['whole', 4],
  ['half', 2],
  ['quarter', 1],
  ['eighth', 0.5],
  ['16th', 0.25],
  ['32nd', 0.125],
  ['64th', 0.0625],
];

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Parse a MusicXML 4.0 (score-partwise) file into a Score.
 *
 * - Supports notes, rests, chords, ties, multiple voices, tuplets,
 *   grace notes, pickup measures, transposing instruments, dynamics,
 *   articulations, key/time/tempo changes, and multi-part scores.
 * - Returns warnings for non-fatal issues (e.g., unknown elements).
 * - Throws on malformed XML or unsupported format (score-timewise).
 *
 * @param text - MusicXML source string.
 * @returns Import result with score and any warnings.
 * @throws {RangeError} If the XML is malformed or uses score-timewise format.
 */
export function musicXmlToScore(text: string): MusicXmlImportResult {
  const root = parseXml(text);
  const warnings: MusicXmlWarning[] = [];

  if (root.tag === 'score-timewise') {
    throw new RangeError(
      'score-timewise format is not supported. Please convert to score-partwise format ' +
      '(most notation software exports partwise by default).',
    );
  }

  if (root.tag !== 'score-partwise') {
    throw new RangeError(
      `Expected <score-partwise> root element, got <${root.tag}>`,
    );
  }

  // --- Metadata ---
  let title = '';
  const work = findChild(root, 'work');
  if (work) title = childText(work, 'work-title') ?? '';
  const movementTitle = childText(root, 'movement-title');
  if (movementTitle && !title) title = movementTitle;

  let composer = '';
  const ident = findChild(root, 'identification');
  if (ident) {
    for (const cr of findChildren(ident, 'creator')) {
      if (cr.attrs['type'] === 'composer') {
        composer = textContent(cr);
        break;
      }
    }
  }

  // --- Part list ---
  interface PartInfo { name: string; midiProgram: number; midiChannel: number }
  const partInfoMap = new Map<string, PartInfo>();
  const partList = findChild(root, 'part-list');
  if (partList) {
    for (const sp of findChildren(partList, 'score-part')) {
      const id = sp.attrs['id'] ?? '';
      const name = childText(sp, 'part-name') ?? id;
      let midiProgram = 0;
      let midiChannel = 0;
      const midiInst = findChild(sp, 'midi-instrument');
      if (midiInst) {
        const prog = childInt(midiInst, 'midi-program');
        if (prog !== undefined) midiProgram = Math.max(0, Math.min(127, prog - 1)); // MusicXML is 1-based
        const ch = childInt(midiInst, 'midi-channel');
        if (ch !== undefined) midiChannel = Math.max(0, Math.min(15, ch - 1)); // MusicXML is 1-based
      }
      partInfoMap.set(id, { name, midiProgram, midiChannel });
    }
  }

  // --- Collect all divisions values to compute LCM ---
  const allDivisions: number[] = [];
  for (const partEl of findChildren(root, 'part')) {
    for (const measureEl of findChildren(partEl, 'measure')) {
      for (const child of measureEl.children) {
        if (typeof child === 'string') continue;
        if (child.tag === 'attributes') {
          const div = childInt(child, 'divisions');
          if (div !== undefined && div > 0) allDivisions.push(div);
        }
      }
    }
  }

  function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
  function lcm(a: number, b: number): number { return (a / gcd(a, b)) * b; }
  const globalDivisions = allDivisions.length > 0 ? allDivisions.reduce(lcm) : 1;

  // --- Create Score ---
  const score = createScore({
    title,
    composer,
    ticksPerQuarter: globalDivisions,
  });
  // Clear defaults — we'll fill from MusicXML
  score.timeSignatures.length = 0;
  score.tempoChanges.length = 0;
  score.keyCenters.length = 0;

  let addedTimeSig = false;
  let addedTempo = false;

  // --- Process each part ---
  for (const partEl of findChildren(root, 'part')) {
    const partId = partEl.attrs['id'] ?? '';
    const info = partInfoMap.get(partId) ?? { name: partId, midiProgram: 0, midiChannel: 0 };
    const part = addPart(score, {
      name: info.name,
      midiProgram: info.midiProgram,
      midiChannel: info.midiChannel,
    });

    let currentDivisions = globalDivisions;
    let currentTick = 0;
    let currentTranspose = 0;
    let currentVelocity = 80;
    const voiceMap = new Map<string, number>();
    let nextVoice = 0;

    // Tie tracking: key = `${voice}:${midi}`, value = {onset, velocity, articulation}
    interface PendingTie { onset: number; duration: number; velocity: number; articulation?: Articulation }
    const pendingTies = new Map<string, PendingTie>();

    let measureNumber = 0;

    for (const measureEl of findChildren(partEl, 'measure')) {
      measureNumber++;
      const mNumAttr = measureEl.attrs['number'];
      const mNum = mNumAttr !== undefined ? parseInt(mNumAttr, 10) : measureNumber;
      if (!Number.isNaN(mNum)) measureNumber = mNum;

      // Detect pickup measure
      const implicitAttr = measureEl.attrs['implicit'];
      const isImplicit = implicitAttr === 'yes' || measureNumber === 0;

      let prevNoteDuration = 0;
      let prevNoteOnset = currentTick;

      for (const child of measureEl.children) {
        if (typeof child === 'string') continue;

        // --- <attributes> ---
        if (child.tag === 'attributes') {
          const div = childInt(child, 'divisions');
          if (div !== undefined && div > 0) currentDivisions = div;

          // Key signature
          const keyEl = findChild(child, 'key');
          if (keyEl) {
            const fifths = childInt(keyEl, 'fifths') ?? 0;
            const modeStr = childText(keyEl, 'mode') ?? 'major';
            const majorTonic = ((fifths * 7) % 12 + 12) % 12;
            const tonic = modeStr === 'minor' ? (majorTonic + 9) % 12 : majorTonic;
            score.keyCenters.push({
              tonic,
              mode: modeStr === 'minor' ? 'minor' : 'major',
              atTick: currentTick,
            });
          }

          // Time signature
          const timeEl = findChild(child, 'time');
          if (timeEl) {
            const num = childInt(timeEl, 'beats') ?? 4;
            const den = childInt(timeEl, 'beat-type') ?? 4;
            if (!addedTimeSig || !score.timeSignatures.some(
              ts => ts.atTick === currentTick && ts.numerator === num && ts.denominator === den)) {
              score.timeSignatures.push({ numerator: num, denominator: den, atTick: currentTick });
              addedTimeSig = true;
            }
          }

          // Transpose
          const transposeEl = findChild(child, 'transpose');
          if (transposeEl) {
            currentTranspose = childInt(transposeEl, 'chromatic') ?? 0;
          }

          // Clef (informational only, but we parse it to prevent unknown-element warnings)
          continue;
        }

        // --- <direction> (tempo, dynamics) ---
        if (child.tag === 'direction') {
          // Tempo
          const sound = findChild(child, 'sound');
          if (sound && sound.attrs['tempo']) {
            const bpm = parseFloat(sound.attrs['tempo']);
            if (Number.isFinite(bpm) && bpm > 0) {
              if (!addedTempo || !score.tempoChanges.some(tc => tc.atTick === currentTick && tc.bpm === bpm)) {
                score.tempoChanges.push({ bpm, atTick: currentTick });
                addedTempo = true;
              }
            }
          }

          // Dynamics
          const dirType = findChild(child, 'direction-type');
          if (dirType) {
            const dynEl = findChild(dirType, 'dynamics');
            if (dynEl) {
              for (const dynChild of dynEl.children) {
                if (typeof dynChild === 'string') continue;
                const vel = DYNAMICS_VELOCITY[dynChild.tag];
                if (vel !== undefined) {
                  currentVelocity = vel;
                  break;
                }
              }
            }
          }
          continue;
        }

        // --- <forward> ---
        if (child.tag === 'forward') {
          const dur = childInt(child, 'duration') ?? 0;
          currentTick += scaleTicks(dur, currentDivisions, globalDivisions);
          continue;
        }

        // --- <backup> ---
        if (child.tag === 'backup') {
          const dur = childInt(child, 'duration') ?? 0;
          currentTick -= scaleTicks(dur, currentDivisions, globalDivisions);
          if (currentTick < 0) currentTick = 0;
          continue;
        }

        // --- <note> ---
        if (child.tag === 'note') {
          const isRest = findChild(child, 'rest') !== undefined;
          const isGrace = findChild(child, 'grace') !== undefined;
          const isChord = findChild(child, 'chord') !== undefined;

          // Duration
          const rawDuration = childInt(child, 'duration') ?? 0;
          let noteDuration: number;
          if (isGrace) {
            noteDuration = 0;
          } else {
            noteDuration = scaleTicks(rawDuration, currentDivisions, globalDivisions);
          }

          // Time modification (tuplets)
          const timeMod = findChild(child, 'time-modification');
          if (timeMod && !isGrace) {
            const actualNotes = childInt(timeMod, 'actual-notes') ?? 1;
            const normalNotes = childInt(timeMod, 'normal-notes') ?? 1;
            if (actualNotes > 0) {
              noteDuration = Math.round(noteDuration * normalNotes / actualNotes);
            }
          }

          // Chord: don't advance tick, use previous note's onset
          let noteOnset: number;
          if (isChord) {
            noteOnset = prevNoteOnset;
          } else {
            noteOnset = currentTick;
          }

          // Voice
          const voiceStr = childText(child, 'voice') ?? '1';
          if (!voiceMap.has(voiceStr)) {
            voiceMap.set(voiceStr, nextVoice++);
          }
          const voice = voiceMap.get(voiceStr)!;

          if (isRest) {
            // Advance tick for rests (unless chord, which shouldn't happen)
            if (!isChord && !isGrace) {
              prevNoteOnset = currentTick;
              prevNoteDuration = noteDuration;
              currentTick += noteDuration;
            }
            continue;
          }

          // Pitch
          const pitchEl = findChild(child, 'pitch');
          if (!pitchEl) {
            if (!isChord && !isGrace) {
              prevNoteOnset = currentTick;
              prevNoteDuration = noteDuration;
              currentTick += noteDuration;
            }
            continue;
          }

          const step = childText(pitchEl, 'step') ?? 'C';
          const octave = childInt(pitchEl, 'octave') ?? 4;
          const alter = childInt(pitchEl, 'alter') ?? 0;
          const stepSemitone = STEP_SEMITONE[step] ?? 0;
          const midi = Math.max(0, Math.min(127, (octave + 1) * 12 + stepSemitone + alter + currentTranspose));

          // Articulations
          let articulation: Articulation | undefined;
          const notations = findChild(child, 'notations');
          if (notations) {
            // Fermata (directly under notations)
            if (findChild(notations, 'fermata')) {
              articulation = 'fermata';
            }

            const artics = findChild(notations, 'articulations');
            if (artics) {
              for (const artChild of artics.children) {
                if (typeof artChild === 'string') continue;
                const mapped = ARTICULATION_MAP[artChild.tag];
                if (mapped) {
                  articulation = mapped;
                  break;
                }
              }
            }
          }

          // Tie handling
          let tieStart = false;
          let tieStop = false;
          // Check <tie> elements (separate from <tied> in notations)
          for (const tieChild of child.children) {
            if (typeof tieChild === 'string') continue;
            if (tieChild.tag === 'tie') {
              if (tieChild.attrs['type'] === 'start') tieStart = true;
              if (tieChild.attrs['type'] === 'stop') tieStop = true;
            }
          }

          const tieKey = `${voice}:${midi}`;

          if (tieStop) {
            const pending = pendingTies.get(tieKey);
            if (pending) {
              pending.duration += noteDuration;
              if (!tieStart) {
                // End of tie chain — create the merged note
                addNote(score, part, {
                  midi,
                  onset: pending.onset,
                  duration: Math.max(1, pending.duration),
                  velocity: pending.velocity,
                  voice,
                  articulation: pending.articulation,
                });
                pendingTies.delete(tieKey);
              }
              // If tieStart also set, keep extending
            } else {
              // Tie stop without matching start — just create the note
              warnings.push({ measure: measureNumber, partId, message: `Tie stop without matching start for MIDI ${midi}` });
              if (!tieStart) {
                if (noteDuration > 0) {
                  addNote(score, part, {
                    midi, onset: noteOnset, duration: noteDuration,
                    velocity: currentVelocity, voice, articulation,
                  });
                }
              } else {
                pendingTies.set(tieKey, {
                  onset: noteOnset, duration: noteDuration,
                  velocity: currentVelocity, articulation,
                });
              }
            }
          } else if (tieStart) {
            pendingTies.set(tieKey, {
              onset: noteOnset, duration: noteDuration,
              velocity: currentVelocity, articulation,
            });
          } else {
            // No tie — regular note
            if (noteDuration > 0 || isGrace) {
              addNote(score, part, {
                midi, onset: noteOnset,
                duration: isGrace && noteDuration === 0 ? 1 : noteDuration,
                velocity: currentVelocity, voice, articulation,
              });
            }
          }

          // Advance tick
          if (!isChord && !isGrace) {
            prevNoteOnset = currentTick;
            prevNoteDuration = noteDuration;
            currentTick += noteDuration;
          }
        }
      }
    }

    // Flush remaining pending ties
    for (const [tieKey, pending] of pendingTies) {
      const parts = tieKey.split(':');
      const voice = parseInt(parts[0] ?? '0', 10);
      const midi = parseInt(parts[1] ?? '60', 10);
      warnings.push({ measure: measureNumber, partId, message: `Unterminated tie for MIDI ${midi}` });
      addNote(score, part, {
        midi, onset: pending.onset,
        duration: Math.max(1, pending.duration),
        velocity: pending.velocity,
        voice, articulation: pending.articulation,
      });
    }
  }

  // Ensure defaults if nothing was found
  if (score.timeSignatures.length === 0) {
    score.timeSignatures.push({ numerator: 4, denominator: 4, atTick: 0 });
  }
  if (score.tempoChanges.length === 0) {
    score.tempoChanges.push({ bpm: 120, atTick: 0 });
  }

  // Sort
  score.timeSignatures.sort((a, b) => a.atTick - b.atTick);
  score.tempoChanges.sort((a, b) => a.atTick - b.atTick);
  score.keyCenters.sort((a, b) => a.atTick - b.atTick);

  return Object.freeze({
    score,
    warnings: Object.freeze(warnings.map(w => Object.freeze(w))),
  });
}

/** Scale ticks from one divisions base to another. */
function scaleTicks(rawDuration: number, localDivisions: number, globalDivisions: number): number {
  if (localDivisions === globalDivisions) return rawDuration;
  return Math.round(rawDuration * globalDivisions / localDivisions);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export a Score to a MusicXML 4.0 (score-partwise) string.
 *
 * @param score - The score to export.
 * @param options - Export options.
 * @returns MusicXML string.
 */
export function scoreToMusicXML(score: Score, options?: MusicXmlExportOptions): string {
  const software = options?.software ?? 'stratum-kit';
  const indent = options?.indent !== false;
  const divisions = score.settings.ticksPerQuarter;

  // --- Compute measure layout ---
  const measures = computeMeasureLayout(score);

  // --- Build part-list ---
  const partListChildren: XmlElement[] = [];
  for (const part of score.parts) {
    const spChildren: (XmlElement | string)[] = [
      createElement('part-name', {}, [part.name]),
    ];

    const midiInstChildren: (XmlElement | string)[] = [
      createElement('midi-channel', {}, [String(part.midiChannel + 1)]),
      createElement('midi-program', {}, [String(part.midiProgram + 1)]),
    ];
    spChildren.push(createElement('midi-instrument', { id: `${part.id}-inst` }, midiInstChildren));

    partListChildren.push(
      createElement('score-part', { id: part.id }, spChildren),
    );
  }

  // --- Build parts ---
  const partElements: XmlElement[] = [];
  for (const part of score.parts) {
    const measureElements: XmlElement[] = [];

    for (let mi = 0; mi < measures.length; mi++) {
      const m = measures[mi]!;
      const measureChildren: (XmlElement | string)[] = [];

      // Attributes (first measure or on change)
      const attrChildren: (XmlElement | string)[] = [];

      if (mi === 0) {
        attrChildren.push(createElement('divisions', {}, [String(divisions)]));
      }

      // Key signature at this tick
      const keyAtTick = findKeyAtTick(score, m.startTick);
      if (mi === 0 || hasKeyChange(score, m.startTick)) {
        if (keyAtTick) {
          const majorTonic = keyAtTick.mode === 'minor'
            ? (keyAtTick.tonic + 3) % 12
            : keyAtTick.tonic;
          const fifths = PC_TO_FIFTHS[majorTonic] ?? 0;
          attrChildren.push(createElement('key', {}, [
            createElement('fifths', {}, [String(fifths)]),
            createElement('mode', {}, [keyAtTick.mode]),
          ]));
        }
      }

      // Time signature at this tick
      if (mi === 0 || hasTimeSigChange(score, m.startTick)) {
        attrChildren.push(createElement('time', {}, [
          createElement('beats', {}, [String(m.timeSig.numerator)]),
          createElement('beat-type', {}, [String(m.timeSig.denominator)]),
        ]));
      }

      if (mi === 0) {
        attrChildren.push(createElement('clef', {}, [
          createElement('sign', {}, ['G']),
          createElement('line', {}, ['2']),
        ]));
      }

      if (attrChildren.length > 0) {
        measureChildren.push(createElement('attributes', {}, attrChildren));
      }

      // Tempo at this tick
      const tempoAtTick = findTempoAtTick(score, m.startTick);
      if (mi === 0 || hasTempoChange(score, m.startTick)) {
        if (tempoAtTick) {
          measureChildren.push(createElement('direction', { placement: 'above' }, [
            createElement('direction-type', {}, [
              createElement('metronome', {}, [
                createElement('beat-unit', {}, ['quarter']),
                createElement('per-minute', {}, [String(tempoAtTick.bpm)]),
              ]),
            ]),
            createElement('sound', { tempo: String(tempoAtTick.bpm) }),
          ]));
        }
      }

      // Group events in this measure by voice
      const eventsInMeasure = getPartEventsInMeasure(part, m.startTick, m.endTick, divisions);
      const voices = groupByVoice(eventsInMeasure);
      const voiceKeys = Array.from(voices.keys()).sort((a, b) => a - b);

      let isFirstVoice = true;
      let lastVelocity = -1;
      for (const voiceIdx of voiceKeys) {
        const voiceEvents = voices.get(voiceIdx)!;
        voiceEvents.sort((a, b) => a.onset - b.onset);

        if (!isFirstVoice) {
          // Backup to start of measure for subsequent voices
          const backupDur = m.endTick - m.startTick;
          measureChildren.push(createElement('backup', {}, [
            createElement('duration', {}, [String(backupDur)]),
          ]));
        }

        let cursor = m.startTick;

        for (let ei = 0; ei < voiceEvents.length; ei++) {
          const evt = voiceEvents[ei]!;

          // Check if this is a chord (same onset as previous event in this voice)
          const isChord = ei > 0 && evt.onset === (voiceEvents[ei - 1]?.onset ?? -1);

          if (!isChord) {
            // Insert rest if there's a gap
            const gap = evt.onset - cursor;
            if (gap > 0) {
              const restNotes = ticksToNoteTypes(gap, divisions);
              for (const rn of restNotes) {
                const restChildren: (XmlElement | string)[] = [
                  createElement('rest'),
                  createElement('duration', {}, [String(rn.ticks)]),
                  createElement('voice', {}, [String(voiceIdx + 1)]),
                  createElement('type', {}, [rn.type]),
                ];
                for (let d = 0; d < rn.dots; d++) {
                  restChildren.push(createElement('dot'));
                }
                measureChildren.push(createElement('note', {}, restChildren));
              }
              cursor += gap;
            }
          }

          // Dynamics direction if velocity changed significantly
          if (evt.velocity !== lastVelocity) {
            const dynLabel = velocityToDynamic(evt.velocity);
            const prevDynLabel = lastVelocity >= 0 ? velocityToDynamic(lastVelocity) : '';
            if (dynLabel && dynLabel !== prevDynLabel) {
              measureChildren.push(createElement('direction', { placement: 'below' }, [
                createElement('direction-type', {}, [
                  createElement('dynamics', {}, [
                    createElement(dynLabel),
                  ]),
                ]),
                createElement('sound', { dynamics: String(evt.velocity) }),
              ]));
            }
            lastVelocity = evt.velocity;
          }

          // Determine if note crosses barline — split into tied segments
          const noteEnd = evt.onset + evt.duration;
          const actualEnd = Math.min(noteEnd, m.endTick);
          const noteDur = isChord ? Math.min(evt.duration, m.endTick - evt.onset) : actualEnd - evt.onset;
          const needsTie = noteEnd > m.endTick;

          // Get key context for pitch spelling
          const keyCtx = findKeyAtTick(score, evt.onset);
          const spellingKey = keyCtx
            ? { tonic: keyCtx.tonic, mode: keyCtx.mode as 'major' | 'minor' }
            : undefined;
          const spelled = spellPitch(evt.pitch.midi, spellingKey);

          const noteTypes = ticksToNoteTypes(Math.max(1, noteDur), divisions);
          for (let ti = 0; ti < noteTypes.length; ti++) {
            const nt = noteTypes[ti]!;
            const noteChildren: (XmlElement | string)[] = [];

            if (isChord) noteChildren.push(createElement('chord'));

            // Pitch
            const pitchChildren: (XmlElement | string)[] = [
              createElement('step', {}, [spelled.letter]),
            ];
            if (spelled.accidental === '#') pitchChildren.push(createElement('alter', {}, ['1']));
            else if (spelled.accidental === 'b') pitchChildren.push(createElement('alter', {}, ['-1']));
            else if (spelled.accidental === '##') pitchChildren.push(createElement('alter', {}, ['2']));
            else if (spelled.accidental === 'bb') pitchChildren.push(createElement('alter', {}, ['-2']));
            pitchChildren.push(createElement('octave', {}, [String(spelled.octave)]));
            noteChildren.push(createElement('pitch', {}, pitchChildren));

            noteChildren.push(createElement('duration', {}, [String(nt.ticks)]));

            // Tie elements
            const isTieStart = needsTie && ti === noteTypes.length - 1;
            const isTieMid = noteTypes.length > 1 && ti > 0 && ti < noteTypes.length - 1;
            const isTieStop = ti > 0;
            // For cross-barline: mark tie start on last segment of this measure
            if (isTieStop || isTieMid) noteChildren.push(createElement('tie', { type: 'stop' }));
            if (isTieStart || (noteTypes.length > 1 && ti < noteTypes.length - 1)) {
              noteChildren.push(createElement('tie', { type: 'start' }));
            }

            noteChildren.push(createElement('voice', {}, [String(voiceIdx + 1)]));
            noteChildren.push(createElement('type', {}, [nt.type]));

            for (let d = 0; d < nt.dots; d++) {
              noteChildren.push(createElement('dot'));
            }

            // Articulations and notations
            if (evt.articulation && ti === 0) {
              const notationChildren: (XmlElement | string)[] = [];
              if (evt.articulation === 'fermata') {
                notationChildren.push(createElement('fermata'));
              } else {
                const artTag = articulationToTag(evt.articulation);
                if (artTag) {
                  notationChildren.push(createElement('articulations', {}, [
                    createElement(artTag),
                  ]));
                }
              }
              // Tied notations
              if (isTieStop || isTieMid) notationChildren.push(createElement('tied', { type: 'stop' }));
              if (isTieStart || (noteTypes.length > 1 && ti < noteTypes.length - 1)) {
                notationChildren.push(createElement('tied', { type: 'start' }));
              }
              if (notationChildren.length > 0) {
                noteChildren.push(createElement('notations', {}, notationChildren));
              }
            } else {
              const notationChildren: (XmlElement | string)[] = [];
              if (isTieStop || isTieMid) notationChildren.push(createElement('tied', { type: 'stop' }));
              if (isTieStart || (noteTypes.length > 1 && ti < noteTypes.length - 1)) {
                notationChildren.push(createElement('tied', { type: 'start' }));
              }
              if (notationChildren.length > 0) {
                noteChildren.push(createElement('notations', {}, notationChildren));
              }
            }

            measureChildren.push(createElement('note', {}, noteChildren));
          }

          if (!isChord) {
            cursor = evt.onset + noteDur;
          }
        }

        // Fill rest to end of measure
        const endGap = m.endTick - cursor;
        if (endGap > 0) {
          const restNotes = ticksToNoteTypes(endGap, divisions);
          for (const rn of restNotes) {
            const restChildren: (XmlElement | string)[] = [
              createElement('rest'),
              createElement('duration', {}, [String(rn.ticks)]),
              createElement('voice', {}, [String(voiceIdx + 1)]),
              createElement('type', {}, [rn.type]),
            ];
            for (let d = 0; d < rn.dots; d++) {
              restChildren.push(createElement('dot'));
            }
            measureChildren.push(createElement('note', {}, restChildren));
          }
        }

        isFirstVoice = false;
      }

      // If no events at all, fill measure with rest
      if (voiceKeys.length === 0) {
        const measureDur = m.endTick - m.startTick;
        const restNotes = ticksToNoteTypes(measureDur, divisions);
        for (const rn of restNotes) {
          measureChildren.push(createElement('note', {}, [
            createElement('rest'),
            createElement('duration', {}, [String(rn.ticks)]),
            createElement('voice', {}, ['1']),
            createElement('type', {}, [rn.type]),
          ]));
        }
      }

      measureElements.push(createElement('measure', { number: String(mi + 1) }, measureChildren));
    }

    partElements.push(createElement('part', { id: part.id }, measureElements));
  }

  // --- Build root ---
  const rootChildren: (XmlElement | string)[] = [];

  // Identification
  if (score.metadata.title) {
    rootChildren.push(createElement('work', {}, [
      createElement('work-title', {}, [score.metadata.title]),
    ]));
  }

  rootChildren.push(createElement('identification', {}, [
    ...(score.metadata.composer
      ? [createElement('creator', { type: 'composer' }, [score.metadata.composer])]
      : []),
    createElement('encoding', {}, [
      createElement('software', {}, [software]),
    ]),
  ]));

  rootChildren.push(createElement('part-list', {}, partListChildren));
  rootChildren.push(...partElements);

  const root = createElement('score-partwise', { version: '4.0' }, rootChildren);
  return serializeXml(root, { declaration: true, indent });
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

interface MeasureLayout {
  startTick: number;
  endTick: number;
  timeSig: { numerator: number; denominator: number };
}

function computeMeasureLayout(score: Score): MeasureLayout[] {
  // Find total duration
  let maxTick = 0;
  for (const part of score.parts) {
    for (const evt of part.events) {
      const end = evt.onset + evt.duration;
      if (end > maxTick) maxTick = end;
    }
  }
  if (maxTick === 0) maxTick = score.settings.ticksPerQuarter * 4; // Default 1 measure of 4/4

  const measures: MeasureLayout[] = [];
  let tick = 0;
  let tsIdx = 0;

  while (tick < maxTick) {
    // Find current time signature
    while (tsIdx + 1 < score.timeSignatures.length &&
           (score.timeSignatures[tsIdx + 1]?.atTick ?? Infinity) <= tick) {
      tsIdx++;
    }
    const ts = score.timeSignatures[tsIdx] ?? { numerator: 4, denominator: 4, atTick: 0 };
    const measureTicks = score.settings.ticksPerQuarter * 4 * ts.numerator / ts.denominator;
    const endTick = Math.min(tick + measureTicks, maxTick);

    measures.push({
      startTick: tick,
      endTick: endTick,
      timeSig: { numerator: ts.numerator, denominator: ts.denominator },
    });

    tick = endTick;
    if (endTick - measures[measures.length - 1]!.startTick < 1) break; // Safety
  }

  return measures;
}

interface PartEvent {
  onset: number;
  duration: number;
  velocity: number;
  voice: number;
  pitch: { midi: number };
  articulation?: Articulation;
}

function getPartEventsInMeasure(part: Part, startTick: number, endTick: number, _divisions: number): PartEvent[] {
  const events: PartEvent[] = [];
  for (const evt of part.events) {
    if (evt.onset >= startTick && evt.onset < endTick) {
      events.push({
        onset: evt.onset,
        duration: evt.duration,
        velocity: evt.velocity,
        voice: evt.voice,
        pitch: { midi: evt.pitch.midi },
        articulation: evt.articulation,
      });
    }
  }
  return events;
}

function groupByVoice(events: PartEvent[]): Map<number, PartEvent[]> {
  const map = new Map<number, PartEvent[]>();
  for (const evt of events) {
    let arr = map.get(evt.voice);
    if (!arr) {
      arr = [];
      map.set(evt.voice, arr);
    }
    arr.push(evt);
  }
  return map;
}

interface NoteTypeResult {
  type: string;
  dots: number;
  ticks: number;
}

/**
 * Convert a tick duration to MusicXML note type(s).
 * Uses greedy decomposition if no single dotted type matches.
 */
function ticksToNoteTypes(ticks: number, divisions: number): NoteTypeResult[] {
  // Try exact match with dots
  for (const [typeName, quarters] of NOTE_TYPE_QUARTERS) {
    const baseTicks = Math.round(quarters * divisions);
    if (baseTicks === ticks) return [{ type: typeName, dots: 0, ticks }];
    const dotted1 = Math.round(baseTicks * 1.5);
    if (dotted1 === ticks) return [{ type: typeName, dots: 1, ticks }];
    const dotted2 = Math.round(baseTicks * 1.75);
    if (dotted2 === ticks) return [{ type: typeName, dots: 2, ticks }];
  }

  // Greedy decomposition
  const results: NoteTypeResult[] = [];
  let remaining = ticks;
  for (const [typeName, quarters] of NOTE_TYPE_QUARTERS) {
    if (remaining <= 0) break;
    // Try dotted versions first
    const dotted1 = Math.round(quarters * divisions * 1.5);
    if (dotted1 <= remaining && dotted1 > 0) {
      results.push({ type: typeName, dots: 1, ticks: dotted1 });
      remaining -= dotted1;
      continue;
    }
    const baseTicks = Math.round(quarters * divisions);
    while (baseTicks <= remaining && baseTicks > 0) {
      results.push({ type: typeName, dots: 0, ticks: baseTicks });
      remaining -= baseTicks;
    }
  }

  // If still remaining (unusual durations), use closest type
  if (remaining > 0 && results.length === 0) {
    results.push({ type: 'quarter', dots: 0, ticks });
  }

  return results;
}

function velocityToDynamic(velocity: number): string {
  if (velocity <= 24) return 'ppp';
  if (velocity <= 40) return 'pp';
  if (velocity <= 56) return 'p';
  if (velocity <= 72) return 'mp';
  if (velocity <= 88) return 'mf';
  if (velocity <= 104) return 'f';
  if (velocity <= 120) return 'ff';
  return 'fff';
}

function articulationToTag(art: Articulation): string | undefined {
  switch (art) {
    case 'staccato': return 'staccato';
    case 'tenuto': return 'tenuto';
    case 'accent': return 'accent';
    case 'marcato': return 'strong-accent';
    default: return undefined;
  }
}

function findKeyAtTick(score: Score, tick: number): KeyCenter | undefined {
  let result: KeyCenter | undefined;
  for (const kc of score.keyCenters) {
    if (kc.atTick <= tick) result = kc;
    else break;
  }
  return result;
}

function hasKeyChange(score: Score, tick: number): boolean {
  return score.keyCenters.some(kc => kc.atTick === tick);
}

function findTempoAtTick(score: Score, tick: number): { bpm: number } | undefined {
  let result: { bpm: number } | undefined;
  for (const tc of score.tempoChanges) {
    if (tc.atTick <= tick) result = tc;
    else break;
  }
  return result;
}

function hasTempoChange(score: Score, tick: number): boolean {
  return score.tempoChanges.some(tc => tc.atTick === tick);
}

function hasTimeSigChange(score: Score, tick: number): boolean {
  return score.timeSignatures.some(ts => ts.atTick === tick && tick > 0);
}
