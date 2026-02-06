// ---------------------------------------------------------------------------
// Stratum — Scala .scl / .kbm File Support
// ---------------------------------------------------------------------------

import type { TuningSystem } from '../core/types.js';

/** A single degree in a Scala tuning definition. */
export interface SclDegree {
  /** Value in cents. */
  readonly cents: number;
  /** If parsed from a ratio, the [numerator, denominator] pair. */
  readonly ratio?: readonly [number, number];
}

/** Parsed .scl file data. */
export interface SclData {
  /** Description line from the .scl file. */
  readonly description: string;
  /** Number of notes per octave. */
  readonly noteCount: number;
  /** Degree values (cents/ratios). Length === noteCount. */
  readonly degrees: readonly SclDegree[];
}

/** Parsed .kbm (keyboard mapping) file data. */
export interface KbmData {
  /** Size of the mapping (number of entries). */
  readonly mapSize: number;
  /** First MIDI note to map. */
  readonly firstNote: number;
  /** Last MIDI note to map. */
  readonly lastNote: number;
  /** Middle note for the mapping (often 60). */
  readonly middleNote: number;
  /** Reference MIDI note (e.g. 69 for A4). */
  readonly referenceNote: number;
  /** Reference frequency in Hz (e.g. 440). */
  readonly referenceFreq: number;
  /** Octave degree (scale degree that represents the octave). */
  readonly octaveDegree: number;
  /** Key-to-degree mapping. null = unmapped key. */
  readonly mapping: readonly (number | null)[];
}

// ---- Helpers ----

function isComment(line: string): boolean {
  return line.startsWith('!');
}

function parseRatioOrCents(value: string): SclDegree {
  const trimmed = value.trim();

  // Ratio notation: contains '/' or is a bare integer
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    const num = parseInt(parts[0]!, 10);
    const den = parseInt(parts[1]!, 10);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      throw new RangeError(`Invalid ratio: ${trimmed}`);
    }
    const cents = 1200 * Math.log2(num / den);
    return Object.freeze({ cents, ratio: Object.freeze([num, den] as const) });
  }

  // If no decimal point and it's a plain integer, treat as ratio n/1
  if (!trimmed.includes('.') && /^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (!Number.isFinite(num) || num === 0) {
      throw new RangeError(`Invalid integer ratio: ${trimmed}`);
    }
    const cents = 1200 * Math.log2(num);
    return Object.freeze({ cents, ratio: Object.freeze([num, 1] as const) });
  }

  // Cents notation: contains a decimal point
  const cents = parseFloat(trimmed);
  if (!Number.isFinite(cents)) {
    throw new RangeError(`Invalid cents value: ${trimmed}`);
  }
  return Object.freeze({ cents });
}

// ---- Public API ----

/**
 * Parse a Scala .scl file.
 *
 * @param text - Contents of a .scl file.
 * @returns Frozen SclData.
 * @throws {RangeError} If the file is malformed.
 */
export function parseScl(text: string): SclData {
  const lines = text.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || isComment(trimmed)) continue;
    dataLines.push(trimmed);
  }

  if (dataLines.length < 2) {
    throw new RangeError('SCL file must contain at least a description and note count');
  }

  const description = dataLines[0]!;
  const noteCount = parseInt(dataLines[1]!, 10);

  if (!Number.isFinite(noteCount) || noteCount < 0) {
    throw new RangeError(`Invalid note count: ${dataLines[1]}`);
  }

  const degreeLines = dataLines.slice(2);
  if (degreeLines.length < noteCount) {
    throw new RangeError(
      `Expected ${noteCount} degree lines but found ${degreeLines.length}`,
    );
  }

  const degrees: SclDegree[] = [];
  for (let i = 0; i < noteCount; i++) {
    // Take only the first whitespace-delimited token (ignore trailing comments)
    const token = degreeLines[i]!.split(/\s+/)[0]!;
    degrees.push(parseRatioOrCents(token));
  }

  return Object.freeze({
    description,
    noteCount,
    degrees: Object.freeze(degrees),
  });
}

/**
 * Parse a Scala .kbm (keyboard mapping) file.
 *
 * @param text - Contents of a .kbm file.
 * @returns Frozen KbmData.
 * @throws {RangeError} If the file is malformed.
 */
export function parseKbm(text: string): KbmData {
  const lines = text.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || isComment(trimmed)) continue;
    dataLines.push(trimmed);
  }

  if (dataLines.length < 7) {
    throw new RangeError(
      `KBM file must contain at least 7 header values (found ${dataLines.length} non-comment lines)`,
    );
  }

  const mapSize = parseInt(dataLines[0]!, 10);
  const firstNote = parseInt(dataLines[1]!, 10);
  const lastNote = parseInt(dataLines[2]!, 10);
  const middleNote = parseInt(dataLines[3]!, 10);
  const referenceNote = parseInt(dataLines[4]!, 10);
  const referenceFreq = parseFloat(dataLines[5]!);
  const octaveDegree = parseInt(dataLines[6]!, 10);

  if (!Number.isFinite(referenceFreq) || referenceFreq <= 0) {
    throw new RangeError(`Reference frequency must be positive (got ${referenceFreq})`);
  }

  const mapping: (number | null)[] = [];
  for (let i = 7; i < 7 + mapSize && i < dataLines.length; i++) {
    const val = dataLines[i]!.trim();
    if (val === 'x') {
      mapping.push(null);
    } else {
      const deg = parseInt(val, 10);
      mapping.push(Number.isFinite(deg) ? deg : null);
    }
  }

  return Object.freeze({
    mapSize,
    firstNote,
    lastNote,
    middleNote,
    referenceNote,
    referenceFreq,
    octaveDegree,
    mapping: Object.freeze(mapping),
  });
}

/**
 * Create a TuningSystem from a Scala tuning definition and optional keyboard mapping.
 *
 * @param scl - Parsed .scl data.
 * @param kbm - Optional parsed .kbm data. If omitted, defaults to MIDI 69 = 440 Hz.
 * @returns A TuningSystem that can compute frequencies for any step/octave.
 */
export function tuningFromScl(scl: SclData, kbm?: KbmData): TuningSystem {
  // Build cent values: [0, ...degrees]
  const centValues = [0, ...scl.degrees.map(d => d.cents)];
  const stepsPerOctave = scl.noteCount;
  const octaveCents = centValues[stepsPerOctave] ?? 1200;

  const refNote = kbm?.referenceNote ?? 69;
  const refFreq = kbm?.referenceFreq ?? 440;

  return {
    name: scl.description,
    stepsPerOctave,
    frequencyAt(step: number, octave: number, refHz?: number): number {
      const hz = refHz ?? refFreq;
      // Convert step + octave to a total "note number" offset from reference
      const noteNumber = octave * stepsPerOctave + step;
      const refOctave = Math.floor(refNote / stepsPerOctave);
      const refStep = refNote % stepsPerOctave;
      const refNoteNumber = refOctave * stepsPerOctave + refStep;

      const diff = noteNumber - refNoteNumber;
      const fullOctaves = Math.floor(diff / stepsPerOctave);
      let remainder = diff % stepsPerOctave;
      if (remainder < 0) remainder += stepsPerOctave;

      const adjustedOctaves = diff < 0 && remainder > 0 ? fullOctaves - 1 : fullOctaves;
      const centOffset = adjustedOctaves * octaveCents + (centValues[remainder] ?? 0);

      return hz * Math.pow(2, centOffset / 1200);
    },
  };
}

/**
 * Serialize SclData back to .scl format.
 *
 * @param scl - The tuning data to serialize.
 * @returns String in .scl format.
 */
export function sclToString(scl: SclData): string {
  const lines: string[] = [];
  lines.push(`! ${scl.description}.scl`);
  lines.push('!');
  lines.push(scl.description);
  lines.push(String(scl.noteCount));

  for (const deg of scl.degrees) {
    if (deg.ratio) {
      lines.push(`${deg.ratio[0]}/${deg.ratio[1]}`);
    } else {
      lines.push(deg.cents.toFixed(6));
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Serialize KbmData back to .kbm format.
 *
 * @param kbm - The keyboard mapping data to serialize.
 * @returns String in .kbm format.
 */
export function kbmToString(kbm: KbmData): string {
  const lines: string[] = [];
  lines.push('! Keyboard mapping');
  lines.push(String(kbm.mapSize));
  lines.push(String(kbm.firstNote));
  lines.push(String(kbm.lastNote));
  lines.push(String(kbm.middleNote));
  lines.push(String(kbm.referenceNote));
  lines.push(kbm.referenceFreq.toFixed(6));
  lines.push(String(kbm.octaveDegree));

  for (const entry of kbm.mapping) {
    lines.push(entry === null ? 'x' : String(entry));
  }

  return lines.join('\n') + '\n';
}
