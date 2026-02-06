# stratum-kit: Strategic Enhancement Analysis

## Executive Summary

stratum-kit is complete within its declared scope — but that scope positions it as a mid-tier toolkit in a landscape where Python's music21 dominates research and tonal.js dominates the JS ecosystem for basic theory. The critical insight from this research is:

No JavaScript/TypeScript library comes close to music21's analytical depth. tonal.js handles primitives but stops at chord detection. music21j is explicitly less powerful than its Python parent. There is no JS library that does Neo-Riemannian analysis, voice separation, counterpoint checking, corpus analysis, twelve-tone operations, self-similarity matrices, statistical style analysis, Tonnetz operations, or information-theoretic tension modeling.

stratum already has foundations that none of these JS libraries have — pitch-class sets, Forte catalog, psychoacoustic tension, MIDI I/O, and SVG rendering. With targeted enhancements, it can become the music21 of the JavaScript ecosystem — the definitive research-grade symbolic music analysis toolkit for TypeScript.

---

## Part I: Competitive Landscape Gap Analysis

### What stratum Has That Others Don't (in JS)

| Capability | tonal.js | teoria | music21j | stratum |
|---|---|---|---|---|
| Pitch-class set operations | Binary only | No | Partial | Full (15 ops) |
| Complete Forte catalog | No | No | No | Yes (220) |
| Psychoacoustic tension | No | No | No | Yes (Plomp-Levelt + multi-component) |
| MIDI read/write | No | No | Partial | Yes (full SMF 0/1) |
| SVG rendering | No | No | VexFlow | Yes (chromatic staff + curves) |
| Tuning systems | No | No | No | Yes (8 presets + N-TET) |
| Voice-leading distance | No | No | No | Yes |

### What music21 (Python) Has That stratum Lacks

| Capability | music21 | stratum | Gap Severity |
|---|---|---|---|
| Neo-Riemannian transforms (PLR) | Yes | No | High |
| Tonnetz representation | Yes | No | High |
| MusicXML import/export | Yes | No | High |
| Twelve-tone matrix & serial ops | Yes | No | High |
| Voice separation (polyphonic) | Yes | No | High |
| Counterpoint rule checking | Yes | No | Medium-High |
| Roman numeral analysis (robust) | Excellent | Basic | Medium |
| Key detection algorithms | Yes | No | High |
| Corpus tools & statistical analysis | Extensive | No | High |
| Self-similarity matrix | Via extensions | No | High |
| Information-theoretic surprise/entropy | Via IDyOM | No | Medium-High |
| Figured bass realization | Yes | No | Low |
| Humdrum kern import | Yes | No | Medium |
| Windowed temporal analysis | Yes | No | Medium-High |

### What No JS Library Has at All

These represent blue ocean opportunities — capabilities with zero JS competition:

1. Neo-Riemannian theory (PLR transforms, Tonnetz)
2. Self-similarity matrices and novelty detection
3. Twelve-tone matrix generation and serial analysis
4. Statistical music analysis (Zipf, entropy, Markov chains)
5. Pitch-class set similarity measures
6. DFT on pitch-class distributions (wavescapes)
7. Rank-2 temperaments and MOS scales
8. Scala `.scl`/`.kbm` format support
9. Counterpoint rule checking
10. Voice separation algorithms
11. Graph-based harmonic analysis
12. Algorithmic composition utilities (L-systems, cellular automata, constraint helpers)

---

## Part II: Prioritized Enhancement Recommendations

### Tier 0 — Critical Gaps

Expected by serious users; absence limits adoption.

#### 0.1 MusicXML Import/Export

- **What:** Parse and generate MusicXML 4.0 files — the universal interchange standard supported by 270+ applications (MuseScore, Finale, Sibelius, Dorico)
- **Why:** Without MusicXML, stratum can only consume MIDI, which loses notation details (enharmonic spelling, articulations, dynamics text, slurs, ties as distinct from duration). MusicXML is the sole bridge to notation software. MIDI is the bridge to DAWs. Having both is table-stakes for research use.
- **Complexity:** Moderate-High (large XML schema, many optional elements)
- **Value:** Critical — this is the #1 feature request pattern across all JS music libraries
- **Implementation notes:** Could support a practical subset first (notes, rests, measures, parts, time/key signatures, dynamics, articulations). Full MusicXML 4.0 conformance can follow incrementally. Existing JS parsers (`musicxml-interfaces`, `stringsync/musicxml`) could inform the approach, but a zero-dependency implementation aligns with stratum's philosophy.

#### 0.2 Key Detection

- **What:** Given a passage of music, determine the most likely key (e.g., "G major" or "E minor")
- **Why:** Key context is prerequisite for Roman numeral analysis, functional harmony, chord-scale theory, and tension models. Without key detection, users must supply key manually.
- **Complexity:** Low-Medium
- **Value:** Critical — enables the entire harmonic analysis pipeline
- **Implementation notes:** The Krumhansl-Schmuckler algorithm is the standard approach: compute a 12-element pitch-class distribution from the music, then correlate against major/minor key profiles. The key with highest correlation wins. Temperley's Bayesian refinement and windowed key detection (for modulations) are natural extensions. An alternative is TIV-based key detection (see 1.4 below).

#### 0.3 Enhanced Roman Numeral Analysis

- **What:** Robust chord-in-context analysis with secondary dominants (V/V), Neapolitan (bII), augmented sixth chords, applied chords, and modulation detection
- **Why:** stratum's current Roman numeral analysis is basic. music21's is the gold standard. For any theoretical or pedagogical use, Roman numeral depth matters enormously.
- **Complexity:** Medium
- **Value:** High
- **Implementation notes:** Build on key detection (0.2). Support: quality (major/minor/dim/aug/half-dim), inversion figures, secondary function notation (V7/vi), borrowed chords (bVII in major). Consider supporting RomanText format (`.rntxt`) for import/export — a lightweight text format standardized at ISMIR 2019 and supported by music21.

---

### Tier 1 — High-Value Differentiators

Unique in JS; establishes stratum as research-grade.

#### 1.1 Neo-Riemannian Theory Engine

- **What:** Three fundamental triad transformations — P (Parallel: C major <-> C minor), L (Leading-tone exchange: C major <-> E minor), R (Relative: C major <-> A minor) — plus compound operations (PL, LP, PR, etc.)
- **Why:** Traditional Roman numeral analysis breaks down for chromatic progressions in film scores, Romantic-era music, and modern pop/rock. NRT provides a principled alternative that explains voice-leading parsimony. Zero JS libraries implement this.
- **Complexity:** Low-Medium (the 24-node PLR graph is small; each transform is a simple pitch-class operation)
- **Value:** Very High (analytical and generative)
- **Implementation notes:**
  - Transformation engine: Given two triads, compute which NRT operation(s) connect them. Each operation is algebraically defined on pitch-class sets of size 3.
  - Compound operations: Chain P, L, R into named cycles — hexatonic (PLPLPL), octatonic (PRPRPR), Weitzmann regions.
  - Path-finding: BFS/DFS on the 24-node graph to find shortest NRT path between any two triads.
  - Extension: PLR operations generalized to seventh chords (documented in literature).

#### 1.2 Tonnetz Representation & Visualization

- **What:** A toroidal lattice where pitch classes are arranged by fifths (horizontal), major thirds (one diagonal), minor thirds (other diagonal). Triads are triangles; NRT operations are geometric flips.
- **Why:** Distances on the Tonnetz correlate with perceived harmonic relatedness. Enables geometric and graph-based algorithms on harmony. Stunning visualization that communicates harmonic motion intuitively.
- **Complexity:** Medium (data structure is straightforward; visualization is the harder part)
- **Value:** Very High
- **Implementation notes:**
  - Data structure: 12-node graph with three edge types (fifth: +7, major third: +4, minor third: +3, all mod 12)
  - Chord mapping: triangles (3 adjacent nodes). Major = downward-pointing, minor = upward-pointing.
  - Trajectory tracking: Plot chord progression as a path; compute path length (total harmonic distance), convex hull area (harmonic range), centroid drift.
  - SVG visualization: Render the lattice with highlighted chord triangles and animated paths. TonnetzViz (existing JS tool) demonstrates feasibility.

#### 1.3 Twelve-Tone Matrix & Serial Operations

- **What:** Given a 12-tone row, generate all 48 forms (12 P x 4 operations: Prime, Inversion, Retrograde, Retrograde-Inversion) organized in a 12x12 matrix. Plus: combinatoriality detection, invariance analysis, all-interval series search, rotation, multiplicative operations (M5, M7).
- **Why:** Essential for analyzing Schoenberg, Webern, Berg, Boulez, Babbitt, and all serial/post-serial music. Also used in advanced jazz and contemporary composition. Zero JS implementations exist.
- **Complexity:** Low (matrix generation is simple modular arithmetic)
- **Value:** High
- **Implementation notes:**

  Given `P0 = [p0, p1, ..., p11]`:

  ```
  I0[i] = (2*P0[0] - P0[i]) mod 12
  matrix[i][j] = (P0[j] - P0[0] + I0[i]) mod 12
  ```

  Read: `P_n` = row n L->R, `R_n` = row n R->L, `I_n` = col n T->B, `RI_n` = col n B->T

  - Hexachordal combinatoriality: check if first hexachord of P0 union first hexachord of I_n = aggregate
  - All-combinatorial hexachord classification (Babbitt's 6 types)
  - Set-class multiplication (Boulez): given sets A and B, compute `{(a+b) mod 12 : a in A, b in B}`

#### 1.4 Tonal Interval Vectors (TIV) via DFT

- **What:** Project pitch-class distributions into a 6-dimensional complex space using the Discrete Fourier Transform. The resulting vectors encode intervallic content; Euclidean distance captures perceived harmonic similarity.
- **Why:** Computationally efficient, perceptually grounded, and unifies chord similarity, key distance, and consonance measurement in one framework. Enables DFT coefficient analysis: each coefficient measures a specific musical quality (chromaticity, diadicity, triadicity, octatonicity, diatonicity, whole-tone quality).
- **Complexity:** Medium (requires DFT implementation, but only 12-point)
- **Value:** Very High
- **Implementation notes:**

  ```
  TIV(chroma) = DFT(chroma_vector)[1:6]  // 6 complex coefficients
  distance(A, B) = ||TIV(A) - TIV(B)||_2
  consonance(chord) = ||TIV(chord)||  // magnitude correlates with consonance
  ```

  - Key detection: precompute TIVs for all 24 major/minor keys, find nearest
  - Tension profile: TIV distance between each chord and the current key TIV
  - This could enhance or replace the existing roughness-based tension with a complementary perceptual model

#### 1.5 Self-Similarity Matrix & Novelty Detection

- **What:** Compute pairwise similarity between all time segments of a piece, producing a matrix whose block-diagonal structure reveals repeated sections and whose novelty function (Foote's checkerboard kernel) identifies structural boundaries.
- **Why:** Foundation for automated form analysis — identifying verse/chorus/bridge, sonata form sections, rondo returns, etc. Works on any feature representation.
- **Complexity:** Medium
- **Value:** Very High
- **Implementation notes:**
  - Segment piece into windows (1 beat or 1 measure), extract feature vectors (chroma, rhythm, pitch histogram)
  - Compute cosine similarity between all pairs -> NxN matrix
  - Novelty function: slide checkerboard kernel along diagonal; peaks = structural boundaries
  - Multi-scale analysis: different kernel sizes detect different granularity (phrase vs. section)
  - SVG visualization: render as heatmap

#### 1.6 Voice Separation

- **What:** Given polyphonic MIDI (a "note soup" of overlapping events), separate into individual melodic voices/streams.
- **Why:** Essential preprocessing for voice-leading analysis, counterpoint checking, and melodic analysis of keyboard/ensemble music. Most MIDI data lacks explicit voice assignments.
- **Complexity:** High
- **Value:** Very High (enables many downstream analyses)
- **Implementation notes:** Auditory streaming principles (Bregman):
  - Proximity: notes closer in pitch -> same stream
  - Continuity: streams prefer stepwise motion
  - Temporal proximity: notes closer in time -> more likely connected
  - Register consistency: streams stay within a register band
  - Algorithm: for each note, predict which existing voice it belongs to (or start new voice) based on weighted pitch distance + time gap + direction continuity

#### 1.7 Pitch-Class Set Similarity Measures

- **What:** Multiple functions for comparing set-classes: IcVSIM (interval-class vector similarity), ANGLE (vector angle), cosine similarity on harmonic profiles, plus Earth Mover's Distance for chord/melody comparison.
- **Why:** Goes beyond binary equality to measure "how similar" two chords or sets are. Essential for post-tonal analysis and computational style comparison.
- **Complexity:** Low
- **Value:** High
- **Implementation notes:** stratum already has interval vectors and PCS. Adding similarity is incremental:
  - IcVSIM: correlation coefficient between two interval-class vectors
  - ANGLE: angle between two ICVs treated as 6D vectors
  - EMD: treat chords as distributions over pitch-classes; compute optimal transport cost

---

### Tier 2 — Strong Differentiators

Builds analytical depth.

#### 2.1 Statistical Analysis Module

- **What:** Pitch/interval/duration/chord distributions, Shannon entropy, Zipf's law fitting, and Markov chain analysis of chord progressions.
- **Why:** Forms the backbone of corpus-level style analysis and computational musicology. Enables quantitative comparison across pieces, composers, and periods.
- **Complexity:** Low-Medium
- **Value:** High
- **Implementation notes:**
  - Distribution extraction: pitch-class histogram, interval histogram, duration histogram, chord-type frequency
  - Shannon entropy: `H = -sum(p_i * log2(p_i))` over pitch/rhythm/chord distributions
  - Zipf exponent: fit log-log rank-frequency plot, measure slope
  - Markov chains: build first-order and second-order transition probability matrices from chord sequences; generate new sequences from trained models
  - Feature vector: combine distributions into a style fingerprint for comparison

#### 2.2 Counterpoint Rule Checking

- **What:** Evaluate two-voice passages against Fuxian species counterpoint rules, producing a list of violations with severity.
- **Why:** Provides objective evaluation of contrapuntal writing. Serves as a constraint system for algorithmic composition. Pedagogically valuable.
- **Complexity:** Medium
- **Value:** High (analytical and generative)
- **Implementation notes:** Rules for first species (1:1):
  - Forbidden: parallel perfect consonances (5ths, 8ves), direct/hidden 5ths and 8ves
  - Required: consonant intervals, contrary/oblique motion preference
  - Prohibited: voice crossing, voice overlap
  - Extension: second through fifth species add passing tones, suspensions, cambiata

#### 2.3 Harmonic Network / Chord Transition Graphs

- **What:** Model chord progressions as directed weighted graphs. Nodes = chords, edges = transitions weighted by frequency. Apply network metrics (PageRank, betweenness centrality, community detection).
- **Why:** Reveals the "grammar" of a musical style empirically. Community detection identifies functional groups. Comparison across corpora reveals style differences quantitatively.
- **Complexity:** Medium
- **Value:** High
- **Implementation notes:**
  - Graph construction from a chord sequence
  - Transition probability matrix (overlaps with Markov chains in 2.1)
  - Network metrics: degree centrality, PageRank, betweenness
  - Cycle detection for common progressions (ii-V-I, I-vi-IV-V)
  - SVG visualization: force-directed graph layout

#### 2.4 Scala Format Support (`.scl`/`.kbm`) & Extended Microtonality

- **What:** Read/write Scala tuning files (4,000+ scales in the archive), rank-2 temperament calculation, MOS (Moment of Symmetry) scale generation, monzo arithmetic.
- **Why:** stratum already has tuning systems — this makes it the definitive JS toolkit for xenharmonic work. The Scala archive is the world's largest collection of tuning data.
- **Complexity:** Low-Medium (`.scl`/`.kbm` are simple text formats; rank-2 math is moderate)
- **Value:** High (unique in JS)
- **Implementation notes:**
  - `.scl` parser: description line, note count, one line per degree (ratios like `3/2` or cent values like `701.955`)
  - `.kbm` parser: MIDI key mapping (range, middle note, reference frequency, formal octave)
  - Rank-2 temperament: given period (e.g., 1200c) and generator (e.g., 696.6c), compute MOS scales at each scale size
  - Monzo arithmetic: represent intervals as prime exponent vectors `[e2, e3, e5, ...]` with addition/subtraction

#### 2.5 Chord-Scale Theory

- **What:** Map chord types to compatible scales, classify scale tones as chord tones / available tensions / avoid notes, and analyze melodies against chord-scale context.
- **Why:** Bridges harmony and melody. Central to jazz pedagogy (Berklee, Russell's Lydian Chromatic Concept). Enables computational analysis of melodic "correctness" over harmony.
- **Complexity:** Medium
- **Value:** High
- **Implementation notes:**
  - Database: `Cmaj7 -> {Ionian, Lydian}`; `Cm7 -> {Dorian, Aeolian}`; `C7 -> {Mixolydian, Lydian Dominant, Altered, ...}`
  - Tone classification: for each scale degree over a chord, label as chord tone, tension, or avoid note
  - Melody analysis: classify each melodic note against underlying chord-scale

#### 2.6 Lerdahl Tonal Pitch Space (TPS) Tension Model

- **What:** Multi-level tension model measuring: pitch-space distance (hierarchical chord-to-key distance), surface dissonance (non-chord tones), and attraction (tendency of pitches to resolve).
- **Why:** The most theoretically rigorous tension model in music theory, grounded in cognitive science. Complements stratum's existing Plomp-Levelt roughness model with a tonal-hierarchy-based approach.
- **Complexity:** High
- **Value:** Very High
- **Implementation notes:**
  - Basic space: 5 levels (chromatic -> diatonic -> triadic -> fifth -> root), each a subset of the previous
  - Distance: count differing elements between two chords' basic spaces
  - Attraction: `a(p1->p2) = (stability(p2) / stability(p1)) * (1 / distance(p1,p2)^2)`
  - Requires key context (depends on 0.2)

#### 2.7 Spiral Array Tension (Chew/Herremans)

- **What:** Three geometric tension metrics computed in Chew's 3D Spiral Array: cloud diameter (dissonance), cloud momentum (harmonic change rate), tensile strain (distance from key).
- **Why:** More computationally tractable than full Lerdahl TPS while capturing similar perceptual dimensions. Used in MorpheuS for tension-aware music generation.
- **Complexity:** Medium
- **Value:** High
- **Implementation notes:**
  - Map each pitch class to a 3D helix point: `P(k) = (r*sin(k*pi/2), r*cos(k*pi/2), k*h)`
  - Center of Effect for chords: weighted sum of constituent pitch positions
  - Three metrics are simple geometric calculations on these 3D points

---

### Tier 3 — Advanced Capabilities

Establishes research leadership.

#### 3.1 Repetition Pattern Discovery (SIA/SIATEC)

- **What:** Discover all maximal translatable patterns in a point-set representation of music (onset, pitch). Finds motives, themes, and their transposed/shifted recurrences.
- **Why:** Foundational for automated motivic analysis. Works natively on polyphonic music. Compression ratio measures structural repetitiveness.
- **Complexity:** High (O(n^2 log n) for SIA, O(n^3) for SIATEC)
- **Value:** High
- **Implementation notes:** Represent each note as point `(onset, MIDI_pitch)`. For every pair, compute translation vector. Group by shared vector -> maximal translatable patterns.

#### 3.2 GTTM-Inspired Metrical Analysis

- **What:** Implement preference rules for metrical structure (strong beats align with onsets, long notes, harmonic changes, bass events) and grouping structure (boundaries at rests, register changes, dynamic changes).
- **Why:** GTTM is the most comprehensive formal theory of how listeners parse musical structure. Even a partial implementation (preference rules without full tree construction) significantly enhances metrical analysis beyond simple beat-strength lookup.
- **Complexity:** High (full GTTM) / Medium (preference rules only)
- **Value:** High
- **Implementation notes:** Start with Metrical Preference Rules (MPRs) and Grouping Preference Rules (GPRs) as heuristic boundary detectors. Full tree construction can follow.

#### 3.3 Information-Theoretic Surprise & Entropy Curves

- **What:** Variable-order Markov model that outputs per-note information content (surprise) and entropy (uncertainty) curves, inspired by IDyOM.
- **Why:** Extensively validated against neural data (EEG, fMRI). Provides note-by-note quantification of musical expectation that predicts listener responses.
- **Complexity:** High
- **Value:** High
- **Implementation notes:**
  - Multiple viewpoints: pitch, interval, contour, scale degree, duration
  - PPM (Prediction by Partial Matching) for adaptive context length
  - IC per note: `-log2(P(note|context))`
  - Entropy: `-sum(P(n|C) * log2(P(n|C)))`
  - Short-term (piece-specific) + long-term (corpus-trained) model combination

#### 3.4 Algorithmic Composition Utilities

- **What:** Markov chain generators, L-system music generation, elementary cellular automata, Xenakis sieve construction, constraint helpers.
- **Why:** Composition tools drive library adoption among creators. Every feature built for analysis has a compositional dual.
- **Complexity:** Low-Medium per feature
- **Value:** Medium-High
- **Implementation notes:**
  - Markov generator: train on chord sequences, generate new progressions
  - L-systems: context-free string rewriting with pitch/rhythm mappings
  - Cellular automata: 1D elementary automata (Rule 30, Rule 110) mapped to pitch/rhythm grids
  - Sieve theory: Xenakis's residual class formulas for constructing pitch/duration sequences
  - Constraint helpers: parallel fifths/octaves check, voice-crossing detection, range constraint

#### 3.5 Extended Visualizations

- **What:** Tonnetz interactive SVG, circle of fifths, interval-class vector radar charts, chord transition graph layouts, self-similarity matrix heatmaps, pitch-class distribution bar charts.
- **Why:** Visualization communicates analysis results intuitively. ICV radar charts have no existing implementations anywhere — a genuine novelty.
- **Complexity:** Medium per visualization
- **Value:** High (visualization drives adoption)

---

### Tier 4 — Format & Interoperability

Broadens ecosystem reach.

#### 4.1 Humdrum `**kern` Import

- **What:** Parse the `**kern` symbolic music format used extensively in computational musicology. Large corpus available.
- **Complexity:** Moderate (text-based, column-oriented)
- **Value:** High for research users

#### 4.2 ABC Notation Import

- **What:** Parse ABC notation — simple text-based format popular in folk/traditional music.
- **Complexity:** Low (simple grammar)
- **Value:** Moderate (easy input format)

#### 4.3 JAMS Export

- **What:** Export analysis results in JSON Annotated Music Specification format — the standard in MIR research.
- **Complexity:** Low (JSON format)
- **Value:** High for research reproducibility

#### 4.4 RomanText Import/Export

- **What:** Read and write `.rntxt` format for Roman numeral analyses (standardized at ISMIR 2019, supported by music21).
- **Complexity:** Low (line-oriented text)
- **Value:** High for harmonic analysis workflows

---

## Part III: Recommended Roadmap

### Phase 1 — Foundation

Fills critical gaps.

| # | Feature | Complexity | Unlocks |
|---|---|---|---|
| 0.2 | Key detection | Low-Med | Roman numerals, TPS, chord-scale |
| 0.3 | Enhanced Roman numeral analysis | Medium | Functional harmony pipeline |
| 1.7 | Pitch-class set similarity | Low | Post-tonal comparison |
| 1.3 | Twelve-tone matrix & serial ops | Low | Post-tonal analysis/composition |
| 2.4 | Scala `.scl`/`.kbm` support | Low-Med | 4,000+ tunings, xenharmonic community |

### Phase 2 — Differentiation

Unique in JS ecosystem.

| # | Feature | Complexity | Unlocks |
|---|---|---|---|
| 1.1 | Neo-Riemannian engine | Low-Med | Chromatic analysis, film score analysis |
| 1.2 | Tonnetz representation | Medium | Geometric harmony, visualization |
| 1.4 | Tonal Interval Vectors (DFT) | Medium | Unified similarity/tension/key framework |
| 1.5 | Self-similarity matrix + novelty | Medium | Form analysis |
| 2.1 | Statistical analysis module | Low-Med | Style comparison, corpus analysis |
| 2.5 | Chord-scale theory | Medium | Jazz analysis, melody analysis |

### Phase 3 — Research-Grade

Matches music21 depth.

| # | Feature | Complexity | Unlocks |
|---|---|---|---|
| 0.1 | MusicXML import/export | Mod-High | Notation software interop |
| 1.6 | Voice separation | High | Counterpoint, per-voice analysis |
| 2.2 | Counterpoint rule checking | Medium | Pedagogical tools, composition constraints |
| 2.3 | Harmonic network graphs | Medium | Corpus-level harmonic grammar |
| 2.6 | Lerdahl TPS tension | High | Cognitive tension model |
| 2.7 | Spiral Array tension | Medium | Geometric tension model |

### Phase 4 — Leadership

Beyond music21.

| # | Feature | Complexity | Unlocks |
|---|---|---|---|
| 3.1 | SIA/SIATEC pattern discovery | High | Automated motivic analysis |
| 3.2 | GTTM-inspired metrical analysis | Med-High | Hierarchical structure |
| 3.3 | Information-theoretic surprise | High | Expectation modeling |
| 3.4 | Algorithmic composition utilities | Low-Med | Creator adoption |
| 3.5 | Extended visualizations | Medium | Communication, adoption |
| 4.1-4.4 | Format support (kern, ABC, JAMS, RomanText) | Low-Med | Research ecosystem |

---

## Part IV: The Strategic Thesis

stratum-kit currently occupies a unique position: it has deeper analytical capability than any JS library (pitch-class sets, psychoacoustic tension, MIDI I/O, SVG rendering) but lacks the breadth to compete with music21 for serious research.

The path from "complete analysis toolkit" to "the definitive TypeScript music analysis platform" requires:

1. Fill critical gaps (key detection, MusicXML) that prevent adoption by researchers who need real-world music input
2. Claim blue ocean territory (Neo-Riemannian, Tonnetz, twelve-tone, DFT, self-similarity) where zero JS competition exists
3. Build statistical depth (Markov chains, entropy, Zipf, distributions) that enables corpus-level musicology
4. Add generative duals for every analytical feature — composers and creative coders are the largest potential user base

The zero-dependency philosophy is a major strategic advantage: no supply chain risk, no version conflicts, total tree-shakeability. Every new module should maintain this discipline.

The opportunity is clear: become music21 for JavaScript — but with modern TypeScript, zero dependencies, and built-in visualization.
