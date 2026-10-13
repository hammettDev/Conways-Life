import { describe, it, expect } from 'vitest';
import * as C from './constants.js';

describe('grid constants', () => {
  it('centers a 60x40 field inside the 80x60 grid with a 10-tile ring', () => {
    expect(C.COLS * C.ROWS).toBe(4800);
    expect(C.FIELD_X0).toBe(10);
    expect(C.FIELD_Y0).toBe(10);
    expect(C.COLS - C.FIELD_X1).toBe(10);
    expect(C.ROWS - C.FIELD_Y1).toBe(10);
  });
});
