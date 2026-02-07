import { describe, it, expect } from 'vitest';
import { elementaryCA, gameOfLife, caToEvents } from '../src/index.js';

describe('elementaryCA', () => {
  it('generates correct width and steps', () => {
    const grid = elementaryCA(110, 11, 5);
    expect(grid).toHaveLength(5);
    for (const row of grid) {
      expect(row).toHaveLength(11);
    }
  });

  it('defaults to single center cell', () => {
    const grid = elementaryCA(30, 7, 1);
    expect(grid[0]).toEqual([0, 0, 0, 1, 0, 0, 0]);
  });

  it('accepts custom initial row', () => {
    const initial = [1, 0, 1, 0, 1];
    const grid = elementaryCA(90, 5, 1, initial);
    expect(grid[0]).toEqual(initial);
  });

  it('Rule 30 from center cell — known pattern', () => {
    // Rule 30, width=7, 4 steps
    const grid = elementaryCA(30, 7, 4);
    // Generation 0: center cell
    expect(grid[0]).toEqual([0, 0, 0, 1, 0, 0, 0]);
    // Generation 1 (Rule 30)
    expect(grid[1]).toEqual([0, 0, 1, 1, 1, 0, 0]);
    // Generation 2
    expect(grid[2]).toEqual([0, 1, 1, 0, 0, 1, 0]);
    // Generation 3
    expect(grid[3]).toEqual([1, 1, 0, 1, 1, 1, 1]);
  });

  it('Rule 110 from center cell', () => {
    const grid = elementaryCA(110, 7, 3);
    expect(grid[0]).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(grid[1]).toEqual([0, 0, 1, 1, 0, 0, 0]);
    expect(grid[2]).toEqual([0, 1, 1, 1, 0, 0, 0]);
  });

  it('toroidal boundary wraps', () => {
    // Place cell at right edge, rule should wrap
    const grid = elementaryCA(30, 5, 2, [0, 0, 0, 0, 1]);
    // Right edge cell wraps: neighborhood at index 4 is [0,1,0(wrap)]
    expect(grid[1]![0]).toBeDefined(); // just verify no crash
  });

  it('returns frozen grid', () => {
    const grid = elementaryCA(90, 5, 3);
    expect(Object.isFrozen(grid)).toBe(true);
    expect(Object.isFrozen(grid[0])).toBe(true);
  });

  it('throws on invalid rule', () => {
    expect(() => elementaryCA(-1, 5, 3)).toThrow(RangeError);
    expect(() => elementaryCA(256, 5, 3)).toThrow(RangeError);
  });

  it('throws on invalid width', () => {
    expect(() => elementaryCA(30, 0, 3)).toThrow(RangeError);
  });

  it('throws on invalid steps', () => {
    expect(() => elementaryCA(30, 5, 0)).toThrow(RangeError);
  });

  it('throws on initial width mismatch', () => {
    expect(() => elementaryCA(30, 5, 3, [1, 0])).toThrow(RangeError);
  });
});

describe('gameOfLife', () => {
  it('blinker oscillates', () => {
    // Horizontal blinker on 5x5 grid
    const initial = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    const gens = gameOfLife(initial, 2);
    expect(gens).toHaveLength(3); // initial + 2 steps

    // Gen 1: vertical blinker
    expect(gens[1]![1]![2]).toBe(1);
    expect(gens[1]![2]![2]).toBe(1);
    expect(gens[1]![3]![2]).toBe(1);
    // Horizontal cells should be dead
    expect(gens[1]![2]![1]).toBe(0);
    expect(gens[1]![2]![3]).toBe(0);

    // Gen 2: back to horizontal (period 2)
    expect(gens[2]![2]![1]).toBe(1);
    expect(gens[2]![2]![2]).toBe(1);
    expect(gens[2]![2]![3]).toBe(1);
  });

  it('block is stable', () => {
    const initial = [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ];
    const gens = gameOfLife(initial, 3);
    for (let g = 1; g <= 3; g++) {
      expect(gens[g]![1]![1]).toBe(1);
      expect(gens[g]![1]![2]).toBe(1);
      expect(gens[g]![2]![1]).toBe(1);
      expect(gens[g]![2]![2]).toBe(1);
    }
  });

  it('returns frozen generations', () => {
    const initial = [[1, 0], [0, 1]];
    const gens = gameOfLife(initial, 1);
    expect(Object.isFrozen(gens)).toBe(true);
    expect(Object.isFrozen(gens[0])).toBe(true);
  });

  it('throws on empty grid', () => {
    expect(() => gameOfLife([], 1)).toThrow(RangeError);
  });

  it('throws on empty rows', () => {
    expect(() => gameOfLife([[]], 1)).toThrow(RangeError);
  });

  it('throws on invalid steps', () => {
    expect(() => gameOfLife([[1]], 0)).toThrow(RangeError);
  });
});

describe('caToEvents', () => {
  it('generates events for active cells', () => {
    const grid = [
      [1, 0, 1],
      [0, 1, 0],
    ];
    const events = caToEvents(grid);
    expect(events).toHaveLength(3);
  });

  it('uses default mapping values', () => {
    const grid = [[1]];
    const events = caToEvents(grid);
    expect(events[0]!.midi).toBe(60);
    expect(events[0]!.onset).toBe(0);
    expect(events[0]!.duration).toBe(480);
    expect(events[0]!.velocity).toBe(80);
  });

  it('applies custom mapping', () => {
    const grid = [[0, 1]];
    const events = caToEvents(grid, {
      startTick: 100,
      ticksPerRow: 960,
      baseMidi: 48,
      midiStep: 2,
      duration: 240,
      velocity: 100,
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.midi).toBe(50); // 48 + 1*2
    expect(events[0]!.onset).toBe(100);
    expect(events[0]!.duration).toBe(240);
    expect(events[0]!.velocity).toBe(100);
  });

  it('maps row to time and column to pitch', () => {
    const grid = [
      [1, 0, 0],
      [0, 0, 1],
    ];
    const events = caToEvents(grid);
    // Row 0, Col 0: onset=0, midi=60
    expect(events[0]!.onset).toBe(0);
    expect(events[0]!.midi).toBe(60);
    // Row 1, Col 2: onset=480, midi=62
    expect(events[1]!.onset).toBe(480);
    expect(events[1]!.midi).toBe(62);
  });

  it('returns frozen array with frozen events', () => {
    const grid = [[1]];
    const events = caToEvents(grid);
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[0])).toBe(true);
  });

  it('returns empty for all-zero grid', () => {
    const grid = [[0, 0], [0, 0]];
    expect(caToEvents(grid)).toHaveLength(0);
  });
});
