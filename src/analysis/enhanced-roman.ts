// ---------------------------------------------------------------------------
// Stratum — Enhanced Roman Numeral Analysis
// ---------------------------------------------------------------------------
//
// Extends the basic roman numeral analysis with:
// - Secondary/applied dominants (V/V, V7/IV, viio/V, etc.)
// - Neapolitan chord (bII)
// - Augmented sixth chords (Italian, French, German)
// - Borrowed chords (modal mixture)
// - Inversion figures (I6, V64, V43, etc.)
// - Functional harmony scoring

import type { ChordLabel } from './harmonic.js';

/** Key context for enhanced Roman numeral analysis. */
export interface RomanNumeralKey {
  /** Tonic pitch class (0-11). */
  readonly tonic: number;
  /** Mode: 'major' or 'minor'. */
  readonly mode: 'major' | 'minor';
}

/** Enhanced Roman numeral label with additional context. */
export interface EnhancedRomanNumeral {
  /** Full Roman numeral string (e.g., "V7/V", "bII", "It6"). */
  readonly numeral: string;
  /** Scale degree of root relative to key (1-7, with chromatic alterations). */
  readonly degree: number;
  /** Quality: 'major', 'minor', 'diminished', 'augmented', 'dominant'. */
  readonly quality: string;
  /** Inversion figure (e.g., '', '6', '64', '65', '43', '42'). */
  readonly inversion: string;
  /** If secondary/applied, the target degree (e.g., 5 for "/V"). */
  readonly secondaryTarget: number | null;
  /** Whether this is a borrowed chord (modal mixture). */
  readonly borrowed: boolean;
  /** Functional harmony score 0-100 (higher = stronger tonal function). */
  readonly functionScore: number;
}

// ---- Scale degree templates ----

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

// Expected chord qualities on each scale degree in major
// I ii iii IV V vi viio
const MAJOR_QUALITIES: readonly string[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
const MINOR_QUALITIES: readonly string[] = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];

// Roman numeral names by degree (0-indexed)
const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio'];
const MINOR_NUMERALS = ['i', 'iio', 'III', 'iv', 'v', 'VI', 'VII'];

// ---- Helpers ----

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

function getScaleDegree(pc: number, tonic: number, scale: readonly number[]): number | null {
  const interval = mod12(pc - tonic);
  const idx = scale.indexOf(interval);
  return idx >= 0 ? idx + 1 : null;
}

export function chordQualityFromSymbol(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.includes('dim')) return 'diminished';
  if (s.includes('aug')) return 'augmented';
  // Check 'dom' before 'min' to avoid false positive on 'dom' containing 'm'
  if (s.includes('dom') || (s.includes('7') && !s.includes('maj7') && !s.includes('min7'))) return 'dominant';
  if (s.includes('min')) return 'minor';
  return 'major';
}

function detectInversion(chord: ChordLabel, bass?: number): string {
  if (bass === undefined || bass === chord.root) return '';
  const interval = mod12(bass - chord.root);
  const pcs = chord.pcs;

  // Triad inversions
  if (pcs.length === 3) {
    if (interval === 3 || interval === 4) return '6';  // first inversion
    if (interval === 7) return '64';                     // second inversion
  }

  // Seventh chord inversions
  if (pcs.length >= 4) {
    if (interval === 3 || interval === 4) return '65'; // first inversion
    if (interval === 7) return '43';                    // second inversion
    if (interval === 10 || interval === 11) return '42'; // third inversion
  }

  return '6'; // default first inversion
}

// ---- Augmented Sixth detection ----

interface Aug6Result {
  type: 'It6' | 'Fr6' | 'Ger6';
}

function detectAug6(pcs: readonly number[], tonic: number): Aug6Result | null {
  // Augmented sixths are built on b6
  const b6 = mod12(tonic + 8); // bVI degree
  const sharpIV = mod12(tonic + 6); // #4

  const pcSet = new Set(pcs);
  if (!pcSet.has(b6) || !pcSet.has(sharpIV)) return null;

  const hasRoot = pcSet.has(mod12(tonic)); // 1
  const hasSecond = pcSet.has(mod12(tonic + 2)); // 2
  const hasThird = pcSet.has(mod12(tonic + 9)); // b3 from b6 (which is the third of the chord)

  // Italian: b6, 1, #4 (3 notes)
  if (pcSet.has(hasRoot ? tonic : -1) && pcs.length === 3) {
    if (pcSet.has(mod12(tonic))) return { type: 'It6' };
  }

  // German: b6, 1, b3, #4 (4 notes)
  if (pcSet.has(mod12(tonic)) && pcSet.has(mod12(tonic + 3))) {
    return { type: 'Ger6' };
  }

  // French: b6, 1, 2, #4 (4 notes)
  if (pcSet.has(mod12(tonic)) && pcSet.has(mod12(tonic + 2))) {
    return { type: 'Fr6' };
  }

  // Italian: b6, 1, #4
  if (pcSet.has(mod12(tonic))) {
    return { type: 'It6' };
  }

  return null;
}

// ---- Secondary/Applied chords ----

function detectSecondary(
  chord: ChordLabel,
  key: RomanNumeralKey,
): { numeral: string; target: number } | null {
  const scale = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;

  // Check if this chord could be V or viio of a diatonic degree
  for (let targetDeg = 0; targetDeg < 7; targetDeg++) {
    const targetPc = mod12(key.tonic + scale[targetDeg]!);

    // Check V/x: chord root a fifth above target — must be major or dominant quality
    const vOfTarget = mod12(targetPc + 7); // dominant of target
    if (chord.root === vOfTarget) {
      const sym = chord.symbol.toLowerCase();
      const isMajOrDom = !sym.includes('min') && !sym.includes('dim');
      if (isMajOrDom) {
        const targetDegName = (key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS)[targetDeg]!;
        const ext = sym.includes('7') ? '7' : '';
        // Skip V/I and V/i (that's just V)
        if (targetDeg === 0) continue;
        return { numeral: `V${ext}/${targetDegName}`, target: targetDeg + 1 };
      }
    }

    // Check viio/x: chord root a semitone below target — must be diminished quality
    const viiOfTarget = mod12(targetPc - 1);
    if (chord.root === viiOfTarget) {
      const sym = chord.symbol.toLowerCase();
      if (sym.includes('dim')) {
        const targetDegName = (key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS)[targetDeg]!;
        const ext = sym.includes('7') ? '7' : '';
        if (targetDeg === 0) continue;
        return { numeral: `viio${ext}/${targetDegName}`, target: targetDeg + 1 };
      }
    }
  }

  return null;
}

// ---- Borrowed chord detection ----

function isBorrowed(chord: ChordLabel, key: RomanNumeralKey): boolean {
  if (key.mode !== 'major') return false; // Only detect borrowing from minor in major keys

  // Common borrowed chords in major: chords using the minor scale
  const majorPcs = new Set(MAJOR_SCALE.map(d => mod12(d + key.tonic)));
  const minorPcs = new Set(MINOR_SCALE.map(d => mod12(d + key.tonic)));

  // Check if any chord tone is from minor but not major
  for (const pc of chord.pcs) {
    if (minorPcs.has(pc) && !majorPcs.has(pc)) {
      return true;
    }
  }

  return false;
}

// ---- Functional harmony score ----

/**
 * Compute a functional harmony score (0-100) for a chord in a key.
 *
 * Tonic function (I, vi) scores highest, dominant (V, viio) second,
 * subdominant (IV, ii) third. Non-diatonic chords score lower.
 *
 * @param chord - The chord label.
 * @param key - The key context.
 * @returns Score from 0 (no tonal function) to 100 (strong tonic).
 */
export function functionalHarmonyScore(chord: ChordLabel, key: RomanNumeralKey): number {
  const scale = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  const degree = getScaleDegree(chord.root, key.tonic, scale);

  if (degree === null) {
    // Non-diatonic root — check if secondary dominant
    const secondary = detectSecondary(chord, key);
    if (secondary) return 50; // Applied chords have moderate function
    return 20; // Chromatic chord with weak function
  }

  // Functional hierarchy by degree (1-indexed)
  const scores: Record<number, number> = {
    1: 100, // I — strongest tonic
    5: 85,  // V — dominant
    4: 70,  // IV — subdominant
    6: 65,  // vi — tonic substitute
    2: 60,  // ii — subdominant
    3: 45,  // iii — weak tonic/dominant
    7: 55,  // viio — dominant function
  };

  let score = scores[degree] ?? 30;

  // Bonus for expected quality
  const expectedQualities = key.mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES;
  const expectedQuality = expectedQualities[degree - 1]!;
  const actualQuality = chordQualityFromSymbol(chord.symbol);
  if (actualQuality === expectedQuality) score = Math.min(100, score + 5);

  // Penalty for borrowed chords (still functional but weaker)
  if (isBorrowed(chord, key)) score = Math.max(0, score - 10);

  return score;
}

// ---- Main analysis function ----

/**
 * Perform enhanced Roman numeral analysis on a chord in a key context.
 *
 * Identifies:
 * - Standard diatonic Roman numerals (I, ii, iii, IV, V, vi, viio)
 * - Secondary dominants (V/V, V7/IV, viio/V)
 * - Neapolitan chord (bII)
 * - Augmented sixth chords (It6, Fr6, Ger6)
 * - Borrowed chords (modal mixture)
 * - Inversion figures
 *
 * @param chord - The chord to analyze.
 * @param key - The key context.
 * @param bass - Optional bass pitch class for inversion detection.
 * @returns Enhanced Roman numeral analysis.
 */
export function enhancedRomanNumeral(
  chord: ChordLabel,
  key: RomanNumeralKey,
  bass?: number,
): EnhancedRomanNumeral {
  const scale = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  const inversion = detectInversion(chord, bass);
  const borrowed = isBorrowed(chord, key);

  // Check for augmented sixth chords
  const aug6 = detectAug6(chord.pcs, key.tonic);
  if (aug6) {
    return {
      numeral: aug6.type,
      degree: 6,
      quality: 'augmented',
      inversion: '',
      secondaryTarget: null,
      borrowed: false,
      functionScore: 70, // Strong dominant function
    };
  }

  // Check for Neapolitan (bII) before diatonic — bII root is chromatic
  const bIIroot = mod12(key.tonic + 1);
  if (chord.root === bIIroot) {
    const sym = chord.symbol.toLowerCase();
    if (!sym.includes('min') && !sym.includes('dim')) {
      return {
        numeral: inversion ? `bII${inversion}` : 'bII',
        degree: 2,
        quality: 'major',
        inversion,
        secondaryTarget: null,
        borrowed: false,
        functionScore: 55,
      };
    }
  }

  // Standard diatonic analysis — check BEFORE secondary dominants
  const degree = getScaleDegree(chord.root, key.tonic, scale);
  const numerals = key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;

  if (degree !== null) {
    // Check if chord quality matches expected diatonic quality
    const expectedQualities = key.mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES;
    const expectedQ = expectedQualities[degree - 1]!;
    const actualQ = chordQualityFromSymbol(chord.symbol);

    // If quality doesn't match diatonic expectation, might be secondary dominant
    // e.g., D major or D7 (V/V, V7/V) in C major where diatonic D is minor (ii)
    if (actualQ !== expectedQ) {
      const secondary = detectSecondary(chord, key);
      if (secondary) {
        return {
          numeral: inversion ? `${secondary.numeral}${inversion}` : secondary.numeral,
          degree,
          quality: actualQ,
          inversion,
          secondaryTarget: secondary.target,
          borrowed: false,
          functionScore: functionalHarmonyScore(chord, key),
        };
      }
    }

    let numeral = numerals[degree - 1]!;
    const sym = chord.symbol.toLowerCase();

    // Add extension
    if (sym.includes('7')) numeral += '7';
    if (inversion) numeral += inversion;

    return {
      numeral,
      degree,
      quality: actualQ,
      inversion,
      secondaryTarget: null,
      borrowed,
      functionScore: functionalHarmonyScore(chord, key),
    };
  }

  // Non-diatonic root: check for secondary dominants
  const secondary = detectSecondary(chord, key);
  if (secondary) {
    return {
      numeral: inversion ? `${secondary.numeral}${inversion}` : secondary.numeral,
      degree: 0,
      quality: chordQualityFromSymbol(chord.symbol),
      inversion,
      secondaryTarget: secondary.target,
      borrowed: false,
      functionScore: functionalHarmonyScore(chord, key),
    };
  }

  // Chromatic chord — try to describe relative to key
  const interval = mod12(chord.root - key.tonic);
  const chromaticDegreeNames = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  let baseName = chromaticDegreeNames[interval] ?? '?';
  const sym = chord.symbol.toLowerCase();

  // Use lowercase for minor/dim
  if (sym.includes('min') || sym.includes('dim')) {
    baseName = baseName.toLowerCase();
  }
  if (sym.includes('dim')) baseName += 'o';
  if (sym.includes('aug')) baseName += '+';
  if (sym.includes('7')) baseName += '7';
  if (inversion) baseName += inversion;

  return {
    numeral: baseName,
    degree: Math.floor(interval / 2) + 1,
    quality: chordQualityFromSymbol(chord.symbol),
    inversion,
    secondaryTarget: null,
    borrowed,
    functionScore: functionalHarmonyScore(chord, key),
  };
}
