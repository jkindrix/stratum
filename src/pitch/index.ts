// Re-export pitchFromMidi from core (canonical location)
export { pitchFromMidi } from '../core/score.js';

export {
  normalizePc,
  pitchFromPcOctave,
  pitchToFrequency,
  frequencyToPitch,
  pitchClassName,
  pitchClassFlatName,
  pitchName,
  parsePitchName,
} from './pitch-class.js';

export {
  directedInterval,
  intervalClass,
  intervalClassName,
  semitoneDist,
} from './interval.js';

export { PitchClassSet } from './pitch-class-set.js';

export { FORTE_CATALOG, FORTE_BY_NAME } from './forte-catalog.js';
export type { ForteEntry } from './forte-catalog.js';

export {
  voiceLeadingDistance,
  smoothestVoiceLeading,
} from './voice-leading.js';

// Scales, modes, and chords
export type { Scale, Chord } from './scales.js';
export {
  SCALE_CATALOG,
  CHORD_CATALOG,
  scaleFromPcs,
  scaleFromIntervals,
  modeRotation,
  chordFromPcs,
  chordFromName,
  chordFromIntervals,
} from './scales.js';

// Tuning systems
export {
  equalTemperament,
  TET_12,
  TET_19,
  TET_24,
  TET_31,
  TET_53,
  PYTHAGOREAN,
  JUST_5_LIMIT,
  JUST_7_LIMIT,
  QUARTER_COMMA_MEANTONE,
  centsDeviation,
  frequencyFromTuning,
  nearestStep,
} from './tuning.js';

// PCS similarity measures
export {
  icvsim,
  angleSimilarity,
  pcSetCosine,
  zRelation,
  earthMoversDistance,
} from './similarity.js';

// Cent/ratio/EDO conversion utilities
export {
  centsBetween,
  centsToRatio,
  ratioToCents,
  edoStepToCents,
  centsToEdoStep,
  ratioToEdoStep,
} from './cents.js';

// Pitch spelling
export type { SpelledPitch, SpellingKeyContext } from './spelling.js';
export { spellPitch, spellPitchSequence } from './spelling.js';
