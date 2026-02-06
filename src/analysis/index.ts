// Harmonic analysis
export type { ChordLabel, HarmonicEvent, RomanNumeral } from './harmonic.js';
export {
  identifyChord,
  identifyScale,
  harmonicRhythm,
  romanNumeralAnalysis,
} from './harmonic.js';

// Melodic analysis
export type { ContourDirection, PitchRange } from './melodic.js';
export {
  contour,
  range,
  meanPitch,
  intervalHistogram,
  stepLeapRatio,
} from './melodic.js';

// Structural analysis
export type { CurvePoint, EnvelopePoint } from './structural.js';
export {
  segmentByRests,
  segmentByPattern,
  eventDensityCurve,
  registralEnvelope,
} from './structural.js';

// Key detection
export type {
  KeyProfile,
  KeyCandidate,
  KeyDetectionResult,
  KeyDetectionOptions,
  WindowedKeyResult,
} from './key-detection.js';
export { detectKey, detectKeyWindowed } from './key-detection.js';
