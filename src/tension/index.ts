export { roughness, roughnessFromMidi } from './roughness.js';

export type {
  TensionWeights,
  TensionOptions,
  TensionPoint,
  TensionCurve,
  TensionProfile,
} from './tension.js';
export {
  computeTension,
  tensionVelocity,
  tensionAcceleration,
  tensionIntegral,
  findTensionPeaks,
  findTensionValleys,
  classifyTensionProfile,
} from './tension.js';

// TIV (Tonal Interval Vectors via DFT)
export type { TonalIntervalVector, DFTComponents } from './tiv.js';
export { chromaVector, tiv, tivDistance, tivConsonance, dftCoefficients } from './tiv.js';

// Tonal Pitch Space (Lerdahl)
export type { TPSKey, TPSChord } from './tps.js';
export { basicSpace, tpsDistance, surfaceDissonance, melodicAttraction } from './tps.js';

// Spiral Array tension model
export type { SpiralPoint } from './spiral-array.js';
export {
  spiralArrayPosition,
  centerOfEffect,
  cloudDiameter,
  cloudMomentum,
  tensileStrain,
} from './spiral-array.js';
