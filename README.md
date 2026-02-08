# stratum

[![CI](https://github.com/jkindrix/stratum/actions/workflows/ci.yml/badge.svg)](https://github.com/jkindrix/stratum/actions/workflows/ci.yml)

Music analysis toolkit. Pitch-class sets, tension curves, key detection, Neo-Riemannian transforms, twelve-tone serial analysis, MusicXML I/O, voice separation, counterpoint, SVG visualization, algorithmic composition, and more.

Zero runtime dependencies. TypeScript. Strict mode. ESM.

See the [full API reference](#api-summary) below.

## Install

```
npm install stratum
```

## What It Does

### Pitch-Class Set Analysis

```typescript
import { PitchClassSet } from 'stratum';

const cMajor = new PitchClassSet([0, 4, 7]);

cMajor.transpose(7);        // → {2, 7, 11}  (G major)
cMajor.invert();             // → {0, 5, 8}   (F minor)
cMajor.primeForm();          // → [0, 3, 7]
cMajor.intervalVector();     // → [0, 0, 1, 1, 1, 0]
cMajor.forteName();          // → '3-11'
cMajor.intervalStructure();  // → [4, 3, 5]

// Diatonic scale
const diatonic = new PitchClassSet([0, 2, 4, 5, 7, 9, 11]);
diatonic.forteName();        // → '7-35'

// Voice-leading distance
import { voiceLeadingDistance } from 'stratum';
voiceLeadingDistance([0, 4, 7], [0, 5, 9]);  // → 3 (C major to F major)
voiceLeadingDistance([0, 4, 7], [0, 3, 7]);  // → 1 (C major to C minor)
```

### Tension Curves

```typescript
import { createScore, addPart, addNote, computeTension } from 'stratum';

const score = createScore({ tempo: 120 });
const piano = addPart(score, { name: 'Piano' });

// Add a C major chord
addNote(score, piano, { midi: 60, onset: 0, duration: 960, velocity: 80 });
addNote(score, piano, { midi: 64, onset: 0, duration: 960, velocity: 80 });
addNote(score, piano, { midi: 67, onset: 0, duration: 960, velocity: 80 });

const curve = computeTension(score, {
  roughness: 0.3,   // sensory roughness (Plomp-Levelt)
  metric: 0.3,      // metric displacement
  registral: 0.2,   // distance from pitch center
  density: 0.2,     // event density
});

// Each point: { tick, seconds, total, components: { roughness, metric, registral, density } }
console.log(curve[0].total);           // 0-1 normalized tension
console.log(curve[0].components);      // per-source breakdown
```

### Tension Derivatives

```typescript
import {
  computeTension, tensionVelocity, tensionAcceleration,
  tensionIntegral, findTensionPeaks, classifyTensionProfile,
} from 'stratum';

const curve = computeTension(score);
const velocity = tensionVelocity(curve);        // T'(t) — rate of change
const acceleration = tensionAcceleration(curve); // T''(t) — acceleration
const integral = tensionIntegral(curve, 0, 1920); // cumulative tension
const peaks = findTensionPeaks(curve);           // local maxima
const profile = classifyTensionProfile(curve);   // 'ramp' | 'plateau' | 'release' | 'oscillation' | 'flat'
```

### Chromatic Staff SVG

```typescript
import { createScore, addPart, addNote, renderChromaticStaff } from 'stratum';

const score = createScore();
const p = addPart(score, { name: 'Melody' });
addNote(score, p, { midi: 60, onset: 0, duration: 480 });
addNote(score, p, { midi: 64, onset: 480, duration: 480 });
addNote(score, p, { midi: 67, onset: 960, duration: 480 });

const svg = renderChromaticStaff(score, {
  pixelsPerTick: 0.15,
  pixelsPerSemitone: 8,
  lowNote: 48,      // C3
  highNote: 84,     // C6
  showMeasures: true,
  showLabels: true,
});

// Write to file or embed in HTML
```

The chromatic staff gives every semitone its own line position. No accidentals. Octave boundaries are heavy lines, natural notes are dashed, chromatic notes are thin solid. Each note is a horizontal block whose width = duration. Multiple parts get distinct colors.

### Tension Curve SVG

```typescript
import { computeTension, renderTensionCurve } from 'stratum';

const curve = computeTension(score);
const svg = renderTensionCurve(curve, {
  width: 800,
  height: 300,
  showComponents: true,  // overlay roughness, metric, registral, density lines
  timeAxis: 'seconds',
});
```

### MIDI I/O

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { midiToScore, scoreToMidi, computeTension, renderChromaticStaff } from 'stratum';

// Import a MIDI file
const midi = readFileSync('bach.mid');
const score = midiToScore(new Uint8Array(midi));

console.log(score.parts.length);           // number of tracks
console.log(score.parts[0].events.length); // notes in first track
console.log(score.tempoChanges[0].bpm);    // tempo

// Analyze it
const tension = computeTension(score);
const svg = renderChromaticStaff(score);

// Export back to MIDI
const exported = scoreToMidi(score);
writeFileSync('output.mid', exported);
```

### MusicXML Import/Export

```typescript
import { readFileSync } from 'fs';
import {
  musicXmlToScore, scoreToMusicXML, detectKey, romanNumeralAnalysis,
} from 'stratum';

// Import MusicXML (string or .mxl Uint8Array)
const xml = readFileSync('score.musicxml', 'utf-8');
const { score, warnings } = musicXmlToScore(xml);

// Detect key and analyze harmony
const allEvents = score.parts.flatMap(p => p.events);
const key = detectKey(allEvents);
console.log(key.name);  // e.g. "C major"

const analysis = romanNumeralAnalysis(score, 480);
for (const rn of analysis) {
  console.log(`${rn.roman} (${rn.quality})`);
}

// Export back to MusicXML
const exported = scoreToMusicXML(score);
```

### Neo-Riemannian Transforms

```typescript
import {
  nrtTransform, classifyNRT, nrtPath, hexatonicCycle,
  triadPitchClasses,
} from 'stratum';

// P, L, R transforms on triads
const cMajor = { root: 0, quality: 'major' as const };
const cMinor = nrtTransform(cMajor, 'P');      // C minor (parallel)
const abMajor = nrtTransform(cMajor, 'L');     // Ab major (leading-tone)
const aMinor = nrtTransform(cMajor, 'R');      // A minor (relative)

// Compound transforms
const result = classifyNRT(cMajor, abMajor);   // 'L'

// Find shortest path between triads
const path = nrtPath(cMajor, { root: 4, quality: 'minor' });
console.log(path);  // ['R', 'L', ...]

// Hexatonic cycle: 6 triads alternating P and L
const cycle = hexatonicCycle(cMajor);
console.log(cycle.map(t => triadPitchClasses(t)));
```

### Twelve-Tone Serial Analysis

```typescript
import {
  createRow, twelvetoneMatrix, getRowForm, identifyForm,
  isAllInterval, combinatoriality,
} from 'stratum';

// Create Webern's row from Op. 21
const row = createRow([0, 11, 3, 4, 8, 7, 9, 5, 6, 1, 2, 10]);

// Generate the 12x12 matrix
const matrix = twelvetoneMatrix(row);
console.log(matrix.P[0]);   // P0: [0, 11, 3, 4, 8, 7, 9, 5, 6, 1, 2, 10]
console.log(matrix.I[0]);   // I0: [0, 1, 9, 8, 4, 5, 3, 7, 6, 11, 10, 2]
console.log(matrix.R[0]);   // R0: [10, 2, 1, 6, 5, 9, 7, 8, 4, 3, 11, 0]

// Get specific row forms
const P3 = getRowForm(row, 'P', 3);
const RI7 = getRowForm(row, 'RI', 7);

// Identify a row form
const id = identifyForm(row, P3);
console.log(id);  // { form: 'P', transposition: 3 }

// Check properties
console.log(isAllInterval(row));              // false
console.log(combinatoriality(row));           // combinatoriality analysis
```

### Self-Similarity & Structural Analysis

```typescript
import {
  selfSimilarityMatrix, noveltyDetection, noveltyPeaks,
  findStructuralBoundaries, chromaticFeature,
} from 'stratum';

// Build self-similarity matrix from a score
const ssm = selfSimilarityMatrix(score, 480, 480);
console.log(`${ssm.matrix.length}x${ssm.matrix.length} matrix`);

// Detect novelty (section boundaries)
const novelty = noveltyDetection(ssm, 8);
const peaks = noveltyPeaks(novelty, 0.3);
console.log(`Found ${peaks.length} section boundaries`);

// Multi-scale structural boundaries
const boundaries = findStructuralBoundaries(score, {
  windowSize: 480,
  hopSize: 480,
  kernelSizes: [4, 8, 16],
  threshold: 0.3,
});
for (const b of boundaries) {
  console.log(`Boundary at tick ${b.tick} (strength ${b.strength.toFixed(2)})`);
}
```

### TIV Tension & Roughness

```typescript
import {
  tivTensionCurve, computeTension, scoreTension,
  tiv, tivDistance, tivConsonance,
} from 'stratum';

// TIV (Tonal Interval Vector) analysis
const cMajChroma = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
const cMajTiv = tiv(cMajChroma);
console.log('TIV consonance:', tivConsonance(cMajTiv));

// Compare with Plomp-Levelt roughness side by side
const tivCurve = tivTensionCurve(score, 480, 480);
const plCurve = computeTension(score, { roughness: 1.0 });

// Composite score-level tension (TPS + Spiral Array + TIV)
const composite = scoreTension(score, {
  windowSize: 480,
  hopSize: 480,
  weights: { tps: 0.4, spiral: 0.3, tiv: 0.3 },
});
```

### Voice Separation & Counterpoint

```typescript
import {
  separateVoices, checkFirstSpecies, contrapuntalMotion,
} from 'stratum';

// Separate a polyphonic texture into independent voices
const result = separateVoices(score.parts[0].events, { nVoices: 4 });
console.log(`Separated into ${result.voices.length} voices`);

for (const voice of result.voices) {
  console.log(`Voice: ${voice.events.length} notes, range ${voice.low}-${voice.high}`);
}

// Check first-species counterpoint rules between two voices
const check = checkFirstSpecies(
  result.voices[0].events,
  result.voices[1].events,
);
console.log(`${check.violations.length} violations found`);
for (const v of check.violations) {
  console.log(`  ${v.type}: ${v.description} (${v.severity})`);
}
```

### Statistical Style Comparison

```typescript
import {
  styleFingerprint, styleSimilarity,
  shannonEntropy, zipfDistribution,
} from 'stratum';

// Build style fingerprints from two different pieces
const fp1 = styleFingerprint(score1.parts[0].events);
const fp2 = styleFingerprint(score2.parts[0].events);

// Compare them
const similarity = styleSimilarity(fp1, fp2);
console.log(`Style similarity: ${(similarity * 100).toFixed(1)}%`);

// Detailed statistics
console.log('Entropy:', shannonEntropy(score1.parts[0].events));
const zipf = zipfDistribution(score1.parts[0].events);
console.log('Zipf exponent:', zipf.exponent.toFixed(2));
```

### Scala Tuning & MOS Scales

```typescript
import {
  parseScl, mosScale, mosStepPattern, renderChromaticStaff,
  createScore, addPart, addNote,
} from 'stratum';

// Parse a Scala .scl file
const scl = parseScl(`! Pythagorean
Pythagorean 12-note
12
256/243
9/8
32/27
81/64
4/3
729/512
3/2
128/81
27/16
16/9
243/128
2/1`);
console.log(`${scl.pitchCount} degrees`);

// Build a MOS (Moment of Symmetry) scale
const mos = mosScale(7, 12);  // 7 notes from 12 EDO → diatonic
const pattern = mosStepPattern(7, 12);
console.log(pattern);  // e.g. "LLsLLLs"
```

### Markov Chain Composition

```typescript
import {
  markovTransition, markovGenerate, createScore, addPart, addNote,
  scoreToMidi,
} from 'stratum';

// Build Markov chain from existing music
const events = score.parts[0].events;
const chain = markovTransition(events, 2);  // order-2

// Generate new sequence
const generated = markovGenerate(chain, 32, { temperature: 0.8 });

// Build a score from generated MIDI numbers
const newScore = createScore({ tempo: 120 });
const part = addPart(newScore, { name: 'Generated' });
for (let i = 0; i < generated.length; i++) {
  addNote(newScore, part, {
    midi: generated[i],
    onset: i * 480,
    duration: 480,
  });
}

// Export to MIDI
const midi = scoreToMidi(newScore);
```

### Tonnetz Visualization

```typescript
import { renderTonnetz } from 'stratum';

// Render a Tonnetz diagram highlighting a chord progression
const svg = renderTonnetz({
  highlighted: [
    [0, 4, 7],    // C major
    [0, 3, 7],    // C minor
    [8, 0, 3],    // Ab major
  ],
  width: 600,
  height: 400,
});
```

### Corpus Analysis

```typescript
import {
  createCorpus, loadCorpus, batchAnalyze, corpusStatistics,
  styleFingerprint,
} from 'stratum';

// Load multiple scores into a corpus
const corpus = loadCorpus([
  { data: score1, format: 'score', id: 'bach-prelude', metadata: { composer: 'Bach' } },
  { data: score2, format: 'score', id: 'mozart-sonata', metadata: { composer: 'Mozart' } },
  { data: score3, format: 'score', id: 'chopin-nocturne', metadata: { composer: 'Chopin' } },
]);

// Run analysis across all entries
const fingerprints = batchAnalyze(corpus, entry =>
  styleFingerprint(entry.score.parts[0].events),
);

// Compute statistics
const stats = corpusStatistics(corpus, entry =>
  entry.score.parts[0].events.length,
);
console.log(`Mean notes: ${stats.mean.toFixed(0)}, StdDev: ${stats.stddev.toFixed(0)}`);
```

### Figured Bass Realization

```typescript
import {
  parseFiguredBass, realizeFiguredBass, figuredBassAnalysis,
} from 'stratum';

// Parse figured bass symbols
const fb6 = parseFiguredBass('6');
console.log(fb6.intervals);  // [{ interval: 6, accidental: null }, { interval: 3, accidental: null }]

const fb65 = parseFiguredBass('6/5');
console.log(fb65.intervals);  // [{ interval: 6, ... }, { interval: 5, ... }, { interval: 3, ... }]

// Realize over a bass note (C3 = MIDI 48) in C major
const chord = realizeFiguredBass(48, fb6, {
  tonic: 0,
  mode: 'major',
  accidentals: new Map(),
});
console.log(chord.midiNotes);  // [48, 52, 57] — C3, E3, A3 (Am first inversion)
```

### JI Lattice Visualization

```typescript
import { renderJILattice } from 'stratum';

// Render a 5-limit just intonation lattice
const svg = renderJILattice({
  nodes: [
    { x: 0, y: 0, label: '1/1', ratio: [1, 1] },
    { x: 1, y: 0, label: '3/2', ratio: [3, 2] },
    { x: 2, y: 0, label: '9/8', ratio: [9, 8] },
    { x: 0, y: 1, label: '5/4', ratio: [5, 4] },
    { x: 1, y: 1, label: '15/8', ratio: [15, 8] },
    { x: -1, y: 0, label: '4/3', ratio: [4, 3] },
  ],
  width: 500,
  height: 400,
});
```

### JSON Serialization

```typescript
import { scoreToJSON, scoreFromJSON } from 'stratum';

const json = scoreToJSON(score);   // plain JSON object with version field
const restored = scoreFromJSON(json); // full schema validation on import
```

### Pitch Utilities

```typescript
import {
  pitchFromMidi, pitchToFrequency, pitchName, parsePitchName,
  directedInterval, intervalClass, intervalClassName,
  roughnessFromMidi,
} from 'stratum';

pitchName(pitchFromMidi(60));          // 'C4'
pitchToFrequency(pitchFromMidi(69));   // 440
parsePitchName('F#5').midi;            // 78

directedInterval(0, 7);               // 7  (C up to G)
intervalClass(0, 7);                   // 5  (P5 = IC5)
intervalClassName(5);                  // 'perfect fourth/fifth'

roughnessFromMidi([60, 61]);           // high (semitone)
roughnessFromMidi([60, 67]);           // low  (perfect fifth)
```

### Scales, Modes, and Chords

```typescript
import {
  SCALE_CATALOG, CHORD_CATALOG, chordFromPcs, chordFromName,
  scaleFromPcs, modeRotation, PitchClassSet,
} from 'stratum';

// Find a scale
const ionian = SCALE_CATALOG.find(s => s.name === 'Ionian');
console.log(ionian.intervals); // [2, 2, 1, 2, 2, 2, 1]

// Rotate to get modes
const dorian = modeRotation(ionian, 1); // Dorian mode

// Identify a chord from pitch classes
const result = chordFromPcs(new PitchClassSet([0, 4, 7]));
console.log(result.chord.name); // 'major'

// Build a chord from name
const chord = chordFromName('Cmaj7');
console.log(chord.chord.intervals); // [0, 4, 7, 11]
```

### Tuning Systems

```typescript
import { TET_12, TET_19, JUST_5_LIMIT, frequencyFromTuning, centsDeviation } from 'stratum';

frequencyFromTuning(TET_12, 9, 4);      // 440 (A4 in 12-TET)
frequencyFromTuning(JUST_5_LIMIT, 7, 4); // ~329.6 (just fifth above C4)

// Compare tuning deviations from 12-TET
centsDeviation(JUST_5_LIMIT, 7); // deviation of the fifth in cents
```

### Harmonic and Melodic Analysis

```typescript
import {
  identifyChord, identifyScale, harmonicRhythm,
  contour, range, meanPitch, stepLeapRatio,
  segmentByRests, eventDensityCurve,
} from 'stratum';

// Chord identification from simultaneous notes
const chord = identifyChord(score.parts[0].events.filter(e => e.onset === 0));

// Scale identification from a passage
const scale = identifyScale(score.parts[0].events);

// Harmonic rhythm (rate of chord changes)
const rhythm = harmonicRhythm(score, 480);

// Melodic analysis
const events = score.parts[0].events;
const c = contour(events);        // ['up', 'down', 'same', ...]
const r = range(events);          // { lowest, highest, semitones }
const avg = meanPitch(events);    // average MIDI number
const ratio = stepLeapRatio(events); // 0-1 (1 = all stepwise)

// Phrase segmentation
const phrases = segmentByRests(events, 480);
const density = eventDensityCurve(score, 480);
```

### Metric Analysis

```typescript
import { buildMetricLevels, beatStrength, syncopation } from 'stratum';

const levels = buildMetricLevels(
  { numerator: 4, denominator: 4, atTick: 0 },
  480,  // ticks per quarter
);

beatStrength(0, levels);     // high (downbeat)
beatStrength(480, levels);   // medium (beat 2)
beatStrength(240, levels);   // low (offbeat)

syncopation(240, 127, levels);  // high (loud note on weak beat)
syncopation(0, 127, levels);    // ~0   (loud note on downbeat)
```

### Pattern Detection

```typescript
import { findPatterns } from 'stratum';

// Pass an array of NoteEvent objects
const patterns = findPatterns(score.parts[0].events, 3, 8);

for (const p of patterns) {
  console.log(`Pattern [${p.intervals}] occurs ${p.occurrences.length} times`);
}
```

### Quantize and Swing

```typescript
import { quantize, swing, durationName, durationTicks } from 'stratum';

const quantized = quantize(events, 480);   // snap to quarter-note grid
const swung = swing(events, 0.67, 240);   // apply swing to eighth notes

durationName(480);     // 'quarter'
durationTicks('half'); // 960
```

## API Summary

| Module | Functions |
|--------|-----------|
| **Core** | `createScore`, `addPart`, `addNote`, `removePart`, `removeNote`, `getAllEvents`, `getEventsInRange`, `getEventsAtTick`, `tickToSeconds`, `secondsToTick`, `getScoreDuration`, `cloneScore`, `mergeScores` |
| **Pitch** | `pitchFromMidi`, `pitchFromPcOctave`, `pitchToFrequency`, `frequencyToPitch`, `pitchClassName`, `pitchClassFlatName`, `pitchName`, `parsePitchName`, `normalizePc`, `directedInterval`, `intervalClass`, `intervalClassName`, `semitoneDist` |
| **Sets** | `PitchClassSet` — `.transpose()`, `.invert()`, `.complement()`, `.normalForm()`, `.primeForm()`, `.intervalVector()`, `.intervalStructure()`, `.forteName()`, `.forteEntry()`, `.union()`, `.intersection()`, `.difference()`, `.symmetricDifference()`, `.isSubsetOf()`, `.isSupersetOf()`, `.toNoteNames()` |
| **Forte Catalog** | `FORTE_CATALOG`, `FORTE_BY_NAME` — complete 220-entry catalog with interval vectors |
| **Voice Leading** | `voiceLeadingDistance`, `smoothestVoiceLeading`, `voiceLeadingVector`, `geometricDistance`, `opticEquivalence`, `parsimonyScore`, `commonToneCount` |
| **PCS Similarity** | `icvsim`, `angleSimilarity`, `pcSetCosine`, `zRelation`, `earthMoversDistance` |
| **Scales & Chords** | `SCALE_CATALOG`, `CHORD_CATALOG`, `scaleFromPcs`, `scaleFromIntervals`, `modeRotation`, `chordFromPcs`, `chordFromName`, `chordFromIntervals` |
| **Tuning** | `equalTemperament`, `TET_12`–`TET_53`, `PYTHAGOREAN`, `JUST_5_LIMIT`, `JUST_7_LIMIT`, `QUARTER_COMMA_MEANTONE`, `frequencyFromTuning`, `centsDeviation`, `nearestStep`, `centsBetween`, `centsToRatio`, `ratioToCents`, `edoStepToCents`, `parseScl`, `parseKbm` |
| **Pitch Spelling** | `spellPitch`, `spellPitchSequence` |
| **Monzo / Rank-2** | `monzoToCents`, `monzoToRatio`, `ratioToMonzo`, `monzoAdd`, `monzoSubtract`, `monzoScale`, `mosScale`, `mosStepPattern`, `isMos`, `mosTree`, `patentVal`, `valMapping`, `temperamentError` |
| **Time** | `buildMetricLevels`, `beatStrength`, `maxBeatStrength`, `syncopation`, `metricPosition`, `findPatterns`, `quantize`, `swing`, `durationName`, `durationTicks`, `lzComplexity`, `syncopationIndex`, `weightedNoteToBeatDistance`, `grooveScore`, `metricalPreference`, `groupingBoundaries`, `hierarchicalMeter` |
| **Tension** | `roughness`, `roughnessFromMidi`, `computeTension`, `tensionVelocity`, `tensionAcceleration`, `tensionIntegral`, `findTensionPeaks`, `findTensionValleys`, `classifyTensionProfile` |
| **Tonal Pitch Space** | `basicSpace`, `tpsDistance`, `surfaceDissonance`, `melodicAttraction`, `scoreTension`, `tpsTensionCurve`, `spiralTensionCurve`, `tivTensionCurve` |
| **TIV / DFT** | `chromaVector`, `tiv`, `tivDistance`, `tivConsonance`, `dftCoefficients` |
| **Spiral Array** | `spiralArrayPosition`, `centerOfEffect`, `cloudDiameter`, `cloudMomentum`, `tensileStrain` |
| **I/O** | `midiToScore`, `scoreToMidi`, `scoreToJSON`, `scoreFromJSON`, `musicXmlToScore`, `scoreToMusicXML`, `kernToScore`, `abcToScore`, `meiToScore`, `scoreToLilyPond`, `toJAMS`, `toRomanText`, `fromRomanText`, `inflate`, `unzip`, `isMxl` |
| **Scala I/O** | `parseScl`, `parseKbm`, `tuningFromScl`, `sclToString`, `kbmToString` |
| **Render** | `renderChromaticStaff`, `renderTensionCurve`, `renderOverlay`, `renderPCDistribution`, `renderICVRadar`, `renderCircleOfFifths`, `renderFormDiagram`, `renderSSM`, `renderTonnetz`, `renderChordGraph`, `renderJILattice`, `renderPitchSpacePlot`, `renderWavescape` |
| **Key Detection** | `detectKey`, `detectKeyWindowed`, `detectKeyTIV`, `keyName`, `pcDistribution`, `detectModulations` |
| **Roman Numerals** | `romanNumeralAnalysis`, `enhancedRomanNumeral`, `functionalHarmonyScore`, `chordQualityFromSymbol` |
| **Neo-Riemannian** | `nrtTransform`, `classifyNRT`, `nrtCompound`, `nrtPath`, `hexatonicCycle`, `octatonicCycle`, `hexatonicPole`, `weitzmannRegion`, `triadPitchClasses`, `seventhChordPitchClasses`, `nrt7Transform`, `classifyNRT7`, `nrt7Compound`, `nrt7Path` |
| **Serial** | `createRow`, `twelvetoneMatrix`, `getRowForm`, `rowMultiply`, `rowRotate`, `combinatoriality`, `invariantPcs`, `identifyForm`, `isAllInterval`, `allIntervalRows`, `multiply`, `M5`, `M7`, `setMultiplication`, `intervalExpansion`, `isHexachordallyCombinatorialP/I/R/RI`, `isAllCombinatorialHexachord`, `classifyAllCombinatorialType`, `segmentalInvariance`, `derivedRow` |
| **Statistics** | `shannonEntropy`, `rhythmicEntropy`, `zipfDistribution`, `markovTransition`, `markovGenerate`, `ngramCounts`, `pitchDistribution`, `intervalDistribution`, `durationDistribution`, `chordTypeDistribution`, `styleFingerprint`, `styleSimilarity` |
| **Chord-Scale** | `classifyTones`, `availableTensions`, `avoidNotes`, `chordScaleMatch`, `hpcp`, `chordScaleScore`, `bestChordScale`, `analyzeOverHarmony`, `CHORD_SCALE_MAP`, `availableScales` |
| **Self-Similarity** | `selfSimilarityMatrix`, `enhanceSSM`, `noveltyDetection`, `noveltyPeaks`, `multiScaleNovelty`, `findStructuralBoundaries`, `chromaticFeature`, `cosineSimilarity`, `euclideanSimilarity`, `correlationSimilarity`, `pitchHistogramFeature`, `rhythmFeature`, `intervalFeature`, `combinedFeature` |
| **SIA / SIATEC** | `pointSetRepresentation`, `sia`, `siatec`, `cosiatec`, `compressionRatio` |
| **Expectation** | `buildMarkovModel`, `informationContent`, `contextEntropy`, `surpriseCurve`, `entropyCurve`, `combineModels`, `viewpointScaleDegree`, `VIEWPOINT_PITCH`, `VIEWPOINT_MIDI`, `VIEWPOINT_INTERVAL`, `VIEWPOINT_CONTOUR`, `VIEWPOINT_DURATION` |
| **Voice Separation** | `separateVoices` |
| **Counterpoint** | `checkFirstSpecies`, `checkSecondSpecies`, `checkFourthSpecies`, `contrapuntalMotion` |
| **Texture** | `textureType`, `rhythmicIndependence`, `textureProfile`, `voiceCount` |
| **Harmonic Network** | `chordTransitionGraph`, `transitionProbabilities`, `graphCentrality`, `detectCommunities`, `findCycles`, `compareGraphs` |
| **Evaluation** | `chordAccuracy`, `keyAccuracy`, `segmentationPrecisionRecall`, `voiceSeparationAccuracy`, `overlapRatio` |
| **Figured Bass** | `parseFiguredBass`, `realizeFiguredBass`, `figuredBassAnalysis` |
| **K-net / GIS** | `buildKNet`, `kNetIsography`, `buildGIS`, `gisInterval`, `pitchClassGIS`, `pitchGIS`, `durationGIS` |
| **Corpus** | `createCorpus`, `loadCorpus`, `corpusSearch`, `corpusFilter`, `batchAnalyze`, `corpusStatistics`, `crossWorkSearch` |
| **Composition** | `poissonOnsets`, `gaussianPitches`, `uniformRhythm`, `exponentialDurations`, `cauchyPitches`, `weightedChoice`, `Sieve`, `sieve`, `LSystem`, `elementaryCA`, `gameOfLife`, `caToEvents`, `checkParallelFifths`, `checkParallelOctaves`, `checkVoiceCrossing`, `isInRange`, `checkLeapResolution` |
| **Melodic** | `identifyChord`, `identifyScale`, `harmonicRhythm`, `contour`, `range`, `meanPitch`, `intervalHistogram`, `stepLeapRatio`, `segmentByRests`, `segmentByPattern`, `eventDensityCurve`, `registralEnvelope` |

## Subpath Imports

```typescript
import { PitchClassSet } from 'stratum/pitch';
import { computeTension } from 'stratum/tension';
import { midiToScore } from 'stratum/io';
import { renderChromaticStaff } from 'stratum/render';
import { identifyChord } from 'stratum/analysis';
import { buildMetricLevels } from 'stratum/time';
import { poissonOnsets } from 'stratum/composition';
```

## Design Decisions

**Why pitch classes as integers?** Every semitone gets equal treatment. No accidentals, no enharmonic confusion. `{0, 4, 7}` is a major triad regardless of whether you call it C major or B# major. This is not new (Allen Forte, 1973) but it's the right foundation for a computational toolkit.

**Why Plomp-Levelt roughness?** It's the best-validated psychoacoustic model of sensory dissonance. Two tones sound rough when their partials fall within the critical bandwidth. The model computes this from first principles — no lookup tables, no cultural assumptions. Configurable harmonic count (default 6) with 1/n amplitude rolloff.

**Why proportional notation for the SVG?** The chromatic staff's value proposition is interval consistency: a major third always spans 4 lines, a perfect fifth always spans 7. Proportional (piano-roll) rendering matches this — duration maps to width. This is the view that makes the chromatic staff useful for analysis and production.

**Why multi-component tension?** Musical tension isn't one thing. The library decomposes it into four measurable components (roughness, metric displacement, registral extremity, density) with configurable weights. This follows the PHASE specification's tension surface model.

**Why Neo-Riemannian transforms?** PLR operations capture parsimonious voice leading between triads — each transform moves exactly one voice by one semitone. This enables analysis of chromatic progressions (e.g. Romantic harmony) that don't reduce well to Roman numeral analysis.

**Why zero-dependency MusicXML?** The XML parser is a custom recursive-descent implementation (~200 lines). The .mxl container support includes an inline RFC 1951 DEFLATE decompressor and ZIP extractor. No libxml2, no zlib, no Node.js-specific APIs — works in any ES2020 environment.

**Zero dependencies.** The MIDI parser, roughness model, SVG renderer, set-theory engine, XML parser, DEFLATE decompressor, and all analysis functions are implemented from scratch. No runtime dependencies.

## Algorithm Limitations

- **Voice leading:** Uses brute-force permutation search for sets up to size 8. For larger sets, falls back to a greedy approximation.
- **Roughness model:** Assumes harmonic series with 1/n amplitude rolloff. Real instrument timbres may differ significantly.
- **Pattern detection:** Compares interval profiles; does not account for rhythmic variation or transposition tolerance by default.
- **Forte catalog:** Complete 220-entry catalog covers cardinalities 2-10. Trivial cases (0, 1, 11, 12 elements) handled separately.
- **Tension normalization:** Each component independently normalized to [0, 1]; the composite is a weighted sum, not a perceptual calibration.
- **Key detection (K-S):** The Krumhansl-Schmuckler algorithm can be ambiguous between relative major/minor keys for passages with equal pitch-class durations.
- **SIA complexity:** O(n^2 log n) for n note events. For scores with 1000+ events, consider windowing.
- **Repeat expansion:** Handles simple repeats, endings, D.C., D.S., al Fine, and al Coda. Nested repeats within D.C./D.S. passes are skipped (standard practice).

## License

MIT
