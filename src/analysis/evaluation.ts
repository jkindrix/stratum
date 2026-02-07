// ---------------------------------------------------------------------------
// Stratum — Evaluation Metrics (mir_eval-style accuracy for MIR tasks)
// ---------------------------------------------------------------------------

/** Element-wise accuracy result. */
export interface AccuracyResult {
  /** Fraction of correct predictions (0-1). */
  readonly accuracy: number;
  /** Number of correct predictions. */
  readonly correct: number;
  /** Total number of predictions. */
  readonly total: number;
}

/** Key estimation accuracy with multi-level scoring. */
export interface KeyAccuracyResult {
  /** True if tonic and mode match exactly. */
  readonly exactMatch: boolean;
  /** True if the predicted key is a fifth above or below the reference. */
  readonly fifthRelated: boolean;
  /** True if the predicted key is the relative major/minor of the reference. */
  readonly relativeKey: boolean;
  /** Score: 1.0 (exact), 0.5 (fifth-related), 0.3 (relative), 0.0 (other). */
  readonly score: number;
}

/** Precision, recall, and F1 result. */
export interface PrecisionRecallResult {
  /** Precision: TP / (TP + FP). */
  readonly precision: number;
  /** Recall: TP / (TP + FN). */
  readonly recall: number;
  /** F1 score: 2 * precision * recall / (precision + recall). */
  readonly f1: number;
  /** True positive count. */
  readonly truePositives: number;
  /** False positive count. */
  readonly falsePositives: number;
  /** False negative count. */
  readonly falseNegatives: number;
}

/** Key specification for evaluation. */
export interface EvalKey {
  /** Tonic pitch class (0-11). */
  readonly tonic: number;
  /** Mode: 'major' or 'minor'. */
  readonly mode: 'major' | 'minor';
}

/** A time segment with start and end ticks. */
export interface Segment {
  /** Start tick (inclusive). */
  readonly start: number;
  /** End tick (exclusive). */
  readonly end: number;
}

/** Overlap measurement between predicted and reference segments. */
export interface OverlapResult {
  /** Ratio of total overlap to total span (0-1). */
  readonly overlapRatio: number;
  /** Total overlap in ticks. */
  readonly totalOverlap: number;
  /** Total span (union) in ticks. */
  readonly totalSpan: number;
}

// ---- Public API ----

/**
 * Element-wise chord symbol accuracy.
 *
 * Compares predicted and reference chord label arrays element by element.
 * Labels are compared as exact string matches.
 *
 * @param predicted - Predicted chord symbols.
 * @param reference - Reference (ground truth) chord symbols.
 * @returns Frozen AccuracyResult.
 * @throws {RangeError} If arrays have different lengths or are empty.
 */
export function chordAccuracy(
  predicted: readonly string[],
  reference: readonly string[],
): AccuracyResult {
  if (predicted.length !== reference.length) {
    throw new RangeError(
      `predicted and reference must have same length (got ${predicted.length} vs ${reference.length})`,
    );
  }
  if (predicted.length === 0) {
    throw new RangeError('arrays must not be empty');
  }

  let correct = 0;
  for (let i = 0; i < predicted.length; i++) {
    if ((predicted[i] ?? '') === (reference[i] ?? '')) {
      correct++;
    }
  }

  return Object.freeze({
    accuracy: correct / predicted.length,
    correct,
    total: predicted.length,
  });
}

/**
 * Key estimation accuracy with three-level scoring.
 *
 * Scoring follows MIREX conventions:
 * - Exact match (same tonic + mode): 1.0
 * - Fifth-related (tonic a fifth above/below, same mode): 0.5
 * - Relative key (relative major/minor): 0.3
 * - Other: 0.0
 *
 * @param predicted - Predicted key.
 * @param reference - Reference key.
 * @returns Frozen KeyAccuracyResult.
 */
export function keyAccuracy(predicted: EvalKey, reference: EvalKey): KeyAccuracyResult {
  const exactMatch = predicted.tonic === reference.tonic && predicted.mode === reference.mode;

  // Circle of fifths distance: map PC to fifths position via (pc * 7) % 12
  const predFifths = (predicted.tonic * 7) % 12;
  const refFifths = (reference.tonic * 7) % 12;
  const fifthsDist = Math.min(
    ((predFifths - refFifths) % 12 + 12) % 12,
    ((refFifths - predFifths) % 12 + 12) % 12,
  );
  const fifthRelated = !exactMatch && fifthsDist === 1 && predicted.mode === reference.mode;

  // Relative key: major tonic + 9 semitones = minor tonic (and vice versa)
  let relativeKey = false;
  if (predicted.mode !== reference.mode) {
    if (predicted.mode === 'major' && reference.mode === 'minor') {
      // predicted major → its relative minor is (tonic + 9) % 12
      relativeKey = (predicted.tonic + 9) % 12 === reference.tonic;
    } else {
      // predicted minor → its relative major is (tonic + 3) % 12
      relativeKey = (predicted.tonic + 3) % 12 === reference.tonic;
    }
  }

  let score = 0;
  if (exactMatch) score = 1.0;
  else if (fifthRelated) score = 0.5;
  else if (relativeKey) score = 0.3;

  return Object.freeze({ exactMatch, fifthRelated, relativeKey, score });
}

/**
 * Segmentation precision, recall, and F1.
 *
 * A predicted boundary is a true positive if it falls within `tolerance` ticks
 * of any reference boundary. Each reference boundary can match at most one
 * predicted boundary.
 *
 * @param predicted - Predicted boundary tick positions.
 * @param reference - Reference boundary tick positions.
 * @param tolerance - Maximum distance for a match (default 480 = one quarter note).
 * @returns Frozen PrecisionRecallResult.
 * @throws {RangeError} If tolerance is negative.
 */
export function segmentationPrecisionRecall(
  predicted: readonly number[],
  reference: readonly number[],
  tolerance: number = 480,
): PrecisionRecallResult {
  if (tolerance < 0) {
    throw new RangeError(`tolerance must be non-negative (got ${tolerance})`);
  }

  if (predicted.length === 0 && reference.length === 0) {
    return Object.freeze({ precision: 1, recall: 1, f1: 1, truePositives: 0, falsePositives: 0, falseNegatives: 0 });
  }

  if (predicted.length === 0) {
    return Object.freeze({ precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: reference.length });
  }

  if (reference.length === 0) {
    return Object.freeze({ precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: predicted.length, falseNegatives: 0 });
  }

  // Sort both arrays
  const sortedPred = [...predicted].sort((a, b) => a - b);
  const sortedRef = [...reference].sort((a, b) => a - b);

  const matchedRef = new Set<number>();
  let truePositives = 0;

  for (const p of sortedPred) {
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let j = 0; j < sortedRef.length; j++) {
      if (matchedRef.has(j)) continue;
      const dist = Math.abs(p - (sortedRef[j] ?? 0));
      if (dist <= tolerance && dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }

    if (bestIdx >= 0) {
      truePositives++;
      matchedRef.add(bestIdx);
    }
  }

  const falsePositives = predicted.length - truePositives;
  const falseNegatives = reference.length - truePositives;

  const precision = predicted.length > 0 ? truePositives / predicted.length : 0;
  const recall = reference.length > 0 ? truePositives / reference.length : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  return Object.freeze({ precision, recall, f1, truePositives, falsePositives, falseNegatives });
}

/**
 * Voice separation accuracy with optimal label permutation.
 *
 * Since voice labels are arbitrary, finds the permutation of predicted labels
 * that maximizes accuracy against reference labels. Uses Hungarian algorithm
 * for nVoices ≤ 8, greedy matching for larger.
 *
 * @param predicted - Predicted voice assignment per note (0-indexed).
 * @param reference - Reference voice assignment per note (0-indexed).
 * @param nVoices - Number of voice labels to consider.
 * @returns Frozen AccuracyResult.
 * @throws {RangeError} If arrays have different lengths, are empty, or nVoices < 1.
 */
export function voiceSeparationAccuracy(
  predicted: readonly number[],
  reference: readonly number[],
  nVoices: number,
): AccuracyResult {
  if (predicted.length !== reference.length) {
    throw new RangeError(
      `predicted and reference must have same length (got ${predicted.length} vs ${reference.length})`,
    );
  }
  if (predicted.length === 0) {
    throw new RangeError('arrays must not be empty');
  }
  if (!Number.isInteger(nVoices) || nVoices < 1) {
    throw new RangeError(`nVoices must be a positive integer (got ${nVoices})`);
  }

  const total = predicted.length;

  if (nVoices <= 8) {
    // Hungarian algorithm approach: build cost matrix
    const correct = hungarianBestMatch(predicted, reference, nVoices);
    return Object.freeze({ accuracy: correct / total, correct, total });
  } else {
    // Greedy matching for larger voice counts
    const correct = greedyBestMatch(predicted, reference, nVoices);
    return Object.freeze({ accuracy: correct / total, correct, total });
  }
}

/**
 * Compute overlap ratio between predicted and reference segments.
 *
 * For each predicted segment, finds overlap with each reference segment.
 * Returns the ratio of total overlap to total union span.
 *
 * @param predicted - Predicted segments.
 * @param reference - Reference segments.
 * @returns Frozen OverlapResult.
 * @throws {RangeError} If either array is empty.
 */
export function overlapRatio(
  predicted: readonly Segment[],
  reference: readonly Segment[],
): OverlapResult {
  if (predicted.length === 0 || reference.length === 0) {
    throw new RangeError('predicted and reference segment arrays must not be empty');
  }

  let totalOverlap = 0;

  for (const p of predicted) {
    for (const r of reference) {
      const overlapStart = Math.max(p.start, r.start);
      const overlapEnd = Math.min(p.end, r.end);
      if (overlapEnd > overlapStart) {
        totalOverlap += overlapEnd - overlapStart;
      }
    }
  }

  // Compute total span as union of all segments
  const allSegments = [...predicted, ...reference];
  const totalSpan = computeUnionSpan(allSegments);

  const ratio = totalSpan > 0 ? totalOverlap / totalSpan : 0;

  return Object.freeze({ overlapRatio: ratio, totalOverlap, totalSpan });
}

// ---- Internal helpers ----

/** Compute the total span (union length) of possibly overlapping segments. */
function computeUnionSpan(segments: readonly Segment[]): number {
  if (segments.length === 0) return 0;

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  let totalSpan = 0;
  let currentStart = sorted[0]!.start;
  let currentEnd = sorted[0]!.end;

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i]!;
    if (seg.start <= currentEnd) {
      // Overlapping or contiguous — extend
      currentEnd = Math.max(currentEnd, seg.end);
    } else {
      // Gap — add current merged segment
      totalSpan += currentEnd - currentStart;
      currentStart = seg.start;
      currentEnd = seg.end;
    }
  }
  totalSpan += currentEnd - currentStart;

  return totalSpan;
}

/**
 * Hungarian algorithm for optimal assignment of predicted to reference voice labels.
 * Returns the maximum number of correctly matched notes.
 */
function hungarianBestMatch(
  predicted: readonly number[],
  reference: readonly number[],
  nVoices: number,
): number {
  // Build confusion matrix: confMatrix[predLabel][refLabel] = count of co-occurrences
  const confMatrix: number[][] = [];
  for (let i = 0; i < nVoices; i++) {
    confMatrix.push(new Array<number>(nVoices).fill(0));
  }

  for (let i = 0; i < predicted.length; i++) {
    const p = predicted[i] ?? 0;
    const r = reference[i] ?? 0;
    if (p < nVoices && r < nVoices) {
      confMatrix[p]![r] = (confMatrix[p]![r] ?? 0) + 1;
    }
  }

  // For small nVoices, try all permutations
  if (nVoices <= 8) {
    const perms = permutations(nVoices);
    let bestCorrect = 0;

    for (const perm of perms) {
      let correct = 0;
      for (let predLabel = 0; predLabel < nVoices; predLabel++) {
        const refLabel = perm[predLabel] ?? 0;
        correct += confMatrix[predLabel]?.[refLabel] ?? 0;
      }
      if (correct > bestCorrect) {
        bestCorrect = correct;
      }
    }

    return bestCorrect;
  }

  return 0; // Should not reach here (guarded by caller)
}

/** Generate all permutations of [0, 1, ..., n-1]. */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  if (n === 1) return [[0]];

  const result: number[][] = [];

  function permute(arr: number[], start: number): void {
    if (start === n) {
      result.push([...arr]);
      return;
    }
    for (let i = start; i < n; i++) {
      // Swap
      const tmp = arr[start]!;
      arr[start] = arr[i]!;
      arr[i] = tmp;
      permute(arr, start + 1);
      // Swap back
      arr[i] = arr[start]!;
      arr[start] = tmp;
    }
  }

  const initial: number[] = [];
  for (let i = 0; i < n; i++) initial.push(i);
  permute(initial, 0);

  return result;
}

/**
 * Greedy best match for voice labels when nVoices > 8.
 * Iteratively assigns the predicted label with the highest co-occurrence to the
 * best available reference label.
 */
function greedyBestMatch(
  predicted: readonly number[],
  reference: readonly number[],
  nVoices: number,
): number {
  // Build confusion matrix
  const confMatrix: number[][] = [];
  for (let i = 0; i < nVoices; i++) {
    confMatrix.push(new Array<number>(nVoices).fill(0));
  }

  for (let i = 0; i < predicted.length; i++) {
    const p = predicted[i] ?? 0;
    const r = reference[i] ?? 0;
    if (p < nVoices && r < nVoices) {
      confMatrix[p]![r] = (confMatrix[p]![r] ?? 0) + 1;
    }
  }

  // Greedy: repeatedly find the (pred, ref) pair with max co-occurrence
  const assignedPred = new Set<number>();
  const assignedRef = new Set<number>();
  const mapping = new Map<number, number>(); // pred → ref

  for (let step = 0; step < nVoices; step++) {
    let bestVal = -1;
    let bestP = -1;
    let bestR = -1;

    for (let p = 0; p < nVoices; p++) {
      if (assignedPred.has(p)) continue;
      for (let r = 0; r < nVoices; r++) {
        if (assignedRef.has(r)) continue;
        const val = confMatrix[p]?.[r] ?? 0;
        if (val > bestVal) {
          bestVal = val;
          bestP = p;
          bestR = r;
        }
      }
    }

    if (bestP < 0) break;
    assignedPred.add(bestP);
    assignedRef.add(bestR);
    mapping.set(bestP, bestR);
  }

  // Count correct
  let correct = 0;
  for (let i = 0; i < predicted.length; i++) {
    const p = predicted[i] ?? 0;
    const r = reference[i] ?? 0;
    const mappedRef = mapping.get(p);
    if (mappedRef === r) {
      correct++;
    }
  }

  return correct;
}
