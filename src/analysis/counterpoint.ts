// ---------------------------------------------------------------------------
// Stratum — Counterpoint Analysis (Species Counterpoint Rule Checking)
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Motion type between two voice pairs. */
export type MotionType = 'parallel' | 'similar' | 'contrary' | 'oblique';

/** Classification of motion at a specific beat. */
export interface MotionClassification {
  readonly tick: number;
  readonly type: MotionType;
  readonly interval: number;
}

/** Types of counterpoint violations. */
export type ViolationType =
  | 'parallel-fifths'
  | 'parallel-octaves'
  | 'direct-fifths'
  | 'direct-octaves'
  | 'dissonant-interval'
  | 'voice-crossing'
  | 'improper-beginning'
  | 'improper-ending'
  | 'large-leap'
  | 'improper-passing-tone'
  | 'improper-suspension';

/** Severity of a violation. */
export type ViolationSeverity = 'error' | 'warning';

/** A counterpoint rule violation. */
export interface CounterpointViolation {
  readonly type: ViolationType;
  readonly severity: ViolationSeverity;
  readonly tick: number;
  readonly description: string;
}

/** Options for counterpoint checking. */
export interface CounterpointOptions {
  /** Maximum allowed leap in semitones (default 12). */
  readonly maxLeap?: number;
  /** Whether to allow voice crossing (default false). */
  readonly allowVoiceCrossing?: boolean;
}

/** Result of counterpoint analysis. */
export interface CounterpointResult {
  readonly violations: readonly CounterpointViolation[];
  readonly motions: readonly MotionClassification[];
  readonly isValid: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Absolute interval in semitones mod 12 (0-11).
 * Returns the simple interval (within one octave).
 */
function simpleInterval(midi1: number, midi2: number): number {
  return Math.abs(midi1 - midi2) % 12;
}

/**
 * Consonance check using simple interval (mod 12).
 * Consonant intervals: unison (0), minor 3rd (3), major 3rd (4),
 * perfect 4th (5), perfect 5th (7), minor 6th (8), major 6th (9).
 * Octave maps to 0 via mod 12.
 */
function isConsonant(midi1: number, midi2: number): boolean {
  const si = simpleInterval(midi1, midi2);
  return si === 0 || si === 3 || si === 4 || si === 5 || si === 7 || si === 8 || si === 9;
}

/**
 * Perfect consonance check: unison (0) or perfect fifth (7).
 * Octave maps to 0 via mod 12.
 */
function isPerfectConsonance(midi1: number, midi2: number): boolean {
  const si = simpleInterval(midi1, midi2);
  return si === 0 || si === 7;
}

/** Classify the motion between two successive intervals. */
function classifyMotion(
  v1prev: number,
  v1curr: number,
  v2prev: number,
  v2curr: number,
): MotionType {
  const d1 = v1curr - v1prev;
  const d2 = v2curr - v2prev;

  if (d1 === 0 || d2 === 0) return 'oblique';
  if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) return 'contrary';
  if (d1 === d2) return 'parallel';
  return 'similar';
}

/** Whether a melodic interval is stepwise (1 or 2 semitones). */
function isStep(from: number, to: number): boolean {
  const d = Math.abs(to - from);
  return d === 1 || d === 2;
}

/** Sort events by onset, then build an onset-aligned pair list. */
function alignVoices(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
): { v1: NoteEvent; v2: NoteEvent }[] {
  const sorted1 = [...voice1].sort((a, b) => a.onset - b.onset);
  const sorted2 = [...voice2].sort((a, b) => a.onset - b.onset);

  const pairs: { v1: NoteEvent; v2: NoteEvent }[] = [];
  let j = 0;

  for (let i = 0; i < sorted1.length; i++) {
    const ev1 = sorted1[i]!;
    // Find the closest onset in voice2
    while (j < sorted2.length - 1 && sorted2[j + 1]!.onset <= ev1.onset) {
      j++;
    }
    if (j < sorted2.length) {
      pairs.push({ v1: ev1, v2: sorted2[j]! });
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify the contrapuntal motion between two voices at each beat.
 *
 * @param voice1 — Events for the first voice (typically cantus firmus).
 * @param voice2 — Events for the second voice (counterpoint).
 * @returns Array of motion classifications at each successive beat pair.
 */
export function contrapuntalMotion(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
): readonly MotionClassification[] {
  if (voice1.length === 0 || voice2.length === 0) return Object.freeze([]);

  const pairs = alignVoices(voice1, voice2);
  if (pairs.length < 2) return Object.freeze([]);

  const motions: MotionClassification[] = [];

  for (let i = 1; i < pairs.length; i++) {
    const prev = pairs[i - 1]!;
    const curr = pairs[i]!;

    const type = classifyMotion(
      prev.v1.pitch.midi,
      curr.v1.pitch.midi,
      prev.v2.pitch.midi,
      curr.v2.pitch.midi,
    );

    const interval = simpleInterval(curr.v1.pitch.midi, curr.v2.pitch.midi);

    motions.push(Object.freeze({ tick: curr.v1.onset, type, interval }));
  }

  return Object.freeze(motions);
}

/**
 * Check two voices against first-species counterpoint rules (note-against-note).
 *
 * Rules checked:
 * - All vertical intervals must be consonant
 * - No parallel perfect 5ths or octaves/unisons
 * - No direct/hidden 5ths or octaves (similar motion into perfect consonance)
 * - No voice crossing (unless allowed)
 * - Begin on perfect consonance
 * - End on perfect consonance (unison or octave)
 * - No leaps larger than maxLeap
 *
 * @param voice1 — Cantus firmus events, sorted by onset.
 * @param voice2 — Counterpoint events, sorted by onset.
 * @param options — Configuration options.
 * @returns Analysis result with violations, motions, and validity.
 */
export function checkFirstSpecies(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
  options?: CounterpointOptions,
): CounterpointResult {
  if (voice1.length === 0 || voice2.length === 0) {
    return Object.freeze({
      violations: Object.freeze([]),
      motions: Object.freeze([]),
      isValid: true,
    });
  }

  const maxLeap = options?.maxLeap ?? 12;
  const allowCrossing = options?.allowVoiceCrossing ?? false;

  const pairs = alignVoices(voice1, voice2);
  const violations: CounterpointViolation[] = [];
  const motions: MotionClassification[] = [];

  // Check first interval: must be perfect consonance
  if (pairs.length > 0) {
    const first = pairs[0]!;
    if (!isPerfectConsonance(first.v1.pitch.midi, first.v2.pitch.midi)) {
      violations.push(
        Object.freeze({
          type: 'improper-beginning' as const,
          severity: 'error' as const,
          tick: first.v1.onset,
          description: `First interval must be a perfect consonance (unison, 5th, or octave); got interval ${simpleInterval(first.v1.pitch.midi, first.v2.pitch.midi)} semitones`,
        }),
      );
    }
  }

  // Check last interval: must be perfect consonance (prefer unison/octave)
  if (pairs.length > 0) {
    const last = pairs[pairs.length - 1]!;
    if (!isPerfectConsonance(last.v1.pitch.midi, last.v2.pitch.midi)) {
      violations.push(
        Object.freeze({
          type: 'improper-ending' as const,
          severity: 'error' as const,
          tick: last.v1.onset,
          description: `Last interval must be a perfect consonance; got interval ${simpleInterval(last.v1.pitch.midi, last.v2.pitch.midi)} semitones`,
        }),
      );
    }
  }

  for (let i = 0; i < pairs.length; i++) {
    const curr = pairs[i]!;

    // Check consonance
    if (!isConsonant(curr.v1.pitch.midi, curr.v2.pitch.midi)) {
      violations.push(
        Object.freeze({
          type: 'dissonant-interval' as const,
          severity: 'error' as const,
          tick: curr.v1.onset,
          description: `Dissonant vertical interval: ${simpleInterval(curr.v1.pitch.midi, curr.v2.pitch.midi)} semitones`,
        }),
      );
    }

    // Check voice crossing: determine which voice is upper from the first pair.
    // If voices start in unison, skip crossing detection (no established register).
    if (!allowCrossing && pairs.length > 0) {
      const firstPair = pairs[0]!;
      const firstV1 = firstPair.v1.pitch.midi;
      const firstV2 = firstPair.v2.pitch.midi;

      if (firstV1 !== firstV2) {
        const upperIsV1 = firstV1 > firstV2;
        if (upperIsV1 && curr.v1.pitch.midi < curr.v2.pitch.midi) {
          violations.push(
            Object.freeze({
              type: 'voice-crossing' as const,
              severity: 'error' as const,
              tick: curr.v1.onset,
              description: 'Voice crossing detected: upper voice moved below lower voice',
            }),
          );
        } else if (!upperIsV1 && curr.v2.pitch.midi < curr.v1.pitch.midi) {
          violations.push(
            Object.freeze({
              type: 'voice-crossing' as const,
              severity: 'error' as const,
              tick: curr.v1.onset,
              description: 'Voice crossing detected: upper voice moved below lower voice',
            }),
          );
        }
      }
    }

    // Check motion-based rules (from second pair onward)
    if (i > 0) {
      const prev = pairs[i - 1]!;

      const motionType = classifyMotion(
        prev.v1.pitch.midi,
        curr.v1.pitch.midi,
        prev.v2.pitch.midi,
        curr.v2.pitch.midi,
      );

      const interval = simpleInterval(curr.v1.pitch.midi, curr.v2.pitch.midi);
      motions.push(Object.freeze({ tick: curr.v1.onset, type: motionType, interval }));

      // Parallel 5ths
      if (
        motionType === 'parallel' &&
        isPerfectConsonance(prev.v1.pitch.midi, prev.v2.pitch.midi) &&
        isPerfectConsonance(curr.v1.pitch.midi, curr.v2.pitch.midi)
      ) {
        const prevSi = simpleInterval(prev.v1.pitch.midi, prev.v2.pitch.midi);
        const currSi = simpleInterval(curr.v1.pitch.midi, curr.v2.pitch.midi);

        if (prevSi === 7 && currSi === 7) {
          violations.push(
            Object.freeze({
              type: 'parallel-fifths' as const,
              severity: 'error' as const,
              tick: curr.v1.onset,
              description: 'Parallel perfect 5ths',
            }),
          );
        }
        if (prevSi === 0 && currSi === 0) {
          violations.push(
            Object.freeze({
              type: 'parallel-octaves' as const,
              severity: 'error' as const,
              tick: curr.v1.onset,
              description: 'Parallel octaves/unisons',
            }),
          );
        }
      }

      // Direct/hidden 5ths and octaves (similar motion into perfect consonance)
      if (motionType === 'similar' && isPerfectConsonance(curr.v1.pitch.midi, curr.v2.pitch.midi)) {
        const currSi = simpleInterval(curr.v1.pitch.midi, curr.v2.pitch.midi);
        if (currSi === 7) {
          violations.push(
            Object.freeze({
              type: 'direct-fifths' as const,
              severity: 'warning' as const,
              tick: curr.v1.onset,
              description: 'Direct/hidden 5ths: similar motion into a perfect 5th',
            }),
          );
        }
        if (currSi === 0) {
          violations.push(
            Object.freeze({
              type: 'direct-octaves' as const,
              severity: 'warning' as const,
              tick: curr.v1.onset,
              description: 'Direct/hidden octaves: similar motion into a unison/octave',
            }),
          );
        }
      }

      // Large leaps
      const leap1 = Math.abs(curr.v1.pitch.midi - prev.v1.pitch.midi);
      const leap2 = Math.abs(curr.v2.pitch.midi - prev.v2.pitch.midi);

      if (leap1 > maxLeap) {
        violations.push(
          Object.freeze({
            type: 'large-leap' as const,
            severity: 'warning' as const,
            tick: curr.v1.onset,
            description: `Voice 1 leap of ${leap1} semitones exceeds limit of ${maxLeap}`,
          }),
        );
      }
      if (leap2 > maxLeap) {
        violations.push(
          Object.freeze({
            type: 'large-leap' as const,
            severity: 'warning' as const,
            tick: curr.v1.onset,
            description: `Voice 2 leap of ${leap2} semitones exceeds limit of ${maxLeap}`,
          }),
        );
      }
    }
  }

  const frozenViolations = Object.freeze(violations.map((v) => Object.freeze(v)));
  const frozenMotions = Object.freeze(motions);

  return Object.freeze({
    violations: frozenViolations,
    motions: frozenMotions,
    isValid: violations.filter((v) => v.severity === 'error').length === 0,
  });
}

/**
 * Check two voices against second-species counterpoint rules.
 *
 * Second species adds passing tone rules to first species:
 * off-beat notes must be consonant or valid passing tones
 * (approached and left by step in the same direction).
 *
 * @param voice1 — Cantus firmus events (longer notes).
 * @param voice2 — Counterpoint events (may have 2:1 ratio).
 * @param options — Configuration options.
 * @returns Analysis result with violations, motions, and validity.
 */
export function checkSecondSpecies(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
  options?: CounterpointOptions,
): CounterpointResult {
  // Start with first-species check
  const firstSpecies = checkFirstSpecies(voice1, voice2, options);
  const violations: CounterpointViolation[] = [...firstSpecies.violations];

  const sorted2 = [...voice2].sort((a, b) => a.onset - b.onset);
  const sorted1 = [...voice1].sort((a, b) => a.onset - b.onset);

  // Build onset set of voice1 for identifying on-beat vs off-beat
  const v1Onsets = new Set(sorted1.map((e) => e.onset));

  // Check off-beat notes in voice2
  for (let i = 0; i < sorted2.length; i++) {
    const curr = sorted2[i]!;

    // Skip on-beat notes (already checked by first species)
    if (v1Onsets.has(curr.onset)) continue;

    // Find the voice1 note sounding at this tick
    let v1Note: NoteEvent | undefined;
    for (let k = sorted1.length - 1; k >= 0; k--) {
      const e1 = sorted1[k]!;
      if (e1.onset <= curr.onset && e1.onset + e1.duration > curr.onset) {
        v1Note = e1;
        break;
      }
    }

    if (!v1Note) continue;

    // If the interval is consonant, it's fine
    if (isConsonant(curr.pitch.midi, v1Note.pitch.midi)) continue;

    // If dissonant, must be a valid passing tone
    const prev = i > 0 ? sorted2[i - 1] : undefined;
    const next = i < sorted2.length - 1 ? sorted2[i + 1] : undefined;

    const isValidPassing =
      prev !== undefined &&
      next !== undefined &&
      isStep(prev.pitch.midi, curr.pitch.midi) &&
      isStep(curr.pitch.midi, next.pitch.midi) &&
      // Same direction
      Math.sign(curr.pitch.midi - prev.pitch.midi) === Math.sign(next.pitch.midi - curr.pitch.midi);

    if (!isValidPassing) {
      violations.push(
        Object.freeze({
          type: 'improper-passing-tone' as const,
          severity: 'error' as const,
          tick: curr.onset,
          description: `Off-beat dissonance is not a valid passing tone at tick ${curr.onset}`,
        }),
      );
    }
  }

  const frozenViolations = Object.freeze(violations.map((v) => Object.freeze(v)));

  return Object.freeze({
    violations: frozenViolations,
    motions: firstSpecies.motions,
    isValid: frozenViolations.filter((v) => v.severity === 'error').length === 0,
  });
}

/**
 * Check two voices against fourth-species counterpoint rules.
 *
 * Fourth species adds suspension rules: tied-over notes creating
 * dissonance on strong beats must resolve stepwise downward.
 *
 * @param voice1 — Cantus firmus events.
 * @param voice2 — Counterpoint events (with suspensions).
 * @param options — Configuration options.
 * @returns Analysis result with violations, motions, and validity.
 */
export function checkFourthSpecies(
  voice1: readonly NoteEvent[],
  voice2: readonly NoteEvent[],
  options?: CounterpointOptions,
): CounterpointResult {
  // Start with first-species check
  const firstSpecies = checkFirstSpecies(voice1, voice2, options);
  const violations: CounterpointViolation[] = [];

  // Keep non-dissonance violations from first species
  for (const v of firstSpecies.violations) {
    if (v.type !== 'dissonant-interval') {
      violations.push(v);
    }
  }

  const sorted2 = [...voice2].sort((a, b) => a.onset - b.onset);
  const sorted1 = [...voice1].sort((a, b) => a.onset - b.onset);

  // Check suspensions: a dissonance on a strong beat that resolves stepwise down
  const pairs = alignVoices(voice1, voice2);

  for (let i = 0; i < pairs.length; i++) {
    const curr = pairs[i]!;

    // Only check dissonant intervals
    if (isConsonant(curr.v1.pitch.midi, curr.v2.pitch.midi)) continue;

    // Check if this is a tied-over note (same pitch as previous in voice2)
    const prevV2 = i > 0 ? pairs[i - 1] : undefined;
    const isSuspension =
      prevV2 !== undefined && prevV2.v2.pitch.midi === curr.v2.pitch.midi;

    if (!isSuspension) {
      // Dissonance that's not a suspension
      violations.push(
        Object.freeze({
          type: 'dissonant-interval' as const,
          severity: 'error' as const,
          tick: curr.v1.onset,
          description: `Dissonant interval that is not a suspension at tick ${curr.v1.onset}`,
        }),
      );
      continue;
    }

    // Check resolution: next note in voice2 must be stepwise down
    const nextV2Idx = sorted2.findIndex(
      (e) => e.onset > curr.v2.onset && e.onset >= curr.v2.onset + curr.v2.duration,
    );

    if (nextV2Idx === -1) {
      violations.push(
        Object.freeze({
          type: 'improper-suspension' as const,
          severity: 'error' as const,
          tick: curr.v1.onset,
          description: `Suspension at tick ${curr.v1.onset} has no resolution`,
        }),
      );
      continue;
    }

    const nextV2 = sorted2[nextV2Idx]!;
    const resolution = curr.v2.pitch.midi - nextV2.pitch.midi;

    // Must resolve stepwise downward (1 or 2 semitones down)
    if (resolution !== 1 && resolution !== 2) {
      violations.push(
        Object.freeze({
          type: 'improper-suspension' as const,
          severity: 'error' as const,
          tick: curr.v1.onset,
          description: `Suspension at tick ${curr.v1.onset} does not resolve stepwise downward (resolved by ${resolution} semitones)`,
        }),
      );
    }
  }

  const frozenViolations = Object.freeze(violations.map((v) => Object.freeze(v)));

  return Object.freeze({
    violations: frozenViolations,
    motions: firstSpecies.motions,
    isValid: frozenViolations.filter((v) => v.severity === 'error').length === 0,
  });
}
