import { describe, it, expect } from 'vitest';
import {
  chordAccuracy,
  keyAccuracy,
  segmentationPrecisionRecall,
  voiceSeparationAccuracy,
  overlapRatio,
} from '../src/index.js';
import type { EvalKey, Segment } from '../src/index.js';

describe('Evaluation Metrics', () => {
  describe('chordAccuracy', () => {
    it('returns 1.0 for perfect match', () => {
      const pred = ['Cmaj', 'Fmaj', 'Gmaj', 'Cmaj'];
      const ref = ['Cmaj', 'Fmaj', 'Gmaj', 'Cmaj'];
      const result = chordAccuracy(pred, ref);
      expect(result.accuracy).toBe(1.0);
      expect(result.correct).toBe(4);
      expect(result.total).toBe(4);
    });

    it('returns 0.0 for complete mismatch', () => {
      const pred = ['Cmaj', 'Cmaj', 'Cmaj'];
      const ref = ['Dmin', 'Dmin', 'Dmin'];
      const result = chordAccuracy(pred, ref);
      expect(result.accuracy).toBe(0);
      expect(result.correct).toBe(0);
    });

    it('computes partial accuracy correctly', () => {
      const pred = ['Cmaj', 'Fmaj', 'Gmaj', 'Amin'];
      const ref = ['Cmaj', 'Fmaj', 'Amin', 'Gmaj'];
      const result = chordAccuracy(pred, ref);
      expect(result.accuracy).toBe(0.5);
      expect(result.correct).toBe(2);
    });

    it('throws RangeError for mismatched lengths', () => {
      expect(() => chordAccuracy(['Cmaj'], ['Cmaj', 'Gmaj'])).toThrow(RangeError);
    });

    it('throws RangeError for empty arrays', () => {
      expect(() => chordAccuracy([], [])).toThrow(RangeError);
    });

    it('returns frozen result', () => {
      const result = chordAccuracy(['Cmaj'], ['Cmaj']);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('keyAccuracy', () => {
    it('exact match → score 1.0', () => {
      const pred: EvalKey = { tonic: 0, mode: 'major' };
      const ref: EvalKey = { tonic: 0, mode: 'major' };
      const result = keyAccuracy(pred, ref);
      expect(result.exactMatch).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it('fifth-related → score 0.5', () => {
      // C major vs G major (G is fifth above C)
      const pred: EvalKey = { tonic: 7, mode: 'major' };
      const ref: EvalKey = { tonic: 0, mode: 'major' };
      const result = keyAccuracy(pred, ref);
      expect(result.fifthRelated).toBe(true);
      expect(result.score).toBe(0.5);
    });

    it('fifth below → score 0.5', () => {
      // C major vs F major (F is fifth below C)
      const pred: EvalKey = { tonic: 5, mode: 'major' };
      const ref: EvalKey = { tonic: 0, mode: 'major' };
      const result = keyAccuracy(pred, ref);
      expect(result.fifthRelated).toBe(true);
      expect(result.score).toBe(0.5);
    });

    it('C major vs A minor → relative key, score 0.3', () => {
      const pred: EvalKey = { tonic: 0, mode: 'major' };
      const ref: EvalKey = { tonic: 9, mode: 'minor' };
      const result = keyAccuracy(pred, ref);
      expect(result.relativeKey).toBe(true);
      expect(result.score).toBe(0.3);
    });

    it('A minor vs C major → relative key, score 0.3', () => {
      const pred: EvalKey = { tonic: 9, mode: 'minor' };
      const ref: EvalKey = { tonic: 0, mode: 'major' };
      const result = keyAccuracy(pred, ref);
      expect(result.relativeKey).toBe(true);
      expect(result.score).toBe(0.3);
    });

    it('unrelated keys → score 0.0', () => {
      const pred: EvalKey = { tonic: 0, mode: 'major' };
      const ref: EvalKey = { tonic: 6, mode: 'minor' };
      const result = keyAccuracy(pred, ref);
      expect(result.score).toBe(0);
      expect(result.exactMatch).toBe(false);
      expect(result.fifthRelated).toBe(false);
      expect(result.relativeKey).toBe(false);
    });

    it('same tonic different mode → not exact match', () => {
      const pred: EvalKey = { tonic: 0, mode: 'major' };
      const ref: EvalKey = { tonic: 0, mode: 'minor' };
      const result = keyAccuracy(pred, ref);
      expect(result.exactMatch).toBe(false);
    });

    it('returns frozen result', () => {
      const result = keyAccuracy({ tonic: 0, mode: 'major' }, { tonic: 0, mode: 'major' });
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('segmentationPrecisionRecall', () => {
    it('perfect boundaries → P=R=F1=1.0', () => {
      const pred = [0, 480, 960];
      const ref = [0, 480, 960];
      const result = segmentationPrecisionRecall(pred, ref);
      expect(result.precision).toBe(1);
      expect(result.recall).toBe(1);
      expect(result.f1).toBe(1);
      expect(result.truePositives).toBe(3);
    });

    it('handles tolerance for near matches', () => {
      const pred = [0, 500, 960]; // 500 is within 480 tolerance of 480
      const ref = [0, 480, 960];
      const result = segmentationPrecisionRecall(pred, ref, 480);
      expect(result.precision).toBe(1);
      expect(result.recall).toBe(1);
    });

    it('strict tolerance rejects near misses', () => {
      const pred = [0, 500, 960];
      const ref = [0, 480, 960];
      const result = segmentationPrecisionRecall(pred, ref, 10);
      // 500 is 20 away from 480, exceeds tolerance of 10
      expect(result.truePositives).toBe(2);
      expect(result.falsePositives).toBe(1);
      expect(result.falseNegatives).toBe(1);
    });

    it('no predicted boundaries → precision=0, recall=0', () => {
      const result = segmentationPrecisionRecall([], [0, 480]);
      expect(result.precision).toBe(0);
      expect(result.recall).toBe(0);
      expect(result.falseNegatives).toBe(2);
    });

    it('no reference boundaries → precision=0', () => {
      const result = segmentationPrecisionRecall([0, 480], []);
      expect(result.precision).toBe(0);
      expect(result.falsePositives).toBe(2);
    });

    it('both empty → perfect score', () => {
      const result = segmentationPrecisionRecall([], []);
      expect(result.precision).toBe(1);
      expect(result.recall).toBe(1);
      expect(result.f1).toBe(1);
    });

    it('throws RangeError for negative tolerance', () => {
      expect(() => segmentationPrecisionRecall([0], [0], -1)).toThrow(RangeError);
    });

    it('returns frozen result', () => {
      const result = segmentationPrecisionRecall([0], [0]);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('each reference matches at most one prediction', () => {
      // Two predictions near one reference
      const pred = [480, 490];
      const ref = [485];
      const result = segmentationPrecisionRecall(pred, ref, 480);
      expect(result.truePositives).toBe(1); // only one match
      expect(result.falsePositives).toBe(1);
    });
  });

  describe('voiceSeparationAccuracy', () => {
    it('returns 1.0 for perfect labeling', () => {
      const pred = [0, 0, 1, 1];
      const ref = [0, 0, 1, 1];
      const result = voiceSeparationAccuracy(pred, ref, 2);
      expect(result.accuracy).toBe(1.0);
    });

    it('handles swapped labels (permutation invariant)', () => {
      // Predicted labels are swapped but structure is correct
      const pred = [1, 1, 0, 0];
      const ref = [0, 0, 1, 1];
      const result = voiceSeparationAccuracy(pred, ref, 2);
      expect(result.accuracy).toBe(1.0);
    });

    it('computes partial accuracy', () => {
      const pred = [0, 0, 0, 1]; // 3 in voice 0, 1 in voice 1
      const ref = [0, 1, 0, 1]; // 2 in each
      const result = voiceSeparationAccuracy(pred, ref, 2);
      // Best mapping: 0→0 gives 2 matches from pred 0 = ref 0
      // and 1→1 gives 1 match → total 3/4 = 0.75
      expect(result.accuracy).toBe(0.75);
    });

    it('handles 3 voices', () => {
      const pred = [0, 1, 2, 0, 1, 2];
      const ref = [0, 1, 2, 0, 1, 2];
      const result = voiceSeparationAccuracy(pred, ref, 3);
      expect(result.accuracy).toBe(1.0);
    });

    it('throws RangeError for mismatched lengths', () => {
      expect(() => voiceSeparationAccuracy([0], [0, 1], 2)).toThrow(RangeError);
    });

    it('throws RangeError for empty arrays', () => {
      expect(() => voiceSeparationAccuracy([], [], 2)).toThrow(RangeError);
    });

    it('throws RangeError for nVoices < 1', () => {
      expect(() => voiceSeparationAccuracy([0], [0], 0)).toThrow(RangeError);
    });

    it('returns frozen result', () => {
      const result = voiceSeparationAccuracy([0, 1], [0, 1], 2);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('overlapRatio', () => {
    it('returns 1.0 for identical segments', () => {
      const segs: Segment[] = [{ start: 0, end: 480 }, { start: 480, end: 960 }];
      const result = overlapRatio(segs, segs);
      expect(result.overlapRatio).toBeCloseTo(1.0, 10);
    });

    it('returns 0 for non-overlapping segments', () => {
      const pred: Segment[] = [{ start: 0, end: 100 }];
      const ref: Segment[] = [{ start: 200, end: 300 }];
      const result = overlapRatio(pred, ref);
      expect(result.overlapRatio).toBe(0);
      expect(result.totalOverlap).toBe(0);
    });

    it('computes partial overlap correctly', () => {
      const pred: Segment[] = [{ start: 0, end: 200 }];
      const ref: Segment[] = [{ start: 100, end: 300 }];
      const result = overlapRatio(pred, ref);
      // Overlap: 100 to 200 = 100
      // Union: 0 to 300 = 300
      expect(result.totalOverlap).toBe(100);
      expect(result.totalSpan).toBe(300);
      expect(result.overlapRatio).toBeCloseTo(100 / 300, 10);
    });

    it('handles multiple segments', () => {
      const pred: Segment[] = [{ start: 0, end: 100 }, { start: 200, end: 300 }];
      const ref: Segment[] = [{ start: 50, end: 250 }];
      const result = overlapRatio(pred, ref);
      // Overlap with first: max(0,50) to min(100,250) = 50 to 100 = 50
      // Overlap with second: max(200,50) to min(300,250) = 200 to 250 = 50
      expect(result.totalOverlap).toBe(100);
    });

    it('throws RangeError for empty predicted', () => {
      expect(() => overlapRatio([], [{ start: 0, end: 100 }])).toThrow(RangeError);
    });

    it('throws RangeError for empty reference', () => {
      expect(() => overlapRatio([{ start: 0, end: 100 }], [])).toThrow(RangeError);
    });

    it('returns frozen result', () => {
      const result = overlapRatio([{ start: 0, end: 100 }], [{ start: 0, end: 100 }]);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });
});
