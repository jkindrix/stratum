// ---------------------------------------------------------------------------
// Stratum — Voice Separation (Streaming Greedy Assignment)
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

/** Options for voice separation. */
export interface VoiceSeparationOptions {
  /** Maximum number of voices (default 4). */
  readonly maxVoices?: number;
  /** Weight for pitch proximity (default 1.0). */
  readonly pitchWeight?: number;
  /** Weight for temporal proximity (default 0.8). */
  readonly temporalWeight?: number;
  /** Weight for directional continuity (default 0.5). */
  readonly directionalWeight?: number;
  /** Weight for register consistency (default 0.3). */
  readonly registerWeight?: number;
  /** Gap in ticks beyond which a voice can be reused (default 480). */
  readonly gapThreshold?: number;
}

/** A voice with its assigned events. */
export interface Voice {
  readonly voiceIndex: number;
  readonly events: readonly NoteEvent[];
}

/** Result of voice separation. */
export interface VoiceSeparationResult {
  readonly voices: readonly Voice[];
  readonly labeledEvents: readonly (NoteEvent & { readonly assignedVoice: number })[];
}

// ---------------------------------------------------------------------------
// Internal state per voice during streaming assignment
// ---------------------------------------------------------------------------

interface VoiceState {
  index: number;
  events: NoteEvent[];
  lastMidi: number;
  lastEnd: number;       // tick when last note ends
  lastOnset: number;     // onset of last assigned note
  prevDirection: number; // +1 ascending, -1 descending, 0 initial
  pitchSum: number;
  pitchCount: number;
}

// ---------------------------------------------------------------------------
// Cost function
// ---------------------------------------------------------------------------

function assignmentCost(
  event: NoteEvent,
  voice: VoiceState,
  pitchW: number,
  temporalW: number,
  directionalW: number,
  registerW: number,
  gapThreshold: number,
): number {
  // Pitch proximity: |midi - lastMidi| / 127
  const pitchCost = Math.abs(event.pitch.midi - voice.lastMidi) / 127;

  // Temporal continuity: prefer voices that ended recently.
  // A voice that just ended is more likely the continuation of a line.
  // Cost is 0 for immediate succession and rises slightly with gap,
  // but capped low so that temporal distance doesn't dominate pitch proximity.
  const gap = Math.max(0, event.onset - voice.lastEnd);
  const temporalCost = Math.min(gap / gapThreshold, 1) * 0.2;

  // Directional continuity: penalty if direction reverses
  let directionCost = 0;
  if (voice.prevDirection !== 0) {
    const currentDirection = event.pitch.midi - voice.lastMidi;
    if (currentDirection !== 0) {
      const sameDirection =
        (currentDirection > 0 && voice.prevDirection > 0) ||
        (currentDirection < 0 && voice.prevDirection < 0);
      directionCost = sameDirection ? 0 : 0.5;
    }
  }

  // Register consistency: distance from running mean pitch
  const meanPitch = voice.pitchCount > 0 ? voice.pitchSum / voice.pitchCount : voice.lastMidi;
  const registerCost = Math.abs(event.pitch.midi - meanPitch) / 127;

  return (
    pitchW * pitchCost +
    temporalW * temporalCost +
    directionalW * directionCost +
    registerW * registerCost
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Separate a stream of note events into distinct voices using a greedy
 * streaming algorithm based on auditory scene analysis principles.
 *
 * Events are sorted by onset (ties broken by pitch ascending) and each
 * event is assigned to the lowest-cost existing voice, or a new voice
 * is created when beneficial.
 *
 * @param events — Note events to separate.
 * @param options — Configuration for the separation algorithm.
 * @returns Voices with their assigned events, plus a flat list of labeled events.
 */
export function separateVoices(
  events: readonly NoteEvent[],
  options?: VoiceSeparationOptions,
): VoiceSeparationResult {
  const maxVoices = options?.maxVoices ?? 4;
  const pitchW = options?.pitchWeight ?? 1.0;
  const temporalW = options?.temporalWeight ?? 0.8;
  const directionalW = options?.directionalWeight ?? 0.5;
  const registerW = options?.registerWeight ?? 0.3;
  const gapThreshold = options?.gapThreshold ?? 480;

  if (maxVoices < 1) {
    throw new RangeError(`maxVoices must be >= 1 (got ${maxVoices})`);
  }
  if (gapThreshold <= 0) {
    throw new RangeError(`gapThreshold must be > 0 (got ${gapThreshold})`);
  }

  if (events.length === 0) {
    return Object.freeze({ voices: Object.freeze([]), labeledEvents: Object.freeze([]) });
  }

  // Sort by onset, then by pitch ascending for simultaneous events
  const sorted = [...events].sort((a, b) => a.onset - b.onset || a.pitch.midi - b.pitch.midi);

  const voiceStates: VoiceState[] = [];
  const labeledEvents: (NoteEvent & { readonly assignedVoice: number })[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;

    if (voiceStates.length === 0) {
      // Create first voice
      const vs: VoiceState = {
        index: 0,
        events: [event],
        lastMidi: event.pitch.midi,
        lastEnd: event.onset + event.duration,
        lastOnset: event.onset,
        prevDirection: 0,
        pitchSum: event.pitch.midi,
        pitchCount: 1,
      };
      voiceStates.push(vs);
      labeledEvents.push(Object.freeze({ ...event, assignedVoice: 0 }));
      continue;
    }

    // Score each existing voice, but exclude voices that are currently
    // sounding at this onset (a voice can't play two notes at once)
    let bestCost = Infinity;
    let bestVoiceIdx = -1;

    for (let v = 0; v < voiceStates.length; v++) {
      const vs = voiceStates[v]!;

      // Voice is busy if its last note hasn't ended yet
      const isBusy = vs.lastEnd > event.onset;
      if (isBusy) continue;

      const cost = assignmentCost(event, vs, pitchW, temporalW, directionalW, registerW, gapThreshold);
      if (cost < bestCost) {
        bestCost = cost;
        bestVoiceIdx = v;
      }
    }

    // If all voices are busy and we can create a new voice, do so
    if (bestVoiceIdx === -1 && voiceStates.length < maxVoices) {
      const newIndex = voiceStates.length;
      const vs: VoiceState = {
        index: newIndex,
        events: [event],
        lastMidi: event.pitch.midi,
        lastEnd: event.onset + event.duration,
        lastOnset: event.onset,
        prevDirection: 0,
        pitchSum: event.pitch.midi,
        pitchCount: 1,
      };
      voiceStates.push(vs);
      labeledEvents.push(Object.freeze({ ...event, assignedVoice: newIndex }));
      continue;
    }

    // If all voices are busy and max voices reached, assign to the
    // voice whose last note ends earliest. This is a pragmatic fallback:
    // when simultaneous notes exceed maxVoices, some must share a voice.
    if (bestVoiceIdx === -1) {
      let earliestEnd = Infinity;
      for (let v = 0; v < voiceStates.length; v++) {
        const vs = voiceStates[v]!;
        if (vs.lastEnd < earliestEnd) {
          earliestEnd = vs.lastEnd;
          bestVoiceIdx = v;
        }
      }
    }

    // Decide: assign to best available voice or create new voice
    // Create new voice when the pitch distance is large and we have room
    const shouldCreateNew =
      voiceStates.length < maxVoices &&
      bestVoiceIdx !== -1 &&
      bestCost > 0.3;

    if (shouldCreateNew) {
      const newIndex = voiceStates.length;
      const vs: VoiceState = {
        index: newIndex,
        events: [event],
        lastMidi: event.pitch.midi,
        lastEnd: event.onset + event.duration,
        lastOnset: event.onset,
        prevDirection: 0,
        pitchSum: event.pitch.midi,
        pitchCount: 1,
      };
      voiceStates.push(vs);
      labeledEvents.push(Object.freeze({ ...event, assignedVoice: newIndex }));
    } else {
      // Assign to best voice
      const vs = voiceStates[bestVoiceIdx]!;
      const direction = event.pitch.midi - vs.lastMidi;
      vs.events.push(event);
      vs.prevDirection = direction > 0 ? 1 : direction < 0 ? -1 : vs.prevDirection;
      vs.lastMidi = event.pitch.midi;
      vs.lastEnd = Math.max(vs.lastEnd, event.onset + event.duration);
      vs.lastOnset = event.onset;
      vs.pitchSum += event.pitch.midi;
      vs.pitchCount += 1;
      labeledEvents.push(Object.freeze({ ...event, assignedVoice: bestVoiceIdx }));
    }
  }

  // Build frozen result
  const voices: Voice[] = voiceStates.map((vs) =>
    Object.freeze({
      voiceIndex: vs.index,
      events: Object.freeze([...vs.events]),
    }),
  );

  return Object.freeze({
    voices: Object.freeze(voices),
    labeledEvents: Object.freeze(labeledEvents),
  });
}
