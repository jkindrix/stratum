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
