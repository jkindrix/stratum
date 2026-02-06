// Core
export type {
  Articulation,
  DynamicMarking,
  Pitch,
  NoteEvent,
  TimeSignature,
  TempoMark,
  KeyCenter,
  Part,
  TuningSystem,
  ScoreSettings,
  Score,
} from './core/index.js';

export {
  createScore,
  pitchFromMidi,
  addPart,
  removePart,
  addNote,
  removeNote,
  getAllEvents,
  getEventsAtTick,
  getEventsInRange,
  tickToSeconds,
  secondsToTick,
  getScoreDuration,
  cloneScore,
  mergeScores,
} from './core/index.js';

// Pitch analysis
export type { ForteEntry, Scale, Chord, SpelledPitch, SpellingKeyContext } from './pitch/index.js';
export {
  normalizePc,
  pitchFromPcOctave,
  pitchToFrequency,
  frequencyToPitch,
  pitchClassName,
  pitchClassFlatName,
  pitchName,
  parsePitchName,
  directedInterval,
  intervalClass,
  intervalClassName,
  semitoneDist,
  PitchClassSet,
  FORTE_CATALOG,
  FORTE_BY_NAME,
  voiceLeadingDistance,
  smoothestVoiceLeading,
  // Scales, modes, and chords
  SCALE_CATALOG,
  CHORD_CATALOG,
  scaleFromPcs,
  scaleFromIntervals,
  modeRotation,
  chordFromPcs,
  chordFromName,
  chordFromIntervals,
  // Tuning systems
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
  // PCS similarity
  icvsim,
  angleSimilarity,
  pcSetCosine,
  zRelation,
  earthMoversDistance,
  // Cent/ratio/EDO conversions
  centsBetween,
  centsToRatio,
  ratioToCents,
  edoStepToCents,
  centsToEdoStep,
  ratioToEdoStep,
  // Pitch spelling
  spellPitch,
  spellPitchSequence,
} from './pitch/index.js';

// Time analysis
export type { MetricLevel, MetricOptions, Pattern, PatternOptions } from './time/index.js';
export {
  buildMetricLevels,
  beatStrength,
  maxBeatStrength,
  syncopation,
  metricPosition,
  findPatterns,
  quantize,
  swing,
  durationName,
  durationTicks,
} from './time/index.js';

// Tension analysis
export type { TensionWeights, TensionOptions, TensionPoint, TensionCurve, TensionProfile, TonalIntervalVector, DFTComponents } from './tension/index.js';
export {
  roughness,
  roughnessFromMidi,
  computeTension,
  tensionVelocity,
  tensionAcceleration,
  tensionIntegral,
  findTensionPeaks,
  findTensionValleys,
  classifyTensionProfile,
  // TIV / DFT
  chromaVector,
  tiv,
  tivDistance,
  tivConsonance,
  dftCoefficients,
} from './tension/index.js';

// I/O
export type { ScoreJSON } from './io/index.js';
export { midiToScore, scoreToMidi, scoreToJSON, scoreFromJSON } from './io/index.js';

// Rendering
export type { RenderOptions, TensionRenderOptions, OverlayOptions } from './render/index.js';
export { renderChromaticStaff, renderTensionCurve, renderOverlay } from './render/index.js';

// Analysis
export type {
  ChordLabel,
  HarmonicEvent,
  RomanNumeral,
  ContourDirection,
  PitchRange,
  CurvePoint,
  EnvelopePoint,
  KeyProfile,
  KeyCandidate,
  KeyDetectionResult,
  KeyDetectionOptions,
  WindowedKeyResult,
} from './analysis/index.js';
export {
  identifyChord,
  identifyScale,
  harmonicRhythm,
  romanNumeralAnalysis,
  contour,
  range,
  meanPitch,
  intervalHistogram,
  stepLeapRatio,
  segmentByRests,
  segmentByPattern,
  eventDensityCurve,
  registralEnvelope,
  // Key detection
  detectKey,
  detectKeyWindowed,
} from './analysis/index.js';
