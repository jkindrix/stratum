# Symbolic Music Analysis: Cutting-Edge Techniques for a MIR Toolkit

## 1. Harmonic Analysis Advances

### 1.1 Neo-Riemannian Theory (NRT)

**What it does:** NRT describes chromatic chord progressions through three fundamental transformations on triads -- **P** (Parallel), **L** (Leading-tone exchange), and **R** (Relative) -- rather than through traditional functional harmony. Each transformation changes exactly one note by a semitone or whole-tone, keeping the other two notes as common tones.

**Why it is valuable:** Traditional Roman numeral analysis breaks down for chromatic, film-score, and pop/rock progressions that do not follow functional tonal grammar. NRT provides a principled framework for analyzing chord progressions that move by smooth voice leading rather than by key-based function. It explains progressions in Wagner, Radiohead, and Hollywood film scores that functional harmony cannot.

**How it works in a symbolic toolkit:**

- **Transformation engine:** Given two triads, compute which NRT operation(s) connect them. Each operation is defined algebraically: P flips the third (C major <-> C minor), L moves the root down a semitone (C major <-> E minor), R moves the fifth up a whole step (C major <-> A minor).
- **Compound operations:** Chain P, L, R to form compound transformations (e.g., PL, LP, PR). The **hexatonic cycle** (PLPLPL) and **octatonic cycle** (PRPRPR) are particularly important structures.
- **Cycle detection:** Identify hexatonic poles (maximally distant triads connected by 3 PL operations), octatonic systems, and Weitzmann regions in chord sequences.
- **MAP-Elites integration:** Recent work (2022-2025) combines NRT operations with quality-diversity algorithms for automated chord progression generation.

**Key algorithms:**

- Transformation classification: O(1) lookup given two pitch-class sets of size 3
- Path-finding through NRT graph: BFS/DFS on the 24-node PLR graph (12 major + 12 minor triads)
- Group-theoretic operations using the dihedral group `D24`

**Sources:**

- [Neo-Riemannian theory (Wikipedia)](https://en.wikipedia.org/wiki/Neo-Riemannian_theory)
- [NRT + MAP-Elites for chord progression generation (ICCC 2022)](https://computationalcreativity.net/iccc22/papers/ICCC-2022_paper_136.pdf)
- [NRT and quality-diversity algorithms (Springer, 2023)](https://link.springer.com/chapter/10.1007/978-3-031-29956-8_5)

### 1.2 Tonnetz Representations

**What it does:** The **Tonnetz** is a lattice diagram representing tonal space where pitch classes are arranged such that the horizontal axis represents perfect fifths, one diagonal axis represents major thirds, and the other diagonal axis represents minor thirds. Triads appear as triangles, and NRT operations are geometric flips of those triangles.

**Why it is valuable:** It provides a unified geometric substrate for harmonic analysis. Distances on the Tonnetz correlate with perceived harmonic relatedness. It enables graph-based and geometric algorithms (including GNNs) to be applied to harmony.

**How it works in a symbolic toolkit:**

- **2D Tonnetz construction:** Build a toroidal grid (wrapping in both dimensions due to enharmonic equivalence in 12-TET) where each node is a pitch class. Edges connect by fifth (7 semitones), major third (4 semitones), and minor third (3 semitones).
- **3D Spiral Array (Chew):** Extend the Tonnetz into a 3D helix where pitch classes, chords, and keys each occupy computed spatial positions. The Spiral Array wraps the 2D Tonnetz into a 3D structure with an interior where chord and key centers-of-effect reside.
- **Trajectory tracking:** Plot a chord progression as a path through the Tonnetz. Compute trajectory features: path length (total harmonic distance traveled), convex hull area (harmonic range), centroid drift (tonal center movement).
- **Graph Neural Networks:** Recent research (Karystinaios, 2023-2024) transforms Tonnetz trajectories into weighted graphs for GNN-based harmonic analysis, enabling style classification and Roman numeral prediction.

**Key data structure:**

```
Tonnetz node: pitch_class (0-11)
Tonnetz edges: {fifth: +7 mod 12, major_third: +4 mod 12, minor_third: +3 mod 12}
Chord region: triangle formed by 3 adjacent nodes
```

**Sources:**

- [Tonnetz and tonal space (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7302842/)
- [Tonnetz trajectories and GNNs (Karystinaios)](https://emmanouil-karystinaios.github.io/post/tonnetz/)
- [Harmonic analysis on the Tonnetz (HAL)](https://hal.science/hal-03250334/document)
- [PitchPlots: Analyzing musical pieces on the Tonnetz (Fabian Moss)](https://fabian-moss.de/talk/workshop-analyzing-musical-pieces-on-the-tonnetz-using-the-pitchplots-python-library/)

### 1.3 Harmonic Network Analysis

**What it does:** Represents chord progressions as directed, weighted graphs where nodes are chords and edges represent transitions weighted by frequency of occurrence. Applies network theory (centrality, community detection, shortest paths) to discover harmonic structure.

**Why it is valuable:** Reveals the "grammar" of a musical style empirically. Community detection identifies functional groups (tonic, subdominant, dominant neighborhoods). Centrality metrics identify the most structurally important chords. Comparison of harmonic networks across corpora reveals style differences quantitatively.

**How it works in a symbolic toolkit:**

- **Graph construction:** Parse a chord sequence, create a directed graph where each unique chord is a node and each chord-to-chord transition is a weighted edge (weight = transition count or probability).
- **Network metrics:** Compute `PageRank` (chord importance), `betweenness centrality` (chords that act as bridges between regions), `clustering coefficient` (tendency of chords to form closed harmonic loops).
- **Community detection:** Use Louvain or label propagation to identify chord communities that correspond to harmonic regions or tonal areas.
- **Cycle analysis:** Detect harmonic cycles (e.g., ii-V-I, I-vi-IV-V) as strongly connected components or frequent subgraph patterns.

**Sources:**

- [Harmonic network analysis (arXiv)](https://arxiv.org/html/2404.15208v1)
- [Network theory applied to chord progressions (ACM)](https://dl.acm.org/doi/10.1145/3469013.3469025)

### 1.4 Tonal Interval Space (TIS) and Tonal Interval Vectors (TIV)

**What it does:** Projects chroma vectors (12-dimensional binary or weighted pitch-class distributions) into a 6-dimensional complex-valued space using the **Discrete Fourier Transform**. The resulting **Tonal Interval Vectors** encode intervallic structure in a space where Euclidean distance captures perceptual harmonic similarity.

**Why it is valuable:** Computationally efficient (DFT is fast), perceptually grounded, and works at multiple levels (individual pitches, chords, keys). The same distance metric works for chord similarity, key distance, and consonance measurement. It unifies several music-theoretic constructs in one mathematical framework.

**How it works in a symbolic toolkit:**

- **TIV computation:** Given a set of pitch classes (or a weighted chroma vector), apply the 12-point DFT. Take the magnitudes and phases of the 6 non-trivial frequency components. This yields a 12-dimensional real vector (6 complex pairs).
- **Distance calculation:** Euclidean distance between two TIVs measures harmonic dissimilarity. Small distances = smooth harmonic transitions.
- **Key finding:** Precompute TIVs for all 24 major/minor keys. The key whose TIV is closest to the input's TIV is the estimated key.
- **Tension profile:** Compute TIV distance between each chord and the current key TIV to produce a tension curve over time.

**Key formulas:**

```
TIV(chroma) = DFT(chroma_vector)[1:6]  // 6 complex coefficients
distance(A, B) = ||TIV(A) - TIV(B)||_2
consonance(chord) = ||TIV(chord)||  // magnitude = consonance
```

**Sources:**

- [Tonal Interval Vectors and harmonic similarity (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7712964/)
- [A multi-level tonal interval space for modelling pitch relatedness and musical consonance (ResearchGate)](https://www.researchgate.net/publication/303595116_A_multi-level_tonal_interval_space_for_modelling_pitch_relatedness_and_musical_consonance)
- [Tonal Interval Space home](https://sites.google.com/site/tonalintervalspace/home)

### 1.5 Chord-Scale Theory

**What it does:** Associates each chord with one or more scales (available-note sets) that define which pitches are consonant, avoid-notes, and tension-notes over that chord. Central to jazz pedagogy (Berklee, Russell's Lydian Chromatic Concept).

**Why it is valuable:** Bridges harmony and melody by specifying which melodic pitches "work" over a given harmonic context. Essential for jazz analysis and improvisation modeling. Enables computational generation of idiomatic melodic lines.

**How it works in a symbolic toolkit:**

- **Chord-scale database:** Map chord types to compatible scales. E.g., Cmaj7 -> {C Ionian, C Lydian}; Cm7 -> {C Dorian, C Aeolian}; C7 -> {C Mixolydian, C Lydian Dominant, C Altered, ...}.
- **Available-note-set computation:** Given a chord (as pitch-class set) and a scale, classify each scale degree as: chord tone, available tension, or avoid note.
- **Melody analysis:** For each note in a melody, determine its function relative to the underlying chord-scale (chord tone, tension, approach note, passing tone).
- **Harmonic Pitch Class Profile matching:** Compare observed pitch distributions against chord-scale templates using cosine similarity or KL divergence.

**Sources:**

- [Chord-scale systems and computational analysis (NYU)](https://bpb-us-e1.wpmucdn.com/wp.nyu.edu/dist/2/2294/files/2016/08/deng-chord.pdf)
- [Chord-Scale Theory (Open Music Theory)](https://viva.pressbooks.pub/openmusictheory/chapter/chord-scale-theory/)
- [jazztoolbox (GitHub)](https://github.com/chad/jazztoolbox)

---

## 2. Voice Leading Algorithms

### 2.1 Tymoczko's Geometric Voice-Leading Spaces

**What it does:** Models n-note chords as points in n-dimensional geometric spaces (called **OPTIC spaces**, for the equivalences of Octave, Permutation, Transposition, Inversion, and Cardinality). Voice leadings between chords become paths through these spaces, and "efficient" voice leading corresponds to short paths.

**Why it is valuable:** Provides a rigorous mathematical framework for what musicians intuitively call "smooth" or "good" voice leading. Enables algorithmic search for optimal voice leadings. Unifies scale theory, serial theory, and voice-leading theory under one geometric umbrella.

**How it works in a symbolic toolkit:**

- **Chord representation:** Represent an n-note chord as a point in R^n (ordered pitch list). Apply quotient operations for desired equivalences:
  - **O** (octave): reduce mod 12 -> pitch classes
  - **P** (permutation): sort -> unordered set
  - **T** (transposition): normalize to sum=0 -> transposition class
  - **I** (inversion): take canonical form under inversion
  - **C** (cardinality): allow different-sized sets
- **Voice-leading distance:** The displacement between two chords is the vector of individual voice movements. Total voice-leading distance = sum (or max) of absolute semitone displacements, minimized over all possible voice assignments.
- **Optimal voice leading search:** Given two unordered pitch-class sets, find the assignment of voices that minimizes total displacement. This is a variant of the assignment problem, solvable in O(n^3) with the Hungarian algorithm or O(n!) by exhaustive search for small n.

**Key algorithm** (efficient voice leading between two chords):

```
1. Generate all permutations of the target chord
2. For each permutation, compute per-voice displacement from source
3. Consider octave equivalents (+/-12) for each voice
4. Select the assignment minimizing sum of |displacements|
```

**Sources:**

- [Tymoczko - Voice leading geometry (Princeton)](https://dmitri.mycpanel.princeton.edu/voiceleading.pdf)
- [Rhythm, melody, and voice leading (McGill)](https://www-cgrl.cs.mcgill.ca/~godfried/publications/rhythm-melody-voice-leading.pdf)
- [Geometric voice-leading spaces (arXiv)](https://arxiv.org/abs/1602.04137)

### 2.2 Parsimonious Voice Leading

**What it does:** Identifies voice leadings where voices move by at most one or two semitones, maximizing common tones. Originally formalized by Richard Cohn in the context of NRT. A voice leading is "parsimonious" if the total aggregate semitone displacement is minimal.

**Why it is valuable:** Approximately 95% of chord connections in many styles (including Jobim's bossa nova) are parsimonious. It captures a fundamental principle of Western voice leading practice and serves as both an analytical metric and a compositional constraint.

**How it works in a symbolic toolkit:**

- **Parsimony score:** Given two chords, compute the minimum total semitone displacement. Classify: 0 = identity, 1-2 = maximally parsimonious, 3-4 = parsimonious, 5+ = non-parsimonious.
- **Common-tone retention:** Count the number of pitch classes shared between two chords.
- **PLR classification:** For triads specifically, determine which NRT operations connect them (each PLR operation is a specific type of parsimonious voice leading).
- **Graph construction:** Build a graph where nodes are chords and edges exist only for parsimonious connections (weight = displacement). This "parsimony graph" enables algorithmic chord progression generation under voice-leading constraints.

**Sources:**

- [A Theory for Parsimonious Voice Leading Classes (Academia)](https://www.academia.edu/64242667/A_Theory_for_Parsimonious_Voice_Leading_Classes)
- [Geometric voice-leading spaces (arXiv)](https://arxiv.org/abs/1602.04137)
- [Parsimonious voice leading (Music Theory Online)](https://mtosmt.org/issues/mto.19.25.2/mto.19.25.2.plotkin.pdf)

---

## 3. Rhythm and Meter

### 3.1 Generative Theory of Tonal Music (GTTM) -- Metrical and Grouping Components

**What it does:** GTTM (Lerdahl and Jackendoff, 1983) formalizes the metrical and grouping intuitions of experienced listeners through a system of well-formedness rules (WFRs) and preference rules (PRs). It produces four hierarchical structures: grouping structure, metrical structure, time-span reduction, and prolongational reduction.

**Why it is valuable:** It is the most comprehensive formal theory of how listeners parse musical structure. Computational implementations enable automatic analysis of metrical strength, phrase boundaries, and structural importance of notes. It provides the hierarchical backbone needed for tension models and structural analysis.

**How it works in a symbolic toolkit:**

**Metrical Structure:**

- **Metrical Well-Formedness Rules (MWFRs):**
  - MWFR 1: Every attack point associates with a beat at the smallest level
  - MWFR 2: Every beat at a given level is also a beat at all smaller levels (hierarchical inclusion)
  - MWFR 3: Strong beats at each level are spaced 2 or 3 beats apart (duple or triple)
  - MWFR 4: The tactus and immediately larger/smaller levels must be duple or triple
- **Metrical Preference Rules (MPRs):** Prefer metrical structures where strong beats align with note onsets, long notes, harmonic changes, bass-register events, and stressed syllables.
- **Implementation approach:** Hamanaka's system uses parameterized priority weights for conflicting preference rules, constructing metrical hierarchies top-down using bottom-up detection of local metrical strength.

**Grouping Structure:**

- **Grouping Preference Rules (GPRs):**
  - GPR 2 (Proximity): Prefer group boundaries where there are longer inter-onset intervals or rests
  - GPR 3 (Change): Prefer boundaries at changes of register, dynamics, articulation, or timbre
  - GPR 5 (Symmetry): Prefer equal-length groups
  - GPR 6 (Parallelism): Prefer parallel grouping for parallel passages
- **Implementation:** The sGTTM and sGTTM-II analyzers combine GTTM rules with statistical learning (decision trees) to detect local grouping boundaries. The deepGTTM-III system uses deep learning for simultaneous grouping and metrical analysis.

**Key computational systems:** ATTA (automatic timespan tree analyser), FATTA (fully automatic), sGTTM (statistical GTTM), sGTTM-II (parameterized), deepGTTM-III (deep learning).

**Sources:**

- [Computational GTTM (Taylor & Francis)](https://www.tandfonline.com/doi/abs/10.1080/09298210701563238)
- [GTTM project home](https://gttm.jp/gttm/)
- [exGTTM implementation (Hamanaka)](https://gttm.jp/hamanaka/en/exgttm/)
- [Statistical GTTM analysis (CiteSeerX)](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=1815bf8f18bec9ef40523d27c56df1faf2f2a934)

### 3.2 Rhythmic Complexity Measures

**What it does:** Quantifies how "complex" a rhythmic pattern sounds to human listeners, using information-theoretic and combinatorial measures computed from symbolic rhythm representations.

**Why it is valuable:** Enables sorting, comparing, and generating rhythmic patterns by complexity. Applications include difficulty estimation, style classification, and generative systems that can target specific complexity levels.

**How it works in a symbolic toolkit:**

- **Shannon Entropy:** Treat onset positions as a probability distribution over metric positions. Higher entropy = more evenly distributed onsets = less predictable.

```
H(rhythm) = -SUM(p_i * log2(p_i)) for each metric position i
```

- **Lempel-Ziv Complexity (LZ):** Compress the binary onset string. More compressible = less complex. LZ complexity counts the number of distinct subpatterns needed to reconstruct the pattern.
- **Syncopation measures:** Quantify the degree to which onsets occur on metrically weak positions. The Longuet-Higgins-Lee syncopation model assigns a syncopation score to each onset based on the difference between the onset's metric weight and the weight of the following rest/note.

```
syncopation(onset) = metric_weight(next_strong_beat) - metric_weight(onset_position)
total_syncopation = SUM(syncopation(onset)) for all syncopated onsets
```

- **Keith complexity:** Counts the number of distinct patterns generated by concatenating a rhythm with itself and examining all rotational shifts.
- **Weighted Note-to-Beat Distance (WNBD):** Measures the average distance of note onsets from the nearest strong beat, weighted by metric level.

**Sources:**

- [Rhythm Complexity Measures: A Comparison of Mathematical Models (ResearchGate)](https://www.researchgate.net/publication/220723376_Rhythm_Complexity_Measures_A_Comparison_of_Mathematical_Models_of_Human_Perception_and_Performance)
- [Complexity Measures of Musical Rhythms (ResearchGate)](https://www.researchgate.net/publication/249761762_Complexity_Measures_of_Musical_Rhythms)
- [Rhythmic complexity and perception (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4181238/)

### 3.3 Groove Quantification

**What it does:** Measures the "groove" quality of a rhythmic pattern -- the degree to which it induces pleasurable body movement -- primarily through syncopation analysis.

**Why it is valuable:** Groove is a central aesthetic quality in popular music, jazz, funk, and electronic music. Computational groove models enable generative systems to produce rhythms that "feel good" and allow analytical comparison across styles.

**How it works in a symbolic toolkit:**

- **Syncopation-groove mapping:** Research shows groove peaks at moderate syncopation levels (inverted U-curve). Very low syncopation = boring; very high = confusing.
- **Polyphonic syncopation:** For multi-instrument patterns (e.g., drum kit), compute syncopation across all voices jointly, accounting for how voices interact metrically.
- **Micro-timing deviation:** In MIDI performance data, measure deviations from the quantized grid. Systematic micro-timing patterns (e.g., swung eighth notes, laid-back snare) contribute to groove.

```
groove_score = f(syncopation_level, micro_timing_variance, inter_voice_correlation)
```

**Sources:**

- [Syncopation and groove (PLOS ONE)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0204539)
- [Syncopation and Groove in Polyphonic Music Patterns (UC Press)](https://online.ucpress.edu/mp/article/39/5/503/182325/Syncopation-and-Groove-in-Polyphonic-MusicPatterns)
- [Groove quantification in music (SpringerOpen)](https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-022-00267-2)

---

## 4. Form and Structure

### 4.1 Self-Similarity Matrices (SSM)

**What it does:** Computes pairwise similarity between all time segments in a piece, producing a square matrix where entry (i,j) represents how similar segment i is to segment j. Block-diagonal structure reveals repeated sections; off-diagonal stripes reveal transposed or varied repetitions.

**Why it is valuable:** Provides a complete, visual and algorithmic representation of a piece's repetition structure. Foundation for automated form analysis (identifying verse, chorus, bridge, etc.). Works on any feature representation (pitch, rhythm, harmony, combined).

**How it works in a symbolic toolkit:**

- **Feature extraction:** Segment the piece into fixed-size windows (e.g., 1 beat, 1 measure). Extract feature vectors per segment: chroma vectors, pitch histograms, rhythm patterns, interval sequences.
- **Similarity computation:** Compute cosine similarity (or 1 - cosine distance) between all pairs of feature vectors.

```
SSM[i][j] = cosine_similarity(feature_vector[i], feature_vector[j])
```

- **Enhancement:** Apply path enhancement (emphasize diagonal stripes), transposition invariance (shift chroma vectors to align), and thresholding to clean up the matrix.
- **Visualization:** Display as a heatmap. Block-diagonal patterns = repeated sections. Off-diagonal lines = sequence repetitions. Checkerboard patterns = alternating sections.

### 4.2 Novelty Detection (Foote's Algorithm)

**What it does:** Slides a checkerboard kernel along the main diagonal of the SSM to detect transition points between contrasting sections. Produces a "novelty function" whose peaks correspond to structural boundaries.

**Why it is valuable:** Automatically identifies section boundaries (verse/chorus transitions, movement boundaries, etc.) without any prior knowledge of the piece's form.

**How it works in a symbolic toolkit:**

- **Checkerboard kernel construction:** Build a 2D kernel of size k x k with a checkerboard pattern: +1 in the top-left and bottom-right quadrants, -1 in the top-right and bottom-left quadrants.

```
kernel[i][j] = sign((i < k/2) XOR (j < k/2))  // +1 or -1
```

- **Correlation:** At each diagonal position t, compute the dot product of the kernel with the SSM region centered at (t,t). High values indicate a boundary between two self-similar but mutually dissimilar regions.

```
novelty(t) = SUM(kernel[i][j] * SSM[t-k/2+i][t-k/2+j])
```

- **Multi-scale:** Apply kernels of different sizes (small = fine boundaries like phrase boundaries, large = coarse boundaries like section boundaries). Combine via summation or max.
- **Peak picking:** Find local maxima in the novelty function above a threshold. These are the estimated structural boundaries.

**Sources:**

- [Novelty-based segmentation (AudioLabs Erlangen)](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html)
- [Structural segmentation methods (arXiv)](https://arxiv.org/abs/2309.02243)
- [Music structure analysis (Springer)](https://link.springer.com/article/10.1007/s11042-013-1761-9)

### 4.3 Repetition Pattern Discovery (SIA/SIATEC/COSIATEC)

**What it does:** Discovers all maximal translatable patterns (MTPs) in a multidimensional point-set representation of music. A translatable pattern is a set of notes that appears at multiple locations in the piece, related by translation (transposition + time shift).

**Why it is valuable:** Discovers motivic and thematic repetitions algorithmically, including transposed and rhythmically shifted variants. Unlike string-matching approaches, works natively on polyphonic music represented as point sets in (onset, pitch) space. Foundational for automated motivic analysis.

**How it works in a symbolic toolkit:**

- **Point-set representation:** Represent each note as a point `(onset_time, MIDI_pitch)`. Optionally add dimensions for duration, velocity, etc.
- **SIA algorithm:** For every pair of points (p, q), compute the translation vector `v = q - p`. Group all point pairs sharing the same translation vector. Each group's source points form a maximal translatable pattern.
  - Complexity: O(n^2 log n) where n = number of notes
- **SIATEC:** For each MTP found by SIA, find all translation vectors that map it onto other occurrences in the piece. Produces translational equivalence classes (TECs).
  - Complexity: O(n^3) worst case
- **COSIATEC:** Iteratively selects the "best" TEC (covering the most points), removes those points, and repeats. Produces a compressed encoding of the piece as a union of TECs.
- **Compression ratio:** The ratio of original point count to encoding size serves as a measure of repetition structure richness.

**Sources:**

- [Algorithms for Discovering Repeated Patterns in Multidimensional Representations of Polyphonic Music (ResearchGate)](https://www.researchgate.net/publication/2525888_Algorithms_for_Discovering_Repeated_Patterns_in_Multidimensional_Representations_of_Polyphonic_Music)
- [COSIATEC and SIATECCompress (Semantic Scholar)](https://www.semanticscholar.org/paper/COSIATEC-and-SIATECCompress%3A-Pattern-discovery-by-Meredith/7471f049921ec40e44a7a01525764ef16f866449)
- [Pattern discovery in music (Springer)](https://link.springer.com/chapter/10.1007/978-3-031-07015-0_15)

---

## 5. Tension and Expectation Models

### 5.1 Lerdahl's Tonal Pitch Space (TPS)

**What it does:** Defines a multidimensional space of pitches, chords, and keys with hierarchical distance metrics. Computes tension as a function of: (a) hierarchical position in the prolongational tree, (b) distance of the chord from the local tonic in pitch space, and (c) surface dissonance.

**Why it is valuable:** The most theoretically rigorous model of tonal tension, grounded in both music theory and cognitive science. Enables quantification of the tension/relaxation arc that listeners experience. Crucial for expressive performance analysis and generative composition with narrative arc.

**How it works in a symbolic toolkit:**

- **Pitch-space distance** (`delta_d`): Compute the distance between two chords by counting the minimum number of steps on the following hierarchy:
  - Level a: Chromatic (12 pitch classes)
  - Level b: Diatonic (7 scale degrees of the key)
  - Level c: Triadic (3 notes of the chord)
  - Level d: Fifth (root + fifth)
  - Level e: Root (root alone)
  - Distance = number of pitch classes that differ between the two chords' basic spaces
- **Surface dissonance** (`delta_s`): Count non-chord tones and their dissonance weight (passing tones, suspensions, etc.).
- **Hierarchical tension:** Tension of event e = `alpha * delta_d(e, local_tonic) + beta * delta_s(e)`, modulated by position in the prolongational reduction tree.
- **Attraction:** Melodic attraction quantifies how strongly a pitch "wants" to resolve to a nearby stable pitch, based on proximity and stability difference.

**Sources:**

- [Tonal Pitch Space (Oxford University Press)](https://global.oup.com/academic/product/tonal-pitch-space-9780195178296)
- [Computational models of tonal tension (Springer)](https://link.springer.com/chapter/10.1007/978-3-319-25931-4_9)
- [TPS applications in music analysis (Springer)](https://link.springer.com/chapter/10.1007/978-3-031-60638-0_15)

### 5.2 Spiral Array Tension Model (Herremans-Chew / MorpheuS)

**What it does:** Uses Chew's **Spiral Array** to compute three geometric tension metrics: **cloud diameter** (dissonance), **cloud momentum** (harmonic change rate), and **tensile strain** (distance from the prevailing key).

**Why it is valuable:** More computationally tractable than Lerdahl's full TPS model while capturing similar perceptual dimensions. All three metrics are simple geometric calculations in the Spiral Array space. Used in MorpheuS for tension-aware music generation.

**How it works in a symbolic toolkit:**

- **Spiral Array construction:** Map each pitch class k (distance from C on the line of fifths) to a 3D point:

```
P(k) = (r*sin(k*pi/2), r*cos(k*pi/2), k*h)
```

where `r` = helix radius, `h` = helix rise.

- **Center of Effect (CE):** For a chord, the CE is a weighted sum of its constituent pitch positions:

```
CE_chord = w1*P(root) + w2*P(third) + w3*P(fifth)
```

where `w1 > w3 > w2` (root weighted most, then fifth, then third).

- **Three tension metrics:**
  - **Cloud diameter:** Maximum pairwise distance between all simultaneously sounding pitch positions. High value = dissonant.
  - **Cloud momentum:** Distance between consecutive chord CEs. High value = rapid harmonic movement.
  - **Tensile strain:** Distance between the current chord CE and the key CE. High value = far from tonal center.

**Sources:**

- [Spiral Array Model (KCL)](https://eniale.kcl.ac.uk/spiral-array-model/)
- [Spiral Array tension metrics (HAL)](https://hal.science/hal-03277753/document)
- [MorpheuS: tension-aware music generation (HAL)](https://hal.science/hal-03278024/file/herremans2017morpheusFullIEEE_0.pdf)

### 5.3 Huron's ITPRA Theory (Expectation and Emotion)

**What it does:** Models the emotional responses to musical events through five temporally-ordered response systems: **Imagination** (pre-outcome fantasy), **Tension** (pre-outcome arousal), **Prediction** (post-outcome accuracy reward), **Reaction** (post-outcome fast defense), and **Appraisal** (post-outcome conscious evaluation).

**Why it is valuable:** Provides a psychologically grounded framework for why music is emotionally powerful. Connects statistical surprise (information content) to specific emotional responses. Enables principled design of emotionally effective musical passages.

**How it works in a symbolic toolkit:**

- **Statistical learning model:** Build n-gram or variable-order Markov models of pitch and rhythm from a training corpus. These represent the "expectations" of a listener enculturated in that style.
- **Prediction response (P):** When the actual next event matches the prediction, positive valence (satisfaction). When it deviates, negative valence (surprise). Quantify as:

```
prediction_response(event) = -log2(P(event | context))  // information content
```

High IC = surprising = initially negative P response.

- **Reaction response (R):** Fast, automatic response. Negative for unexpected events (startle), positive for expected events.
- **Appraisal response (A):** Slower cognitive evaluation. Can override initial responses (e.g., appreciating an unexpected chord after processing).
- **Tension (T):** Pre-event uncertainty, modeled as Shannon entropy of the predictive distribution:

```
tension(context) = H(next_event | context) = -SUM(P(e|context) * log2(P(e|context)))
```

High entropy = high uncertainty = high tension.

**Sources:**

- [Sweet Anticipation: Music and the Psychology of Expectation (Huron, ResearchGate)](https://www.researchgate.net/publication/209436188_Sweet_Anticipation_Music_and_the_Psychology_of_Expectation)
- [ITPRA Theory overview](https://thebiasedmindblogdotcom.wordpress.com/2014/02/26/itpra-theory/)

### 5.4 IDyOM (Information Dynamics of Music)

**What it does:** A computational model that learns statistical regularities from symbolic music corpora using variable-order Markov models with multiple viewpoints (pitch, interval, scale degree, duration, etc.). For each note in a sequence, it outputs a probability distribution, from which information content (surprise) and entropy (uncertainty) are computed.

**Why it is valuable:** The most extensively validated computational model of musical expectation, with strong correlations to EEG, fMRI, and behavioral data. Provides note-by-note surprise and uncertainty curves that predict listener neural responses. Available as both Common Lisp (original) and Python (IDyOMpy) implementations.

**How it works in a symbolic toolkit:**

- **Multiple viewpoints:** Instead of predicting raw MIDI pitch alone, combine predictions from multiple "views" of the music: pitch class, interval, contour, scale degree, duration, inter-onset interval. Each viewpoint captures different statistical regularities.
- **Variable-order Markov model:** For each viewpoint, build a Markov model that adaptively chooses the optimal context length (order) using the **Prediction by Partial Matching (PPM)** algorithm. Short contexts for rare patterns, long contexts for common patterns.
- **Information content (IC):** For each note n in context C:

```
IC(n) = -log2(P(n | C))   // bits
```

High IC = surprising note.

- **Entropy:** Uncertainty about what comes next:

```
H(C) = -SUM_n(P(n | C) * log2(P(n | C)))
```

- **Combined model:** Merge predictions from short-term (piece-specific) and long-term (corpus-trained) models using geometric mean weighting.

**Sources:**

- [IDyOM source code (GitHub)](https://github.com/mtpearce/idyom)
- [IDyOM computational model (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0165027024002929)
- [IDyOM project home (Marcus Pearce)](http://www.marcus-pearce.com/idyom/)

---

## 6. Counterpoint and Polyphony

### 6.1 Species Counterpoint Rule Checking

**What it does:** Evaluates a two-voice (or multi-voice) passage against the rules of Fuxian species counterpoint, producing a list of violations with severity weights. Can also generate valid counterpoint given a cantus firmus.

**Why it is valuable:** Provides objective evaluation of contrapuntal writing quality. Serves as a constraint system for algorithmic composition. The five species (note-against-note, 2:1, 4:1, syncopated/suspension, florid) cover the fundamental techniques of Western polyphonic writing.

**How it works in a symbolic toolkit:**

**Rule categories to implement:**

**First Species (1:1):**

- Forbidden parallel perfect consonances (parallel fifths, parallel octaves)
- Forbidden direct/hidden fifths and octaves (similar motion into perfect consonance)
- Consonance requirement (all intervals must be consonant: unison, 3rd, 5th, 6th, octave)
- Contrary/oblique motion preference
- Voice crossing prohibition
- Beginning and ending on perfect consonances
- Stepwise motion preference with limited leaps

**Second through Fifth Species add:**

- Passing tone rules (dissonances on weak beats approached/left by step)
- Suspension rules (prepared dissonance on strong beat resolving stepwise down)
- Cambiata patterns
- Proper treatment of the leading tone

**Implementation approach (Variable Neighbourhood Search):**

- Start with a random melody against the cantus firmus
- Define an objective function that sums weighted rule violations
- Iteratively modify one or two notes, accepting improvements
- VNS escapes local optima by exploring progressively larger neighborhoods

**Alternative implementations:**

- **Answer Set Programming (ASP):** Encode rules as logical constraints; solver finds all valid solutions
- **Genetic algorithms:** Evolve populations of counterpoint lines using rule compliance as fitness
- **Contrapunctus software:** Implements rules from Fux, Jeppesen, and Salzer for up to 4 voices in 6 modes

**Sources:**

- [Variable neighbourhood search for counterpoint generation (ResearchGate)](https://www.researchgate.net/publication/315714500_A_variable_neighbourhood_search_algorithm_to_generate_first_species_counterpoint_musical_scores)
- [CONTRAPUNCTUS: Species counterpoint analysis and generation (Academia)](https://www.academia.edu/25995307/CONTRAPUNCTUS_V_1_0_A_SPECIES_COUNTERPOINT_ANALYSIS_AND_GENERATION_SOFTWARE_BASED_ON_THE_RULES_OF_FUX_JEPPESEN_AND_SALZER)
- [Computational counterpoint (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0957417413003692)

### 6.2 Polyphonic Stream Separation (Voice Separation)

**What it does:** Given a polyphonic symbolic score (e.g., a piano piece or MIDI file with overlapping notes), separates the notes into individual melodic voices/streams.

**Why it is valuable:** Essential preprocessing step for any voice-leading, counterpoint, or melodic analysis of polyphonic music. Most MIDI data arrives as a "note soup" without explicit voice assignments. Accurate voice separation enables all subsequent analytical techniques.

**How it works in a symbolic toolkit:**

**Auditory streaming principles (Bregman):**

- **Proximity:** Notes closer in pitch are more likely to belong to the same stream
- **Continuity:** Streams prefer stepwise motion and consistent direction
- **Temporal proximity:** Notes closer in time are more likely connected
- **Register consistency:** Streams tend to stay within a register band

**The VoiSe algorithm:**

1. Build a "same-voice predicate" using a trained decision tree that considers: pitch distance, time gap, direction continuity, and register overlap
2. For each note, predict which existing voice it belongs to (or start a new voice)
3. Apply a voice-numbering algorithm that assigns consistent voice labels

**Contig mapping approach:**

1. Identify "contigs" -- maximally connected sequences of notes where each note's onset overlaps with the previous note's duration
2. Map contigs to voices based on pitch proximity and register consistency

**Clustering approach:**

- Model stream segregation as a clustering problem using adapted single-link clustering
- Distance metric combines pitch distance, temporal gap, and directional continuity
- Threshold parameter controls the granularity of stream separation

**Sources:**

- [Voice separation in polyphonic music: A data-driven approach (Academia)](https://www.academia.edu/1024093/Voice_separation_in_polyphonic_music_A_data_driven_approach)
- [Separating Voices in Polyphonic Music: A Contig Mapping Approach (ResearchGate)](https://www.researchgate.net/publication/221494117_Separating_Voices_in_Polyphonic_Music_A_Contig_Mapping_Approach)
- [Polyphonic stream separation (INRIA HAL)](https://inria.hal.science/hal-01821044/document)

### 6.3 Textural Analysis

**What it does:** Classifies and quantifies the musical texture at each point in time: monophonic (single voice), homophonic (melody + chordal accompaniment), polyphonic (multiple independent voices), homorhythmic (same rhythm, different pitches), etc.

**Why it is valuable:** Texture is a primary dimension of musical form and expression that is rarely analyzed computationally. Changes in texture often mark formal boundaries. Textural density and type inform orchestration analysis and style classification.

**How it works in a symbolic toolkit:**

- **Voice count tracking:** Count the number of simultaneously active voices at each time point.
- **Rhythmic independence measure:** Compute the rhythmic correlation between voice pairs. High correlation = homorhythmic; low correlation = polyphonic.

```
rhythmic_independence(v1, v2) = 1 - correlation(onset_pattern(v1), onset_pattern(v2))
```

- **Melodic independence measure:** Compute the correlation between voice contours. Parallel motion = homophonic accompaniment; contrary/oblique = independent.
- **Texture classification:**
  - **Monophony:** 1 active voice
  - **Homophony:** 2+ voices with high rhythmic correlation and one dominant melody
  - **Polyphony:** 2+ voices with low rhythmic correlation and independent contours
  - **Homorhythm:** 2+ voices with very high rhythmic correlation and independent pitches

---

## 7. Generative/Transformational Theory

### 7.1 Pitch-Class Set Operations

**What it does:** Implements the full apparatus of **pitch-class set theory** (Forte, Rahn): normal form, prime form, interval vector, set-class identification, and inclusion/complement relations.

**Why it is valuable:** The foundational analytical framework for post-tonal (atonal, serial, freely chromatic) music. Essential for analyzing Schoenberg, Webern, Berg, Bartok, Messiaen, and much contemporary art music. Also applicable to analyzing "out" passages in jazz.

**How it works in a symbolic toolkit:**

- **Pitch-class set representation:** Store as a 12-bit integer (bitmask) where bit i = 1 means pitch class i is present. This enables O(1) transposition, inversion, and set operations.

```
C major triad {0, 4, 7} = 0b000010010001 = 0x091 = 145
transpose(set, n) = rotate_bits_left(set, n)  // mod 12
inversion(set) = reverse_bits(set)  // complement of interval pattern
```

- **Normal form (Rahn algorithm):**
  1. List pitch classes in ascending order
  2. Generate all rotations
  3. Select the rotation with the smallest outer interval
  4. Break ties by comparing successively smaller intervals from the left
- **Prime form:** Compute normal form of both the set and its inversion, select the more compact one.
- **Forte number lookup:** Map each prime form to its Forte catalog number (e.g., {0,1,4} -> 3-3).
- **Interval vector:** For each of the 6 interval classes (1-6), count the number of times that interval appears between pairs of pitch classes in the set.

```
interval_vector(set) = [count(ic1), count(ic2), ..., count(ic6)]
// C major triad {0,4,7}: ic vector = [0,0,1,1,1,0]
```

- **Set relations:** Subset/superset testing (bitwise AND), complement (bitwise NOT mod 12 bits), Z-relation (same interval vector, different prime form).

**Sources:**

- [Pitch-class set theory (Music Theory Online)](https://mtosmt.org/issues/mto.04.10.3/mto.04.10.3.collins.html)
- [Forte number (Wikipedia)](https://en.wikipedia.org/wiki/Forte_number)
- [MIDI and pitch-class set operations (Nazareth College)](https://www-pub.naz.edu/~jturner9/MidiForthConf94.html)

### 7.2 Serial Operations (Twelve-Tone Technique)

**What it does:** Given a twelve-tone row (a permutation of all 12 pitch classes), computes all 48 row forms (12 transpositions x 4 forms: prime, retrograde, inversion, retrograde-inversion) and organizes them in a 12x12 matrix.

**Why it is valuable:** Essential for analyzing serial/twelve-tone music (Second Viennese School, post-war serialism, and contemporary music using serial techniques). The matrix provides a complete catalog of available pitch materials for a given row.

**How it works in a symbolic toolkit:**

- **Twelve-tone matrix generation:**

Given prime row `P0 = [p0, p1, p2, ..., p11]`:

```
1. Compute the inversion row I0:
   I0[i] = (2 * P0[0] - P0[i]) mod 12
   // Each element is the inversion of P0 around the first note

2. Build the 12x12 matrix:
   Row i = transpose P0 such that it starts on I0[i]
   matrix[i][j] = (P0[j] - P0[0] + I0[i]) mod 12

3. Read forms:
   P_n: Row n read left to right
   R_n: Row n read right to left
   I_n: Column n read top to bottom
   RI_n: Column n read bottom to top
```

- **Row form identification:** Given a 12-note sequence, determine which of the 48 row forms it matches (if any), accounting for octave equivalence.
- **Combinatoriality detection:** Determine if the row is hexachordally combinatorial (first 6 notes of P0 and I_n together contain all 12 pitch classes).
- **Invariance computation:** Find which row forms share the same unordered subsets at corresponding positions (important for hearing serial relationships).

**Sources:**

- [Twelve-tone technique (Puget Sound)](https://musictheory.pugetsound.edu/mt21c/section-195.html)
- [Algorithmic Modeling of Twelve Tone Serialism (ResearchGate)](https://www.researchgate.net/publication/305316328_Algorithmic_Modeling_and_Software_Framework_of_a_Twelve_Tone_Serialism)
- [12-tone composition reference (Unitus)](https://www.unitus.org/FULL/12tone.pdf)

### 7.3 Advanced Transformational Operations

**What it does:** Implements generalized musical transformations beyond simple transposition and inversion: rotation (cyclic permutation of a sequence), multiplicative operations (`M5`, `M7`), interval expansion/contraction, and **Klumpenhouwer networks**.

**Why it is valuable:** Provides the analytical and compositional tools for working with post-tonal and freely-structured music. These operations form the "vocabulary" of **transformational theory** (David Lewin), which views musical analysis as the study of operations that map one musical object to another.

**How it works in a symbolic toolkit:**

- **Rotation:** Cyclic permutation of a sequence.

```
rotate(sequence, n) = sequence[n:] + sequence[:n]
// [0,1,4,7,8,11] rotated by 2 = [4,7,8,11,0,1]
```

- **Multiplicative operations:**

```
M5(pc) = (pc * 5) mod 12   // maps ic1 to ic5 (semitones to fourths)
M7(pc) = (pc * 7) mod 12   // maps ic1 to ic7 (semitones to fifths)
```

- **Interval expansion/contraction:**

```
expand(sequence, factor) = [sequence[0]] + cumulative_sum([interval * factor for interval in intervals(sequence)])
```

- **Generalized Interval System (GIS):** Lewin's abstract framework where any musical space + group of intervals + interval function defines a GIS. Enables transformational analysis of pitch, rhythm, timbre, and any other parameterizable musical dimension.

**Sources:**

- [Transformational theory and GIS (Wiley)](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1468-2249.2008.00257.x)
- [Computational Musicology and transformational analysis (IRCAM)](http://repmus.ircam.fr/_media/moreno/BigoAndreatta_Computational_Musicology.pdf)

---

## Summary: Feature Priority Matrix for a Symbolic Music Toolkit

| Feature | Analytical Value | Generative Value | Implementation Complexity | Dependencies |
|---|---|---|---|---|
| Pitch-class set operations | Very High | High | Low | None |
| Twelve-tone matrix | High | High | Low | None |
| Interval vector / Forte number | High | Medium | Low | PC set ops |
| Neo-Riemannian transforms (PLR) | Very High | Very High | Low-Medium | None |
| Tonnetz representation | Very High | High | Medium | None |
| Tonal Interval Vectors (TIS/TIV) | Very High | High | Medium | DFT |
| Self-similarity matrix | Very High | Medium | Medium | Feature extraction |
| Novelty detection (Foote) | Very High | Medium | Low | SSM |
| SIA/COSIATEC pattern discovery | Very High | Medium | High | None |
| Voice separation | Very High | N/A (preprocessing) | High | None |
| Counterpoint rule checking | High | Very High | Medium | Voice separation |
| Rhythmic complexity measures | High | High | Low-Medium | None |
| Syncopation / groove quantification | High | High | Medium | Metrical structure |
| GTTM metrical/grouping analysis | Very High | High | Very High | None |
| Lerdahl TPS tension | Very High | Very High | High | GTTM (partial) |
| Spiral Array tension (MorpheuS) | High | Very High | Medium | None |
| IDyOM-style surprise/entropy | Very High | High | High | Training corpus |
| Harmonic network analysis | High | Medium | Medium | Graph library |
| Geometric voice leading | High | Very High | Medium | None |
| Parsimonious voice leading | High | Very High | Low | None |
| Chord-scale theory | High | Very High | Medium | Chord/scale database |
| Textural analysis | Medium | Medium | Medium | Voice separation |

This research represents the current state of the art across all seven requested domains. Each technique has been described with sufficient algorithmic detail to guide implementation in a symbolic music toolkit operating on MIDI and score data.
