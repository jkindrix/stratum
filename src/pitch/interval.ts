import { normalizePc } from './pitch-class.js';

/**
 * Directed interval from one pitch class to another (0-11, ascending).
 * @param from - Starting pitch class.
 * @param to - Target pitch class.
 * @returns Ascending interval in semitones (0-11).
 */
export function directedInterval(from: number, to: number): number {
  return (normalizePc(to) - normalizePc(from) + 12) % 12;
}

/**
 * Interval class: shortest distance on the chromatic circle (0-6).
 * @param a - First pitch class.
 * @param b - Second pitch class.
 * @returns Interval class (0-6).
 */
export function intervalClass(a: number, b: number): number {
  const diff = (normalizePc(b) - normalizePc(a) + 12) % 12;
  return diff <= 6 ? diff : 12 - diff;
}

const IC_NAMES: readonly string[] = [
  'unison',
  'semitone',
  'whole tone',
  'minor third',
  'major third',
  'perfect fourth/fifth',
  'tritone',
];

/**
 * Human-readable name for an interval class (0-6).
 * @param ic - Interval class (0-6).
 * @returns Name string (e.g. 'semitone', 'perfect fourth/fifth', 'tritone').
 */
export function intervalClassName(ic: number): string {
  return IC_NAMES[ic] ?? 'unknown';
}

/**
 * Semitone distance between two MIDI note numbers (signed).
 * @param from - Starting MIDI note number.
 * @param to - Target MIDI note number.
 * @returns Signed distance in semitones.
 */
export function semitoneDist(from: number, to: number): number {
  return to - from;
}
