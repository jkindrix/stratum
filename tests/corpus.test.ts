import { describe, it, expect } from 'vitest';
import {
  createScore,
  addPart,
  addNote,
  getAllEvents,
  createCorpus,
  loadCorpus,
  corpusSearch,
  corpusFilter,
  batchAnalyze,
  corpusStatistics,
  crossWorkSearch,
} from '../src/index.js';
import type { CorpusEntry, CorpusMetadata, Corpus } from '../src/index.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal score with a C major scale fragment. */
function makeScore(opts?: {
  title?: string;
  composer?: string;
  partName?: string;
  midis?: number[];
  timeSig?: { numerator: number; denominator: number };
}): ReturnType<typeof createScore> {
  const score = createScore({
    title: opts?.title ?? '',
    composer: opts?.composer ?? '',
    timeSignature: opts?.timeSig,
  });
  const part = addPart(score, { name: opts?.partName ?? 'Piano' });
  const midis = opts?.midis ?? [60, 62, 64, 65, 67];
  for (let i = 0; i < midis.length; i++) {
    addNote(score, part, { midi: midis[i]!, onset: i * 480, duration: 480 });
  }
  return score;
}

function makeEntry(
  id: string,
  overrides?: Partial<CorpusMetadata>,
  scoreOpts?: Parameters<typeof makeScore>[0],
): CorpusEntry {
  const score = makeScore(scoreOpts);
  return Object.freeze({
    id,
    score,
    metadata: Object.freeze({
      title: overrides?.title ?? '',
      composer: overrides?.composer ?? '',
      date: overrides?.date ?? '',
      genre: overrides?.genre ?? '',
      instrumentation: overrides?.instrumentation ?? '',
      key: overrides?.key ?? '',
      meter: overrides?.meter ?? '',
    }),
  });
}

// ── createCorpus ────────────────────────────────────────────────────────────

describe('createCorpus', () => {
  it('creates corpus with correct size', () => {
    const corpus = createCorpus([
      makeEntry('a'),
      makeEntry('b'),
    ]);
    expect(corpus.size).toBe(2);
    expect(corpus.entries).toHaveLength(2);
  });

  it('returns frozen result', () => {
    const corpus = createCorpus([makeEntry('a')]);
    expect(Object.isFrozen(corpus)).toBe(true);
    expect(Object.isFrozen(corpus.entries)).toBe(true);
  });

  it('throws RangeError for duplicate IDs', () => {
    expect(() =>
      createCorpus([makeEntry('dup'), makeEntry('dup')]),
    ).toThrow(RangeError);
  });

  it('creates empty corpus from empty array', () => {
    const corpus = createCorpus([]);
    expect(corpus.size).toBe(0);
    expect(corpus.entries).toHaveLength(0);
  });

  it('preserves entry order', () => {
    const corpus = createCorpus([
      makeEntry('first'),
      makeEntry('second'),
      makeEntry('third'),
    ]);
    expect(corpus.entries[0]!.id).toBe('first');
    expect(corpus.entries[1]!.id).toBe('second');
    expect(corpus.entries[2]!.id).toBe('third');
  });
});

// ── loadCorpus ──────────────────────────────────────────────────────────────

describe('loadCorpus', () => {
  it('loads Score objects with format "score"', () => {
    const s = makeScore({ title: 'Test' });
    const corpus = loadCorpus([{ data: s, format: 'score' }]);
    expect(corpus.size).toBe(1);
    expect(corpus.entries[0]!.score).toBe(s);
  });

  it('loads multiple scores with correct count', () => {
    const corpus = loadCorpus([
      { data: makeScore(), format: 'score' },
      { data: makeScore(), format: 'score' },
      { data: makeScore(), format: 'score' },
    ]);
    expect(corpus.size).toBe(3);
  });

  it('auto-generates sequential IDs', () => {
    const corpus = loadCorpus([
      { data: makeScore(), format: 'score' },
      { data: makeScore(), format: 'score' },
    ]);
    expect(corpus.entries[0]!.id).toBe('corpus_0');
    expect(corpus.entries[1]!.id).toBe('corpus_1');
  });

  it('uses custom IDs when provided', () => {
    const corpus = loadCorpus([
      { data: makeScore(), format: 'score', id: 'custom_1' },
      { data: makeScore(), format: 'score', id: 'custom_2' },
    ]);
    expect(corpus.entries[0]!.id).toBe('custom_1');
    expect(corpus.entries[1]!.id).toBe('custom_2');
  });

  it('extracts meter from first time signature', () => {
    const s = makeScore({ timeSig: { numerator: 3, denominator: 4 } });
    const corpus = loadCorpus([{ data: s, format: 'score' }]);
    expect(corpus.entries[0]!.metadata.meter).toBe('3/4');
  });

  it('overrides title and composer from input metadata', () => {
    const s = makeScore({ title: 'Original', composer: 'Author' });
    const corpus = loadCorpus([
      {
        data: s,
        format: 'score',
        metadata: { title: 'Override', composer: 'NewAuthor' },
      },
    ]);
    expect(corpus.entries[0]!.metadata.title).toBe('Override');
    expect(corpus.entries[0]!.metadata.composer).toBe('NewAuthor');
  });

  it('infers instrumentation from part names', () => {
    const s = createScore();
    addPart(s, { name: 'Violin' });
    addPart(s, { name: 'Cello' });
    addNote(s, s.parts[0]!, { midi: 60, onset: 0, duration: 480 });
    const corpus = loadCorpus([{ data: s, format: 'score' }]);
    expect(corpus.entries[0]!.metadata.instrumentation).toBe('Violin, Cello');
  });

  it('throws RangeError for empty inputs', () => {
    expect(() => loadCorpus([])).toThrow(RangeError);
  });

  it('returns frozen result', () => {
    const corpus = loadCorpus([{ data: makeScore(), format: 'score' }]);
    expect(Object.isFrozen(corpus)).toBe(true);
    expect(Object.isFrozen(corpus.entries)).toBe(true);
    expect(Object.isFrozen(corpus.entries[0]!)).toBe(true);
    expect(Object.isFrozen(corpus.entries[0]!.metadata)).toBe(true);
  });

  it('auto-detects key when detectKeys is true', () => {
    // C major scale — should detect C major
    const s = makeScore({ midis: [60, 62, 64, 65, 67, 69, 71, 72] });
    const corpus = loadCorpus(
      [{ data: s, format: 'score' }],
      { detectKeys: true },
    );
    const key = corpus.entries[0]!.metadata.key;
    expect(key.length).toBeGreaterThan(0);
    expect(key.toLowerCase()).toContain('major');
  });
});

// ── corpusSearch ────────────────────────────────────────────────────────────

describe('corpusSearch', () => {
  function makeSearchCorpus(): Corpus {
    return createCorpus([
      makeEntry('bach1', { title: 'Fugue in C', composer: 'J.S. Bach', key: 'C major', meter: '4/4' }),
      makeEntry('bach2', { title: 'Prelude in D', composer: 'J.S. Bach', key: 'D major', meter: '3/4' }),
      makeEntry('mozart1', { title: 'Sonata K.545', composer: 'W.A. Mozart', key: 'C major', meter: '4/4' }),
      makeEntry('chopin1', { title: 'Nocturne Op.9', composer: 'F. Chopin', key: 'Bb minor', meter: '6/8' }),
    ]);
  }

  it('finds entries by composer (case-insensitive)', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, { composer: 'bach' });
    expect(result.size).toBe(2);
    expect(result.entries.every(e => e.metadata.composer.toLowerCase().includes('bach'))).toBe(true);
  });

  it('finds entries by title', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, { title: 'fugue' });
    expect(result.size).toBe(1);
    expect(result.entries[0]!.id).toBe('bach1');
  });

  it('returns empty corpus when no matches', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, { composer: 'Beethoven' });
    expect(result.size).toBe(0);
  });

  it('empty query returns all entries', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, {});
    expect(result.size).toBe(4);
  });

  it('multiple criteria use AND logic', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, { composer: 'bach', key: 'D' });
    expect(result.size).toBe(1);
    expect(result.entries[0]!.id).toBe('bach2');
  });

  it('searches by key substring', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, { key: 'major' });
    expect(result.size).toBe(3);
  });

  it('returns frozen result', () => {
    const corpus = makeSearchCorpus();
    const result = corpusSearch(corpus, { composer: 'bach' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
  });
});

// ── corpusFilter ────────────────────────────────────────────────────────────

describe('corpusFilter', () => {
  it('filters by predicate returning true for subset', () => {
    const corpus = createCorpus([
      makeEntry('a', { genre: 'Baroque' }),
      makeEntry('b', { genre: 'Classical' }),
      makeEntry('c', { genre: 'Baroque' }),
    ]);
    const result = corpusFilter(corpus, e => e.metadata.genre === 'Baroque');
    expect(result.size).toBe(2);
  });

  it('returns empty corpus when predicate always false', () => {
    const corpus = createCorpus([makeEntry('a'), makeEntry('b')]);
    const result = corpusFilter(corpus, () => false);
    expect(result.size).toBe(0);
  });

  it('returns all entries when predicate always true', () => {
    const corpus = createCorpus([makeEntry('a'), makeEntry('b')]);
    const result = corpusFilter(corpus, () => true);
    expect(result.size).toBe(2);
  });

  it('returns frozen result', () => {
    const corpus = createCorpus([makeEntry('a')]);
    const result = corpusFilter(corpus, () => true);
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ── batchAnalyze ────────────────────────────────────────────────────────────

describe('batchAnalyze', () => {
  it('produces one result per score', () => {
    const corpus = createCorpus([
      makeEntry('a'),
      makeEntry('b'),
      makeEntry('c'),
    ]);
    const results = batchAnalyze(corpus, score => getAllEvents(score).length);
    expect(results).toHaveLength(3);
  });

  it('results in corpus order with correct entry IDs', () => {
    const corpus = createCorpus([
      makeEntry('first'),
      makeEntry('second'),
    ]);
    const results = batchAnalyze(corpus, () => 42);
    expect(results[0]!.entryId).toBe('first');
    expect(results[1]!.entryId).toBe('second');
  });

  it('works with analysis function (e.g., event count)', () => {
    const corpus = createCorpus([
      makeEntry('a', {}, { midis: [60, 62] }),
      makeEntry('b', {}, { midis: [60, 62, 64, 65, 67] }),
    ]);
    const results = batchAnalyze(corpus, score => getAllEvents(score).length);
    expect(results[0]!.result).toBe(2);
    expect(results[1]!.result).toBe(5);
  });

  it('returns frozen result', () => {
    const corpus = createCorpus([makeEntry('a')]);
    const results = batchAnalyze(corpus, () => 1);
    expect(Object.isFrozen(results)).toBe(true);
    expect(Object.isFrozen(results[0]!)).toBe(true);
  });
});

// ── corpusStatistics ────────────────────────────────────────────────────────

describe('corpusStatistics', () => {
  function makeStatsCorpus(eventCounts: number[]): Corpus {
    return createCorpus(
      eventCounts.map((n, i) =>
        makeEntry(`s${i}`, {}, { midis: Array.from({ length: n }, (_, j) => 60 + (j % 12)) }),
      ),
    );
  }

  it('computes correct mean', () => {
    const corpus = makeStatsCorpus([2, 4, 6]);
    const stats = corpusStatistics(corpus, score => getAllEvents(score).length);
    expect(stats.mean).toBe(4);
  });

  it('computes correct standard deviation', () => {
    // values: 2, 4, 6; mean=4; variance = ((4+0+4)/3) = 8/3; stddev = sqrt(8/3)
    const corpus = makeStatsCorpus([2, 4, 6]);
    const stats = corpusStatistics(corpus, score => getAllEvents(score).length);
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(8 / 3), 10);
  });

  it('computes correct min and max', () => {
    const corpus = makeStatsCorpus([1, 5, 3]);
    const stats = corpusStatistics(corpus, score => getAllEvents(score).length);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
  });

  it('computes correct median (odd count)', () => {
    const corpus = makeStatsCorpus([1, 5, 3]);
    const stats = corpusStatistics(corpus, score => getAllEvents(score).length);
    expect(stats.median).toBe(3);
  });

  it('computes correct median (even count)', () => {
    const corpus = makeStatsCorpus([1, 2, 4, 5]);
    const stats = corpusStatistics(corpus, score => getAllEvents(score).length);
    // sorted: 1, 2, 4, 5 → median = (2+4)/2 = 3
    expect(stats.median).toBe(3);
  });

  it('throws RangeError for empty corpus', () => {
    const corpus = createCorpus([]);
    expect(() =>
      corpusStatistics(corpus, () => 0),
    ).toThrow(RangeError);
  });
});

// ── crossWorkSearch ─────────────────────────────────────────────────────────

describe('crossWorkSearch', () => {
  // Two works sharing C-D-E (intervals [2, 2]) at different positions
  function makeCrossCorpus(): Corpus {
    return createCorpus([
      makeEntry('work1', {}, { midis: [60, 62, 64, 65, 67] }),     // C D E F G → intervals [2,2,1,2]
      makeEntry('work2', {}, { midis: [55, 60, 62, 64, 69] }),     // G C D E A → intervals [5,2,2,5]
      makeEntry('work3', {}, { midis: [70, 72, 74, 76, 78] }),     // Bb C D E F# → intervals [2,2,2,2]
    ]);
  }

  it('finds known interval pattern across works (targeted)', () => {
    const corpus = makeCrossCorpus();
    const results = crossWorkSearch(corpus, [2, 2]);
    expect(results).toHaveLength(1);
    expect(results[0]!.intervalPattern).toEqual([2, 2]);
    // Should appear in all three works
    const workIds = new Set(results[0]!.occurrences.map(o => o.entryId));
    expect(workIds.size).toBeGreaterThanOrEqual(2);
  });

  it('returns empty when pattern not in enough works', () => {
    const corpus = makeCrossCorpus();
    // [1,2] only in work1 (E→F→G)
    const results = crossWorkSearch(corpus, [1, 2], { minWorks: 3 });
    // [1,2] appears in work1 only → insufficient
    expect(results).toHaveLength(0);
  });

  it('discovery mode finds shared motives', () => {
    const corpus = makeCrossCorpus();
    const results = crossWorkSearch(corpus, undefined, {
      minWorks: 2,
      minLength: 2,
      maxLength: 3,
    });
    // Should find [2,2] at minimum
    expect(results.length).toBeGreaterThan(0);
    const patterns = results.map(r => r.intervalPattern.join(','));
    expect(patterns).toContain('2,2');
  });

  it('respects minWorks option', () => {
    const corpus = makeCrossCorpus();
    // require pattern in all 3 works
    const strict = crossWorkSearch(corpus, undefined, {
      minWorks: 3,
      minLength: 2,
      maxLength: 3,
    });
    // [2,2] appears in all 3 works
    expect(strict.length).toBeGreaterThan(0);
    for (const match of strict) {
      const workIds = new Set(match.occurrences.map(o => o.entryId));
      expect(workIds.size).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns frozen result', () => {
    const corpus = makeCrossCorpus();
    const results = crossWorkSearch(corpus, [2, 2]);
    expect(Object.isFrozen(results)).toBe(true);
    if (results.length > 0) {
      expect(Object.isFrozen(results[0]!)).toBe(true);
      expect(Object.isFrozen(results[0]!.intervalPattern)).toBe(true);
      expect(Object.isFrozen(results[0]!.occurrences)).toBe(true);
    }
  });
});
