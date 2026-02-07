// ---------------------------------------------------------------------------
// Stratum — Analysis Result Export (JAMS & RomanText)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// JAMS Types
// ---------------------------------------------------------------------------

/** A single observation in a JAMS annotation. */
export interface JamsObservation {
  readonly time: number;
  readonly duration: number;
  readonly value: string;
  readonly confidence: number;
}

/** A JAMS annotation with namespace and data. */
export interface JamsAnnotation {
  readonly namespace: string;
  readonly data: readonly JamsObservation[];
  readonly annotation_metadata?: {
    readonly corpus?: string;
    readonly annotator?: { readonly name?: string };
  };
}

/** A complete JAMS document. */
export interface JamsDocument {
  readonly file_metadata: {
    readonly title?: string;
    readonly duration?: number;
    readonly identifiers?: Readonly<Record<string, string>>;
  };
  readonly annotations: readonly JamsAnnotation[];
  readonly sandbox?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// RomanText Types
// ---------------------------------------------------------------------------

/** A single chord in a RomanText measure. */
export interface RomanTextChord {
  readonly beat?: number;
  readonly roman: string;
}

/** A measure in a RomanText analysis. */
export interface RomanTextMeasure {
  readonly measure: number;
  readonly key?: string;
  readonly chords: readonly RomanTextChord[];
}

/** A complete RomanText analysis. */
export interface RomanTextAnalysis {
  readonly metadata: {
    readonly composer?: string;
    readonly title?: string;
    readonly analyst?: string;
    readonly timeSignature?: string;
  };
  readonly measures: readonly RomanTextMeasure[];
}

// ---------------------------------------------------------------------------
// JAMS Export
// ---------------------------------------------------------------------------

/**
 * Build a JAMS document from annotations and optional metadata.
 *
 * Creates a frozen JAMS-format JSON structure following the JAMS specification.
 * Supported namespaces: chord, beat, segment, key, pitch_class_profile, and custom.
 *
 * @param annotations - Array of JAMS annotations.
 * @param metadata - Optional file-level metadata.
 * @returns Frozen JamsDocument.
 *
 * @example
 * ```ts
 * const doc = toJAMS([{
 *   namespace: 'chord',
 *   data: [{ time: 0, duration: 2, value: 'C:maj', confidence: 1 }],
 * }], { title: 'My Song', duration: 180 });
 * ```
 */
export function toJAMS(
  annotations: readonly JamsAnnotation[],
  metadata?: { title?: string; duration?: number },
): JamsDocument {
  const fileMeta: {
    title?: string;
    duration?: number;
    identifiers?: Readonly<Record<string, string>>;
  } = {};

  if (metadata?.title) fileMeta.title = metadata.title;
  if (metadata?.duration !== undefined) fileMeta.duration = metadata.duration;

  const frozenAnnotations = annotations.map(a =>
    Object.freeze({
      namespace: a.namespace,
      data: Object.freeze(a.data.map(obs => Object.freeze({
        time: obs.time,
        duration: obs.duration,
        value: obs.value,
        confidence: obs.confidence,
      }))),
      ...(a.annotation_metadata ? {
        annotation_metadata: Object.freeze({
          ...(a.annotation_metadata.corpus ? { corpus: a.annotation_metadata.corpus } : {}),
          ...(a.annotation_metadata.annotator ? {
            annotator: Object.freeze({
              ...(a.annotation_metadata.annotator.name ? { name: a.annotation_metadata.annotator.name } : {}),
            }),
          } : {}),
        }),
      } : {}),
    }),
  );

  return Object.freeze({
    file_metadata: Object.freeze(fileMeta),
    annotations: Object.freeze(frozenAnnotations),
  });
}

// ---------------------------------------------------------------------------
// RomanText Export
// ---------------------------------------------------------------------------

/**
 * Serialize a RomanText analysis to `.rntxt` format string.
 *
 * Output format:
 * ```
 * Composer: Bach
 * Title: Prelude in C
 * Analyst: John
 * Time Signature: 4/4
 *
 * m1 C: I
 * m2 V
 * m3 b3 IV b4 V
 * m5 G: I
 * ```
 *
 * @param analysis - RomanText analysis to serialize.
 * @param options - Optional line ending character (default '\n').
 * @returns RomanText string.
 */
export function toRomanText(
  analysis: RomanTextAnalysis,
  options?: { lineEnding?: string },
): string {
  const nl = options?.lineEnding ?? '\n';
  const lines: string[] = [];

  // Header
  if (analysis.metadata.composer) {
    lines.push(`Composer: ${analysis.metadata.composer}`);
  }
  if (analysis.metadata.title) {
    lines.push(`Title: ${analysis.metadata.title}`);
  }
  if (analysis.metadata.analyst) {
    lines.push(`Analyst: ${analysis.metadata.analyst}`);
  }
  if (analysis.metadata.timeSignature) {
    lines.push(`Time Signature: ${analysis.metadata.timeSignature}`);
  }

  if (lines.length > 0) {
    lines.push('');
  }

  // Measures
  for (const measure of analysis.measures) {
    let line = `m${measure.measure}`;

    // Key change
    if (measure.key) {
      line += ` ${measure.key}`;
    }

    // Chords with beat positions
    for (let ci = 0; ci < measure.chords.length; ci++) {
      const chord = measure.chords[ci]!;
      if (chord.beat !== undefined && chord.beat > 1) {
        line += ` b${chord.beat}`;
      }
      line += ` ${chord.roman}`;
    }

    lines.push(line);
  }

  return lines.join(nl) + nl;
}

// ---------------------------------------------------------------------------
// RomanText Import
// ---------------------------------------------------------------------------

/**
 * Parse a `.rntxt` (RomanText) string into a RomanTextAnalysis.
 *
 * Handles:
 * - Header fields: Composer, Title, Analyst, Time Signature
 * - Measure lines: `m1 C: I V`, `m3 b3 IV b4 V`
 * - Key changes: `m5 G: I` (key change to G major at measure 5)
 * - Beat positions: `b2`, `b3`, etc.
 *
 * @param text - RomanText source string.
 * @returns Frozen RomanTextAnalysis.
 *
 * @example
 * ```ts
 * const analysis = fromRomanText('Composer: Bach\n\nm1 C: I\nm2 V\n');
 * ```
 */
export function fromRomanText(text: string): RomanTextAnalysis {
  const lines = text.split(/\r?\n/);

  let composer: string | undefined;
  let title: string | undefined;
  let analyst: string | undefined;
  let timeSignature: string | undefined;

  const measures: RomanTextMeasure[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%')) continue;

    // Header fields
    const headerMatch = trimmed.match(/^(Composer|Title|Analyst|Time Signature):\s*(.*)$/i);
    if (headerMatch) {
      const field = headerMatch[1]!.toLowerCase();
      const value = headerMatch[2]!.trim();
      if (field === 'composer') composer = value;
      else if (field === 'title') title = value;
      else if (field === 'analyst') analyst = value;
      else if (field === 'time signature') timeSignature = value;
      continue;
    }

    // Measure lines: m1 ..., m2 ..., etc.
    const measureMatch = trimmed.match(/^m(\d+)\s*(.*)?$/);
    if (!measureMatch) continue;

    const measureNum = parseInt(measureMatch[1]!, 10);
    let content = (measureMatch[2] ?? '').trim();

    // Check for key change: "G:" or "C#:" or "Bb:" prefix
    let key: string | undefined;
    const keyMatch = content.match(/^([A-Ga-g][#b]?:)\s*/);
    if (keyMatch) {
      key = keyMatch[1]!;
      content = content.substring(keyMatch[0]!.length).trim();
    }

    // Parse chords with beat positions
    const chords: RomanTextChord[] = [];
    if (content) {
      // Split by beat markers: "I b3 IV b4 V" → [{beat:1, roman:'I'}, {beat:3, roman:'IV'}, {beat:4, roman:'V'}]
      const parts = content.split(/\s+/);
      let currentBeat: number | undefined;

      for (let pi = 0; pi < parts.length; pi++) {
        const p = parts[pi]!;
        const beatMatch = p.match(/^b(\d+)$/);
        if (beatMatch) {
          currentBeat = parseInt(beatMatch[1]!, 10);
        } else {
          // Check if this looks like a key change mid-content
          const midKeyMatch = p.match(/^([A-Ga-g][#b]?:)$/);
          if (midKeyMatch) {
            key = midKeyMatch[1]!;
            continue;
          }
          chords.push(Object.freeze({
            ...(currentBeat !== undefined ? { beat: currentBeat } : {}),
            roman: p,
          }));
          currentBeat = undefined;
        }
      }
    }

    measures.push(Object.freeze({
      measure: measureNum,
      ...(key ? { key } : {}),
      chords: Object.freeze(chords),
    }));
  }

  return Object.freeze({
    metadata: Object.freeze({
      ...(composer ? { composer } : {}),
      ...(title ? { title } : {}),
      ...(analyst ? { analyst } : {}),
      ...(timeSignature ? { timeSignature } : {}),
    }),
    measures: Object.freeze(measures),
  });
}
