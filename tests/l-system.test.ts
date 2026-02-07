import { describe, it, expect } from 'vitest';
import { LSystem, PITCH_MAPPING, RHYTHM_MAPPING } from '../src/index.js';
import type { ProductionRule, SymbolMapping } from '../src/index.js';

describe('LSystem constructor', () => {
  it('creates an L-system', () => {
    const ls = new LSystem('A', [{ predecessor: 'A', successor: 'AB' }]);
    expect(ls.axiom).toBe('A');
    expect(ls.rules).toHaveLength(1);
  });

  it('throws on empty axiom', () => {
    expect(() => new LSystem('', [])).toThrow(RangeError);
  });

  it('throws on multi-char predecessor', () => {
    expect(() =>
      new LSystem('A', [{ predecessor: 'AB', successor: 'C' }]),
    ).toThrow(RangeError);
  });
});

describe('LSystem.iterate', () => {
  it('returns axiom at iteration 0', () => {
    const ls = new LSystem('A', [{ predecessor: 'A', successor: 'AB' }]);
    expect(ls.iterate(0)).toBe('A');
  });

  it('applies rules for 1 iteration', () => {
    const ls = new LSystem('A', [
      { predecessor: 'A', successor: 'AB' },
      { predecessor: 'B', successor: 'A' },
    ]);
    expect(ls.iterate(1)).toBe('AB');
  });

  it('produces classic Algae sequence', () => {
    // Algae: A→AB, B→A
    const ls = new LSystem('A', [
      { predecessor: 'A', successor: 'AB' },
      { predecessor: 'B', successor: 'A' },
    ]);
    expect(ls.iterate(0)).toBe('A');
    expect(ls.iterate(1)).toBe('AB');
    expect(ls.iterate(2)).toBe('ABA');
    expect(ls.iterate(3)).toBe('ABAAB');
    expect(ls.iterate(4)).toBe('ABAABABA');
    expect(ls.iterate(5)).toBe('ABAABABAABAAB');
  });

  it('passes through unmatched characters', () => {
    const ls = new LSystem('AXB', [
      { predecessor: 'A', successor: 'AA' },
    ]);
    expect(ls.iterate(1)).toBe('AAXB');
  });

  it('throws on negative iterations', () => {
    const ls = new LSystem('A', []);
    expect(() => ls.iterate(-1)).toThrow(RangeError);
  });
});

describe('LSystem context-sensitive rules', () => {
  it('matches left context', () => {
    const rules: ProductionRule[] = [
      { predecessor: 'B', leftContext: 'A', successor: 'X' },
      { predecessor: 'B', successor: 'Y' },
    ];
    const ls = new LSystem('ABB', rules);
    // Position 1: B with left=A → X
    // Position 2: B with left=B → Y (no context match, falls to free rule)
    expect(ls.iterate(1)).toBe('AXY');
  });

  it('matches right context', () => {
    const rules: ProductionRule[] = [
      { predecessor: 'A', rightContext: 'B', successor: 'X' },
      { predecessor: 'A', successor: 'Y' },
    ];
    const ls = new LSystem('ABА', rules);
    // Position 0: A with right=B → X
    expect(ls.iterate(1)).toBe('XBА');
  });

  it('matches both left and right context', () => {
    const rules: ProductionRule[] = [
      { predecessor: 'B', leftContext: 'A', rightContext: 'C', successor: 'X' },
      { predecessor: 'B', successor: 'Y' },
    ];
    const ls = new LSystem('ABCB', rules);
    expect(ls.iterate(1)).toBe('AXCY');
  });

  it('context-sensitive rules take priority over context-free', () => {
    const rules: ProductionRule[] = [
      { predecessor: 'A', successor: 'Z' }, // context-free
      { predecessor: 'A', leftContext: 'B', successor: 'X' }, // context-sensitive
    ];
    const ls = new LSystem('BA', rules);
    // B has no rule → identity. A with left=B → X (context-sensitive wins over Z)
    expect(ls.iterate(1)).toBe('BX');
  });
});

describe('LSystem.toSequence', () => {
  it('generates events from pitch mapping', () => {
    const ls = new LSystem('CDE', []);
    const mapping: SymbolMapping = { pitch: PITCH_MAPPING };
    const events = ls.toSequence(mapping, 0); // 0 iterations = axiom
    expect(events).toHaveLength(3);
    expect(events[0]!.pitchClass).toBe(0); // C
    expect(events[1]!.pitchClass).toBe(2); // D
    expect(events[2]!.pitchClass).toBe(4); // E
  });

  it('assigns default duration 480 when only pitch is mapped', () => {
    const ls = new LSystem('C', []);
    const events = ls.toSequence({ pitch: PITCH_MAPPING }, 0);
    expect(events[0]!.duration).toBe(480);
  });

  it('assigns default pitchClass 0 when only rhythm is mapped', () => {
    const ls = new LSystem('q', []);
    const events = ls.toSequence({ rhythm: RHYTHM_MAPPING }, 0);
    expect(events[0]!.pitchClass).toBe(0);
    expect(events[0]!.duration).toBe(480);
  });

  it('skips unmapped characters', () => {
    const ls = new LSystem('CXD', []);
    const mapping: SymbolMapping = {
      pitch: new Map([['C', 0], ['D', 2]]),
    };
    const events = ls.toSequence(mapping, 0);
    expect(events).toHaveLength(2);
    expect(events[0]!.index).toBe(0);
    expect(events[1]!.index).toBe(1);
  });

  it('returns frozen array with frozen events', () => {
    const ls = new LSystem('CD', []);
    const events = ls.toSequence({ pitch: PITCH_MAPPING }, 0);
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[0])).toBe(true);
  });

  it('works with iterated output', () => {
    const ls = new LSystem('A', [
      { predecessor: 'A', successor: 'AB' },
      { predecessor: 'B', successor: 'A' },
    ]);
    const mapping: SymbolMapping = {
      pitch: new Map([['A', 9], ['B', 11]]),
    };
    const events = ls.toSequence(mapping, 3);
    // iterate(3) = 'ABAAB'
    expect(events).toHaveLength(5);
    expect(events.map(e => e.pitchClass)).toEqual([9, 11, 9, 9, 11]);
  });
});

describe('Built-in mappings', () => {
  it('PITCH_MAPPING has standard note letters', () => {
    expect(PITCH_MAPPING.get('C')).toBe(0);
    expect(PITCH_MAPPING.get('G')).toBe(7);
    expect(PITCH_MAPPING.get('B')).toBe(11);
    expect(PITCH_MAPPING.get('a')).toBe(9); // lowercase
  });

  it('RHYTHM_MAPPING has standard durations', () => {
    expect(RHYTHM_MAPPING.get('w')).toBe(1920);
    expect(RHYTHM_MAPPING.get('h')).toBe(960);
    expect(RHYTHM_MAPPING.get('q')).toBe(480);
    expect(RHYTHM_MAPPING.get('e')).toBe(240);
    expect(RHYTHM_MAPPING.get('s')).toBe(120);
  });
});
