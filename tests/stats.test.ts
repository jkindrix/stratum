import { describe, it, expect } from 'vitest';
import {
  pitchFromMidi,
  shannonEntropy,
  rhythmicEntropy,
  zipfDistribution,
  markovTransition,
  markovGenerate,
  ngramCounts,
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

describe('Statistical Analysis', () => {
  describe('shannonEntropy', () => {
    it('returns 0 for single repeated PC', () => {
      const events = [makeNote(60, 0, 480), makeNote(60, 480, 480), makeNote(60, 960, 480)];
      expect(shannonEntropy(events)).toBe(0);
    });

    it('returns positive value for diverse PCs', () => {
      const events = [
        makeNote(60, 0, 480),  // C
        makeNote(62, 480, 480), // D
        makeNote(64, 960, 480), // E
      ];
      expect(shannonEntropy(events)).toBeGreaterThan(0);
    });

    it('maximizes for uniform distribution across all 12 PCs', () => {
      const events: NoteEvent[] = [];
      for (let pc = 0; pc < 12; pc++) {
        events.push(makeNote(60 + pc, pc * 480, 480));
      }
      const entropy = shannonEntropy(events);
      // Maximum entropy for 12 classes = log2(12) ≈ 3.585
      expect(entropy).toBeCloseTo(Math.log2(12), 5);
    });

    it('two equal PCs gives entropy of 1', () => {
      const events = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
      // Two equally likely outcomes: H = log2(2) = 1
      expect(shannonEntropy(events)).toBeCloseTo(1, 5);
    });

    it('throws RangeError for empty events', () => {
      expect(() => shannonEntropy([])).toThrow(RangeError);
    });
  });

  describe('rhythmicEntropy', () => {
    it('returns 0 for single event', () => {
      const events = [makeNote(60, 0, 480)];
      expect(rhythmicEntropy(events)).toBe(0);
    });

    it('returns 0 for uniform IOIs', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(64, 960, 480),
      ];
      expect(rhythmicEntropy(events)).toBe(0);
    });

    it('returns positive value for varied IOIs', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(64, 1440, 480), // gap
        makeNote(65, 1920, 480),
      ];
      expect(rhythmicEntropy(events)).toBeGreaterThan(0);
    });

    it('quantizes IOIs when parameter provided', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 490, 480),  // IOI = 490 ≈ 480
        makeNote(64, 975, 480),  // IOI = 485 ≈ 480
      ];
      // All IOIs quantize to 480 → entropy = 0
      expect(rhythmicEntropy(events, 480)).toBe(0);
    });

    it('throws RangeError for empty events', () => {
      expect(() => rhythmicEntropy([])).toThrow(RangeError);
    });
  });

  describe('zipfDistribution', () => {
    it('ranks PCs by descending frequency', () => {
      const events = [
        makeNote(60, 0, 480), makeNote(60, 480, 480), makeNote(60, 960, 480), // C x3
        makeNote(64, 1440, 480), makeNote(64, 1920, 480), // E x2
        makeNote(67, 2400, 480), // G x1
      ];
      const result = zipfDistribution(events);
      expect(result.ranks[0]!.item).toBe(0);   // C (PC 0) rank 1
      expect(result.ranks[0]!.count).toBe(3);
      expect(result.ranks[1]!.item).toBe(4);   // E (PC 4) rank 2
      expect(result.ranks[1]!.count).toBe(2);
      expect(result.ranks[2]!.item).toBe(7);   // G (PC 7) rank 3
      expect(result.ranks[2]!.count).toBe(1);
    });

    it('computes a positive exponent for Zipf-like distribution', () => {
      // Create a distribution roughly following Zipf's law
      const events: NoteEvent[] = [];
      let onset = 0;
      for (let i = 0; i < 12; i++) {
        events.push(makeNote(60 + i, onset, 480));
        onset += 480;
      }
      for (let i = 0; i < 6; i++) {
        events.push(makeNote(60, onset, 480)); // More C
        onset += 480;
      }
      for (let i = 0; i < 3; i++) {
        events.push(makeNote(62, onset, 480)); // More D
        onset += 480;
      }
      const result = zipfDistribution(events);
      expect(result.exponent).toBeGreaterThan(0);
    });

    it('returns frozen result', () => {
      const events = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
      const result = zipfDistribution(events);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.ranks)).toBe(true);
    });

    it('throws RangeError for empty events', () => {
      expect(() => zipfDistribution([])).toThrow(RangeError);
    });
  });

  describe('markovTransition', () => {
    it('builds transition probabilities from simple sequence', () => {
      // C → D → E → C → D → E
      const events = [
        makeNote(60, 0, 480),   // C
        makeNote(62, 480, 480), // D
        makeNote(64, 960, 480), // E
        makeNote(60, 1440, 480), // C
        makeNote(62, 1920, 480), // D
        makeNote(64, 2400, 480), // E
      ];
      const chain = markovTransition(events);
      expect(chain.states).toEqual([0, 2, 4]); // C, D, E
      expect(chain.order).toBe(1);

      // C always goes to D: P(D|C) = 1.0
      const cIdx = chain.states.indexOf(0);
      const dIdx = chain.states.indexOf(2);
      expect(chain.matrix[cIdx]![dIdx]).toBe(1.0);

      // D always goes to E: P(E|D) = 1.0
      const eIdx = chain.states.indexOf(4);
      expect(chain.matrix[dIdx]![eIdx]).toBe(1.0);
    });

    it('rows sum to 1 (or 0 for sinks)', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(64, 960, 480),
        makeNote(60, 1440, 480),
      ];
      const chain = markovTransition(events);
      for (const row of chain.matrix) {
        const sum = row.reduce((a, b) => a + b, 0);
        // Either 0 (no outgoing transitions) or ~1.0
        expect(sum === 0 || Math.abs(sum - 1) < 1e-10).toBe(true);
      }
    });

    it('returns frozen result', () => {
      const events = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
      const chain = markovTransition(events);
      expect(Object.isFrozen(chain)).toBe(true);
      expect(Object.isFrozen(chain.states)).toBe(true);
      expect(Object.isFrozen(chain.matrix)).toBe(true);
    });

    it('throws RangeError for empty events', () => {
      expect(() => markovTransition([])).toThrow(RangeError);
    });

    it('throws RangeError for order < 1', () => {
      expect(() => markovTransition([makeNote(60, 0, 480)], 0)).toThrow(RangeError);
    });
  });

  describe('markovGenerate', () => {
    it('generates a sequence of the requested length', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(64, 960, 480),
        makeNote(60, 1440, 480),
      ];
      const chain = markovTransition(events);
      const seq = markovGenerate(chain, 0, 10, () => 0.5);
      expect(seq).toHaveLength(10);
      expect(seq[0]).toBe(0); // starts with C
    });

    it('is deterministic with a fixed rng', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(64, 960, 480),
        makeNote(60, 1440, 480),
      ];
      const chain = markovTransition(events);
      let callCount = 0;
      const rng = () => { callCount++; return 0.5; };
      const seq1 = markovGenerate(chain, 0, 5, rng);
      callCount = 0;
      const seq2 = markovGenerate(chain, 0, 5, () => 0.5);
      expect([...seq1]).toEqual([...seq2]);
    });

    it('throws RangeError for invalid startPc', () => {
      const events = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
      const chain = markovTransition(events);
      expect(() => markovGenerate(chain, 7, 5)).toThrow(RangeError);
    });

    it('throws RangeError for length < 1', () => {
      const events = [makeNote(60, 0, 480), makeNote(62, 480, 480)];
      const chain = markovTransition(events);
      expect(() => markovGenerate(chain, 0, 0)).toThrow(RangeError);
    });

    it('returns a frozen array', () => {
      const events = [
        makeNote(60, 0, 480),
        makeNote(62, 480, 480),
        makeNote(60, 960, 480),
      ];
      const chain = markovTransition(events);
      const seq = markovGenerate(chain, 0, 3, () => 0.5);
      expect(Object.isFrozen(seq)).toBe(true);
    });
  });

  describe('ngramCounts', () => {
    it('counts unigrams (n=1)', () => {
      const events = [
        makeNote(60, 0, 480),   // C
        makeNote(62, 480, 480), // D
        makeNote(60, 960, 480), // C
      ];
      const counts = ngramCounts(events, 1);
      expect(counts.get('0')).toBe(2); // C appears twice
      expect(counts.get('2')).toBe(1); // D appears once
    });

    it('counts bigrams (n=2)', () => {
      const events = [
        makeNote(60, 0, 480),   // C
        makeNote(62, 480, 480), // D
        makeNote(64, 960, 480), // E
        makeNote(60, 1440, 480), // C
        makeNote(62, 1920, 480), // D
      ];
      const counts = ngramCounts(events, 2);
      expect(counts.get('0,2')).toBe(2);  // C→D appears twice
      expect(counts.get('2,4')).toBe(1);  // D→E appears once
      expect(counts.get('4,0')).toBe(1);  // E→C appears once
    });

    it('throws RangeError for empty events', () => {
      expect(() => ngramCounts([], 2)).toThrow(RangeError);
    });

    it('throws RangeError for n < 1', () => {
      expect(() => ngramCounts([makeNote(60, 0, 480)], 0)).toThrow(RangeError);
    });
  });
});
