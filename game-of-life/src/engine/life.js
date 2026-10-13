import { COLS, ROWS, DEAD, BLUE, RED } from './constants.js';

// Advance the team grid one generation into `out`. Edges are hard walls.
// Survival: 2-3 neighbors keeps the cell's team.
// Birth: exactly 3 neighbors; the majority team of the parents wins
// (three parents can never tie).
export function stepTeams(src, out) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let blue = 0;
      let red = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= ROWS) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= COLS) continue;
          const v = src[ny * COLS + nx];
          if (v === BLUE) blue++;
          else if (v === RED) red++;
        }
      }
      const i = y * COLS + x;
      const n = blue + red;
      const cur = src[i];
      if (cur !== DEAD) out[i] = n === 2 || n === 3 ? cur : DEAD;
      else out[i] = n === 3 ? (blue > red ? BLUE : RED) : DEAD;
    }
  }
}

// Plain binary Conway step for the hidden underworld layer.
export function stepUnderworld(src, out) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= ROWS) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= COLS) continue;
          n += src[ny * COLS + nx];
        }
      }
      const i = y * COLS + x;
      out[i] = src[i] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }
}
