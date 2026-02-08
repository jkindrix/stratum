// ---------------------------------------------------------------------------
// Stratum — Corpus Tools (batch multi-work analysis)
// ---------------------------------------------------------------------------

import type { Score, NoteEvent } from '../core/types.js';
import { getAllEvents } from '../core/score.js';
import { midiToScore } from '../io/midi.js';
import { musicXmlToScore } from '../io/musicxml.js';
import { kernToScore } from '../io/kern.js';
import { abcToScore } from '../io/abc.js';
import { meiToScore } from '../io/mei.js';
import { scoreFromJSON } from '../io/json.js';
import { detectKey } from './key-detection.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported input format for corpus loading. */
export type CorpusFormat = 'midi' | 'musicxml' | 'kern' | 'abc' | 'mei' | 'json' | 'score';

/** Metadata associated with a corpus entry. */
export interface CorpusMetadata {
  readonly title: string;
  readonly composer: string;
  readonly date: string;
  readonly genre: string;
  readonly instrumentation: string;
  readonly key: string;
  readonly meter: string;
}

/** A single entry in the corpus. */
export interface CorpusEntry {
  readonly id: string;
  readonly score: Score;
  readonly metadata: CorpusMetadata;
}

/** A collection of scored works with metadata. */
export interface Corpus {
  readonly entries: readonly CorpusEntry[];
  readonly size: number;
}

/** Input descriptor for loading a score into a corpus. */
export interface CorpusInput {
  readonly data: Uint8Array | string | Score;
  readonly format: CorpusFormat;
  readonly id?: string;
  readonly metadata?: Partial<Omit<CorpusMetadata, never>>;
}

/** Options for corpus loading. */
export interface LoadCorpusOptions {
  readonly detectKeys?: boolean;
}

/** Query for searching corpus entries by metadata fields. */
export interface CorpusQuery {
  readonly title?: string;
  readonly composer?: string;
  readonly date?: string;
  readonly genre?: string;
  readonly instrumentation?: string;
  readonly key?: string;
  readonly meter?: string;
}

/** Result of a batch analysis for one entry. */
export interface BatchResult<T> {
  readonly entryId: string;
  readonly result: T;
}

/** Descriptive statistics for a numeric feature across a corpus. */
export interface CorpusFeatureStats {
  readonly count: number;
  readonly mean: number;
  readonly stdDev: number;
  readonly min: number;
  readonly max: number;
  readonly median: number;
  readonly values: readonly number[];
}

/** A single occurrence of a pattern in a work. */
export interface CrossWorkOccurrence {
  readonly entryId: string;
  readonly onset: number;
  readonly startPitch: number;
}

/** A cross-work match: an interval pattern and its occurrences. */
export interface CrossWorkMatch {
  readonly intervalPattern: readonly number[];
  readonly occurrences: readonly CrossWorkOccurrence[];
}

/** Options for cross-work pattern search. */
export interface CrossWorkSearchOptions {
  readonly minWorks?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseInput(input: CorpusInput): Score {
  const { data, format } = input;
  switch (format) {
    case 'midi': {
      if (!(data instanceof Uint8Array)) {
        throw new RangeError('MIDI format requires Uint8Array data');
      }
      return midiToScore(data);
    }
    case 'musicxml': {
      if (typeof data !== 'string') {
        throw new RangeError('MusicXML format requires string data');
      }
      return musicXmlToScore(data).score;
    }
    case 'kern': {
      if (typeof data !== 'string') {
        throw new RangeError('Kern format requires string data');
      }
      return kernToScore(data).score;
    }
    case 'abc': {
      if (typeof data !== 'string') {
        throw new RangeError('ABC format requires string data');
      }
      return abcToScore(data).score;
    }
    case 'mei': {
      if (typeof data !== 'string') {
        throw new RangeError('MEI format requires string data');
      }
      return meiToScore(data).score;
    }
    case 'json': {
      if (typeof data !== 'string') {
        throw new RangeError('JSON format requires string data');
      }
      return scoreFromJSON(JSON.parse(data));
    }
    case 'score': {
      if (typeof data === 'string' || data instanceof Uint8Array) {
        throw new RangeError('Score format requires a Score object');
      }
      return data;
    }
    default:
      throw new RangeError(`Unknown corpus format: ${format as string}`);
  }
}

function buildMetadata(
  score: Score,
  input: CorpusInput,
  autoDetectKey: boolean,
): CorpusMetadata {
  // Auto-extract from score
  const title = score.metadata.title || '';
  const composer = score.metadata.composer || '';
  const partNames = score.parts.map(p => p.name).filter(n => n.length > 0);
  const instrumentation = partNames.join(', ');

  // Meter from first time signature
  const ts = score.timeSignatures[0];
  const meter = ts ? `${ts.numerator}/${ts.denominator}` : '';

  // Key detection if requested
  let key = '';
  if (autoDetectKey) {
    const allEvents = getAllEvents(score);
    if (allEvents.length > 0) {
      const result = detectKey(score);
      key = result.best.name;
    }
  }

  const base: CorpusMetadata = {
    title,
    composer,
    date: '',
    genre: '',
    instrumentation,
    key,
    meter,
  };

  // Merge user overrides on top
  if (input.metadata) {
    return Object.freeze({
      title: input.metadata.title ?? base.title,
      composer: input.metadata.composer ?? base.composer,
      date: input.metadata.date ?? base.date,
      genre: input.metadata.genre ?? base.genre,
      instrumentation: input.metadata.instrumentation ?? base.instrumentation,
      key: input.metadata.key ?? base.key,
      meter: input.metadata.meter ?? base.meter,
    });
  }

  return Object.freeze(base);
}

function intervalSequence(events: readonly NoteEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.onset - b.onset || a.pitch.midi - b.pitch.midi);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    intervals.push(curr.pitch.midi - prev.pitch.midi);
  }
  return intervals;
}

function substringMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a corpus from pre-built entries.
 * @throws {RangeError} If duplicate IDs exist.
 */
export function createCorpus(entries: readonly CorpusEntry[]): Corpus {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new RangeError(`Duplicate corpus entry ID: ${entry.id}`);
    }
    ids.add(entry.id);
  }

  return Object.freeze({
    entries: Object.freeze([...entries]),
    size: entries.length,
  });
}

/**
 * Load multiple inputs into a corpus, automatically parsing and extracting metadata.
 * @throws {RangeError} If inputs is empty or format/data mismatch.
 */
export function loadCorpus(
  inputs: readonly CorpusInput[],
  options?: LoadCorpusOptions,
): Corpus {
  if (inputs.length === 0) {
    throw new RangeError('inputs must not be empty');
  }

  const autoDetectKey = options?.detectKeys === true;
  const entries: CorpusEntry[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
    const score = parseInput(input);
    const id = input.id ?? `corpus_${i}`;
    const metadata = buildMetadata(score, input, autoDetectKey);

    entries.push(Object.freeze({ id, score, metadata }));
  }

  return createCorpus(entries);
}

/**
 * Search a corpus by metadata fields (AND logic, case-insensitive substring match).
 * Empty query returns all entries.
 */
export function corpusSearch(corpus: Corpus, query: CorpusQuery): Corpus {
  const fields: Array<{ key: keyof CorpusMetadata; value: string }> = [];
  if (query.title !== undefined) fields.push({ key: 'title', value: query.title });
  if (query.composer !== undefined) fields.push({ key: 'composer', value: query.composer });
  if (query.date !== undefined) fields.push({ key: 'date', value: query.date });
  if (query.genre !== undefined) fields.push({ key: 'genre', value: query.genre });
  if (query.instrumentation !== undefined) fields.push({ key: 'instrumentation', value: query.instrumentation });
  if (query.key !== undefined) fields.push({ key: 'key', value: query.key });
  if (query.meter !== undefined) fields.push({ key: 'meter', value: query.meter });

  if (fields.length === 0) {
    return createCorpus(corpus.entries);
  }

  const filtered = corpus.entries.filter(entry =>
    fields.every(f => substringMatch(entry.metadata[f.key], f.value)),
  );

  return createCorpus(filtered);
}

/**
 * Filter corpus entries by a predicate function.
 */
export function corpusFilter(
  corpus: Corpus,
  predicate: (entry: CorpusEntry) => boolean,
): Corpus {
  const filtered = corpus.entries.filter(predicate);
  return createCorpus(filtered);
}

/**
 * Run an analysis function on every entry and collect results.
 */
export function batchAnalyze<T>(
  corpus: Corpus,
  analysisFn: (score: Score, entry: CorpusEntry) => T,
): readonly BatchResult<T>[] {
  const results: BatchResult<T>[] = corpus.entries.map(entry =>
    Object.freeze({
      entryId: entry.id,
      result: analysisFn(entry.score, entry),
    }),
  );
  return Object.freeze(results);
}

/**
 * Compute descriptive statistics for a numeric feature across the corpus.
 * @throws {RangeError} If corpus is empty.
 */
export function corpusStatistics(
  corpus: Corpus,
  featureFn: (score: Score, entry: CorpusEntry) => number,
): CorpusFeatureStats {
  if (corpus.size === 0) {
    throw new RangeError('Cannot compute statistics on empty corpus');
  }

  const values: number[] = corpus.entries.map(entry =>
    featureFn(entry.score, entry),
  );

  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  const sqDiffSum = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  const stdDev = Math.sqrt(sqDiffSum / count);

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;

  let median: number;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  } else {
    median = sorted[mid] ?? 0;
  }

  return Object.freeze({
    count,
    mean,
    stdDev,
    min,
    max,
    median,
    values: Object.freeze([...values]),
  });
}

/**
 * Search for interval patterns across multiple works.
 *
 * **Targeted mode** (pattern provided): search for that specific interval sequence.
 * **Discovery mode** (pattern omitted): find all shared interval n-grams.
 */
export function crossWorkSearch(
  corpus: Corpus,
  pattern?: readonly number[],
  options?: CrossWorkSearchOptions,
): readonly CrossWorkMatch[] {
  const minWorks = options?.minWorks ?? 2;
  const minLength = options?.minLength ?? 3;
  const maxLength = options?.maxLength ?? 8;

  // Pre-compute interval sequences and events for each entry
  const entryData: Array<{
    entryId: string;
    intervals: number[];
    events: NoteEvent[];
  }> = [];
  for (const entry of corpus.entries) {
    const events = getAllEvents(entry.score);
    const sortedEvents = [...events].sort(
      (a, b) => a.onset - b.onset || a.pitch.midi - b.pitch.midi,
    );
    const intervals = intervalSequence(sortedEvents);
    entryData.push({ entryId: entry.id, intervals, events: sortedEvents });
  }

  if (pattern !== undefined) {
    // Targeted mode: search for a specific pattern
    return Object.freeze(targetedSearch(entryData, pattern, minWorks));
  }

  // Discovery mode: find shared n-grams
  return Object.freeze(discoverySearch(entryData, minWorks, minLength, maxLength));
}

// ---------------------------------------------------------------------------
// crossWorkSearch helpers
// ---------------------------------------------------------------------------

function patternKey(intervals: readonly number[]): string {
  return intervals.join(',');
}

function targetedSearch(
  entryData: Array<{
    entryId: string;
    intervals: number[];
    events: NoteEvent[];
  }>,
  pattern: readonly number[],
  minWorks: number,
): CrossWorkMatch[] {
  const occurrences: CrossWorkOccurrence[] = [];
  const workIds = new Set<string>();

  for (const { entryId, intervals, events } of entryData) {
    for (let i = 0; i <= intervals.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if ((intervals[i + j] ?? 0) !== (pattern[j] ?? 0)) {
          match = false;
          break;
        }
      }
      if (match) {
        const ev = events[i];
        if (ev) {
          occurrences.push(
            Object.freeze({ entryId, onset: ev.onset, startPitch: ev.pitch.midi }),
          );
          workIds.add(entryId);
        }
      }
    }
  }

  if (workIds.size < minWorks) {
    return [];
  }

  return [
    Object.freeze({
      intervalPattern: Object.freeze([...pattern]),
      occurrences: Object.freeze(occurrences),
    }),
  ];
}

function discoverySearch(
  entryData: Array<{
    entryId: string;
    intervals: number[];
    events: NoteEvent[];
  }>,
  minWorks: number,
  minLength: number,
  maxLength: number,
): CrossWorkMatch[] {
  // Group: pattern key → { works: Set, occurrences }
  const patternMap = new Map<
    string,
    { works: Set<string>; occurrences: CrossWorkOccurrence[] }
  >();

  for (const { entryId, intervals, events } of entryData) {
    for (let len = minLength; len <= maxLength; len++) {
      for (let i = 0; i <= intervals.length - len; i++) {
        const ngram = intervals.slice(i, i + len);
        const key = patternKey(ngram);

        let entry = patternMap.get(key);
        if (!entry) {
          entry = { works: new Set(), occurrences: [] };
          patternMap.set(key, entry);
        }

        const ev = events[i];
        if (ev) {
          entry.works.add(entryId);
          entry.occurrences.push(
            Object.freeze({ entryId, onset: ev.onset, startPitch: ev.pitch.midi }),
          );
        }
      }
    }
  }

  // Filter to patterns appearing in >= minWorks distinct works
  const matches: CrossWorkMatch[] = [];
  for (const [key, { works, occurrences }] of patternMap) {
    if (works.size >= minWorks) {
      const intervalPattern = key.split(',').map(Number);
      matches.push(
        Object.freeze({
          intervalPattern: Object.freeze(intervalPattern),
          occurrences: Object.freeze(occurrences),
        }),
      );
    }
  }

  // Sort by number of occurrences descending
  matches.sort((a, b) => b.occurrences.length - a.occurrences.length);

  return matches;
}
