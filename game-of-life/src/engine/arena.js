import { BLUE, RED, GREEN, VIOLET } from './constants.js';
import { G2 } from './geometry.js';

// The 4-player arena stacks a second field under the classic one. Team 1 (you) is top-left, team 2 top-right,
// team 3 bottom-left, team 4 bottom-right. A formation is built for the classic board (blue on the left,
// red on the right), so the three bots reuse it: team 2 is the right-hand placement as it comes, team 4 the
// same moved down a field, team 3 its mirror image moved down.
export const ROW_H = G2.fy1 - G2.fy0;

const mirrorX = (cells, team) => cells.map((c) => ({ ...c, x: G2.cols - 1 - c.x, team }));
const shiftDown = (cells, team) => cells.map((c) => ({ ...c, y: c.y + ROW_H, team }));

// `redCells`: a bot setup's cells on the classic board (the right-hand side). `slot`: 2, 3 or 4.
export function arenaCells(redCells, slot) {
  if (slot === 2) return redCells.map((c) => ({ ...c, team: RED }));
  if (slot === 3) return shiftDown(mirrorX(redCells, GREEN), GREEN);
  return shiftDown(redCells, VIOLET);
}

export const ARENA_TEAMS = [BLUE, RED, GREEN, VIOLET];
export const TEAM_NAMES = { [BLUE]: 'You', [RED]: 'Red', [GREEN]: 'Lime', [VIOLET]: 'Violet' };
