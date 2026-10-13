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
