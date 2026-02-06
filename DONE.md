# Definition of Done — Stratum

**What this document is:** An exhaustive checklist defining what "feature-complete and fully finished" means for this library. Every box must be checked or explicitly marked as a reasoned exclusion before the project ships as v1.0.

**What this library is:** A zero-dependency TypeScript music analysis toolkit that makes the core ideas from the Stratum, Resonance, Flux, Phase, and COHERE specifications computable.

**What this library is NOT:** A DAW, audio engine, notation editor GUI, real-time performance tool, or synthesis framework. Those are applications that would _consume_ this library.

---

## Scope Boundary

The specs describe ~500 implementable concepts spanning physics, cognition, social dynamics, GUI design, audio synthesis, and file formats. This library implements the **computable analytical core** — the subset that takes musical data in and produces analytical results out, with no runtime dependencies and no platform coupling.

### In scope

- Pitch representation, naming, frequency conversion
- Pitch-class set theory (Forte catalog, transformations, analysis)
- Interval analysis
- Voice-leading computation
- Metric hierarchy and beat strength
- Syncopation measurement
- Pattern detection
- Psychoacoustic roughness (Plomp-Levelt)
- Multi-component tension curves
- MIDI file I/O (Standard MIDI File format)
- Chromatic staff SVG rendering (proportional/piano-roll)
- Score data model (events, parts, time signatures, tempos)
- Tuning systems beyond 12-TET
- Scale/mode/chord cataloging and identification
- Harmonic analysis primitives

### Out of scope (belongs to applications built on this library)

- GUI / interactive editor / keyboard shortcuts
- Audio playback or synthesis (Spectral Layer / ADSR / waveforms)
- Real-time performance or latency-sensitive operations
- Social coupling / multi-agent coordination simulation
- Neural oscillator modeling (COHERE equations)
- MusicXML / MEI / ABC / Lilypond import-export
- `.stratum` ZIP container format
- Accessibility modes (high contrast, large print)
- Cultural coupling profiles (Javanese gamelan parameters, etc.)
- Affect/emotion derivation from coupling dynamics

---

## 1. Core Data Model

### 1.1 Types and Interfaces

- [ ] `Pitch` — midi, pitchClass, octave, centsDeviation (microtonal support)
- [ ] `NoteEvent` — id, pitch, onset, duration, velocity, voice, articulation
- [ ] `TimeSignature` — numerator, denominator, atTick
- [ ] `TempoMark` — bpm, atTick
- [ ] `Part` — id, name, midiProgram, midiChannel, events
- [ ] `ScoreSettings` — ticksPerQuarter, tuningHz, tuningSystem
- [ ] `Score` — metadata, settings, parts, timeSignatures, tempoChanges, keyCenters
- [ ] `KeyCenter` — tonic (pitch class), mode/scale reference, atTick
- [ ] `Articulation` enum or union — staccato, tenuto, accent, marcato, legato, fermata
- [ ] `DynamicMarking` — symbolic (pp, p, mp, mf, f, ff) and/or velocity mapping

### 1.2 Score Construction and Query

- [ ] `createScore(options?)` — factory with sensible defaults
- [ ] `addPart(score, options)` — add a named part
- [ ] `addNote(score, part, options)` — add a note event with full validation
- [ ] `removePart(score, partId)` — remove a part by ID
- [ ] `removeNote(part, noteId)` — remove a note by ID
- [ ] `getAllEvents(score)` — all events sorted by onset
- [ ] `getEventsInRange(score, startTick, endTick)` — events within a tick range
- [ ] `getEventsAtTick(score, tick)` — events sounding at a specific tick
- [ ] `tickToSeconds(score, tick)` — converts ticks to seconds respecting tempo changes
- [ ] `secondsToTick(score, seconds)` — inverse of tickToSeconds
- [ ] `getScoreDuration(score)` — total duration in ticks and seconds
- [ ] `cloneScore(score)` — deep copy
- [ ] `mergeScores(scores[])` — combine multiple scores

### 1.3 Input Validation

- [ ] MIDI note values validated: 0-127 (throw on out-of-range)
- [ ] Velocity validated: 0-127
- [ ] Duration validated: > 0
- [ ] Onset validated: >= 0
- [ ] Pitch class validated: 0-11 after normalization
- [ ] Time signature denominator validated: power of 2
- [ ] Tempo validated: > 0
- [ ] Ticks per quarter validated: > 0
- [ ] Tuning Hz validated: > 0

---

## 2. Pitch Module

### 2.1 Pitch Fundamentals

- [ ] `normalizePc(pc)` — any integer to 0-11
- [ ] `pitchFromMidi(midi)` — MIDI note to Pitch object (with validation)
- [ ] `pitchFromPcOctave(pc, octave)` — pitch class + octave to Pitch (with validation)
- [ ] `pitchToFrequency(pitch, tuningHz?)` — frequency in Hz (12-TET, centsDeviation-aware)
- [ ] `frequencyToPitch(freq, tuningHz?)` — nearest MIDI pitch from frequency
- [ ] `pitchClassName(pc)` — sharp name (C, C#, D, ...)
- [ ] `pitchClassFlatName(pc)` — flat name (C, Db, D, ...)
- [ ] `pitchName(pitch)` — full name with octave (C4, F#5)
- [ ] `parsePitchName(name)` — string to Pitch (C4, Bb3, F#5)
- [ ] Remove duplicate `pitchFromMidi` export (canonical in core/score.ts, re-exported from pitch)

### 2.2 Intervals

- [ ] `directedInterval(from, to)` — ascending interval 0-11
- [ ] `intervalClass(a, b)` — shortest distance 0-6
- [ ] `intervalClassName(ic)` — human-readable name
- [ ] `semitoneDist(from, to)` — signed MIDI distance

### 2.3 Pitch-Class Sets

- [ ] `PitchClassSet` class with immutable sorted members
- [ ] `.transpose(n)` — transposition by n semitones
- [ ] `.invert()` — inversion around 0 (12 - pc)
- [ ] `.complement()` — all pitch classes not in set
- [ ] `.normalForm()` — most compact cyclic ordering
- [ ] `.primeForm()` — canonical form (compares with inversion)
- [ ] `.intervalVector()` — 6-element IC count
- [ ] `.intervalStructure()` — gaps between adjacent members
- [ ] `.forteName()` — Forte catalog lookup
- [ ] `.equals(other)` — structural equality
- [ ] `.union(other)` — set union
- [ ] `.intersection(other)` — set intersection
- [ ] `.difference(other)` — set difference (in this but not other)
- [ ] `.symmetricDifference(other)` — in one but not both
- [ ] `.isSubsetOf(other)` — subset test
- [ ] `.isSupersetOf(other)` — superset test
- [ ] `.toString()` — string representation {0,4,7}
- [ ] `.toNoteNames()` — human-readable {C, E, G}

### 2.4 Forte Catalog

- [ ] All 6 dyads (interval classes 1-6)
- [ ] All 12 trichords (3-1 through 3-12)
- [ ] All 29 tetrachords (4-1 through 4-29)
- [ ] All 38 pentachords (5-1 through 5-38)
- [ ] All 50 hexachords (6-1 through 6-50)
- [ ] All 38 heptachords (7-1 through 7-38)
- [ ] All 29 octachords (8-1 through 8-29)
- [ ] All 12 nonachords (9-1 through 9-12)
- [ ] All 6 decachords (10-1 through 10-6)
- [ ] Total: 220 set classes (plus 0-1, 1-1, 11-1, 12-1 trivial cases)
- [ ] Reverse lookup: Forte name to prime form
- [ ] Catalog includes interval vectors for each entry

### 2.5 Voice Leading

- [ ] `voiceLeadingDistance(from, to)` — minimum total IC movement
- [ ] `smoothestVoiceLeading(from, to)` — optimal pitch assignment pairs
- [ ] Document greedy approximation for n > 8 in JSDoc and README
- [ ] Throw descriptive error for mismatched set sizes
- [ ] Handle empty sets gracefully (distance = 0)
- [ ] Handle single-element sets

### 2.6 Scales, Modes, and Chords

- [ ] `Scale` type — name, pitch-class set, interval pattern
- [ ] Built-in scale catalog:
  - [ ] Major (Ionian) and all 7 diatonic modes
  - [ ] Harmonic minor and its modes
  - [ ] Melodic minor (ascending) and its modes
  - [ ] Pentatonic major and minor
  - [ ] Blues scale
  - [ ] Whole-tone scale
  - [ ] Octatonic (diminished) scales (half-whole, whole-half)
  - [ ] Chromatic scale
- [ ] `scaleFromPcs(pcs)` — identify scale name from pitch-class set
- [ ] `scaleFromIntervals(intervals)` — build scale from interval pattern
- [ ] `modeRotation(scale, degree)` — rotate to get mode
- [ ] `Chord` type — root, quality, pitch-class set, interval structure
- [ ] Built-in chord catalog:
  - [ ] Triads: major, minor, diminished, augmented
  - [ ] Seventh chords: dominant 7, major 7, minor 7, half-diminished, diminished 7, minor-major 7, augmented-major 7
  - [ ] Extended: 9th, 11th, 13th variants
  - [ ] Suspended: sus2, sus4
  - [ ] Added-tone: add9, add11, 6, 6/9
  - [ ] Power chord (root + fifth)
- [ ] `chordFromPcs(pcs, root?)` — identify chord from pitch classes
- [ ] `chordFromName(name)` — build chord from name string (e.g., "Cmaj7")
- [ ] `chordFromIntervals(root, intervals)` — build chord from root + intervals

### 2.7 Tuning Systems

- [ ] `TuningSystem` interface — name, pitchCount, frequencyAt(step, octave)
- [ ] `equalTemperament(divisions)` — generic N-TET constructor
- [ ] Built-in tuning presets:
  - [ ] 12-TET (standard, default)
  - [ ] 19-TET
  - [ ] 24-TET (quarter-tone)
  - [ ] 31-TET
  - [ ] 53-TET
  - [ ] Pythagorean tuning
  - [ ] 5-limit just intonation
  - [ ] 7-limit just intonation
  - [ ] Quarter-comma meantone
- [ ] `centsDeviation(tuning, step)` — deviation from 12-TET in cents
- [ ] `frequencyFromTuning(tuning, step, octave, refHz?)` — frequency lookup
- [ ] `nearestStep(tuning, frequencyHz)` — snap frequency to nearest tuning step

---

## 3. Time Module

### 3.1 Metric Hierarchy

- [ ] `MetricLevel` type — name, periodTicks, weight
- [ ] `buildMetricLevels(timeSig, ticksPerQuarter)` — construct hierarchy
- [ ] `beatStrength(tick, levels)` — cumulative weight at tick
- [ ] `maxBeatStrength(levels)` — theoretical maximum strength
- [ ] `syncopation(eventTick, velocity, levels)` — normalized syncopation value
- [ ] Support compound meters properly (6/8, 9/8, 12/8 beat grouping)
- [ ] Support irregular/asymmetric meters (5/4, 7/8 with configurable grouping)
- [ ] `metricPosition(tick, levels)` — returns which level boundaries the tick aligns with

### 3.2 Pattern Detection

- [ ] `findPatterns(events, options?)` — detect repeating patterns
- [ ] Option: `minLength` (default 3)
- [ ] Option: `maxLength` (default 16)
- [ ] Option: `tolerance` — fuzzy matching threshold for duration ratios
- [ ] Option: `matchTranspositions` — detect transposed recurrences
- [ ] Non-overlapping occurrence filtering
- [ ] Pattern results include: intervals, durations, occurrences, length
- [ ] Handle edge case: events shorter than minLength * 2

### 3.3 Rhythmic Utilities

- [ ] `quantize(events, gridTicks)` — snap onsets to nearest grid point
- [ ] `swing(events, ratio, gridTicks)` — apply swing feel to even subdivisions
- [ ] `durationName(ticks, ticksPerQuarter)` — symbolic name (quarter, eighth, dotted half, etc.)
- [ ] `durationTicks(name, ticksPerQuarter)` — symbolic name to ticks

---

## 4. Tension Module

### 4.1 Roughness

- [ ] `roughness(frequencies)` — Plomp-Levelt sensory roughness
- [ ] `roughnessFromMidi(midiNotes, tuningHz?)` — convenience wrapper
- [ ] Validate frequency inputs (> 0, finite)
- [ ] Configurable harmonic count (default 6, allow override)
- [ ] Document amplitude model (1/n rolloff) and its assumptions

### 4.2 Tension Curve

- [ ] `computeTension(score, options?)` — multi-component tension analysis
- [ ] Component: roughness (psychoacoustic sensory dissonance)
- [ ] Component: metric displacement (inverse beat strength)
- [ ] Component: registral extremity (distance from pitch center)
- [ ] Component: density (event count per time window)
- [ ] Configurable component weights (default: roughness 0.3, metric 0.3, registral 0.2, density 0.2)
- [ ] Configurable sample interval (default: ticksPerQuarter)
- [ ] Configurable density window size
- [ ] Configurable registral normalization range
- [ ] All components individually accessible in output
- [ ] Output includes both tick and seconds timestamps
- [ ] Handle empty scores (return empty curve)
- [ ] Handle scores with no sounding events at sample point

### 4.3 Tension Derivatives (from PHASE spec)

- [ ] `tensionVelocity(curve)` — T'(t), first derivative (rate of tension change)
- [ ] `tensionAcceleration(curve)` — T''(t), second derivative
- [ ] `tensionIntegral(curve, startTick, endTick)` — cumulative tension over range
- [ ] `findTensionPeaks(curve)` — local maxima
- [ ] `findTensionValleys(curve)` — local minima
- [ ] `classifyTensionProfile(curve)` — categorize as ramp, plateau, release, oscillation

---

## 5. I/O Module

### 5.1 MIDI Import

- [ ] Parse Standard MIDI File format 0 (single track)
- [ ] Parse Standard MIDI File format 1 (multi-track)
- [ ] Variable-length quantity decoding with length limit (prevent infinite loop)
- [ ] Running status handling
- [ ] Note-on / note-off pairing (FIFO per pitch per channel)
- [ ] Velocity-0 note-on treated as note-off
- [ ] Meta events: tempo (0x51)
- [ ] Meta events: time signature (0x58)
- [ ] Meta events: key signature (0x59)
- [ ] Meta events: track name (0x03)
- [ ] Meta events: end of track (0x2F)
- [ ] Program change extraction
- [ ] Handle missing tempo (default 120 BPM)
- [ ] Handle missing time signature (default 4/4)
- [ ] Graceful handling of truncated/malformed files (throw descriptive error, don't crash)
- [ ] Graceful handling of orphaned note-on events (close at end of track)
- [ ] Buffer bounds checking on all reads

### 5.2 MIDI Export

- [ ] Write Standard MIDI File format 1
- [ ] Control track with time signatures and tempo changes
- [ ] One track per part with program change and track name
- [ ] Correct variable-length encoding
- [ ] Correct delta-time calculation
- [ ] Note-on and note-off events with proper velocity
- [ ] End-of-track meta event on every track
- [ ] Verify round-trip fidelity: export → import preserves all data

### 5.3 JSON Serialization

- [ ] `scoreToJSON(score)` — serialize score to plain JSON object
- [ ] `scoreFromJSON(json)` — deserialize with validation
- [ ] Schema validation on import (reject malformed data)
- [ ] Version field for forward compatibility

---

## 6. Render Module

### 6.1 Chromatic Staff SVG

- [ ] Proportional (piano-roll) layout: width = duration
- [ ] 12 lines per octave, one per semitone
- [ ] Line weights: heavy for octave boundaries (C), solid for chromatic, dashed for natural notes
- [ ] Octave band shading (alternating)
- [ ] Note blocks colored by voice/part
- [ ] Velocity mapped to opacity
- [ ] Measure lines with numbers
- [ ] Pitch labels in left margin
- [ ] Configurable options:
  - [ ] pixelsPerTick
  - [ ] pixelsPerSemitone
  - [ ] lowNote / highNote range
  - [ ] voiceColors array
  - [ ] showMeasures toggle
  - [ ] showLabels toggle
  - [ ] marginLeft / padding
- [ ] Empty score produces valid minimal SVG
- [ ] Notes outside pitch range handled (skip with optional warning)
- [ ] XML-escape all text content (part names, labels) to prevent injection
- [ ] Multiple time signatures: measure lines adapt to changes
- [ ] Valid SVG 1.1 output with proper xmlns and viewBox

### 6.2 Tension Curve SVG

- [ ] `renderTensionCurve(curve, options?)` — SVG line chart of tension over time
- [ ] Configurable: show individual components vs. total only
- [ ] Configurable: colors per component
- [ ] Time axis labels (seconds or measures)
- [ ] Y-axis label (tension 0.0 to 1.0)
- [ ] Overlay capability: tension curve + chromatic staff aligned by time axis

---

## 7. Analysis Module (New)

### 7.1 Harmonic Analysis Primitives

- [ ] `identifyChord(events)` — given simultaneous notes, return best chord label
- [ ] `identifyScale(events)` — given a passage, return most likely scale/mode
- [ ] `harmonicRhythm(score)` — detect rate of chord changes
- [ ] `romanNumeralAnalysis(chords, key)` — label chords relative to a key center

### 7.2 Melodic Analysis

- [ ] `contour(events)` — pitch contour as sequence of up/down/same
- [ ] `range(events)` — total pitch range (semitones, lowest, highest)
- [ ] `meanPitch(events)` — average MIDI value
- [ ] `intervalHistogram(events)` — frequency distribution of melodic intervals
- [ ] `stepLeapRatio(events)` — proportion of stepwise vs. leaping motion

### 7.3 Structural Analysis

- [ ] `segmentByRests(events, gapThreshold)` — split into phrases by silence
- [ ] `segmentByPattern(events)` — split at pattern boundaries
- [ ] `eventDensityCurve(score, windowSize)` — events per time window over entire score
- [ ] `registralEnvelope(score)` — highest and lowest sounding pitch over time

---

## 8. Testing

### 8.1 Coverage Targets

- [ ] Every exported function has at least one test
- [ ] Every exported type is used in at least one test
- [ ] All tests pass (`npx vitest run` exits 0) — 156 tests across 6 files
- [ ] No skipped or pending tests

### 8.2 Pitch Module Tests

- [ ] normalizePc: positive, negative, multiples of 12, large values
- [ ] pitchFromMidi: 0, 60, 69, 127, boundary octaves
- [ ] pitchToFrequency: A4=440, A5=880, C4, custom tuning
- [ ] frequencyToPitch: round-trip accuracy
- [ ] parsePitchName: C4, Bb3, F#5, edge cases (C-1, G9)
- [ ] parsePitchName: invalid input throws
- [ ] PitchClassSet: empty set operations
- [ ] PitchClassSet: single-element set
- [ ] PitchClassSet: full chromatic set (all 12)
- [ ] PitchClassSet: all 12 transpositions produce same prime form
- [ ] PitchClassSet: major and minor produce same prime form (inversional equivalence)
- [ ] PitchClassSet: difference and symmetricDifference
- [ ] PitchClassSet: isSubsetOf and isSupersetOf
- [ ] Forte catalog: spot-check at least 5 entries per cardinality (3 through 9)
- [ ] Forte catalog: reverse lookup matches forward lookup
- [ ] Voice leading: unison (distance 0)
- [ ] Voice leading: same set, different voicing
- [ ] Voice leading: mismatched sizes throws
- [ ] Voice leading: empty sets
- [ ] Voice leading: single note
- [ ] Voice leading: n=9 (greedy fallback exercised)
- [ ] Scale catalog: major scale PCS matches {0,2,4,5,7,9,11}
- [ ] Scale catalog: all 7 diatonic modes are rotations
- [ ] Chord identification: major, minor, diminished, augmented triads
- [ ] Chord identification: all seventh chord types
- [ ] Tuning: 12-TET matches standard frequencies
- [ ] Tuning: 19-TET produces 19 steps per octave
- [ ] Tuning: just intonation ratios correct for common intervals

### 8.3 Time Module Tests

- [ ] Metric levels: 4/4, 3/4, 6/8, 5/4, 7/8
- [ ] Beat strength: downbeat strongest, verify hierarchy
- [ ] Syncopation: 0 on downbeat, high on weak subdivision
- [ ] Pattern detection: exact repeats found
- [ ] Pattern detection: transposed repeats (if implemented)
- [ ] Pattern detection: no patterns in random sequence
- [ ] Pattern detection: overlapping occurrences filtered
- [ ] Pattern detection: edge case — events < minLength * 2
- [ ] Quantize: snaps to grid, preserves durations
- [ ] Swing: applies correct ratio

### 8.4 Tension Module Tests

- [ ] Roughness: single tone = 0
- [ ] Roughness: empty = 0
- [ ] Roughness: octave < fifth < third < semitone (consonance ordering)
- [ ] Roughness: known interval values within expected ranges
- [ ] Roughness: invalid frequency (0, negative) throws
- [ ] Tension curve: empty score returns empty
- [ ] Tension curve: all components in [0, 1]
- [ ] Tension curve: dissonant chord > consonant chord (roughness component)
- [ ] Tension curve: custom weights change output
- [ ] Tension curve: timestamps (tick and seconds) correct
- [ ] Tension curve: multiple tempo changes handled
- [ ] Tension velocity: positive during crescendo/build
- [ ] Tension velocity: negative during release
- [ ] Tension peaks/valleys: found at correct positions

### 8.5 I/O Module Tests

- [ ] MIDI round-trip: single note
- [ ] MIDI round-trip: chord (simultaneous notes)
- [ ] MIDI round-trip: multi-part
- [ ] MIDI round-trip: custom tempo preserved
- [ ] MIDI round-trip: custom time signature preserved
- [ ] MIDI round-trip: multiple tempo changes
- [ ] MIDI round-trip: multiple time signature changes
- [ ] MIDI: edge MIDI values (0, 127)
- [ ] MIDI: edge velocity values (1, 127)
- [ ] MIDI: malformed file throws descriptive error
- [ ] MIDI: truncated file throws descriptive error
- [ ] MIDI: format 0 file parsed correctly
- [ ] MIDI: empty tracks handled
- [ ] MIDI: orphaned note-on events closed at track end
- [ ] JSON round-trip: full score preserved
- [ ] JSON: malformed input throws with details

### 8.6 Render Module Tests

- [ ] SVG: valid XML output with xmlns
- [ ] SVG: contains note rectangles for each event
- [ ] SVG: measure lines present and numbered
- [ ] SVG: pitch labels in margin
- [ ] SVG: empty score produces valid SVG
- [ ] SVG: multiple parts use different colors
- [ ] SVG: custom options respected
- [ ] SVG: octave boundary lines heavier
- [ ] SVG: notes outside range are skipped (not rendered)
- [ ] SVG: no XSS via part names (XML escaping)
- [ ] SVG: tension curve renders valid SVG
- [ ] SVG: tension + staff overlay aligned

### 8.7 Analysis Module Tests

- [ ] Chord identification: major triad from {60, 64, 67}
- [ ] Chord identification: minor triad from {60, 63, 67}
- [ ] Scale identification: major scale
- [ ] Contour: ascending, descending, arch
- [ ] Range: correct for known passages
- [ ] Phrase segmentation: splits at rests

---

## 9. Documentation

### 9.1 README

- [ ] Library purpose and identity (what it is, what it's not)
- [ ] Installation instructions (npm)
- [ ] Quick start example (load MIDI → analyze → render)
- [ ] Module-by-module API overview with code examples
- [ ] Link to full API documentation

### 9.2 API Documentation

- [ ] JSDoc on every exported function (description, params, returns, throws, example)
- [ ] JSDoc on every exported type and interface
- [ ] JSDoc on every public method of PitchClassSet
- [ ] Document algorithm limitations in JSDoc:
  - [ ] Voice leading greedy approximation for n > 8
  - [ ] Forte catalog coverage
  - [ ] Roughness model assumptions (harmonic series, amplitude rolloff)
  - [ ] Pattern detection constraints
  - [ ] Tension component normalization approach

### 9.3 Examples

- [ ] Example: Build a score from scratch, export to MIDI
- [ ] Example: Load a MIDI file, compute tension curve
- [ ] Example: Pitch-class set analysis of a chord progression
- [ ] Example: Render a chromatic staff SVG from MIDI
- [ ] Example: Identify chords and scales in a passage
- [ ] Example: Compare tuning systems

---

## 10. Build, Packaging, and Distribution

### 10.1 Project Configuration

- [ ] `package.json` with correct name, version, description, license, repository
- [ ] `tsconfig.json` with strict mode, ESM, declarations
- [ ] `.gitignore` — node_modules, dist, .tmp, coverage, *.tgz
- [ ] `LICENSE` file (choose and include full text)

### 10.2 Build

- [ ] `npm run build` compiles TypeScript to dist/ with declarations (.d.ts)
- [ ] `npm run test` runs all tests
- [ ] `npm run lint` runs linter (ESLint with TypeScript rules)
- [ ] `npm run typecheck` runs `tsc --noEmit`
- [ ] All scripts exit 0 on clean codebase

### 10.3 Package Quality

- [ ] `main` and `types` fields point to correct dist/ files
- [ ] `exports` field maps subpath imports (e.g., `stratum/pitch`, `stratum/time`)
- [ ] `files` field limits published package to dist/ + README + LICENSE
- [ ] No dev dependencies or test files in published package
- [ ] Package installs cleanly in a fresh project (`npm install` from tarball)
- [ ] Tree-shakeable (ESM, no side effects)

### 10.4 CI Pipeline

- [ ] GitHub Actions workflow (or equivalent):
  - [ ] Lint
  - [ ] Typecheck
  - [ ] Test
  - [ ] Build
- [ ] Runs on push and pull request
- [ ] Badge in README

---

## 11. Code Quality

### 11.1 Consistency

- [ ] No duplicate exports (resolve `pitchFromMidi` duplication)
- [ ] Consistent naming convention (camelCase functions, PascalCase types/classes)
- [ ] Consistent error handling (throw Error with descriptive messages)
- [ ] Consistent parameter ordering (data first, options last)
- [ ] Consistent use of readonly/immutable where appropriate

### 11.2 Safety

- [ ] No `any` types
- [ ] No type assertions (`as`) without justification
- [ ] No silent failures (every error path throws or returns a documented sentinel)
- [ ] All user-facing text content XML-escaped in SVG output
- [ ] No global mutable state (remove `_nextId` counter or make it per-score)

### 11.3 Performance

- [ ] Forte catalog lookup is O(1) (hash map, not linear scan)
- [ ] Voice leading brute-force capped at reasonable n (8 is fine)
- [ ] MIDI parser handles files up to 10MB without hanging
- [ ] SVG renderer handles scores up to 10,000 events without hanging
- [ ] No accidental O(n³) or worse in hot paths

---

## 12. Checklist of Spec Concepts — Implemented vs. Excluded

This section maps every major implementable concept from the five specs to its status.

### From Stratum Specification

| Concept | Status | Notes |
|---------|--------|-------|
| Note event data model | Implement | Core types |
| Score structure | Implement | Core types |
| Chromatic staff rendering | Implement | Render module |
| Proportional duration view | Implement | SVG renderer |
| Rhythm grid | Implement | Metric module |
| Voice color assignment | Implement | Render options |
| Octave band shading | Implement | SVG renderer |
| Microtonal pitch (cents deviation) | Implement | Pitch type + tuning module |
| Articulation markings | Implement | NoteEvent field |
| Dynamics (velocity envelope) | Exclude | Runtime/synthesis concern |
| Spectral layer (ADSR, waveform, harmonics) | Exclude | Synthesis, not analysis |
| Modulation (vibrato) | Exclude | Synthesis |
| .stratum ZIP container | Exclude | Application-level format |
| MusicXML/MEI/ABC import-export | Exclude | Separate libraries exist |
| GUI keyboard shortcuts | Exclude | Application concern |
| Playback/audio synthesis | Exclude | DAW/audio engine concern |
| Accessibility modes | Exclude | Application concern |
| View configuration (zoom, layer toggle) | Exclude | GUI state management |
| Stem direction / beam angle / notehead geometry | Exclude | Traditional notation renderer (different project) |

### From Resonance Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Pitch class system (0-11) | Implement | Pitch module |
| Interval distance and class | Implement | Pitch module |
| Scale as pitch-class set | Implement | Scale catalog |
| Mode as rotation | Implement | Scale module |
| Chord as pitch-class set | Implement | Chord catalog |
| Set class / prime form | Implement | PitchClassSet |
| Interval structure | Implement | PitchClassSet |
| Voice-leading distance | Implement | Voice leading module |
| Forte catalog | Implement | Complete catalog |
| Compatibility layer (PC ↔ note names) | Implement | Pitch naming functions |
| Registration notation (0.4 = middle C) | Exclude | Notation convention, not computation |
| Integer spoken names (dek, el) | Exclude | Display preference, trivial |

### From Flux Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Event primitive (onset, pitch, salience, source) | Implement | NoteEvent |
| Stream (sequence of events from one source) | Implement | Part / voice |
| Pattern (repeating intervallic+durational profile) | Implement | Pattern detection |
| Tension (multidimensional deviation) | Implement | Tension module |
| Cycle (periodic structure) | Implement | Metric hierarchy |
| Motion operator (pitch/time/stream/tension) | Exclude | Compositional tool, not analysis |
| Transformation operator (T, I, R, augmentation) | Implement | PitchClassSet transforms |
| Binding operator (concurrent, sequential, hierarchical) | Exclude | Abstract, no concrete algorithm |
| Stream fission/fusion | Exclude | Requires perceptual modeling |
| Entropy / predictability measure | Exclude | Requires statistical model |
| Timbral dimensions (brightness, roughness, attack, harmonicity) | Partial | Roughness implemented; others require audio analysis |
| Microtiming offsets | Exclude | Performance analysis requiring audio |
| Polyrhythm visualization | Exclude | Specialized renderer |
| Pedagogical sequence | Exclude | Curriculum design, not code |

### From PHASE Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Tension surface T(t) | Implement | Tension curve |
| Tension derivatives T'(t), T''(t) | Implement | Tension velocity/acceleration |
| Tension integral | Implement | tensionIntegral function |
| Hierarchical prediction levels | Exclude | Requires predictive model |
| Anticipation / prediction error | Exclude | Requires statistical learning |
| Phase field (entrainment) | Exclude | Oscillator simulation |
| Synchrony channel / coupling | Exclude | Multi-agent simulation |
| Omission detection | Exclude | Requires expectation model |
| Attention-weighted impact | Exclude | Cognitive modeling |
| Swing ratio parameter | Implement | Rhythmic utility |
| Rubato tolerance | Exclude | Performance analysis |
| Coordination modes (unison, antiphonal, etc.) | Exclude | Social simulation |
| Coupling profile parameters | Exclude | COHERE domain |

### From COHERE Framework

| Concept | Status | Notes |
|---------|--------|-------|
| Consonance as coupling stability | Partial | Roughness model captures sensory component |
| Arnold tongue hierarchy | Exclude | Oscillator dynamics simulation |
| Coupling equation (Hopf bifurcation) | Exclude | Physics simulation |
| Coherence field (D, S, B, R) | Exclude | Requires oscillator network |
| Affect from coupling dynamics | Exclude | Requires coherence computation |
| Social coupling modes | Exclude | Multi-agent simulation |
| Cultural coupling profiles | Exclude | Parameterization of excluded system |
| Metrical mode-locking | Partial | Metric hierarchy captures structure; mode-locking dynamics excluded |
| Groove as cross-scale coherence | Exclude | Requires multi-scale oscillator model |
| "The drop" as coherence bifurcation | Exclude | Requires coherence field |

---

## 13. Definition of v1.0

**The library is v1.0 when:**

1. Every box in Sections 1-6 is checked (core functionality complete)
2. Every box in Section 8 is checked (comprehensive tests)
3. Every box in Section 9 is checked (documentation complete)
4. Every box in Section 10 is checked (build and packaging ready)
5. Every box in Section 11 is checked (code quality verified)
6. All tests pass
7. TypeScript compiles with zero errors and zero warnings
8. Linter passes with zero errors
9. The library can be installed in a fresh project and used without issues
10. At least one non-trivial end-to-end example works (MIDI → analysis → SVG)

**The library is NOT v1.0 if:**

- Any exported function lacks JSDoc documentation
- Any module has untested exported functions
- The Forte catalog is incomplete
- Input validation is missing on public API boundaries
- Known bugs exist without documented workarounds
- The README doesn't explain how to install and use every module

---

## Progress Tracking

**Current state (v1.0.0):**

| Section | Status | Notes |
|---------|--------|-------|
| 1. Core Data Model | 100% | All types, construction, query, and validation complete |
| 2. Pitch Module | 100% | Pitch, intervals, PCS, Forte catalog (220 entries), voice leading, scales/chords, tuning |
| 3. Time Module | 100% | Metric hierarchy, pattern detection, quantize, swing, duration utilities |
| 4. Tension Module | 100% | Roughness, multi-component curves, derivatives, peaks/valleys, classification |
| 5. I/O Module | 100% | MIDI import/export (format 0/1), JSON serialization with validation |
| 6. Render Module | 100% | Chromatic staff SVG, tension curve SVG, overlay alignment |
| 7. Analysis Module | 100% | Harmonic (chord/scale/roman numeral), melodic, structural analysis |
| 8. Testing | 100% | 156 tests across 6 files, all passing |
| 9. Documentation | 100% | README with examples for all modules, JSDoc on all exports |
| 10. Build & Packaging | 100% | ESLint, CI, subpath exports, LICENSE, CI badge in README |
| 11. Code Quality | 100% | No any types, lint clean, O(1) Forte lookup, consistent conventions |
