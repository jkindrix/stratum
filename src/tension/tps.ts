// ---------------------------------------------------------------------------
// Stratum — Tonal Pitch Space (Lerdahl 2001)
// ---------------------------------------------------------------------------
//
// Implements the Tonal Pitch Space model from Lerdahl's "Tonal Pitch Space"
// (2001). Tension is computed as the distance between chords in a hierarchical
// pitch-space representation. The model uses a 5-level basic space:
//   Level a: chromatic (all 12 PCs)
//   Level b: diatonic (7 scale degrees)
//   Level c: triadic (3 chord tones)
//   Level d: fifth (root + fifth)
//   Level e: root only

/** Key context for TPS calculations. */
export interface TPSKey {
  /** Tonic pitch class (0-11). */
  readonly tonic: number;
  /** Mode: 'major' or 'minor'. */
  readonly mode: 'major' | 'minor';
}

/** Chord for TPS calculations, specified as pitch classes. */
export interface TPSChord {
  /** Root pitch class (0-11). */
  readonly root: number;
  /** All pitch classes in the chord (unordered). */
  readonly pcs: readonly number[];
}

// ---- Scale templates (relative to tonic = 0) ----

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor

function getScalePcs(key: TPSKey): Set<number> {
  const template = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  return new Set(template.map(d => (d + key.tonic) % 12));
}

// ---- Basic Space ----

/**
 * Build the 5-level basic space for a chord in a key context.
 *
 * Returns a 12-element array where each value (0-5) indicates the highest
 * level at which the pitch class appears:
 *   5 = root, 4 = fifth, 3 = chord tone, 2 = diatonic, 1 = chromatic, 0 = absent.
 *
 * @param chord - The chord (root + pitch classes).
 * @param key - The key context.
 * @returns 12-element basic space array.
 */
export function basicSpace(chord: TPSChord, key: TPSKey): readonly number[] {
  if (!Number.isInteger(key.tonic) || key.tonic < 0 || key.tonic > 11) {
    throw new RangeError(`key tonic must be an integer 0-11 (got ${key.tonic})`);
  }
  const space = new Array<number>(12).fill(0);
  const scalePcs = getScalePcs(key);
  const chordPcs = new Set(chord.pcs);
  const fifth = (chord.root + 7) % 12;

  for (let pc = 0; pc < 12; pc++) {
    // Level a: chromatic (always present) → 1
    space[pc] = 1;

    // Level b: diatonic → 2
    if (scalePcs.has(pc)) {
      space[pc] = 2;
    }

    // Level c: triadic → 3
    if (chordPcs.has(pc)) {
      space[pc] = 3;
    }

    // Level d: fifth → 4
    if (pc === fifth) {
      space[pc] = Math.max(space[pc]!, 4);
    }

    // Level e: root → 5
    if (pc === chord.root) {
      space[pc] = 5;
    }
  }

  return space;
}

/**
 * Compute the TPS distance between two chords in their respective keys.
 *
 * Distance is the sum of absolute differences between the basic spaces of
 * the two chords. This captures how much the tonal hierarchy changes.
 *
 * @param chordA - First chord.
 * @param keyA - Key context for first chord.
 * @param chordB - Second chord.
 * @param keyB - Key context for second chord.
 * @returns Non-negative distance (0 = identical basic spaces).
 */
export function tpsDistance(
  chordA: TPSChord,
  keyA: TPSKey,
  chordB: TPSChord,
  keyB: TPSKey,
): number {
  const spaceA = basicSpace(chordA, keyA);
  const spaceB = basicSpace(chordB, keyB);

  let dist = 0;
  for (let i = 0; i < 12; i++) {
    dist += Math.abs(spaceA[i]! - spaceB[i]!);
  }

  return dist;
}

/**
 * Compute surface dissonance: count and weight non-chord tones against a chord.
 *
 * Non-chord tones in the sounding events add tension. Events whose pitch class
 * is not in the chord contribute to surface dissonance, weighted by their
 * proximity to the nearest chord tone.
 *
 * @param eventPcs - Pitch classes of sounding events (may have duplicates for emphasis).
 * @param chord - The underlying chord.
 * @returns Non-negative dissonance value.
 */
export function surfaceDissonance(
  eventPcs: readonly number[],
  chord: TPSChord,
): number {
  const chordSet = new Set(chord.pcs);
  let dissonance = 0;

  for (const pc of eventPcs) {
    if (!chordSet.has(pc)) {
      // Weight by minimum distance to nearest chord tone
      let minDist = 6; // max circular distance on chroma
      for (const ct of chord.pcs) {
        const dist = Math.min(
          Math.abs(pc - ct),
          12 - Math.abs(pc - ct),
        );
        if (dist < minDist) minDist = dist;
      }
      dissonance += minDist;
    }
  }

  return dissonance;
}

/**
 * Compute melodic attraction of a pitch toward a target in a key context.
 *
 * Based on Lerdahl's attraction formula: attraction is inversely proportional
 * to the square of the semitone distance and directly proportional to the
 * stability difference. More stable targets (scale degrees) attract more strongly.
 *
 * @param pitchPc - Pitch class of the melodic note (0-11).
 * @param targetPc - Pitch class of the target note (0-11).
 * @param key - Key context.
 * @returns Attraction value (higher = stronger pull toward target).
 */
export function melodicAttraction(
  pitchPc: number,
  targetPc: number,
  key: TPSKey,
): number {
  // Semitone distance (circular)
  const dist = Math.min(
    Math.abs(pitchPc - targetPc),
    12 - Math.abs(pitchPc - targetPc),
  );

  if (dist === 0) return 0; // No attraction to self

  // Stability of target: higher for tonic, lower for chromatic
  const scalePcs = getScalePcs(key);
  let targetStability = 1; // chromatic
  if (scalePcs.has(targetPc)) targetStability = 2; // diatonic
  if (targetPc === key.tonic) targetStability = 4; // tonic
  if (targetPc === (key.tonic + 7) % 12) targetStability = 3; // dominant

  // Stability of source
  let sourceStability = 1;
  if (scalePcs.has(pitchPc)) sourceStability = 2;
  if (pitchPc === key.tonic) sourceStability = 4;
  if (pitchPc === (key.tonic + 7) % 12) sourceStability = 3;

  // Attraction = stabilityDiff / distance^2
  // Use absolute difference + 1 to ensure non-zero
  const stabilityDiff = Math.abs(targetStability - sourceStability) + 1;
  return stabilityDiff / (dist * dist);
}
