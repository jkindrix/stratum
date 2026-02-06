import type {
  Score,
  NoteEvent,
  Part,
  TimeSignature,
  TempoMark,
  KeyCenter,
} from '../core/types.js';
import { pitchFromMidi } from '../core/score.js';

/** Current serialization format version. */
const FORMAT_VERSION = 1;

/** Serializable JSON representation of a Score. */
export interface ScoreJSON {
  /** Format version for forward/backward compatibility */
  version: number;
  /** Title and composer metadata */
  metadata: { title: string; composer: string };
  /** Timing and tuning settings */
  settings: {
    ticksPerQuarter: number;
    tuningHz: number;
  };
  /** Instrumental parts with their note events */
  parts: Array<{
    id: string;
    name: string;
    midiProgram: number;
    midiChannel: number;
    events: Array<{
      id: string;
      midi: number;
      onset: number;
      duration: number;
      velocity: number;
      voice: number;
      centsDeviation?: number;
      articulation?: string;
    }>;
  }>;
  /** Time signature changes throughout the score */
  timeSignatures: Array<{ numerator: number; denominator: number; atTick: number }>;
  /** Tempo changes throughout the score */
  tempoChanges: Array<{ bpm: number; atTick: number }>;
  /** Key center changes throughout the score */
  keyCenters: Array<{ tonic: number; mode: string; atTick: number }>;
}

/**
 * Serialize a Score to a plain JSON-safe object.
 * The result can be passed to `JSON.stringify()`.
 *
 * @param score - The score to serialize.
 * @returns A plain object safe for JSON serialization.
 */
export function scoreToJSON(score: Score): ScoreJSON {
  return {
    version: FORMAT_VERSION,
    metadata: { ...score.metadata },
    settings: {
      ticksPerQuarter: score.settings.ticksPerQuarter,
      tuningHz: score.settings.tuningHz,
    },
    parts: score.parts.map(p => ({
      id: p.id,
      name: p.name,
      midiProgram: p.midiProgram,
      midiChannel: p.midiChannel,
      events: p.events.map(e => ({
        id: e.id,
        midi: e.pitch.midi,
        onset: e.onset,
        duration: e.duration,
        velocity: e.velocity,
        voice: e.voice,
        ...(e.pitch.centsDeviation != null && e.pitch.centsDeviation !== 0
          ? { centsDeviation: e.pitch.centsDeviation }
          : {}),
        ...(e.articulation ? { articulation: e.articulation } : {}),
      })),
    })),
    timeSignatures: score.timeSignatures.map(ts => ({ ...ts })),
    tempoChanges: score.tempoChanges.map(tc => ({ ...tc })),
    keyCenters: score.keyCenters.map(kc => ({ ...kc })),
  };
}

/**
 * Deserialize a ScoreJSON object back to a Score.
 * Validates the input structure and throws descriptive errors for malformed data.
 *
 * @param json - A plain object (typically parsed from JSON) to deserialize.
 * @returns A fully hydrated Score with Pitch objects.
 * @throws {TypeError} If required fields are missing or have wrong types.
 * @throws {RangeError} If numeric values are out of valid range.
 */
export function scoreFromJSON(json: unknown): Score {
  if (typeof json !== 'object' || json === null) {
    throw new TypeError('scoreFromJSON: input must be a non-null object');
  }

  const obj = json as Record<string, unknown>;

  // Version check
  if (typeof obj.version !== 'number' || obj.version < 1) {
    throw new Error('scoreFromJSON: missing or invalid version field');
  }
  if (obj.version > FORMAT_VERSION) {
    throw new Error(
      `scoreFromJSON: format version ${obj.version} is newer than supported version ${FORMAT_VERSION}`,
    );
  }

  // Metadata
  const meta = validateObject(obj.metadata, 'metadata');
  const title = validateString(meta.title, 'metadata.title', '');
  const composer = validateString(meta.composer, 'metadata.composer', '');

  // Settings
  const settings = validateObject(obj.settings, 'settings');
  const ticksPerQuarter = validatePositiveInt(settings.ticksPerQuarter, 'settings.ticksPerQuarter');
  const tuningHz = validatePositiveNumber(settings.tuningHz, 'settings.tuningHz');

  // Parts
  const partsRaw = validateArray(obj.parts, 'parts');
  const parts: Part[] = partsRaw.map((pRaw: unknown, pi: number) => {
    const p = validateObject(pRaw, `parts[${pi}]`);
    const events = validateArray(p.events, `parts[${pi}].events`);

    const noteEvents: NoteEvent[] = events.map((eRaw: unknown, ei: number) => {
      const e = validateObject(eRaw, `parts[${pi}].events[${ei}]`);
      const midi = validateInt(e.midi, `parts[${pi}].events[${ei}].midi`, 0, 127);
      const pitch = pitchFromMidi(midi);
      if (typeof e.centsDeviation === 'number') {
        pitch.centsDeviation = e.centsDeviation;
      }

      return {
        id: validateString(e.id, `parts[${pi}].events[${ei}].id`),
        pitch,
        onset: validateNonNeg(e.onset, `parts[${pi}].events[${ei}].onset`),
        duration: validatePositiveNumber(e.duration, `parts[${pi}].events[${ei}].duration`),
        velocity: validateInt(e.velocity, `parts[${pi}].events[${ei}].velocity`, 0, 127),
        voice: validateNonNeg(e.voice, `parts[${pi}].events[${ei}].voice`),
        ...(typeof e.articulation === 'string' ? { articulation: e.articulation as NoteEvent['articulation'] } : {}),
      };
    });

    return {
      id: validateString(p.id, `parts[${pi}].id`),
      name: validateString(p.name, `parts[${pi}].name`),
      midiProgram: validateInt(p.midiProgram, `parts[${pi}].midiProgram`, 0, 127),
      midiChannel: validateInt(p.midiChannel, `parts[${pi}].midiChannel`, 0, 15),
      events: noteEvents,
    };
  });

  // Time signatures
  const tsRaw = validateArray(obj.timeSignatures, 'timeSignatures');
  const timeSignatures: TimeSignature[] = tsRaw.map((raw: unknown, i: number) => {
    const ts = validateObject(raw, `timeSignatures[${i}]`);
    return {
      numerator: validatePositiveInt(ts.numerator, `timeSignatures[${i}].numerator`),
      denominator: validatePositiveInt(ts.denominator, `timeSignatures[${i}].denominator`),
      atTick: validateNonNeg(ts.atTick, `timeSignatures[${i}].atTick`),
    };
  });

  // Tempo changes
  const tcRaw = validateArray(obj.tempoChanges, 'tempoChanges');
  const tempoChanges: TempoMark[] = tcRaw.map((raw: unknown, i: number) => {
    const tc = validateObject(raw, `tempoChanges[${i}]`);
    return {
      bpm: validatePositiveNumber(tc.bpm, `tempoChanges[${i}].bpm`),
      atTick: validateNonNeg(tc.atTick, `tempoChanges[${i}].atTick`),
    };
  });

  // Key centers
  const kcRaw = validateArray(obj.keyCenters ?? [], 'keyCenters');
  const keyCenters: KeyCenter[] = kcRaw.map((raw: unknown, i: number) => {
    const kc = validateObject(raw, `keyCenters[${i}]`);
    return {
      tonic: validateInt(kc.tonic, `keyCenters[${i}].tonic`, 0, 11),
      mode: validateString(kc.mode, `keyCenters[${i}].mode`),
      atTick: validateNonNeg(kc.atTick, `keyCenters[${i}].atTick`),
    };
  });

  return {
    metadata: { title, composer },
    settings: { ticksPerQuarter, tuningHz },
    parts,
    timeSignatures,
    tempoChanges,
    keyCenters,
  };
}

// ─── Validation helpers ─────────────────────────────────────────

function validateObject(val: unknown, path: string): Record<string, unknown> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new TypeError(`scoreFromJSON: ${path} must be an object`);
  }
  return val as Record<string, unknown>;
}

function validateArray(val: unknown, path: string): unknown[] {
  if (!Array.isArray(val)) {
    throw new TypeError(`scoreFromJSON: ${path} must be an array`);
  }
  return val;
}

function validateString(val: unknown, path: string, defaultVal?: string): string {
  if (typeof val === 'string') return val;
  if (defaultVal !== undefined) return defaultVal;
  throw new TypeError(`scoreFromJSON: ${path} must be a string`);
}

function validatePositiveNumber(val: unknown, path: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
    throw new RangeError(`scoreFromJSON: ${path} must be a positive finite number, got ${val}`);
  }
  return val;
}

function validatePositiveInt(val: unknown, path: string): number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
    throw new RangeError(`scoreFromJSON: ${path} must be a positive integer, got ${val}`);
  }
  return val;
}

function validateNonNeg(val: unknown, path: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    throw new RangeError(`scoreFromJSON: ${path} must be a non-negative number, got ${val}`);
  }
  return val;
}

function validateInt(val: unknown, path: string, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < min || val > max) {
    throw new RangeError(`scoreFromJSON: ${path} must be an integer ${min}-${max}, got ${val}`);
  }
  return val;
}
