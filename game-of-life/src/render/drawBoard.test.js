import { describe, it, expect } from 'vitest';
import { BLUE, RED } from '../engine/constants.js';
import { stackDiscs } from './drawBoard.js';

describe('stackDiscs', () => {
  it('draws nothing for an empty stack', () => {
    expect(stackDiscs(null)).toEqual([]);
    expect(stackDiscs([])).toEqual([]);
  });

  it('keeps the colour order of a small stack, one disc per chip', () => {
    expect(stackDiscs([[BLUE, 2], [RED, 1], [BLUE, 1]])).toEqual([BLUE, BLUE, RED, BLUE]);
  });

  it('compresses a tall stack to the disc cap, keeping order and proportions', () => {
    const discs = stackDiscs([[BLUE, 5], [RED, 10], [BLUE, 20]], 14);
    expect(discs).toHaveLength(14);
    expect(discs[0]).toBe(BLUE);
    expect(discs[discs.length - 1]).toBe(BLUE);
    const red = discs.filter((d) => d === RED).length;
    expect(red).toBeGreaterThanOrEqual(3); // 10 of 35 chips is about 4 of 14 discs
    expect(red).toBeLessThanOrEqual(5);
    // colours never interleave out of order: blue ... red ... blue
    const changes = discs.filter((d, i) => i > 0 && d !== discs[i - 1]).length;
    expect(changes).toBe(2);
  });
});

import { toScreen, boardSize } from './drawBoard.js';
import { COLS, ROWS } from '../engine/constants.js';

describe('Madden view mapping', () => {
  it('leaves the sideways view alone', () => {
    expect(toScreen(12, 7, false)).toEqual([12, 7]);
    expect(boardSize(false)).toEqual({ cols: COLS, rows: ROWS });
  });

  it('puts Blue (left, small x) at the bottom and Red (right) at the top', () => {
    const [, blueY] = toScreen(5, 30, true);
    const [, redY] = toScreen(75, 30, true);
    expect(blueY).toBeGreaterThan(redY);
    expect(toScreen(0, 0, true)).toEqual([0, COLS - 1]);
    expect(toScreen(COLS - 1, ROWS - 1, true)).toEqual([ROWS - 1, 0]);
  });

  it('turns the vertical line of scrimmage into a horizontal one', () => {
    // Every tile on the middle column maps to the same screen row.
    const rows = new Set([0, 10, 25, 59].map((y) => toScreen(COLS / 2, y, true)[1]));
    expect(rows.size).toBe(1);
    expect(boardSize(true)).toEqual({ cols: ROWS, rows: COLS });
  });

  it('is a bijection over the board (no tile is lost or doubled)', () => {
    const seen = new Set();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) seen.add(toScreen(x, y, true).join(','));
    expect(seen.size).toBe(COLS * ROWS);
  });
});
