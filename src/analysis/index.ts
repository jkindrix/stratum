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
export type {
  CurvePoint,
  EnvelopePoint,
  SimilarityMatrix,
  NoveltyPoint,
  FeatureExtractor,
} from './structural.js';
export {
  segmentByRests,
  segmentByPattern,
  eventDensityCurve,
  registralEnvelope,
  chromaticFeature,
  selfSimilarityMatrix,
  noveltyDetection,
  noveltyPeaks,
} from './structural.js';

// Key detection
export type {
  KeyProfile,
  KeyCandidate,
  KeyDetectionResult,
  KeyDetectionOptions,
  WindowedKeyResult,
} from './key-detection.js';
export { detectKey, detectKeyWindowed, detectKeyTIV, keyName, pcDistribution } from './key-detection.js';

// Enhanced Roman numeral analysis
export type { RomanNumeralKey, EnhancedRomanNumeral, ModulationPoint } from './enhanced-roman.js';
export { enhancedRomanNumeral, functionalHarmonyScore, chordQualityFromSymbol, detectModulations } from './enhanced-roman.js';

// Neo-Riemannian transforms
export type { Triad, NRTOperation } from './neo-riemannian.js';
export {
  nrtTransform,
  classifyNRT,
  nrtCompound,
  nrtPath,
  hexatonicCycle,
  octatonicCycle,
  hexatonicPole,
  weitzmannRegion,
  triadPitchClasses,
} from './neo-riemannian.js';

// Twelve-tone serial operations
export type { TwelveToneRow, TwelveToneMatrix, RowForm } from './serial.js';
export {
  createRow,
  twelvetoneMatrix,
  getRowForm,
  rowMultiply,
  rowRotate,
  combinatoriality,
  invariantPcs,
} from './serial.js';

// Statistical analysis
export type { MarkovChain, ZipfResult } from './stats.js';
export {
  shannonEntropy,
  rhythmicEntropy,
  zipfDistribution,
  markovTransition,
  markovGenerate,
  ngramCounts,
} from './stats.js';

// Chord-scale theory
export type { ToneClassification, ScaleTone, ChordScaleMatch, NoteHarmonyClassification } from './chord-scale.js';
export {
  chordScaleMatch,
  classifyTones,
  availableTensions,
  avoidNotes,
  hpcp,
  chordScaleScore,
  bestChordScale,
  analyzeOverHarmony,
} from './chord-scale.js';
