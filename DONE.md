# Definition of Done — Stratum

**What this document is:** An exhaustive checklist defining what "feature-complete and fully finished" means for this library. Every box must be checked before the project ships as complete.

**What this library is:** A zero-dependency TypeScript music analysis toolkit — the definitive platform for computational music theory, psychoacoustic analysis, and symbolic music information retrieval in the JavaScript ecosystem.

**What this library is NOT:** A DAW, audio engine, notation editor GUI, real-time performance tool, or synthesis framework. Those are applications that would _consume_ this library.

**Versioning:**
- **v1.0** — Computable analytical core (COMPLETE)
- **v2.0** — Research-grade analysis with format interop
- **v3.0** — Feature-complete platform

---

## Scope Boundary

### In scope

- Pitch representation, naming, frequency conversion
- Pitch-class set theory (Forte catalog, transformations, similarity, serial operations)
- Interval analysis
- Voice-leading computation (geometric, parsimonious, Neo-Riemannian)
- Metric hierarchy, beat strength, rhythmic complexity
- Syncopation and groove quantification
- Pattern and motive detection (including SIA/SIATEC)
- Psychoacoustic roughness (Plomp-Levelt)
- Multi-component tension curves (roughness, metric, registral, density)
- Tonal tension models (Lerdahl TPS, Spiral Array, TIV-based)
- Information-theoretic expectation (surprise, entropy)
- MIDI file I/O (Standard MIDI File format)
- MusicXML import/export
- Humdrum \*\*kern import
- ABC notation import
- Scala .scl/.kbm tuning file I/O
- JAMS and RomanText export
- JSON serialization
- Chromatic staff SVG rendering (proportional/piano-roll)
- Tonnetz, circle-of-fifths, radar chart, heatmap, and graph SVG rendering
- Score data model (events, parts, time signatures, tempos)
- Tuning systems (N-TET, just intonation, meantone, rank-2 temperaments, MOS scales)
- Scale/mode/chord cataloging and identification
- Chord-scale theory
- Key detection
- Harmonic analysis (Roman numerals, functional harmony, Neo-Riemannian)
- Melodic analysis (contour, range, intervals, step-leap ratio)
- Structural analysis (self-similarity, novelty detection, form segmentation)
- Post-tonal analysis (twelve-tone matrix, serial operations, set multiplication)
- Statistical analysis (distributions, entropy, Zipf, Markov chains)
- Voice separation
- Counterpoint rule checking
- Graph-based harmonic analysis (transition graphs, network metrics)
- Algorithmic composition utilities (Markov generators, L-systems, cellular automata, sieves, stochastic distributions)
- Automatic pitch spelling (MIDI note → correct enharmonic in key context)
- Corpus tools (batch loading, cross-work search, metadata querying)
- Earth Mover's Distance for melodic and chordal similarity
- Cent/ratio/EDO step conversion utilities
- Temperament mapping and val computation
- MEI (Music Encoding Initiative) import
- LilyPond export
- Web MIDI API integration (browser environments)
- MPE (MIDI Polyphonic Expression) awareness
- OSC (Open Sound Control) output for real-time analysis streaming
- MIDI 2.0 property exchange awareness
- Standardized evaluation metrics (mir_eval-style accuracy scoring)
- Figured bass realization
- Klumpenhouwer networks and generalized interval systems (GIS)
- Just intonation lattice visualization
- Wavescape visualization (DFT-based hierarchical)
- Form/structure diagrams
- Pitch-space plots (various geometries)

### Out of scope (belongs to applications built on this library)

- GUI / interactive editor / keyboard shortcuts
- Audio playback or synthesis (Spectral Layer / ADSR / waveforms)
- Real-time performance or latency-sensitive operations
- Social coupling / multi-agent coordination simulation
- Neural oscillator modeling (COHERE equations)
- `.stratum` ZIP container format
- Accessibility modes (high contrast, large print)
- Cultural coupling profiles (Javanese gamelan parameters, etc.)
- Affect/emotion derivation from coupling dynamics
- Traditional (five-line staff) notation rendering
- Audio-domain analysis (FFT, spectrograms, onset detection from audio)
- Machine learning model training or inference

---

## 1. Core Data Model

### 1.1 Types and Interfaces

- [x] `Pitch` — midi, pitchClass, octave, centsDeviation (microtonal support)
- [x] `NoteEvent` — id, pitch, onset, duration, velocity, voice, articulation
- [x] `TimeSignature` — numerator, denominator, atTick
- [x] `TempoMark` — bpm, atTick
- [x] `Part` — id, name, midiProgram, midiChannel, events
- [x] `ScoreSettings` — ticksPerQuarter, tuningHz, tuningSystem
- [x] `Score` — metadata, settings, parts, timeSignatures, tempoChanges, keyCenters
- [x] `KeyCenter` — tonic (pitch class), mode/scale reference, atTick
- [x] `Articulation` enum or union — staccato, tenuto, accent, marcato, legato, fermata
- [x] `DynamicMarking` — symbolic (pp, p, mp, mf, f, ff) and/or velocity mapping

### 1.2 Score Construction and Query

- [x] `createScore(options?)` — factory with sensible defaults
- [x] `addPart(score, options)` — add a named part
- [x] `addNote(score, part, options)` — add a note event with full validation
- [x] `removePart(score, partId)` — remove a part by ID
- [x] `removeNote(part, noteId)` — remove a note by ID
- [x] `getAllEvents(score)` — all events sorted by onset
- [x] `getEventsInRange(score, startTick, endTick)` — events within a tick range
- [x] `getEventsAtTick(score, tick)` — events sounding at a specific tick
- [x] `tickToSeconds(score, tick)` — converts ticks to seconds respecting tempo changes
- [x] `secondsToTick(score, seconds)` — inverse of tickToSeconds
- [x] `getScoreDuration(score)` — total duration in ticks and seconds
- [x] `cloneScore(score)` — deep copy
- [x] `mergeScores(scores[])` — combine multiple scores

### 1.3 Input Validation

- [x] MIDI note values validated: 0-127 (throw on out-of-range)
- [x] Velocity validated: 0-127
- [x] Duration validated: > 0
- [x] Onset validated: >= 0
- [x] Pitch class validated: 0-11 after normalization
- [x] Time signature denominator validated: power of 2
- [x] Tempo validated: > 0
- [x] Ticks per quarter validated: > 0
- [x] Tuning Hz validated: > 0

---

## 2. Pitch Module

### 2.1 Pitch Fundamentals

- [x] `normalizePc(pc)` — any integer to 0-11
- [x] `pitchFromMidi(midi)` — MIDI note to Pitch object (with validation)
- [x] `pitchFromPcOctave(pc, octave)` — pitch class + octave to Pitch (with validation)
- [x] `pitchToFrequency(pitch, tuningHz?)` — frequency in Hz (12-TET, centsDeviation-aware)
- [x] `frequencyToPitch(freq, tuningHz?)` — nearest MIDI pitch from frequency
- [x] `pitchClassName(pc)` — sharp name (C, C#, D, ...)
- [x] `pitchClassFlatName(pc)` — flat name (C, Db, D, ...)
- [x] `pitchName(pitch)` — full name with octave (C4, F#5)
- [x] `parsePitchName(name)` — string to Pitch (C4, Bb3, F#5)
- [x] `spellPitch(midiNote, key?)` — automatic pitch spelling: select correct enharmonic name based on key context (e.g., MIDI 61 → C# in A major, Db in Ab major)
- [x] `spellPitchSequence(midiNotes, key?)` — spell a melody with minimal accidentals and context-aware enharmonic selection
- [ ] Support enharmonic preference rules: diatonic spelling, minimal accidentals, directional consistency

### 2.2 Intervals

- [x] `directedInterval(from, to)` — ascending interval 0-11
- [x] `intervalClass(a, b)` — shortest distance 0-6
- [x] `intervalClassName(ic)` — human-readable name
- [x] `semitoneDist(from, to)` — signed MIDI distance

### 2.3 Pitch-Class Sets

- [x] `PitchClassSet` class with immutable sorted members
- [x] `.transpose(n)` — transposition by n semitones
- [x] `.invert()` — inversion around 0 (12 - pc)
- [x] `.complement()` — all pitch classes not in set
- [x] `.normalForm()` — most compact cyclic ordering
- [x] `.primeForm()` — canonical form (compares with inversion)
- [x] `.intervalVector()` — 6-element IC count
- [x] `.intervalStructure()` — gaps between adjacent members
- [x] `.forteName()` — Forte catalog lookup
- [x] `.equals(other)` — structural equality
- [x] `.union(other)` — set union
- [x] `.intersection(other)` — set intersection
- [x] `.difference(other)` — set difference (in this but not other)
- [x] `.symmetricDifference(other)` — in one but not both
- [x] `.isSubsetOf(other)` — subset test
- [x] `.isSupersetOf(other)` — superset test
- [x] `.toString()` — string representation {0,4,7}
- [x] `.toNoteNames()` — human-readable {C, E, G}

### 2.4 Pitch-Class Set Similarity

- [x] `icvsim(a, b)` — interval-class vector similarity (correlation coefficient between ICVs)
- [x] `angleSimilarity(a, b)` — angle between ICVs as 6D vectors
- [x] `pcSetCosine(a, b)` — cosine similarity between pitch-class distributions
- [x] `zRelation(a, b)` — detect Z-related sets (same ICV, different prime form)
- [x] `earthMoversDistance(a, b)` — Earth Mover's Distance between pitch-class distributions (optimal transport cost on the chroma circle)
- [ ] Support configurable ground distance (circular semitone distance on pitch-class ring)

### 2.5 Forte Catalog

- [x] All 6 dyads (interval classes 1-6)
- [x] All 12 trichords (3-1 through 3-12)
- [x] All 29 tetrachords (4-1 through 4-29)
- [x] All 38 pentachords (5-1 through 5-38)
- [x] All 50 hexachords (6-1 through 6-50)
- [x] All 38 heptachords (7-1 through 7-38)
- [x] All 29 octachords (8-1 through 8-29)
- [x] All 12 nonachords (9-1 through 9-12)
- [x] All 6 decachords (10-1 through 10-6)
- [x] Total: 220 set classes (plus 0-1, 1-1, 11-1, 12-1 trivial cases)
- [x] Reverse lookup: Forte name to prime form
- [x] Catalog includes interval vectors for each entry

### 2.6 Voice Leading

- [x] `voiceLeadingDistance(from, to)` — minimum total IC movement
- [x] `smoothestVoiceLeading(from, to)` — optimal pitch assignment pairs
- [x] Document greedy approximation for n > 8 in JSDoc and README
- [x] Throw descriptive error for mismatched set sizes
- [x] Handle empty sets gracefully (distance = 0)
- [x] Handle single-element sets

#### 2.6.1 Geometric Voice Leading (Tymoczko)

- [x] `voiceLeadingVector(from, to)` — displacement vector for each voice in optimal assignment
- [x] `geometricDistance(from, to, metric?)` — voice-leading distance with configurable metric (L1/L2/Linf)
- [x] `OPTIC equivalences` — quotient operations for octave, permutation, transposition, inversion, cardinality
- [x] Optimal voice leading via Hungarian algorithm for O(n³) performance

#### 2.6.2 Parsimonious Voice Leading

- [x] `parsimonyScore(from, to)` — total semitone displacement of smoothest voice leading
- [x] `commonToneCount(from, to)` — number of shared pitch classes
- [x] `isParsimoniousConnection(from, to, threshold?)` — boolean with configurable max displacement (default 2)

### 2.7 Scales, Modes, and Chords

- [x] `Scale` type — name, pitch-class set, interval pattern
- [x] Built-in scale catalog:
  - [x] Major (Ionian) and all 7 diatonic modes
  - [x] Harmonic minor and its modes
  - [x] Melodic minor (ascending) and its modes
  - [x] Pentatonic major and minor
  - [x] Blues scale
  - [x] Whole-tone scale
  - [x] Octatonic (diminished) scales (half-whole, whole-half)
  - [x] Chromatic scale
- [x] `scaleFromPcs(pcs)` — identify scale name from pitch-class set
- [x] `scaleFromIntervals(intervals)` — build scale from interval pattern
- [x] `modeRotation(scale, degree)` — rotate to get mode
- [x] `Chord` type — root, quality, pitch-class set, interval structure
- [x] Built-in chord catalog:
  - [x] Triads: major, minor, diminished, augmented
  - [x] Seventh chords: dominant 7, major 7, minor 7, half-diminished, diminished 7, minor-major 7, augmented-major 7
  - [x] Extended: 9th, 11th, 13th variants
  - [x] Suspended: sus2, sus4
  - [x] Added-tone: add9, add11, 6, 6/9
  - [x] Power chord (root + fifth)
- [x] `chordFromPcs(pcs, root?)` — identify chord from pitch classes
- [x] `chordFromName(name)` — build chord from name string (e.g., "Cmaj7")
- [x] `chordFromIntervals(root, intervals)` — build chord from root + intervals

### 2.8 Tuning Systems

- [x] `TuningSystem` interface — name, pitchCount, frequencyAt(step, octave)
- [x] `equalTemperament(divisions)` — generic N-TET constructor
- [x] Built-in tuning presets:
  - [x] 12-TET (standard, default)
  - [x] 19-TET
  - [x] 24-TET (quarter-tone)
  - [x] 31-TET
  - [x] 53-TET
  - [x] Pythagorean tuning
  - [x] 5-limit just intonation
  - [x] 7-limit just intonation
  - [x] Quarter-comma meantone
- [x] `centsDeviation(tuning, step)` — deviation from 12-TET in cents
- [x] `frequencyFromTuning(tuning, step, octave, refHz?)` — frequency lookup
- [x] `nearestStep(tuning, frequencyHz)` — snap frequency to nearest tuning step
- [x] `centsBetween(freqA, freqB)` — interval size in cents between two frequencies
- [x] `centsToRatio(cents)` — convert cents to frequency ratio
- [x] `ratioToCents(ratio)` — convert frequency ratio to cents
- [x] `edoStepToCents(step, divisions)` — convert EDO step number to cents (e.g., step 7 of 12-EDO → 700 cents)
- [x] `centsToEdoStep(cents, divisions)` — nearest EDO step for a given cent value
- [x] `ratioToEdoStep(ratio, divisions)` — nearest EDO step for a just ratio

#### 2.8.1 Scala File Support

- [x] `parseScl(text)` — parse .scl file (description, note count, degree lines as ratios or cents)
- [x] `parseKbm(text)` — parse .kbm keyboard mapping file (range, middle note, reference frequency)
- [x] `tuningFromScl(scl, kbm?)` — construct TuningSystem from Scala data
- [x] `sclToString(tuning)` — serialize a tuning to .scl format
- [x] `kbmToString(mapping)` — serialize a keyboard mapping to .kbm format
- [x] Support ratio notation (e.g., `3/2`, `5/4`) and cent notation (e.g., `701.955`)

#### 2.8.2 Rank-2 Temperaments and MOS Scales

- [x] `Rank2Temperament` type — period (cents), generator (cents)
- [x] `mosScale(period, generator, size)` — generate MOS (Moment of Symmetry) scale of given size
- [x] `mosStepPattern(period, generator, size)` — return step pattern as Large/small string (e.g., "5L 2s")
- [x] `isMos(scale)` — test if a scale has exactly two step sizes
- [x] `mosTree(period, generator, maxSize?)` — enumerate MOS scales at successive sizes
- [x] Built-in rank-2 presets: meantone, superpyth, flattone, mavila

#### 2.8.3 Monzo Arithmetic

- [x] `Monzo` type — prime exponent vector `[e₂, e₃, e₅, e₇, ...]`
- [x] `monzoToCents(monzo)` — convert monzo to cents
- [x] `monzoToRatio(monzo)` — convert monzo to frequency ratio
- [x] `ratioToMonzo(numerator, denominator, primeLimit?)` — factor a ratio into monzo
- [x] `monzoAdd(a, b)` — interval stacking (multiply ratios)
- [x] `monzoSubtract(a, b)` — interval subtraction (divide ratios)
- [x] `monzoScale(monzo, n)` — interval repetition

#### 2.8.4 Temperament Mapping and Val Computation

- [x] `Val` type — mapping from JI intervals to tempered steps (e.g., 12-EDO patent val ⟨12 19 28|)
- [x] `patentVal(divisions, primeLimit?)` — compute patent val for N-EDO to a given prime limit
- [x] `valMapping(val, monzo)` — apply val to monzo: number of tempered steps for a JI interval
- [x] `temperamentError(val, primeLimit?)` — RMS error of a val's approximation of JI intervals
- [x] `isBadlyBroken(val)` — test if a val produces a degenerate mapping (e.g., maps 3/2 to 0 steps)

---

## 3. Time Module

### 3.1 Metric Hierarchy

- [x] `MetricLevel` type — name, periodTicks, weight
- [x] `buildMetricLevels(timeSig, ticksPerQuarter)` — construct hierarchy
- [x] `beatStrength(tick, levels)` — cumulative weight at tick
- [x] `maxBeatStrength(levels)` — theoretical maximum strength
- [x] `syncopation(eventTick, velocity, levels)` — normalized syncopation value
- [x] Support compound meters properly (6/8, 9/8, 12/8 beat grouping)
- [x] Support irregular/asymmetric meters (5/4, 7/8 with configurable grouping)
- [x] `metricPosition(tick, levels)` — returns which level boundaries the tick aligns with

### 3.2 Pattern Detection

- [x] `findPatterns(events, options?)` — detect repeating patterns
- [x] Option: `minLength` (default 3)
- [x] Option: `maxLength` (default 16)
- [x] Option: `tolerance` — fuzzy matching threshold for duration ratios
- [x] Option: `matchTranspositions` — detect transposed recurrences
- [x] Non-overlapping occurrence filtering
- [x] Pattern results include: intervals, durations, occurrences, length
- [x] Handle edge case: events shorter than minLength * 2

### 3.3 Rhythmic Utilities

- [x] `quantize(events, gridTicks)` — snap onsets to nearest grid point
- [x] `swing(events, ratio, gridTicks)` — apply swing feel to even subdivisions
- [x] `durationName(ticks, ticksPerQuarter)` — symbolic name (quarter, eighth, dotted half, etc.)
- [x] `durationTicks(name, ticksPerQuarter)` — symbolic name to ticks

### 3.4 Rhythmic Complexity Measures

- [x] `rhythmicEntropy(events, levels)` — Shannon entropy of onset distribution across metric positions
- [x] `lzComplexity(events, gridTicks)` — Lempel-Ziv complexity of binary onset string
- [x] `syncopationIndex(events, levels)` — Longuet-Higgins-Lee total syncopation score
- [x] `weightedNoteToBeatDistance(events, levels)` — WNBD: average weighted distance from nearest strong beat
- [x] `grooveScore(events, levels, options?)` — composite groove metric combining syncopation and micro-timing

### 3.5 GTTM-Inspired Analysis

- [x] `metricalPreference(score, options?)` — metrical structure via preference rules (MPRs): align strong beats with onsets, long notes, harmonic changes, bass events
- [x] `groupingBoundaries(events, options?)` — detect phrase/group boundaries via GPRs: proximity, change, symmetry, parallelism
- [x] `hierarchicalMeter(score)` — multi-level metrical grid construction
- [x] Configurable preference rule weights
- [x] **Scope note:** Time-span reduction and prolongational reduction (full GTTM) are out of scope for this implementation. This section covers metrical and grouping preference rules only. Full tree-based reductions may be considered as a future extension.

---

## 4. Tension Module

### 4.1 Roughness

- [x] `roughness(frequencies)` — Plomp-Levelt sensory roughness
- [x] `roughnessFromMidi(midiNotes, tuningHz?)` — convenience wrapper
- [x] Validate frequency inputs (> 0, finite)
- [x] Configurable harmonic count (default 6, allow override)
- [x] Document amplitude model (1/n rolloff) and its assumptions

### 4.2 Tension Curve

- [x] `computeTension(score, options?)` — multi-component tension analysis
- [x] Component: roughness (psychoacoustic sensory dissonance)
- [x] Component: metric displacement (inverse beat strength)
- [x] Component: registral extremity (distance from pitch center)
- [x] Component: density (event count per time window)
- [x] Configurable component weights (default: roughness 0.3, metric 0.3, registral 0.2, density 0.2)
- [x] Configurable sample interval (default: ticksPerQuarter)
- [x] Configurable density window size
- [x] Configurable registral normalization range
- [x] All components individually accessible in output
- [x] Output includes both tick and seconds timestamps
- [x] Handle empty scores (return empty curve)
- [x] Handle scores with no sounding events at sample point

### 4.3 Tension Derivatives (from PHASE spec)

- [x] `tensionVelocity(curve)` — T'(t), first derivative (rate of tension change)
- [x] `tensionAcceleration(curve)` — T''(t), second derivative
- [x] `tensionIntegral(curve, startTick, endTick)` — cumulative tension over range
- [x] `findTensionPeaks(curve)` — local maxima
- [x] `findTensionValleys(curve)` — local minima
- [x] `classifyTensionProfile(curve)` — categorize as ramp, plateau, release, oscillation

### 4.4 Tonal Pitch Space Tension (Lerdahl)

- [x] `tpsDistance(chordA, keyA, chordB, keyB)` — pitch-space distance via basic space comparison
- [x] `basicSpace(chord, key)` — 5-level hierarchy (chromatic → diatonic → triadic → fifth → root)
- [x] `surfaceDissonance(events, chord)` — count and weight non-chord tones
- [x] `melodicAttraction(pitch, key)` — tendency of pitch to resolve, based on proximity and stability
- [x] `tpsTension(score, key, options?)` — tension curve combining pitch-space distance + surface dissonance
- [x] Requires key context (depends on key detection)

### 4.5 Spiral Array Tension (Chew/Herremans)

- [x] `spiralArrayPosition(pc)` — map pitch class to 3D helix point
- [x] `centerOfEffect(pcs, weights?)` — weighted centroid of pitch positions in Spiral Array
- [x] `cloudDiameter(events)` — max pairwise distance of simultaneous pitch positions (dissonance)
- [x] `cloudMomentum(chordSequence)` — distance between consecutive chord centroids (harmonic change rate)
- [x] `tensileStrain(chord, key)` — distance from chord centroid to key centroid (distance from tonal center)
- [x] `spiralTension(score, options?)` — tension curve combining all three Spiral Array metrics

### 4.6 Tonal Interval Vectors via DFT

- [x] `chromaVector(events)` — 12-element pitch-class distribution from a set of events
- [x] `tiv(chroma)` — Tonal Interval Vector: 12-point DFT, return 6 complex coefficients
- [x] `tivDistance(a, b)` — Euclidean distance between two TIVs (harmonic dissimilarity)
- [x] `tivConsonance(chroma)` — magnitude of TIV (correlates with consonance)
- [x] `tivTension(score, key, options?)` — tension curve: TIV distance of each chord from key TIV
- [x] `dftCoefficients(chroma)` — individual Fourier coefficient magnitudes (chromaticity, diadicity, triadicity, octatonicity, diatonicity, whole-tone quality)

### 4.7 Information-Theoretic Expectation

- [ ] `buildMarkovModel(events, order?, viewpoint?)` — variable-order Markov model from note sequence
- [ ] `informationContent(event, model, context)` — `-log₂(P(event|context))` surprise in bits
- [ ] `contextEntropy(model, context)` — Shannon entropy of predictive distribution (uncertainty)
- [ ] `surpriseCurve(events, model)` — per-event IC curve over a sequence
- [ ] `entropyCurve(events, model)` — per-event entropy curve
- [ ] Multiple viewpoints: pitch, interval, contour, scale degree, duration
- [ ] Short-term (piece-specific) and long-term (corpus-trained) model combination

---

## 5. I/O Module

### 5.1 MIDI Import

- [x] Parse Standard MIDI File format 0 (single track)
- [x] Parse Standard MIDI File format 1 (multi-track)
- [x] Variable-length quantity decoding with length limit (prevent infinite loop)
- [x] Running status handling
- [x] Note-on / note-off pairing (FIFO per pitch per channel)
- [x] Velocity-0 note-on treated as note-off
- [x] Meta events: tempo (0x51)
- [x] Meta events: time signature (0x58)
- [x] Meta events: key signature (0x59)
- [x] Meta events: track name (0x03)
- [x] Meta events: end of track (0x2F)
- [x] Program change extraction
- [x] Handle missing tempo (default 120 BPM)
- [x] Handle missing time signature (default 4/4)
- [x] Graceful handling of truncated/malformed files (throw descriptive error, don't crash)
- [x] Graceful handling of orphaned note-on events (close at end of track)
- [x] Buffer bounds checking on all reads

### 5.2 MIDI Export

- [x] Write Standard MIDI File format 1
- [x] Control track with time signatures and tempo changes
- [x] One track per part with program change and track name
- [x] Correct variable-length encoding
- [x] Correct delta-time calculation
- [x] Note-on and note-off events with proper velocity
- [x] End-of-track meta event on every track
- [x] Verify round-trip fidelity: export → import preserves all data

### 5.3 JSON Serialization

- [x] `scoreToJSON(score)` — serialize score to plain JSON object
- [x] `scoreFromJSON(json)` — deserialize with validation
- [x] Schema validation on import (reject malformed data)
- [x] Version field for forward compatibility

### 5.4 MusicXML Import

- [x] Parse MusicXML 4.0 (.musicxml, .xml) files
- [ ] Parse compressed MusicXML (.mxl) containers
- [x] Extract: notes (pitch, duration, onset, voice, staff)
- [x] Extract: rests
- [x] Extract: time signatures
- [x] Extract: key signatures
- [x] Extract: tempo markings (metronome marks)
- [x] Extract: part names and instruments
- [x] Extract: dynamics (pp, p, mp, mf, f, ff)
- [x] Extract: articulations (staccato, tenuto, accent, marcato, fermata)
- [x] Extract: slurs and ties (distinguish tied notes from slurred phrases)
- [x] Extract: measure numbers and barlines
- [x] Handle: multiple voices per staff
- [x] Handle: transposing instruments (concert pitch conversion)
- [ ] Handle: repeat barlines and da capo/dal segno (expand repeats to linear form)
- [x] Handle: grace notes (as zero-duration or short-duration events)
- [x] Handle: tuplets (correct duration calculation)
- [x] Handle: pickup measures (incomplete first measures)
- [x] Graceful handling of partial/non-conformant files (best-effort with warnings)

### 5.5 MusicXML Export

- [x] `scoreToMusicXML(score, options?)` — generate MusicXML 4.0 string
- [x] Export: notes with pitch spelling (enharmonic selection)
- [x] Export: rests
- [x] Export: time signatures
- [x] Export: key signatures
- [x] Export: tempo markings
- [x] Export: part names and instrument assignments
- [x] Export: dynamics and articulations
- [x] Export: measure structure (barlines, numbers)
- [x] Valid against MusicXML 4.0 XSD schema
- [x] Round-trip fidelity: export → import preserves core musical data

### 5.6 Humdrum \*\*kern Import

- [ ] Parse \*\*kern spine data (pitch, duration, accidentals, articulations, ties, slurs, beaming)
- [ ] Handle multi-spine (multi-voice) files
- [ ] Parse barline tokens (including structural markers)
- [ ] Parse tandem interpretations (\*M for meter, \*k for key signature, \*clef)
- [ ] Handle null tokens (sustained notes in grid representation)
- [ ] Handle spine path operators (\*+ add, \*- remove, \*^ split, \*v merge)
- [ ] Convert kern pitch encoding (A-G, case for octave, # and - for accidentals) to Pitch
- [ ] Convert kern duration encoding (reciprocal values) to ticks

### 5.7 ABC Notation Import

- [ ] Parse ABC header fields: X (index), T (title), M (meter), L (default length), K (key), Q (tempo)
- [ ] Parse ABC note encoding: C-B (octave 4), c-b (octave 5), ' and , for octave shifts
- [ ] Parse accidentals: ^ (sharp), _ (flat), = (natural)
- [ ] Parse duration modifiers: /2 (half), 2 (double), 3/2 (dotted), etc.
- [ ] Parse rests: z and Z
- [ ] Parse barlines: | || |] [| :| |:
- [ ] Parse chords: [CEG]
- [ ] Parse ties: -
- [ ] Handle multi-voice: V: field
- [ ] Convert to Score data model

### 5.8 Scala Tuning File I/O

- [x] `parseScl(text)` — (covered in 2.8.1, listed here for I/O completeness)
- [x] `parseKbm(text)` — (covered in 2.8.1)
- [x] `sclToString(tuning)` — (covered in 2.8.1)
- [x] `kbmToString(mapping)` — (covered in 2.8.1)

### 5.9 Analysis Result Export

- [ ] `toJAMS(annotations, metadata?)` — export analysis results in JAMS format (JSON Annotated Music Specification)
- [ ] Support JAMS namespaces: chord, beat, segment, key, pitch_class_profile
- [ ] `toRomanText(analysis, options?)` — export Roman numeral analysis in .rntxt format
- [ ] `fromRomanText(text)` — import .rntxt harmonic analysis

### 5.10 MEI Import

- [ ] Parse MEI (Music Encoding Initiative) 5.0 files
- [ ] Extract: notes (pitch, duration, onset, voice, staff)
- [ ] Extract: time signatures and key signatures
- [ ] Extract: part/staff definitions
- [ ] Extract: articulations and dynamics
- [ ] Handle: multiple layers per staff
- [ ] Handle: critical apparatus (editorial variants) — extract default reading
- [ ] Graceful handling of partial/non-conformant files (best-effort with warnings)

### 5.11 LilyPond Export

- [ ] `scoreToLilyPond(score, options?)` — generate LilyPond source string
- [ ] Export: notes with pitch spelling and duration
- [ ] Export: rests
- [ ] Export: time signatures and key signatures
- [ ] Export: multi-voice parts with `\\voiceOne`, `\\voiceTwo` layout
- [ ] Export: dynamics and articulations
- [ ] Output compiles with LilyPond 2.24+ without errors

### 5.12 Web MIDI API Integration

- [ ] `webMidiAccess(options?)` — request MIDI access via Web MIDI API (browser environments)
- [ ] `listMidiInputs()` — enumerate available MIDI input devices
- [ ] `listMidiOutputs()` — enumerate available MIDI output devices
- [ ] `onMidiMessage(input, callback)` — subscribe to real-time MIDI messages from an input
- [ ] `sendMidiMessage(output, message)` — send MIDI messages to an output device
- [ ] Convert incoming MIDI messages to NoteEvent format
- [ ] Environment detection: graceful no-op in Node.js (browser-only API)

### 5.13 MIDI Extensions

- [ ] MPE (MIDI Polyphonic Expression) awareness:
  - [ ] Detect MPE configuration messages (MCM — MIDI Channel Mode)
  - [ ] Parse per-note pitch bend (channel-per-note model)
  - [ ] Parse per-note pressure (channel aftertouch per note)
  - [ ] Parse per-note slide (CC74 per note)
  - [ ] Map MPE channels to voice assignments
- [ ] MIDI 2.0 awareness:
  - [ ] Parse UMP (Universal MIDI Packet) header format
  - [ ] Parse MIDI 2.0 note-on with per-note attributes (velocity 16-bit, pitch 7.9 fixed-point)
  - [ ] Detect and report MIDI 2.0 property exchange capabilities
  - [ ] Fallback: convert MIDI 2.0 to MIDI 1.0 semantics for analysis pipeline compatibility

### 5.14 OSC Output

- [ ] `analysisToOsc(results, options?)` — serialize analysis results as OSC messages
- [ ] Support OSC address patterns: `/stratum/tension`, `/stratum/key`, `/stratum/chord`, `/stratum/beat`
- [ ] Support OSC types: float32 for continuous values, string for labels, int32 for tick positions
- [ ] `oscBundle(messages, timetag?)` — group multiple messages into an OSC bundle
- [ ] `oscToBuffer(message)` — serialize OSC message to binary buffer (UDP-ready)
- [ ] Configurable: output address prefix, message rate limiting

---

## 6. Render Module

### 6.1 Chromatic Staff SVG

- [x] Proportional (piano-roll) layout: width = duration
- [x] 12 lines per octave, one per semitone
- [x] Line weights: heavy for octave boundaries (C), solid for chromatic, dashed for natural notes
- [x] Octave band shading (alternating)
- [x] Note blocks colored by voice/part
- [x] Velocity mapped to opacity
- [x] Measure lines with numbers
- [x] Pitch labels in left margin
- [x] Configurable options:
  - [x] pixelsPerTick
  - [x] pixelsPerSemitone
  - [x] lowNote / highNote range
  - [x] voiceColors array
  - [x] showMeasures toggle
  - [x] showLabels toggle
  - [x] marginLeft / padding
- [x] Empty score produces valid minimal SVG
- [x] Notes outside pitch range handled (skip with optional warning)
- [x] XML-escape all text content (part names, labels) to prevent injection
- [x] Multiple time signatures: measure lines adapt to changes
- [x] Valid SVG 1.1 output with proper xmlns and viewBox

### 6.2 Tension Curve SVG

- [x] `renderTensionCurve(curve, options?)` — SVG line chart of tension over time
- [x] Configurable: show individual components vs. total only
- [x] Configurable: colors per component
- [x] Time axis labels (seconds or measures)
- [x] Y-axis label (tension 0.0 to 1.0)
- [x] Overlay capability: tension curve + chromatic staff aligned by time axis

### 6.3 Tonnetz Visualization

- [ ] `renderTonnetz(options?)` — SVG Tonnetz lattice (toroidal, triangulated)
- [ ] Highlight active pitch classes (from chord or set)
- [ ] Highlight triadic triangles (major = downward, minor = upward)
- [ ] Animate chord progression as a path through the lattice
- [ ] Show NRT transformation labels on edges (P, L, R)
- [ ] Configurable: colors, node size, layout (triangular vs. hexagonal)

### 6.4 Circle of Fifths Visualization

- [ ] `renderCircleOfFifths(options?)` — SVG circle-of-fifths diagram
- [ ] Highlight active pitch classes
- [ ] Highlight current key (major/minor arcs)
- [ ] Show chord quality on each degree (major, minor, diminished)
- [ ] Configurable: colors, radius, label format (sharps vs. flats)

### 6.5 Interval-Class Vector Radar Chart

- [ ] `renderICVRadar(icv, options?)` — SVG radar/spider chart for 6-element interval-class vector
- [ ] Hexagonal axis layout (IC1 through IC6)
- [ ] Support overlay of multiple ICVs for comparison
- [ ] Configurable: colors, scale, labels

### 6.6 Self-Similarity Matrix Heatmap

- [ ] `renderSSM(matrix, options?)` — SVG heatmap of self-similarity matrix
- [ ] Color scale: low similarity (dark) → high similarity (light)
- [ ] Time axis labels (measures or seconds)
- [ ] Overlay novelty curve peaks as vertical markers
- [ ] Configurable: color scheme, resolution, axis labels

### 6.7 Chord Transition Graph

- [ ] `renderChordGraph(graph, options?)` — SVG force-directed graph of chord transitions
- [ ] Node size proportional to frequency
- [ ] Edge width proportional to transition probability
- [ ] Edge arrows for direction
- [ ] Node labels (chord names)
- [ ] Configurable: layout algorithm, colors, thresholds

### 6.8 Pitch-Class Distribution Chart

- [ ] `renderPCDistribution(distribution, options?)` — SVG bar chart of 12 pitch-class frequencies
- [ ] Horizontal or circular layout
- [ ] Support overlay of key profile for comparison
- [ ] Configurable: colors, orientation, labels

### 6.9 Just Intonation Lattice Visualization

- [ ] `renderJILattice(intervals, options?)` — SVG lattice of just intonation intervals
- [ ] 5-limit 2D lattice: horizontal axis = fifths (3/2), vertical axis = thirds (5/4)
- [ ] 7-limit 3D projection: add depth axis for septimal intervals (7/4)
- [ ] Highlight active intervals or scale degrees
- [ ] Show ratio labels on nodes
- [ ] Configurable: colors, node size, prime limit, projection angle (for 3D)

### 6.10 Wavescape Visualization

- [ ] `renderWavescape(score, options?)` — SVG hierarchical wavescape (DFT-based)
- [ ] Compute DFT coefficients at multiple hierarchical levels (note, beat, measure, section)
- [ ] Map DFT magnitude/phase to color (hue = phase, saturation = magnitude)
- [ ] Triangular hierarchical layout (time on x-axis, level on y-axis)
- [ ] Configurable: DFT component to display (diadicity, triadicity, diatonicity, etc.)
- [ ] Configurable: color mapping, resolution, orientation

### 6.11 Form/Structure Diagram

- [ ] `renderFormDiagram(boundaries, labels?, options?)` — SVG structural form diagram
- [ ] Horizontal segmented bar showing sections (A, B, A', C, etc.)
- [ ] Color-coded by section identity (repeated sections share colors)
- [ ] Time axis labels (measures or seconds)
- [ ] Overlay novelty curve below the form bar
- [ ] Configurable: colors, height, label format

### 6.12 Pitch-Space Plots

- [ ] `renderPitchSpacePlot(events, geometry, options?)` — SVG pitch-space visualization
- [ ] Geometry: linear (pitch vs. time, standard piano-roll variant)
- [ ] Geometry: circular (pitch classes on circle, time as radius or animation)
- [ ] Geometry: spiral (pitch helix combining octave and chroma)
- [ ] Highlight melodic contour paths
- [ ] Configurable: colors, geometry type, axis labels, point size

---

## 7. Analysis Module

### 7.1 Key Detection

- [x] `detectKey(score, options?)` — determine most likely key (Krumhansl-Schmuckler algorithm)
- [x] Compute pitch-class distribution from events
- [x] Correlate against major and minor key profiles (Krumhansl-Kessler or Temperley)
- [x] Return ranked list of candidate keys with correlation scores
- [x] `detectKeyWindowed(score, windowSize, options?)` — key detection per time window (modulation tracking)
- [x] `detectKeyTIV(score)` — alternative key detection via Tonal Interval Vector distance
- [x] Support custom key profiles (user-supplied templates)

### 7.2 Harmonic Analysis

- [x] `identifyChord(events)` — given simultaneous notes, return best chord label
- [x] `identifyScale(events)` — given a passage, return most likely scale/mode
- [x] `harmonicRhythm(score)` — detect rate of chord changes
- [x] `romanNumeralAnalysis(chords, key)` — label chords relative to a key center

#### 7.2.1 Enhanced Roman Numeral Analysis

- [x] Support secondary dominants: V/V, V/ii, V/vi, etc.
- [x] Support Neapolitan chord (bII)
- [x] Support augmented sixth chords (Italian, French, German)
- [x] Support applied/secondary chords (V7/IV, viio/V, etc.)
- [x] Support borrowed chords (modal mixture: bVII in major, IV in minor, etc.)
- [x] Support inversion figures: I6, V64, V43, V42, etc.
- [x] Modulation detection: identify pivot chords and key changes
- [x] `functionalHarmonyScore(chord, key)` — 0-100 score of harmonic function strength
- [x] Handle diminished seventh and augmented chords in context

### 7.3 Neo-Riemannian Analysis

- [x] `nrtTransform(triad, operation)` — apply P, L, or R to a major/minor triad
- [x] `classifyNRT(from, to)` — given two triads, determine which NRT operation(s) connect them
- [x] `nrtPath(from, to)` — shortest sequence of PLR operations between two triads (BFS on 24-node graph)
- [x] `nrtCompound(triad, operations)` — apply compound transformation (e.g., "PL", "LPR")
- [x] `hexatonicCycle(startTriad)` — generate 6-triad hexatonic cycle (PLPLPL)
- [x] `octatonicCycle(startTriad)` — generate 8-triad octatonic cycle (PRPRPR)
- [x] `hexatonicPole(triad)` — return the maximally distant triad (3 PL operations)
- [x] `weitzmannRegion(augTriad)` — return the 6 triads connected to an augmented triad via single semitone moves
- [x] Support extension to seventh chords (P7, L7, R7 operations)

### 7.4 Chord-Scale Theory

- [ ] `chordScaleMap` — database mapping chord types to compatible scales
- [ ] `availableScales(chord)` — return all compatible scales for a given chord
- [ ] `classifyTones(scale, chord)` — for each scale degree: chord tone, available tension, or avoid note
- [x] `analyzeOverHarmony(melody, chords)` — classify each melodic note relative to underlying chord-scale
- [ ] Built-in mappings for: major 7, dominant 7, minor 7, half-dim 7, diminished 7, altered, lydian dominant, and common jazz voicings
- [x] `hpcp(events)` — Harmonic Pitch Class Profile: weighted 12-element chroma vector from sounding events
- [x] `chordScaleScore(hpcp, scaleTemplate)` — cosine similarity or KL divergence between HPCP and chord-scale template
- [x] `bestChordScale(hpcp, chord)` — return highest-scoring compatible scale for observed pitch content

### 7.5 Melodic Analysis

- [x] `contour(events)` — pitch contour as sequence of up/down/same
- [x] `range(events)` — total pitch range (semitones, lowest, highest)
- [x] `meanPitch(events)` — average MIDI value
- [x] `intervalHistogram(events)` — frequency distribution of melodic intervals
- [x] `stepLeapRatio(events)` — proportion of stepwise vs. leaping motion

### 7.6 Structural Analysis

- [x] `segmentByRests(events, gapThreshold)` — split into phrases by silence
- [x] `segmentByPattern(events)` — split at pattern boundaries
- [x] `eventDensityCurve(score, windowSize)` — events per time window over entire score
- [x] `registralEnvelope(score)` — highest and lowest sounding pitch over time

#### 7.6.1 Self-Similarity Matrix

- [ ] `selfSimilarityMatrix(score, windowSize, featureType?)` — compute SSM from score
- [ ] Feature types: chroma (pitch-class distribution), pitch histogram, rhythm pattern, interval sequence, combined
- [ ] Similarity metric: cosine similarity (default), Euclidean distance, correlation
- [ ] `enhanceSSM(matrix, options?)` — path enhancement, transposition invariance, thresholding
- [ ] Support configurable window size and hop size

#### 7.6.2 Novelty Detection

- [ ] `noveltyFunction(ssm, kernelSize?)` — Foote's checkerboard kernel novelty detection
- [ ] `multiScaleNovelty(ssm, kernelSizes)` — combine novelty at multiple scales
- [ ] `findStructuralBoundaries(novelty, threshold?)` — peak-pick novelty function to identify section boundaries
- [ ] Return boundaries with confidence scores

#### 7.6.3 Repetition Pattern Discovery (SIA/SIATEC)

- [ ] `pointSetRepresentation(events)` — represent events as points in (onset, pitch) space
- [ ] `sia(pointSet)` — discover all maximal translatable patterns (O(n² log n))
- [ ] `siatec(pointSet)` — find all translation equivalence classes (all occurrences of each pattern)
- [ ] `cosiatec(pointSet)` — greedy cover: iteratively select best TEC, remove points, repeat
- [ ] `compressionRatio(pointSet)` — measure structural repetitiveness
- [ ] Support additional dimensions: duration, velocity

### 7.7 Post-Tonal Analysis

#### 7.7.1 Twelve-Tone Matrix

- [ ] `TwelveToneRow` class — represents a row as an ordered sequence of 12 pitch classes
- [ ] `.matrix()` — generate 12×12 matrix of all 48 row forms
- [ ] `.prime(n)` — P_n: row n of matrix, read left to right
- [ ] `.retrograde(n)` — R_n: row n read right to left
- [ ] `.inversion(n)` — I_n: column n read top to bottom
- [ ] `.retrogradeInversion(n)` — RI_n: column n read bottom to top
- [ ] `.identifyForm(sequence)` — given 12 notes, identify which of 48 forms it matches (or null)
- [ ] `.isAllInterval()` — test if row contains all 11 interval classes
- [ ] `allIntervalRows()` — enumerate or sample from the 1,928 all-interval series

#### 7.7.2 Combinatoriality

- [ ] `isHexachordallyCombinatorialP(row)` — P-combinatorial: first hexachord of P₀ + first hexachord of some Pₙ = aggregate
- [ ] `isHexachordallyCombinatorialI(row)` — I-combinatorial: P₀ first hex + Iₙ first hex = aggregate
- [ ] `isHexachordallyCombinatorialR(row)` — R-combinatorial
- [ ] `isHexachordallyCombinatorialRI(row)` — RI-combinatorial
- [ ] `isAllCombinatorialHexachord(hexachord)` — test if hexachord is combinatorial under all 4 operations
- [ ] `classifyAllCombinatorialType(hexachord)` — Babbitt's classification (A-F)

#### 7.7.3 Serial Operations

- [ ] `rotate(sequence, n)` — cyclic permutation of ordered pitch sequence
- [ ] `multiply(sequence, factor)` — multiplicative operation: `(pc * factor) mod 12`
- [ ] `M5(sequence)` — multiply by 5 (maps semitones to fourths)
- [ ] `M7(sequence)` — multiply by 7 (maps semitones to fifths)
- [ ] `setMultiplication(setA, setB)` — Boulez's frequency multiplication: `{(a+b) mod 12 : a∈A, b∈B}`
- [ ] `intervalExpansion(sequence, factor)` — expand/contract intervals by factor

#### 7.7.4 Row Invariance

- [ ] `invariantPcs(row, formA, formB)` — pitch classes shared between two row forms at corresponding positions
- [ ] `segmentalInvariance(row, segmentSize)` — find segments that map to themselves under transposition/inversion
- [ ] `derivedRow(generator)` — test if row can be derived from transformations of a single trichord/tetrachord

### 7.8 Voice Separation

- [x] `separateVoices(events, options?)` — assign voice labels to polyphonic events
- [x] Streaming algorithm based on auditory scene analysis principles:
  - [x] Pitch proximity (closer pitch → same voice)
  - [x] Temporal proximity (closer onset → same voice)
  - [x] Directional continuity (stepwise in same direction → same voice)
  - [x] Register consistency (voices stay within register bands)
- [x] Configurable: max voices, pitch distance threshold, gap threshold
- [x] Handle voice crossing (temporarily overlapping registers)
- [x] Return: events with voice assignments, or separate event arrays per voice

### 7.9 Counterpoint Analysis

- [x] `checkFirstSpecies(voice1, voice2, options?)` — evaluate against first-species rules
- [x] Rules: forbidden parallel perfect consonances (5ths, 8ves)
- [x] Rules: forbidden direct/hidden 5ths and 8ves
- [x] Rules: all intervals must be consonant (unison, 3rd, 5th, 6th, 8ve)
- [x] Rules: contrary/oblique motion preference
- [x] Rules: no voice crossing
- [x] Rules: begin and end on perfect consonance
- [x] Rules: stepwise motion preference, limited leaps
- [x] `checkSecondSpecies(voice1, voice2, options?)` — add passing tone rules
- [x] `checkFourthSpecies(voice1, voice2, options?)` — add suspension rules
- [x] Return: list of violations with type, severity, and position
- [x] `contrapuntalMotion(voice1, voice2)` — classify each interval as parallel, similar, contrary, or oblique

### 7.10 Textural Analysis

- [x] `textureType(score, tick)` — classify texture at a time point: monophonic, homophonic, polyphonic, homorhythmic
- [x] `rhythmicIndependence(voice1, voice2)` — correlation of onset patterns (1 = identical rhythm, 0 = independent)
- [x] `textureProfile(score, windowSize)` — texture classification curve over time
- [x] `voiceCount(score, tick)` — number of simultaneously sounding voices at a given time

### 7.11 Statistical Analysis

- [x] `pitchDistribution(events)` — 12-element pitch-class frequency histogram
- [x] `intervalDistribution(events)` — frequency distribution of all melodic intervals
- [x] `durationDistribution(events)` — frequency distribution of note durations
- [x] `chordTypeDistribution(score, windowSize)` — frequency of chord types across piece
- [x] `shannonEntropy(distribution)` — Shannon entropy of any discrete distribution
- [x] `zipfExponent(distribution)` — fit Zipf's law, return exponent (slope of log-log rank-frequency)
- [x] `markovTransitionMatrix(chordSequence, order?)` — build transition probability matrix (first or higher order)
- [x] `markovGenerate(matrix, length, seed?)` — generate sequence from trained Markov chain
- [x] `styleFingerprint(score)` — combined feature vector (distributions, entropy, Zipf exponent, etc.)
- [x] `styleSimilarity(fingerprintA, fingerprintB)` — cosine distance between style fingerprints

### 7.12 Harmonic Network Analysis

- [x] `chordTransitionGraph(chordSequence)` — build directed weighted graph from chord progression
- [x] `transitionProbabilities(graph)` — normalize edge weights to probabilities
- [x] `graphCentrality(graph)` — PageRank and betweenness centrality for each chord node
- [x] `detectCommunities(graph)` — community detection (Louvain or label propagation)
- [x] `findCycles(graph, maxLength?)` — detect common harmonic cycles (ii-V-I, I-vi-IV-V, etc.)
- [x] `compareGraphs(graphA, graphB)` — measure similarity between two harmonic networks

### 7.13 Corpus Tools

- [ ] `Corpus` class — collection of scores with metadata for batch analysis
- [ ] `loadCorpus(paths, options?)` — batch load multiple score files (MIDI, MusicXML, kern, ABC)
- [ ] `corpusSearch(corpus, query)` — search across works by metadata (composer, key, time signature, date)
- [ ] `corpusFilter(corpus, predicate)` — filter works by analytical criteria (e.g., all pieces in minor keys)
- [ ] `batchAnalyze(corpus, analysisFn)` — apply an analysis function to every score and collect results
- [ ] `corpusStatistics(corpus, featureFn)` — aggregate statistics across corpus (mean, std dev, distributions)
- [ ] `crossWorkSearch(corpus, pattern)` — find melodic/harmonic patterns across multiple works
- [ ] Support metadata fields: title, composer, date, genre, instrumentation, key, meter

### 7.14 Evaluation Metrics

- [x] `chordAccuracy(predicted, reference)` — proportion of correctly labeled chords (mir_eval-style)
- [x] `keyAccuracy(predicted, reference)` — key detection accuracy (exact match, fifth-related match, relative-key match)
- [x] `segmentationPrecisionRecall(predicted, reference, tolerance?)` — precision/recall/F1 for structural boundary detection
- [x] `voiceSeparationAccuracy(predicted, reference)` — proportion of correctly assigned voice labels
- [x] `overlapRatio(predictedSegments, referenceSegments)` — segment overlap metric for form analysis
- [x] All metrics return structured result objects with score, counts, and details

### 7.15 Figured Bass Realization

- [ ] `parseFiguredBass(figures)` — parse figured bass notation (6, 6/4, 7, 4/3, 4/2, etc.)
- [ ] `realizeFiguredBass(bass, figures, key?)` — generate chord voicing from bass note and figures
- [ ] `figuredBassAnalysis(score, options?)` — analyze a bass line and identify implied figured bass
- [ ] Support common abbreviations and defaults (no figure = 5/3, 6 = 6/3, etc.)
- [ ] Support accidentals in figures (#, b, natural modifiers)

### 7.16 Klumpenhouwer Networks and GIS

- [ ] `KNet` class — Klumpenhouwer network: nodes (pitch classes or pitch-class sets) connected by T/I arrows
- [ ] `buildKNet(nodes, arrows)` — construct a K-net from nodes and labeled transformations
- [ ] `kNetIsography(knetA, knetB)` — test positive and negative isography between K-nets
- [ ] `gisInterval(gis, a, b)` — compute the interval between two elements in a Generalized Interval System
- [ ] `GIS` type — set of elements, group of intervals, interval function
- [ ] `buildGIS(elements, intervalFn)` — construct a GIS from elements and an interval function
- [ ] Support standard GIS: pitch-class GIS (mod 12), pitch GIS (integers), duration GIS

---

## 8. Algorithmic Composition Utilities

### 8.1 Markov Chain Generator

- [x] `trainMarkovChain(sequence, order?)` — build transition matrix from pitch, interval, or chord sequence
- [x] `generateFromChain(chain, length, seed?)` — generate new sequence by sampling
- [ ] Support first-order and higher-order chains (up to order 5)
- [ ] Configurable: temperature parameter for controlling randomness

### 8.2 L-System Music Generator

- [ ] `LSystem` class — axiom, production rules, iteration count
- [ ] `.iterate(n)` — apply production rules n times
- [ ] `.toSequence(mapping)` — map L-system string to musical events via user-defined mapping
- [ ] Built-in mappings: pitch (character → pitch class), rhythm (character → duration)
- [ ] Support context-free and context-sensitive rules

### 8.3 Cellular Automaton Generator

- [ ] `elementaryCA(rule, width, steps)` — 1D elementary cellular automaton (rules 0-255)
- [ ] `caToEvents(grid, mapping)` — map CA grid to musical events
- [ ] Built-in mappings: row → time, column → pitch, cell state → on/off
- [ ] Support for Game of Life (2D) as well

### 8.4 Constraint Helpers

- [ ] `checkParallelFifths(voice1, voice2)` — detect parallel perfect fifths
- [ ] `checkParallelOctaves(voice1, voice2)` — detect parallel octaves
- [ ] `checkVoiceCrossing(voices)` — detect voice crossing
- [ ] `isInRange(events, low, high)` — verify all events within pitch range
- [ ] `checkLeapResolution(events)` — verify leaps larger than a 4th resolve by step

### 8.5 Xenakis Sieve Construction

- [ ] `Sieve` class — logical formula over residual classes
- [ ] `sieve(modulus, residue)` — elementary sieve: `{n : n ≡ residue (mod modulus)}`
- [ ] `.union(other)` — logical OR of sieves
- [ ] `.intersection(other)` — logical AND of sieves
- [ ] `.complement()` — logical NOT
- [ ] `.realize(low, high)` — generate all integers in range satisfying the sieve
- [ ] `.toPitchClasses()` — map realized integers to pitch classes (mod 12)
- [ ] `.toScale(octaveSize?)` — map to a scale within a given modular space

### 8.6 Stochastic Distribution Generators

- [ ] `poissonOnsets(rate, duration, seed?)` — generate onset times from Poisson process
- [ ] `gaussianPitches(mean, stdDev, count, seed?)` — generate pitch values from Gaussian distribution
- [ ] `uniformRhythm(min, max, count, seed?)` — generate durations from uniform distribution
- [ ] `exponentialDurations(rate, count, seed?)` — generate durations from exponential distribution
- [ ] `cauchyPitches(location, scale, count, seed?)` — generate pitches from Cauchy distribution (heavy tails)
- [ ] `weightedChoice(options, weights, count?, seed?)` — general weighted random selection (pitch classes, intervals, chords)
- [ ] All generators accept optional seed for reproducibility

---

## 9. Testing

### 9.1 Coverage Targets

- [x] Every exported function has at least one test
- [x] Every exported type is used in at least one test
- [x] All tests pass (`npx vitest run` exits 0)
- [x] No skipped or pending tests

### 9.2 Existing Module Tests (v1.0 — 156 tests)

- [x] Pitch module: 64 tests (normalization, frequencies, PCS operations, Forte catalog, voice leading, scales, chords, tuning)
- [x] Time module: 18 tests (metric hierarchy, syncopation, patterns, quantization)
- [x] Tension module: 22 tests (roughness, tension curves, derivatives, classification)
- [x] I/O module: 13 tests (MIDI round-trip, JSON serialization, multi-part handling)
- [x] Render module: 16 tests (SVG validity, content verification, options handling)
- [x] Analysis module: 23 tests (chord/scale identification, contour, density curves)

### 9.3 Pitch-Class Set Similarity Tests

- [x] IcVSIM: identical sets yield 1.0, maximally different sets yield low score
- [x] ANGLE: known set pairs produce expected angles
- [x] Z-related sets: detect known Z-pairs (e.g., 4-Z15 and 4-Z29)
- [x] Cosine similarity: parallel distributions yield 1.0, orthogonal yield 0.0

### 9.4 Geometric Voice Leading Tests

- [ ] Hungarian algorithm produces same result as brute-force for small sets
- [ ] L1, L2, Linf metrics produce different but valid orderings
- [ ] Parsimony score: P, L, R operations yield score of 1 or 2

### 9.5 Scala / Rank-2 / Monzo Tests

- [x] Parse known .scl files (12-TET, Werckmeister III, Kirnberger III)
- [x] Round-trip: tuning → .scl string → parse → same tuning
- [ ] MOS: meantone[7] = 5L 2s (diatonic), meantone[12] = 7L 5s (chromatic)
- [ ] Monzo: `[0, 1, 0]` (ratio 3/1) → ~1901.955 cents
- [ ] Monzo arithmetic: `3/2 * 5/4 = 15/8`

### 9.6 Rhythmic Complexity Tests

- [ ] Entropy: isochronous pattern = 0 (or minimal), random = high
- [ ] Syncopation index: on-beat pattern = 0, off-beat heavy pattern = high
- [ ] LZ complexity: repetitive pattern = low, non-repetitive = high

### 9.7 GTTM-Inspired Tests

- [ ] Metrical preference: downbeat of 4/4 identified as strongest
- [ ] Grouping boundaries: rest-separated phrases detected

### 9.8 Tonal Tension Model Tests

- [x] TPS distance: I to V < I to bVI in C major
- [x] Spiral Array: cloud diameter of major triad < diminished 7th
- [x] TIV: consonance of major triad > consonance of semitone cluster
- [x] TIV key detection: C major scale → C major key

### 9.9 Information-Theoretic Tests

- [ ] Repeated note sequence: low IC (predictable)
- [ ] Random sequence: high IC
- [ ] Entropy decreases as context grows (more certainty)
- [ ] Surprise curve peaks on chromatic alterations

### 9.10 MusicXML I/O Tests

- [ ] Import: known MusicXML file produces expected note count, part count, time/key signatures
- [ ] Export: score → MusicXML string → parse → equivalent score
- [ ] Handle: multi-voice parts
- [ ] Handle: transposing instruments
- [ ] Handle: tuplets (correct durations)
- [ ] Handle: ties vs. slurs distinguished
- [ ] Graceful failure on malformed XML

### 9.11 Humdrum / ABC / Scala I/O Tests

- [ ] Kern: parse a multi-spine file, verify note count and pitch values
- [ ] Kern: spine path operators (split/merge) handled correctly
- [ ] ABC: parse a simple folk tune, verify pitch and duration
- [ ] ABC: multi-voice ABC parsed into separate parts
- [x] Scala: parse .scl with ratios, verify cent values
- [x] Scala: parse .scl with cent values directly

### 9.12 JAMS / RomanText Export Tests

- [ ] JAMS: exported JSON validates against JAMS schema
- [ ] JAMS: chord annotations have correct time intervals
- [ ] RomanText: exported .rntxt matches expected format
- [ ] RomanText: round-trip (export → import → same analysis)

### 9.13 Key Detection Tests

- [x] C major scale → detects C major
- [x] A minor scale → detects A minor
- [x] Chromatic passage → ambiguous result with low confidence
- [x] Windowed detection: modulating piece → key changes at correct positions

### 9.14 Enhanced Roman Numeral Tests

- [x] Secondary dominant: G7 in C major → V7/V (not V7)... wait, G7 IS V7 in C major. D7 → V7/V
- [x] Neapolitan: Db major in C major → bII
- [x] Borrowed chord: Bb major in C major → bVII
- [x] Inversion: C/E → I6
- [x] Modulation detection: pivot chord identified

### 9.15 Neo-Riemannian Tests

- [x] P: C major → C minor (and reverse)
- [x] L: C major → E minor (and reverse)
- [x] R: C major → A minor (and reverse)
- [x] Compound: PL(C major) → Ab major
- [x] Path: C major to F# minor → shortest PLR path
- [x] Hexatonic cycle: 6 triads, returns to start
- [x] Hexatonic pole: C major → Ab minor (maximally distant)

### 9.16 Chord-Scale Theory Tests

- [ ] Cmaj7 → includes Ionian and Lydian
- [ ] Cm7 → includes Dorian and Aeolian
- [ ] C7 → includes Mixolydian
- [ ] Avoid notes correctly identified (e.g., 4th over major chord)

### 9.17 Self-Similarity / Novelty / SIA Tests

- [ ] SSM: identical sections → high diagonal blocks
- [ ] SSM: transposed section → off-diagonal stripe (with transposition invariance)
- [ ] Novelty: AABB form → boundary detected between A and B sections
- [ ] SIA: repeated motive found at all occurrences
- [ ] COSIATEC: compression ratio < 1.0 for piece with repetition

### 9.18 Post-Tonal Analysis Tests

- [x] Twelve-tone matrix: Webern Op. 21 row produces known matrix
- [x] Row identification: correctly matches P, I, R, RI forms
- [x] Combinatoriality: Schoenberg's row from Op. 33a is hexachordally combinatorial
- [ ] Set multiplication: {0,1,2} × {0,4,7} produces correct result
- [ ] M5: pitch class 1 → 5, 2 → 10, etc.

### 9.19 Voice Separation Tests

- [x] Two non-overlapping voices correctly separated
- [x] Voice crossing handled (voices swap registers temporarily)
- [x] Single voice: all events assigned to one voice
- [x] Chordal texture: simultaneous notes assigned to different voices

### 9.20 Counterpoint Tests

- [x] Parallel fifths detected between two voices
- [x] Parallel octaves detected
- [x] Valid first-species counterpoint passes with no violations
- [x] Direct/hidden fifths detected
- [x] Voice crossing detected

### 9.21 Statistical Analysis Tests

- [x] Pitch distribution: C major piece → highest bins at C, E, G
- [x] Shannon entropy: uniform distribution → maximum entropy
- [x] Markov chain: trained on I-IV-V-I → generates plausible progressions
- [x] Zipf exponent: calculated correctly for known distribution

### 9.22 Harmonic Network Tests

- [x] Graph from I-IV-V-I → 3 nodes, 3 edges
- [x] PageRank: I chord has highest centrality in diatonic progressions
- [x] Community detection: tonic/dominant/subdominant groupings

### 9.23 Visualization Tests

- [ ] Tonnetz SVG: valid SVG with correct number of nodes (12)
- [ ] Circle of fifths SVG: valid SVG, correct pitch-class ordering
- [ ] ICV radar: valid SVG, 6 axes present
- [ ] SSM heatmap: valid SVG, dimensions match matrix size
- [ ] Chord graph: valid SVG, nodes and edges present
- [ ] PC distribution: valid SVG, 12 bars

### 9.24 Composition Utility Tests

- [x] Markov generator: output length matches requested length
- [ ] L-system: known axiom/rules produce expected string after n iterations
- [ ] Cellular automaton: Rule 110 produces known pattern
- [ ] Sieve: `3@0 ∪ 4@0` realized correctly in range
- [ ] Constraint helpers: parallel fifths detected in known examples

### 9.25 Pitch Spelling Tests

- [x] `spellPitch`: MIDI 61 in A major → C#, in Ab major → Db
- [x] `spellPitchSequence`: ascending chromatic scale uses sharps, descending uses flats
- [x] Context-aware: sequence in key of G → F# preferred over Gb

### 9.26 Earth Mover's Distance Tests

- [x] EMD: identical distributions → 0
- [x] EMD: maximally different distributions → large positive value
- [x] EMD: single semitone shift → proportional to displacement
- [x] Circular distance: C vs. F# maximally distant on chroma ring

### 9.27 Cent/Ratio/EDO Conversion Tests

- [x] `ratioToCents(3/2)` → ~701.955 cents
- [x] `centsToRatio(1200)` → 2.0
- [x] `edoStepToCents(7, 12)` → 700 cents
- [x] Round-trip: cents → ratio → cents preserves value

### 9.28 Temperament Mapping Tests

- [ ] Patent val for 12-EDO: ⟨12 19 28| (5-limit)
- [ ] `valMapping`: 3/2 in 12-EDO → 7 steps
- [ ] Temperament error: 31-EDO < 12-EDO for 5-limit

### 9.29 MEI / LilyPond I/O Tests

- [ ] MEI: parse a known MEI file, verify note count and pitch values
- [ ] MEI: multi-layer staff parsed correctly
- [ ] LilyPond: export produces compilable source
- [ ] LilyPond: multi-voice export uses correct `\\voiceOne`/`\\voiceTwo` syntax

### 9.30 Web MIDI / MPE / MIDI 2.0 Tests

- [ ] Web MIDI: graceful no-op in Node.js environment
- [ ] MPE: per-note pitch bend parsed from channel model
- [ ] MIDI 2.0: UMP header parsed correctly
- [ ] MIDI 2.0 → MIDI 1.0 fallback produces valid MIDI 1.0 events

### 9.31 OSC Output Tests

- [ ] OSC message serialization matches OSC 1.0 binary format
- [ ] OSC bundle contains correct timetag and message count
- [ ] Address patterns follow `/stratum/` namespace convention

### 9.32 JI Lattice / Wavescape / Form Diagram Tests

- [ ] JI lattice SVG: valid SVG, 5-limit lattice has expected node layout
- [ ] Wavescape SVG: valid SVG, triangular layout with correct dimensions
- [ ] Form diagram SVG: valid SVG, section count matches input boundaries
- [ ] Pitch-space plot SVG: valid SVG, correct geometry for each type

### 9.33 Corpus Tool Tests

- [ ] Load multiple MIDI files into corpus
- [ ] Corpus search by metadata returns correct subset
- [ ] Batch analysis produces one result per score
- [ ] Cross-work pattern search finds shared motives

### 9.34 Evaluation Metric Tests

- [x] Chord accuracy: perfect match → 1.0, no match → 0.0
- [x] Key accuracy: exact match → 1.0, relative key → partial credit
- [x] Segmentation precision/recall: exact boundaries → F1 = 1.0
- [x] Voice separation accuracy: correct labels → 1.0

### 9.35 Figured Bass Tests

- [ ] Parse "6" → first inversion triad
- [ ] Parse "6/4" → second inversion triad
- [ ] Realize C bass + "7" in C major → C-E-G-B
- [ ] Accidentals in figures handled (#6 → raised sixth)

### 9.36 Klumpenhouwer / GIS Tests

- [ ] K-net positive isography: two K-nets with same T/I pattern → true
- [ ] K-net negative isography detected
- [ ] GIS interval: pitch-class GIS, interval C→E = 4
- [ ] GIS interval function is well-defined (unique interval for each pair)

### 9.37 Stochastic Generator Tests

- [ ] Poisson onsets: mean rate approximately matches requested rate
- [ ] Gaussian pitches: mean and std dev approximately match parameters
- [ ] Seeded generators produce identical output for same seed
- [ ] Weighted choice: distribution approximately matches weights over large sample

---

## 10. Documentation

### 10.1 README

- [x] Library purpose and identity (what it is, what it's not)
- [x] Installation instructions (npm)
- [x] Quick start example (load MIDI → analyze → render)
- [x] Module-by-module API overview with code examples
- [ ] Updated with all new modules and examples (v2+)

### 10.2 API Documentation

- [x] JSDoc on every v1.0 exported function (description, params, returns, throws, example)
- [x] JSDoc on every exported type and interface
- [x] JSDoc on every public method of PitchClassSet
- [x] Document algorithm limitations in JSDoc
- [ ] JSDoc on all v2+ exported functions
- [ ] JSDoc on all v3+ exported functions

### 10.3 Examples

- [x] Example: Build a score from scratch, export to MIDI
- [x] Example: Load a MIDI file, compute tension curve
- [x] Example: Pitch-class set analysis of a chord progression
- [x] Example: Render a chromatic staff SVG from MIDI
- [x] Example: Identify chords and scales in a passage
- [x] Example: Compare tuning systems
- [ ] Example: Load MusicXML, detect key, perform Roman numeral analysis
- [ ] Example: Neo-Riemannian analysis of a chromatic chord progression
- [ ] Example: Generate twelve-tone matrix and identify row forms
- [ ] Example: Compute self-similarity matrix and find structural boundaries
- [ ] Example: Compute TIV-based tension curve alongside Plomp-Levelt roughness
- [ ] Example: Separate voices in a piano MIDI and analyze counterpoint
- [ ] Example: Statistical style comparison of two MIDI files
- [ ] Example: Load Scala tuning, build MOS scale, render chromatic staff
- [ ] Example: Generate Markov chain progression and export to MIDI
- [ ] Example: Render Tonnetz path for a chord sequence
- [ ] Example: Corpus analysis — compare style fingerprints across multiple works
- [ ] Example: Figured bass realization of a Baroque bass line
- [ ] Example: Render JI lattice for a 5-limit tuning
- [ ] Example: Export analysis results as OSC messages

---

## 11. Build, Packaging, and Distribution

### 11.1 Project Configuration

- [x] `package.json` with correct name, version, description, license, repository
- [x] `tsconfig.json` with strict mode, ESM, declarations
- [x] `.gitignore` — node_modules, dist, .tmp, coverage, *.tgz
- [x] `LICENSE` file (MIT)

### 11.2 Build

- [x] `npm run build` compiles TypeScript to dist/ with declarations (.d.ts)
- [x] `npm run test` runs all tests
- [x] `npm run lint` runs linter (ESLint with TypeScript rules)
- [x] `npm run typecheck` runs `tsc --noEmit`
- [x] All scripts exit 0 on clean codebase

### 11.3 Package Quality

- [x] `main` and `types` fields point to correct dist/ files
- [x] `exports` field maps subpath imports (e.g., `stratum/pitch`, `stratum/time`)
- [x] `files` field limits published package to dist/ + README + LICENSE
- [x] No dev dependencies or test files in published package
- [x] Package installs cleanly in a fresh project (`npm install` from tarball)
- [x] Tree-shakeable (ESM, no side effects)
- [ ] Subpath exports updated for all new modules (composition, serial, nrt, stats, etc.)

### 11.4 CI Pipeline

- [x] GitHub Actions workflow:
  - [x] Lint
  - [x] Typecheck
  - [x] Test
  - [x] Build
- [x] Runs on push and pull request
- [x] Badge in README

---

## 12. Code Quality

### 12.1 Consistency

- [x] No duplicate exports
- [x] Consistent naming convention (camelCase functions, PascalCase types/classes)
- [x] Consistent error handling (throw Error with descriptive messages)
- [x] Consistent parameter ordering (data first, options last)
- [x] Consistent use of readonly/immutable where appropriate

### 12.2 Safety

- [x] No `any` types
- [x] No type assertions (`as`) without justification
- [x] No silent failures (every error path throws or returns a documented sentinel)
- [x] All user-facing text content XML-escaped in SVG output
- [x] No global mutable state

### 12.3 Performance

- [x] Forte catalog lookup is O(1) (hash map, not linear scan)
- [x] Voice leading brute-force capped at reasonable n (8)
- [x] MIDI parser handles files up to 10MB without hanging
- [x] SVG renderer handles scores up to 10,000 events without hanging
- [x] No accidental O(n³) or worse in hot paths
- [ ] SIA algorithm O(n² log n) — verified with profiling on 10,000-note inputs
- [ ] SSM computation handles 1,000+ window segments without hanging
- [ ] MusicXML parser handles files up to 5MB without hanging

### 12.4 Zero Dependencies

- [x] No runtime dependencies (production)
- [ ] Maintained through all new modules — every parser, algorithm, and renderer implemented from scratch

---

## 13. Spec Concept Mapping

### From Stratum Specification

| Concept | Status | Notes |
|---------|--------|-------|
| Note event data model | ✅ Complete | Core types |
| Score structure | ✅ Complete | Core types |
| Chromatic staff rendering | ✅ Complete | Render module |
| Proportional duration view | ✅ Complete | SVG renderer |
| Rhythm grid | ✅ Complete | Metric module |
| Voice color assignment | ✅ Complete | Render options |
| Octave band shading | ✅ Complete | SVG renderer |
| Microtonal pitch | ✅ Complete | Pitch type + tuning module |
| Articulation markings | ✅ Complete | NoteEvent field |
| Dynamics (velocity envelope) | Exclude | Runtime/synthesis concern |
| Spectral layer (ADSR, waveform) | Exclude | Synthesis, not analysis |
| Modulation (vibrato) | Exclude | Synthesis |
| .stratum ZIP container | Exclude | Application-level format |
| GUI keyboard shortcuts | Exclude | Application concern |
| Playback/audio synthesis | Exclude | DAW/audio engine concern |
| Accessibility modes | Exclude | Application concern |

### From Resonance Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Pitch class system (0-11) | ✅ Complete | Pitch module |
| Interval distance and class | ✅ Complete | Pitch module |
| Scale as pitch-class set | ✅ Complete | Scale catalog |
| Mode as rotation | ✅ Complete | Scale module |
| Chord as pitch-class set | ✅ Complete | Chord catalog |
| Set class / prime form | ✅ Complete | PitchClassSet |
| Interval structure | ✅ Complete | PitchClassSet |
| Voice-leading distance | ✅ Complete | Voice leading module |
| Forte catalog | ✅ Complete | Complete 220-entry catalog |
| Neo-Riemannian transforms | ✅ Complete | Section 7.3 |
| Tonnetz representation | ✅ Complete | Data model done; SVG viz separate |
| Geometric voice leading | Planned | Section 2.6.1 |

### From Flux Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Event primitive | ✅ Complete | NoteEvent |
| Stream (sequence of events) | ✅ Complete | Part / voice |
| Pattern (repeating profile) | ✅ Complete | Pattern detection |
| Tension (multidimensional) | ✅ Complete | Tension module |
| Cycle (periodic structure) | ✅ Complete | Metric hierarchy |
| Transformation operator (T, I, R) | ✅ Complete | PitchClassSet transforms |
| Entropy / predictability | ✅ Complete | shannonEntropy, rhythmicEntropy |
| Roughness | ✅ Complete | Plomp-Levelt model |
| Self-similarity analysis | ✅ Complete | selfSimilarityMatrix, noveltyDetection |
| Stream fission/fusion | Planned | Section 7.8 (voice separation) |
| Statistical distributions | ✅ Complete | zipfDistribution, markovTransition |

### From PHASE Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Tension surface T(t) | ✅ Complete | Tension curve |
| Tension derivatives | ✅ Complete | Velocity, acceleration |
| Tension integral | ✅ Complete | tensionIntegral |
| Hierarchical prediction | Planned | Section 4.7 (information-theoretic) |
| Anticipation / prediction error | Planned | Section 4.7 |
| Swing ratio parameter | ✅ Complete | Rhythmic utility |
| Tonal Pitch Space tension | ✅ Complete | Section 4.4 |
| Spiral Array tension | ✅ Complete | Section 4.5 |
| TIV tension | ✅ Complete | Section 4.6 |

### From COHERE Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Consonance as roughness | ✅ Complete | Plomp-Levelt model |
| Metrical hierarchy | ✅ Complete | Time module |
| Groove quantification | Planned | Section 3.4 |
| Arnold tongue hierarchy | Exclude | Oscillator dynamics |
| Coupling equation | Exclude | Physics simulation |
| Affect from dynamics | Exclude | Requires coherence computation |
| Social coupling | Exclude | Multi-agent simulation |

---

## 14. Versioning Milestones

### v1.0 — Computable Analytical Core ✅ COMPLETE

Sections 1-7 (core modules: data model, pitch, time, tension, I/O, render, analysis). Sections 9-12 (testing, documentation, build/packaging, code quality).

All 156 tests passing. Zero dependencies. Full Forte catalog. Plomp-Levelt roughness. Multi-component tension. MIDI I/O. Chromatic staff SVG. Harmonic/melodic/structural analysis.

### v2.0 — Research-Grade Analysis

**New analysis capabilities:**
- [x] Section 2.4: Pitch-class set similarity (IcVSIM, ANGLE, cosine, Z-relation)
- [x] Section 4.4: Lerdahl TPS tension
- [x] Section 4.5: Spiral Array tension
- [x] Section 4.6: Tonal Interval Vectors via DFT
- [x] Section 7.1: Key detection (Krumhansl-Schmuckler, windowed, TIV)
- [x] Section 7.2.1: Enhanced Roman numeral analysis
- [x] Section 7.3: Neo-Riemannian analysis
- [x] Section 7.6.1: Self-similarity matrix
- [x] Section 7.6.2: Novelty detection
- [x] Section 7.7.1: Twelve-tone matrix
- [x] Section 7.7.2: Combinatoriality
- [x] Section 7.7.3: Serial operations
- [x] Section 7.11: Statistical analysis (distributions, entropy, Zipf, Markov)

**Chord-scale theory (moved from v3.0 per research priority — Phase 2 differentiator for jazz analysis):**
- [x] Section 7.4: Chord-scale theory (including HPCP matching)

**Pitch utilities:**
- [x] Section 2.1: Automatic pitch spelling (standalone `spellPitch`, `spellPitchSequence`)
- [x] Section 2.4: Earth Mover's Distance for pitch-class distributions
- [x] Section 2.8: Cent/ratio/EDO step conversion utilities

**Format support:**
- [ ] Section 5.4: MusicXML import
- [ ] Section 5.5: MusicXML export
- [ ] Section 5.9: JAMS and RomanText export

**Visualization:**
- [ ] Section 6.3: Tonnetz visualization
- [ ] Section 6.4: Circle of fifths
- [ ] Section 6.5: ICV radar chart
- [ ] Section 6.6: Self-similarity matrix heatmap
- [ ] Section 6.8: Pitch-class distribution chart

**Tuning:**
- [x] Section 2.8.1: Scala .scl/.kbm support

**Tests and docs:**
- [ ] All Section 9.3-9.18 tests passing
- [ ] All Section 9.23 visualization tests passing
- [ ] All Section 9.25-9.27 tests passing (pitch spelling, EMD, cent/ratio/EDO)
- [ ] README updated with v2 examples
- [ ] JSDoc on all v2 exports

### v3.0 — Feature-Complete Platform

**Remaining analysis:**
- [ ] Section 2.6.1: Geometric voice leading (Tymoczko)
- [ ] Section 2.6.2: Parsimonious voice leading
- [ ] Section 3.4: Rhythmic complexity measures
- [ ] Section 3.5: GTTM-inspired metrical analysis
- [ ] Section 4.7: Information-theoretic expectation
- [ ] Section 7.6.3: SIA/SIATEC repetition discovery
- [ ] Section 7.7.4: Row invariance analysis
- [ ] Section 7.8: Voice separation
- [ ] Section 7.9: Counterpoint analysis
- [ ] Section 7.10: Textural analysis
- [x] Section 7.12: Harmonic network analysis
- [ ] Section 7.13: Corpus tools
- [x] Section 7.14: Evaluation metrics (mir_eval-style)
- [ ] Section 7.15: Figured bass realization
- [ ] Section 7.16: Klumpenhouwer networks and GIS

**Remaining formats:**
- [ ] Section 5.6: Humdrum \*\*kern import
- [ ] Section 5.7: ABC notation import
- [ ] Section 5.10: MEI import
- [ ] Section 5.11: LilyPond export
- [ ] Section 5.12: Web MIDI API integration
- [ ] Section 5.13: MIDI extensions (MPE, MIDI 2.0)
- [ ] Section 5.14: OSC output

**Tuning (advanced):**
- [ ] Section 2.8.2: Rank-2 temperaments and MOS scales
- [ ] Section 2.8.3: Monzo arithmetic
- [ ] Section 2.8.4: Temperament mapping and val computation

**Composition utilities:**
- [x] Section 8.1: Markov chain generator
- [ ] Section 8.2: L-system generator
- [ ] Section 8.3: Cellular automaton generator
- [ ] Section 8.4: Constraint helpers
- [ ] Section 8.5: Xenakis sieve construction
- [ ] Section 8.6: Stochastic distribution generators

**Visualization:**
- [ ] Section 6.7: Chord transition graph
- [ ] Section 6.9: Just intonation lattice visualization
- [ ] Section 6.10: Wavescape visualization
- [ ] Section 6.11: Form/structure diagram
- [ ] Section 6.12: Pitch-space plots

**Tests, docs, build:**
- [ ] All Section 9.19-9.24 tests passing
- [ ] All Section 9.25-9.37 tests passing (new feature tests)
- [ ] README updated with v3 examples
- [ ] JSDoc on all v3 exports
- [ ] Subpath exports updated for all new modules
- [ ] Zero runtime dependencies maintained

---

## 15. Definition of Complete

**The library is feature-complete when:**

1. Every checkbox in Sections 1-8 is checked
2. Every checkbox in Section 9 is checked (all tests passing)
3. Every checkbox in Section 10 is checked (documentation complete)
4. Every checkbox in Section 11 is checked (build and packaging ready)
5. Every checkbox in Section 12 is checked (code quality verified)
6. All tests pass
7. TypeScript compiles with zero errors and zero warnings
8. Linter passes with zero errors
9. The library can be installed in a fresh project and used without issues
10. Zero runtime dependencies
11. At least one non-trivial end-to-end example works per major feature area

**The library is NOT complete if:**

- Any exported function lacks JSDoc documentation
- Any module has untested exported functions
- Input validation is missing on public API boundaries
- Known bugs exist without documented workarounds
- The README doesn't explain how to install and use every module
- Any runtime dependency has been introduced
- Any section is only partially implemented (no half-finished features)

---

## Progress Tracking

| Section | v1.0 | v2.0 | v3.0 |
|---------|------|------|------|
| 1. Core Data Model | ✅ 100% | — | — |
| 2. Pitch Module (2.1-2.3, 2.5-2.8) | ✅ 100% | — | — |
| 2.1 Pitch Spelling | — | ✅ 100% | — |
| 2.4 PCS Similarity + EMD | — | ✅ 100% | — |
| 2.6.1 Geometric Voice Leading | — | — | 0% |
| 2.6.2 Parsimonious Voice Leading | — | — | 0% |
| 2.8 Cent/Ratio/EDO Utilities | — | ✅ 100% | — |
| 2.8.1 Scala Support | — | ✅ 100% | — |
| 2.8.2 Rank-2 / MOS | — | — | 0% |
| 2.8.3 Monzo Arithmetic | — | — | 0% |
| 2.8.4 Temperament Mapping | — | — | 0% |
| 3. Time Module (3.1-3.3) | ✅ 100% | — | — |
| 3.4 Rhythmic Complexity | — | — | 0% |
| 3.5 GTTM-Inspired | — | — | 0% |
| 4. Tension Module (4.1-4.3) | ✅ 100% | — | — |
| 4.4 Lerdahl TPS | — | ✅ 100% | — |
| 4.5 Spiral Array | — | ✅ 100% | — |
| 4.6 TIV / DFT | — | ✅ 100% | — |
| 4.7 Information-Theoretic | — | — | 0% |
| 5. I/O Module (5.1-5.3) | ✅ 100% | — | — |
| 5.4-5.5 MusicXML | — | 0% | — |
| 5.6 Humdrum kern | — | — | 0% |
| 5.7 ABC Notation | — | — | 0% |
| 5.8 Scala I/O | — | ✅ 100% | — |
| 5.9 JAMS / RomanText | — | 0% | — |
| 5.10 MEI Import | — | — | 0% |
| 5.11 LilyPond Export | — | — | 0% |
| 5.12 Web MIDI | — | — | 0% |
| 5.13 MIDI Extensions (MPE/2.0) | — | — | 0% |
| 5.14 OSC Output | — | — | 0% |
| 6. Render Module (6.1-6.2) | ✅ 100% | — | — |
| 6.3-6.6, 6.8 Visualizations | — | 0% | — |
| 6.7 Chord Graph | — | — | 0% |
| 6.9 JI Lattice | — | — | 0% |
| 6.10 Wavescape | — | — | 0% |
| 6.11 Form Diagram | — | — | 0% |
| 6.12 Pitch-Space Plots | — | — | 0% |
| 7. Analysis (7.2, 7.5-7.6) | ✅ 100% | — | — |
| 7.1 Key Detection | — | ✅ 100% | — |
| 7.2.1 Enhanced Roman Numerals | — | ✅ 100% | — |
| 7.3 Neo-Riemannian | — | ✅ 100% | — |
| 7.4 Chord-Scale Theory | — | ✅ 100% | — |
| 7.6.1-7.6.2 SSM / Novelty | — | ✅ 100% | — |
| 7.6.3 SIA/SIATEC | — | — | 0% |
| 7.7 Post-Tonal | — | ✅ 100% | — |
| 7.8 Voice Separation | — | ✅ 100% | — |
| 7.9 Counterpoint | — | ✅ 100% | — |
| 7.10 Textural Analysis | — | ✅ 100% | — |
| 7.11 Statistical Analysis | — | ✅ 100% | — |
| 7.12 Harmonic Networks | — | ✅ 100% | — |
| 7.13 Corpus Tools | — | — | 0% |
| 7.14 Evaluation Metrics | — | ✅ 100% | — |
| 7.15 Figured Bass | — | — | 0% |
| 7.16 Klumpenhouwer / GIS | — | — | 0% |
| 8. Composition Utilities (8.1-8.5) | — | — | 0% |
| 8.6 Stochastic Generators | — | — | 0% |
| 9. Testing | ✅ 100% | Grows with features | Grows with features |
| 10. Documentation | ✅ 100% | Grows with features | Grows with features |
| 11. Build & Packaging | ✅ 100% | Minor updates | Minor updates |
| 12. Code Quality | ✅ 100% | Maintained | Maintained |
