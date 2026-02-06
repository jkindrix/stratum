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
