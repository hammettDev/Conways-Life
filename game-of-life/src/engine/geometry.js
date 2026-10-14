import { COLS, ROWS, FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1 } from './constants.js';

// The board a match is played on. The classic game is G2: two teams on an 80x60 grid with a 60x40
// field. The 4-player arena doubles the board by stacking a second field under the first: the same
// 60-wide field, 80 tall, with four starting setups (top-left, top-right, bottom-left, bottom-right) and
// a larger pit under it.
export const G2 = { id: '2p', cols: COLS, rows: ROWS, fx0: FIELD_X0, fx1: FIELD_X1, fy0: FIELD_Y0, fy1: FIELD_Y1, teams: 2, pitSize: 10 };
export const G4 = { id: '4p', cols: COLS, rows: 100, fx0: FIELD_X0, fx1: FIELD_X1, fy0: FIELD_Y0, fy1: 90, teams: 4, pitSize: 14 };

export const geometryFor = (id) => (id === '4p' ? G4 : G2);
