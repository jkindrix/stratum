# stratum

[![CI](https://github.com/jkindrix/stratum/actions/workflows/ci.yml/badge.svg)](https://github.com/jkindrix/stratum/actions/workflows/ci.yml)

Music analysis toolkit. Pitch-class sets, tension curves, chromatic staff rendering, MIDI I/O, harmonic analysis, tuning systems.

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
| **Voice Leading** | `voiceLeadingDistance`, `smoothestVoiceLeading` |
| **Scales & Chords** | `SCALE_CATALOG`, `CHORD_CATALOG`, `scaleFromPcs`, `scaleFromIntervals`, `modeRotation`, `chordFromPcs`, `chordFromName`, `chordFromIntervals` |
| **Tuning** | `equalTemperament`, `TET_12`, `TET_19`, `TET_24`, `TET_31`, `TET_53`, `PYTHAGOREAN`, `JUST_5_LIMIT`, `JUST_7_LIMIT`, `QUARTER_COMMA_MEANTONE`, `frequencyFromTuning`, `centsDeviation`, `nearestStep` |
| **Time** | `buildMetricLevels`, `beatStrength`, `maxBeatStrength`, `syncopation`, `metricPosition`, `findPatterns`, `quantize`, `swing`, `durationName`, `durationTicks` |
| **Tension** | `roughness`, `roughnessFromMidi`, `computeTension`, `tensionVelocity`, `tensionAcceleration`, `tensionIntegral`, `findTensionPeaks`, `findTensionValleys`, `classifyTensionProfile` |
| **I/O** | `midiToScore`, `scoreToMidi`, `scoreToJSON`, `scoreFromJSON` |
| **Render** | `renderChromaticStaff`, `renderTensionCurve`, `renderOverlay` |
| **Analysis** | `identifyChord`, `identifyScale`, `harmonicRhythm`, `romanNumeralAnalysis`, `contour`, `range`, `meanPitch`, `intervalHistogram`, `stepLeapRatio`, `segmentByRests`, `segmentByPattern`, `eventDensityCurve`, `registralEnvelope` |

## Subpath Imports

```typescript
import { PitchClassSet } from 'stratum/pitch';
import { computeTension } from 'stratum/tension';
import { midiToScore } from 'stratum/io';
import { renderChromaticStaff } from 'stratum/render';
import { identifyChord } from 'stratum/analysis';
import { buildMetricLevels } from 'stratum/time';
```

## Design Decisions

**Why pitch classes as integers?** Every semitone gets equal treatment. No accidentals, no enharmonic confusion. `{0, 4, 7}` is a major triad regardless of whether you call it C major or B# major. This is not new (Allen Forte, 1973) but it's the right foundation for a computational toolkit.

**Why Plomp-Levelt roughness?** It's the best-validated psychoacoustic model of sensory dissonance. Two tones sound rough when their partials fall within the critical bandwidth. The model computes this from first principles — no lookup tables, no cultural assumptions. Configurable harmonic count (default 6) with 1/n amplitude rolloff.

**Why proportional notation for the SVG?** The chromatic staff's value proposition is interval consistency: a major third always spans 4 lines, a perfect fifth always spans 7. Proportional (piano-roll) rendering matches this — duration maps to width. This is the view that makes the chromatic staff useful for analysis and production.

**Why multi-component tension?** Musical tension isn't one thing. The library decomposes it into four measurable components (roughness, metric displacement, registral extremity, density) with configurable weights. This follows the PHASE specification's tension surface model.

**Zero dependencies.** The MIDI parser, roughness model, SVG renderer, set-theory engine, and all analysis functions are implemented from scratch. No runtime dependencies.

## Algorithm Limitations

- **Voice leading:** Uses brute-force permutation search for sets up to size 8. For larger sets, falls back to a greedy approximation.
- **Roughness model:** Assumes harmonic series with 1/n amplitude rolloff. Real instrument timbres may differ significantly.
- **Pattern detection:** Compares interval profiles; does not account for rhythmic variation or transposition tolerance by default.
- **Forte catalog:** Complete 220-entry catalog covers cardinalities 2-10. Trivial cases (0, 1, 11, 12 elements) handled separately.
- **Tension normalization:** Each component independently normalized to [0, 1]; the composite is a weighted sum, not a perceptual calibration.

## License

MIT
