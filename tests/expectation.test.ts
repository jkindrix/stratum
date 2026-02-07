import { describe, it, expect } from 'vitest';
import {
  buildMarkovModel,
  informationContent,
  contextEntropy,
  surpriseCurve,
  entropyCurve,
  combineModels,
  VIEWPOINT_PITCH,
  VIEWPOINT_MIDI,
  VIEWPOINT_INTERVAL,
  VIEWPOINT_CONTOUR,
  VIEWPOINT_DURATION,
  viewpointScaleDegree,
  pitchFromMidi,
} from '../src/index.js';
import type { NoteEvent, MarkovModel } from '../src/index.js';

// Helper to create NoteEvents
let idCounter = 0;
function makeEvent(midi: number, onset: number, duration = 480): NoteEvent {
  return {
    id: `exp-${++idCounter}`,
    pitch: pitchFromMidi(midi),
    onset,
    duration,
    velocity: 80,
    voice: 0,
  };
}

// A simple C major scale sequence
function cMajorScale(): NoteEvent[] {
  const pcs = [60, 62, 64, 65, 67, 69, 71, 72];
  return pcs.map((midi, i) => makeEvent(midi, i * 480));
}

// Repeated C-E-G pattern (predictable)
function repeatedCEG(n: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  for (let i = 0; i < n; i++) {
    const base = i * 3;
    events.push(makeEvent(60, (base + 0) * 480));
    events.push(makeEvent(64, (base + 1) * 480));
    events.push(makeEvent(67, (base + 2) * 480));
  }
  return events;
}

describe('Information-Theoretic Expectation', () => {
  describe('buildMarkovModel', () => {
    it('creates a model with correct alphabet', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events);
      expect(model.alphabet.length).toBeGreaterThan(0);
      expect(model.maxOrder).toBe(5);
    });

    it('creates order-1 contexts correctly', () => {
      const events = [makeEvent(60, 0), makeEvent(64, 480), makeEvent(60, 960)];
      const model = buildMarkovModel(events, { maxOrder: 1 });
      expect(model.maxOrder).toBe(1);
      // Order-0 context ('') should exist
      expect(model.counts.has('')).toBe(true);
      // Some order-1 context should exist (e.g., '0' since PC 0 = C)
      let hasOrder1 = false;
      for (const key of model.counts.keys()) {
        if (key.length > 0 && !key.includes(',')) {
          hasOrder1 = true;
          break;
        }
      }
      expect(hasOrder1).toBe(true);
    });

    it('handles order-3 contexts', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events, { maxOrder: 3 });
      expect(model.maxOrder).toBe(3);
      // Should have some multi-symbol context keys
      let hasLongContext = false;
      for (const key of model.counts.keys()) {
        if (key.split(',').length >= 3) {
          hasLongContext = true;
          break;
        }
      }
      expect(hasLongContext).toBe(true);
    });

    it('throws RangeError for maxOrder > 10', () => {
      expect(() => buildMarkovModel(cMajorScale(), { maxOrder: 11 })).toThrow(RangeError);
    });

    it('throws RangeError for maxOrder < 1', () => {
      expect(() => buildMarkovModel(cMajorScale(), { maxOrder: 0 })).toThrow(RangeError);
    });

    it('returns a frozen model', () => {
      const model = buildMarkovModel(cMajorScale());
      expect(Object.isFrozen(model)).toBe(true);
      expect(Object.isFrozen(model.alphabet)).toBe(true);
    });
  });

  describe('Viewpoints', () => {
    it('VIEWPOINT_PITCH returns pitch class string', () => {
      const e = makeEvent(60, 0); // C4, PC = 0
      expect(VIEWPOINT_PITCH(e, [])).toBe('0');
      const e2 = makeEvent(67, 480); // G4, PC = 7
      expect(VIEWPOINT_PITCH(e2, [])).toBe('7');
    });

    it('VIEWPOINT_MIDI returns MIDI number string', () => {
      const e = makeEvent(60, 0);
      expect(VIEWPOINT_MIDI(e, [])).toBe('60');
    });

    it('VIEWPOINT_INTERVAL returns semitone interval', () => {
      const ctx = [makeEvent(60, 0)];
      const e = makeEvent(64, 480);
      expect(VIEWPOINT_INTERVAL(e, ctx)).toBe('4'); // 64-60
    });

    it('VIEWPOINT_INTERVAL returns 0 with empty context', () => {
      const e = makeEvent(60, 0);
      expect(VIEWPOINT_INTERVAL(e, [])).toBe('0');
    });

    it('VIEWPOINT_CONTOUR returns up/down/same', () => {
      const ctx = [makeEvent(60, 0)];
      expect(VIEWPOINT_CONTOUR(makeEvent(64, 480), ctx)).toBe('up');
      expect(VIEWPOINT_CONTOUR(makeEvent(58, 480), ctx)).toBe('down');
      expect(VIEWPOINT_CONTOUR(makeEvent(60, 480), ctx)).toBe('same');
    });

    it('VIEWPOINT_DURATION returns quantized category', () => {
      expect(VIEWPOINT_DURATION(makeEvent(60, 0, 240), [])).toBe('short');
      expect(VIEWPOINT_DURATION(makeEvent(60, 0, 480), [])).toBe('medium');
      expect(VIEWPOINT_DURATION(makeEvent(60, 0, 960), [])).toBe('long');
      expect(VIEWPOINT_DURATION(makeEvent(60, 0, 1920), [])).toBe('long');
      expect(VIEWPOINT_DURATION(makeEvent(60, 0, 2400), [])).toBe('vlong');
    });

    it('viewpointScaleDegree returns correct scale degrees', () => {
      const vp = viewpointScaleDegree(0); // C tonic
      expect(vp(makeEvent(60, 0), [])).toBe('0');   // C
      expect(vp(makeEvent(64, 0), [])).toBe('4');   // E
      expect(vp(makeEvent(67, 0), [])).toBe('7');   // G
    });
  });

  describe('informationContent', () => {
    it('returns low IC for a predictable (repeated) note', () => {
      // Train on repeated C-E-G
      const events = repeatedCEG(5);
      const model = buildMarkovModel(events, { maxOrder: 2 });
      // Predict a C after G (predictable in the CEG pattern)
      const context = [makeEvent(64, 0), makeEvent(67, 480)];
      const ic = informationContent(makeEvent(60, 960), model, context);
      expect(ic).toBeGreaterThanOrEqual(0);
      // IC should be relatively low for a predictable continuation
      expect(ic).toBeLessThan(10);
    });

    it('returns higher IC for a surprising note', () => {
      const events = repeatedCEG(5);
      const model = buildMarkovModel(events, { maxOrder: 2 });
      // After C-E, the model expects G (pc 7)
      const context = [makeEvent(60, 0), makeEvent(64, 480)];
      const icExpected = informationContent(makeEvent(67, 960), model, context);
      // A chromatic note (F# = 66) should be more surprising
      const icSurprising = informationContent(makeEvent(66, 960), model, context);
      expect(icSurprising).toBeGreaterThan(icExpected);
    });

    it('works with empty context (order-0 fallback)', () => {
      const model = buildMarkovModel(cMajorScale(), { maxOrder: 2 });
      const ic = informationContent(makeEvent(60, 0), model, []);
      expect(ic).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(ic)).toBe(true);
    });
  });

  describe('contextEntropy', () => {
    it('returns high entropy for uniform distribution', () => {
      // Build a model where all 12 PCs are equally likely
      const allPcs: NoteEvent[] = [];
      for (let pc = 0; pc < 12; pc++) {
        allPcs.push(makeEvent(60 + pc, pc * 480));
      }
      const model = buildMarkovModel(allPcs, { maxOrder: 1 });
      const ent = contextEntropy(model, []);
      // With 12 equally likely symbols, max entropy ≈ log2(12) ≈ 3.585
      expect(ent).toBeGreaterThan(2);
    });

    it('returns lower entropy for peaked distribution', () => {
      // Train on mostly C (pc 0)
      const events: NoteEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push(makeEvent(60, i * 480));
      }
      events.push(makeEvent(64, 20 * 480)); // one E
      const model = buildMarkovModel(events, { maxOrder: 1 });
      const ent = contextEntropy(model, []);
      // Entropy should be low since C dominates
      expect(ent).toBeLessThan(2);
    });
  });

  describe('surpriseCurve', () => {
    it('returns one ICPoint per event', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events, { maxOrder: 2 });
      const curve = surpriseCurve(events, model);
      expect(curve.length).toBe(events.length);
    });

    it('IC values are non-negative', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events, { maxOrder: 2 });
      const curve = surpriseCurve(events, model);
      for (const p of curve) {
        expect(p.ic).toBeGreaterThanOrEqual(0);
      }
    });

    it('IC decreases for repeated patterns (model learns)', () => {
      const events = repeatedCEG(6);
      const model = buildMarkovModel(events, { maxOrder: 2 });
      const curve = surpriseCurve(events, model);
      // Compare average IC of first repetition vs last repetition
      const firstAvg = (curve.slice(0, 3).reduce((s, p) => s + p.ic, 0)) / 3;
      const lastAvg = (curve.slice(-3).reduce((s, p) => s + p.ic, 0)) / 3;
      // Last repetition should generally have lower average IC
      // (more context available = better predictions)
      expect(lastAvg).toBeLessThanOrEqual(firstAvg + 0.5); // small tolerance
    });

    it('returns empty for empty events', () => {
      const model = buildMarkovModel(cMajorScale());
      expect(surpriseCurve([], model)).toHaveLength(0);
    });

    it('returns frozen results', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events);
      const curve = surpriseCurve(events, model);
      expect(Object.isFrozen(curve)).toBe(true);
      if (curve.length > 0) {
        expect(Object.isFrozen(curve[0])).toBe(true);
      }
    });
  });

  describe('entropyCurve', () => {
    it('returns one EntropyPoint per event', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events);
      const curve = entropyCurve(events, model);
      expect(curve.length).toBe(events.length);
    });

    it('entropy values are non-negative', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events);
      const curve = entropyCurve(events, model);
      for (const p of curve) {
        expect(p.entropy).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns empty for empty events', () => {
      const model = buildMarkovModel(cMajorScale());
      expect(entropyCurve([], model)).toHaveLength(0);
    });

    it('returns frozen results', () => {
      const events = cMajorScale();
      const model = buildMarkovModel(events);
      const curve = entropyCurve(events, model);
      expect(Object.isFrozen(curve)).toBe(true);
      if (curve.length > 0) {
        expect(Object.isFrozen(curve[0])).toBe(true);
      }
    });
  });

  describe('combineModels', () => {
    it('combines two models with merged alphabet', () => {
      const stmEvents = [makeEvent(60, 0), makeEvent(64, 480)];
      const ltmEvents = [makeEvent(67, 0), makeEvent(71, 480)];
      const stm = buildMarkovModel(stmEvents, { maxOrder: 1 });
      const ltm = buildMarkovModel(ltmEvents, { maxOrder: 1 });
      const combined = combineModels(stm, ltm);
      // Should have all PCs from both models
      const allSymbols = new Set([...stm.alphabet, ...ltm.alphabet]);
      expect(combined.alphabet.length).toBe(allSymbols.size);
    });

    it('higher STM weight makes predictions closer to STM', () => {
      const stmEvents = repeatedCEG(3);
      const ltmEvents = cMajorScale();
      const stm = buildMarkovModel(stmEvents, { maxOrder: 2 });
      const ltm = buildMarkovModel(ltmEvents, { maxOrder: 2 });

      const stmHeavy = combineModels(stm, ltm, 0.9);
      const ltmHeavy = combineModels(stm, ltm, 0.1);

      // Test that models are different by checking IC for a common event
      const testCtx = [makeEvent(60, 0)];
      const testEvent = makeEvent(64, 480);
      const icStmHeavy = informationContent(testEvent, stmHeavy, testCtx);
      const icLtmHeavy = informationContent(testEvent, ltmHeavy, testCtx);
      // They should produce different IC values
      expect(icStmHeavy).not.toBeCloseTo(icLtmHeavy, 0);
    });

    it('throws RangeError for weight out of range', () => {
      const model = buildMarkovModel(cMajorScale());
      expect(() => combineModels(model, model, -0.1)).toThrow(RangeError);
      expect(() => combineModels(model, model, 1.1)).toThrow(RangeError);
    });

    it('returns a frozen model', () => {
      const stm = buildMarkovModel(cMajorScale(), { maxOrder: 2 });
      const ltm = buildMarkovModel(repeatedCEG(3), { maxOrder: 2 });
      const combined = combineModels(stm, ltm);
      expect(Object.isFrozen(combined)).toBe(true);
      expect(Object.isFrozen(combined.alphabet)).toBe(true);
    });
  });

  describe('Single event edge case', () => {
    it('handles single event correctly', () => {
      const events = [makeEvent(60, 0)];
      const model = buildMarkovModel(events, { maxOrder: 1 });
      const curve = surpriseCurve(events, model);
      expect(curve).toHaveLength(1);
      expect(curve[0]!.ic).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Different viewpoints on same data', () => {
    it('produces different IC values for different viewpoints', () => {
      const events = cMajorScale();
      const pitchModel = buildMarkovModel(events, { viewpoint: VIEWPOINT_PITCH, maxOrder: 2 });
      const intervalModel = buildMarkovModel(events, { viewpoint: VIEWPOINT_INTERVAL, maxOrder: 2 });

      const curve1 = surpriseCurve(events, pitchModel);
      const curve2 = surpriseCurve(events, intervalModel);

      // At least one IC value should differ
      let anyDifferent = false;
      for (let i = 1; i < events.length; i++) {
        if (Math.abs(curve1[i]!.ic - curve2[i]!.ic) > 0.01) {
          anyDifferent = true;
          break;
        }
      }
      expect(anyDifferent).toBe(true);
    });
  });
});
