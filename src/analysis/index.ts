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
  StructuralBoundary,
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
  multiScaleNovelty,
  findStructuralBoundaries,
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
export type { Triad, NRTOperation, SeventhChord, SeventhChordQuality, NRT7Operation } from './neo-riemannian.js';
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
  seventhChordPitchClasses,
  nrt7Transform,
  classifyNRT7,
  nrt7Compound,
  nrt7Path,
} from './neo-riemannian.js';

// Twelve-tone serial operations
export type {
  TwelveToneRow,
  TwelveToneMatrix,
  RowForm,
  RowFormIdentification,
  AllCombinatorialType,
  AllCombinatorialClassification,
  AllIntervalRowOptions,
  SegmentalInvarianceResult,
  SegmentMapping,
  DerivedRowResult,
  DerivedRowTransformation,
} from './serial.js';
export {
  createRow,
  twelvetoneMatrix,
  getRowForm,
  rowMultiply,
  rowRotate,
  combinatoriality,
  invariantPcs,
  identifyForm,
  isAllInterval,
  allIntervalRows,
  multiply,
  M5,
  M7,
  setMultiplication,
  intervalExpansion,
  isHexachordallyCombinatorialP,
  isHexachordallyCombinatorialI,
  isHexachordallyCombinatorialR,
  isHexachordallyCombinatorialRI,
  isAllCombinatorialHexachord,
  classifyAllCombinatorialType,
  segmentalInvariance,
  derivedRow,
} from './serial.js';

// Statistical analysis
export type { MarkovChain, ZipfResult, StyleFingerprint } from './stats.js';
export {
  shannonEntropy,
  rhythmicEntropy,
  zipfDistribution,
  markovTransition,
  markovGenerate,
  ngramCounts,
  pitchDistribution,
  intervalDistribution,
  durationDistribution,
  chordTypeDistribution,
  styleFingerprint,
  styleSimilarity,
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

// Voice separation
export type { VoiceSeparationOptions, Voice, VoiceSeparationResult } from './voice-separation.js';
export { separateVoices } from './voice-separation.js';

// Counterpoint analysis
export type {
  MotionType,
  MotionClassification,
  ViolationType,
  ViolationSeverity,
  CounterpointViolation,
  CounterpointOptions,
  CounterpointResult,
} from './counterpoint.js';
export {
  checkFirstSpecies,
  checkSecondSpecies,
  checkFourthSpecies,
  contrapuntalMotion,
} from './counterpoint.js';

// Textural analysis
export type { TextureClass, TexturePoint } from './texture.js';
export { textureType, rhythmicIndependence, textureProfile, voiceCount } from './texture.js';

// Harmonic network analysis
export type { ChordNode, ChordEdge, ChordGraph, GraphMetrics, CommunityResult, GraphComparison } from './harmonic-network.js';
export {
  chordTransitionGraph,
  transitionProbabilities,
  graphCentrality,
  detectCommunities,
  findCycles,
  compareGraphs,
} from './harmonic-network.js';

// Evaluation metrics
export type { AccuracyResult, KeyAccuracyResult, PrecisionRecallResult, EvalKey, Segment, OverlapResult } from './evaluation.js';
export {
  chordAccuracy,
  keyAccuracy,
  segmentationPrecisionRecall,
  voiceSeparationAccuracy,
  overlapRatio,
} from './evaluation.js';

// SIA/SIATEC repetition discovery
export type { MusicPoint, TranslationVector, SIAPattern, TEC, CosiatecResult } from './sia.js';
export { pointSetRepresentation, sia, siatec, cosiatec, compressionRatio } from './sia.js';

// Information-theoretic expectation
export type { Viewpoint, MarkovModel, ICPoint, EntropyPoint } from './expectation.js';
export {
  VIEWPOINT_PITCH,
  VIEWPOINT_MIDI,
  VIEWPOINT_INTERVAL,
  VIEWPOINT_CONTOUR,
  VIEWPOINT_DURATION,
  viewpointScaleDegree,
  buildMarkovModel,
  informationContent,
  contextEntropy,
  surpriseCurve,
  entropyCurve,
  combineModels,
} from './expectation.js';

// Figured bass realization & analysis
export type {
  FBAccidental,
  FBInterval,
  ParsedFiguredBass,
  FiguredBassKey,
  RealizedChord,
  FiguredBassAnalysisOptions,
  FiguredBassEvent,
} from './figured-bass.js';
export { parseFiguredBass, realizeFiguredBass, figuredBassAnalysis } from './figured-bass.js';

// Klumpenhouwer Networks & Generalized Interval Systems
export type {
  KNetArrowType,
  KNetArrow,
  KNet,
  IsographyResult,
  GIS,
} from './knet-gis.js';
export {
  buildKNet,
  kNetIsography,
  buildGIS,
  gisInterval,
  pitchClassGIS,
  pitchGIS,
  durationGIS,
} from './knet-gis.js';
