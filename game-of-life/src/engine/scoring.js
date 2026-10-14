import { COLS, FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1, DEAD, BLUE, RED } from './constants.js';

// Plot ownership for every tile in the Playing Field:
//  - a tile in `locked` (held by a repeating cell at stabilization) goes to
//    that team outright;
//  - otherwise the higher tower wins;
//  - equal towers are unclaimed.
// Returns { blue, red, neutral } plot counts.
export function scorePlots(blueTower, redTower, locked) {
  let blue = 0;
  let red = 0;
  let neutral = 0;
  for (let y = FIELD_Y0; y < FIELD_Y1; y++) {
    for (let x = FIELD_X0; x < FIELD_X1; x++) {
      const i = y * COLS + x;
      const lock = locked ? locked[i] : DEAD;
      if (lock === BLUE) blue++;
      else if (lock === RED) red++;
      else if (blueTower[i] > redTower[i]) blue++;
      else if (redTower[i] > blueTower[i]) red++;
      else neutral++;
    }
  }
  return { blue, red, neutral };
}

// Total tower height each team has built on the Playing Field. Hot Zones add
// double chips, so this is the tiebreaker when plots are exactly level.
export function fieldHeat(blueTower, redTower) {
  let blue = 0;
  let red = 0;
  for (let y = FIELD_Y0; y < FIELD_Y1; y++) {
    for (let x = FIELD_X0; x < FIELD_X1; x++) {
      blue += blueTower[y * COLS + x];
      red += redTower[y * COLS + x];
    }
  }
  return { blue, red };
}

// Even-money outcome for the player (Blue): 'win' | 'lose' | 'push'.
export function outcomeFor(score) {
  if (score.blue > score.red) return 'win';
  if (score.blue < score.red) return 'lose';
  return 'push';
}

// Net change to the wallet. `multiplier` scales a win (bosses pay more);
// a loss always costs one wager and a push returns it.
export function payoutFor(outcome, wager, multiplier = 1) {
  if (outcome === 'win') return wager * multiplier;
  if (outcome === 'lose') return -wager;
  return 0;
}
