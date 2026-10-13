import { describe, it, expect } from 'vitest';
import * as C from './constants.js';
import { payoutFor } from './scoring.js';

describe('grid constants', () => {
  it('centers a 60x40 field inside the 80x60 grid with a 10-tile ring', () => {
    expect(C.COLS * C.ROWS).toBe(4800);
    expect(C.FIELD_X0).toBe(10);
    expect(C.FIELD_Y0).toBe(10);
    expect(C.COLS - C.FIELD_X1).toBe(10);
    expect(C.ROWS - C.FIELD_Y1).toBe(10);
  });
});

describe('tutorial economy', () => {
  it('a won tutorial bet lands the player on the normal $100 stack', () => {
    const afterWin = C.TUTORIAL_BANKROLL + payoutFor('win', C.TUTORIAL_STAKE);
    expect(C.TUTORIAL_STAKE).toBeLessThanOrEqual(C.TUTORIAL_BANKROLL);
    expect(afterWin).toBe(C.WAGER);
  });
});
