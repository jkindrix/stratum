// ---------------------------------------------------------------------------
// Stratum — Tuning Systems
// ---------------------------------------------------------------------------

import type { TuningSystem } from '../core/types.js';

/**
 * Create an equal temperament tuning system with N divisions per octave.
 * @param divisions — Number of equal divisions of the octave (e.g., 12 for standard).
 * @param name — Optional name override.
 */
export function equalTemperament(divisions: number, name?: string): TuningSystem {
  if (!Number.isInteger(divisions) || divisions < 1) {
    throw new RangeError(`divisions must be a positive integer (got ${divisions})`);
  }
  return {
    name: name ?? `${divisions}-TET`,
    stepsPerOctave: divisions,
    frequencyAt(step: number, octave: number, refHz = 440): number {
      // In N-TET, step 0 of octave 4 = A4 equivalent
      // Adjust: in 12-TET, A4 is step 9 of octave 4 (MIDI 69)
      // For generalized N-TET: step/divisions gives the fraction of an octave
      const totalSteps = octave * divisions + step;
      const refStep = 4 * divisions + Math.round(divisions * 9 / 12); // A4 equivalent
      return refHz * Math.pow(2, (totalSteps - refStep) / divisions);
    },
  };
}

// ---- Built-in Tuning Presets ----

/** Standard 12-tone equal temperament */
export const TET_12: TuningSystem = equalTemperament(12, '12-TET');

/** 19-tone equal temperament */
export const TET_19: TuningSystem = equalTemperament(19, '19-TET');

/** 24-tone equal temperament (quarter-tone) */
export const TET_24: TuningSystem = equalTemperament(24, '24-TET');

/** 31-tone equal temperament */
export const TET_31: TuningSystem = equalTemperament(31, '31-TET');

/** 53-tone equal temperament */
export const TET_53: TuningSystem = equalTemperament(53, '53-TET');

/**
 * Pythagorean tuning: based on stacking perfect fifths (ratio 3:2).
 * 12 notes per octave, unequal spacing.
 */
export const PYTHAGOREAN: TuningSystem = (() => {
  // Generate 12 notes by stacking fifths: F C G D A E B F# C# G# D# A#
  // Ratios relative to C (step 0)
  const ratios: number[] = new Array(12);
  // Start from F (stack of fifths: F-C-G-D-A-E-B-F#-C#-G#-D#-A#)
  // Equivalently, build from C using powers of 3/2
  // C=1, G=3/2, D=9/8, A=27/16, E=81/64, B=243/128
  // F=4/3, Bb=16/9, Eb=32/27, Ab=128/81, Db=256/243, Gb=1024/729
  const fifthRatios: [number, number][] = [
    [0, 1],            // C = 1/1
    [1, 256 / 243],    // C# (Db) = 256/243
    [2, 9 / 8],        // D = 9/8
    [3, 32 / 27],      // D# (Eb) = 32/27
    [4, 81 / 64],      // E = 81/64
    [5, 4 / 3],        // F = 4/3
    [6, 1024 / 729],   // F# (Gb) = 1024/729
    [7, 3 / 2],        // G = 3/2
    [8, 128 / 81],     // G# (Ab) = 128/81
    [9, 27 / 16],      // A = 27/16
    [10, 16 / 9],      // A# (Bb) = 16/9
    [11, 243 / 128],   // B = 243/128
  ];
  for (const [step, ratio] of fifthRatios) {
    ratios[step] = ratio;
  }

  return {
    name: 'Pythagorean',
    stepsPerOctave: 12,
    frequencyAt(step: number, octave: number, refHz = 440): number {
      const pc = ((step % 12) + 12) % 12;
      const oct = octave + Math.floor(step / 12);
      // A4 = refHz, A is step 9
      const ratioFromA = ratios[pc]! / ratios[9]!;
      return refHz * ratioFromA * Math.pow(2, oct - 4);
    },
  };
})();

/**
 * 5-limit just intonation: ratios using only factors of 2, 3, and 5.
 * 12 notes per octave, pure intervals for major scale harmony.
 */
export const JUST_5_LIMIT: TuningSystem = (() => {
  // Standard 5-limit JI ratios relative to C
  const ratios: number[] = [
    1,        // C  = 1/1
    16 / 15,  // C# = 16/15
    9 / 8,    // D  = 9/8
    6 / 5,    // Eb = 6/5
    5 / 4,    // E  = 5/4
    4 / 3,    // F  = 4/3
    45 / 32,  // F# = 45/32
    3 / 2,    // G  = 3/2
    8 / 5,    // Ab = 8/5
    5 / 3,    // A  = 5/3
    9 / 5,    // Bb = 9/5
    15 / 8,   // B  = 15/8
  ];

  return {
    name: '5-limit Just Intonation',
    stepsPerOctave: 12,
    frequencyAt(step: number, octave: number, refHz = 440): number {
      const pc = ((step % 12) + 12) % 12;
      const oct = octave + Math.floor(step / 12);
      const ratioFromA = ratios[pc]! / ratios[9]!;
      return refHz * ratioFromA * Math.pow(2, oct - 4);
    },
  };
})();

/**
 * 7-limit just intonation: extends 5-limit with septimal intervals (factor of 7).
 * Uses 7/4 for the minor seventh and 7/6 for the septimal minor third.
 */
export const JUST_7_LIMIT: TuningSystem = (() => {
  const ratios: number[] = [
    1,        // C  = 1/1
    16 / 15,  // C# = 16/15
    9 / 8,    // D  = 9/8
    7 / 6,    // Eb = 7/6 (septimal minor third)
    5 / 4,    // E  = 5/4
    4 / 3,    // F  = 4/3
    7 / 5,    // F# = 7/5 (septimal tritone)
    3 / 2,    // G  = 3/2
    8 / 5,    // Ab = 8/5
    5 / 3,    // A  = 5/3
    7 / 4,    // Bb = 7/4 (harmonic seventh)
    15 / 8,   // B  = 15/8
  ];

  return {
    name: '7-limit Just Intonation',
    stepsPerOctave: 12,
    frequencyAt(step: number, octave: number, refHz = 440): number {
      const pc = ((step % 12) + 12) % 12;
      const oct = octave + Math.floor(step / 12);
      const ratioFromA = ratios[pc]! / ratios[9]!;
      return refHz * ratioFromA * Math.pow(2, oct - 4);
    },
  };
})();

/**
 * Quarter-comma meantone temperament.
 * Fifths are narrowed by 1/4 syntonic comma so that major thirds are pure (5:4).
 */
export const QUARTER_COMMA_MEANTONE: TuningSystem = (() => {
  // In quarter-comma meantone, the fifth ratio is 5^(1/4) instead of 3/2
  const fifth = Math.pow(5, 0.25);

  // Build 12 notes by stacking meantone fifths from Eb
  // Eb-Bb-F-C-G-D-A-E-B-F#-C#-G#
  // Start from C (step 0), build by stacking fifths up and down
  const ratios: number[] = new Array(12).fill(0);
  ratios[0] = 1;                                    // C
  ratios[7] = fifth;                                // G = 1 fifth up
  ratios[2] = (fifth * fifth) / 2;                  // D = 2 fifths up, down 1 octave
  ratios[9] = (fifth * fifth * fifth) / 2;          // A = 3 fifths up, down 1 octave
  ratios[4] = (fifth * fifth * fifth * fifth) / 4;  // E = 4 fifths up, down 2 octaves
  ratios[11] = (Math.pow(fifth, 5)) / 4;            // B = 5 fifths up, down 2 octaves
  ratios[6] = (Math.pow(fifth, 6)) / 8;             // F# = 6 fifths up, down 3 octaves
  ratios[1] = (Math.pow(fifth, 7)) / 8;             // C# = 7 fifths up, down 3 octaves
  ratios[8] = (Math.pow(fifth, 8)) / 16;            // G# = 8 fifths up, down 4 octaves
  ratios[5] = 2 / fifth;                            // F = 1 fifth down, up 1 octave
  ratios[10] = 4 / (fifth * fifth);                 // Bb = 2 fifths down, up 2 octaves
  ratios[3] = 8 / (fifth * fifth * fifth);          // Eb = 3 fifths down, up 3 octaves

  return {
    name: 'Quarter-Comma Meantone',
    stepsPerOctave: 12,
    frequencyAt(step: number, octave: number, refHz = 440): number {
      const pc = ((step % 12) + 12) % 12;
      const oct = octave + Math.floor(step / 12);
      const ratioFromA = ratios[pc]! / ratios[9]!;
      return refHz * ratioFromA * Math.pow(2, oct - 4);
    },
  };
})();

// ---- Tuning Utility Functions ----

/**
 * Compute the deviation from 12-TET in cents for a given step in a tuning system.
 * @param tuning — The tuning system to measure.
 * @param step — The scale step (0-based).
 * @param octave — The octave (default 4).
 * @param refHz — Reference frequency for A4 (default 440).
 */
export function centsDeviation(
  tuning: TuningSystem,
  step: number,
  octave = 4,
  refHz = 440,
): number {
  const actualFreq = tuning.frequencyAt(step, octave, refHz);
  const tetFreq = TET_12.frequencyAt(step, octave, refHz);
  return 1200 * Math.log2(actualFreq / tetFreq);
}

/**
 * Get frequency from a tuning system.
 * Convenience wrapper around TuningSystem.frequencyAt.
 * @param tuning — The tuning system to use.
 * @param step — The scale step (0-based).
 * @param octave — The octave number.
 * @param refHz — Reference frequency for A4 (default 440).
 */
export function frequencyFromTuning(
  tuning: TuningSystem,
  step: number,
  octave: number,
  refHz = 440,
): number {
  return tuning.frequencyAt(step, octave, refHz);
}

/**
 * Find the nearest step and octave in a tuning system for a given frequency.
 * @param tuning — The tuning system to snap to.
 * @param frequencyHz — The frequency to find the nearest step for.
 * @param refHz — Reference frequency for A4 (default 440).
 * @returns The nearest step, octave, and actual frequency of that step.
 */
export function nearestStep(
  tuning: TuningSystem,
  frequencyHz: number,
  refHz = 440,
): { step: number; octave: number; frequency: number; centsOff: number } {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError(`frequency must be > 0 (got ${frequencyHz})`);
  }

  const n = tuning.stepsPerOctave;
  // Estimate the octave from the frequency ratio
  const octaveEstimate = Math.log2(frequencyHz / refHz) + 4;
  const octLow = Math.floor(octaveEstimate) - 1;
  const octHigh = Math.ceil(octaveEstimate) + 1;

  let bestStep = 0;
  let bestOctave = 4;
  let bestFreq = refHz;
  let bestDiff = Infinity;

  for (let oct = octLow; oct <= octHigh; oct++) {
    for (let step = 0; step < n; step++) {
      const freq = tuning.frequencyAt(step, oct, refHz);
      const diff = Math.abs(freq - frequencyHz);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestStep = step;
        bestOctave = oct;
        bestFreq = freq;
      }
    }
  }

  const centsOff = 1200 * Math.log2(frequencyHz / bestFreq);

  return { step: bestStep, octave: bestOctave, frequency: bestFreq, centsOff };
}
