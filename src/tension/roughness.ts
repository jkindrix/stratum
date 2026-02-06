/**
 * Compute sensory roughness for simultaneous frequencies.
 *
 * Based on the Plomp-Levelt model: roughness arises when partials of two
 * tones fall within the critical bandwidth. Each fundamental generates a
 * harmonic series with amplitudes following a 1/n rolloff (where n is the
 * harmonic number). This models a typical sustained tone; real instruments
 * vary, but 1/n is a reasonable generic approximation.
 *
 * @param frequencies — Fundamental frequencies in Hz. Values must be > 0 and finite.
 * @param numHarmonics — Number of harmonics per tone (default 6). Higher values
 *   increase accuracy for rich timbres but cost O(n^2) in the harmonic count.
 * @returns Aggregate roughness value (0 = perfectly smooth).
 */
export function roughness(frequencies: number[], numHarmonics = 6): number {
  if (frequencies.length < 2) return 0;

  // Validate inputs
  for (const f of frequencies) {
    if (!Number.isFinite(f) || f <= 0) {
      throw new RangeError(`Frequency must be a finite number > 0, got ${f}`);
    }
  }

  if (!Number.isInteger(numHarmonics) || numHarmonics < 1) {
    throw new RangeError(`numHarmonics must be an integer >= 1, got ${numHarmonics}`);
  }

  // Generate partials: each fundamental + its first N harmonics
  // Amplitude model: 1/n rolloff (harmonic number n = 1..numHarmonics)
  const partials: Array<{ freq: number; amp: number }> = [];
  for (const f of frequencies) {
    for (let h = 1; h <= numHarmonics; h++) {
      partials.push({ freq: f * h, amp: 1 / h });
    }
  }

  // Sum roughness across all partial pairs
  let total = 0;
  for (let i = 0; i < partials.length; i++) {
    for (let j = i + 1; j < partials.length; j++) {
      total += partialRoughness(
        partials[i]!.freq, partials[i]!.amp,
        partials[j]!.freq, partials[j]!.amp,
      );
    }
  }

  return total;
}

/**
 * Plomp-Levelt roughness for two pure tones.
 * Peaks when frequency difference is ~25% of the critical bandwidth.
 *
 * Uses the Glasberg & Moore (1990) ERB approximation for critical bandwidth:
 *   CB = 24.7 * (4.37 * f / 1000 + 1)
 */
function partialRoughness(f1: number, a1: number, f2: number, a2: number): number {
  const fMin = Math.min(f1, f2);
  const diff = Math.abs(f2 - f1);

  // Critical bandwidth (Glasberg & Moore 1990 ERB approximation)
  const cb = 24.7 * (4.37 * fMin / 1000 + 1);

  const x = diff / cb;

  // Plomp-Levelt curve: rises sharply, peaks at ~0.25 CB, decays
  const r = Math.exp(-3.5 * x) - Math.exp(-5.75 * x);

  return Math.max(0, r) * a1 * a2;
}

/**
 * Compute roughness for a set of MIDI note numbers.
 * Convenience wrapper that converts to frequencies using 12-TET.
 *
 * @param midiNotes — MIDI note numbers (0-127).
 * @param tuningHz — A4 reference frequency (default 440).
 * @param numHarmonics — Harmonics per tone (default 6).
 * @returns Aggregate roughness value (0 = perfectly smooth).
 */
export function roughnessFromMidi(
  midiNotes: number[],
  tuningHz = 440,
  numHarmonics = 6,
): number {
  const frequencies = midiNotes.map(m => tuningHz * Math.pow(2, (m - 69) / 12));
  return roughness(frequencies, numHarmonics);
}
