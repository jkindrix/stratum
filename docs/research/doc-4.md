# Research Findings: Modern Music Analysis Toolkit Features (2025--2026)

## 1. Music Embedding and Similarity

Pitch-Class Set Similarity Measures are well-established in music theory literature. Multiple similarity functions exist, classified into two families: those using the interval-class vector (IcVSIM, ISIM2, ANGLE) and those using subset embedding (RECREL, ATMEMB, AMEMB2). The key reference is [Samplaski's comparative survey](https://mtosmt.org/issues/mto.05.11.2/mto.05.11.2.samplaski.php).

**Earth Mover's Distance** (EMD) has been validated for melodic similarity by [Typke & Wiering's evaluation](https://www.semanticscholar.org/paper/Evaluating-the-Earth-Mover's-Distance-for-measuring-Typke-Wiering/eed8d7b926dfcd2e2ce4739003c103bc1f3ea04a), achieving an MRR of 0.479 and grouping approximately twice as many known melody occurrences compared to older methods. Notes are modeled as weighted points in a 2D pitch-time space, with duration as weight. The related Proportional Transportation Distance (PTD) is a normalized variant. EMD can also compare chord voicings by treating each chord as a distribution over pitch-classes.

Cosine Similarity for Harmonic Profiles is used extensively. Spectral Pitch Similarity (SPS) measures `cosine_similarity` between spectra in log-frequency domain, proven effective for predicting perceived stability of notes and chords. **Harmonic Pitch Class Profiles** (HPCP) reduce a piece's harmonic content to a 12-dimensional vector, and cosine similarity between HPCPs is a standard comparison metric ([Wikipedia: Harmonic pitch class profiles](https://en.wikipedia.org/wiki/Harmonic_pitch_class_profiles)).

Discrete Fourier Transform on Pitch-Class Sets is an emerging technique gaining traction. [Viaccoz et al.](https://journals.sagepub.com/doi/full/10.1177/10298649211034906) apply the DFT to pitch-class distributions, decomposing them into Fourier coefficients that measure chromaticity, diadicity, triadicity, octatonicity, diatonicity, and whole-tone quality. The [Interactive Music Analysis using the DFT](https://fabian-moss.de/talk/interactive-music-analysis-using-the-dft-and-pitch-class-distributions-extracted-from-midi-files/) tool provides interactive analysis using this approach.

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Pitch-class set similarity (IcVSIM, ANGLE, etc.) | Low | High |
| Earth Mover's Distance for chords/melodies | Medium | High |
| Cosine similarity for harmonic profiles | Low | High |
| DFT on pitch-class sets (Fourier coefficients) | Medium | High |
| Spectral pitch similarity | Low-Medium | Medium |

---

## 2. Graph-Based Music Analysis

Chord Transition Graphs model chord progressions as directed weighted graphs, where nodes are chords and edges are transitions weighted by frequency or probability. This is well-established in computational musicology and pairs naturally with Markov chain analysis.

**GraphMuse** ([arXiv: 2407.12671](https://arxiv.org/html/2407.12671v1)) is a 2024 Python library for symbolic music graph processing. Each note becomes a node; edges encode temporal, harmonic, or structural relationships. It integrates with [Partitura](https://github.com/DDMAL/Partitura) for MusicXML/MIDI/MEI/kern input, and its C-backed graph construction is up to 300x faster than numpy-based alternatives.

[A unified GNN framework](https://arxiv.org/abs/2509.06654) (2025) demonstrates handling 20 note-level analysis tasks: cadence detection, phrase/section boundary identification, pedal point detection, metrical strength estimation, harmony onset/change detection, and detailed harmonic analysis.

Tonnetz Graph Operations are formalized through [Neo-Riemannian theory](https://en.wikipedia.org/wiki/Neo-Riemannian_theory). The three fundamental transformations are:

- **P** (Parallel): Preserves the perfect fifth, moves the remaining note by semitone (C major to C minor)
- **L** (Leading-tone exchange): Preserves the minor third, moves the remaining note by semitone (C major to E minor)
- **R** (Relative): Preserves the major third, moves the remaining note by whole tone (C major to A minor)

These compose into a PLR-group acting on the set of major/minor triads. Extensions to [seventh chords and beyond](https://archive.bridgesmathart.org/2012/bridges2012-485.pdf).

Pitch-Space Navigation using Euler's Tonnetz (a lattice with axes for fifths, major thirds, and minor thirds) enables geometric reasoning about harmonic distance. [Network/graph analysis of score structures](https://arxiv.org/html/2404.15208v1).

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Chord transition graphs (directed weighted) | Low | High |
| Neo-Riemannian PLR transformations | Low-Medium | High |
| Tonnetz graph structure and navigation | Medium | High |
| PLR-group composition and path analysis | Medium | Medium-High |
| Extension of PLR to seventh chords | Medium | Medium |
| Full GNN-based analysis (GraphMuse-style) | High | Medium (library-dependent) |

---

## 3. Statistical Music Analysis

Zipf's Law in Music is empirically confirmed. [*Zipf's Law, Music Classification, and Aesthetics*](https://www.researchgate.net/publication/234813913_Zipf's_Law_Music_Classification_and_Aesthetics) showed that distributions of pitch, melodic intervals, and harmonic consonance fit Zipfian distributions very well. Zipf's law emerges most naturally when [natural Zipfian units are chosen](https://www.researchgate.net/publication/331195767_Zipf's_law_in_music_emerges_by_a_natural_choice_of_Zipfian_units). Practical applications include genre/composer identification and "pleasantness" prediction: Zipf distributions appear to be a necessary (but not sufficient) condition for aesthetically pleasing music.

Shannon Entropy applied to pitch sequences measures local dynamics and surprise in music. When pieces are cast as time series of pitch variations, entropy evaluates local dynamics while dimensionality measures global temporal dynamics. This has direct applications in style comparison and complexity analysis.

Markov Chain Analysis of chord progressions is one of the most well-validated computational musicology techniques. Chord sequences are modeled as state transitions with probability matrices. For example, a IV chord might have a 66.7% probability of transitioning to V. [Higher-order Markov chains](https://medium.com/@vanessaseto1/using-linear-algebra-and-markov-chains-to-algorithmically-generate-music-compositions-7dc88edda642) (considering two previous states) produce significantly better results. Training on different corpora produces style-specific transition matrices (e.g., training on Radiohead produces Radiohead-style progressions). [Controlled Markov Selection](https://www.sfu.ca/~eigenfel/ControlledMarkovSelection.pdf) adds real-time control over the stochastic generation process.

Distribution Analysis of Intervals/Pitches/Durations forms the backbone of feature extraction. **jSymbolic** ([jmir.sourceforge.net](https://jmir.sourceforge.net/jSymbolic.html)) implements 246 unique features (1497 values) organized into pitch-based, rhythmic, melodic, and harmonic descriptors -- the most extensive symbolic feature extractor available. **music21** ([github.com/cuthbertLab/music21](https://github.com/cuthbertLab/music21)) also provides extensive feature extraction.

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Pitch/interval/duration distributions | Low | High |
| Shannon entropy of pitch/rhythm sequences | Low | High |
| Zipf's law analysis and fitting | Low-Medium | Medium-High |
| First-order Markov chain (chord transitions) | Low | High |
| Higher-order Markov chains | Medium | High |
| Transition probability matrix visualization | Low-Medium | High |
| Information-theoretic measures (surprisal, etc.) | Medium | Medium-High |

---

## 4. Style Analysis

Computational Style Classification is a mature field. Recent approaches include:

- [Word2Vec and SentencePiece tokenization for composer classification](https://www.nature.com/articles/s41598-023-40332-0) applying these techniques to symbolic music
- [Multi-label style classification of piano sonatas](https://www.mdpi.com/1424-8220/25/3/666) (2025)
- [Computational analysis of style development](https://www.nature.com/articles/s41599-023-01796-7) (demonstrated on Debussy's corpus)

Feature Extraction for Style Comparison uses both symbolic and derived features:

- Symbolic features: pitch distributions, interval patterns, rhythm patterns, harmonic vocabulary, voice-leading tendencies
- Derived features: Zipf exponents, entropy measures, Markov transition matrices, DFT coefficients
- [Feature Extraction and Machine Learning on Symbolic Music using the music21 Toolkit](https://www.researchgate.net/publication/220723288_Feature_Extraction_and_Machine_Learning_on_Symbolic_Music_using_the_music21_Toolkit) integrates standard tools and allows custom extraction methods
- [High-level feature extraction from symbolic formats](https://arxiv.org/html/2507.15590v1) specializes in features for style/genre/composer identification

Corpus Analysis Tools include:

- [New Python library for symbolic music description, generation, and real-time processing](https://www.tandfonline.com/doi/full/10.1080/09298215.2025.2540434) (2025)
- **jSymbolic** 2.2 with 246 features and bias-avoidance functionality
- **music21** with built-in corpus of thousands of works

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Feature vector extraction (pitch, interval, rhythm stats) | Low-Medium | High |
| Style fingerprinting via feature profiles | Medium | High |
| Corpus comparison tools | Medium | High |
| Zipf exponent comparison across corpora | Low-Medium | Medium-High |
| DFT coefficient comparison across pieces | Medium | Medium-High |
| Markov transition matrix comparison | Medium | High |

---

## 5. Serialist and Post-Tonal Techniques

Twelve-Tone Row Operations are fully formalized and computationally straightforward. The four canonical transformations are Prime (P), Inversion (I), Retrograde (R), and Retrograde-Inversion (RI), each available at 12 transposition levels, yielding a 48-form matrix. [Open Music Theory: Row Properties](https://viva.pressbooks.pub/openmusictheory/chapter/row-properties/) provides comprehensive definitions. **BabbittCruncher** ([github.com/IsaacWeiss/BabbittCruncher](https://github.com/IsaacWeiss/BabbittCruncher)) demonstrates automated generation of Babbitt squares and combinatoriality testing.

Combinatoriality exists in several forms:

- Hexachordal combinatoriality: Two row forms whose first hexachords combine to form the aggregate (all 12 pitch classes)
- Trichordal/tetrachordal combinatoriality: Similar property with smaller segments
- [All-combinatorial hexachords](https://music-theory-practice.com/post-tonal/all-combinatorial-hexachords) (Babbitt's classification) are hexachords combinatorial under all four operations

All-Interval Series number exactly 1,928 in transpositionally and rotationally normal form (3,856 counting rotational equivalents). [Feitosa et al.](https://musmat.org/conferences/2021/12_Feitosa_et_al.pdf) explore permutations of the linear interval sequence vector. The [*Hitchhiker's Guide to the All-Interval 12-Tone Rows*](https://www.researchgate.net/publication/342093979_The_Hitchhiker's_Guide_to_the_All-Interval_12-Tone_Rows) was achieved computationally by Morris and Starr.

Set-Class Multiplication / Boulez's Frequency Multiplication is a sophisticated technique. [Retrospective remarks on Boulez's chord multiplication](https://sonograma.org/2020/06/a-few-retrospective-remarks-on-boulezs-chord-multiplication/) takes two pitch-class sets and produces the set of all pairwise sums modulo 12 (akin to Cartesian product in modular arithmetic). Three varieties are documented:

- Simple multiplication: Build one set's intervallic structure on each pitch of another
- Compound multiplication: Transpositional schemes applied to simple products
- Complex multiplication: The elegant commutative operation used in *Le Marteau sans maitre*

These operations were central to Boulez's compositional practice from 1952 through the 1960s.

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Twelve-tone matrix generation (P/I/R/RI) | Low | High |
| Combinatoriality detection (hexachordal) | Medium | High |
| All-combinatorial hexachord classification | Medium | Medium-High |
| All-interval series generation and search | Medium | Medium |
| Set-class multiplication (Boulez) | Medium | Medium-High |
| Derived row detection | Medium | Medium |
| Invariance analysis under row operations | Medium | High |

---

## 6. Algorithmic Composition Utilities

Constraint-Based Composition is the most theoretically rigorous approach. **Strasheela** ([github.com/tanders/strasheela](https://github.com/tanders/strasheela)) is the premier constraint-based composition system, where users declare music theory rules and the solver generates compliant music. A 2024 IJCAI paper presents [a constraint-based model for generating four-voice chord progressions](https://www.ijcai.org/proceedings/2024/858) respecting diatonic harmonic rules. [A 2025 Frontiers in Computer Science paper](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1543074/full) integrates neural networks as rules within a constraint-satisfaction framework, combining learned style with explicit theory rules.

Markov Chain Generators are widely used (see Section 3 above). Key implementation considerations: first-order vs. higher-order chains, training corpus selection, and real-time controllability.

L-System Music offers fractal self-similarity. [Manousakis's *Musical L-systems*](https://modularbrains.net/wp-content/uploads/Stelios-Manousakis-Musical-L-systems.pdf) is the key reference. Context-free L-systems are the most common, but context-sensitive and parametric L-systems significantly expand compositional possibilities. Mappings go beyond simple pitch sequences to multi-dimensional musical parameters.

Cellular Automata generate time-evolving patterns naturally suited to music. [Applications range](https://link.springer.com/chapter/10.1007/978-1-84628-600-1_8) from sound synthesis to structural composition. Elementary 1D automata (like Rule 30, Rule 110), 2D Life-like automata, and reaction-diffusion systems have all been used. The visual patterns map naturally to musical ones since both evolve through time.

Stochastic Processes trace to [Xenakis's stochastic music](https://www.iannis-xenakis.org/en/stochastic-music/). Key techniques:

- Free stochastic music: Probability distributions control density, register, and dynamics (*Pithoprakta*, 1956)
- Markovian stochastic music: State-dependent transitions with memory
- Sieve theory: Logical formulas (using residual classes and modular arithmetic) for constructing pitch/duration/dynamics sequences

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| First-order Markov chain generator | Low | High |
| Higher-order Markov chain generator | Medium | High |
| L-system string generation with music mapping | Medium | Medium-High |
| Elementary cellular automata (1D) | Low-Medium | Medium |
| 2D cellular automata (Game of Life variants) | Medium | Medium |
| Xenakis sieve construction | Medium | Medium |
| Constraint helpers (parallel fifths check, etc.) | Low-Medium | High |
| Stochastic distribution generators (Poisson, Gaussian, etc.) | Low | Medium-High |

---

## 7. Microtonality and Xenharmonics

Scala File Format (`.scl`/`.kbm`) is the de facto standard for tuning exchange. The [Scala `.scl` format specification](https://www.huygens-fokker.org/scala/scl_format.html) is maintained by the Huygens-Fokker Foundation. The `.scl` file is plain ASCII: description line, note count, then one line per degree (ratios like `3/2` or cent values like `701.955`). The `.kbm` file maps scale degrees to MIDI keys, specifying range, middle note, reference frequency, and formal octave. The Scala archive contains over 4,000 scales.

**Scale Workshop** ([github.com/xenharmonic-devs/scale-workshop](https://github.com/xenharmonic-devs/scale-workshop)) by xenharmonic-devs is the leading web-based microtonal tool. It supports cents, ratios, EDOs, and monzo notation. Exports to Scala (`.scl`/`.kbm`), AnaMark TUN, Kontakt scripts, Max/MSP coll, and Pure Data tables. It includes an in-browser synth, MIDI support, and URL-based scale sharing. A companion library, [scale-workshop-core](https://xenharmonic-devs.github.io/scale-workshop-core/), provides the computational backend.

Rank-2 Temperaments are temperaments generated by two intervals (typically an octave/period and a generator). Every rank-2 temperament produces a family of [MOS scales](https://en.xen.wiki/w/Mos_scale) at different scale sizes. A MOS scale has exactly two step sizes (Large and Small), notated as e.g., "5L 2s" for the diatonic scale. The [MOS Scale Family Tree](https://en.xen.wiki/w/MOS_Scale_Family_Tree) documents the hierarchical relationships.

Xenharmonic Lattices for just intonation visualization:

- 5-limit lattice: 2D (axes for primes 3 and 5, octave equivalence assumed)
- 7-limit lattice: 3D (adding prime 7 axis)
- The [ji-lattice](https://github.com/xenharmonic-devs/ji-lattice) library by xenharmonic-devs provides algorithms for projecting JI and ET scales onto 2D screen space, supporting Kraig Grady's coordinate system

Additional Tools from the [Xenharmonic Wiki: Useful Tools](https://en.xen.wiki/w/Useful_Tools):

- UnTwelve Tools: online suite with MOS visualization, Stern-Brocot tree, interval calculator
- Various EDO/temperament calculators and generators

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Scala `.scl` file read/write | Low | High |
| Scala `.kbm` file read/write | Low | High |
| N-TET scale generation | Low | High |
| Rank-2 temperament calculation | Medium | High |
| MOS scale generation (given period + generator) | Medium | High |
| MOS scale family tree navigation | Medium-High | Medium |
| Just intonation lattice (5-limit, 2D) | Medium | High |
| Just intonation lattice (7-limit, 3D projection) | Medium-High | Medium-High |
| Monzo (prime exponent vector) arithmetic | Low | High |
| Cent/ratio/EDO step conversion utilities | Low | High |
| Temperament mapping and val computation | Medium-High | Medium |

---

## 8. Music Visualization

Tonnetz Visualization has multiple web implementations. [tonnetz-viz](https://github.com/cifkao/tonnetz-viz) visualizes music on the Tonnetz in real-time. [Tonnetz by Liam Rosenfeld](https://tonnetz.liamrosenfeld.com/explain-music) demonstrates smooth voice leading with animated transitions. The Tonnetz is a lattice of triangles: each vertex is a pitch class, downward-pointing triangles are major triads, upward-pointing triangles are minor triads. Horizontally it moves by fifths, vertically by major thirds.

Pitch-Space Plots encompass several geometries:

- Circle of Fifths: multiple interactive implementations exist (e.g., [circleoffifths.io](https://circleoffifths.io/), [muted.io](https://muted.io/circle-of-fifths/), [musicca.com](https://www.musicca.com/circle-of-fifths))
- Euler's Tonnetz torus (5-limit pitch space)
- Color-coded pitch-class mapping onto the circle of fifths for visual analysis

**Wavescapes** ([Viaccoz et al.](https://journals.sagepub.com/doi/full/10.1177/10298649211034906)) are a cutting-edge visualization combining hierarchical structure with DFT-based tonal analysis. Each wavescape is a triangular diagram where position indicates time span and color indicates DFT coefficient magnitude/phase. Different coefficients highlight different musical properties (chromaticity, diatonicity, triadicity). [Extended wavescapes](https://link.springer.com/chapter/10.1007/978-3-031-60638-0_25) expand this to set-class quality and ambiguity analysis.

Interval Class Vector as Radar Charts is an original but natural visualization idea. ICVs have six dimensions (IC1 through IC6), which map directly to hexagonal radar/spider charts. No existing implementations were found in the literature, making this a genuine differentiator.

Schenkerian Analysis Visualization recently received a breakthrough tool: [a standardized Schenkerian notation system](https://arxiv.org/html/2408.07184v1) capable of notating up to four voice structures. The system provides a standardized, parseable representation that could be rendered in a web UI. The dataset includes 140+ excerpts in computer-readable format.

Form Diagrams (phrase structure, section mapping, hierarchical form analysis) are natural extensions of score visualization. [Graph-based representations of musical structure](https://arxiv.org/html/2404.15208v1).

| Feature | Implementation Complexity | User Value |
|---------|--------------------------|------------|
| Tonnetz visualization (interactive, SVG/Canvas) | Medium-High | High |
| Circle of Fifths (interactive) | Medium | High |
| Interval class vector radar charts | Low-Medium | High |
| Pitch-class distribution bar charts | Low | High |
| Wavescapes (DFT-based hierarchical) | High | Medium-High |
| Form/structure diagrams | Medium | Medium-High |
| Chord transition graph visualization | Medium | High |
| Schenkerian notation aids (JSON-based) | High | Medium |
| Pitch-space plots (various geometries) | Medium | Medium-High |

---

## Summary: Highest-Value, Differentiating Features

Based on this research, the features that would most distinguish a music analysis toolkit in 2025-2026, ranked by the combination of novelty, user value, and feasibility:

### Tier 1: Must-Have Differentiators (High value, achievable complexity)

1. DFT on pitch-class sets with Fourier coefficient analysis (chromaticity, diatonicity, triadicity measures)
2. Neo-Riemannian PLR transformations with Tonnetz visualization
3. Markov chain analysis and generation from chord progressions (first and second order)
4. Pitch-class set similarity measures (IcVSIM, ANGLE, plus cosine similarity on harmonic profiles)
5. Twelve-tone matrix and combinatoriality tools
6. Scala `.scl`/`.kbm` format support with full microtonal arithmetic
7. Interval class vector radar charts (novel visualization, no existing implementations found)

### Tier 2: Strong Differentiators (Medium-High value)

8. Rank-2 temperament and MOS scale generation
9. Zipf's law fitting and entropy measures for style profiling
10. Earth Mover's Distance for chord/melody comparison
11. Boulez's pitch-class set multiplication
12. Just intonation lattice visualization (5-limit and 7-limit)
13. Constraint-based composition helpers (voice-leading rules, parallel fifths detection)
14. L-system and cellular automata generators
15. Chord transition graph construction and visualization

### Tier 3: Advanced/Niche (Lower priority, high complexity)

16. Wavescapes visualization (complex but visually impressive)
17. Schenkerian analysis aids (high complexity, niche audience)
18. All-interval series generation (1,928 rows -- niche but complete)
19. Xenakis sieve theory implementation
20. Full GNN-based analysis pipelines

### Key Competitive Gaps in Existing JavaScript Libraries

Comparing against **tonal.js** ([github.com/tonaljs/tonal](https://github.com/tonaljs/tonal), the leading JS music theory library at ~20kb), the following capabilities are entirely absent from the JavaScript ecosystem:

- Post-tonal analysis (pitch-class sets, set classes, interval vectors)
- Any form of statistical analysis (Zipf, entropy, distributions)
- Markov chain analysis or generation
- Microtonality beyond basic cent calculations
- Graph-based analysis (Tonnetz operations, chord transition graphs)
- Serialist operations (twelve-tone matrices, combinatoriality)
- Any visualization components
- Algorithmic composition utilities

This represents a massive opportunity for a TypeScript/JavaScript toolkit focused on symbolic music analysis.

---

## Sources

- <https://musictech.mit.edu/cmta/>
- <https://arxiv.org/html/2407.12671v1>
- <https://arxiv.org/abs/2509.06654>
- <https://arxiv.org/html/2507.15590v1>
- <https://journals.sagepub.com/doi/full/10.1177/10298649211034906>
- <https://link.springer.com/chapter/10.1007/978-3-031-60638-0_25>
- <https://www.huygens-fokker.org/scala/scl_format.html>
- <https://github.com/xenharmonic-devs/scale-workshop>
- <https://github.com/xenharmonic-devs/ji-lattice>
- <https://en.xen.wiki/w/Mos_scale>
- <https://en.xen.wiki/w/Useful_Tools>
- <https://github.com/cifkao/tonnetz-viz>
- <https://en.wikipedia.org/wiki/Neo-Riemannian_theory>
- <https://github.com/tonaljs/tonal>
- <https://mtosmt.org/issues/mto.05.11.2/mto.05.11.2.samplaski.php>
- <https://www.semanticscholar.org/paper/Evaluating-the-Earth-Mover's-Distance-for-measuring-Typke-Wiering/eed8d7b926dfcd2e2ce4739003c103bc1f3ea04a>
- <https://en.wikipedia.org/wiki/Similarity_relation_(music)>
- <https://www.researchgate.net/publication/234813913_Zipf's_Law_Music_Classification_and_Aesthetics>
- <https://jmir.sourceforge.net/jSymbolic.html>
- <https://github.com/cuthbertLab/music21>
- <https://medium.com/@vanessaseto1/using-linear-algebra-and-markov-chains-to-algorithmically-generate-music-compositions-7dc88edda642>
- <https://www.sfu.ca/~eigenfel/ControlledMarkovSelection.pdf>
- <https://github.com/IsaacWeiss/BabbittCruncher>
- <https://www.researchgate.net/publication/342093979_The_Hitchhiker's_Guide_to_the_All-Interval_12-Tone_Rows>
- <https://sonograma.org/2020/06/a-few-retrospective-remarks-on-boulezs-chord-multiplication/>
- <https://github.com/tanders/strasheela>
- <https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1543074/full>
- <https://www.ijcai.org/proceedings/2024/858>
- <https://modularbrains.net/wp-content/uploads/Stelios-Manousakis-Musical-L-systems.pdf>
- <https://link.springer.com/chapter/10.1007/978-1-84628-600-1_8>
- <https://www.iannis-xenakis.org/en/stochastic-music/>
- <https://arxiv.org/html/2408.07184v1>
- <https://www.tandfonline.com/doi/full/10.1080/09298215.2025.2540434>
- <https://www.nature.com/articles/s41598-023-40332-0>
- <https://www.nature.com/articles/s41599-023-01796-7>
- <https://en.wikipedia.org/wiki/Harmonic_pitch_class_profiles>
- <https://archive.bridgesmathart.org/2012/bridges2012-485.pdf>
- <https://arxiv.org/html/2404.15208v1>
- <https://en.xen.wiki/w/MOS_Scale_Family_Tree>
- <https://www.researchgate.net/publication/331195767_Zipf's_law_in_music_emerges_by_a_natural_choice_of_Zipfian_units>
- <https://www.researchgate.net/publication/220723288_Feature_Extraction_and_Machine_Learning_on_Symbolic_Music_using_the_music21_Toolkit>
- <https://www.mdpi.com/1424-8220/25/3/666>
- <https://music-theory-practice.com/post-tonal/all-combinatorial-hexachords>
- <https://musmat.org/conferences/2021/12_Feitosa_et_al.pdf>
- <https://viva.pressbooks.pub/openmusictheory/chapter/row-properties/>
- <https://tonnetz.liamrosenfeld.com/explain-music>
- <https://circleoffifths.io/>
- <https://muted.io/circle-of-fifths/>
- <https://www.musicca.com/circle-of-fifths>
- <https://fabian-moss.de/talk/interactive-music-analysis-using-the-dft-and-pitch-class-distributions-extracted-from-midi-files/>
- <https://xenharmonic-devs.github.io/scale-workshop-core/>
