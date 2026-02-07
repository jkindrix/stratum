// ---------------------------------------------------------------------------
// Stratum — Composition Module (Barrel Exports)
// ---------------------------------------------------------------------------

// Stochastic generators
export type { WeightedOption } from './stochastic.js';
export {
  poissonOnsets,
  gaussianPitches,
  uniformRhythm,
  exponentialDurations,
  cauchyPitches,
  weightedChoice,
} from './stochastic.js';

// Xenakis Sieve
export { Sieve, sieve } from './sieve.js';

// L-System
export type { ProductionRule, SymbolMapping, LSystemEvent } from './l-system.js';
export { LSystem, PITCH_MAPPING, RHYTHM_MAPPING } from './l-system.js';

// Cellular Automaton
export type { CellGrid, CAMapping, CAEvent } from './cellular-automaton.js';
export { elementaryCA, gameOfLife, caToEvents } from './cellular-automaton.js';

// Composition Constraints
export type {
  ParallelViolation,
  CrossingViolation,
  RangeViolation,
  LeapViolation,
} from './constraints.js';
export {
  checkParallelFifths,
  checkParallelOctaves,
  checkVoiceCrossing,
  isInRange,
  checkLeapResolution,
} from './constraints.js';
