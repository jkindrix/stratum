// ---------------------------------------------------------------------------
// Stratum — Spiral Array Tension Model (Chew 2000, Herremans & Chew 2016)
// ---------------------------------------------------------------------------
//
// The Spiral Array maps pitch classes onto a 3D helix where geometric proximity
// reflects tonal proximity. This enables tension measurement via distances
// between pitch/chord/key representations in the array.
//
// The helix is parameterized as:
//   pitch class k → (r·sin(k·π/2), r·cos(k·π/2), k·h)
// where k is the position along the line of fifths, r is the helix radius,
// and h is the height increment per fifth.

/** A point in the Spiral Array's 3D space. */
export interface SpiralPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ---- Constants ----

// Standard Spiral Array parameters (Chew 2000)
const R = 1;   // helix radius
const H = 0.5; // height increment per step along the line of fifths

// Map pitch class (0-11) to position along the line of fifths.
// C=0, G=1, D=2, A=3, E=4, B=5, F#=6, C#/Db=7, Ab=8, Eb=9, Bb=10, F=11
// This is the circle of fifths order: each step is +7 semitones.
const PC_TO_FIFTH_POS: readonly number[] = Object.freeze([
  0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5,
]);

// ---- Internal helpers ----

function fifthPosition(pc: number): number {
  return PC_TO_FIFTH_POS[pc % 12]!;
}

function helixPoint(fifthPos: number): SpiralPoint {
  const angle = fifthPos * Math.PI / 2;
  return {
    x: R * Math.sin(angle),
    y: R * Math.cos(angle),
    z: fifthPos * H,
  };
}

function euclidean(a: SpiralPoint, b: SpiralPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function weightedCentroid(points: SpiralPoint[], weights: number[]): SpiralPoint {
  let sx = 0, sy = 0, sz = 0, tw = 0;
  for (let i = 0; i < points.length; i++) {
    const w = weights[i] ?? 1;
    sx += points[i]!.x * w;
    sy += points[i]!.y * w;
    sz += points[i]!.z * w;
    tw += w;
  }
  if (tw === 0) return { x: 0, y: 0, z: 0 };
  return { x: sx / tw, y: sy / tw, z: sz / tw };
}

// ---- Public API ----

/**
 * Map a pitch class to its position on the Spiral Array helix.
 *
 * @param pc - Pitch class (0-11).
 * @returns 3D point on the Spiral Array helix.
 */
export function spiralArrayPosition(pc: number): SpiralPoint {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11) {
    throw new RangeError(`pitch class must be an integer 0-11 (got ${pc})`);
  }
  return helixPoint(fifthPosition(pc));
}

/**
 * Compute the center of effect (weighted centroid) for a set of pitch classes.
 *
 * The center of effect represents the "tonal center of gravity" of a chord or
 * passage in the Spiral Array space.
 *
 * @param pcs - Array of pitch classes (0-11).
 * @param weights - Optional weights for each pitch class (e.g., durations).
 * @returns The weighted centroid point in Spiral Array space.
 */
export function centerOfEffect(pcs: readonly number[], weights?: readonly number[]): SpiralPoint {
  const points = pcs.map(pc => spiralArrayPosition(pc));
  const w = weights ? [...weights] : pcs.map(() => 1);
  return weightedCentroid(points, w);
}

/**
 * Cloud diameter: maximum pairwise distance between pitch positions.
 *
 * Higher cloud diameter indicates greater pitch-space spread (dissonance).
 * Major triads have smaller diameters than diminished sevenths.
 *
 * @param pcs - Array of pitch classes (0-11).
 * @returns Maximum pairwise Euclidean distance (0 for < 2 PCs).
 */
export function cloudDiameter(pcs: readonly number[]): number {
  if (pcs.length < 2) return 0;

  const points = pcs.map(pc => spiralArrayPosition(pc));
  let maxDist = 0;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = euclidean(points[i]!, points[j]!);
      if (d > maxDist) maxDist = d;
    }
  }

  return maxDist;
}

/**
 * Cloud momentum: distance between consecutive chord centroids.
 *
 * Measures the rate of harmonic change. Larger distances indicate
 * more dramatic harmonic movement.
 *
 * @param chordSequence - Sequence of chords, each as an array of pitch classes.
 * @param weights - Optional weights per chord (2D array, same structure as chordSequence).
 * @returns Array of distances between consecutive centroids (length = chordSequence.length - 1).
 */
export function cloudMomentum(
  chordSequence: readonly (readonly number[])[],
  weights?: readonly (readonly number[])[],
): number[] {
  if (chordSequence.length < 2) return [];

  const centroids = chordSequence.map((chord, i) =>
    centerOfEffect(chord, weights?.[i]),
  );

  const distances: number[] = [];
  for (let i = 1; i < centroids.length; i++) {
    distances.push(euclidean(centroids[i - 1]!, centroids[i]!));
  }

  return distances;
}

/**
 * Tensile strain: distance from a chord's centroid to a key's centroid.
 *
 * Measures how far a chord is from the tonal center. Chords closely related
 * to the key have small tensile strain; distant chords have large strain.
 *
 * @param chordPcs - Pitch classes of the chord.
 * @param keyPcs - Pitch classes of the key (typically the diatonic scale).
 * @param chordWeights - Optional weights for chord PCs.
 * @param keyWeights - Optional weights for key PCs.
 * @returns Euclidean distance between chord and key centroids.
 */
export function tensileStrain(
  chordPcs: readonly number[],
  keyPcs: readonly number[],
  chordWeights?: readonly number[],
  keyWeights?: readonly number[],
): number {
  const chordCentroid = centerOfEffect(chordPcs, chordWeights);
  const keyCentroid = centerOfEffect(keyPcs, keyWeights);
  return euclidean(chordCentroid, keyCentroid);
}
