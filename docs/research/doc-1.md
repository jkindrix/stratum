# Music Analysis Libraries and Toolkits: Landscape Research (2024–2026)

## 1. JavaScript/TypeScript Music Libraries

### 1.1 Tonal.js

> **Repository:** [tonaljs/tonal](https://github.com/tonaljs/tonal) | **Size:** ~20kb minified, ~6kb gzipped | **Language:** TypeScript | **Style:** Functional (pure functions, no mutation)

Tonal is the most widely-used JavaScript library for symbolic music theory. It deals purely with abstractions -- no audio, no sound.

**Key Features/Modules:**

- `@tonaljs/note` -- Note parsing, MIDI number conversion, frequency calculation, transposition, enharmonic simplification
- `@tonaljs/interval` -- Interval creation, semitone counting, interval arithmetic, inversion
- `@tonaljs/scale` / `@tonaljs/scale-type` -- Scale dictionary, scale degree lookup, scale notes from root, scale detection from note sets
- `@tonaljs/chord` / `@tonaljs/chord-type` -- Chord dictionary, chord construction from symbols, chord voicing
- `@tonaljs/chord-detect` -- Given a list of notes, detect possible chord names (e.g., `Chord.detect(["D", "F#", "A", "C"])` returns `["D7"]`)
- `@tonaljs/mode` -- Greek modes dictionary (ionian, dorian, phrygian, lydian, mixolydian, aeolian, locrian)
- `@tonaljs/key` -- Major and minor key information, related scales and chords per key
- Binary set representation of pitch class sets
- Chord progressions support

**Strengths:** Modular (install only what you need), tree-shakeable, TypeScript-first, tiny bundle size, ES5/ES6 compatible, works in browser and Node.js. Largest community of the JS music theory libraries.

**What it lacks:** No notation rendering, no MIDI I/O, no audio, no file format parsing, no Roman numeral analysis, no voice leading, no counterpoint analysis.

### 1.2 Tone.js

> **Repository:** [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | **Language:** TypeScript

Tone.js is a Web Audio framework for interactive music in the browser. It is primarily an audio/DSP library, not a symbolic analysis toolkit.

**Key Features:**

- Synthesizers: FMSynth, AMSynth, NoiseSynth, PolySynth, basic Synth with oscillator + ADSR envelope
- Effects: Reverb, delay, chorus, distortion, etc.
- Transport: Global transport for synchronized scheduling
- Scheduling: Sample-accurate timing, musical time notation (`"4n"` = quarter note, `"8t"` = eighth triplet, `"1m"` = one measure)
- Musical events: `Tone.Event`, `Tone.Loop`, `Tone.Part`, `Tone.Pattern`, `Tone.Sequence`

**Relevance to symbolic analysis:** Limited. Tone.js is about sound generation and scheduling, not music theory. However, its time representation system (musical durations as strings) is a useful design pattern. Could serve as a playback engine for any symbolic analysis toolkit.

### 1.3 music21j

> **Repository:** [cuthbertLab/music21j](https://github.com/cuthbertLab/music21j) | **Language:** JavaScript (with Vite bundling)

music21j is the JavaScript port of the Python music21 toolkit. It is the most academically rigorous JS music library, though it does not have all the power of its Python parent.

**Key Features:**

- Stream visualization via VexFlow rendering
- MIDI device connectivity via Web MIDI API
- Score analysis at a lower level than Python music21
- Built-in modules: Metronomes, keyboards, automatic transcribers
- MusicXML export support
- Meter/dynamics/articulations modeling

**Strengths:** Academic pedigree (MIT), closest JS equivalent to a full musicology toolkit, can render scores in the browser, MIDI input support.

**What it lacks:** Substantially less complete than Python music21 (missing many analysis algorithms), smaller community, heavier weight.

### 1.4 Teoria.js

> **Repository:** [saebekassebil/teoria](https://github.com/saebekassebil/teoria) | **Language:** JavaScript

Teoria.js is a lightweight, fast JS library for both Jazz and Classical music theory.

**Key Features:**

- Note object (`teoria.Note`) -- alterations, octaves, key number, frequency, MIDI number
- Interval object (`teoria.Interval`) -- interval construction, semitone counting, inversion, finding intervals between notes
- Chord object (`teoria.Chord`) -- from simple major/minor to advanced jazz chords (`Ab#5b9`, `F(#11)`, etc.)
- Scale object (`teoria.Scale`) -- 7 Greek modes plus blues, flamenco, double harmonic, whole tone, major/minor pentatonic, harmonic chromatic
- Solfege support on scale objects (useful for sight-reading applications)
- Custom scale construction from arbitrary interval arrays

**Strengths:** Intuitive OOP API, jazz chord parsing is notably good, lightweight, established (since 2013).

**What it lacks:** No chord detection from note sets, no key detection, no file format support, no Roman numeral analysis, development appears less active than Tonal.js.

### 1.5 Sharp11

> **Repository:** [jsrmath/sharp11](https://github.com/jsrmath/sharp11) | **Language:** JavaScript

Sharp11 is a music theory multitool with a strong jazz focus.

**Key Features:**

- Note, chord, scale manipulation with immutable objects (methods return new objects, no mutation)
- Scale-over-chord recommendations -- generate ordered lists of scales playable over a given chord
- iRb corpus integration (via `sharp11-irb`) -- over a thousand jazz standards
- Improvisation generation (via `sharp11-improv`) -- generate improvisations over chord changes
- Probabilistic jazz harmony model (via `sharp11-jza`) -- automaton for jazz harmonic analysis
- Web Audio playback (via `sharp11-web-audio`)

**Strengths:** Unique jazz analysis capabilities (scale-over-chord, iRb corpus, improvisation), immutable design.

**What it lacks:** Narrow focus on jazz, no classical theory, no file format support, smaller community.

### 1.6 Scribbletune

> **Repository:** [scribbletune/scribbletune](https://github.com/scribbletune/scribbletune) | **Language:** JavaScript

Scribbletune is focused on music generation and MIDI export, not analysis.

**Key Features:**

- Pattern generation using simple strings and arrays to construct rhythmic/melodic patterns
- MIDI file export (via jsmidgen) -- clips exportable to Ableton Live, Reason, GarageBand, etc.
- Scale/chord names usable directly in code for note generation
- Browser compatibility with Tone.js for playback
- Clip-based composition model

**Relevance to symbolic analysis:** Minimal. Scribbletune is a composition/generation tool. Its scale/chord dictionaries are simpler than Tonal.js.

### 1.7 OpenSheetMusicDisplay (OSMD)

> **Repository:** [opensheetmusicdisplay/opensheetmusicdisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | **Language:** TypeScript

OSMD is the bridge between MusicXML and VexFlow rendering in the browser.

**Key Features:**

- MusicXML parsing (`.xml` and `.mxl` files)
- Score rendering via VexFlow in SVG
- Tablature display (guitar tabs with bends, glissandi)
- Audio player integration
- Transposition support
- Customizable rendering -- page format, font family, positioning, element visibility (title, lyrics, etc.)
- SVG node manipulation for instant visual changes (note re-coloring, etc.)

**Strengths:** Best-in-class MusicXML rendering for the browser, TypeScript with complete type information, active development.

**What it lacks:** It is a renderer, not an analyzer. No music theory operations, no harmonic analysis, no chord detection. Rendering takes noticeable time.

### 1.8 VexFlow (Bonus -- underpins OSMD and music21j)

> **Repository:** [vexflow/vexflow](https://github.com/vexflow/vexflow) | **Language:** TypeScript

VexFlow is the low-level notation rendering engine used by both OSMD and music21j.

**Key Features:**

- Canvas and SVG rendering of standard music notation
- Guitar tablature rendering
- High-level API (Factory + EasyScore) and low-level API for full control
- Customizable fonts (Bravura, Academico via separate NPM packages)
- Works in browsers and Node.js

**Relevance:** Infrastructure for rendering, not analysis. Essential companion for any toolkit that needs to display scores.

---

## 2. Python Music Analysis Libraries

### 2.1 music21

> **Repository:** [cuthbertLab/music21](https://github.com/cuthbertLab/music21) | **License:** BSD 3-clause | **Python:** 3.11+

music21 is the gold standard for symbolic music analysis in any language. Created at MIT, it is the most comprehensive computational musicology toolkit available.

**Key Features:**

#### Core Data Model

- Stream/Score/Part/Measure hierarchical containers
- Note, Chord, Rest, Clef, TimeSignature, KeySignature objects
- Offset-based positioning (quarter-note units)

#### Harmonic Analysis

- Roman numeral analysis via `RomanNumeral` class -- create from figures, detect from chords
- `romanNumeralFromChord()` -- automatic chord-to-Roman-numeral conversion with key context
- RomanText format reading/writing for encoding harmonic analyses
- Functionality scoring -- `RomanNumeral.functionalityScore` (0-100 approximation of harmonic function)
- Chord identification and normal form computation

#### Voice Leading & Counterpoint

- Parallel fifths/octaves detection
- Voice leading pattern analysis (how specific scale degrees move in given progressions)
- Species counterpoint checking capabilities

#### Meter & Rhythm

- TimeSignature with hierarchical modeling (display, beam, beat, accent attributes)
- Unlimited partitioning and nesting for compound, complex, additive meters
- Beat position and accent level reporting
- Algorithmic multi-level beaming

#### File Formats

- MusicXML read/write
- MIDI read/write
- Humdrum kern read
- ABC notation read
- MuseData read
- Romantext read/write

#### Corpus

- Built-in corpus of thousands of works
- Corpus search and metadata querying

#### Additional

- Pitch class set operations
- Interval analysis
- Scale and mode identification
- Figured bass realization
- Contour analysis
- Windowed analysis for large-scale form

**Strengths:** Most complete symbolic music analysis toolkit in existence. Academic standard. Massive corpus. Handles real musicological research questions.

**What it lacks:** Python-only (no JS equivalent with full parity), can be slow for very large corpora, no audio analysis.

### 2.2 librosa

> **Repository:** [librosa/librosa](https://github.com/librosa/librosa) | **License:** ISC

librosa is primarily an audio signal analysis library, not symbolic. Included here because some of its concepts are relevant.

**Key Features (relevant to symbolic analysis concepts):**

- Chroma features -- energy distribution across 12 pitch classes (the audio-domain equivalent of pitch class analysis)
- Beat tracking and tempo estimation -- rhythmic structure analysis
- Onset detection -- identifying musical event boundaries
- Harmonic-percussive separation -- distinguishing pitched vs. unpitched content
- Tonnetz features -- tonal centroid features representing harmonic relations
- Spectral analysis -- spectrograms, chromagrams, mel-spectrograms

**Relevance to symbolic analysis:** librosa operates on audio, but many of its analysis concepts (chroma, tonnetz, beat structure) have direct symbolic counterparts. Understanding what librosa provides helps identify what a symbolic toolkit should also cover, just operating on note data rather than audio.

### 2.3 pretty_midi

> **Repository:** [craffel/pretty-midi](https://github.com/craffel/pretty-midi)

pretty_midi makes handling MIDI data intuitive in Python.

**Key Features:**

- MIDI file parsing with intuitive API
- Piano roll generation at configurable sample frequencies
- Beat and downbeat extraction from MIDI tempo maps
- Key and time signature extraction
- Instrument information -- programs, channels, names
- Note-level access -- pitch, velocity, start time, end time, duration
- Pitch bend and control change data
- Transposition and manipulation of MIDI data
- Synthesis via sine waves or FluidSynth with SoundFonts

**Strengths:** Best Python library for MIDI manipulation specifically. Clean API. Piano roll representation is extremely useful for ML applications.

**What it lacks:** No music theory operations (no chord detection, no scale analysis, no harmonic analysis). Purely a MIDI data access layer.

### 2.4 MIDIUtil

> **Repository:** [MarkCWirt/MIDIUtil](https://github.com/MarkCWirt/MIDIUtil) | **License:** MIT

MIDIUtil is a pure Python library for creating (not analyzing) MIDI files.

**Key Features:**

- Multi-track MIDI file creation (Format 1 and Format 2)
- Note addition with pitch, time, duration, volume parameters
- Tempo changes and time signature events
- Program changes (instrument selection)
- Control changes
- Pitch bend events
- Separate tempo track in Format 1

**Relevance to symbolic analysis:** Output-only. Useful as a companion for exporting analysis results or generated music to MIDI, but provides zero analysis capability.

### 2.5 mingus

> **Repository:** [bspaans/python-mingus](https://github.com/bspaans/python-mingus)

mingus is a cross-platform music theory and notation package.

**Key Features:**

- Note/Interval/Chord/Scale/Key/Meter core theory objects
- Chord recognition -- triads, sevenths, sixths, ninths, elevenths, thirteenths, slashed chords, altered chords
- Shorthand notation parsing (e.g., `"CM7"`, `"Am6"`, `"Ab7"`, `"G7"`)
- Scale recognition from note lists
- Interval recognition from note pairs
- Export: LilyPond, MusicXML, ASCII tablature
- Audio analysis via FFT (`mingus.extra`)
- FluidSynth playback for real-time synthesis

**Strengths:** Good balance between theory and practical output. Hundreds of chord types recognized. Multiple export formats.

**What it lacks:** No Roman numeral analysis, no voice leading analysis, no corpus tools, no hierarchical stream model like music21. Less actively maintained than music21.

### 2.6 Abjad

> **Repository:** [Abjad/abjad](https://github.com/Abjad/abjad) | **Python:** 3.12+ | **Requires:** LilyPond 2.25.26+

Abjad is a Python API for building LilyPond notation files, focused on algorithmic composition.

**Key Features:**

- Bottom-up score construction -- notes, rests, chords grouped into tuplets, measures, voices, staves, scores
- Rhythm-makers and rhythm transformation tools
- Meter rewriting and quantization
- Component selectors for locating musical objects in a score
- LilyPond output for publication-quality typesetting
- Iterative/incremental composition workflow
- Extensions for documentation, command-line tools, IPython integration

**Relevance to symbolic analysis:** Abjad is a composition tool, not an analysis tool. It excels at generating and manipulating complex notation but does not analyze existing music.

### 2.7 Partitura

> **Repository:** [CPJKU/partitura](https://github.com/CPJKU/partitura) | **Paper:** ISMIR 2022

Partitura is purpose-built for symbolic music processing for machine learning.

**Key Features:**

- File format support: MusicXML, MIDI, Humdrum kern, MEI (plus MuseScore backend for MuseData, GuitarPro, etc.)
- Note arrays -- lists of timed pitched events in NumPy-friendly format
- Piano roll matrices -- 2D representations at configurable resolution
- Score element access -- time signatures, key signatures, performance directives, repeat structures
- Automatic pitch spelling
- Key signature identification
- Voice separation algorithms
- Performance-to-score alignment -- a capability unique among these libraries
- MIDI performance modeling

**Strengths:** ML-first design (note arrays, piano rolls as first-class output). Score-to-performance alignment is unique. Broad file format support. Fast feature extraction.

**What it lacks:** Less deep music theory than music21 (no Roman numeral analysis, no counterpoint checking). Focused on feature extraction rather than theory operations.

---

## 3. Academic/Research Tools

### 3.1 Humdrum Toolkit

> **Website:** <https://www.humdrum.org/> | **Created by:** David Huron (1980s)

Humdrum is the original computational musicology toolkit, still in active use.

**Key Features:**

- `**kern` representation -- symbolic music encoding focused on functional (not visual) information
- Command-line tools -- program-language agnostic, pipeable Unix-style
- Pitch encoding -- diatonic names (A-G), octave by case/repetition, accidentals (`#`, `-`, `n`)
- Duration encoding -- reciprocal values (`4` = quarter note, `8` = eighth note)
- Multi-part encoding with null tokens for sustained notes (grid structure)
- Barline encoding with structural markers
- Kern Scores -- large public corpus of encoded scores
- Verovio Humdrum Viewer (VHV) -- web-based editor with analysis tool subset

**Analysis Capabilities:**

- Interval analysis
- Melodic pattern search
- Harmonic analysis
- Dissonance detection (via dissonant tool)
- Statistical corpus studies
- Music similarity algorithms

**Strengths:** Decades of scholarly use. Massive kern corpus. Designed by a musicologist for musicologists. Text-based format is grep-friendly and scriptable.

**What it lacks:** CLI-only (steep learning curve), text-based representation is less intuitive than object models, no native GUI.

### 3.2 jSymbolic

> **Website:** <https://jmir.sourceforge.net/jSymbolic.html> | **Part of:** jMIR suite | **Language:** Java

jSymbolic is the most extensive symbolic music feature extractor available.

**Key Features:**

- 246 unique features comprising 1,497 different values
- Feature categories:
  - Pitch statistics (range, mean, variance, pitch class histogram, etc.)
  - Melodic intervals (step/leap ratios, contour, interval distributions)
  - Chords and vertical intervals (chord type distributions, vertical density)
  - Rhythm (note duration distributions, syncopation measures, tempo)
  - Instrumentation (instrument counts, program distributions)
  - Texture (polyphony, voice crossing, density)
  - Dynamics (velocity distributions, dynamic range)
- File formats: MIDI, MEI
- Windowed extraction (configurable window size and overlap)
- GUI, CLI, and API interfaces
- Direct ML pipeline integration (output for classifiers)

**Strengths:** By far the most comprehensive feature extraction for symbolic music. Designed for ML-driven musicological research (style/genre/composer identification).

### 3.3 JAMS (JSON Annotated Music Specification)

> **Repository:** [marl/jams](https://github.com/marl/jams) | **Paper:** ISMIR 2014

JAMS is a data format and Python library for music annotations.

**Key Features:**

- JSON-based annotation format -- human-readable, language-agnostic
- Multi-task annotations -- multiple annotation types per track (beats, chords, segments, melody, etc.)
- Multiple annotators -- support for multiple annotations of the same task
- Formal schema with validation
- Software wrapper with autocomplete and syntax checking
- Namespace system for different annotation vocabularies (chord symbols, beat times, segment labels, etc.)

**Relevance to symbolic analysis:** JAMS is not an analysis tool itself but defines how analysis results should be stored and exchanged. Any serious analysis toolkit should consider JAMS-compatible output.

### 3.4 mir_eval

> **Repository:** [mir-evaluation/mir_eval](https://github.com/mir-evaluation/mir_eval)

mir_eval provides standardized evaluation metrics for MIR tasks.

**Supported Evaluation Tasks:**

- Beat detection metrics
- Chord estimation metrics (thirds, triads, tetrads, inversions, root)
- Pattern discovery metrics
- Structural segmentation metrics
- Melody extraction metrics (raw pitch accuracy, voicing)
- Onset detection metrics
- Key estimation metrics
- Tempo estimation metrics

**Additional Modules:**

- `mir_eval.io` -- loading annotations from common file formats
- `mir_eval.sonify` -- synthesizing annotations for "evaluation by ear"
- `mir_eval.display` -- plotting annotations

**Relevance to symbolic analysis:** Like JAMS, mir_eval is not an analyzer but defines how to measure analysis quality. Essential for benchmarking any analysis algorithm.

### 3.5 Essentia

> **Repository:** [MTG/essentia](https://github.com/MTG/essentia) | **Language:** C++ with Python/JS bindings

Essentia is primarily an audio analysis library but included because of its MIR significance.

**Key Features (relevant concepts for symbolic analysis):**

- Tonal descriptors: pitch salience, predominant melody, HPCP/chroma, chord detection, key/scale estimation, tuning frequency
- Rhythm descriptors: beat detection, BPM, onset detection, rhythm transform, beat loudness
- Deep learning integration for high-level descriptors
- JavaScript bindings (`essentia.js`) for browser-based analysis

**Relevance to symbolic analysis:** Essentia's tonal and rhythmic analysis categories map directly to symbolic analysis needs. Key detection, chord detection, beat analysis, and onset detection all have symbolic counterparts.

### 3.6 MIRFLEX (2024)

> **Paper:** [arXiv:2411.00469](https://arxiv.org/abs/2411.00469)

A newer unified feature extraction library for MIR research, integrating state-of-the-art models for key detection, downbeat detection, genre classification, and instrument recognition. Modular design for easy benchmarking.

---

## 4. Feature Classification: Table Stakes vs. Differentiating

Based on analysis of all libraries above, here is a classification of features for a symbolic music analysis toolkit:

### Table Stakes

Expected by all users -- every serious toolkit must have these.

| Feature | Who Has It | Notes |
|---------|-----------|-------|
| Note representation (pitch, duration, octave, accidental) | All libraries | Absolute minimum |
| Interval calculation (between notes, semitone distance) | Tonal, Teoria, Sharp11, music21, mingus | Core building block |
| Scale dictionary (major, minor, modes, common scales) | Tonal, Teoria, Sharp11, music21, mingus | Must include at minimum the 7 modes + pentatonic + blues |
| Chord dictionary (triads, sevenths, extended) | Tonal, Teoria, Sharp11, music21, mingus | Must handle at least maj/min/aug/dim + 7ths |
| Chord construction from root + quality | Tonal, Teoria, music21, mingus | Build a chord from its name |
| Note transposition | All theory libraries | Fundamental operation |
| Key signature representation | Tonal, music21, Humdrum | Sharps/flats, relative major/minor |
| MIDI number <-> note name conversion | Tonal, Teoria, music21, pretty_midi | Essential bridge to MIDI ecosystem |
| Frequency <-> note conversion | Tonal, Teoria | A4=440 tuning and variants |
| Enharmonic equivalence | Tonal, music21, Teoria | C# = Db handling |

### Expected by Serious Users

Most analysis-focused toolkits have these.

| Feature | Who Has It | Notes |
|---------|-----------|-------|
| Chord detection from note set | Tonal (`chord-detect`), music21, mingus | "What chord are these notes?" |
| Scale detection from note set | music21, Tonal (partial) | "What scale fits these notes?" |
| Key detection from melodic/harmonic content | music21, Essentia (audio) | Critical for analysis |
| Roman numeral analysis | music21 | Chord function in context of key |
| Pitch class set operations | music21 | Normal form, prime form, Forte numbers |
| Interval class vector | music21 | Set theory analysis |
| File format I/O (MusicXML, MIDI at minimum) | music21, Partitura, pretty_midi | Must read real-world music data |
| Stream/container model for multi-voice music | music21, Partitura | Notes in context of parts, measures, beats |
| Time signature handling | music21, Tonal (basic) | Beat grouping, compound/simple meter |
| Piano roll representation | pretty_midi, Partitura | Essential for ML pipelines |
| Notation rendering | music21j+VexFlow, OSMD, Abjad+LilyPond | Visual verification of analysis |

### Differentiating

Distinguishes research-grade from hobbyist toolkits.

| Feature | Who Has It | Notes |
|---------|-----------|-------|
| Voice leading analysis | music21 | Parallel fifths/octaves detection, tendency tone resolution |
| Counterpoint checking | music21, Humdrum | Species counterpoint rules |
| Corpus tools | music21, Humdrum, jSymbolic | Statistical analysis across many works |
| Automatic pitch spelling | Partitura | MIDI note -> correct enharmonic in context |
| Voice separation | Partitura | Decomposing polyphonic MIDI into voices |
| Score-to-performance alignment | Partitura | Matching MIDI performance to written score |
| Hierarchical meter modeling | music21 | Multi-level beat/accent structures |
| Figured bass realization | music21 | Historically-informed analysis |
| Contour analysis | music21 | Melodic shape classification |
| Jazz-specific analysis (chord-scale theory, improvisation) | Sharp11 | Scale-over-chord recommendations, ii-V-I patterns |
| Feature extraction pipelines (246+ features) | jSymbolic | ML-ready musicological feature sets |
| Standardized evaluation metrics | mir_eval | Benchmarking analysis quality |
| Annotation interchange format | JAMS | Reproducible research |
| Windowed/temporal analysis | jSymbolic, music21 | How features change over time |
| Functional harmony scoring | music21 | How "functional" is a given chord in context |

---

## 5. Summary: What Capabilities Serious Musicologists Expect

Based on this research, a musicologist evaluating a symbolic music analysis toolkit would expect, at minimum:

1. Robust pitch/interval/chord/scale primitives -- these are universal across all libraries
2. Contextual analysis -- chords in the context of a key (Roman numerals, functional harmony)
3. Voice leading -- detecting parallel motion, checking counterpoint rules
4. File format support -- at least MusicXML and MIDI, ideally also kern and MEI
5. Hierarchical data model -- notes within measures within parts within scores (not flat lists)
6. Corpus search -- ability to query across multiple works
7. Statistical feature extraction -- pitch distributions, interval distributions, rhythmic patterns
8. Pitch class set operations -- for post-tonal analysis
9. Notation output -- ability to visualize results
10. Reproducible methodology -- standardized formats (JAMS), evaluation metrics (mir_eval)

The gap in the JavaScript ecosystem is striking: no JS library comes close to music21's analytical depth. Tonal.js handles primitives well but stops at chord detection. music21j is the closest but is explicitly described as having less power than its Python parent. There is no JS library that does Roman numeral analysis, voice leading checking, corpus analysis, or hierarchical meter modeling at the level music21 provides in Python.

---

## Sources

- [Tonal.js GitHub](https://github.com/tonaljs/tonal)
- [Tonal.js Documentation](https://tonaljs.github.io/tonal/docs)
- [Tone.js Website](https://tonejs.github.io/)
- [Tone.js GitHub](https://github.com/Tonejs/Tone.js)
- [music21j GitHub](https://github.com/cuthbertLab/music21j)
- [Teoria.js GitHub](https://github.com/saebekassebil/teoria)
- [Sharp11 GitHub](https://github.com/jsrmath/sharp11)
- [Scribbletune GitHub](https://github.com/scribbletune/scribbletune)
- [OpenSheetMusicDisplay GitHub](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)
- [VexFlow GitHub](https://github.com/vexflow/vexflow)
- [music21 GitHub](https://github.com/cuthbertLab/music21)
- [music21 Documentation](https://music21.org/music21docs/)
- [music21 Roman Numerals User Guide](https://www.music21.org/music21docs/usersGuide/usersGuide_23_romanNumerals.html)
- [librosa GitHub](https://github.com/librosa/librosa)
- [pretty_midi GitHub](https://github.com/craffel/pretty-midi)
- [MIDIUtil on PyPI](https://pypi.org/project/MIDIUtil/)
- [python-mingus Documentation](https://bspaans.github.io/python-mingus/)
- [Abjad Documentation](https://abjad.github.io/)
- [Partitura GitHub](https://github.com/CPJKU/partitura)
- [Partitura Paper (arXiv:2206.01071)](https://arxiv.org/abs/2206.01071)
- [Humdrum Toolkit](https://www.humdrum.org/)
- [jSymbolic](https://jmir.sourceforge.net/jSymbolic.html)
- [JAMS GitHub](https://github.com/marl/jams)
- [mir_eval GitHub](https://github.com/mir-evaluation/mir_eval)
- [Essentia GitHub](https://github.com/MTG/essentia)
- [MIRFLEX Paper (arXiv:2411.00469)](https://arxiv.org/abs/2411.00469)
- [ISMIR Software Tools](https://ismir.net/resources/software-tools/)
- [MIT Computational Music Theory & Analysis](https://musictech.mit.edu/cmta/)
- [Music Information Retrieval (Wikipedia)](https://en.wikipedia.org/wiki/Music_information_retrieval)
- [MIR Survey (arXiv:2507.15590)](https://arxiv.org/html/2507.15590v1)
