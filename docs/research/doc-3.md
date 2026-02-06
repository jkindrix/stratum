# Music Data Formats, Interoperability Standards, and Ecosystem Integration Research

## 1. Music Notation Formats

### MusicXML (Current Version: 4.0)

Status: The dominant interchange standard. [MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/) was released in June 2021 by the W3C Music Notation Community Group.

Capabilities in v4.0: Over 50 new features compared to v3.1, including:

- Concert scores (score and parts in a single file)
- Score following and machine listening applications
- Swing playback support
- Improved Roman numeral analysis support
- W3C XML Schema replaces deprecated DTD definitions

Adoption: As of September 2024, [over 270 applications](https://www.musicxml.com/software/) support MusicXML interchange. Every major notation program (MuseScore, Finale, Sibelius, Dorico) supports it natively. It is the undisputed de facto standard for digital score exchange.

JavaScript ecosystem: Several libraries exist:

- [musicxml-interfaces](https://github.com/jocelyn-stericker/musicxml-interfaces) -- low-level parse/serialize/build/patch
- [musicxml (TypeScript)](https://github.com/stringsync/musicxml) -- TypeScript MusicXML wrapper
- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) -- full browser/Node.js rendering from MusicXML
- [vexflow-musicxml](https://github.com/bneumann/vexflow-musicxml) -- VexFlow-backed parser and renderer

Assessment for a symbolic music analysis library:

| Criterion | Rating |
|---|---|
| Adoption level | Extremely high -- universal standard |
| Complexity to implement | Moderate-high (XML-based, large schema, many optional elements) |
| Value to users | Critical -- must-have for any serious toolkit |

---

### MEI (Music Encoding Initiative)

Status: The academic/research counterpart to MusicXML. Maintained by the [Music Encoding Initiative](https://music-encoding.org/about/).

Key differences from MusicXML:

- Designed to capture semantics, not just rendering instructions
- Rich metadata support (watermark, distributor, accessRestrict, versioning, sections)
- Supports notation systems beyond Common Western Notation (mensural, neume notation)
- Preferred by the [Library of Congress](https://guides.lib.utexas.edu/music-notation-preferred-preservation-formats-for-digital-scores/music-encoding-initiative) for digital preservation of scores

Adoption: Strong in academia and digital humanities. Not natively supported by major commercial notation software -- must be converted to/from MusicXML.

Assessment:

| Criterion | Rating |
|---|---|
| Adoption level | Moderate -- primarily academic/research/archives |
| Complexity to implement | High (rich XML schema, scholarly annotations) |
| Value to users | High for research use cases; lower for everyday music analysis |

---

### ABC Notation

Status: A plain-text notation format. [ABC Standard v2.1](https://abcnotation.com/wiki/abc:standard:v2.1). Originally designed for folk and traditional music.

Format characteristics:

- Extremely human-readable (plain text, no XML/JSON overhead)
- Header fields: `X:` (index), `T:` (title), `M:` (time signature), `L:` (default note length), `K:` (key)
- Notes as ASCII characters: `CDEFGABc` with duration modifiers

Software support: [Many applications](https://abcnotation.com/software) across platforms. Key JS tools:

- [abcjs](https://abcnotation.com/software) -- renders ABC notation in web pages
- abc2xml web service converts ABC to MusicXML
- [music21 ABC module](https://www.music21.org/music21docs/moduleReference/moduleAbcFormat.html) provides Python parsing

Assessment:

| Criterion | Rating |
|---|---|
| Adoption level | Moderate -- strong in folk/traditional music communities |
| Complexity to implement | Low (simple text parsing, well-defined grammar) |
| Value to users | Moderate -- easy input format, good for simple melodies |

---

### LilyPond Format

Status: A [text-based music engraver](http://lilypond.org/) that produces publication-quality typeset music.

Key characteristics:

- Plain text input with Helmholtz pitch notation
- Embeddable Scheme code for algorithmic composition
- Command-line tool, not a GUI -- ideal for batch processing and automation
- Can import MusicXML
- Produces the highest quality music typesetting of any open-source tool

Assessment:

| Criterion | Rating |
|---|---|
| Adoption level | Moderate -- strong in open-source and academic communities |
| Complexity to implement | Moderate-high (complex grammar with Scheme extensions) |
| Value to users | Moderate -- primarily an output/rendering format rather than analysis input |

---

### Humdrum \*\*kern

Status: A [music representation format](https://www.humdrum.org/rep/kern/) developed by David Huron for computational musicology.

Key characteristics:

- Designed for analytical applications rather than printing or sound generation
- Encodes functional information (pitch, duration, accidentals, articulation, ties, slurs, beaming)
- Represents underlying musical structure, not visual layout
- Extensive [toolkit and documentation](https://www.humdrum.org/) available

Assessment:

| Criterion | Rating |
|---|---|
| Adoption level | Moderate -- primary format in computational musicology |
| Complexity to implement | Moderate (text-based, column-oriented, well-documented) |
| Value to users | High for analysis-focused users; large existing corpora |

---

### MNX (Next-Generation Format — In Development)

Status: A [next-generation notation format](https://w3c.github.io/mnx/docs/) being developed by the same group that maintains MusicXML. JSON-based.

Key goals:

- JSON format instead of XML
- Designed to work as a native format for software (unlike MusicXML which was primarily for interchange)
- Supports all of Common Western Musical Notation
- Prioritizes unambiguous encoding and parsing
- [Conversion tools](https://github.com/w3c/mnxconverter) exist for MusicXML to MNX translation

Assessment: Not yet stable enough to implement. Worth monitoring. When finalized, MNX could become the primary target format for a JSON-native toolkit.

---

### Interoperability Priority Ranking

For a comprehensive music analysis toolkit, format support should be prioritized as:

1. MusicXML (critical -- universal interchange standard)
2. MIDI (critical -- universal performance data standard)
3. Humdrum \*\*kern (high -- analysis-native format with large corpora)
4. ABC Notation (moderate -- easy to parse, good for simple input)
5. MEI (moderate -- academic/preservation value)
6. LilyPond (lower -- primarily useful as output, not input)
7. MNX (future -- monitor and implement when stable)

---

## 2. MIDI Advances

### MIDI 2.0 Specification

Released: Formally adopted January 2020, [updated June 2023](https://midi.org/details-about-midi-2-0-midi-ci-profiles-and-property-exchange-updated-june-2023).

Major new capabilities:

| Feature | Details |
|---|---|
| Universal MIDI Packet (UMP) | Messages of 32, 64, 96, or 128 bits. Supports 256 channels (16 groups x 16 channels). Each group can carry MIDI 1.0 or 2.0 protocol streams. |
| Higher Resolution | 32-bit velocity, 32-bit controller values (vs. 7-bit in MIDI 1.0) |
| Per-Note Controllers | Articulation, pitch bend, and expression per individual note |
| MIDI-CI | Capability Inquiry -- devices negotiate capabilities automatically |
| Profiles | Dynamic device configuration (e.g., "mixer" profile auto-maps controls to faders; "drawbar organ" maps to drawbars) |
| Property Exchange | Devices can query and set properties bidirectionally |
| MIDI Clip File (SMF2) | New standard MIDI file format for MIDI 2.0 data |
| Backward Compatibility | Full MIDI 1.0 backward compatibility is maintained |

Adoption status (as of 2025-2026): [Early but growing](https://www.musicradar.com/news/what-is-midi-20-and-what-does-it-mean-for-musicians-and-producers). Major manufacturers (Yamaha, Roland, Korg) have shown prototypes. Apple added MIDI 2.0 support in macOS/iOS at the OS level. However, widespread commercial product adoption is still in early stages. There are no mature MIDI 2.0 JavaScript libraries on npm -- existing libraries (jsmidgen, JZZ.js, MIDIVal, node-midi) all target MIDI 1.0.

### MPE (MIDI Polyphonic Expression)

Status: [An adopted MIDI specification](https://midi.org/mpe-midi-polyphonic-expression). Built on MIDI 1.0 (uses per-channel allocation for per-note expression).

DAW support: Now a standard feature in [most major DAWs](https://www.soundonsound.com/sound-advice/mpe-midi-polyphonic-expression), and others. Hardware support from ROLI, Sensel, Linnstrument, ASM Hydrasynth, Modal instruments.

Assessment for a music analysis toolkit:

| Criterion | Rating |
|---|---|
| MIDI 1.0 support | Critical -- must-have |
| MPE support | High -- well-adopted, valuable for expressive music analysis |
| MIDI 2.0 support | Low priority now -- implement parsing/awareness but full support can wait for ecosystem maturation |

---

## 3. Music Data Standards

### JAMS (JSON Annotated Music Specification)

Status: [Well-documented Python library](https://jams.readthedocs.io/en/stable/), maintained at [github.com/marl/jams](https://github.com/marl/jams). Published at ISMIR 2014.

Core principles: Simplicity, structure, sustainability.

Structure:

- JSON-based (language-agnostic, human-readable)
- Supports multiple annotation types per file (chords, beats, segments, keys, etc.)
- Multiple annotations for the same task (different annotators)
- Rich metadata and provenance tracking
- Formal schema with validation

Adoption: Standard in MIR (Music Information Retrieval) research. Used by MARL (Music and Audio Research Lab at NYU), many ISMIR datasets.

Assessment:

| Criterion | Rating |
|---|---|
| Adoption level | High in MIR research |
| Complexity to implement | Low (JSON format, well-documented schema) |
| Value to users | Very high -- natural fit for a music analysis library's output format |

### RomanText Format

Status: [Introduced at ISMIR 2019](https://archives.ismir.net/ismir2019/paper/000012.pdf) by Tymoczko, Gotham, Cuthbert, and Ariza.

Purpose: Standard representation for Roman numeral harmonic analyses.

Key features:

- Human-readable and computer-parsable
- Supported by [music21](https://www.music21.org/music21docs/usersGuide/usersGuide_23_romanNumerals.html) (`.rntxt` format)
- Captures key, time signature, and Roman numeral progression with measure numbers
- Handles alterations, inversions, complex chord structures

Assessment:

| Criterion | Rating |
|---|---|
| Adoption level | Moderate -- growing in music theory/MIR |
| Complexity to implement | Low (line-oriented text format, clear syntax) |
| Value to users | High -- directly relevant to harmonic analysis output |

### Humdrum \*\*kern (as data standard)

Already covered above. Its dual role as both a notation format AND an analysis data format makes it especially relevant. The [Humdrum](https://www.humdrum.org/) archive contains thousands of encoded compositions.

### ChordLab / Chord Annotation Formats

Based on research, "ChordLab" is primarily a [chord transcription tool](http://chordlab.org/) rather than a formal data interchange format. The relevant chord annotation formats in the ecosystem are:

- Christopher Harte's chord notation (used in MIREX, many MIR datasets): `root:quality(extensions)/bass`
- ChordPro format: standard for chord sheets (text + chords)
- JAMS chord annotations: structured JSON with time intervals
- Nashville Number System: function-based chord notation

---

## 4. Integration with DAWs and Notation Software

### Notation Software Exchange

| Software | Native Format | MusicXML | MIDI | Other Interchange |
|---|---|---|---|---|
| MuseScore | `.mscz` | Full import/export (`.musicxml`, `.mxl`) | Import/export | MEI export, PDF, audio |
| Finale | `.musx`/`.mus` | [Full import/export](https://makemusic.zendesk.com/hc/en-us/articles/16458439555479) | Import/export | ENIGMA (`.etf`) |
| Sibelius | `.sib` | [Full import/export](https://www.scoringnotes.com/reviews/sibelius-2020-6/) | Import/export | PhotoScore (scanning) |
| Dorico | `.dorico` | [Full import/export](https://blog.dorico.com/musicxml-export-and-import/) | Import/export | Cubase integration |

Key finding: MusicXML is the sole universal interchange format for notation software. All four major programs use proprietary native formats, making MusicXML the only viable bridge.

### DAW Exchange

| DAW | MusicXML | MIDI | Other Exchange Formats |
|---|---|---|---|
| Ableton Live | [Not native (user-requested)](https://forum.ableton.com/viewtopic.php?t=75915) | Full | ALS (proprietary), Max for Live API, OSC |
| Logic Pro | Not native | Full | AAF, OMF, Final Cut XML |
| Pro Tools | Not native | Full | AAF, OMF |
| Cubase/Nuendo | MusicXML export | Full | AAF, Dorico integration |
| Bitwig | Not native | Full | OSC, CLAP/VST |

Key finding: DAWs primarily exchange data via MIDI files and audio stems. MusicXML is not a DAW interchange format (Ableton users have [requested it](https://forum.ableton.com/viewtopic.php?t=75915) without success). The Ableton Live API is accessible through [Max for Live](https://docs.cycling74.com/legacy/max8/vignettes/live_api_overview).

Implication for a music analysis toolkit: MIDI is the bridge to DAWs. MusicXML is the bridge to notation software. Supporting both is essential.

---

## 5. Web Audio and Web MIDI

### Web MIDI API

Specification: [W3C Web MIDI API](https://www.w3.org/TR/webmidi/), developed by the Audio Working Group.

Browser support (2025-2026):

| Browser | Support |
|---|---|
| Chrome/Edge/Opera | Full support (since Chrome 43) |
| Firefox | [Behind a flag / limited](https://www.lambdatest.com/web-technologies/midi-firefox) |
| Safari | [Not supported](https://www.lambdatest.com/web-technologies/midi-safari) -- Apple declined due to fingerprinting concerns (2020) |

Key libraries:

- [WEBMIDI.js](https://webmidijs.org/) -- high-level abstraction over the Web MIDI API with friendly functions (`playNote`, `sendPitchBend`, etc.) and event listeners (`noteon`, `pitchbend`, `controlchange`)
- [JZZ.js](https://jazz-soft.net/doc/JZZ/) -- works in Node.js and browsers with chaining syntax
- Browser extension polyfills available for [web-midi (jazz-soft)](https://github.com/jazz-soft/web-midi)

Assessment: Web MIDI is viable for Chrome/Edge/Firefox. The Safari gap is significant but manageable with polyfills or Node.js usage. For a library that runs in Node.js, Web MIDI is less relevant (use node-midi or similar); for browser-based tools, it is valuable but limited by Safari's absence.

### Web Audio API

Specification: [Web Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), universally supported in all modern browsers.

Relevant capabilities for music analysis:

- `AnalyserNode` -- real-time frequency and time-domain analysis
- `AudioWorklet` -- custom audio processing in dedicated threads
- Full audio graph routing and processing

Key analysis libraries built on Web Audio:

- [Essentia.js](https://mtg.github.io/essentia.js/) -- comprehensive audio feature extraction (C++ via WebAssembly). Supports pitch detection, beat tracking, spectral analysis, and more.
- [Meyda](https://meyda.js.org/) -- audio feature extraction for timbre and perceptual qualities. Works with Web Audio API or plain arrays.
- [Tone.js](https://tonejs.github.io/) -- interactive music creation framework

Assessment for a symbolic music analysis library:

| Criterion | Rating |
|---|---|
| Web Audio integration | Moderate value -- useful for audio-to-symbolic bridges (pitch detection, onset detection) |
| Web MIDI integration | High value -- real-time MIDI input/output for interactive analysis |
| Implementation complexity | Low for MIDI (Web MIDI API is simple); Moderate for Audio (depends on scope) |

---

## 6. OSC (Open Sound Control)

Status: [Developed at CNMAT, UC Berkeley](https://www.cnmat.berkeley.edu/opensoundcontrol). A UDP-based protocol for real-time messaging between music applications and hardware.

Advantages over MIDI 1.0:

- Open-ended URL-style symbolic naming scheme (e.g., `/synth/1/filter/cutoff`)
- High-resolution numeric argument data (`float32`, `int32`, strings, blobs)
- Pattern matching for addressing multiple recipients
- High-resolution time tags and message bundles (simultaneous delivery)

Software support: [Widely adopted](https://en.wikipedia.org/wiki/Open_Sound_Control), and many more.

JavaScript libraries:

- [osc.js](https://github.com/colinbdclark/osc.js/) -- works in browser and Node.js, supports WebSocket transport, fully spec-compliant
- [osc-js](https://github.com/adzialocha/osc-js) -- UDP, WebSocket, and bridge mode; customizable Plugin API

Assessment for a music analysis toolkit:

| Criterion | Rating |
|---|---|
| Adoption level | High in live performance, installations, multimedia |
| Complexity to implement | Low (simple message format; good JS libraries exist) |
| Value to users | Moderate -- valuable for real-time analysis output streaming to visualizers, DAWs, and live performance tools. Less relevant for offline/batch symbolic analysis. |

Recommendation: OSC is a "nice-to-have" output transport. It is not a data format per se -- it is a real-time communication protocol. For a symbolic music analysis library, supporting OSC output would allow users to stream analysis results (detected chords, beats, key changes) to other applications in real time. This is a differentiating feature but not a core requirement.

---

## Summary Assessment Matrix

| Format/Standard | Adoption | Impl. Complexity | Value for Symbolic Analysis | Priority |
|---|---|---|---|---|
| MusicXML 4.0 | Very High (270+ apps) | Moderate-High | Critical (universal interchange) | P0 |
| MIDI 1.0 | Universal | Low-Moderate | Critical (performance data) | P0 |
| JAMS | High (MIR research) | Low (JSON) | Very High (annotation output) | P1 |
| Humdrum \*\*kern | Moderate (musicology) | Moderate | High (analysis corpora) | P1 |
| RomanText | Moderate (theory/MIR) | Low (text) | High (harmonic analysis) | P1 |
| ABC Notation | Moderate (folk/trad) | Low | Moderate (easy input) | P2 |
| Web MIDI API | High (minus Safari) | Low | High (real-time interaction) | P2 |
| MPE | High (DAWs, hardware) | Moderate | Moderate (expressive data) | P2 |
| MEI | Moderate (academic) | High | Moderate (research/archives) | P2 |
| OSC | High (live/media) | Low | Moderate (real-time output) | P3 |
| LilyPond | Moderate | Moderate-High | Low-Moderate (output only) | P3 |
| MIDI 2.0 | Low (early adoption) | High | Low (premature) | P3 |
| MNX | None (in development) | Unknown | Future-high | Watch |

---

## Recommended Implementation Strategy

1. **Phase 1 (Core):** MusicXML import/export, MIDI 1.0 read/write, JAMS export
2. **Phase 2 (Analysis Formats):** Humdrum \*\*kern import, RomanText import/export, ABC notation import
3. **Phase 3 (Connectivity):** Web MIDI API integration, MPE awareness, OSC output
4. **Phase 4 (Extended):** MEI import, LilyPond export, MIDI 2.0 awareness

---

## Sources

- [MusicXML 4.0 Specification](https://www.w3.org/2021/06/musicxml40/)
- [MusicXML Software List](https://www.musicxml.com/software/)
- [musicxml-interfaces (GitHub)](https://github.com/jocelyn-stericker/musicxml-interfaces)
- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/)
- [MIDI 2.0 (Wikipedia)](https://en.wikipedia.org/wiki/MIDI_2.0)
- [MIDI 2.0 Specification Overview (PDF)](https://amei-music.github.io/midi2.0-docs/amei-pdf/M2-100-U_v1-1_MIDI_2-0_Specification_Overview.pdf)
- [MIDI 2.0, MIDI-CI, Profiles and Property Exchange (Updated June 2023)](https://midi.org/details-about-midi-2-0-midi-ci-profiles-and-property-exchange-updated-june-2023)
- [MPE -- MIDI Polyphonic Expression](https://midi.org/mpe-midi-polyphonic-expression)
- [MPE Explained (Sound On Sound)](https://www.soundonsound.com/sound-advice/mpe-midi-polyphonic-expression)
- [Music Encoding Initiative](https://music-encoding.org/about/)
- [MEI as Preferred Preservation Format (UT Austin)](https://guides.lib.utexas.edu/music-notation-preferred-preservation-formats-for-digital-scores/music-encoding-initiative)
- [MusicXML Introduction and Comparison (OSMD Blog)](https://opensheetmusicdisplay.org/blog/blog-music-xml-introduction-comparison/)
- [ABC Standard v2.1](https://abcnotation.com/wiki/abc:standard:v2.1)
- [ABC Notation Software](https://abcnotation.com/software)
- [LilyPond](http://lilypond.org/)
- [LilyPond and Digital Humanities (DHQ)](https://www.digitalhumanities.org/dhq/vol/18/2/000573/000573.html)
- [Humdrum User Guide Ch. 2](https://www.humdrum.org/guide/ch02/)
- [Humdrum \*\*kern Representation](https://www.humdrum.org/rep/kern/)
- [MNX Documentation](https://w3c.github.io/mnx/docs/)
- [MNX (GitHub)](https://github.com/w3c/mnx)
- [JAMS (GitHub)](https://github.com/marl/jams)
- [JAMS Documentation](https://jams.readthedocs.io/en/stable/)
- [JAMS ISMIR 2014 Paper (PDF)](https://archives.ismir.net/ismir2014/paper/000355.pdf)
- [RomanText ISMIR 2019 Paper (PDF)](https://archives.ismir.net/ismir2019/paper/000012.pdf)
- [music21 Roman Numerals Guide](https://www.music21.org/music21docs/usersGuide/usersGuide_23_romanNumerals.html)
- [W3C Web MIDI API Specification](https://www.w3.org/TR/webmidi/)
- [Web MIDI API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Can I Use: MIDI](https://caniuse.com/midi)
- [WEBMIDI.js](https://webmidijs.org/)
- [JZZ.js Documentation](https://jazz-soft.net/doc/JZZ/)
- [Web Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Essentia.js](https://mtg.github.io/essentia.js/)
- [Meyda](https://meyda.js.org/)
- [Open Sound Control (Wikipedia)](https://en.wikipedia.org/wiki/Open_Sound_Control)
- [osc.js (GitHub)](https://github.com/colinbdclark/osc.js/)
- [osc-js (GitHub)](https://github.com/adzialocha/osc-js)
- [Dorico MusicXML Export and Import](https://blog.dorico.com/musicxml-export-and-import/)
- [Finale MusicXML Support](https://makemusic.zendesk.com/hc/en-us/articles/16458439555479)
- [Max for Live API Overview](https://docs.cycling74.com/legacy/max8/vignettes/live_api_overview)
- [What is MIDI 2.0? (MusicRadar)](https://www.musicradar.com/news/what-is-midi-20-and-what-does-it-mean-for-musicians-and-producers)
