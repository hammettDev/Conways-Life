import { COLS, ROWS, DEAD, BLUE, BASE_GAIN, HOT_BONUS } from './constants.js';

// Each live team cell raises its own team's tower at that tile:
// +1 normally, +2 when the tile sits on a live underworld (Hot Zone) cell.
// Returns the number of live cells that were standing on a Hot Zone.
export function accumulateTowers(teams, hot, blueTower, redTower) {
  let hotHits = 0;
  for (let i = 0; i < COLS * ROWS; i++) {
    const t = teams[i];
    if (t === DEAD) continue;
    const gain = hot[i] ? HOT_BONUS : BASE_GAIN;
    if (hot[i]) hotHits++;
    if (t === BLUE) blueTower[i] += gain;
    else redTower[i] += gain;
  }
  return hotHits;
}
