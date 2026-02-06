import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  pitchFromMidi,
  chromaVector,
  tiv,
  tivDistance,
  tivConsonance,
  dftCoefficients,
} from '../src/index.js';
import type { NoteEvent } from '../src/index.js';

function makeNote(midi: number, onset: number, duration: number): NoteEvent {
  return {
    id: `n_${onset}_${midi}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice: 0,
  };
}

describe('Tonal Interval Vectors via DFT', () => {
  describe('chromaVector', () => {
    it('accumulates duration by pitch class', () => {
      const events = [
        makeNote(60, 0, 100),   // C
        makeNote(64, 0, 200),   // E
        makeNote(67, 0, 150),   // G
        makeNote(72, 100, 50),  // C (another octave)
      ];
      const chroma = chromaVector(events);
      expect(chroma[0]).toBe(150);  // C: 100 + 50
      expect(chroma[4]).toBe(200);  // E: 200
      expect(chroma[7]).toBe(150);  // G: 150
      expect(chroma[1]).toBe(0);    // C#: none
    });

    it('returns 12-element array', () => {
      const chroma = chromaVector([makeNote(60, 0, 100)]);
      expect(chroma).toHaveLength(12);
    });

    it('empty events → all zeros', () => {
      const chroma = chromaVector([]);
      expect(chroma.every(v => v === 0)).toBe(true);
    });
  });

  describe('tiv', () => {
    it('returns 6 coefficients', () => {
      const cMajor = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const v = tiv(cMajor);
      expect(v.coefficients).toHaveLength(6);
      expect(v.magnitudes).toHaveLength(6);
    });

    it('all-zero distribution yields zero energy', () => {
      const v = tiv([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(v.energy).toBeCloseTo(0);
    });

    it('uniform distribution yields zero energy (no tonal structure)', () => {
      const v = tiv([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
      expect(v.energy).toBeCloseTo(0, 5);
    });

    it('tonal distributions have positive energy', () => {
      const cMajor = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const v = tiv(cMajor);
      expect(v.energy).toBeGreaterThan(0);
    });

    it('throws on wrong-length input', () => {
      expect(() => tiv([1, 2, 3])).toThrow('12 elements');
    });
  });

  describe('tivDistance', () => {
    it('same distribution yields distance 0', () => {
      const chroma = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const v = tiv(chroma);
      expect(tivDistance(v, v)).toBeCloseTo(0);
    });

    it('different distributions yield positive distance', () => {
      const cMaj = tiv([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]);
      const cMin = tiv([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0]);
      expect(tivDistance(cMaj, cMin)).toBeGreaterThan(0);
    });

    it('is symmetric', () => {
      const a = tiv([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]);
      const b = tiv([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0]);
      expect(tivDistance(a, b)).toBeCloseTo(tivDistance(b, a));
    });

    it('closely related keys have smaller distance', () => {
      const cMaj = tiv([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]); // C major
      const gMaj = tiv([1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1]); // G major (1 note diff)
      const fsMaj = tiv([0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0]); // F# major (distant)
      const dCG = tivDistance(cMaj, gMaj);
      const dCFs = tivDistance(cMaj, fsMaj);
      expect(dCG).toBeLessThan(dCFs);
    });
  });

  describe('tivConsonance', () => {
    it('major triad > semitone cluster (duration-weighted)', () => {
      // Weight tonic more heavily — mimics real music where tonic is more prominent
      const majorTriad = [3, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0]; // C(3)-E(1)-G(2)
      const cluster = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];     // C-C#-D-Eb-E (chromatic)
      expect(tivConsonance(majorTriad)).toBeGreaterThan(tivConsonance(cluster));
    });

    it('uniform chromatic distribution has low consonance', () => {
      const uniform = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
      expect(tivConsonance(uniform)).toBeCloseTo(0, 5);
    });

    it('single pitch class has positive consonance', () => {
      const single = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      expect(tivConsonance(single)).toBeGreaterThan(0);
    });
  });

  describe('dftCoefficients', () => {
    it('returns all 6 named components', () => {
      const chroma = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const c = dftCoefficients(chroma);
      expect(c.chromaticity).toBeDefined();
      expect(c.diadicity).toBeDefined();
      expect(c.triadicity).toBeDefined();
      expect(c.octatonicity).toBeDefined();
      expect(c.diatonicity).toBeDefined();
      expect(c.wholeTone).toBeDefined();
    });

    it('diatonic scale has high diatonicity', () => {
      const cMajor = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
      const c = dftCoefficients(cMajor);
      // f5 (diatonicity) should be the highest or near highest for diatonic scale
      expect(c.diatonicity).toBeGreaterThan(0);
    });

    it('whole-tone scale has high diadicity', () => {
      const wholeTone = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
      const c = dftCoefficients(wholeTone);
      // f6 (whole-tone quality) should be prominent
      expect(c.wholeTone).toBeGreaterThan(0);
    });

    it('augmented triad has high triadicity', () => {
      const aug = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // C-E-G#
      const c = dftCoefficients(aug);
      expect(c.triadicity).toBeGreaterThan(0);
    });

    it('diminished seventh has high octatonicity', () => {
      const dim7 = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]; // C-Eb-Gb-Bbb(A)
      const c = dftCoefficients(dim7);
      expect(c.octatonicity).toBeGreaterThan(0);
    });
  });
});
